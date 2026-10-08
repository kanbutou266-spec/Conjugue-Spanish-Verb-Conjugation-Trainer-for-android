import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme, type Theme } from '@/ui/theme';

/**
 * 小标签 —— 对应网页 `.tag`：圆角 6、padding 1/7、字号 12，
 * 五个色档（默认灰底 / acc 主色 / ok / warn / bad）。
 * 变位表与讲解页拿它标「不规则」「A1」「高频」这类信息。
 */
export type TagTone = 'plain' | 'acc' | 'ok' | 'warn' | 'bad';

export interface TagProps {
  children: string;
  tone?: TagTone;
  testID?: string;
  /**
   * 字号（默认 12，网页 .tag 口径）。作答页顶部的模式徽标传 15 ——
   * 那一行的信息只有它自己，小了不够醒目（用户 2026-10-03「字大一些」）。
   * 字号变大时内边距同步放宽一点，比例才不至于失调。
   */
  size?: number;
}

export function Tag({ children, tone = 'plain', testID, size }: TagProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const t = makeTones(theme)[tone];
  const big = (size ?? 12) > 12;
  return (
    <Text
      testID={testID}
      numberOfLines={1}
      style={[
        styles.tag,
        big ? { fontSize: size, paddingVertical: 2.5, paddingHorizontal: 10 } : null,
        { backgroundColor: t.bg, color: t.ink },
      ]}
    >
      {children}
    </Text>
  );
}

const makeTones = (theme: Theme): Record<TagTone, { bg: string; ink: string }> => ({
  plain: { bg: theme.color.tag, ink: theme.color.bodyInk },
  acc: { bg: theme.color.accentSoft, ink: theme.color.hiInk },
  ok: { bg: theme.color.okSoft, ink: theme.color.ok },
  warn: { bg: theme.color.warnSoft, ink: theme.color.warn },
  bad: { bg: theme.color.badSoft, ink: theme.color.bad },
});

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    tag: {
      borderRadius: 6,
      paddingVertical: 1,
      paddingHorizontal: 7,
      fontSize: 12,
      alignSelf: 'flex-start',
      overflow: 'hidden',
    },
  });
