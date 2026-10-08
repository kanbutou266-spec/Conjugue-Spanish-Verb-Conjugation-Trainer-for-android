import {
  HARDEST_SHOW,
  WRONG_MAX,
  WRONG_SHOW,
  accuracy,
  bump,
  emptyStats,
  errRate,
  hardestVerbs,
  isStatsEmpty,
  modeRows,
  recentWrong,
  recordAnswer,
  sanitizeStats,
  statsSummary,
  tenseRows,
  verbStatOf,
} from '@/data/stats';

import type { AnswerRecord, StatsData } from '@/data/stats';

const rec = (o: Partial<AnswerRecord> = {}): AnswerRecord => ({
  inf: 'hablar',
  tense: 'p',
  person: 0,
  mode: 'produce',
  ok: true,
  user: 'hablo',
  ans: 'hablo',
  t: 1000,
  ...o,
});

/** 连记若干次（每次都拿上一次的结果继续，验证不可变语义） */
function feed(start: StatsData, list: Partial<AnswerRecord>[]): StatsData {
  return list.reduce((acc, x) => recordAnswer(acc, rec(x)), start);
}

describe('emptyStats / bump / 比率', () => {
  it('空统计的形状与网页 DB.stats 一致', () => {
    expect(emptyStats()).toEqual({
      verbs: {},
      tenses: {},
      modes: {},
      total: { att: 0, err: 0 },
      wrong: [],
    });
    expect(isStatsEmpty(emptyStats())).toBe(true);
  });

  it('bump 对/错分别累加', () => {
    expect(bump(undefined, true)).toEqual({ att: 1, err: 0 });
    expect(bump({ att: 2, err: 1 }, true)).toEqual({ att: 3, err: 1 });
    expect(bump({ att: 2, err: 1 }, false)).toEqual({ att: 3, err: 2 });
  });

  it('正确率 / 错误率：没答过都是 0（不是 NaN）', () => {
    expect(accuracy(undefined)).toBe(0);
    expect(errRate(undefined)).toBe(0);
    expect(accuracy({ att: 0, err: 0 })).toBe(0);
    expect(accuracy({ att: 3, err: 1 })).toBe(67);
    expect(errRate({ att: 4, err: 1 })).toBe(0.25);
  });
});

