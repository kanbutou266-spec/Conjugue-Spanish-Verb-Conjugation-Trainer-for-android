import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/Icon';
import { useTheme, type Theme } from '@/ui/theme';

import type { ReactNode } from 'react';

/**
 * 推入式页面的顶栏 —— 「圆形退键 + 标题 + 右侧节点」。
 *
 * 样式照抄变位表的顶栏（`(tabs)/conj-table.tsx` 的 `topbar` / `tBackBtn`）：
 * 退键是 38×38 的白底圆形胶囊，标题 15px/700，右侧内容靠 `marginLeft:'auto'` 顶到最右。
 * 抽成组件是因为「我的」下挂的三个页（统计 / 设置 / 关于）和讲解详情页都要它 ——
 * 四份复制迟早会漂。
 *
 * `onBack` 不传就不画退键（tab 根页面用：底栏本身就是出口）。
 */
export interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  /** 右侧内容（版本号、页码、计数……） */
  right?: ReactNode;
  backLabel?: string;
  testID?: string;
}

export function PageHeader({ title, onBack, right, backLabel, testID }: PageHeaderProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.topbar} testID={testID}>
      {onBack ? (
        <Pressable
          testID="page-back"
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Icon name="arrow-left" size={20} color={theme.color.ink} />
        </Pressable>
      ) : null}
      <Text style={styles.ttl}>{title}</Text>
      <View style={styles.spacer} />
      {right ?? null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 8,
      backgroundColor: theme.color.bg,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.card,
      borderWidth: 1,
      borderColor: theme.color.line,
    },
    ttl: { fontSize: 15, fontWeight: '700', color: theme.color.ink },
    spacer: { flex: 1 },
  });
