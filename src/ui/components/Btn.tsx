import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { theme as defaultTheme, useTheme, type Theme } from '@/ui/theme';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * 按钮 —— 对应网页 `.btn` / `.btn.primary` / `.btn.ghost` / `.btn.wide`。
 *
 * 几何值照抄网页：圆角 11、padding 10/16（primary 是 11/22）、font 15/600、
 * gap 6、`disabled` 只降透明度（.4）。`wide` 撑满整行。
 */
export type BtnVariant = 'default' | 'primary' | 'ghost';

export interface BtnProps {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  /** 撑满父容器宽度（网页 `.btn.wide`） */
  wide?: boolean;
  icon?: ReactNode;
  /** 画在文字**右边**的图标（`icon` 画在左边）——「下一题 ›」与「‹ 上一题」对称 */
  iconAfter?: ReactNode;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const makeVariants = (
  theme: Theme
): Record<BtnVariant, { bg: string; border: string; ink: string; weight: '500' | '600' }> => ({
  default: { bg: theme.color.card, border: theme.color.line, ink: theme.color.ink, weight: '600' },
  primary: { bg: theme.color.accent, border: theme.color.accent, ink: '#ffffff', weight: '600' },
  ghost: { bg: 'transparent', border: 'transparent', ink: theme.color.sub, weight: '500' },
});

/** 按下态（网页 `.btn:hover` / `.btn.primary:hover` / `.btn.ghost:hover`），按主题现算 */
export const makeBtnPressed = (theme: Theme): Record<BtnVariant, ViewStyle> => ({
  default: { backgroundColor: theme.press.soft, borderColor: theme.press.softBorder },
  primary: { backgroundColor: theme.press.primary, borderColor: theme.press.primary },
  ghost: { backgroundColor: theme.press.ghost },
});

/** 亮色快照（测试与非组件环境用）；组件里请走 `makeBtnPressed(useTheme())` */
export const BTN_PRESSED: Record<BtnVariant, ViewStyle> = makeBtnPressed(defaultTheme);

export function Btn({
  label,
  onPress,
  variant = 'default',
  disabled = false,
  wide = false,
  icon,
  iconAfter,
  accessibilityHint,
  style,
  testID,
}: BtnProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const variants = useMemo(() => makeVariants(theme), [theme]);
  const pressedColors = useMemo(() => makeBtnPressed(theme), [theme]);
  const v = variants[variant];
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' ? styles.primary : styles.defaultPad,
        wide ? styles.wide : null,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && !disabled ? pressedColors[variant] : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {icon}
      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: v.weight, color: v.ink }}>
        {label}
      </Text>
      {iconAfter}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    btn: {
      borderWidth: 1,
      borderRadius: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 40,
    },
    defaultPad: { paddingVertical: 10, paddingHorizontal: 16 },
    primary: { paddingVertical: 11, paddingHorizontal: 22 },
    wide: { width: '100%' },
    disabled: { opacity: 0.4 },
  });
