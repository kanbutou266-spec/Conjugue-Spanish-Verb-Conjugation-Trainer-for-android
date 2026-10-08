import { isCustomKey, presetOf } from '@/data/levels';
import { useCustomStore } from './custom';
import { useSettingsStore } from './settings';

import type { PresetCfg } from '@/data/types';

/**
 * 跨 store 的动作 —— 这里放"既要读设置、又要读自定义槽"的操作，
 * 让两个 store 各自保持无依赖（settings 不知道 custom 的存在）。
 */

/** 某个难度档当前那套配置：预设读表，自定义槽读槽；未知 key 返回 null */
export function cfgOfKey(k: string): PresetCfg | null {
  const p = presetOf(k);
  if (p) return p.cfg;
  if (isCustomKey(k)) return useCustomStore.getState().cfgOf(k);
  return null;
}

/**
 * 选中一个难度档：先把它的配置载入设置，再记下 activeKey。
 * 对应网页 `selectKey(k)`。返回是否成功（未知 key 返回 false）。
 */
export function selectKey(k: string): boolean {
  const cfg = cfgOfKey(k);
  if (!cfg) return false;
  useSettingsStore.getState().selectKeyWithCfg(k, cfg);
  return true;
}

/**
 * 保存自定义槽并让它生效（对应设置页的「保存」按钮）：
 * 写槽 → 载入设置 → 选中它。
 */
export function saveSlotAndApply(k: string, cfg: PresetCfg): boolean {
  if (!isCustomKey(k)) return false;
  useCustomStore.getState().save(k, cfg);
  const saved = useCustomStore.getState().cfgOf(k);
  if (!saved) return false;
  useSettingsStore.getState().selectKeyWithCfg(k, saved);
  return true;
}

/**
 * 自定义槽的「恢复默认」：只重置草稿由页面自己管；
 * 这里提供"重置并立刻生效"的版本，给需要一步到位的场合用。
 */
export function resetSlotAndApply(k: string): boolean {
  if (!isCustomKey(k)) return false;
  useCustomStore.getState().reset(k);
  return selectKey(k);
}
