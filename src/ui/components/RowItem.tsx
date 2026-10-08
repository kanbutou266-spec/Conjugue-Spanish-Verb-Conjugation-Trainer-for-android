import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/ui/Icon';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * 通用列表行 —— 「我的」入口页、关于页、统计页的榜单一律用它。
 *
 * 一行 = 图标 +（标题 + 可选副标题）+ 右侧指示：
 *   · `onPress` 有 → 右侧画 `›`（可点，按下有浅底）
 *   · `external` → 右侧画 `↗`（外链，网页那个 ICO_OUT）
 *   · 都没有 → 右侧留空（纯信息行，关于页的「声明」几行就是这样）
 *
 * 行与行之间的分隔线画在**行底部**、只占右边一段（左侧给图标让位），
 * 这是手机列表的常规做法，比整行通铺的线看着轻。
 */
export interface RowItemProps {
  /** 图标名（`ui/Icon.tsx` 的表里登记过的） */
  icon?: string;
  /** 用一个字/一个符号当图标（讲解目录的 ①②③ 圆标走这里，对应网页 `.gnum`） */
  badge?: string;
  /** 图标底色（不传就用主题的 tag 灰底） */
  iconBg?: string;
  iconColor?: string;
  title: string;
  sub?: string;
  onPress?: () => void;
  external?: boolean;
  /** 最后一行不画分隔线 */
  last?: boolean;
  testID?: string;
}

export function RowItem({
  icon,
  badge,
  iconBg,
  iconColor,
  title,
  sub,
  onPress,
  external = false,
  last = false,
  testID,
}: RowItemProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const inner = (
    <>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{badge}</Text>
        </View>
      ) : icon ? (
        <View style={[styles.iconBox, iconBg ? { backgroundColor: iconBg } : null]}>
          <Icon name={icon} size={18} color={iconColor ?? theme.color.accent} />
        </View>
      ) : null}
      <View style={styles.txt}>
        <Text style={styles.ttl}>{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {external ? (
        <Icon name="arrow-up-right" size={16} color={theme.color.sub} />
      ) : onPress ? (
        <Icon name="chevron-right" size={18} color={theme.color.sub} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, last ? null : styles.sep]} testID={testID}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={external ? undefined : undefined}
      style={({ pressed }) => [styles.row, last ? null : styles.sep, pressed ? styles.pressed : null]}
    >
      {inner}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 2,
    },
    sep: { borderBottomWidth: 1, borderBottomColor: theme.color.line },
    pressed: { backgroundColor: theme.press.soft },
    iconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.tag,
    },
    /** 网页 `.gnum`：主色圆标 + 白字 */
    badge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.accent,
    },
    badgeTxt: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    txt: { flex: 1, gap: 3 },
    ttl: { fontSize: 14.5, fontWeight: '600', color: theme.color.ink },
    sub: { fontSize: 12.5, color: theme.color.sub, lineHeight: 17 },
  });
