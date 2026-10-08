import type { DiagKind, PersonIdx, Question, TenseKey, Verb } from '@/data/types';
import { PRON } from '@/data/persons';
import { codesOf } from './pool';
import { norm, stripAcc } from '@/utils/unicode';

/**
 * 判分 —— 对应旧版 app_template.html 的 cleanAnswer / siAlt / judge / diagOf。
 * 纯函数，零 UI 依赖。
 */

/** 虚拟式过去未完成时的 -ra / -se 互换（按后缀长度优先匹配） */
const SI_RULES: [string, string][] = (
  [
    ['iéramos', 'iésemos'], ['áramos', 'ásemos'], ['iésemos', 'iéramos'], ['ásemos', 'áramos'],
    ['iérais', 'iéseis'], ['árais', 'áseis'], ['iéseis', 'iérais'], ['áseis', 'árais'],
    ['ierais', 'ieseis'], ['ieras', 'ieses'], ['ieran', 'iesen'], ['iera', 'iese'],
    ['ieseis', 'ierais'], ['ieses', 'ieras'], ['iesen', 'ieran'], ['iese', 'iera'],
    ['arais', 'aseis'], ['aras', 'ases'], ['aran', 'asen'], ['ara', 'ase'],
    ['aseis', 'arais'], ['ases', 'aras'], ['asen', 'aran'], ['ase', 'ara'],
    ['erais', 'eseis'], ['eras', 'eses'], ['eran', 'esen'], ['era', 'ese'],
    ['eseis', 'erais'], ['eses', 'eras'], ['esen', 'eran'], ['ese', 'era'],
  ] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

/**
 * -ra / -se 两种虚拟式过去未完成时形式互换。
 * 只换第一个词（复合时态的 haber 部分不动），且要求词长严格大于后缀长
 * —— 避免把 'sera' 里的 'era' 当后缀误换。
 */
export function siAlt(form: string): string {
  const parts = String(form).split(' ');
  const w = parts[0];
  for (const [suf, rep] of SI_RULES) {
    if (w.length > suf.length && w.endsWith(suf)) {
      parts[0] = w.slice(0, -suf.length) + rep;
      return parts.join(' ');
    }
  }
  return form;
}

/** 去掉用户答案中可能多写的代词、标点 */
export function cleanAnswer(s: unknown): string {
  let x = String(s).trim().replace(/[¡!¿?.,;]+$/g, '').replace(/^[¡¿]+/g, '');
  x = x.replace(/\s+/g, ' ');
  const w = x.split(' ');
  if (w.length > 1 && PRON.includes(w[0].toLowerCase())) x = w.slice(1).join(' ');
  return x;
}

export interface JudgeResult {
  ok: boolean;
  /** true 表示只是重音有误（严格模式下 ok=false，但可提示「差个重音」） */
  soft: boolean;
}

/**
 * 判断答案。
 *
 * @param correct 可以是单个形式，也可以是一组「都算对」的形式
 *                （平移模式里 A 出示的形式若本身有多重读法，B 在那些读法下的形式一并接受）
 * @param strict  严格重音：true 时「只是重音错了」不算对
 * @param tense   该题时态；si / sq 会自动补上 -ra/-se 互换的等价形式
 */
export function judge(
  user: unknown,
  correct: string | string[] | null | undefined,
  strict: boolean,
  tense: TenseKey
): JudgeResult {
  const u = cleanAnswer(user);
  if (!u) return { ok: false, soft: false };

  const alts: string[] = [];
  (Array.isArray(correct) ? correct : [correct]).forEach((c) => {
    if (c == null) return;
    alts.push(c);
    if (tense === 'si' || tense === 'sq') {
      const s = siAlt(c);
      if (s !== c) alts.push(s);
    }
  });

  // 先用整个备选集找「完全一致」，都找不到才退回到只差重音的宽容判定
  let softHit = false;
  for (const a of alts) {
    if (norm(u) === norm(a)) return { ok: true, soft: false };
    if (stripAcc(norm(u)) === stripAcc(norm(a))) softHit = true;
  }
  if (softHit) return { ok: !strict, soft: true };
  return { ok: false, soft: false };
}

/**
 * 答错时的**定性诊断**（返回码，文案由 UI 层翻译）。
 * 数据里每个形式都带分类码 c：'.' 规则 / o 正字法拼写 / s 词干变化 / i 其他不规则。
 * 只按码给一句定性的话，不去猜用户具体错在哪 —— 猜错了比不说更糟。
 * 返回 null 表示这一形式没有可说的分类。
 */
export function diagnose(
  v: Verb | undefined,
  k: TenseKey,
  person: PersonIdx
): DiagKind | null {
  if (!v) return null;
  const code = (codesOf(v, k) || '')[person] || '.';
  if (code === '.') return null;
  return code === 's' ? 'stem' : code === 'o' ? 'orth' : 'irr';
}

/** 按题目算出诊断码（转换模式看的是目标时态 tense2） */
export function diagOf(q: Question, v: Verb | undefined): DiagKind | null {
  const k = (q.mode === 'shift' ? q.tense2 : q.tense) as TenseKey;
  return diagnose(v, k, q.person);
}
