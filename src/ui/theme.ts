/**
 * RN 端设计令牌 —— 逐值翻译自网页版 `data/app_template.html` 的 CSS 变量。
 *
 * 对应关系（网页 → 这里）：
 *   :root{--bg/--card/--ink/--sub/--line/--accent/--accent-soft/--ok/--bad/--warn/
 *         --tag/--radius/--shadow/--f-irr/--f-orth/--f-stem}  →  light 调色板
 *   .g-ind/.g-cond/.g-sub/.g-imp{--g/--gs/--gi/--gb}          →  mood
 *
 * 约定：
 *   · 颜色一律**照抄网页值**，不要"顺手调好看" —— 两个版本要能并排比对。
 *   · 字号只做"档位"，不要按组件另起一套；需要新档位就加在这里。
 *
 * 深浅色（用户 2026-10-05 新增）：
 *   `light` / `dark` 两套 Palette，外加两张 `mood*` 表；由 `useTheme()` 按
 *   设置里的 `themeMode` + 系统深色开关**现算**。用法：
 *     const theme = useTheme();          // 组件里
 *     theme.color.bg / theme.mood.ind.main
 *   下面导出的 `theme` 常量仍然存在，但只作为**亮色快照**（测试与
 *   非组件环境用），组件里一律走 `useTheme()` 才能跟着主题变。
 */

import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settings';

import type { GroupKey } from '@/data/types';

/** 全局调色板（一套 = 一个明暗主题） */
export interface Palette {
  /** 页面底色 */
  bg: string;
  /** 卡片/浮层底色 */
  card: string;
  /** 主文字 */
  ink: string;
  /** 次级文字 */
  sub: string;
  /** 分隔线 / 边框 */
  line: string;
  /** 品牌主色（按钮、选中态） */
  accent: string;
  /** 主色浅底 */
  accentSoft: string;
  /** 正确 */
  ok: string;
  okSoft: string;
  /** 错误 */
  bad: string;
  badSoft: string;
  /** 提醒 */
  warn: string;
  warnSoft: string;
  /** chip / 标签底色 */
  tag: string;
  /* ---- 以下为「派生底 / 派生字」，与网页版同名 CSS 变量一一对应 ----
     用户 2026-10-06：深色下题干框 / 输入框 / 返回键这些还留白，根因是组件里
     直接写死了 `#ffffff`，绕过了调色板。补齐这批令牌后组件一律引用它们，
     深色下就不会再漏白。 */
  /** `--card2` 比 card 沉一档的浅底（时态选项框、讲解链接卡、预设卡） */
  card2: string;
  /** `--raise` 比 card 亮一档的"浮起"卡面（变位表分组卡） */
  raise: string;
  /** `--mute-ink` 配 tag/mute 底色的灰字 */
  muteInk: string;
  /** `--body-ink` 正文偏灰的字（讲解正文、`<code>`） */
  bodyInk: string;
  /** `--body-ink2` 比 bodyInk 再浅一档的小节标题字 */
  bodyInk2: string;
  /** `--faint` 极淡的占位字（待填的「?」、输入框 placeholder） */
  faint: string;
  /** `--hi-ink` 强调字的深色版（pill / tag.acc / 选中键） */
  hiInk: string;
  /** `--line2` 比 line 重一档的悬停/次级边线（虚线框、开关轨道） */
  line2: string;
  /** `--line-acc` 强调色边线（选中态的浅边） */
  lineAcc: string;
  /** 变位形式着色：不规则 */
  fIrr: string;
  /** 变位形式着色：正字法（拼写）变化 */
  fOrth: string;
  /** 变位形式着色：词干变化 */
  fStem: string;
}

/** 四个语式分组各自的主题色（对应 CSS 的 .g-* 四条） */
export interface MoodPalette {
  /** --g 主色（选中态） */
  main: string;
  /** --gs 浅底 */
  soft: string;
  /** --gi 深字 */
  ink: string;
  /** --gb 浅边 */
  border: string;
}

