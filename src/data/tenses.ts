import type { GroupKey, Level, RecLevel, Tense, TenseGroup, TenseKey } from './types';

/**
 * 15 个时态。g = 分组；cp = 1 表示复合时态（haber + 过去分词）；
 * es = 西班牙语原名（两种界面语言下都显示）；zh / en = 界面语言下的名称。
 */
export const TENSES: Tense[] = [
  { k: 'p',   zh: '现在时',             en: 'Present',                     es: 'Presente',                    g: 'ind',  cp: 0, lv: 'A1' },
  { k: 'pr',  zh: '简单过去时',         en: 'Preterite',                   es: 'Pretérito indefinido',        g: 'ind',  cp: 0, lv: 'A2' },
  { k: 'i',   zh: '过去未完成时',       en: 'Imperfect',                   es: 'Imperfecto',                  g: 'ind',  cp: 0, lv: 'A2' },
  { k: 'f',   zh: '将来时',             en: 'Future',                      es: 'Futuro simple',               g: 'ind',  cp: 0, lv: 'B1' },
  { k: 'pp',  zh: '现在完成时',         en: 'Present perfect',             es: 'Pretérito perfecto',          g: 'ind',  cp: 1, lv: 'A1' },
  { k: 'pq',  zh: '过去完成时',         en: 'Pluperfect',                  es: 'Pluscuamperfecto',            g: 'ind',  cp: 1, lv: 'B1' },
  { k: 'fp',  zh: '将来完成时',         en: 'Future perfect',              es: 'Futuro compuesto',            g: 'ind',  cp: 1, lv: 'B2' },
  { k: 'c',   zh: '条件式',             en: 'Conditional',                 es: 'Condicional simple',          g: 'cond', cp: 0, lv: 'B1' },
  { k: 'cp',  zh: '条件完成时',         en: 'Conditional perfect',         es: 'Condicional compuesto',       g: 'cond', cp: 1, lv: 'B2' },
  { k: 'sp',  zh: '虚拟式现在时',       en: 'Present subjunctive',         es: 'Subjuntivo presente',         g: 'sub',  cp: 0, lv: 'B1' },
  { k: 'si',  zh: '虚拟式过去未完成时', en: 'Imperfect subjunctive',       es: 'Subjuntivo imperfecto',       g: 'sub',  cp: 0, lv: 'B2' },
  { k: 'spt', zh: '虚拟式现在完成时',   en: 'Present perfect subjunctive', es: 'Subjuntivo perfecto',         g: 'sub',  cp: 1, lv: 'B2' },
  { k: 'sq',  zh: '虚拟式过去完成时',   en: 'Pluperfect subjunctive',      es: 'Subjuntivo pluscuamperfecto', g: 'sub',  cp: 1, lv: 'B2' },
  { k: 'ia',  zh: '肯定命令式',         en: 'Affirmative imperative',      es: 'Imperativo afirmativo',       g: 'imp',  cp: 0, lv: 'B2' },
  { k: 'in',  zh: '否定命令式',         en: 'Negative imperative',         es: 'Imperativo negativo',         g: 'imp',  cp: 0, lv: 'B2' },
];

export const TENSE_GROUPS: TenseGroup[] = [
  { k: 'ind',  zh: '陈述式', en: 'Indicative',  es: 'Indicativo',  hint: '叙述事实',        ehint: 'states facts' },
  { k: 'cond', zh: '条件式', en: 'Conditional', es: 'Condicional', hint: '假设、礼貌',      ehint: 'hypothetical, polite' },
  { k: 'sub',  zh: '虚拟式', en: 'Subjunctive', es: 'Subjuntivo',  hint: '主观、愿望、从句', ehint: 'wishes, subordinate clauses' },
  { k: 'imp',  zh: '命令式', en: 'Imperative',  es: 'Imperativo',  hint: '下达命令',        ehint: 'commands' },
];

export const ALL_TENSE_KEYS: TenseKey[] = TENSES.map((t) => t.k);

/** 按时态键取元数据 */
export const T: Record<string, Tense> = {};
TENSES.forEach((t) => { T[t.k] = t; });

/** 按分组键取元数据 */
export const G: Record<string, TenseGroup> = {};
TENSE_GROUPS.forEach((g) => { G[g.k] = g; });

export const GZH: Record<string, string> = {};
TENSE_GROUPS.forEach((g) => { GZH[g.k] = g.zh; });

/** 取某分组下的简单 / 复合时态；has 可再筛「该动词确有形式」的时态 */
export const tensesOf = (
  g: GroupKey,
  cp: boolean | 0 | 1,
  has?: (k: TenseKey) => boolean
): Tense[] => TENSES.filter((t) => t.g === g && !!t.cp === !!cp && (!has || has(t.k)));

/**
 * 「按难度推荐时态」用的参考时态集（顺序与 TENSES 一致，便于阅读）。
 * 只到 B2：B2 已经是全部 15 个时态，C1/C2 再列一遍没有意义，
 * 所以推荐行保持 A1~B2 四档，等级筛选行才是六档。
 */
export const LV_TENSE: Record<RecLevel, TenseKey[]> = {
  A1: ['p', 'pp'],
  A2: ['p', 'pr', 'i', 'pp'],
  B1: ['p', 'pr', 'i', 'f', 'pp', 'pq', 'c', 'sp'],
  B2: ALL_TENSE_KEYS.slice(),
};

/** 推荐行的四个档位（顺序固定） */
export const TENSE_RECS: RecLevel[] = ['A1', 'A2', 'B1', 'B2'];

/** 词表难度等级（与 build_final.py 的 LEVELS 保持一致） */
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
