import { getLocales } from 'expo-localization';
import { useCallback } from 'react';

import { useSettingsStore } from '@/store/settings';
import { en } from './en';
import { zh } from './zh';

import type { Lang, LangMode } from '@/data/types';
import type { Dict, TextArg, TextValue } from './types';

export { parseRich, plainText, isRich } from './rich';
export type { RichSeg, RichKind } from './rich';
export type { Dict, TFn, TextArg, TextValue } from './types';

/**
 * 文案键全集 —— 从 `zh` 的**字面量键**推出来（所以 zh/en 都写成 `satisfies Dict`
 * 而不是 `: Dict`，否则键会退化成 `string`，`t('typo')` 就查不出来了）。
 */
export type I18nKey = keyof typeof zh;

export const DICTS = { zh, en } satisfies Record<Lang, Dict>;

/**
 * 编译期断言：`en` 不能缺 `zh` 的任何键。
 * 缺键时下面这行编译不过（`AssertParity` 求值成 `false`，赋 `true` 失败）——
 * 比等到真机上显示成键名要好。
 */
type AssertParity<A, B> = [Exclude<keyof A, keyof B>] extends [never] ? true : false;
export const I18N_PARITY_OK: AssertParity<typeof zh, typeof en> = true;

/**
 * 取文案 —— 对应网页版的 `tr(k, ...a)`。
 *
 * 与网页的区别：**语言是显式参数**，不读全局状态。
 * 引擎与纯逻辑层因此不依赖 store，也就能在 Node 里确定性单测（方案 §5 的分层原则）；
 * 组件里用 `useI18n()` 拿绑定好语言的 `t`。
 *
 * 回退链与网页一致：当前语言没有 → 回退中文 → 中文也没有 → 原样返回键名。
 */
export function tr(lang: Lang, key: I18nKey, ...args: TextArg[]): string {
  const dict: Record<string, TextValue | undefined> = DICTS[lang] ?? zh;
  const hit = dict[key];
  if (hit !== undefined) return applyText(hit, args);
  const fb: TextValue | undefined = zh[key];
  return applyText(fb, args, key);
}

function applyText(v: TextValue | undefined, args: TextArg[], key?: string): string {
  if (v === undefined) return key ?? '';
  return typeof v === 'function' ? v(...args) : v;
}

/**
 * 「跟随系统」的判定：**`zh` 开头才中文，其余一律英语**（方案 §7.2）。
 *
 * 取不到系统语言时（原生模块异常）返回 `zh` —— 这时我们并不知道用户说什么，
 * 退回本应用的原生语言比硬猜英语更不容易让人困惑。
 */
export function systemLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode;
    if (!code) return 'zh'; // 拿不到语言信息：退回本应用的原生语言，不硬猜英语
    return code.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'zh';
  }
}

/** 实际生效的语言：手选模式听用户的，跟随系统模式听系统的 */
export function resolveLang(lang: Lang, langMode: LangMode, sys: Lang = sysLangRef.value): Lang {
  return langMode === 'manual' ? lang : sys;
}

/**
 * 系统语言的进程内缓存。系统语言在 App 生命周期里几乎不变，
 * 每帧都调 `getLocales()` 是白跑一次原生往返；真机上用户换了系统语言、
 * App 回前台时调 `refreshSystemLang()` 刷新即可。
 */
export const sysLangRef: { value: Lang } = { value: systemLang() };

export function refreshSystemLang(): Lang {
  sysLangRef.value = systemLang();
  return sysLangRef.value;
}

/** 组件外算当前生效语言（store 之外的地方用） */
export function currentLang(): Lang {
  const s = useSettingsStore.getState();
  return resolveLang(s.lang, s.langMode);
}

/** 当前生效语言 + 已绑定该语言的 `t`。切语言后整棵订阅树重渲染（方案 §7.2） */
export function useI18n(): { lang: Lang; t: (key: I18nKey, ...args: TextArg[]) => string } {
  const lang = useSettingsStore((s) => resolveLang(s.lang, s.langMode));
  const t = useCallback((key: I18nKey, ...args: TextArg[]) => tr(lang, key, ...args), [lang]);
  return { lang, t };
}

/* ------------------------------------------------------------------ *
 * 词表标签
 * ------------------------------------------------------------------ */

/** 数据里的中文标签 → 英文 */
const TAG_EN: Record<string, string> = {
  不规则: 'irregular',
  强过去式: 'strong preterite',
  不规则分词: 'irregular participle',
  重音变化: 'accent shift',
  拼写变化: 'spelling change',
  高频: 'high-frequency',
};

/**
 * 词表标签的显示名（网页 `tagName`）。
 * `词干变化(e→ie)` 这类带参数的标签用正则拆出来，译成 `stem change (e→ie)`；
 * 认不出的标签原样返回 —— 宁可显示中文，也不要空白。
 */
export function tagName(tag: string, lang: Lang): string {
  if (lang !== 'en') return tag;
  const hit = TAG_EN[tag];
  if (hit) return hit;
  const m = /^词干变化\((.+)\)$/.exec(tag);
  return m ? `stem change (${m[1]})` : tag;
}

/**
 * 「标签」筛选的选项（网页 `mkTagChips` 里那张表，顺序即展示顺序）。
 * `k` 是存进 `tagFilter` 的值：`''` = 全部动词；`词干变化` 走前缀匹配，
 * 会一并命中 `词干变化(e→ie)` / `(o→ue)` / `(e→i)` / `(u→ue)`（见 `engine/pool.ts` 的 `tagMatch`）。
 */
export const TAG_FILTERS: { k: string; key: I18nKey }[] = [
  { k: '', key: 'tagAll' },
  { k: '不规则', key: 'tagIrreg' },
  { k: '规则', key: 'tagReg' },
  { k: '高频', key: 'tagFreq' },
  { k: '拼写变化', key: 'tagSpell' },
  { k: '词干变化', key: 'tagStem' },
];