/** 亮色主题：与网页版 :root 一一对应 */
export const light: Palette = {
  bg: '#f5f6f8',
  card: '#ffffff',
  ink: '#1b1d21',
  sub: '#6b7280',
  line: '#e4e6eb',
  accent: '#2f6df6',
  accentSoft: '#e8f0ff',
  ok: '#12855a',
  okSoft: '#e6f6ef',
  bad: '#c0392b',
  badSoft: '#fdecea',
  warn: '#b7791f',
  warnSoft: '#fdf5e3',
  tag: '#eef1f6',
  card2: '#fbfcfe',
  raise: '#fcfdff',
  muteInk: '#4b5563',
  bodyInk: '#334155',
  bodyInk2: '#475569',
  faint: '#b9c2d4',
  hiInk: '#1f4fbb',
  line2: '#c9d3e6',
  lineAcc: '#c3d4fb',
  fIrr: '#c0392b',
  fOrth: '#0b7a7a',
  fStem: '#b26a00',
};

/**
 * 深色主题（用户 2026-10-05）—— 字段与 `light` 一一对应，与网页版
 * `@media (prefers-color-scheme:dark)` + `[data-theme=dark]` 那一段**同值**。
 *
 * 取色原则：
 *   · 底色不用纯黑（`#111317` 一档），卡片比底色**亮**一点点 → 层次靠亮度差，
 *     不靠阴影（深色下阴影几乎看不见）。
 *   · 主色 / 对错色都**提亮一档**：亮色版那些 `#12855a`、`#c0392b` 压在深底上
 *     对比度不够（WCAG AA 过不了），深色版统一换成明度更高的同色相。
 *   · `*Soft` 系列（浅底）在深色下变成"低饱和深底"，只做背景，上面配亮色文字。
 */
export const dark: Palette = {
  bg: '#111317',
  card: '#191c21',
  ink: '#e8eaee',
  sub: '#9aa3b2',
  line: '#2b3038',
  accent: '#6f9dff',
  accentSoft: '#1b2a4a',
  ok: '#4ecf9a',
  okSoft: '#14342a',
  bad: '#ff7a6b',
  badSoft: '#3a1d1a',
  warn: '#e0b25c',
  warnSoft: '#33280f',
  tag: '#232830',
  card2: '#15181d',
  raise: '#1f232a',
  muteInk: '#b6bfcd',
  bodyInk: '#cdd4de',
  bodyInk2: '#c2c9d4',
  faint: '#5b636f',
  hiInk: '#a8c4ff',
  line2: '#3a4150',
  lineAcc: '#2f4470',
  fIrr: '#ff7a6b',
  fOrth: '#4fd0d0',
  fStem: '#e0a94a',
};

/** 语式主题色：陈述=蓝 / 条件=青 / 虚拟=紫 / 命令=橙 */
export const mood: Record<GroupKey, MoodPalette> = {
  ind: { main: '#2f6df6', soft: '#e9f1ff', ink: '#1f4fbb', border: '#bcd0fa' },
  cond: { main: '#0b7a7a', soft: '#e1f5f5', ink: '#0a6b6b', border: '#a8dede' },
  sub: { main: '#7b45d6', soft: '#f2eaff', ink: '#5f31ad', border: '#ccb5f0' },
  imp: { main: '#b85c07', soft: '#fdf1e2', ink: '#9a4d08', border: '#efcfa6' },
};

/** 深色版语式主题色：主色提亮、浅底压深（对应网页 `[data-theme=dark] .g-*`） */
export const moodDark: Record<GroupKey, MoodPalette> = {
  ind: { main: '#6f9dff', soft: '#1b2a4a', ink: '#a8c4ff', border: '#2f4470' },
  cond: { main: '#3fc9c9', soft: '#123333', ink: '#8fe4e4', border: '#1f4d4d' },
  sub: { main: '#a98bec', soft: '#2a2140', ink: '#cbb6f5', border: '#3d3060' },
  imp: { main: '#e0a04e', soft: '#3a2a15', ink: '#f0c98f', border: '#5a4222' },
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  pill: 999,
} as const;

/**
 * 按下 / 悬停态配色。网页里这三个值散在 `.chip:hover`、`.btn:hover`、
 * `.btn.primary:hover`、`.btn.ghost:hover`、`.seg button:hover` 五条规则里，
 * 手机上没有"悬停"这个概念，统一收成一张表，按下即用。
 */
export const press: PressPalette = {
  /** 浅蓝底：`.chip:hover` / `.btn:hover` / `.seg button:hover` 共用 */
  soft: '#fafbff',
  /** 浅蓝底配套的边框色 */
  softBorder: '#c9d3e6',
  /** 主按钮按下时更深一档（`.btn.primary:hover`） */
  primary: '#255ee0',
  /** 幽灵按钮按下时的灰底（`.btn.ghost:hover`） */
  ghost: '#eceff4',
};

