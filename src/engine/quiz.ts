import type {
  ModeKey,
  PersonIdx,
  Question,
  Rand,
  Settings,
  SettingsSnapshot,
  Tense,
  TenseKey,
  Verb,
} from '@/data/types';
import { T, TENSES, TENSE_GROUPS } from '@/data/tenses';
import {
  askedPersons,
  buildPool,
  forms,
  formHits,
  tensePoolOf,
  validPersons,
} from './pool';
import { norm } from '@/utils/unicode';

/**
 * 出题 —— 对应旧版 app_template.html 的
 * weightOf / pickVerb / recognizeTenseChips / recAskTense / buildOptions /
 * qSnap / makeQuestion。
 *
 * 与旧版最大的差别：**不读任何模块级全局状态**。
 * verbs / settings / stats / recent 全部由调用方传入，
 * 随机源也可注入 —— 这样引擎才能在 Node 里被确定性地单测。
 */

export type VerbStat = { att: number; err: number };
export type VerbStatsMap = Record<string, VerbStat>;

const rnd = (n: number, rand: Rand): number => Math.floor(rand() * n);

function pick<T>(a: readonly T[], rand: Rand): T {
  return a[rnd(a.length, rand)];
}

const uniq = <T>(a: T[]): T[] => [...new Set(a)];

/**
 * 出题权重：答错率越高越容易被抽到。
 * 这是为将来「按错误率动态调整出题频率」预留的钩子，现在没数据时恒为 1。
 */
export function weightOf(v: Verb, stats?: VerbStatsMap): number {
  const st = stats?.[v.i];
  if (!st || !st.att) return 1;
  const rate = st.err / st.att;
  return 1 + 3 * rate + Math.min(st.err, 6) * 0.25;
}

