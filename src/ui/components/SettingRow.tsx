import { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/ui/theme';

/**
 * 设置行 —— 「标题 + 说明 + 开关」。
 *
 * 开关直接用系统 `Switch`（方案 §6 的约定：`.sw` 那个自绘开关不必复刻，
 * 系统控件的无障碍与手势都更稳），只把「开」的颜色对齐品牌主色。
 */
export interface SettingRowProps {
  title: string;
  /** 标题下面那行小字说明（网页 `.hint`，13px 次级色） */
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  /** 该行在当前语境下不适用：整行降透明度、开关锁死 */
  off?: boolean;
  testID?: string;
}

export function SettingRow({ title, hint, value, onChange, off = false, testID }: SettingRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={[styles.row, off ? styles.off : null]} testID={testID}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        testID={testID ? `${testID}-sw` : undefined}
        value={off ? false : value}
        onValueChange={off ? undefined : onChange}
        disabled={off}
        accessibilityLabel={title}
        trackColor={{ false: theme.color.line2, true: theme.color.accent }}
        thumbColor="#ffffff"
        ios_backgroundColor={theme.color.line2}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 8,
    },
    text: { flex: 1 },
    title: { fontSize: theme.font.md, color: theme.color.ink, fontWeight: '500' },
    hint: { fontSize: theme.font.sm, color: theme.color.sub, lineHeight: 20, marginTop: 2 },
    off: { opacity: 0.55 },
  });
