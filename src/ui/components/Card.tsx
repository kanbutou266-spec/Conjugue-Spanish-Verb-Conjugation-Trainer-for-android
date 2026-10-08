import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, type Theme } from '@/ui/theme';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * 卡片 —— 对应网页 `.card`：白底、1px 线、圆角 14、内边距 16/16/14、
 * 下外边距 14、双层阴影（RN 取近景那层，见 `theme.cardShadow`）。
 *
 * RN 里页面本身就是可滚动的，所以把 `.wrap` 的左右边距（18px）也并进来，
 * 免得每张卡片都要自己写 margin —— 需要贴边的卡片传 `flush`。
 */
export interface CardProps {
  children?: ReactNode;
  /** 去掉左右外边距（用于放进已有内边距的容器） */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({ children, flush = false, style, testID }: CardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View testID={testID} style={[styles.card, flush ? null : styles.gutter, style]}>
      {children}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.card,
      borderWidth: 1,
      borderColor: theme.color.line,
      borderRadius: theme.radius.lg,
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 14,
      marginBottom: 14,
      ...theme.cardShadow,
    },
    gutter: { marginHorizontal: 18 },
  });
