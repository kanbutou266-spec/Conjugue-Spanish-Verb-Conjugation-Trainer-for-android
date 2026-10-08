import type { Href } from 'expo-router';
import type { ImageSourcePropType } from 'react-native';

import type { I18nKey } from '@/i18n';

/**
 * 底栏 tab 的**唯一定义处** —— 原生版 `app-tabs.tsx` 与 web 版 `app-tabs.web.tsx`
 * 都从这里取顺序与文案，顺序就是数组顺序。
 *
 * 用户 2026-10-04 定死的顺序：**练习 · 讲解 · 变位表 · 我的**。
 *
 * ⚠️ 图标必须走下面这张**字面量**表（`require` 的路径要是字面量，Metro 才能在
 * 打包时收进来）—— 别改成 `` require(`.../${icon}.png`) `` 这种拼字符串的写法。
 * 四张 PNG 由 `scripts/gen-tab-icons.mjs` 从 Lucide 矢量栅格化而来，换图标重跑脚本。
 */
export interface TabDef {
  /** expo-router 的路由名（`src/app/(tabs)/` 下的文件名，不含扩展名） */
  name: string;
  /** web 版 `<TabTrigger href>` 用的路径（expo-router 的 `Href`，受类型路由约束） */
  href: Href;
  /** 标签文案的 i18n 键（不许硬编码中文，英文系统下会露馅） */
  labelKey: I18nKey;
  /** `assets/images/tabIcons/` 下的图标名 */
  icon: string;
}

export const TABS: TabDef[] = [
  { name: 'index', href: '/', labelKey: 'navPractice', icon: 'home' },
  { name: 'guide', href: '/guide', labelKey: 'navGuide', icon: 'guide' },
  // ⚠️ 底栏用短标签：英文全称 'Conjugation table' 太长，安卓原生底栏会把整个
  //    tab 挤掉（用户 2026-10-05）。中文两个键同值，不影响观感。
  { name: 'conj-table', href: '/conj-table', labelKey: 'navTableShort', icon: 'table' },
  { name: 'me', href: '/me', labelKey: 'navMe', icon: 'me' },
];

/** 图标名 → 打包后的资源。键与 `TABS[].icon` 一一对应 */
export const TAB_ICONS: Record<string, ImageSourcePropType> = {
  home: require('@/assets/images/tabIcons/home.png'),
  guide: require('@/assets/images/tabIcons/guide.png'),
  table: require('@/assets/images/tabIcons/table.png'),
  me: require('@/assets/images/tabIcons/me.png'),
};
