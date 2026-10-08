import AsyncStorage from '@react-native-async-storage/async-storage';

import { accuracy, emptyStats } from '@/data/stats';
import { STORAGE_KEYS } from '@/store/persist';
import { mergeStatsState, partializeStats, useStatsStore } from '@/store/stats';

import type { AnswerRecord } from '@/data/stats';
import type { StatsState } from '@/store/stats';

const S = () => useStatsStore.getState();

const rec = (o: Partial<AnswerRecord> = {}): AnswerRecord => ({
  inf: 'hablar',
  tense: 'p',
  person: 0,
  mode: 'produce',
  ok: true,
  user: 'hablo',
  ans: 'hablo',
  ...o,
});

beforeEach(() => {
  S().clear();
});

describe('stats store · 记一次作答', () => {
  it('record 累加四处计数', () => {
    S().record(rec());
    S().record(rec({ ok: false, user: 'hablé' }));
    const st = S();
    expect(st.total).toEqual({ att: 2, err: 1 });
    expect(st.tenses.p).toEqual({ att: 2, err: 1 });
    expect(st.modes.produce).toEqual({ att: 2, err: 1 });
    expect(accuracy(st.total)).toBe(50);
    expect(st.wrong).toHaveLength(1);
  });

  it('record 之后 state 里没有多余字段（verbs/tenses/modes/total/wrong + 三个方法）', () => {
    S().record(rec());
    expect(Object.keys(S()).sort()).toEqual(
      ['clear', 'modes', 'record', 'replace', 'tenses', 'total', 'verbs', 'wrong'].sort()
    );
  });

  it('clear 清空（网页「清空统计」）', () => {
    S().record(rec({ ok: false }));
    expect(S().wrong).toHaveLength(1);
    S().clear();
    expect(S().total).toEqual({ att: 0, err: 0 });
    expect(S().wrong).toEqual([]);
    expect(S().verbs).toEqual({});
  });
});

describe('stats store · replace（导入）', () => {
  it('吃裸 stats', () => {
    S().replace({ total: { att: 5, err: 1 }, tenses: { p: { att: 5, err: 1 } } });
    expect(S().total).toEqual({ att: 5, err: 1 });
    expect(S().tenses.p).toEqual({ att: 5, err: 1 });
  });

  it('也吃网页导出的 {stats, settings} 包（两版导出文件互通）', () => {
    S().replace({
      stats: { total: { att: 7, err: 2 } },
      settings: { levels: ['A1'], modes: ['produce'], tenses: ['p'] },
    });
    expect(S().total).toEqual({ att: 7, err: 2 });
  });

  it('垃圾输入 → 空统计（不会把已有数据变成 NaN 结构）', () => {
    S().record(rec());
    S().replace(null);
    expect(S().total).toEqual({ att: 0, err: 0 });
    expect(S()).toMatchObject(emptyStats());
  });
});

describe('stats store · 持久化', () => {
  it('只持久化数据字段，方法不写进存储', () => {
    S().record(rec({ ok: false }));
    const p = partializeStats(S() as StatsState);
    expect(Object.keys(p).sort()).toEqual(['modes', 'tenses', 'total', 'verbs', 'wrong']);
    expect((p as unknown as Record<string, unknown>).record).toBeUndefined();
  });

  it('存档键是 es-conj:stats（与 settings/custom 分开）', () => {
    expect(STORAGE_KEYS.stats).toBe('es-conj:stats');
  });

  it('反序列化时整体清洗：坏时态键丢掉、att=0 的动词不留', () => {
    const cur = S() as StatsState;
    const merged = mergeStatsState(
      {
        verbs: { hablar: { att: 0, err: 0 }, ir: { att: 2, err: 2, last: 3 } },
        tenses: { p: { att: 2, err: 2 }, zz: { att: 9, err: 9 } },
        total: { att: 2, err: 2 },
        wrong: 'nope',
      },
      cur
    );
    expect(Object.keys(merged.verbs)).toEqual(['ir']);
    expect(Object.keys(merged.tenses)).toEqual(['p']);
    expect(merged.wrong).toEqual([]);
  });

  it('空存档保持当前默认（首启不覆盖内存里的默认结构）', () => {
    const cur = S() as StatsState;
    expect(mergeStatsState({}, cur)).toBe(cur);
    expect(mergeStatsState(undefined, cur)).toBe(cur);
  });

  it('接上 AsyncStorage 适配层（persist 的 storage 能读写）', async () => {
    expect(typeof AsyncStorage.getItem).toBe('function');
    await AsyncStorage.setItem(STORAGE_KEYS.stats, 'x');
    expect(await AsyncStorage.getItem(STORAGE_KEYS.stats)).toBe('x');
  });
});
