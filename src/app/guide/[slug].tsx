import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GUIDE, GUIDE_MAP, guideBody, guideIndex, guideText } from '@/data/guide';
import { parseGuide, splitGuideTitle } from '@/engine/guide';
import { useI18n } from '@/i18n';
import { useTheme, type Theme } from '@/ui/theme';
import { Btn } from '@/ui/components/Btn';
import { Chip } from '@/ui/components/Chip';
import { GuideBody } from '@/ui/components/GuideBody';
import { PageHeader } from '@/ui/components/PageHeader';

/**
 * 讲解详情页（推入式全屏）—— 对应网页 `renderGuide()`。
 *
 * 一页的结构（自上而下）：
 *   顶栏（退键 + 「第 i / n 页」）→ 主色圆标序号 + 大标题 → 正文（GuideBody，
 *   内嵌变位网格）→ 「权威外链」一组 → 八页目录 chips（当前页高亮，点了原地切页）
 *   → 底部固定「← 上一页 / 下一页 →」。
 *
 * 三个与网页一致的口径：
 *   · 序号从标题里拎出来做圆标（`splitGuideTitle`），标题本身大一号；
 *   · 外链一律 `Linking.openURL`（RN 没有 target=_blank 这回事）；
 *   · 目录 chips 点了是**原地换页**（`router.replace`），不是往栈里再压一层 ——
 *     否则翻八页会留下七层返回栈，用户按返回要按八次。
 *
 * 翻页动画（用户 2026-10-05，第三次改）：
 *   前两版都在「推入方向」上做文章（`ios_from_left/right` + `animationTypeForReplace`
 *   的 push/pop），用户觉得别扭 —— 直接要「渐变到目标页」。
 *   现在**不再区分方向**：上一页 / 下一页 / 目录 chip 一律用 `fade`，
 *   旧页淡出、新页淡入，翻页像换一张卡片，没有横向位移。
 *
 *   仍写在页面自己的 `<Stack.Screen>` 里：`router.replace` 会换掉路由实例，
 *   靠 `navigation.setOptions` 在 replace 前设的选项会随旧实例一起丢。
 *   `fade` 是 replace 时也认的动画种类（不像方向型动画只在 push 时生效），
 *   所以这里不需要再区分 fwd/back。
 */
export default function GuidePageScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const params = useLocalSearchParams<{ slug?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const slug = String(params.slug ?? '');
  /** 认不出的 slug 退回第一页（绝不白屏） */
  const idx = useMemo(() => {
    const i = guideIndex(slug);
    return i < 0 ? 0 : i;
  }, [slug]);
  const page = GUIDE[idx]!;

  const blocks = useMemo(() => parseGuide(guideBody(page, lang)), [page, lang]);
  const title = splitGuideTitle(guideText(page.t, lang));

  const go = useCallback(
    (next: number) => {
      const target = GUIDE[next];
      if (!target) return;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      router.replace(`/guide/${target.k}`);
    },
    [router],
  );

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.navigate('/guide');
  }, [router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 翻页转场：旧页淡出、新页淡入（用户 2026-10-05：翻页要"渐变到目标页"）。
          写在页面里而不是布局里 —— 每次 replace 都是新实例，新实例自己带上这条动画，
          才不会像 `navigation.setOptions` 那样被"换实例"抹掉。 */}
      <Stack.Screen options={{ animation: 'fade' }} />
      <PageHeader
        title={t('gdTitle')}
        onBack={back}
        backLabel={t('back')}
        right={
          <Text testID="gd-count" style={styles.count}>
            {t('gdCount', idx + 1, GUIDE.length)}
          </Text>
        }
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        testID="gd-body"
      >
        {/* ---------------------------- 页标题 ---------------------------- */}
        <View style={styles.titleRow}>
          {title.num ? (
            <View style={styles.gnum}>
              <Text style={styles.gnumTxt}>{title.num}</Text>
            </View>
          ) : null}
          <Text testID="gd-title" style={styles.h2}>
            {title.rest}
          </Text>
        </View>

        {/* ---------------------------- 正文 ---------------------------- */}
        <GuideBody blocks={blocks} lang={lang} testID="gd-blocks" />

        {/* -------------------------- 权威外链 -------------------------- */}
        {page.lk.length ? (
          <View style={styles.links}>
            <Text style={styles.linksTitle}>{t('gdLinks')}</Text>
            {page.lk.map((l) => (
              <Pressable
                key={l.u}
                testID={`gd-link-${l.u}`}
                onPress={() => Linking.openURL(l.u)}
                accessibilityRole="link"
                accessibilityHint={t('abOpenNew')}
                style={({ pressed }) => [styles.link, pressed ? styles.linkPressed : null]}
              >
                <Text style={styles.linkName}>{guideText(l.n, lang)}</Text>
                {l.d ? <Text style={styles.linkDesc}>{guideText(l.d, lang)}</Text> : null}
                <Text style={styles.linkUrl} numberOfLines={1}>
                  {l.u}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ------------------------- 八页目录 chips ------------------------ */}
        <View style={styles.tocWrap}>
          <Text style={styles.tocTitle}>{t('gdToc')}</Text>
          <View style={styles.toc}>
            {GUIDE.map((g, i) => (
              <Chip
                key={g.k}
                size="sm"
                label={guideText(g.s, lang)}
                selected={i === idx}
                onPress={() => go(i)}
                testID={`gd-chip-${g.k}`}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ---------------------------- 底部翻页 ---------------------------- */}
      <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>
        <View style={styles.footerBtn}>
          <Btn
            label={t('gdPrev')}
            variant="ghost"
            disabled={idx <= 0}
            onPress={() => go(idx - 1)}
            testID="gd-prev"
          />
        </View>
        <View style={styles.footerBtn}>
          <Btn
            label={t('gdNext')}
            disabled={idx >= GUIDE.length - 1}
            onPress={() => go(idx + 1)}
            testID="gd-next"
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
    count: { fontSize: theme.font.xs, color: theme.color.sub },
    content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 26 },

    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 },
    gnum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.accent,
    },
    gnumTxt: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    h2: { flex: 1, fontSize: 22, lineHeight: 22 * 1.35, fontWeight: '700', color: theme.color.ink, letterSpacing: 0.2 },

    links: { marginTop: 18 },
    linksTitle: { fontSize: 13.5, fontWeight: '700', color: theme.color.bodyInk2, letterSpacing: 1, marginBottom: 10 },
    link: {
      borderWidth: 1,
      borderColor: theme.color.line,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
      marginBottom: 7,
      backgroundColor: theme.color.card2,
      gap: 3,
    },
    linkPressed: { borderColor: theme.color.line2, backgroundColor: theme.press.soft },
    linkName: { fontSize: 14, fontWeight: '700', color: theme.color.ink },
    linkDesc: { fontSize: 12.5, lineHeight: 18, color: theme.color.sub },
    linkUrl: { fontSize: 12, color: theme.color.accent },

    tocWrap: { marginTop: 22 },
    tocTitle: { fontSize: 13.5, fontWeight: '700', color: theme.color.bodyInk2, letterSpacing: 1, marginBottom: 10 },
    toc: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 18,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.color.line,
      backgroundColor: theme.color.bg,
    },
    footerBtn: { flex: 1 },
  });
