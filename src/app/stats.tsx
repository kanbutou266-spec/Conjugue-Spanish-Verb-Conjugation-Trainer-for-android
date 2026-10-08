import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MODES } from '@/data/modes';
import {
  HARDEST_SHOW,
  hardestVerbs,
  modeRows,
  statsSummary,
  tenseRows,
} from '@/data/stats';
import { T } from '@/data/tenses';
import { VERBS } from '@/data/verbs';
import { useI18n } from '@/i18n';
import { useStatsStore } from '@/store/stats';
import { Card } from '@/ui/components/Card';
import { PageHeader } from '@/ui/components/PageHeader';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { useTheme, type Theme } from '@/ui/theme';

import type { ModeKey, TenseKey } from '@/data/types';

/**
 * 学习统计（从「我的」推入）—— 对应网页 `#scr-stats` / `renderStats()`。
 *
 * 四段，顺序与网页一致：
 *   ① 四个大数字（答题 / 正确率 / 错误 / 练习过的动词）+ 正确率条
 *   ② 最容易错的动词（**最多 20 条**，先按错误率再按错误次数；标题右侧标出上限）
 *   ③ 各时态错误率
 *   ④ 各模式正确率
 *
 * ⚠️ 错题本（网页版第 ⑤ 段）在 RN 版**有意去掉**（用户 2026-10-05：
 * 「不用显示错题本」）—— 这一屏只保留"看了之后能改进练习策略"的聚合数据；
 * 逐条的错题明细在作答反馈里当场就给了，堆在统计页里只是噪音。
 * 数据本身仍然照记（`store/stats` 的 `wrong` 数组没动），导出 JSON 与网页版
 * 依然能互相导入。
 *
 * **排序规则不在这里**：`data/stats.ts` 已经导出 `hardestVerbs` / `tenseRows` /
 * `modeRows`，页面只管画（和网页 `renderStats` 的分工一致）。
 * 「数据管理」（导出 / 导入 / 清空）按方案 §3.6 放在**设置页**，这一屏只看数据。
 */
