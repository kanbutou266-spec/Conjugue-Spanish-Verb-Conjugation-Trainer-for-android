import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MODES, modeDesc, modeName, modeShort } from '@/data/modes';
import { Icon } from '@/ui/Icon';
import { theme as defaultTheme, useTheme, type Theme } from '@/ui/theme';

import type { Lang, ModeKey } from '@/data/types';

/**
 * 练习模式选择器 —— 四个按钮**排成一行**，**图标在字上方**、字更小。
 *
 * 这是对方案 §3.1 里「横向滚动 ChipRow（保留图标）」的一次改版（2026-10-02 用户定稿）：
 * 原先沿用网页的 `.chip`（图标在左、文字 13px），在 360dp 的窄屏上四个 chip 一定会
 * 折成两行（"辨认模式/复现模式" 一行、"转换模式/平移模式" 一行），既占高度、
 * 又让 4 个选项看起来像 2 组。改成「等宽四格 + 图标在上」之后：
 *   · 恒占一行 → 高度固定 60dp，题干不会被推来推去；
 *   · 图标是主要识别线索（网页版就一直保留图标），文字退成小标签；
 *   · 每格 `flex: 1` 等宽 → 4 个选项视觉上等价，没有"谁更长"的暗示。
 *
 * 文字用 `modeShort()`（辨认 / 复现 / 转换 / 平移）而不是全名：
 * 4 格每格只有约 75dp，全名「辨认模式」+ 英文 "Tense shift" 会挤到换行。
 * 完整名不会丢 —— 作答页顶部有徽标；首页那行只给一句话规则（`modeDesc`），
 * 不再把模式名重复一遍（用户 2026-10-03）。
 *
 * 配色不做成 `Chip` 的变体：`Chip` 是药丸、单行、内容自适应宽，
 * 这里是圆角方块、两行、等宽 —— 共用一套配色函数反而互相牵制。
 * 但**按下态必须查表算**（`modeBtnColors`）：RNTL 驱动不了 `Pressable` 的按下态，
 * 写成纯函数才能单测。
 */
export interface ModeSelectorProps {
  /** 当前选中的模式（单选） */
  value: ModeKey;
  onChange: (k: ModeKey) => void;
  lang?: Lang;
  testID?: string;
}

export interface ModeBtnColors {
  bg: string;
  border: string;
  /** 文字色 */
  ink: string;
  /** 图标色 */
  icon: string;
  weight: '600' | '700';
}

/**
 * 按钮配色 —— 纯函数，优先级 `selected` > `pressed` > 默认。
 * 选中态按下不变色（选中就是选中，不需要再给一次反馈）。
 */
export function modeBtnColors(
  selected: boolean,
  pressed = false,
  theme: Theme = defaultTheme
): ModeBtnColors {
  if (selected) {
    return { bg: theme.color.accent, border: theme.color.accent, ink: '#ffffff', icon: '#ffffff', weight: '700' };
  }
  if (pressed) {
    return {
      bg: theme.press.soft,
      border: theme.press.softBorder,
      ink: theme.color.ink,
      icon: theme.color.sub,
      weight: '600',
    };
  }
  return { bg: theme.color.card, border: theme.color.line, ink: theme.color.ink, icon: theme.color.sub, weight: '600' };
}

/** 图标与文字的字面尺寸（几何值集中在这里，测试直接断言它） */
export const MODE_BTN = {
  /** 图标边长 */
  icon: 19,
  /** 文字字号 —— 比 `.chip` 的 13 更小，这是"字小一些"的落点 */
  label: 11.5,
  /** 图标与文字之间的竖距 */
  gap: 4,
  /** 按钮内边距 / 最小高度 */
  padV: 8,
  padH: 2,
  minHeight: 60,
  radius: 12,
} as const;

export function ModeSelector({ value, onChange, lang = 'zh', testID }: ModeSelectorProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row} testID={testID} accessibilityRole="radiogroup">
      {MODES.map((m) => {
        const on = m.k === value;
        const c = modeBtnColors(on, false, theme);
        return (
          <Pressable
            key={m.k}
            testID={testID ? `${testID}-${m.k}` : undefined}
            onPress={() => {
              if (!on) onChange(m.k);
            }}
            accessibilityRole="radio"
            accessibilityLabel={modeName(m.k, lang)}
            accessibilityHint={modeDesc(m.k, lang)}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => {
              const s = modeBtnColors(on, pressed, theme);
              return [styles.btn, { backgroundColor: s.bg, borderColor: s.border }];
            }}
          >
            <Icon name={m.icon} size={MODE_BTN.icon} color={c.icon} />
            <Text
              numberOfLines={1}
              style={{ fontSize: MODE_BTN.label, fontWeight: c.weight, color: c.ink }}
            >
              {modeShort(m.k, lang)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 6 },
    btn: {
      flex: 1,
      minHeight: MODE_BTN.minHeight,
      // 图标在上、文字在下 —— RN 的默认值就是 column，但这里**写出来**：
      // 它是"图标在字上方"这条要求的落点，也是测试断言的对象，别指望默认值
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: MODE_BTN.gap,
      paddingVertical: MODE_BTN.padV,
      paddingHorizontal: MODE_BTN.padH,
      borderWidth: 1,
      borderRadius: MODE_BTN.radius,
    },
  });

export default ModeSelector;