/** 深色版按下态：亮色的浅蓝底在深色下要变成"比卡片再亮一档" */
export const pressDark: PressPalette = {
  soft: '#22272f',
  softBorder: '#3a4150',
  primary: '#5d8bee',
  ghost: '#252a32',
};

/** 按下态配色的一套（明暗各一张，结构一致） */
export interface PressPalette {
  soft: string;
  softBorder: string;
  primary: string;
  ghost: string;
}

/** 4pt 网格：space(3) → 12 */
export const space = (n: number): number => n * 4;

export const font = {
  /** 12px 级：徽标、脚注 */
  xs: 11.5,
  /** 13px 级：说明文字、hint */
  sm: 13,
  /** 15px 级：正文（网页 body 16px，手机下调 1px 更稳） */
  md: 15,
  /** 18px 级：小标题 */
  lg: 18,
  /** 22px 级：.verb-mid（题目里的原形、对照网格的形式） */
  xl: 22,
  /** 34px 级：.verb-big（作答页正中的题干形式） */
  xxl: 34,
  /** 24px 级：页面标题 h1 */
  h1: 24,
} as const;

/**
 * 卡片阴影。网页是双层阴影（1px/3px + 8px/24px），RN 只支持一层，
 * 取**第一层**（近景）—— 第二层在手机上会被 elevation 放大成脏边。
 */
export const cardShadow: CardShadow = {
  shadowColor: '#101828',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
};

/** 深色下的卡片阴影：底色一深，阴影就看不见了，改成"不提阴影、只靠卡片亮度差" */
export const cardShadowDark: CardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.25,
  shadowRadius: 3,
  elevation: 2,
};

/** 卡片阴影的形状（明暗两张表结构相同） */
export interface CardShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/**
 * 聚合对象：`theme.color.bg` / `theme.font.xxl` 这样用。
 *
 * ⚠️ 这里**不加 `as const`** —— 加了会把每个颜色值收窄成字面量类型
 * （`soft: '#fafbff'`），深色表就赋不进去。用显式 `Theme` 接口把结构钉住，
 * 明暗两套表都按同一形状来。
 */
export const theme: Theme = {
  color: light,
  mood,
  radius,
  press,
  space,
  font,
  cardShadow,
};

/** 全套设计令牌（明暗两套同形） */
export interface Theme {
  color: Palette;
  mood: Record<GroupKey, MoodPalette>;
  radius: typeof radius;
  press: PressPalette;
  space: typeof space;
  font: typeof font;
  cardShadow: CardShadow;
}

/**
 * 当前主题是不是深色。
 * 口径（用户 2026-10-05）：`themeMode` = 'dark'/'light' 时直接听设置；
 * = 'system'（默认）时跟随**手机系统的深色开关**（`useColorScheme()`）。
 *
 * ⚠️ 这个 hook 会在系统切换深浅色时触发重渲染 —— 这正是我们要的
 * （系统里设了"日出日落自动切换"，App 会自己跟着变）。
 */
export function useIsDark(): boolean {
  const mode = useSettingsStore((s) => s.themeMode);
  const scheme = useColorScheme();
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return scheme === 'dark';
}

/**
 * 取当前主题的完整令牌集。组件里**一律**用这个，不要直接 import `theme`
 * （那个常量永远是亮色快照，深色下不会变）。
 *
 * 返回的对象与旧的 `theme` 常量**同形**（color / mood / radius / press /
 * space / font / cardShadow），所以从 `theme.color.bg` 换成
 * `const theme = useTheme()` 之后，下面所有 `theme.color.*` 的写法都不用改。
 */
export function useTheme(): Theme {
  const isDark = useIsDark();
  if (!isDark) return theme;
  return {
    color: dark,
    mood: moodDark,
    radius,
    press: pressDark,
    space,
    font,
    cardShadow: cardShadowDark,
  };
}

/**
 * 只要调色板（不要整包令牌）时用这个；等价于 `useTheme().color`。
 * 适合传给只吃颜色的纯组件 / 工具函数。
 */
export function usePalette(): Palette {
  return useTheme().color;
}
