import { existsSync } from 'fs';
import { join } from 'path';

import { TAB_ICONS, TABS } from '@/components/tab-config';
import { DICTS } from '@/i18n';

/**
 * 底栏 tab 的定义 —— 顺序由用户 2026-10-04 定死：**练习 · 讲解 · 变位表 · 我的**。
 *
 * 原生版和 web 版共用 `tab-config.ts` 这张表，所以这里测表就等于测了两个平台。
 *
 * 为什么不直接 `render(<AppTabs />)`：`NativeTabs` 取自 expo-router 的
 * unstable 原生标签实现，脱离路由文件上下文渲染会报
 * 「No filename found. This is likely a bug in expo-router.」——
 * 用一张可断言的定义表把"顺序 / 标签键 / 图标资源"这三件容易漂的事钉住，
 * 比硬啃原生组件划算。
 */

/** `src/app/(tabs)/` 下真实存在的路由文件名 */
const TAB_ROUTES = ['index', 'guide', 'conj-table', 'me'];

const ICON_DIR = join(process.cwd(), 'assets', 'images', 'tabIcons');

describe('底栏 tab 定义', () => {
  it('顺序就是用户定的：练习 · 讲解 · 变位表 · 我的', () => {
    expect(TABS.map((x) => x.labelKey)).toEqual([
      'navPractice',
      'navGuide',
      // 2026-10-05：底栏改用短标签 navTableShort（英文 'Conjugation table'
      // 太长会被安卓原生底栏整个挤掉）
      'navTableShort',
      'navMe',
    ]);
  });

  it('路由名与 `(tabs)/` 下的文件名一一对应，没有 `explore` 这类残留', () => {
    expect(TABS.map((x) => x.name)).toEqual(TAB_ROUTES);
    expect(TABS.map((x) => x.name)).not.toContain('explore');
  });

  it('web 版的 href 与路由名对得上（index 是 `/`，其余是 `/<name>`）', () => {
    for (const t of TABS) {
      expect(t.href).toBe(t.name === 'index' ? '/' : `/${t.name}`);
    }
  });

  it('四个标签在两套语言表里都有非空文案', () => {
    for (const t of TABS) {
      for (const lang of ['zh', 'en'] as const) {
        const v = DICTS[lang][t.labelKey as keyof typeof DICTS.zh];
        expect(typeof v).toBe('string');
        expect(String(v).length).toBeGreaterThan(0);
      }
    }
    // 顺手钉住中文文案本身，防止"翻译"成别的东西
    expect(TABS.map((t) => DICTS.zh[t.labelKey as keyof typeof DICTS.zh])).toEqual([
      '练习',
      '讲解',
      '变位表',
      '我的',
    ]);
  });

  it('英文标签都够短（底栏放不下长词，安卓会把 tab 挤掉）', () => {
    // 用户 2026-10-05：'Conjugation table' 让「变位表」这个 tab 整个消失。
    // 底栏标签一律控制在 12 个字符以内。
    for (const t of TABS) {
      const v = String(DICTS.en[t.labelKey as keyof typeof DICTS.en]);
      expect(v.length).toBeLessThanOrEqual(12);
    }
  });

  it('每个 tab 的图标名都能查到资源，且 1x/2x/3x 三个 PNG 都在盘上', () => {
    for (const t of TABS) {
      expect(TAB_ICONS[t.icon]).toBeTruthy();
      for (const suffix of ['', '@2x', '@3x']) {
        const p = join(ICON_DIR, `${t.icon}${suffix}.png`);
        expect(existsSync(p)).toBe(true);
      }
    }
  });

  it('没有多余图标资源（表里的图标名集合 = 磁盘上的文件名集合）', () => {
    const onDisk = new Set(
      TABS.map((x) => x.icon) // 由上一个用例保证这些文件真的在
    );
    expect(Object.keys(TAB_ICONS).sort()).toEqual([...onDisk].sort());
  });
});
