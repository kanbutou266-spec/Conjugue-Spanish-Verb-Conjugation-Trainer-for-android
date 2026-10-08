import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  DEFAULT_ACTIVE_KEY,
  initialSettings,
  loadCfg,
  normalizeTenses,
  sanitizeActiveKey,
  sanitizeSettings,
  toggleLevelIn,
  toggleTagIn,
  toggleTenseIn,
} from '@/data/settings';
import { ALL_TENSE_KEYS } from '@/data/tenses';
import { STORAGE_KEYS, createStoreStorage } from './persist';

import type {
  InputMode,
  Lang,
  LangMode,
  Level,
  ModeKey,
  PresetCfg,
  Settings,
  TenseKey,
  ThemeMode,
} from '@/data/types';

/**
 * 全局设置 store —— 对应网页版的 `DB.settings` + `DB.activeKey`。
 * 纯逻辑（默认值 / 清洗 / 载入配置）都在 `data/settings.ts`，这里只做状态与持久化。
 *
 * 语义红线（与网页一致）：
 *   · 切换难度档（`loadCfg`）**只搬四样**：词库范围 / 时态 / 标签 / 答题方式；
 *     练习模式与四个全局开关（隐藏原形 / vosotros / 显示释义 / 严格重音）绝不被档位改掉。
 *   · 练习模式是**单选**（0 号 = 当前模式）。
 *   · 等级**至少保留 1 个**；标签是**单选**（再点一次回「全部」）。
 */
export interface SettingsState extends Settings {
  /** 当前选中的难度档；null 表示一个都没选 */
  activeKey: string | null;

  setActiveKey: (k: string | null) => void;
  /** 只把一套配置载入设置，不改 activeKey */
  applyCfg: (cfg: PresetCfg) => void;
  /** 载入某个档位的配置并选中它（网页 `selectKey` 的无副作用版本） */
  selectKeyWithCfg: (k: string, cfg: PresetCfg) => void;

  setMode: (k: ModeKey) => void;
  /** 切换等级；**至少保留 1 个** —— 点掉最后一个会被忽略 */
  toggleLevel: (lv: Level) => void;
  /** 标签单选：点已选中的标签 = 回到「全部」（''） */
  setTag: (tag: string) => void;
  toggleTense: (k: TenseKey) => void;
  setTenses: (ks: TenseKey[]) => void;
  allTenses: () => void;
  clearTenses: () => void;
  setInputMode: (m: InputMode) => void;
  setFlag: (k: 'hideInf' | 'vosotros' | 'showZh' | 'strictAccent', v: boolean) => void;
  setLang: (l: Lang, mode?: LangMode) => void;
  /** 深浅色三档：'system'（跟随系统深色开关，默认）/ 'dark' / 'light' */
  setThemeMode: (m: ThemeMode) => void;
  /** 恢复默认设置与默认档位 */
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialSettings(),
      activeKey: DEFAULT_ACTIVE_KEY,

      setActiveKey: (k) => set({ activeKey: k }),

      applyCfg: (cfg) => set(loadCfg(get(), cfg)),

      selectKeyWithCfg: (k, cfg) => set({ ...loadCfg(get(), cfg), activeKey: k }),

      setMode: (k) => set({ modes: [k] }),

      toggleLevel: (lv) => set({ levels: toggleLevelIn(get().levels, lv) }),

      setTag: (tag) => set({ tagFilter: toggleTagIn(get().tagFilter, tag) }),

      toggleTense: (k) => set({ tenses: toggleTenseIn(get().tenses, k) }),

      setTenses: (ks) => set({ tenses: normalizeTenses(ks) }),

      allTenses: () => set({ tenses: ALL_TENSE_KEYS.slice() }),

      clearTenses: () => set({ tenses: [] }),

      setInputMode: (m) => set({ inputMode: m === 'choice' ? 'choice' : 'type' }),

      setFlag: (k, v) => set({ [k]: v } as Partial<SettingsState>),

      setLang: (l, mode) => set(mode ? { lang: l, langMode: mode } : { lang: l }),

      setThemeMode: (m) => set({ themeMode: m }),

      reset: () => set({ ...initialSettings(), activeKey: DEFAULT_ACTIVE_KEY }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: createStoreStorage(),
      merge: mergeSettingsState,
    }
  )
);

/**
 * 反序列化时的清洗：老存档 / 被手改过的存储一律先过 `sanitizeSettings`。
 * 展开顺序是「当前默认 → 存档」，这样以后新增字段时老存档也能自动补上默认值。
 * `activeKey` 不在 Settings 里，单独清洗。
 *
 * 两种输入区别对待：
 *   · 存档里**根本没有设置字段**（首次启动、存档损坏成 `{}`）→ 整份保持当前默认。
 *     不能退回 `sanitizeSettings` 的"缺字段就用全量默认"，否则会出现
 *     `activeKey = 'starter'`（A1·现在时）但设置却是「全部等级 + 全部时态」的自相矛盾状态。
 *   · 存档里**有**设置字段 → 逐字段清洗，缺的字段补默认值（老版本升级路径）。
 */
export function mergeSettingsState(
  persisted: unknown,
  current: SettingsState
): SettingsState {
  const raw =
    persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : {};
  const activeKey = sanitizeActiveKey(raw.activeKey, current.activeKey);
  const hasSettings =
    raw.levels !== undefined || raw.tenses !== undefined || raw.modes !== undefined;
  if (!hasSettings) return { ...current, activeKey };
  return { ...current, ...sanitizeSettings(raw), activeKey };
}
