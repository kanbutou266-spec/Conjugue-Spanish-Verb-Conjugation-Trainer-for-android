/**
 * 讲解正文的 **HTML 子集解析器** —— 纯函数，零 UI / 零 store 依赖。
 *
 * 为什么要它：网页版的讲解正文是一段 HTML，靠 `innerHTML` 交给浏览器。
 * RN 没有 `innerHTML`（也**不该**引 react-native-render-html：正文只用到了
 * 十来个标签，为它背一个渲染库不划算，还不好单测）。
 *
 * 所以这里把正文解析成**节点树**：解析逻辑全在这个文件（可以在 Node 里跑测试），
 * 画的部分在 `ui/components/GuideBody.tsx`。两件事分开，样式改动不会碰到解析。
 *
 * 支持的标签就是网页版实际用到的那几种（`scripts/extract-guide.mjs` 抽出来的
 * 48 KB 正文里统计过，没有别的）：
 *
 *   块级：`h3` `p` `ul`/`li` `div.tip|.tip.ok|.tip.warnx` `table`/`tr`/`th`/`td`
 *   行内：`span.es`（西语词条）`b` `i` `s`（划掉的错误写法）`br`
 *   宏：  `{{G:hablar,comer|p}}`（展开成内嵌变位网格，见 `GuideBody`）
 *
 * 容错原则：**认不出的标签只丢标签本身，内容照收**；标签不闭合也不抛错
 * （宁可少一层加粗，也不能白屏）。这条是为了将来网页版加了新标签时，
 * App 至少还能把文字显示出来。
 */
import type { TenseKey } from '@/data/types';

/** 行内节点 */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'b'; kids: Inline[] }
  | { t: 'i'; kids: Inline[] }
  /** `span.es`：西语词条（网页给它单独的字色/字重） */
  | { t: 'es'; kids: Inline[] }
  /** `s`：网页用它划掉错误写法（si tendría 之类） */
  | { t: 's'; kids: Inline[] }
  | { t: 'br' }
  /** `{{G:...}}` 宏 */
  | { t: 'G'; verbs: string[]; tense: TenseKey };

/** 提示框语气（网页 `.tip` / `.tip.ok` / `.tip.warnx`） */
export type TipTone = 'tip' | 'ok' | 'warn';

/** 块级节点 */
export type Block =
  | { t: 'h3'; kids: Inline[] }
  | { t: 'p'; kids: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'tip'; tone: TipTone; kids: Inline[] }
  /** 表格：`head` = 该行是表头（网页里首行是 `th`） */
  | { t: 'table'; rows: { head: boolean; cells: Inline[][] }[] }
  | { t: 'G'; verbs: string[]; tense: TenseKey };

/* ------------------------------------------------------------------ *
 * 词法
 * ------------------------------------------------------------------ */

type Tok =
  | { k: 'open'; name: string; cls: string }
  | { k: 'close'; name: string }
  | { k: 'text'; v: string }
  | { k: 'G'; verbs: string[]; tense: TenseKey };

const OPEN_TAG = /^([a-zA-Z][a-zA-Z0-9]*)/;
const CLASS_ATTR = /class\s*=\s*"([^"]*)"/;

/** 把 `{{G:hablar,comer|p}}` 的 spec 拆成动词表 + 时态键 */
function macroSpec(spec: string): { verbs: string[]; tense: TenseKey } {
  const bar = spec.indexOf('|');
  const names = (bar < 0 ? spec : spec.slice(0, bar)).split(',');
  const tk = (bar < 0 ? 'p' : spec.slice(bar + 1)).trim() || 'p';
  return {
    verbs: names.map((s) => s.trim()).filter(Boolean),
    tense: tk as TenseKey,
  };
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  const n = src.length;
  let i = 0;
  const text = (v: string) => {
    if (v) toks.push({ k: 'text', v });
  };
  while (i < n) {
    const lt = src.indexOf('<', i);
    const lb = src.indexOf('{{G:', i);
    let next = -1;
    let macro = false;
    if (lt >= 0 && (lb < 0 || lt < lb)) next = lt;
    else if (lb >= 0) {
      next = lb;
      macro = true;
    }
    if (next < 0) {
      text(src.slice(i));
      break;
    }
    if (next > i) text(src.slice(i, next));

    if (macro) {
      const end = src.indexOf('}}', next);
      if (end < 0) {
        text(src.slice(next));
        break;
      }
      toks.push({ k: 'G', ...macroSpec(src.slice(next + 4, end)) });
      i = end + 2;
      continue;
    }

    const gt = src.indexOf('>', next);
    if (gt < 0) {
      text(src.slice(next));
      break;
    }
    const raw = src.slice(next + 1, gt).trim();
    i = gt + 1;
    if (raw.startsWith('/')) {
      toks.push({ k: 'close', name: raw.slice(1).trim().toLowerCase() });
      continue;
    }
    if (raw.startsWith('!') || raw.startsWith('?')) continue; // 注释 / 声明
    const selfClose = raw.endsWith('/');
    const body = selfClose ? raw.slice(0, -1) : raw;
    const m = OPEN_TAG.exec(body);
    if (!m) continue;
    const name = m[1].toLowerCase();
    const cm = CLASS_ATTR.exec(body);
    if (name === 'br') {
      toks.push({ k: 'open', name: 'br', cls: '' });
      continue;
    }
    toks.push({ k: 'open', name, cls: cm ? cm[1] : '' });
  }
  return toks;
}