export default function StatsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const st = useStatsStore();

  const sum = statsSummary(st);
  const hardest = hardestVerbs(st);
  const tenses = tenseRows(st);
  const modes = modeRows(st);

  const meaningOf = (inf: string): string => {
    const v = VERBS.find((x) => x.i === inf);
    if (!v) return '';
    return lang === 'en' ? v.e || v.z : v.z;
  };
  const levelOf = (inf: string): string => VERBS.find((x) => x.i === inf)?.l ?? '';
  const tenseName = (k: TenseKey): string => {
    const x = T[k];
    return x ? (lang === 'en' ? x.en : x.zh) : String(k);
  };
  const tenseEs = (k: TenseKey): string => T[k]?.es ?? '';
  const modeName = (k: ModeKey): string => {
    const m = MODES.find((x) => x.k === k);
    return m ? (lang === 'en' ? m.en : m.zh) : String(k);
  };

  /** 错误率 / 正确率条（网页 `.bar`，宽度就是百分数） */
  const Bar = ({ pc, tone }: { pc: number; tone: 'bad' | 'ok' }) => (
    <View style={styles.bar}>
      <View
        style={[
          styles.barFill,
          { width: `${Math.max(0, Math.min(100, pc))}%`, backgroundColor: tone === 'bad' ? theme.color.bad : theme.color.ok },
        ]}
      />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PageHeader
        title={t('stStats')}
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/me'))}
        backLabel={t('navMe')}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}
        testID="st-body"
      >
        {/* ------------------------- ① 总体 ------------------------- */}
        <Card flush testID="st-total">
          <View style={styles.grid4}>
            <Stat n={sum.answers} label={t('stAnswers')} testID="st-answers" />
            <Stat n={`${sum.acc}%`} label={t('stAcc')} testID="st-acc" />
            <Stat n={sum.err} label={t('stErr')} testID="st-err" />
            <Stat n={sum.verbs} label={t('stVerbs')} testID="st-verbs" />
          </View>
          <View style={styles.totalBar}>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(0, Math.min(100, sum.acc))}%`,
                    backgroundColor: theme.color.ok,
                  },
                ]}
              />
            </View>
          </View>
        </Card>

        {/* --------------------- ② 最容易错的动词 --------------------- */}
        {/* 小标题右侧标出这一段的**上限**（用户 2026-10-05：不知道各项是不是有上限）。
            上限来自 `data/stats.ts` 的 `HARDEST_SHOW`，这里只是把它念出来，
            免得用户以为「只列了 20 个」是数据丢了。 */}
        <SectionTitle
          right={<Text style={styles.limit}>{t('stLimit', HARDEST_SHOW)}</Text>}
        >
          {t('stHardest')}
        </SectionTitle>
        <Card flush style={styles.listCard}>
          {hardest.length === 0 ? (
            <Text style={styles.hint}>{t('stNoErr')}</Text>
          ) : (
            hardest.map((r, i) => {
              const pc = Math.round(r.rate * 100);
              return (
                <View
                  key={r.inf}
                  testID={`st-hard-${r.inf}`}
                  style={[styles.row, i === hardest.length - 1 ? null : styles.sep]}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.strong}>{r.inf}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {meaningOf(r.inf)}
                    </Text>
                  </View>
                  <Text style={styles.lv}>{levelOf(r.inf)}</Text>
                  <Text style={styles.num}>
                    {r.err}/{r.att}
                  </Text>
                  <Text style={[styles.num, styles.rateBad]}>{pc}%</Text>
                  <View style={styles.barCell}>
                    <Bar pc={pc} tone="bad" />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* ---------------------- ③ 各时态错误率 ---------------------- */}
        <SectionTitle>{t('stByTense')}</SectionTitle>
        <Card flush style={styles.listCard}>
          {tenses.length === 0 ? (
            <Text style={styles.hint}>{t('stNoData')}</Text>
          ) : (
            tenses.map((r, i) => {
              const pc = Math.round(r.rate * 100);
              return (
                <View
                  key={r.k}
                  testID={`st-tense-${r.k}`}
                  style={[styles.row, i === tenses.length - 1 ? null : styles.sep]}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.strong}>{tenseName(r.k)}</Text>
                    <Text style={styles.meta}>{tenseEs(r.k)}</Text>
                  </View>
                  <Text style={styles.num}>
                    {r.err}/{r.att}
                  </Text>
                  <Text style={[styles.num, styles.rateBad]}>{pc}%</Text>
                  <View style={styles.barCell}>
                    <Bar pc={pc} tone="bad" />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* ---------------------- ④ 各模式正确率 ---------------------- */}
        <SectionTitle>{t('stByMode')}</SectionTitle>
        <Card flush style={styles.listCard}>
          {modes.length === 0 ? (
            <Text style={styles.hint}>{t('stNoData2')}</Text>
          ) : (
            modes.map((r, i) => (
              <View
                key={r.k}
                testID={`st-mode-${r.k}`}
                style={[styles.row, i === modes.length - 1 ? null : styles.sep]}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.strong}>{modeName(r.k)}</Text>
                </View>
                <Text style={styles.num}>
                  {r.ok}/{r.att}
                </Text>
                <Text style={[styles.num, styles.rateOk]}>{r.acc}%</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function Stat({ n, label, testID }: { n: number | string; label: string; testID?: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.stat}>
      <Text testID={testID} style={styles.statBig}>
        {n}
      </Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
    content: { paddingTop: 6, paddingHorizontal: 18 },

    grid4: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
    stat: { width: '50%', alignItems: 'center', gap: 3 },
    statBig: { fontSize: 22, fontWeight: '700', color: theme.color.ink },
    statLbl: { fontSize: 11.5, color: theme.color.sub },
    totalBar: { marginTop: 14 },

    listCard: { paddingTop: 4, paddingBottom: 4 },
    /** 分区标题右侧那句「最多 N 条」 */
    limit: { fontSize: 11.5, color: theme.color.sub, fontWeight: '400' },
    hint: { fontSize: 12.5, color: theme.color.sub, lineHeight: 18, paddingVertical: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
    sep: { borderBottomWidth: 1, borderBottomColor: theme.color.line },
    rowMain: { flex: 1, minWidth: 0, gap: 2 },
    strong: { fontSize: 14, fontWeight: '700', color: theme.color.ink },
    meta: { fontSize: 11.5, color: theme.color.sub },
    lv: { fontSize: 11.5, color: theme.color.sub },
    num: { fontSize: 12, color: theme.color.sub, fontVariant: ['tabular-nums'] },
    rateBad: { color: theme.color.bad, fontWeight: '700' },
    rateOk: { color: theme.color.ok, fontWeight: '700' },
    barCell: { width: 54 },

    bar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.color.line,
      overflow: 'hidden',
    },
    barFill: { height: 6, borderRadius: 3 },
  });
