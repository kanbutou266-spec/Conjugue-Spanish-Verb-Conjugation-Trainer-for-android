/**
 * 布局常量（非配色）。
 *
 * ⚠️ 配色**不在这里** —— 一律去 `src/ui/theme.ts`（`useTheme()` / `Palette`）。
 *
 * 这里原本是 Expo 模板带出来的 `Colors` / `Fonts`（浅色表写死 `#ffffff`、
 * 深色表写死 `#000000`，而且只认 `useColorScheme()`、不认设置里的
 * `themeMode`）—— 用户 2026-10-06 报的「底栏 / 题干框 / 输入框在深色下还是白的」
 * 就是它引起的：底栏读的是 `Colors`，跟页面用的调色板完全是两套。
 * 那套 `Colors` / `Fonts` 连同只服务它们的 `themed-text` / `themed-view` /
 * `use-theme` / `collapsible` / `web-badge` / `hint-row` 六个模板文件已一并删除，
 * 免得以后又有人 import 错。
 */

import '@/global.css';

import { Platform } from 'react-native';

/** 4 / 8 / 16 / 24 / 32 / 64 的间距档（web 构建的顶栏还在用） */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** 原生底部 tab 栏的高度占位，页面滚动区要给它让位 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