/* ------------------------------------------------------------------ *
 * 语法（递归下降；只认上面那套标签，其余一律透明跳过）
 * ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set(['h3', 'p', 'ul', 'ol', 'div', 'table']);
/** 行内标签里，「原样透传子节点」的那些 */
const PLAIN_INLINE = new Set(['strong', 'em', 'span', 'a', 'u', 'small']);

/** 块级标签名（解析块级列表时用来判断「这个 open 是不是该由我收下」） */
export const isBlockTag = (name: string): boolean => BLOCK_TAGS.has(name);

/**
 * 把标题里的**序号**（①②③…）单独拎出来，正文留标题本身。
 *
 * 网页 `renderGuide()` 做的是同一件事：序号做成主色圆标、标题大一号 ——
 * 翻页时第一眼就知道"翻到新的一页了"（用户原话）。目录页与详情页都要用，
 * 所以放在这一层（纯函数，可测）。
 */
export function splitGuideTitle(raw: string): { num: string; rest: string } {
  const m = /^\s*([①-⑳])\s*(.*)$/.exec(raw || '');
  return m ? { num: m[1]!, rest: m[2]! } : { num: '', rest: raw || '' };
}

/**
 * 块级闭合标签。行内解析遇到**不属于自己的**块级闭合标签时必须**原样退回**
 * （不消费、不越过）——否则一个漏写 `</b>` 的加粗会把后面整页都吞进 `<b>` 里，
 * 表现就是「后面几段全变粗、小标题也消失」。
 */
const BLOCK_CLOSE = new Set(['h3', 'p', 'ul', 'ol', 'div', 'table', 'tr', 'td', 'th', 'li']);

const tipTone = (cls: string): TipTone =>
  cls.indexOf('ok') > -1 ? 'ok' : cls.indexOf('warn') > -1 ? 'warn' : 'tip';

/** 空白折叠成单个空格（HTML 的换行缩进不该变成正文里的空洞） */
const collapse = (v: string): string => v.replace(/[\s\u00a0]+/g, ' ');

/** 去掉两端空白文本节点，并折叠空白 */
function trim(kids: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const k of kids) {
    if (k.t === 'text') {
      const v = collapse(k.v);
      if (!v.trim() && (out.length === 0 || out[out.length - 1]?.t === 'br')) continue;
      out.push({ t: 'text', v });
      continue;
    }
    if (k.t === 'br') {
      if (out.length === 0) continue;
      out.push(k);
      continue;
    }
    out.push(k);
  }
  while (out.length && out[out.length - 1]?.t === 'br') out.pop();
  // 首尾文本节点去掉多余空格
  const first = out[0];
  if (first && first.t === 'text') first.v = first.v.replace(/^ +/, '');
  const last = out[out.length - 1];
  if (last && last.t === 'text') last.v = last.v.replace(/ +$/, '');
  return out;
}

