import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { CUSTOM_KEYS, defaultCustom } from '@/data/levels';
import { isValidCfg, sanitizeCfg } from '@/data/settings';
import { STORAGE_KEYS, createStoreStorage } from './persist';

import type { PresetCfg } from '@/data/types';

/**
 * 两个自定义槽的配置 —— 对应网页版的 `DB.custom`。
 *
 * 关键语义（与网页一致）：**槽永远可用**。老存档里没有、或存了个坏值，
 * 都回填成默认配方（`A2 + 现在/简单过去/未完成 + 手写`），
 * 免得用户"没配过就开始练自定义"练出一套空设置。
 *
 * 与网页的**唯一差别**（方案 §3.9 定的）：网页是"改一下就实时存进槽"，
 * RN 改成了「自定义槽设置页」上显式点「保存」才写盘 —— 所以这里只有 `save`，
 * 没有 `syncActive` 那种隐式写回。
 */
export interface CustomState {
  /** custom1 / custom2 → 配置（永远有值） */
  slots: Record<string, PresetCfg>;

  /** 取某个槽的配置（越界 key 返回 null） */
  cfgOf: (k: string) => PresetCfg | null;
  /** 保存某个槽（对应设置页的「保存」按钮） */
  save: (k: string, cfg: PresetCfg) => void;
  /** 把某个槽恢复成默认配方（对应设置页的「恢复默认」，这里落盘） */
  reset: (k: string) => void;
  /** 两个槽一起恢复默认 */
  resetAll: () => void;
}

/** 两个槽都填上默认配方 */
export function defaultSlots(): Record<string, PresetCfg> {
  const out: Record<string, PresetCfg> = {};
  CUSTOM_KEYS.forEach((k) => {
    out[k] = defaultCustom();
  });
  return out;
}

/**
 * 按 CUSTOM_KEYS 把任意输入清成两个合法槽（一个都不少、一个都不多）。
 *
 * 非法值一律**回退成默认配方**（不是"就地补空"）—— 对应网页
 * `(c && typeof c === 'object' && Array.isArray(c.levels)) ? c : defaultCustom()`。
 * 这一步很关键：如果只是把缺的字段补成空，会得到「全等级 + 零时态」这种
 * 看起来合法、实际一题都出不了的配置。
 */
export function sanitizeSlots(input: unknown): Record<string, PresetCfg> {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out: Record<string, PresetCfg> = {};
  CUSTOM_KEYS.forEach((k) => {
    const c = raw[k];
    out[k] = isValidCfg(c) ? sanitizeCfg(c) : defaultCustom();
  });
  return out;
}

export const useCustomStore = create<CustomState>()(
  persist(
    (set, get) => ({
      slots: defaultSlots(),

      cfgOf: (k) => (CUSTOM_KEYS.includes(k) ? get().slots[k] : null),

      save: (k, cfg) => {
        if (!CUSTOM_KEYS.includes(k)) return;
        set({ slots: { ...get().slots, [k]: sanitizeCfg(cfg) } });
      },

      reset: (k) => {
        if (!CUSTOM_KEYS.includes(k)) return;
        set({ slots: { ...get().slots, [k]: defaultCustom() } });
      },

      resetAll: () => set({ slots: defaultSlots() }),
    }),
    {
      name: STORAGE_KEYS.custom,
      storage: createStoreStorage(),
      partialize: partializeCustom,
      merge: mergeCustomState,
    }
  )
);

/** 只持久化 slots 本身，别把方法写进存储 */
export function partializeCustom(s: CustomState): { slots: Record<string, PresetCfg> } {
  return { slots: sanitizeSlots(s.slots) };
}

/** 反序列化时按 CUSTOM_KEYS 清成两个合法槽（不多不少、坏的补默认） */
export function mergeCustomState(persisted: unknown, current: CustomState): CustomState {
  const raw =
    persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : {};
  return { ...current, slots: sanitizeSlots(raw.slots) };
}
