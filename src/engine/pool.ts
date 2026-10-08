import type {
  FormHit,
  HlRow,
  PersonIdx,
  Settings,
  TenseKey,
  Verb,
} from '@/data/types';
import { ALL_TENSE_KEYS } from '@/data/tenses';

/**
 * 词库与动词数据访问 —— 全部是纯函数，零 UI 依赖。
 * 对应旧版 app_template.html 的 forms / formHits / codesOf / hlOf /
 * tagMatch / validPersons / askedPersons / tensePoolOf / buildPool。
 */

/** 取某动词某时态的 6 个人称形式；数据缺失或不是 6 段时返回 null */
export function forms(v: Verb, k: TenseKey): string[] | null {
  const raw = v.t[k];
  if (!raw) return null;
  const f = raw.split('|');
  return f.length === 6 ? f : null;
}

/**
 * 一个形式在整张变位表里的全部「人称 × 时态」读法。
 * 例：compramos → [{p:3,k:'p'}, {p:3,k:'pr'}]；habla → [{p:1,k:'ia'}, {p:2,k:'p'}]
 * 用于同形判定：这些都是语言学上成立的正解读法，选任一个都应算对。
 */
export function formHits(v: Verb, str: string): FormHit[] {
  const tgt = String(str == null ? '' : str).trim();
  const out: FormHit[] = [];
  if (!tgt) return out;
  ALL_TENSE_KEYS.forEach((k) => {
    const f = forms(v, k);
    if (!f) return;
    for (let i = 0; i < 6; i++) {
      if (f[i] && f[i].trim() === tgt) out.push({ p: i as PersonIdx, k });
    }
  });
  return out;
}

/** 数据里每个形式的「不规则类型」标记串（'.' 规则 / o 正字法拼写 / s 词干变化 / i 其他不规则） */
export const codesOf = (v: Verb, k: TenseKey): string => (v.c && v.c[k]) || '';

/** 与 codesOf 平行：每个形式「真正变了的那几个字母」区间；规则形式为 null */
export const hlOf = (v: Verb, k: TenseKey): HlRow | null => (v.h && v.h[k]) || null;

/**
 * 标签筛选。
 * '规则' / '不规则' 是互斥的两个大分类；其余标签走**前缀匹配**，
 * 所以 '词干变化' 能一并匹配 '词干变化(e→ie)' / '词干变化(o→ue)' 等。
 */
export function tagMatch(v: Verb, tag: string): boolean {
  if (!tag) return true;
  if (tag === '规则') return !v.g.includes('不规则');
  if (tag === '不规则') return v.g.includes('不规则');
  return v.g.some((x) => x.indexOf(tag) === 0);
}

/** 某时态在语法上成立的人称：命令式没有 yo，是 5 个 */
export function validPersons(k: TenseKey): PersonIdx[] {
  return k === 'ia' || k === 'in'
    ? [1, 2, 3, 4, 5]
    : [0, 1, 2, 3, 4, 5];
}

/**
 * 实际出题用的人称：默认含 vosotros；
 * 关掉设置里的 vosotros 后不再出第 6 人称（下标 4）的题。
 * 选项生成请用本题快照 q.s.vosotros，保证同一题口径一致。
 */
export const askedPersons = (k: TenseKey, vosotros: boolean): PersonIdx[] =>
  validPersons(k).filter((i) => vosotros || i !== 4);

/** 该动词在已选时态里「真的有形式」的那些时态（按 TENSES 顺序） */
export function tensePoolOf(v: Verb, tenses: TenseKey[]): TenseKey[] {
  return tenses.filter((k) => {
    const f = forms(v, k);
    return !!f && f.some((x) => x);
  });
}

/**
 * 按当前设置筛出本次可练的动词。
 * 三个条件是链式 filter —— 等级与标签是**交集**关系，不是并集。
 *
 * 形参收窄成 `Pick<...>`（而不是整个 `Settings`）：一个难度档的 `PresetCfg`
 * 带的正好就是这三样，轮播要算「这一档有多少个动词」时不必伪造
 * 练习模式 / 全局开关那五个字段。`Settings` 本身可以赋值给它，老调用点不用改。
 */
export function buildPool(
  verbs: Verb[],
  settings: Pick<Settings, 'levels' | 'tenses' | 'tagFilter'>
): Verb[] {
  const s = settings;
  let list = verbs.filter((v) => s.levels.includes(v.l));
  list = list.filter((v) => s.tenses.some((k) => forms(v, k)));
  if (s.tagFilter) list = list.filter((v) => tagMatch(v, s.tagFilter));
  return list;
}

/** 各等级在词库里实际有多少个动词（用来渲染「当前可练：A2 97 + B1 107」这类提示） */
export function countByLevel(verbs: Verb[], levels: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  levels.forEach((lv) => {
    out[lv] = verbs.filter((v) => v.l === lv).length;
  });
  return out;
}