export function parseGuide(src: string): Block[] {
  const toks = tokenize(src || '');
  let p = 0;

  function parseInline(stop: Set<string>): Inline[] {
    const out: Inline[] = [];
    const push = (node: Inline) => {
      const last = out[out.length - 1];
      if (node.t === 'text' && last && last.t === 'text') {
        last.v += node.v;
        return;
      }
      out.push(node);
    };
    while (p < toks.length) {
      const tk = toks[p]!;
      if (tk.k === 'close') {
        if (stop.has(tk.name)) {
          p++;
          break;
        }
        // 不属于本层的块级闭合标签：退回去，让上层去收（未闭合标签的兜底）
        if (BLOCK_CLOSE.has(tk.name)) break;
        p++;
        continue;
      }
      if (tk.k === 'text') {
        p++;
        push({ t: 'text', v: collapse(tk.v) });
        continue;
      }
      if (tk.k === 'G') {
        p++;
        push({ t: 'G', verbs: tk.verbs, tense: tk.tense });
        continue;
      }
      // open
      const { name, cls } = tk;
      if (name === 'br') {
        p++;
        push({ t: 'br' });
        continue;
      }
      if (name === 'b' || name === 'i' || name === 's') {
        p++;
        push({ t: name, kids: parseInline(new Set([name])) });
        continue;
      }
      if (name === 'span') {
        p++;
        const kids = parseInline(new Set(['span']));
        if (cls === 'es') push({ t: 'es', kids });
        else kids.forEach(push);
        continue;
      }
      if (PLAIN_INLINE.has(name)) {
        p++;
        parseInline(new Set([name])).forEach(push);
        continue;
      }
      // 认不出的（含块级标签跑进行内的情况）：丢标签，内容照收
      p++;
    }
    return out;
  }

  function parseList(): Inline[][] {
    const items: Inline[][] = [];
    while (p < toks.length) {
      const tk = toks[p]!;
      if (tk.k === 'close' && (tk.name === 'ul' || tk.name === 'ol')) {
        p++;
        break;
      }
      if (tk.k === 'open' && tk.name === 'li') {
        p++;
        items.push(trim(parseInline(new Set(['li']))));
        continue;
      }
      if (tk.k === 'text') {
        p++;
        continue;
      }
      if (tk.k === 'close') {
        p++;
        continue;
      }
      // ul 里混进别的东西：当段落收下
      items.push(trim(parseInline(new Set(['li']))));
    }
    return items;
  }

  function parseTable(): Block & { t: 'table' } {
    const rows: { head: boolean; cells: Inline[][] }[] = [];
    while (p < toks.length) {
      const tk = toks[p]!;
      if (tk.k === 'close' && tk.name === 'table') {
        p++;
        break;
      }
      if (tk.k === 'open' && tk.name === 'tr') {
        p++;
        const cells: Inline[][] = [];
        let head = false;
        let anyTh = false;
        let anyTd = false;
        while (p < toks.length) {
          const c = toks[p]!;
          if (c.k === 'close' && c.name === 'tr') {
            p++;
            break;
          }
          if (c.k === 'open' && (c.name === 'th' || c.name === 'td')) {
            const isHead = c.name === 'th';
            anyTh = anyTh || isHead;
            anyTd = anyTd || !isHead;
            p++;
            cells.push(trim(parseInline(new Set(['th', 'td']))));
            continue;
          }
          p++;
        }
        head = anyTh && !anyTd;
        rows.push({ head, cells });
        continue;
      }
      p++;
    }
    return { t: 'table', rows };
  }

  const blocks: Block[] = [];
  while (p < toks.length) {
    const tk = toks[p]!;
    if (tk.k === 'text') {
      p++;
      continue; // 块级之间的缩进换行
    }
    if (tk.k === 'close') {
      p++;
      continue;
    }
    if (tk.k === 'G') {
      p++;
      blocks.push({ t: 'G', verbs: tk.verbs, tense: tk.tense });
      continue;
    }
    const { name } = tk;
    if (name === 'br') {
      p++;
      continue;
    }
    if (name === 'h3' || name === 'p') {
      p++;
      blocks.push({ t: name, kids: trim(parseInline(new Set([name]))) });
      continue;
    }
    if (name === 'div') {
      const tone = tipTone(tk.cls);
      p++;
      blocks.push({ t: 'tip', tone, kids: trim(parseInline(new Set(['div']))) });
      continue;
    }
    if (name === 'ul' || name === 'ol') {
      p++;
      blocks.push({ t: 'ul', items: parseList() });
      continue;
    }
    if (name === 'table') {
      p++;
      blocks.push(parseTable());
      continue;
    }
    p++; // 认不出的块级标签：丢掉标签，内容会在下一轮被收进 p / 或被忽略
  }
  return blocks;
}
