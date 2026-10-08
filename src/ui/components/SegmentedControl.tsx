import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/ui/theme';

/**
 * 分段控件 —— 对应网页 `.seg`（「手写 / 选择」二选一，`#m-seg`）。
 *
 * 网页：外框 1px 线 + 圆角 11 + 白底，段与段之间一条竖分隔线，
 * 选中段用品牌主色铺满白字。RN 里用 `View` 包 `Pressable` 而不是
 * `overflow:hidden`（安卓上 `overflow` 对圆角裁剪不稳）。
 */
export interface SegOption<T extends string> {
  k: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegOption<T>[];
  value: T;
  onChange: (k: T) => void;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.wrap} testID={testID} accessibilityRole="radiogroup">
      {options.map((o, i) => {
        const on = o.k === value;
        return (
          <Pressable
            key={o.k}
            testID={testID ? `${testID}-${o.k}` : undefined}
            onPress={() => onChange(o.k)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.seg,
              i > 0 ? styles.divider : null,
              on ? styles.onSeg : null,
              pressed && !on ? styles.pressed : null,
            ]}          >
            <Text numberOfLines={1} style={[styles.label, on ? styles.onLabel : null]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: theme.color.line,
      borderRadius: 11,
      backgroundColor: theme.color.card,
      overflow: 'hidden',
    },
    seg: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    divider: { borderLeftWidth: 1, borderLeftColor: theme.color.line },
    onSeg: { backgroundColor: theme.color.accent },
    pressed: { backgroundColor: theme.press.soft },
    // 网页 `.seg button` 是 13.5px —— 介于 font.sm(13) 与 font.md(15) 之间，照抄
    label: { fontSize: 13.5, fontWeight: '600', color: theme.color.sub },
    onLabel: { color: '#ffffff' },
  });