describe('recordAnswer · 不可变与四个维度', () => {
  it('**不就地改**传进来的对象（zustand 靠这个判断更新）', () => {
    const a = emptyStats();
    const b = recordAnswer(a, rec());
    expect(b).not.toBe(a);
    expect(a.total.att).toBe(0);
    expect(a.verbs).toEqual({});
    expect(a.wrong).toEqual([]);
    expect(b.total.att).toBe(1);
  });

  it('一次作答同时落到 verbs / tenses / modes / total 四处', () => {
    const st = recordAnswer(emptyStats(), rec({ ok: false, user: 'hablé' }));
    expect(st.total).toEqual({ att: 1, err: 1 });
    expect(st.tenses.p).toEqual({ att: 1, err: 1 });
    expect(st.modes.produce).toEqual({ att: 1, err: 1 });
    expect(st.verbs.hablar).toEqual({
      att: 1,
      err: 1,
      byT: { p: { att: 1, err: 1 } },
      last: 1000,
    });
  });

  it('同一动词的不同时态分开记（byT）', () => {
    const st = feed(emptyStats(), [
      { tense: 'p', ok: true },
      { tense: 'pr', ok: false },
      { tense: 'p', ok: false },
    ]);
    const v = st.verbs.hablar;
    expect(v.att).toBe(3);
    expect(v.err).toBe(2);
    expect(v.byT).toEqual({ p: { att: 2, err: 1 }, pr: { att: 1, err: 1 } });
  });

  it('答对不写错题本', () => {
    expect(recordAnswer(emptyStats(), rec({ ok: true })).wrong).toEqual([]);
  });

  it('答错写错题本：最新在最前，字段齐全（含 ansOf 口径的正确答案）', () => {
    const st = feed(emptyStats(), [
      { ok: false, user: 'hablé', ans: 'hablo', t: 1 },
      { ok: false, user: 'x', ans: 'hablo', t: 2 },
    ]);
    expect(st.wrong.map((w) => w.t)).toEqual([2, 1]);
    expect(st.wrong[0]).toEqual({
      inf: 'hablar',
      tense: 'p',
      p: 0,
      mode: 'produce',
      user: 'x',
      ans: 'hablo',
      t: 2,
    });
  });

  it('错题本上限 300 条，最老的被裁掉', () => {
    let st = emptyStats();
    for (let i = 0; i < WRONG_MAX + 20; i++) {
      st = recordAnswer(st, rec({ ok: false, t: i, user: `u${i}` }));
    }
    expect(st.wrong).toHaveLength(WRONG_MAX);
    expect(st.wrong[0].t).toBe(WRONG_MAX + 19); // 最后写进去的还在最前
    expect(st.wrong[WRONG_MAX - 1].t).toBe(20); // 前 20 条被裁掉
  });

  it('未作答（user 为 null/undefined）写成空串，不留 undefined', () => {
    const st = recordAnswer(emptyStats(), rec({ ok: false, user: null as unknown as string }));
    expect(st.wrong[0].user).toBe('');
  });

  it('不传时间戳时取当前时间', () => {
    const before = Date.now();
    const st = recordAnswer(emptyStats(), {
      inf: 'ir',
      tense: 'p',
      person: 0,
      mode: 'recognize',
      ok: true,
      user: 'ir',
      ans: 'ir',
    });
    expect(st.verbs.ir.last).toBeGreaterThanOrEqual(before);
  });
});

describe('sanitizeStats', () => {
  it('坏输入一律回空统计', () => {
    expect(sanitizeStats(null)).toEqual(emptyStats());
    expect(sanitizeStats('oops')).toEqual(emptyStats());
    expect(sanitizeStats(42)).toEqual(emptyStats());
  });

  it('丢掉 att=0 的动词（否则"练习过的动词数"会虚高）', () => {
    const st = sanitizeStats({ verbs: { hablar: { att: 0, err: 0 }, ir: { att: 2, err: 1 } } });
    expect(Object.keys(st.verbs)).toEqual(['ir']);
  });

  it('丢掉失效的时态键与不在 MODES 里的模式键', () => {
    const st = sanitizeStats({
      tenses: { p: { att: 1, err: 0 }, nope: { att: 9, err: 9 } },
      modes: { produce: { att: 1, err: 0 }, telepathy: { att: 5, err: 5 } },
    });
    expect(Object.keys(st.tenses)).toEqual(['p']);
    expect(Object.keys(st.modes)).toEqual(['produce']);
  });

  it('错题本逐条校验：缺字段 / 非法人称 / 非法时态的都丢掉', () => {
    const st = sanitizeStats({
      wrong: [
        { inf: 'ir', tense: 'p', p: 0, mode: 'produce', user: 'voy', ans: 'voy', t: 5 },
        { inf: '', tense: 'p', p: 0, mode: 'produce' }, // 没动词
        { inf: 'ir', tense: 'zz', p: 0, mode: 'produce' }, // 没这个时态
        { inf: 'ir', tense: 'p', p: 9, mode: 'produce' }, // 人称越界
        { inf: 'ir', tense: 'p', p: 0, mode: 'zz' }, // 没这个模式
      ],
    });
    expect(st.wrong).toHaveLength(1);
    expect(st.wrong[0].inf).toBe('ir');
  });

  it('数值字段被手改成负数 / 字符串时归零，不炸', () => {
    const st = sanitizeStats({ total: { att: -5, err: 'x' } });
    expect(st.total).toEqual({ att: 0, err: 0 });
  });

  it('清洗一遍之后再清洗，结果不变（幂等）', () => {
    const src = {
      verbs: { hablar: { att: 3, err: 1, byT: { p: { att: 3, err: 1 } }, last: 9 } },
      tenses: { p: { att: 3, err: 1 } },
      modes: { produce: { att: 3, err: 1 } },
      total: { att: 3, err: 1 },
      wrong: [{ inf: 'hablar', tense: 'p', p: 0, mode: 'produce', user: 'x', ans: 'hablo', t: 9 }],
    };
    const once = sanitizeStats(src);
    expect(sanitizeStats(once)).toEqual(once);
  });
});

