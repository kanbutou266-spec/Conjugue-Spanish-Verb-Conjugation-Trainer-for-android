import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { theme as defaultTheme, useTheme, type Theme } from '@/ui/theme';

import type { ReactNode } from 'react';
import type { MoodPalette } from '@/ui/theme';

/**
 * 圆角药丸按钮 —— 对应网页的 `.chip` / `.chip.sm`。
 *
 * 几何值照抄网页（padding 7/14 或 5/11、字号 14/13、gap 5、1px 边框、999 圆角）：
 *  · `selected` 用「语式主色（或品牌主色）」铺满 + 白字（网页 `[aria-pressed=true]`）
 *  · `tint`    用所属语式的浅底/浅边/深字（网页 `.chip.tint`，时态 chip 用）
 *  · `off`     置灰但保留形状 —— 「当前模式用不上的选项」要让人看得见、点不动
 *  · `disabled` 只降透明度（网页 `:disabled` opacity .35）
 *
 * 触摸目标：网页 `sm` 档只有 33px 高，低于安卓建议的 40px，
 * 于是给它加了上下各 4px 的 hitSlop（行间距是 8px，正好不重叠）。
 */
export interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  /** 置灰：保留形状与信息，但不给点、去悬停高亮 */
  off?: boolean;
  disabled?: boolean;
  size?: 'md' | 'sm';
  /** 时态 chip 的语式浅色底 */
  tint?: MoodPalette | null;
  icon?: ReactNode;
  /** 标签 chip 右侧那个淡色计数（网页 `<span style="opacity:.6">N</span>`） */
  count?: number | null;
  accessibilityHint?: string;
  testID?: string;
}

interface ChipColors {
  bg: string;
  border: string;
  ink: string;
  weight: '400' | '500' | '600';
}

/**
 * chip 的配色 —— 纯函数，优先级从高到低：
 *   `off`（置灰）> `selected`（铺满）> `pressed`（按下）> `tint`（语式浅色）> 默认卡片底。
 *
 * 网页是靠 CSS 优先级排出来的（`.chip.off` 在最后、`[aria-pressed=true]` 压过 `:hover`），
 * 这里把顺序写成显式判断，免得日后加状态时排错。
 */
export function chipColors(
  selected: boolean,
  off: boolean,
  tint?: MoodPalette | null,
  pressed = false,
  theme: Theme = defaultTheme
): ChipColors {
  if (off)
    return {
      bg: theme.color.tag,
      border: theme.color.line,
      ink: theme.color.muteInk,
      weight: '400',
    };
  if (selected) {
    const main = tint ? tint.main : theme.color.accent;
    return { bg: main, border: main, ink: '#ffffff', weight: '600' };
  }
  if (pressed) {
    return {
      bg: theme.press.soft,
      border: theme.press.softBorder,
      ink: theme.color.ink,
      weight: '500',
    };
  }
  if (tint) return { bg: tint.soft, border: tint.border, ink: tint.ink, weight: '500' };
  return { bg: theme.color.card, border: theme.color.line, ink: theme.color.ink, weight: '500' };
}

export function Chip({
  label,
  onPress,
  selected = false,
  off = false,
  disabled = false,
  size = 'md',
  tint = null,
  icon,
  count = null,
  accessibilityHint,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sm = size === 'sm';
  const c = chipColors(selected, off, tint, false, theme);
  const dead = disabled || off; // off 的 chip 不给点（网页 `.chip.off` 也一样）
  const fontSize = sm ? 13 : 14;

  return (
    <Pressable
      testID={testID}
      onPress={dead ? undefined : onPress}
      disabled={dead || !onPress}
      hitSlop={sm ? { top: 4, bottom: 4 } : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled: dead }}
      style={({ pressed }) => {
        // 按下时的配色也走同一个函数，保证「selected > pressed」的优先级只有一处定义
        const s = chipColors(selected, off, tint, pressed, theme);
        return [
          styles.chip,
          sm ? styles.sm : styles.md,
          { backgroundColor: s.bg, borderColor: s.border },
          disabled && !off ? styles.disabled : null,
        ];
      }}
    >
      {icon}
      <Text numberOfLines={1} style={{ fontSize, color: c.ink, fontWeight: c.weight }}>
        {label}
      </Text>
      {count !== null ? (
        <Text numberOfLines={1} style={{ fontSize: 12, opacity: 0.6, color: c.ink }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    md: { paddingVertical: 7, paddingHorizontal: 14 },
    sm: { paddingVertical: 5, paddingHorizontal: 11 },
    disabled: { opacity: 0.35 },
  });
