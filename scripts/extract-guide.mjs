/**
 * 从网页版模板里抽取「变位规则讲解」的内容，生成 `src/data/guide.ts`。
 *
 * 为什么要脚本而不是手抄：
 *   讲解正文与网页版**必须逐字一致**（记忆里的红线：两版功能对齐）。
 *   手抄一遍迟早会漂；这里做的是「切片 + 加类型标注」，正文一个字符都不改。
 *   网页版改了讲解内容，重跑一次就同步：
 *
 *     node scripts/extract-guide.mjs [app_template.html 的路径]
 *
 * 默认去 `../动词变位/data/app_template.html`（相对本仓库）找，找不到就报错退出。
 *
 * 抽取范围（用标记定位，不用行号 —— 网页版随时会改行数）：
 *   `/* 常用权威外链 *\/` …（lkRae + LK_* 常量 + GUIDE 数组）… `const GUIDE_MAP`
 * 另外把 `TENSE_GUIDE`（时态 → 讲解页 slug）也一并带过来。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const CANDIDATES = [
  process.argv[2],
  'D:/我爱学习！！/语言/espanol/动词变位/data/app_template.html',
  resolve(ROOT, '../动词变位/data/app_template.html'),
].filter(Boolean);

const src = CANDIDATES.find((p) => existsSync(p));
if (!src) {
  console.error('找不到 app_template.html，请把路径作为第一个参数传进来。');
  process.exit(1);
}
const html = readFileSync(src, 'utf8');

/** 取 [startMark, endMark) 之间的原文 */
function slice(text, startMark, endMark) {
  const a = text.indexOf(startMark);
  if (a < 0) throw new Error('找不到起点标记: ' + startMark);
  const b = text.indexOf(endMark, a);
  if (b < 0) throw new Error('找不到终点标记: ' + endMark);
  return text.slice(a, b);
}

const block = slice(html, '/* 常用权威外链 */', 'const GUIDE_MAP')
  .replace(/\s+$/, '\n');
const tenseGuide = slice(html, 'const TENSE_GUIDE = {', '};') + '};\n';

/* 加类型标注：lkRae 的返回值、GUIDE 的元素形状都要能让 tsc 认出来 */
const typed = block
  .replace('const lkRae = v => ({', 'const lkRae = (v: string): GuideLink => ({')
  .replace('const GUIDE = [', 'export const GUIDE: GuidePage[] = [');

if (typed === block) throw new Error('类型标注没打上：网页版的结构可能变了，检查 lkRae / GUIDE 的写法。');

const out = `/**
 * 语法讲解的正文数据 —— **由 \`scripts/extract-guide.mjs\` 从网页版模板抽取**，
 * 请勿手改：要改文案请改网页版 \`data/app_template.html\` 里的 GUIDE，然后重跑
 * \`node scripts/extract-guide.mjs\`，两边才会保持一致。
 *
 * 正文是 **HTML 子集**（h3 / p / ul / li / div.tip / span.es / b / i / br），
 * 外加一个宏 \`{{G:动词,动词|时态键}}\` —— 渲染前由 \`src/ui/html.ts\` 解析成节点树，
 * 宏在 \`GuideBody\` 里变成内嵌变位网格（对应网页的 \`expandGuide\` / \`guideGrid\`）。
 *
 * 与网页版的对应关系：
 *   GUIDE / LK_* / lkRae   → 这里
 *   GUIDE_MAP / guideTxt / guideBody / guideVerbs → 文件末尾的几个纯函数
 *   TENSE_GUIDE            → 时态 → 讲解页（作答页「相关语法」跳转用）
 */
import type { Lang, TenseKey } from './types';

/** 一条中英双语文本（网页里到处在用的 \`{zh, en}\`） */
export interface Bi {
  zh: string;
  en: string;
}

/** 权威外链：地址 + 名字 + 一句说明 */
export interface GuideLink {
  u: string;
  n: Bi;
  d: Bi;
}

/** 一页讲解 */
export interface GuidePage {
  /** 稳定 slug（路由 \`/guide/[slug]\` 用它） */
  k: string;
  /** 完整标题（正文页 h2，带 ① 序号） */
  t: Bi;
  /** 目录里的短标题 */
  s: Bi;
  /** 中文正文（HTML 子集） */
  zh: string;
  /** 英文正文 */
  en: string;
  /** 该页的权威外链 */
  lk: GuideLink[];
}

${typed}
/* 每个时态对应的讲解页（网页 \`TENSE_GUIDE\`：作答页的「相关语法」按钮用它跳转） */
export ${tenseGuide}
/* ------------------------------------------------------------------ *
 * 与网页版同名的几个小工具
 * ------------------------------------------------------------------ */

/** slug → 在 GUIDE 里的下标 */
export const GUIDE_MAP: Record<string, number> = {};
GUIDE.forEach((g, i) => {
  GUIDE_MAP[g.k] = i;
});

/** 双语字段取值（缺英文回退中文；都没有给空串） */
export function guideText(o: Bi | undefined, lang: Lang): string {
  if (!o) return '';
  return (lang === 'en' ? o.en || o.zh : o.zh) ?? '';
}

/** 某一页的正文（按当前语言） */
export const guideBody = (it: GuidePage, lang: Lang): string =>
  (lang === 'en' ? it.en || it.zh : it.zh) || '';

/** 目录里的短标题 */
export const guideShort = (k: string, lang: Lang): string => {
  const i = GUIDE_MAP[k];
  return i == null ? '' : guideText(GUIDE[i]?.s, lang);
};

/** 完整标题 */
export const guideFull = (k: string, lang: Lang): string => {
  const i = GUIDE_MAP[k];
  return i == null ? '' : guideText(GUIDE[i]?.t, lang);
};

/** 某一页在 GUIDE 里的下标（认不出给 -1） */
export const guideIndex = (k: string): number =>
  Object.prototype.hasOwnProperty.call(GUIDE_MAP, k) ? GUIDE_MAP[k] : -1;

/** 时态 → 讲解页 slug（认不出给 ''） */
export const guideForTense = (tk: TenseKey): string =>
  (TENSE_GUIDE as Record<string, string>)[tk] ?? '';

/**
 * 正文里出现过的所有动词 —— 供测试核对「讲解页提到的动词都在词表里」
 * （网页版同名函数 \`guideVerbs()\`，test_tense.js 用它兜底）。
 */
export function guideVerbs(): string[] {
  const out: string[] = [];
  GUIDE.forEach((it) => {
    (['zh', 'en'] as const).forEach((l) => {
      String(it[l] || '').replace(/\\{\\{G:([^}|]+)\\|/g, (m, names: string) => {
        names.split(',').forEach((n) => {
          const x = n.trim();
          if (x && out.indexOf(x) < 0) out.push(x);
        });
        return m;
      });
    });
  });
  return out;
}
`;

const dest = resolve(ROOT, 'src/data/guide.ts');
writeFileSync(dest, out, 'utf8');
console.log(`已写出 ${dest}`);
console.log(`讲解页数：${(out.match(/^  k:'/gm) || []).length}；字节数：${out.length}`);
