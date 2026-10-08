import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { TENSE_GROUPS, TENSES } from '@/data/tenses';
import { useI18n } from '@/i18n';
import { Chip } from './Chip';
import { useTheme, type Theme } from '@/ui/theme';

import type { GroupKey, Lang, Tense, TenseKey } from '@/data/types';

/**
 * 时态勾选网格 —— 对应网页的 `.tgs` / `.tgroup` / `.trow`。
 *
 * 结构与网页一致：**每个语式一张卡**（陈述 / 条件 / 虚拟 / 命令），
 * 卡内分两层 —— 上一行简单时态、下一行复合时态。层比左右两列省横向空间，
 * 360dp 的手机上尤其明显（左右两列时"虚拟式过去未完成时"这种长标签会溢出）。
 *
 * 语式卡片的左色条用该语式的主题色（`mood[g].main`），和网页 `.tgroup` 的
 * `border-left:4px solid var(--g)` 一致；chip 用 `tint`（浅底浅边深字）。
 *
 * **列数**：网页是 750px 容器里的 2×2 固定网格；手机装不下两列
 * （每列只剩约 142dp，"虚拟式过去未完成时" + 计数 + 全选/清空会挤爆），
 * 所以按窗口宽度自适应：≥700dp 才排两列，手机恒为一列（方案 §3.1 的
 * "2 列自适应（窄屏退 1 列）"）。
 */
export interface TenseGridProps {
  /** 已选时态 */
  selected: TenseKey[];
  onToggle: (k: TenseKey) => void;
  lang?: Lang;
  /** 只展示这些时态（如「该动词真有形式的时态」）；不传 = 全部 15 个 */
  only?: TenseKey[];
  /** 给了才在组标题右侧画「全选 / 清空」（自定义槽设置页用） */
  onGroupAll?: (g: GroupKey) => void;
  onGroupNone?: (g: GroupKey) => void;
  /** 两列阈值（dp）；默认 700 */
  twoColMinWidth?: number;
  testID?: string;
}

