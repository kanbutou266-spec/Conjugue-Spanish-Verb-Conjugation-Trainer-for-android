import { ALL_KEYS, presetOf } from './levels';
import { MODE_KEYS } from './modes';
import { ALL_TENSE_KEYS, LEVELS, T } from './tenses';
import { LEVELS_IN_DATA } from './verbs';

import type { Level, PresetCfg, Settings, TenseKey } from './types';

/**
 * 设置的纯逻辑 —— 对应网页版 `app_template.html` 的
 * `defaultSettings / sanitizeSettings / syncTenseOrder / sameSet / loadKey / loadCustom`。
 * 零 UI、零 store 依赖，可单独单测；`store/settings.ts` 只是它的状态容器。
 */

/** 两个数组「元素相同、顺序也一致」（等级与时态都按固定顺序存） */
export function sameSet<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

/**
 * 归一化时态列表：剔除失效键，并按 TENSES 的固定顺序重排。
 * 对应网页 `syncTenseOrder()` —— 只在**用户手动勾选时态**后调用；
 * 载入一个档位的配置时**不要**调用它，否则预设自带的时态顺序被打乱，
 * 与 `sameSet` 比对就会误判成"不是这个预设"。
 */
export function normalizeTenses(ks: unknown): TenseKey[] {
  const src = Array.isArray(ks) ? (ks as unknown[]) : [];
  const set = new Set(src.filter((k): k is TenseKey => typeof k === 'string' && !!T[k]));
  return ALL_TENSE_KEYS.filter((k) => set.has(k));
}

/** 等级收敛到「词表里真的有的等级」，按 LEVELS 顺序排；一个都没有时回退到词表里的全部等级 */
export function normalizeLevels(ls: unknown): Level[] {
  const src = Array.isArray(ls) ? (ls as unknown[]) : [];
  const kept = LEVELS.filter((lv) => src.includes(lv));
  if (kept.length) return kept;
  return LEVELS_IN_DATA.length ? LEVELS_IN_DATA.slice() : ['A1'];
}

/**
 * 两个数组「元素相同」，**忽略顺序**。
 * 用于「设置页草稿有没有被改过」的比对 —— 时态的排列顺序不影响出题，
 * 所以重排不算改动（`sameSet` 是顺序敏感的，那边判"是不是这个预设"才需要）。
 */
