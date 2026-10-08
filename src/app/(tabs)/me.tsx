import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_VER } from '@/config/brand';
import { BottomTabInset } from '@/constants/theme';
import { statsSummary } from '@/data/stats';
import { useI18n } from '@/i18n';
import { useStatsStore } from '@/store/stats';
import { Card } from '@/ui/components/Card';
import { RowItem } from '@/ui/components/RowItem';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * 「我的」—— 底栏第 4 个 tab，**RN 版新增的一层**（方案 §3.5）。
 *
 * 网页版把「统计」直接做成一个 tab、「设置」挂在首页齿轮上；手机屏幕小、
 * 底栏只能放四个，于是把这两样连同「关于」都收进「我的」，首页因此更干净。
 *
 * 这一屏**只做入口，不渲染内容**：统计、设置、关于各自是推入式独立页
 * （`stats.tsx` / `settings.tsx` / `about.tsx`）。
 *
 * 顶部那张卡片的两个数字取自 `store/stats`（**不新增任何持久化字段** ——
 * 统计数据的形状必须与网页版导出的 JSON 保持一致，见 `data/stats.ts` 的说明）。
 */
export default function MeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const stats = useStatsStore();
  const sum = statsSummary(stats);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Text testID="me-title" style={styles.h1}>
          {t('navMe')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 24 + insets.bottom + BottomTabInset },
        ]}
      >
        {/* ---------------------------- 用户卡片 ---------------------------- */}
        <Card testID="me-card" flush>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text testID="me-answers" style={styles.statBig}>
                {sum.answers}
              </Text>
              <Text style={styles.statLbl}>{t('stAnswers')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text testID="me-acc" style={styles.statBig}>
                {sum.answers ? `${sum.acc}%` : '—'}
              </Text>
              <Text style={styles.statLbl}>{t('stAcc')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text testID="me-verbs" style={styles.statBig}>
                {sum.verbs}
              </Text>
              <Text style={styles.statLbl}>{t('stVerbs')}</Text>
            </View>
          </View>
          {sum.answers === 0 ? <Text style={styles.empty}>{t('meNoStats')}</Text> : null}
        </Card>

        {/* ------------------------ 三个入口（同一张卡） ------------------------ *
         * 用户 2026-10-05：去掉「学习 / 通用 / 其它」三个一级标题、也去掉每行的
         * 简介副标题，只留三个键名（学习统计 / 设置 / 关于），三行共用一张卡。 */}
        <Card flush style={styles.listCard}>
          <RowItem
            testID="me-stats"
            icon="chart"
            title={t('meStats')}
            onPress={() => router.push('/stats')}
          />
          <RowItem
            testID="me-settings"
            icon="settings"
            title={t('setDrawer')}
            onPress={() => router.push('/settings')}
          />
          <RowItem
            testID="me-about"
            icon="info"
            title={t('meAbout')}
            last
            onPress={() => router.push('/about')}
          />
        </Card>

        <Text testID="me-ver" style={styles.ver}>
          {t('abVer', APP_VER)}
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
    head: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4 },
    h1: { fontSize: 22, fontWeight: '700', color: theme.color.ink, letterSpacing: 0.2 },
    content: { paddingTop: 10, paddingHorizontal: 18 },
    /** 列表卡：上下内边距收窄到 4，让第一/最后一行自己带 12 的呼吸感 */
    listCard: { paddingTop: 4, paddingBottom: 4 },

    statsRow: { flexDirection: 'row', alignItems: 'center' },
    stat: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, height: 30, backgroundColor: theme.color.line },
    statBig: { fontSize: 22, fontWeight: '700', color: theme.color.ink },
    statLbl: { fontSize: 11.5, color: theme.color.sub, textAlign: 'center' },
    empty: {
      marginTop: 12,
      fontSize: 12.5,
      color: theme.color.sub,
      textAlign: 'center',
      lineHeight: 18,
    },

    ver: {
      marginTop: 14,
      textAlign: 'center',
      fontSize: 12,
      color: theme.color.sub,
    },
  });
