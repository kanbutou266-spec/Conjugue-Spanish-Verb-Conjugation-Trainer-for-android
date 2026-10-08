import verbsJson from '@/data/verbs.json';
import type { ModeKey, PersonIdx, Question, Rand, Settings, TenseKey, Verb } from '@/data/types';
import { ALL_TENSE_KEYS } from '@/data/tenses';
import { forms } from '@/engine/pool';
import { norm } from '@/utils/unicode';
import {
  buildOptions,
  makeQuestion,
  qSnap,
  recognizeTenseChips,
  recAskTense,
  weightOf,
} from '@/engine/quiz';

/**
 * quiz.ts —— 出题。对照旧版网页的冒烟回归（79 项）。
 * 随机源全部注入，所以每个断言都是可重复的。
 */

const VERBS = (verbsJson as unknown as { v: Verb[] }).v;
const byInf = (w: string): Verb => VERBS.find((x) => x.i === w)!;

/** 确定性随机源（LCG）——同一 seed 每次跑出同一套题 */
function seeded(seed: number): Rand {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const base: Settings = {
  levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  modes: ['produce'],
  tenses: ALL_TENSE_KEYS.slice(),
  tagFilter: '',
  inputMode: 'type',
  hideInf: false,
  vosotros: true,
  showZh: true,
  strictAccent: true,
  lang: 'zh',
  langMode: 'system',
  themeMode: 'system',
};
const cfg = (o: Partial<Settings> = {}): Settings => ({ ...base, ...o });

/** 造一道题（默认设置可覆盖），失败时直接抛错而不是返回 null 让后续断言崩得莫名其妙 */
function ask(o: Partial<Settings> = {}, seed = 1, recent?: readonly string[]) {
  const out = makeQuestion({ verbs: VERBS, settings: cfg(o), rand: seeded(seed), recent });
  if (!out) throw new Error('makeQuestion 返回了 null');
  return out.q;
}

describe('qSnap —— 本题设置快照', () => {
  it('只带出题与判分相关的五个开关', () => {
    expect(qSnap(cfg({ inputMode: 'choice', showZh: false, hideInf: true }))).toEqual({
      inputMode: 'choice',
      showZh: false,
      hideInf: true,
      strictAccent: true,
      vosotros: true,
    });
  });

  it('不含 levels / tenses / modes 这些出题范围项', () => {
    const snap = qSnap(cfg()) as Record<string, unknown>;
    expect(snap.levels).toBeUndefined();
    expect(snap.tenses).toBeUndefined();
    expect(snap.modes).toBeUndefined();
    expect(snap.tagFilter).toBeUndefined();
  });
});

describe('weightOf —— 抽题权重', () => {
  const v = byInf('hablar');

  it('没有统计数据时恒为 1', () => {
    expect(weightOf(v)).toBe(1);
    expect(weightOf(v, {})).toBe(1);
    expect(weightOf(v, { hablar: { att: 0, err: 0 } })).toBe(1);
  });

  it('答错率越高权重越大', () => {
    // 1 + 3*(5/10) + min(5,6)*0.25 = 3.75
    expect(weightOf(v, { hablar: { att: 10, err: 5 } })).toBeCloseTo(3.75, 6);
    // 1 + 3*(1/10) + min(1,6)*0.25 = 1.55
    expect(weightOf(v, { hablar: { att: 10, err: 1 } })).toBeCloseTo(1.55, 6);
  });

  it('错题数的加成封顶在 6 次', () => {
    // 1 + 3*(10/20) + min(10,6)*0.25 = 4.0
    expect(weightOf(v, { hablar: { att: 20, err: 10 } })).toBeCloseTo(4.0, 6);
    // 1 + 3*(30/60) + min(30,6)*0.25 = 4.0
    expect(weightOf(v, { hablar: { att: 60, err: 30 } })).toBeCloseTo(4.0, 6);
  });
});

describe('recognizeTenseChips —— 辨认模式的时态选项框', () => {
  it('只列与本题同类的时态：简单 9 个', () => {
    const r = recognizeTenseChips(byInf('hablar'), 0);
    expect(r.avail.map((t) => t.k)).toEqual(['p', 'pr', 'i', 'f', 'c', 'sp', 'si', 'ia', 'in']);
  });

  it('复合 6 个', () => {
    const r = recognizeTenseChips(byInf('hablar'), 1);
    expect(r.out).toEqual(['pp', 'pq', 'fp', 'cp', 'spt', 'sq']);
  });

  it('out 按语式分组顺序排列（陈述 → 条件 → 虚拟 → 命令）', () => {
    const r = recognizeTenseChips(byInf('hablar'), 0);
    const groupOrder = { ind: 0, cond: 1, sub: 2, imp: 3 };
    const gs = r.out.map((k) => groupOrder[r.avail.find((t) => t.k === k)!.g]);
    expect(gs).toEqual([...gs].sort((a, b) => a - b));
  });

  it('选项框内容只看动词有没有形式，与用户选中了哪些时态无关', () => {
    const a = recognizeTenseChips(byInf('hablar'), 0).out;
    const b = recognizeTenseChips(byInf('hablar'), 0).out;
    expect(a).toEqual(b);
  });
});

describe('recAskTense —— 要不要额外问「这是哪个时态」', () => {
  const q = (mode: ModeKey, tense: TenseKey): Question =>
    ({ mode, tense }) as Question;
  const hablar = byInf('hablar');

  it('只选中一个同类时态时不问（只有一种可能，问了没意义）', () => {
    expect(recAskTense(q('recognize', 'p'), hablar, ['p'])).toBe(false);
  });

  it('选中两个同类时态时问', () => {
    expect(recAskTense(q('recognize', 'p'), hablar, ['p', 'pr'])).toBe(true);
  });

  it('同类才计数：现在时 + 现在完成时不问（一简单一复合）', () => {
    expect(recAskTense(q('recognize', 'p'), hablar, ['p', 'pp'])).toBe(false);
  });

  it('本题是复合时态时，按复合那一类计数', () => {
    expect(recAskTense(q('recognize', 'pp'), hablar, ['p', 'pp'])).toBe(false);
    expect(recAskTense(q('recognize', 'pp'), hablar, ['pp', 'pq'])).toBe(true);
  });

  it('非辨认模式一律不问', () => {
    (['produce', 'shift', 'transfer'] as ModeKey[]).forEach((m) => {
      expect(recAskTense(q(m, 'p'), hablar, ['p', 'pr'])).toBe(false);
    });
  });

  it('动词不存在时不问', () => {
    expect(recAskTense(q('recognize', 'p'), undefined, ['p', 'pr'])).toBe(false);
  });

  it('选中时态为空时不问', () => {
    expect(recAskTense(q('recognize', 'p'), hablar, [])).toBe(false);
  });
});

describe('buildOptions —— 选择题选项', () => {
  const hablar = byInf('hablar');
  const mkQ = (o: Partial<Question>): Question =>
    ({
      inf: 'hablar',
      idx: VERBS.indexOf(hablar),
      zh: hablar.z,
      g: hablar.g,
      lv: hablar.l,
      mode: 'produce',
      tense: 'p',
      person: 0,
      answer: 'hablo',
      key: 'k',
      s: qSnap(cfg()),
      userAnswer: null,
      correct: null,
      ...o,
    }) as Question;

  it('正确答案一定在选项里', () => {
    const opts = buildOptions(mkQ({}), hablar, ['p', 'pr', 'i', 'f']);
    expect(opts.map(norm)).toContain('hablo');
  });

  it('干扰项优先取「同一人称的其他时态」', () => {
    const opts = buildOptions(mkQ({}), hablar, ['p', 'pr', 'i', 'f']);
    // hablé（简单过去）/ hablaba（未完成）/ hablaré（将来）都在
    expect(opts).toContain('hablé');
    expect(opts).toContain('hablaba');
    expect(opts).toContain('hablaré');
  });

  it('总数不超过 6 个，且 norm 后无重复', () => {
    const opts = buildOptions(mkQ({}), hablar, ALL_TENSE_KEYS);
    expect(opts.length).toBeGreaterThanOrEqual(2);
    expect(opts.length).toBeLessThanOrEqual(6);
    expect(new Set(opts.map(norm)).size).toBe(opts.length);
  });

  it('备选答案被锁住，不会作为干扰项出现两次', () => {
    const opts = buildOptions(
      mkQ({ answersAlt: ['hablo2'], answer: 'hablo' }),
      hablar,
      ['p', 'pr', 'i', 'f']
    );
    expect(opts.filter((x) => norm(x) === 'hablo')).toHaveLength(1);
  });

  it('关掉 vosotros 后，第 6 人称的形式不再当干扰项', () => {
    const q = mkQ({ s: qSnap(cfg({ vosotros: false })) });
    const opts = buildOptions(q, hablar, ['p', 'pr', 'i', 'f']);
    expect(opts).not.toContain('habláis');
  });

  it('开着 vosotros 时第 6 人称的形式会作为干扰项（只选一个时态，候选刚好填满）', () => {
    // 只选现在时：① 分支为空，② 分支正好 5 个其他人称，全部入选
    const opts = buildOptions(mkQ({}), hablar, ['p']);
    expect(opts).toContain('habláis');
  });

  it('转换模式：选项里必须有目标时态的答案（旧版在这里是错的）', () => {
    // q.answer 是原时态那一格，q.answer2 才是要判的正确答案
    const q = mkQ({ mode: 'shift', tense: 'p', answer: 'hablo', tense2: 'pr', answer2: 'hablé' });
    const opts = buildOptions(q, hablar, ALL_TENSE_KEYS);
    expect(opts.map(norm)).toContain('hablé');
  });

  it('转换模式：原时态那一格不会混进来当干扰项（题面已经给了）', () => {
    const q = mkQ({ mode: 'shift', tense: 'p', answer: 'hablo', tense2: 'pr', answer2: 'hablé' });
    const opts = buildOptions(q, hablar, ALL_TENSE_KEYS);
    expect(opts.map(norm)).not.toContain('hablo');
  });

  it('转换模式：原时态与目标时态同形时也不会出现重复选项', () => {
    const q = mkQ({ mode: 'shift', tense: 'pr', answer: 'hablé', tense2: 'pr', answer2: 'hablé' });
    const opts = buildOptions(q, hablar, ALL_TENSE_KEYS);
    expect(new Set(opts.map(norm)).size).toBe(opts.length);
    expect(opts.map(norm)).toContain('hablé');
  });

  it('规则动词只有一种简单时态可选时，选项靠其他人称撑起来', () => {
    const opts = buildOptions(mkQ({}), hablar, ['p']);
    expect(opts.map(norm)).toContain('hablo');
    expect(opts.length).toBeGreaterThan(1);
  });
});

describe('makeQuestion —— 出题', () => {
  it('题库为空时返回 null', () => {
    expect(makeQuestion({ verbs: [], settings: cfg() })).toBeNull();
    expect(makeQuestion({ verbs: VERBS, settings: cfg({ levels: [] }) })).toBeNull();
    expect(makeQuestion({ verbs: VERBS, settings: cfg({ tenses: [] }) })).toBeNull();
  });

  (['recognize', 'produce', 'shift', 'transfer'] as ModeKey[]).forEach((mode) => {
    it(`${mode} 模式能出题，且题目字段自洽`, () => {
      for (let s = 1; s <= 10; s++) {
        const q = ask({ modes: [mode], tenses: ['p', 'pr', 'i'], levels: ['A1', 'A2'] }, s * 17 + 3);
        expect(q.mode).toBe(mode);
        expect(q.answer).toBeTruthy();
        expect(q.person).toBeGreaterThanOrEqual(0);
        expect(q.person).toBeLessThanOrEqual(5);
        expect(q.zh).toBeTruthy();
        // 答案必须真的是这个动词这个时态这个人称的形式
        expect(forms(VERBS[q.idx], q.tense)![q.person]).toBe(q.answer);
        // idx 指向的就是题面上的动词
        expect(VERBS[q.idx].i).toBe(q.inf);
      }
    });
  });

  it('出题时就把设置快照固定下来', () => {
    const q = ask({ modes: ['produce'], inputMode: 'choice' });
    expect(q.s.inputMode).toBe('choice');
    expect(q.s).toEqual(qSnap(cfg({ modes: ['produce'], inputMode: 'choice' })));
  });

  it('辨认模式：填好 hits / pickPerson / userInf / pickTense', () => {
    for (let s = 1; s <= 15; s++) {
      const q = ask({ modes: ['recognize'], tenses: ['p', 'pr'], levels: ['A1'] }, s * 7 + 1);
      expect(q.hits!.length).toBeGreaterThan(0);
      expect(q.hits!.some((h) => h.k === q.tense && h.p === q.person)).toBe(true);
      expect(q.pickPerson).toBeNull();
      expect(q.userInf).toBe('');
      if (q.askTense) expect(q.pickTense).toBeNull();
      else expect(q.pickTense).toBe(q.tense);
    }
  });

  it('辨认模式不出选择题选项（它本身就要选人称）', () => {
    const q = ask({ modes: ['recognize'], inputMode: 'choice' });
    expect(q.options).toBeUndefined();
  });

  it('转换模式：目标时态与原时态不同，答案为目标时态的形式', () => {
    for (let s = 1; s <= 10; s++) {
      const q = ask({ modes: ['shift'], tenses: ['p', 'pr', 'i'], levels: ['A1'] }, s * 23 + 5);
      expect(q.tense2).toBeTruthy();
      expect(q.tense2).not.toBe(q.tense);
      expect(q.answer2).toBeTruthy();
      expect(forms(VERBS[q.idx], q.tense2! )![q.person]).toBe(q.answer2);
      // 换了时态却什么都没变的题在前 320 次尝试里要避开
      expect(norm(q.answer2!)).not.toBe(norm(q.answer));
    }
  });

  it('平移模式：题面换成了另一个动词，并记下原动词与原形式', () => {
    for (let s = 1; s <= 10; s++) {
      const q = ask({ modes: ['transfer'], tenses: ['p', 'pr'], levels: ['A1'] }, s * 31 + 9);
      expect(q.srcInf).toBeTruthy();
      expect(q.inf).not.toBe(q.srcInf);
      expect(q.srcForm).toBeTruthy();
      expect(q.srcZh).toBeTruthy();
      expect(VERBS[q.idx].i).toBe(q.inf);
      // 原形式确实来自原动词的同一个人称
      const src = byInf(q.srcInf!);
      expect(forms(src, q.tense)![q.person]).toBe(q.srcForm);
      // A、B 同形就没有练习价值
      expect(norm(q.answer)).not.toBe(norm(q.srcForm!));
    }
  });

  it('平移模式：备选答案里不会混进主答案', () => {
    for (let s = 1; s <= 10; s++) {
      const q = ask({ modes: ['transfer'], tenses: ['p', 'pr'], levels: ['A1'] }, s * 41 + 11);
      if (q.answersAlt) {
        expect(q.answersAlt.map(norm)).not.toContain(norm(q.answer));
      }
    }
  });

  it('选择题模式下选项一定包含本题的正确答案（三种模式 × 60 次随机）', () => {
    const bad: string[] = [];
    (['produce', 'shift', 'transfer'] as ModeKey[]).forEach((mode) => {
      for (let s = 1; s <= 60; s++) {
        const q = ask(
          { modes: [mode], tenses: ['p', 'pr', 'i'], inputMode: 'choice', levels: ['A1', 'A2'] },
          s * 13 + 1
        );
        const opts = q.options ?? [];
        if (!opts.length) {
          bad.push(`${mode}#${s}: 没有选项`);
          continue;
        }
        if (new Set(opts.map(norm)).size !== opts.length) bad.push(`${mode}#${s}: 选项重复`);
        if (opts.length > 6) bad.push(`${mode}#${s}: 选项超过 6 个`);
        const right = mode === 'shift' ? q.answer2! : q.answer;
        if (!opts.map(norm).includes(norm(right))) {
          bad.push(`${mode}#${s}: 选项里没有正确答案 "${right}" -> ${JSON.stringify(opts)}`);
        }
      }
    });
    expect(bad).toEqual([]);
  });

  it('选择题的正确答案不能总在第一个位置（用户 2026-10-06 报的问题）', () => {
    // 以前 buildOptions 末尾 `out.unshift(rightAns)` 之后没有再打散，
    // 于是每道选择题的第一个按钮永远是正确答案，等于白送分。
    // 判分靠文本比对、不靠下标，所以「对最终数组洗牌」是唯一正确做法。
    // 这里统计正确答案落在各位置上的次数：60 题 × 几个位置，
    // 全落在同一位置的概率极低，一旦回归会立刻抓到。
    const posCount: Record<number, number> = {};
    let n = 0;
    (['produce', 'shift', 'transfer'] as ModeKey[]).forEach((mode) => {
      for (let s = 1; s <= 60; s++) {
        const q = ask(
          { modes: [mode], tenses: ['p', 'pr', 'i'], inputMode: 'choice', levels: ['A1', 'A2'] },
          s * 13 + 1
        );
        const opts = q.options ?? [];
        if (!opts.length) continue;
        const right = mode === 'shift' ? q.answer2! : q.answer;
        const k = opts.map(norm).indexOf(norm(right));
        if (k < 0) continue; // 「一定在选项里」上面已单独断言
        posCount[k] = (posCount[k] ?? 0) + 1;
        n++;
      }
    });
    expect(n).toBeGreaterThanOrEqual(100);
    // 至少落在 3 个不同位置上（若全在第一个位置 → 只有 1 个键）
    expect(Object.keys(posCount).length).toBeGreaterThanOrEqual(3);
    // 且非首位确实出现过
    const nonFirst = Object.entries(posCount)
      .filter(([k]) => k !== '0')
      .reduce((a, [, v]) => a + v, 0);
    expect(nonFirst).toBeGreaterThan(0);
  });

  it('手写模式下不出选项', () => {
    const q = ask({ modes: ['produce'], inputMode: 'type' });
    expect(q.options).toBeUndefined();
  });

  it('近题去重：recent 会被更新、上限 24 条', () => {
    let recent: string[] = [];
    const keys: string[] = [];
    for (let i = 0; i < 20; i++) {
      const out = makeQuestion({
        verbs: VERBS,
        settings: cfg({ modes: ['produce'], tenses: ['p', 'pr', 'i'] }),
        rand: seeded(i * 97 + 13),
        recent,
      })!;
      recent = out.recent;
      keys.push(out.q.key);
      expect(recent.length).toBeLessThanOrEqual(24);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('传入的 recent 不会被就地修改', () => {
    const orig = ['占位'];
    const snapshot = orig.slice();
    makeQuestion({ verbs: VERBS, settings: cfg(), rand: seeded(3), recent: orig });
    expect(orig).toEqual(snapshot);
  });

  it('抽题会避开 recent 里的题（同 seed 下换一题）', () => {
    const first = makeQuestion({
      verbs: VERBS,
      settings: cfg({ modes: ['produce'], tenses: ['p'] }),
      rand: seeded(999),
    })!;
    const again = makeQuestion({
      verbs: VERBS,
      settings: cfg({ modes: ['produce'], tenses: ['p'] }),
      rand: seeded(999),
      recent: [first.q.key],
    })!;
    expect(again.q.key).not.toBe(first.q.key);
  });

  it('题目 key 由动词 / 模式 / 时态 / 人称构成', () => {
    const q = ask({ modes: ['produce'], tenses: ['p'] }, 5);
    const parts = q.key.split('|');
    expect(parts[0]).toBe(q.inf);
    expect(parts[1]).toBe(q.mode);
    expect(parts[2]).toBe(q.tense);
    expect(parts[3]).toBe(q.tense2 || '');
    expect(parts[4]).toBe(String(q.person));
  });

  it('词表里所有动词都能被出到题（不因数据缺失卡死）', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 120; s++) {
      const out = makeQuestion({
        verbs: VERBS,
        settings: cfg({ modes: ['produce'], tenses: ['p'] }),
        rand: seeded(s * 131 + 7),
      });
      if (out) seen.add(out.q.inf);
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('只选辨认模式且只选一个时态时，不出时态题', () => {
    for (let s = 1; s <= 10; s++) {
      const q = ask({ modes: ['recognize'], tenses: ['p'], levels: ['A1'] }, s * 3 + 1);
      expect(q.askTense).toBe(false);
      expect(q.pickTense).toBe('p');
    }
  });
});
