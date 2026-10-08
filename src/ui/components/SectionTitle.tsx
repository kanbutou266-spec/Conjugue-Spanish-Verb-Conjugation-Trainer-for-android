import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/ui/theme';

import type { ReactNode } from 'react';

/**
 * 分节标签 —— 对应网页 `.sec`（`1 · 词库` / `2 · 时态` / `3 · 其它`）。
 *
 * 网页那条约 3px 的主色竖条是用 `linear-gradient(...) left top/3px 100% no-repeat`
 * 画的背景，RN 里改成一个真正的 `<View>` 色块 —— 更直白，也不会因为
 * 文字折行而拉伸错位。
 *
 * `right` 是行尾的一小块补充信息（如统计页标题右侧的「最多 20 条」）——
 * 靠 `marginLeft:'auto'` 顶到最右，字号小一档、不加粗，不与标题抢视线。
 */
export interface SectionTitleProps {
  children: string;
  testID?: string;
  /** 行尾补充信息（可选） */
  right?: ReactNode;
}

export function SectionTitle({ children, testID, right }: SectionTitleProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.bar} />
      <Text style={styles.txt}>{children}</Text>
      {right != null ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 8 },
    bar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: theme.color.accent },
    txt: { fontSize: 12.5, fontWeight: '700', color: theme.color.bodyInk2, letterSpacing: 0.8 },
    right: { marginLeft: 'auto' },
  });
