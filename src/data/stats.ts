import { MODE_KEYS } from './modes';
import { ALL_TENSE_KEYS, T } from './tenses';

import type { ModeKey, PersonIdx, TenseKey } from './types';

/**
 * 答题统计与错题本的**纯逻辑** —— 逐字段对齐网页版 `DB.stats`
 * （见 `data/app_template.html` 的 `recordAnswer()` / `renderStats()`）。
 *
 * 形状保持与网页完全一致，这样两个版本的导出 JSON 可以互相导入：
 * ```
 * { verbs: { 'hablar': {att, err, byT:{p:{att,err}}, last} },
 *   tenses: { p: {att, err} },
 *   modes:  { produce: {att, err} },
 *   total:  {att, err},
 *   wrong:  [{inf, tense, p, mode, user, ans, t}] }
 * ```
 *
 * 零 UI、零 store 依赖：`store/stats.ts` 只是它的状态容器，
 * 统计页与错题本读的是这里导出的派生函数（排序规则也在这里，不在页面里）。
 */

export interface Counts {
  att: number;
  err: number;
}

export interface VerbStat extends Counts {
  /** 该动词各时态的计数（只记出现过的时态） */
  byT: Record<string, Counts>;
  /** 最后一次作答时间戳 */
  last: number;
}

export interface WrongItem {
  inf: string;
  tense: TenseKey;
  p: PersonIdx;
  mode: ModeKey;
  /** 用户当时写的答案（未作答时是空串） */
  user: string;
  /** 该题的正确形式（转换模式下是目标时态，即 `ansOf(q)`） */
  ans: string;
  t: number;
}

export interface StatsData {
  verbs: Record<string, VerbStat>;
  tenses: Record<string, Counts>;
  modes: Record<string, Counts>;
  total: Counts;
  wrong: WrongItem[];
}

/** 错题本最多留这么多条（与网页一致），再多就裁掉最老的 */
export const WRONG_MAX = 300;
/** 错题本一次最多展示这么多条（与网页一致） */
export const WRONG_SHOW = 30;
/** 「最容易错的动词」榜的条数上限（与网页一致） */
export const HARDEST_SHOW = 20;

export const emptyStats = (): StatsData => ({
  verbs: {},
  tenses: {},
  modes: {},
  total: { att: 0, err: 0 },
  wrong: [],
});

