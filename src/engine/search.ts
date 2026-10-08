import { VERBS } from '@/data/verbs';
import type { Verb, TenseKey } from '@/data/types';
import { forms } from './pool';
import { norm } from '@/utils/unicode';

/**
 * 变位查询的**搜索引擎** —— 逐条对照网页 `searchVerbs()` / `buildFormIdx()`。
 *
 * 四路召回，优先级从高到低：
 *   ① 原形**前缀**匹配（habl → hablar）
 *   ② 原形**包含**匹配（bla → hablar）
 *   ③ 释义匹配（中英文一起搜，如「穿」→ vestir）
 *   ④ **变位形式**反查（"hable" → hablar；靠惰性构建的全形式索引）
 * 同一动词只出现一次（先到先得，所以顺序就是相关顺序）。
 */

export interface VerbHit {
  /** 动词在词表里的下标 */
  idx: number;
  /**
   * 命中来源：原形 / 释义命中时为空串；
   * 变位形式命中时是归一化后的形式（建议列表里展示「hable · 虚拟式现在时」用）
   */
  form: string;
  /** 变位形式命中时，该形式所属的时态键 */
  tk: TenseKey | '';
}

/** 变位形式 → 动词 的反查索引（惰性构建一次，之后直接复用） */
let FORM_IDX: Map<string, { idx: number; k: TenseKey }> | null = null;

function buildFormIdx(verbs: Verb[]): Map<string, { idx: number; k: TenseKey }> {
  if (FORM_IDX && verbs === VERBS) return FORM_IDX;
  const m = new Map<string, { idx: number; k: TenseKey }>();
  verbs.forEach((v, idx) => {
    (Object.keys(v.t) as TenseKey[]).forEach((k) => {
      const f = forms(v, k);
      if (!f) return;
      f.forEach((x) => {
        const key = norm(x);
        // 同一形式有多种读法时只记第一个时态 —— 反查只是搜索入口，不是判分
        if (key && !m.has(key)) m.set(key, { idx, k });
      });
    });
  });
  if (verbs === VERBS) FORM_IDX = m;
  return m;
}

/** 单测/大词库场景可注入动词表；默认全库 */
export function searchVerbs(q: string, verbs: Verb[] = VERBS): VerbHit[] {
  const s = norm(q);
  if (!s) return [];
  const out: VerbHit[] = [];
  const seen = new Set<number>();
  const limit = 24;
  const add = (idx: number, form = '', tk: TenseKey | '' = '') => {
    if (idx < 0 || seen.has(idx) || out.length >= limit) return;
    seen.add(idx);
    out.push({ idx, form, tk });
  };

  verbs.forEach((v, idx) => { if (norm(v.i).indexOf(s) === 0) add(idx); }); // ① 原形前缀
  verbs.forEach((v, idx) => { if (norm(v.i).indexOf(s) > 0) add(idx); });   // ② 原形包含
  const needle = q.trim().toLowerCase();
  verbs.forEach((v, idx) => {                                               // ③ 释义（中 + 英）
    if (((v.z || '') + ' ' + (v.e || '')).toLowerCase().indexOf(needle) >= 0) add(idx);
  });

  const idxMap = buildFormIdx(verbs);                                       // ④ 变位形式反查
  for (const [key, hit] of idxMap) {
    if (key.indexOf(s) !== 0) continue;
    add(hit.idx, key, hit.k);
    if (out.length >= limit) break;
  }
  return out;
}

/** 建议列表条数上限（网页 `SUG_LIST = list.slice(0, 12)`） */
export const SUG_LIMIT = 12;

/**
 * 查询页的「默认动词」—— 打开时还没有搜索词的兜底。
 * 网页硬编码 `DW_VERB = 'hablar'`，这里改成查不到就用第一个动词，更稳。
 */
export function defaultTableVerb(verbs: Verb[] = VERBS): string {
  const hab = verbs.find((v) => v.i === 'hablar');
  return (hab ?? verbs[0])?.i ?? '';
}