function pickVerb(pool: Verb[], stats: VerbStatsMap | undefined, rand: Rand): Verb {
  let total = 0;
  const w = pool.map((v) => {
    const x = weightOf(v, stats);
    total += x;
    return x;
  });
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * 出题时把「只有出题时才知道、渲染时不再改」的东西一次记牢。
 * 渲染时**只读 q.s 与 q.mode，绝不读全局设置** —— 这样无论中途怎么改设置，
 * 题干、选项、判分口径永远自洽。
 */
export const qSnap = (s: Settings): SettingsSnapshot => ({
  inputMode: s.inputMode,
  showZh: !!s.showZh,
  hideInf: !!s.hideInf,
  strictAccent: !!s.strictAccent,
  vosotros: !!s.vosotros,
});

export interface TenseChips {
  /** 与本题同类（简单 / 复合）且该动词确有形式的时态，按 TENSES 顺序 */
  avail: Tense[];
  /** 同一批时态，但按语式分组的顺序重排 —— 辨认模式的时态选项框用这个 */
  out: TenseKey[];
}

/** 辨认模式的时态选项框：只列与本题同类（简单 / 复合）的时态 */
export function recognizeTenseChips(v: Verb, onlyCp: 0 | 1): TenseChips {
  const avail = TENSES.filter((x) => forms(v, x.k) && (x.cp ? 1 : 0) === onlyCp);
  const out: TenseKey[] = [];
  TENSE_GROUPS.forEach((gp) => {
    avail.filter((x) => x.g === gp.k).forEach((x) => out.push(x.k));
  });
  return { avail, out };
}

/**
 * 辨认模式要不要出「选时态」：当选中的时态里、与本题同类（简单 / 复合）
 * 且动词确有形式的**不止一个**时才问；否则只有一种可能，问了也没意义
 * → 直接按本题时态算对。
 * （「辨认模式同时问时态」不是可关开关，默认就问，仅单时态情形自动跳过。）
 */
export function recAskTense(
  q: Question,
  v: Verb | undefined,
  selectedTenses: TenseKey[]
): boolean {
  if (q.mode !== 'recognize') return false;
  if (!v) return false;
  const sel = selectedTenses || [];
  const tt = T[q.tense];
  const onlyCp = tt && tt.cp ? 1 : 0;
  const opts = TENSES.filter(
    (x) =>
      (x.cp ? 1 : 0) === onlyCp &&
      sel.indexOf(x.k) > -1 &&
      tensePoolOf(v, sel).indexOf(x.k) > -1
  );
  return opts.length > 1;
}

/**
 * 选择题的选项：4~6 个，正确答案一定在里面，
 * 且不出现「同样算对」的第二个正确答案。干扰项分两级：
 *   ① 同一人称的其他时态（hablo / hablé / hablaba / hablaré）—— 真实混淆源，优先
 *   ② 同一时态的其他必问人称（hablo / hablas / habla…）—— 兜底
 *   ③ 原时态的其他必问人称（人称实在不够时兜底，如否定命令式的单数人称）
 * 转换模式额外把「原时态那一格」放进来（那一栏也要用户判断）。
 * 放进 6 个而不是 4 个：六个格子在 auto-fit 网格里排成 4+2，视觉上比 3+1 稳。
 */
export function buildOptions(
  q: Question,
  v: Verb,
  tenses: TenseKey[],
  rand: Rand = Math.random
): string[] {
  const tKey = (q.mode === 'shift' ? q.tense2 : q.tense) as TenseKey;
  const taken = new Set<string>(); // norm 后的去重表：正确答案 + 备选答案
  const out: string[] = [];
  const add = (x: string | null | undefined, lock = false): boolean => {
    const s = String(x == null ? '' : x).trim();
    if (!s) return false;
    if (lock) {
      taken.add(norm(s));
      return true;
    }
    if (taken.has(norm(s))) return false;
    taken.add(norm(s));
    out.push(s);
    return true;
  };

  // 先把正确答案（以及同义写法的备选答案）锁进 taken —— 它们本身**不进 out**，
  // 只是占住名字，后面的干扰项就不会撞上正确答案。最后统一收尾进 out 并洗牌。
  add(q.answer, true);
  if (q.answersAlt) q.answersAlt.forEach((x) => add(x, true));
  if (q.mode === 'shift' && norm(q.answer2) !== norm(q.answer)) add(q.answer2, true);

  // 这两个格子本题已经问过 / 已经给了，不能当干扰项
  const skip = new Set([norm(q.answer), norm(q.answer2 || '')]);
  const asked = validPersons(tKey).filter((i) => q.s.vosotros || i !== 4);

  const cands: { x: string; near: number }[] = [];

  // ① 同一人称的其他时态
  tensePoolOf(v, tenses).forEach((k) => {
    if (k === q.tense || k === q.tense2) return;
    const f = forms(v, k);
    const x = f && f[q.person] ? String(f[q.person]).trim() : '';
    if (x && !skip.has(norm(x))) cands.push({ x, near: 1 });
  });

  // ② 同一时态的其他必问人称
  const f = forms(v, tKey);
  if (f) {
    asked.forEach((i) => {
      if (i === q.person) return;
      const x = f[i] ? String(f[i]).trim() : '';
      if (x && !skip.has(norm(x))) cands.push({ x, near: 0 });
    });
  }

  // ③ 原时态的其他必问人称（人称实在不够时兜底）
  const f0 = forms(v, q.tense);
  if (f0 && q.tense !== tKey) {
    asked.forEach((i) => {
      if (i === q.person) return;
      const x = f0[i] ? String(f0[i]).trim() : '';
      if (x && !skip.has(norm(x))) cands.push({ x, near: 0 });
    });
  }

  // Fisher-Yates：先打散，再做「近似优先」的稳定排序 ——
  // 否则 cands 的构造顺序固定，出题会老是同几个选项
  for (let i = cands.length - 1; i > 0; i--) {
    const j = rnd(i + 1, rand);
    const t = cands[i];
    cands[i] = cands[j];
    cands[j] = t;
  }
  cands.sort((a, b) => b.near - a.near);

  // 封顶 5 个干扰项：正确答案此刻还不在 out 里（只锁进了 taken），
  // 兜底 unshift 会把它补到最前 —— 总数恰好 ≤ 6。封顶 6 会产出 7 个选项。
  for (let i = 0; i < cands.length && out.length < 5; i++) add(cands[i].x);

  // 兜底不变量：**本题的正确答案永远在选项里**。
  //
  // ⚠️ 修正自旧版 app_template.html：旧版这里固定用 q.answer 兜底，
  // 但转换模式（shift）下 q.answer 是**原时态**那一格（题面已给出），
  // 正确答案是 q.answer2 —— 于是转换模式的选择题里根本没有正确选项，
  // 用户怎么点都判错。这里改用本题真正要判的那个答案。
  // 非 shift 模式下 rightAns === q.answer，行为与旧版逐字一致。
  const rightAns = (q.mode === 'shift' ? q.answer2 : q.answer) as string;
  const want = norm(rightAns);
  if (!out.some((x) => norm(x) === want)) out.unshift(rightAns);

  // ★ 最后把**整份选项**打散（用户 2026-10-06 报「正确答案每次都在第一项」）。
  // 上面那次 Fisher-Yates 只洗了「干扰项的挑选顺序」，正确答案是通过
  // `out.unshift(rightAns)` 压到第 0 位的 —— 于是每道选择题的第一个按钮
  // 永远是正确答案，等于白送分。这里对最终数组再洗一次。
  // 安全性：判分一律按文本比对（norm / formHits / judge），**没有任何地方
  // 依赖选项下标**，所以洗牌不会影响对错。用注入的 rand，测试可复现。
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1, rand);
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

export interface MakeQuestionInput {
  verbs: Verb[];
  settings: Settings;
  /** 词库数据，用来算抽题权重；不给则各动词等概率 */
  stats?: VerbStatsMap;
  /** 最近出过的题目标识（近题去重用），不会就地修改 */
  recent?: readonly string[];
  /** 可注入的随机源，默认 Math.random */
  rand?: Rand;
}

export interface MakeQuestionOutput {
  q: Question;
  /** 更新后的近期题目列表（最多 24 条），调用方自己保存 */
  recent: string[];
}

/**
 * 出一道题。失败（题库为空、连续 400 次都撞上近期题目等）返回 null。
 *
 * 四种模式：
 *   recognize 辨认 —— 看变位形式，判断人称（并可问时态）
 *   produce   复现 —— 给人称与时态，写出变位
 *   shift     转换 —— 同一动词、同一人称，换一个时态
 *   transfer  平移 —— 同一人称时态，照 A 动词写出 B 动词
 */
export function makeQuestion(input: MakeQuestionInput): MakeQuestionOutput | null {
  const { verbs, settings: s } = input;
  const rand = input.rand ?? Math.random;
  const recent = (input.recent ?? []).slice();

  const pool = buildPool(verbs, s);
  if (!pool.length) return null;

  for (let attempt = 0; attempt < 400; attempt++) {
    const v = pickVerb(pool, input.stats, rand);
    const tp = tensePoolOf(v, s.tenses);
    if (!tp.length) continue;

    // 时态转换需要至少 2 个时态；平移模式需要题库里至少 2 个动词。
    // 都不满足时不再固定退回复现模式 —— 换成「本次真正能出题」的那几个模式里挑一个，
    // 否则用户明明选了辨认，却拿到一屏手写输入，会以为设置坏了。
    let modes: ModeKey[] = s.modes.filter(
      (m) => (m !== 'shift' || tp.length >= 2) && (m !== 'transfer' || pool.length >= 2)
    );
    if (!modes.length) modes = ['recognize', 'produce'];

    const mode = pick(modes, rand);
    const tense = pick(tp, rand);
    const f = forms(v, tense);
    if (!f) continue;

    const ps = askedPersons(tense, s.vosotros).filter((i) => f[i] && f[i].trim());
    if (!ps.length) continue;
    const person: PersonIdx = pick(ps, rand);

    const q: Question = {
      inf: v.i,
      idx: verbs.indexOf(v),
      zh: v.z,
      g: v.g,
      lv: v.l,
      mode,
      tense,
      person,
      answer: f[person],
      key: '',
      s: qSnap(s),
      userAnswer: null,
      correct: null,
    };

    if (q.mode === 'recognize') {
      q.hits = formHits(v, q.answer);
      q.askTense = recAskTense(q, v, s.tenses);
    }

    if (q.mode === 'shift') {
      const others = tp.filter((k) => k !== q.tense);
      if (!others.length) continue;
      q.tense2 = pick(others, rand);
      const f2 = forms(v, q.tense2);
      if (!f2 || !f2[q.person] || !f2[q.person].trim()) continue;
      q.answer2 = f2[q.person];
      // 换了时态却什么都没变（如 nosotros 的 compramos 在现在时/简单过去时一致）
      // 这种题没有练习价值，前 320 次尝试先避开；实在出不来再允许
      if (norm(q.answer2) === norm(q.answer) && attempt < 320) continue;
    }

    if (q.mode === 'transfer') {
      // A 动词：已知人称时态与变位形式；B 动词：只给原形，要求写出同一人称时态的变位
      const others = pool.filter((x) => x !== v);
      if (!others.length) continue;
      const w = pick(others, rand);
      const f2 = forms(w, q.tense);
      if (!f2 || !f2[q.person] || !f2[q.person].trim()) continue;
      // B 动词必须真的有这个时态的形式，否则「平移」会变成无解题
      if (!tensePoolOf(w, s.tenses).includes(q.tense)) continue;
      const a2 = f2[q.person];
      // A、B 在这个人称时态上同形（罕见到几乎不会发生）就没有练习价值
      if (norm(a2) === norm(q.answer) && attempt < 320) continue;

      q.srcInf = v.i;
      q.srcZh = v.z;
      q.srcForm = q.answer;
      q.idx = verbs.indexOf(w); // 本题要变位的动词是 B
      q.inf = w.i;
      q.zh = w.z;
      q.g = w.g;
      q.lv = w.l;
      q.answer = a2;
      // A 出示的这个形式，在「同一个人称」下往往还有别的时态读法
      // （dormir 的 nosotros: dormimos 既是现在时也是简单过去时；
      //  entregar 的 él: entregue 既是虚拟式现在时也是肯定命令式 usted）。
      // 此时题目给出的时态其实是欠定的 —— 只要 B 在那些读法下的形式也一并接受，
      // 用户就不会因为「按另一种同样成立的读法作答」而被判错。
      q.srcAlts = uniq(
        formHits(v, q.srcForm)
          .filter((h) => h.p === q.person && h.k !== q.tense)
          .map((h) => h.k)
      );
      const extra: string[] = [];
      q.srcAlts.forEach((k) => {
        const fk = forms(w, k);
        if (fk && fk[q.person] && fk[q.person].trim() && norm(fk[q.person]) !== norm(a2)) {
          extra.push(fk[q.person]);
        }
      });
      q.answersAlt = uniq(extra);
    }

    const key =
      q.inf + '|' + q.mode + '|' + q.tense + '|' + (q.tense2 || '') + '|' + q.person +
      (q.srcInf ? '|' + q.srcInf : '');

    if (recent.includes(key)) continue;
    recent.push(key);
    if (recent.length > 24) recent.shift();
    q.key = key;

    if (q.mode === 'recognize') {
      q.pickPerson = null;
      q.pickTense = q.askTense ? null : q.tense;
      q.userInf = '';
    }
    if (s.inputMode === 'choice' && q.mode !== 'recognize') {
      q.options = buildOptions(q, verbs[q.idx], s.tenses, rand);
    }
    return { q, recent };
  }
  return null;
}
