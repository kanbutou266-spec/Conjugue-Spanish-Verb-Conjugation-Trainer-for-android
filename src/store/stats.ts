import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { emptyStats, recordAnswer, sanitizeStats } from '@/data/stats';
import { STORAGE_KEYS, createStoreStorage } from './persist';

import type { AnswerRecord, StatsData } from '@/data/stats';

/**
 * 答题统计 + 错题本 store —— 对应网页版的 `DB.stats`。
 *
 * 与网页版的两点差别：
 *   · 纯逻辑（记一次作答 / 清洗 / 派生排序）全在 `data/stats.ts`，
 *     这里只负责状态与持久化 —— 和 settings / custom 两个 store 同构。
 *   · 网页每次作答都 `saveDB()` 全量写 localStorage；RN 的 persist 也是整体写
 *     AsyncStorage，所以写入频率要控制：**只有 `ansOf` 的判分结果落定后才记一次**
 *     （即 `record(q)` 在"提交答案"那一步调，不在渲染里调），
 *     错题本上限 300 条，避免 AsyncStorage 里那个 key 无限长大。
 *
 * 记忆里「两版功能必须对齐」：导出的 JSON 形状与网页完全一致，
 * `replace()` 吃网页导出的 `{stats: {...}}` 或裸 stats 都能用。
 */
export interface StatsState extends StatsData {
  /** 记一次作答。**不可变**更新，返回新对象 */
  record: (r: AnswerRecord) => void;
  /** 清空全部统计与错题本（对应网页的「清空统计」） */
  clear: () => void;
  /** 用一份（可能是外部导入的）数据整体替换；先过 `sanitizeStats` */
  replace: (data: unknown) => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      ...emptyStats(),

      record: (r) => set(recordAnswer(get(), r)),

      clear: () => set(emptyStats()),

      replace: (data) => {
        // 兼容两种输入：网页导出的 {stats:{...}, settings:{...}} 与裸 stats
        const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        set(sanitizeStats(o.stats ?? o));
      },
    }),
    {
      name: STORAGE_KEYS.stats,
      storage: createStoreStorage(),
      partialize: partializeStats,
      merge: mergeStatsState,
    }
  )
);

/**
 * 只持久化**数据字段**（verbs/tenses/modes/total/wrong），
 * 方法不写进存储 —— 否则 AsyncStorage 里会多出几个永远是 `undefined` 的键。
 */
export function partializeStats(s: StatsState): StatsData {
  return { verbs: s.verbs, tenses: s.tenses, modes: s.modes, total: s.total, wrong: s.wrong };
}

/** 反序列化时整体清洗一遍（老存档 / 手改过的存储 / 跨版本迁移） */
export function mergeStatsState(persisted: unknown, current: StatsState): StatsState {
  const raw =
    persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : {};
  if (Object.keys(raw).length === 0) return current;
  return { ...current, ...sanitizeStats(raw) };
}
