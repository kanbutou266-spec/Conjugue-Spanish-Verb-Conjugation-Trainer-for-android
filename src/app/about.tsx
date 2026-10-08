import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_VER, BRAND } from '@/config/brand';
import { useI18n } from '@/i18n';
import { Card } from '@/ui/components/Card';
import { PageHeader } from '@/ui/components/PageHeader';
import { RowItem } from '@/ui/components/RowItem';
import { Icon } from '@/ui/Icon';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * 关于与许可（从「我的」推入）—— 对应网页 `renderAbout()`（`#scr-about`）。
 *
 * 五段，顺序与网页一致：
 *   ① 品牌卡：logo + 应用名 + 一句话 + 版本号
 *   ② 开源：仓库 / 提 Issue（外链）
 *   ③ 作者：作者名 → GitHub 主页（外链）
 *   ④ 赞助：赞赏码图片 + 一句说明
 *   ⑤ 声明：AI 参与 / 数据来源与许可 / 隐私
 *
 * 两处与网页的**有意差异**（网页那两段话里的说法在这边不成立）：
 *   · `abTagline` 说的是"单文件离线网页版"→ 这里改成"离线安卓应用"；
 *   · `abPrivT` 说的是"存在浏览器的 localStorage"→ 这里改成"只存在这台设备上"。
 * 其余文案逐字取自网页的 i18n（见 `i18n/zh.ts` 的 ab* 段）。
 *
 * 外链一律 `Linking.openURL`（RN 没有 `target="_blank"`）；地址全部来自
 * `config/brand.ts`，页面里不出现字面量地址。
 */
export default function AboutScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PageHeader
        title={t('navAbout')}
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/me'))}
        backLabel={t('navMe')}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}
        testID="ab-body"
      >
        {/* ---------------------------- 品牌卡 ---------------------------- */}
        <Card flush testID="ab-brand">
          <View style={styles.brand}>
            {/* 品牌 logo：`scripts/gen-app-icon.mjs` 产出的蓝底徽标（方案 C · á） */}
            <Image
              testID="ab-logo"
              source={require('@/assets/images/logo-badge.png')}
              style={styles.logo}
              accessibilityLabel={t('title')}
            />
            <Text testID="ab-title" style={styles.name}>
              {t('title')}
            </Text>
            <Text style={styles.tagline}>{t('abTagline')}</Text>
            <Text testID="ab-ver" style={styles.ver}>
              {t('abVer', APP_VER)}
            </Text>
          </View>
        </Card>

        {/* ----------------------------- 开源 ----------------------------- */}
        <Card flush style={styles.listCard}>
          <Text style={styles.sec}>{t('abSecOpen')}</Text>
          <RowItem
            testID="ab-repo"
            icon="git-branch"
            title={t('abRepo')}
            sub={t('abRepoSub')}
            external
            onPress={() => open(BRAND.repo)}
          />
          <RowItem
            testID="ab-issues"
            icon="circle-help"
            title={t('abIssues')}
            sub={t('abIssuesSub')}
            external
            onPress={() => open(BRAND.issues)}
          />
          <Text style={[styles.sec, styles.secGap]}>{t('abSecAuthor')}</Text>
          <RowItem
            testID="ab-author"
            icon="user"
            title={BRAND.author}
            sub={t('abAuthorNote')}
            external
            last
            onPress={() => open(BRAND.authorUrl)}
          />
        </Card>

        {/* ----------------------------- 赞助 ----------------------------- */}
        <Card flush style={styles.listCard} testID="ab-donate">
          <Text style={styles.sec}>{t('abSecThanks')}</Text>
          <View style={styles.donate}>
            <Icon name="coffee" size={20} color={theme.color.accent} />
            <Image
              testID="ab-qr"
              source={require('@/assets/images/donation.png')}
              style={styles.qr}
              resizeMode="contain"
              accessibilityLabel={t('abDonate')}
            />
            <Text style={styles.donateCap}>{t('abDonateSub')}</Text>
          </View>
        </Card>

        {/* ----------------------------- 声明 ----------------------------- */}
        <Card flush style={styles.listCard}>
          <Text style={styles.sec}>{t('abSecLegal')}</Text>
          <RowItem testID="ab-ai" icon="sparkles" title={t('abAi')} sub={t('abAiT')} />
          <RowItem testID="ab-src" icon="book" title={t('abSrc')} sub={t('abSrcT')} />
          <RowItem testID="ab-priv" icon="lock" title={t('abPriv')} sub={t('abPrivT')} last />
        </Card>

        <Text style={styles.footer}>{t('footer')}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
    content: { paddingTop: 6, paddingHorizontal: 18 },
    listCard: { paddingTop: 4, paddingBottom: 4 },

    brand: { alignItems: 'center', gap: 7, paddingVertical: 8 },
    /** 216px 源图按 54pt 显示（4 倍图）；圆角已烙在图里（22.5%≈12） */
    logo: { width: 54, height: 54, borderRadius: 12 },
    name: { fontSize: 17, fontWeight: '700', color: theme.color.ink, textAlign: 'center' },
    tagline: { fontSize: 12.5, color: theme.color.sub, textAlign: 'center', lineHeight: 18 },
    ver: { fontSize: 12, color: theme.color.sub },

    sec: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.color.bodyInk2,
      letterSpacing: 1,
      paddingTop: 8,
    },
    secGap: { paddingTop: 14 },

    donate: { alignItems: 'center', gap: 8, paddingVertical: 10 },
    qr: { width: 190, height: 190, borderRadius: 10 },
    donateCap: {
      fontSize: 12,
      color: theme.color.sub,
      textAlign: 'center',
      lineHeight: 17,
      paddingHorizontal: 4,
    },

    footer: {
      marginTop: 16,
      fontSize: 11.5,
      color: theme.color.sub,
      lineHeight: 17,
    },
  });