export function TenseGrid({
  selected,
  onToggle,
  lang: langProp,
  only,
  onGroupAll,
  onGroupNone,
  twoColMinWidth = 700,
  testID,
}: TenseGridProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const { lang: langState } = useI18n();
  const lang = langProp ?? langState;
  const mood = theme.mood;

  const cols: 1 | 2 = width >= twoColMinWidth ? 2 : 1;
  const has = (k: TenseKey): boolean => !only || only.indexOf(k) >= 0;

  return (
    <View style={styles.wrap} testID={testID}>
      {TENSE_GROUPS.map((g) => {
        const all = TENSES.filter((t) => t.g === g.k);
        const list = all.filter((t) => has(t.k));
        if (!list.length) return null;
        const picked = all.filter((t) => selected.indexOf(t.k) >= 0).length;
        const simple = list.filter((t) => !t.cp);
        const compound = list.filter((t) => !!t.cp);

        return (
          <View
            key={g.k}
            testID={testID ? `${testID}-${g.k}` : undefined}
            style={[
              styles.card,
              cols === 2 ? styles.half : null,
              { borderLeftColor: mood[g.k].main },
            ]}
          >
            <View style={styles.head}>
              <Text style={[styles.gname, { color: mood[g.k].ink }]}>
                {lang === 'en' ? g.en : g.zh}
              </Text>
              <Text style={styles.ges}>{g.es}</Text>
              <Text
                style={[
                  styles.n,
                  picked === all.length ? { backgroundColor: mood[g.k].soft, color: mood[g.k].ink, fontWeight: '600' } : null,
                ]}
              >
                {picked}
                {only ? `/${list.length}` : `/${all.length}`}
              </Text>
              {onGroupAll || onGroupNone ? (
                <View style={styles.acts}>
                  {onGroupAll ? (
                    <Pressable
                      testID={testID ? `${testID}-${g.k}-all` : undefined}
                      onPress={() => onGroupAll(g.k)}
                      accessibilityRole="button"
                      accessibilityLabel={lang === 'en' ? 'Select all' : '全选'}
                      hitSlop={6}
                    >
                      <Text style={styles.act}>{lang === 'en' ? 'all' : '全选'}</Text>
                    </Pressable>
                  ) : null}
                  {onGroupNone ? (
                    <Pressable
                      testID={testID ? `${testID}-${g.k}-none` : undefined}
                      onPress={() => onGroupNone(g.k)}
                      accessibilityRole="button"
                      accessibilityLabel={lang === 'en' ? 'Clear' : '清空'}
                      hitSlop={6}
                    >
                      <Text style={styles.act}>{lang === 'en' ? 'none' : '清空'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <TenseRow
              label={lang === 'en' ? 'simple' : '简单'}
              list={simple}
              selected={selected}
              onToggle={onToggle}
              lang={lang}
              g={g.k}
              testID={testID}
            />
            <TenseRow
              label={lang === 'en' ? 'compound' : '复合'}
              list={compound}
              selected={selected}
              onToggle={onToggle}
              lang={lang}
              g={g.k}
              testID={testID}
              spaced
            />
          </View>
        );
      })}
    </View>
  );
}

function TenseRow({
  label,
  list,
  selected,
  onToggle,
  lang,
  g,
  testID,
  spaced = false,
}: {
  label: string;
  list: Tense[];
  selected: TenseKey[];
  onToggle: (k: TenseKey) => void;
  lang: Lang;
  g: GroupKey;
  testID?: string;
  spaced?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const mood = theme.mood;
  return (
    <View style={[styles.trow, spaced ? styles.trowGap : null]}>
      <Text style={styles.th} numberOfLines={1}>{label}</Text>
      <View style={styles.chips}>
        {list.length ? (
          list.map((t) => (
            <Chip
              key={t.k}
              testID={testID ? `${testID}-${t.k}` : undefined}
              size="sm"
              label={lang === 'en' ? t.en : t.zh}
              tint={mood[g]}
              selected={selected.indexOf(t.k) >= 0}
              onPress={() => onToggle(t.k)}
            />
          ))
        ) : (
          <Text style={styles.none}>{lang === 'en' ? 'none' : '无'}</Text>
        )}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 9 },
    card: {
      borderWidth: 1,
      borderColor: theme.color.line,
      borderLeftWidth: 4,
      borderRadius: 12,
      paddingTop: 9,
      paddingHorizontal: 11,
      paddingBottom: 10,
      backgroundColor: theme.color.raise,
      minWidth: 0,
    },
    half: { flexBasis: '48%', flexGrow: 1 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 7 },
    gname: { fontSize: 13.5, fontWeight: '700', letterSpacing: 0.2 },
    ges: { fontSize: 11.5, color: theme.color.sub },
    n: {
      fontSize: 11.5,
      color: theme.color.sub,
      backgroundColor: theme.color.tag,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 1,
      overflow: 'hidden',
      fontVariant: ['tabular-nums'],
    },
    acts: { marginLeft: 'auto', flexDirection: 'row', gap: 2, alignItems: 'center' },
    act: { fontSize: 11.5, color: theme.color.sub, paddingHorizontal: 6, paddingVertical: 2 },
    trow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
    trowGap: { marginTop: 6 },
    /*
     * `th` 对应网页 `.trow .th`：`flex:none; min-width:26px`。
     * 网页用的是 **min-width**（可被内容撑开），不是固定 width。
     * 之前在 RN 里写成 `width:26`，导致英文的 "compound"（8 字符 ≈ 44dp）
     * 在 26dp 的框里折行，把 chips 列挤窄 —— 用户 2026-10-05 报的
     * 「custom 里 simple / compound 词内换行，很丑」就是这一处。
     * 改成 `minWidth`（配合 flexShrink:0 不被压）+ `numberOfLines={1}` 保底不折行。
     */
    th: { minWidth: 26, flexGrow: 0, flexShrink: 0, fontSize: 10.5, color: theme.color.sub, paddingTop: 6, textAlign: 'right' },
    chips: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    none: { fontSize: 12, color: theme.color.sub, opacity: 0.5, lineHeight: 22 },
  });

export default TenseGrid;
