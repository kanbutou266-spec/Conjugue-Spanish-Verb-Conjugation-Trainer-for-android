import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { GUIDE, guideText } from '@/data/guide';
import { splitGuideTitle } from '@/engine/guide';
import { useI18n } from '@/i18n';
import { RowItem } from '@/ui/components/RowItem';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * 语法讲解 · 目录页（底栏第 2 个 tab）—— 对应网页 `#scr-guide` 的两级结构里的第一级。
 *
 * 内容是 `data/guide.ts` 里的八页表（由 `scripts/extract-guide.mjs` 从网页抽取），
 * 每行 = 主色圆标序号 + 完整标题 + `›`，点进去是推入式详情页 `guide/[slug]`。
 *
 * 八页的正文留在详情页，这里只是一张目录 —— 手机上信息密度低，
 * 一屏能看完八页比把第一页直接铺开更有用（方案 §3.4）。
 */
export default function GuideTocScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Text testID="guide-title" style={styles.h1}>
          {t('gdTitle')}
        </Text>
        <Text style={styles.intro}>{t('gdIntro')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 24 + insets.bottom + BottomTabInset },
        ]}
      >
        <View style={styles.card}>
          {GUIDE.map((g, i) => {
            const title = splitGuideTitle(guideText(g.t, lang));
            return (
              <RowItem
                key={g.k}
                testID={`guide-row-${g.k}`}
                badge={title.num || String(i + 1)}
                title={title.rest}
                sub={guideText(g.s, lang)}
                last={i === GUIDE.length - 1}
                onPress={() => router.push(`/guide/${g.k}`)}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
    head: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4, gap: 6 },
    h1: { fontSize: 22, fontWeight: '700', color: theme.color.ink, letterSpacing: 0.2 },
    intro: { fontSize: 13, color: theme.color.sub, lineHeight: 19 },
    content: { paddingHorizontal: 18, paddingTop: 10 },
    card: {
      backgroundColor: theme.color.card,
      borderWidth: 1,
      borderColor: theme.color.line,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
    },
  });
