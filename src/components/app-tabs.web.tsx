import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { ExternalLink } from './external-link';
import { TABS } from './tab-config';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { useTheme } from '@/ui/theme';

/**
 * 底部四个 tab（web 构建）—— 顺序与文案同样来自 `tab-config.ts`，
 * 与原生版共一张表（以前这里硬编码「练习 / 讲解 / 变位表 / 我的」，
 * 英文系统下会跟内容语言不一致）。
 *
 * ⚠️ 深色（用户 2026-10-06 修）：以前用的是 Expo 模板残留的 `ThemedView` /
 * `ThemedText` + `constants/theme.ts:Colors`，那套色值只认 `useColorScheme()`、
 * 不认设置里的 `themeMode`，而且不是我们的调色板（`#ffffff` / `#000000`）。
 * 现在一律走 `useTheme()`，和原生版、和页面共用同一套令牌。
 */
export default function AppTabs() {
  const { t } = useI18n();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton>{t(tab.labelKey)}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabButtonView,
        { backgroundColor: isFocused ? theme.color.accentSoft : 'transparent' },
        pressed ? styles.pressed : null,
      ]}>
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? theme.color.accent : theme.color.sub },
          isFocused ? styles.tabLabelFocused : null,
        ]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View {...props} style={styles.tabListContainer}>
      <View
        style={[
          styles.innerContainer,
          { backgroundColor: theme.color.card, borderColor: theme.color.line },
        ]}>
        <Text style={[styles.brandText, { color: theme.color.ink }]}>{t('title')}</Text>

        {props.children}

        <ExternalLink href="https://github.com/kanbutou266-spec/Spanish-Verb-Conjugation-Trainer" asChild>
          <Pressable style={styles.externalPressable}>
            <Text style={[styles.linkText, { color: theme.color.accent }]}>GitHub</Text>
            {/*
              ⚠️ 2026-10-08：这里原本是 `expo-symbols` 的 `SymbolView`
              （`name={{ ios: 'arrow.up.right.square', web: 'link' }}`）。但
              `expo-symbols` 在安卓侧会 `require` 一个 966KB 的 Material Symbols
              字体（`@expo-google-fonts/material-symbols`），而它在这里只是画一个
              小箭头 —— 字体文件被 Metro 当成 asset 打进 APK 的 `res/raw/`，
              白白占了 400 多 KB。改用全站统一的 lucide 图标，web 版视觉一致。
            */}
            <Icon name="arrow-up-right" size={12} color={theme.color.accent} />
          </Pressable>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
    fontSize: 15,
    fontWeight: '700',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  tabLabel: {
    fontSize: 14,
  },
  tabLabelFocused: {
    fontWeight: '600',
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