describe('派生视图', () => {
  /** 造一份有区分度的数据：hablar 全对、ir 全错、tener 一半 */
  function sample(): StatsData {
    let st = emptyStats();
    for (let i = 0; i < 4; i++) st = recordAnswer(st, rec({ inf: 'hablar', ok: true }));
    for (let i = 0; i < 3; i++) st = recordAnswer(st, rec({ inf: 'ir', ok: false, tense: 'pr' }));
    st = recordAnswer(st, rec({ inf: 'tener', ok: true, mode: 'recognize', tense: 'i' }));
    st = recordAnswer(st, rec({ inf: 'tener', ok: false, mode: 'recognize', tense: 'i' }));
    return st;
  }

  it('statsSummary 的四个大数字', () => {
    const s = statsSummary(sample());
    expect(s.answers).toBe(9);
    expect(s.err).toBe(4);
    expect(s.acc).toBe(56); // (1 - 4/9) → 56%
    expect(s.verbs).toBe(3);
  });

  it('hardestVerbs：只列错过的，按错误率降序', () => {
    const rows = hardestVerbs(sample());
    expect(rows.map((r) => r.inf)).toEqual(['ir', 'tener']); // hablar 没错过 → 不入榜
    expect(rows[0]).toEqual({ inf: 'ir', att: 3, err: 3, rate: 1 });
    expect(rows[1].rate).toBe(0.5);
  });

  it('hardestVerbs 有上限（默认 20）', () => {
    let st = emptyStats();
    for (let i = 0; i < HARDEST_SHOW + 10; i++) {
      st = recordAnswer(st, rec({ inf: `v${i}`, ok: false }));
    }
    expect(hardestVerbs(st)).toHaveLength(HARDEST_SHOW);
    expect(hardestVerbs(st, 3)).toHaveLength(3);
  });

  it('tenseRows：按 TENSES 固定顺序，只列有记录的', () => {
    const rows = tenseRows(sample());
    expect(rows.map((r) => r.k)).toEqual(['p', 'pr', 'i']);
    expect(rows[1]).toEqual({ k: 'pr', att: 3, err: 3, rate: 1 });
  });

  it('modeRows：按 MODES 固定顺序，带正确个数与正确率', () => {
    const rows = modeRows(sample());
    expect(rows.map((r) => r.k)).toEqual(['recognize', 'produce']);
    expect(rows[0]).toEqual({ k: 'recognize', att: 2, err: 1, ok: 1, acc: 50 });
    expect(rows[1]).toEqual({ k: 'produce', att: 7, err: 3, ok: 4, acc: 57 });
  });

  it('recentWrong 默认只取前 30 条', () => {
    let st = emptyStats();
    for (let i = 0; i < 50; i++) st = recordAnswer(st, rec({ ok: false, t: i }));
    expect(recentWrong(st)).toHaveLength(WRONG_SHOW);
    expect(recentWrong(st)[0].t).toBe(49);
  });

  it('verbStatOf 能取到单个动词的计数', () => {
    expect(verbStatOf(sample(), 'ir')?.err).toBe(3);
    expect(verbStatOf(sample(), 'nope')).toBeUndefined();
  });

  it('空统计时各派生函数都返回空表（不抛）', () => {
    const st = emptyStats();
    expect(hardestVerbs(st)).toEqual([]);
    expect(tenseRows(st)).toEqual([]);
    expect(modeRows(st)).toEqual([]);
    expect(recentWrong(st)).toEqual([]);
  });
});
