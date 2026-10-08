import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { TAB_ICONS, TABS } from './tab-config';

import { useI18n } from '@/i18n';
import { useTheme } from '@/ui/theme';

/**
 * 底部四个 tab（原生）—— 顺序由用户 2026-10-04 定死：
 *
 *   **练习 · 讲解 · 变位表 · 我的**
 *
 * 顺序、路由名、文案键、图标名全部来自 `tab-config.ts`（web 版共用同一张表），
 * 这里只负责把它们翻译成 `NativeTabs.Trigger` 节点，**不要再往这里塞第五个 tab
 * 的字面量** —— 加 tab 请改那张表。
 *
 * ⚠️ **NativeTabs 只吃图片资源，不吃 `lucide-react-native` 的组件** ——
 * 那四张 PNG 是 `scripts/gen-tab-icons.mjs` 把 Lucide 的矢量路径栅格化出来的
 * （1x/2x/3x 三档），要换图标请重跑脚本，别手工塞图。
 *
 * 标签文案走 i18n（曾经硬编码中文，导致英文系统下底栏是中文、内容是英文）。
 *
 * ⚠️ 深色（用户 2026-10-06 修）：这里**曾经**读 Expo 模板残留的
 * `constants/theme.ts:Colors`，它是按 `useColorScheme()` 直接取色的 ——
 * 于是设置里选了深色、但手机系统还是浅色时，底栏照样白着；而且那套色值
 * （`#ffffff` / `#000000`）根本不是我们的调色板，跟页面底色对不上。
 * 现在一律走 `useTheme()`，与页面共用同一套令牌、同一个 `themeMode` 口径。
 */
export default function AppTabs() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <NativeTabs
      backgroundColor={theme.color.card}
      indicatorColor={theme.color.tag}
      badgeBackgroundColor={theme.color.bad}
      iconColor={{ default: theme.color.sub, selected: theme.color.accent }}
      labelStyle={{
        default: { color: theme.color.sub },
        selected: { color: theme.color.accent },
      }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(tab.labelKey)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon src={TAB_ICONS[tab.icon]} renderingMode="template" />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
