import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { personLabel } from '@/data/persons';
import { useTheme, type Theme } from '@/ui/theme';
import { ConjText } from './ConjText';

import type { HlRow, PersonIdx, TenseKey } from '@/data/types';

/**
 * 六人称对照网格（3 列 × 2 行）—— 对应网页 `.pgrid` / `.prow` / `.pcell`。
 *
 * 网页几何：`.prow{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}`、
 * `.pcell{border:1px solid;border-radius:9px;padding:4px 9px;background:#fff}`、
 * 人称标签 10.5px 灰字、形式 15px（窄屏 13.5px）。这里逐值照抄。
 *
 * **「不裂词、长词缩字号」这件事由 `ConjText` 负责**（网页是同一条规则，
 * 见 `app_template.html` 第 137-142 行的注释与 1497-1501 行的 JS：
 * `val.length>=13` 降一档、`>=17` 再降一档）。RN 这版不再按"整串字数"分档，
 * 而是按**最长那个词的实测宽度**连续缩 —— 因为手机宽度不固定，
 * 固定档位在 360dp 上仍然会溢出（见 `ui/fitText.ts`）。
 *
 * 三列表格在 360dp 上每格只有约 95dp，是本应用最窄的变位展示场景，
 * 所以 `baseSize` 取 15、`minSize` 取 10（网页最窄档是 11.5，但它那格有 101dp）。
 */
export interface PersonGridProps {
  /** 该时态 6 个人称的形式（`v.t[k].split('|')`）；缺项传空串 */
  forms: string[];
  /** 该时态的 6 位着色码 */
  code?: string | null;
  /** 该时态 6 个人称的变化区间 */
  hl?: HlRow | null;
  /** 决定人称标签怎么念（命令式没有 yo，用 usted / ustedes） */
  tense: TenseKey;
  /** 高亮的人称（本题答案，或从变位表跳进来时要标出来的那一格） */
  active?: PersonIdx | null;
  /** 点某一格的回调；不传则整格不可点（只读展示） */
  onPress?: (i: PersonIdx) => void;
  baseSize?: number;
  minSize?: number;
  testID?: string;
}

export function PersonGrid({
  forms,
  code,
  hl,
  tense,
  active = null,
  onPress,
  baseSize = 15,
  minSize = 10,
  testID,
}: PersonGridProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const cell = (i: PersonIdx) => {
    const val = String((forms && forms[i]) || '');
    const hi = active === i;
    const body = (
      <>
        <Text numberOfLines={2} style={styles.pl}>
          {personLabel(i, tense)}
        </Text>
        {val ? (
          <ConjText
            form={val}
            code={code}
            hl={hl}
            person={i}
            baseSize={baseSize}
            minSize={minSize}
            weight="600"
            align="flex-start"
            testID={testID ? `${testID}-f${i}` : undefined}
          />
        ) : (
          <Text style={styles.dash}>—</Text>
        )}
      </>
    );

    if (!onPress || !val) {
      return (
        <View
          key={i}
          testID={testID ? `${testID}-${i}` : undefined}
          style={[styles.cell, hi ? styles.hi : null, val ? null : styles.empty]}
        >
          {body}
        </View>
      );
    }
    return (
      <Pressable
        key={i}
        testID={`${testID}-${i}`}
        onPress={() => onPress(i)}
        accessibilityRole="button"
        accessibilityLabel={personLabel(i, tense)}
        accessibilityState={{ selected: hi }}
        style={[styles.cell, hi ? styles.hi : null]}
      >
        {body}
      </Pressable>
    );
  };

  return (
    <View style={styles.grid} testID={testID}>
      <View style={styles.row}>{[0, 1, 2].map((i) => cell(i as PersonIdx))}</View>
      <View style={styles.row}>{[3, 4, 5].map((i) => cell(i as PersonIdx))}</View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: { marginTop: 10, gap: 4 },
    row: { flexDirection: 'row', gap: 4 },
    cell: {
      flex: 1,
      minWidth: 0,
      borderWidth: 1,
      borderColor: theme.color.line,
      borderRadius: 9,
      paddingVertical: 4,
      paddingHorizontal: 9,
      backgroundColor: theme.color.card,
      gap: 2,
    },
    /** 本题那一格（网页 `.pcell.hi`） */
    hi: { backgroundColor: theme.color.accentSoft, borderColor: theme.color.accent },
    /** 该时态里不存在的人称（命令式的 yo） */
    empty: { opacity: 0.45 },
    pl: { fontSize: 10.5, color: theme.color.sub, lineHeight: 14 },
    dash: { fontSize: 15, color: theme.color.sub, lineHeight: 20 },
  });

export default PersonGrid;