/** 一次作答要记下来的全部信息 */
export interface AnswerRecord {
  inf: string;
  tense: TenseKey;
  person: PersonIdx;
  mode: ModeKey;
  ok: boolean;
  /** 用户写的答案；未作答传空串 */
  user: string;
  /** 正确答案（调用方负责用 `ansOf(q)` 取，转换模式下不得用源形式） */
  ans: string;
  /** 时间戳，默认取当前时间（可注入以便单测） */
  t?: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const num = (v: unknown): number => (isNum(v) ? v : 0);

/** 把任意输入收敛成一个 `Counts` */
function counts(v: unknown): Counts {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { att: num(o.att), err: num(o.err) };
}

/** 一个计数格子加上一次作答 */
export function bump(c: Counts | undefined, ok: boolean): Counts {
  const base = counts(c);
  return { att: base.att + 1, err: base.err + (ok ? 0 : 1) };
}

/** 正确率（百分数，四舍五入）。没答过 → 0 */
export function accuracy(c: Counts | undefined): number {
  const { att, err } = counts(c);
  return att ? Math.round((1 - err / att) * 100) : 0;
}

/** 错误率（0~1 的小数）。没答过 → 0 */
export function errRate(c: Counts | undefined): number {
  const { att, err } = counts(c);
  return att ? err / att : 0;
}

/**
 * 记一次作答 —— **纯函数**，返回全新对象，不改传进来的那份。
 * 网页版是就地改 `DB.stats` 再 `saveDB()`；RN 走 zustand，必须不可变。
 */
export function recordAnswer(st: StatsData, r: AnswerRecord): StatsData {
  const t = isNum(r.t) ? r.t : Date.now();
  const prev = st.verbs[r.inf];
  const vb: VerbStat = {
    att: (prev?.att ?? 0) + 1,
    err: (prev?.err ?? 0) + (r.ok ? 0 : 1),
    byT: { ...(prev?.byT ?? {}), [r.tense]: bump(prev?.byT?.[r.tense], r.ok) },
    last: t,
  };

  const wrong: WrongItem[] = r.ok
    ? st.wrong
    : [
        { inf: r.inf, tense: r.tense, p: r.person, mode: r.mode, user: r.user ?? '', ans: r.ans, t },
        ...st.wrong,
      ].slice(0, WRONG_MAX);

  return {
    verbs: { ...st.verbs, [r.inf]: vb },
    tenses: { ...st.tenses, [r.tense]: bump(st.tenses[r.tense], r.ok) },
    modes: { ...st.modes, [r.mode]: bump(st.modes[r.mode], r.ok) },
    total: bump(st.total, r.ok),
    wrong,
  };
}

/**
 * 清洗任意输入（老存档 / 手改过的存储 / 导入的 JSON）。
 * 坏格子一律丢弃而不是"补 0 保留"—— 保留一个 `{att:0,err:0}` 的动词
 * 会让「练习过的动词数」虚高。
 */
export function sanitizeStats(input: unknown): StatsData {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const verbs: Record<string, VerbStat> = {};
  const rv = (raw.verbs && typeof raw.verbs === 'object' ? raw.verbs : {}) as Record<string, unknown>;
  Object.keys(rv).forEach((inf) => {
    if (!inf) return;
    const o = (rv[inf] && typeof rv[inf] === 'object' ? rv[inf] : {}) as Record<string, unknown>;
    const c = counts(o);
    if (!c.att) return; // 没答过的不留
    const byT: Record<string, Counts> = {};
    const rb = (o.byT && typeof o.byT === 'object' ? o.byT : {}) as Record<string, unknown>;
    Object.keys(rb).forEach((k) => {
      if (!T[k]) return; // 失效时态键丢掉
      const cc = counts(rb[k]);
      if (cc.att) byT[k] = cc;
    });
    verbs[inf] = { ...c, byT, last: num(o.last) };
  });

  const byKey = (v: unknown, keys: readonly string[] | null): Record<string, Counts> => {
    const out: Record<string, Counts> = {};
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    Object.keys(o).forEach((k) => {
      if (keys && keys.indexOf(k) < 0) return;
      const c = counts(o[k]);
      if (c.att) out[k] = c;
    });
    return out;
  };

  const wrongSrc = Array.isArray(raw.wrong) ? raw.wrong : [];
  const wrong: WrongItem[] = [];
  wrongSrc.slice(0, WRONG_MAX).forEach((w) => {
    const o = (w && typeof w === 'object' ? w : {}) as Record<string, unknown>;
    const inf = typeof o.inf === 'string' ? o.inf : '';
    const tense = o.tense as TenseKey;
    const mode = o.mode as ModeKey;
    const p = o.p;
    if (!inf || !T[tense] || MODE_KEYS.indexOf(mode) < 0) return;
    if (typeof p !== 'number' || p < 0 || p > 5) return;
    wrong.push({
      inf,
      tense,
      p: p as PersonIdx,
      mode,
      user: typeof o.user === 'string' ? o.user : '',
      ans: typeof o.ans === 'string' ? o.ans : '',
      t: num(o.t),
    });
  });

  return {
    verbs,
    tenses: byKey(raw.tenses, ALL_TENSE_KEYS),
    modes: byKey(raw.modes, MODE_KEYS),
    total: counts(raw.total),
    wrong,
  };
}

/** 是否一条记录都没有（统计页显示空态用） */
export function isStatsEmpty(st: StatsData): boolean {
  return st.total.att === 0 && st.wrong.length === 0;
}

/* ------------------------------------------------------------------ *
 * 派生视图（排序规则集中在这里，页面只管画）
 * ------------------------------------------------------------------ */

export interface VerbRow extends Counts {
  inf: string;
  /** 错误率 0~1 */
  rate: number;
}

/**
 * 「最容易错的动词」：先按错误率降序，错误率相同再按错误次数降序。
 * 只列错过至少一次的动词 —— 全对的动词挤进榜单没有意义。
 */
export function hardestVerbs(st: StatsData, limit = HARDEST_SHOW): VerbRow[] {
  return Object.keys(st.verbs)
    .map((inf) => {
      const d = st.verbs[inf];
      return { inf, att: d.att, err: d.err, rate: errRate(d) };
    })
    .filter((r) => r.err > 0)
    .sort((a, b) => b.rate - a.rate || b.err - a.err)
    .slice(0, limit);
}

export interface TenseRow extends Counts {
  k: TenseKey;
  rate: number;
}

/** 各时态错误率：按 TENSES 的固定顺序列出有记录的时态 */
export function tenseRows(st: StatsData): TenseRow[] {
  const out: TenseRow[] = [];
  ALL_TENSE_KEYS.forEach((k) => {
    const d = st.tenses[k];
    if (!d || !(d.att > 0)) return;
    out.push({ k, att: d.att, err: d.err, rate: errRate(d) });
  });
  return out;
}

export interface ModeRow extends Counts {
  k: ModeKey;
  /** 正确个数 */
  ok: number;
  /** 正确率（百分数） */
  acc: number;
}

/** 各模式正确率：按 MODES 的固定顺序列出有记录的模式 */
export function modeRows(st: StatsData): ModeRow[] {
  const out: ModeRow[] = [];
  MODE_KEYS.forEach((k) => {
    const d = st.modes[k];
    if (!d || !(d.att > 0)) return;
    out.push({ k, att: d.att, err: d.err, ok: d.att - d.err, acc: accuracy(d) });
  });
  return out;
}

/** 错题本要展示的那一段（最新的在前，最多 `WRONG_SHOW` 条） */
export const recentWrong = (st: StatsData, limit = WRONG_SHOW): WrongItem[] =>
  st.wrong.slice(0, limit);

/** 统计页顶部那四个大数字 */
export function statsSummary(st: StatsData): {
  answers: number;
  acc: number;
  err: number;
  verbs: number;
} {
  return {
    answers: st.total.att,
    acc: accuracy(st.total),
    err: st.total.err,
    verbs: Object.keys(st.verbs).length,
  };
}

/** 某个动词答过/错过多少次（变位表页在动词旁标「错 2/5」用） */
export const verbStatOf = (st: StatsData, inf: string): VerbStat | undefined => st.verbs[inf];