export function sameMembers<T>(a: readonly T[], b: readonly T[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((x) => b.includes(x));
}

/**
 * 等级多选：**至少保留 1 个** —— 点掉最后一个会被原样退回（对应网页
 * `mkLevelChips` 里的 `if(s.levels.length>1)`）。新增时按 `LEVELS` 固定顺序插入。
 */
export function toggleLevelIn(levels: readonly Level[], lv: Level): Level[] {
  if (levels.includes(lv)) {
    if (levels.length <= 1) return levels.slice(); // 拒绝：这是最后一个等级
    return levels.filter((x) => x !== lv);
  }
  return LEVELS.filter((x) => levels.includes(x) || x === lv);
}

/** 标签**单选**：点已选中的标签 = 回到「全部动词」（`tagFilter: ''`） */
export function toggleTagIn(cur: string, tag: string): string {
  return cur === tag ? '' : tag;
}

/** 时态来回切（切完按 `ALL_TENSE_KEYS` 固定顺序重排，与网页 `syncTenseOrder()` 同口径） */
export function toggleTenseIn(ks: readonly TenseKey[], k: TenseKey): TenseKey[] {
  return normalizeTenses(ks.includes(k) ? ks.filter((x) => x !== k) : ks.concat([k]));
}

/** 两份配置逐字段一致？（顺序不敏感的 `sameMembers`） */
export function sameCfg(a: PresetCfg, b: PresetCfg): boolean {
  if (a.tagFilter !== b.tagFilter || a.inputMode !== b.inputMode) return false;
  return sameMembers(a.levels, b.levels) && sameMembers(a.tenses, b.tenses);
}

/** 默认设置（对应网页 `defaultSettings`；网页那个已下线的 askTense 不再带） */
export function defaultSettings(): Settings {
  return {
    levels: LEVELS_IN_DATA.length ? LEVELS_IN_DATA.slice() : ['A1'],
    modes: ['produce'],
    tenses: ALL_TENSE_KEYS.slice(),
    showZh: true,
    strictAccent: true,
    inputMode: 'type',
    tagFilter: '',
    hideInf: false,
    vosotros: true,
    lang: 'zh',
    langMode: 'system',
    themeMode: 'system',
  };
}

/**
 * 把一个档位的配置载入设置。
 * 对应网页 `loadKey()` / `loadCustom()` —— **只搬这四样**：
 * 词库范围 + 时态 + 标签 + 答题方式。
 * 练习模式、以及设置页里的全局项（语言 / vosotros / 隐藏原形 / 严格重音 / 显示释义）一律不动。
 */
export function loadCfg(s: Settings, cfg: PresetCfg): Settings {
  return {
    ...s,
    levels: Array.isArray(cfg.levels) ? cfg.levels.slice() : s.levels,
    tenses: Array.isArray(cfg.tenses) ? cfg.tenses.slice() : s.tenses,
    tagFilter: typeof cfg.tagFilter === 'string' ? cfg.tagFilter : '',
    inputMode: cfg.inputMode === 'choice' ? 'choice' : 'type',
  };
}

/** 一份配置是否合法可用（自定义槽 / 老存档用） */
export function isValidCfg(c: unknown): c is PresetCfg {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return Array.isArray(o.levels) && (o.levels as unknown[]).length > 0;
}

/** 把一份可能不全的配置补成完整合法的配置 */
export function sanitizeCfg(c: unknown): PresetCfg {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
  return {
    levels: normalizeLevels(o.levels),
    tenses: normalizeTenses(o.tenses),
    tagFilter: typeof o.tagFilter === 'string' ? o.tagFilter : '',
    inputMode: o.inputMode === 'choice' ? 'choice' : 'type',
  };
}

/** 从任意（可能是老存档 / 被手改过的）对象清洗出一份合法设置 */
export function sanitizeSettings(input: unknown): Settings {
  const d = defaultSettings();
  const raw: Record<string, unknown> =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

  // 练习模式是单选：残留旧的多选值只留第一个合法项（对应网页 sanitizeSettings）
  const modesRaw = Array.isArray(raw.modes) ? (raw.modes as unknown[]) : [];
  let modes = MODE_KEYS.filter((k) => modesRaw.includes(k)).slice(0, 1);
  if (!modes.length) modes = ['produce'];

  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === 'boolean' ? v : fallback;

  return {
    levels: normalizeLevels(raw.levels),
    modes,
    // 注意区分「字段缺失」与「显式清空」：缺失（老存档 / 垃圾输入）回默认的 15 个时态，
    // 而用户手动清空时存的是 `[]`（数组），照实保留 —— 否则一次损坏的存档会变成"练不了"。
    tenses: raw.tenses === undefined ? d.tenses.slice() : normalizeTenses(raw.tenses),
    tagFilter: typeof raw.tagFilter === 'string' ? raw.tagFilter : '',
    inputMode: raw.inputMode === 'choice' ? 'choice' : 'type',
    hideInf: bool(raw.hideInf, d.hideInf),
    vosotros: raw.vosotros === false ? false : d.vosotros,
    showZh: bool(raw.showZh, d.showZh),
    strictAccent: bool(raw.strictAccent, d.strictAccent),
    lang: raw.lang === 'en' ? 'en' : 'zh',
    langMode: raw.langMode === 'manual' ? 'manual' : 'system',
    /* 深浅色三档：只认 dark/light，其余（含老存档没有这个字段）一律回 'system' */
    themeMode:
      raw.themeMode === 'dark' ? 'dark' : raw.themeMode === 'light' ? 'light' : 'system',
  };
}

/**
 * 首次启动选中的档位。
 * 网页版允许"一个档都不选中"（难度键整排不亮）；RN 是整卡轮播，
 * 屏幕正中永远有一张卡 → 必须有一个选中态，就取第一张（零基础）。
 * 想改回"不选中"，把这里改成 `null` 即可（只影响首屏默认）。
 */
export const DEFAULT_ACTIVE_KEY: string | null = ALL_KEYS[0];

/**
 * 清洗 activeKey：合法键原样保留，显式的 `null` 也保留（"一个都没选"是合法状态），
 * 其余（老存档没这个字段 / 存了非法值）回退到默认档位。
 * 对应网页 `if(DB.activeKey !== null && ALL_KEYS.indexOf(DB.activeKey) < 0) ...`。
 */
export function sanitizeActiveKey(raw: unknown, fallback: string | null): string | null {
  if (raw === null) return null;
  if (typeof raw === 'string' && ALL_KEYS.includes(raw)) return raw;
  return fallback;
}

/** 首屏默认设置 = 默认档位那套配置（避免首屏就开着全部 15 个时态） */
export function initialSettings(): Settings {
  const base = defaultSettings();
  const p = DEFAULT_ACTIVE_KEY ? presetOf(DEFAULT_ACTIVE_KEY) : null;
  return p ? loadCfg(base, p.cfg) : base;
}
