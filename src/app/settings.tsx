import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_VER } from '@/config/brand';
import { sanitizeSettings } from '@/data/settings';
import { partializeStats } from '@/store/stats';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/store/settings';
import { useStatsStore } from '@/store/stats';
import { Btn } from '@/ui/components/Btn';
import { Card } from '@/ui/components/Card';
import { PageHeader } from '@/ui/components/PageHeader';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { SettingRow } from '@/ui/components/SettingRow';
import { useIsDark, useTheme, type Theme } from '@/ui/theme';

import type { Lang, ThemeMode } from '@/data/types';

/**
 * 全局设置（从「我的」推入）—— 对应网页的齿轮抽屉 `#st`，但**换了个位置**：
 * 手机上前页不放齿轮，干脆收进「我的」（方案 §3.7）。
 *
 * 用户 2026-10-05 重新分段，现在是三段：
 *   界面  跟随系统语言开关 + 关掉之后才可选的「中文 / English」
 *         + 跟随系统深色开关 + 关掉之后才可选的「深色 / 浅色」
 *   出题  显示中文释义 / 隐藏动词原形 / 含 vosotros / 严格要求重音
 *   数据  导出 / 导入 / 清空统计（网页版把这三个按钮放在统计页，RN 挪到这里，
 *         统计页因此只管"看数据"，方案 §3.6）
 *
 * 语义红线（与网页一致，别改）：出题那四个开关是**全局项**，对每一套难度档都生效，
 * 切换档位（`loadCfg`）不会动它们；「跟随系统」默认开，只有在它关掉后才解锁手动选择。
 * 深浅色同理：默认「跟随系统」，关掉后手动二选一。
 *
 * 导出的 JSON 与网页版**同形状**（`{stats, settings}`），两边可以互相导入；
 * `stats` 走 `store/stats` 的 `partializeStats`（就是网页 `DB.stats` 的字段），
 * `settings` 逐字段挑出来（`activeKey`、各种方法函数都不写进文件）。
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  /** 当前实际是不是深色（跟随系统时即为系统的值）—— 手动档位的默认落点 */
  const isDark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();

  const s = useSettingsStore();
  const stats = useStatsStore();
  const [busy, setBusy] = useState(false);

  /**
   * 导出用：与网页 `DB.settings` 同形状。
   * `themeMode` 是 RN 独有的（网页版是在页面里存深浅色，不在 settings），
   * 一起写出去方便换机恢复；网页版导入时按未知字段忽略。
   */
  const settingsSnapshot = () => ({
    levels: s.levels,
    modes: s.modes,
    tenses: s.tenses,
    showZh: s.showZh,
    strictAccent: s.strictAccent,
    inputMode: s.inputMode,
    tagFilter: s.tagFilter,
    hideInf: s.hideInf,
    vosotros: s.vosotros,
    lang: s.lang,
    langMode: s.langMode,
    themeMode: s.themeMode,
  });

  const doExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const json = JSON.stringify({ stats: partializeStats(stats), settings: settingsSnapshot() }, null, 1);
      const uri = `${FS.cacheDirectory}conjugue-backup.json`;
      await FS.writeAsStringAsync(uri, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: t('expJson'),
        });
      } else {
        Alert.alert(t('expJson'), uri);
      }
    } catch (err) {
      Alert.alert(t('expJson'), String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const txt = await FS.readAsStringAsync(res.assets[0]!.uri);
      const o = JSON.parse(txt) as { stats?: unknown; settings?: unknown };
      // stats 与网页同形状：store 的 replace 直接吃 {stats} 或裸 stats
      if (o.stats) stats.replace(o.stats);
      if (o.settings) useSettingsStore.setState(sanitizeSettings(o.settings));
      Alert.alert(t('impOk'));
    } catch (err) {
      Alert.alert(t('impBad', String((err as Error)?.message ?? err)));
    } finally {
      setBusy(false);
    }
  };

  const doReset = () => {
    Alert.alert(t('reset'), t('resetConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('reset'),
        style: 'destructive',
        onPress: () => stats.clear(),
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PageHeader
        title={t('setDrawer')}
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/me'))}
        backLabel={t('navMe')}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}
        testID="set-body"
      >
        {/* 顶部原有一句 setHint 提示（「这一栏是全局项…」），按用户 2026-10-05 要求删除 */}

        {/* ------------------------------ 界面 ------------------------------ *
         * 用户 2026-10-05：原「语言」段改名为「界面」，并把深色模式并进来 ——
         * 语言与深浅色都是"这台设备怎么显示"，理应同一段。两行结构对称：
         * 上「跟随系统 X」开关，下「手动选 X」（跟随开启时置灰不可点）。 */}
        <SectionTitle>{t('setSecUI')}</SectionTitle>
        <Card flush style={styles.listCard}>
          <SettingRow
            testID="set-follow"
            title={t('setFollow')}
            hint={t('setFollowT')}
            value={s.langMode === 'system'}
            onChange={(v) => s.setLang(s.lang, v ? 'system' : 'manual')}
          />
          <View style={[styles.langRow, s.langMode === 'system' ? styles.langOff : null]}>
            <View style={styles.langTxt}>
              <Text style={styles.langTtl}>{t('setLang')}</Text>
              <Text style={styles.langHint}>{t('setLangT')}</Text>
            </View>
            <SegmentedControl<Lang>
              testID="set-lang"
              options={[
                { k: 'zh', label: t('langZh') },
                { k: 'en', label: t('langEn') },
              ]}
              value={lang}
              onChange={(k) => {
                if (s.langMode === 'system') return; // 跟随系统时不可手改
                s.setLang(k, 'manual');
              }}
            />
          </View>

          {/* 深色模式（用户 2026-10-05）：默认跟随系统深色开关；关掉后手动选深/浅 */}
          <SettingRow
            testID="set-dark-follow"
            title={t('setDarkFollow')}
            hint={t('setDarkFollowT')}
            value={s.themeMode === 'system'}
            onChange={(v) => s.setThemeMode(v ? 'system' : isDark ? 'dark' : 'light')}
          />
          <View style={[styles.langRow, s.themeMode === 'system' ? styles.langOff : null]}>
            <View style={styles.langTxt}>
              <Text style={styles.langTtl}>{t('setDark')}</Text>
              <Text style={styles.langHint}>{t('setDarkT')}</Text>
            </View>
            <SegmentedControl<ThemeMode>
              testID="set-dark"
              options={[
                { k: 'light', label: t('darkLight') },
                { k: 'dark', label: t('darkDark') },
              ]}
              value={isDark ? 'dark' : 'light'}
              onChange={(k) => {
                if (s.themeMode === 'system') return; // 跟随系统时不可手改
                s.setThemeMode(k);
              }}
            />
          </View>
        </Card>

        {/* ------------------------------ 出题 ------------------------------ *
         * 用户 2026-10-05：原「界面与出题」段（含中文释义 / 隐藏原形 /
         * vosotros / 严格重音四行）现在改名「出题」。 */}
        <SectionTitle>{t('setSecQuiz')}</SectionTitle>
        <Card flush style={styles.listCard}>
          <SettingRow
            testID="set-showzh"
            title={t('optShowZh')}
            hint={t('optShowZhT')}
            value={s.showZh}
            onChange={(v) => s.setFlag('showZh', v)}
          />
          <SettingRow
            testID="set-hideinf"
            title={t('optHideInf')}
            hint={t('optHideInfT')}
            value={s.hideInf}
            onChange={(v) => s.setFlag('hideInf', v)}
          />
          <SettingRow
            testID="set-vosotros"
            title={t('optVosotros')}
            hint={t('optVosotrosT')}
            value={s.vosotros}
            onChange={(v) => s.setFlag('vosotros', v)}
          />
          <SettingRow
            testID="set-strict"
            title={t('optStrict')}
            hint={t('optStrictT')}
            value={s.strictAccent}
            onChange={(v) => s.setFlag('strictAccent', v)}
          />
        </Card>

        {/* ------------------------------ 数据 ------------------------------ */}
        <SectionTitle>{t('setSecData')}</SectionTitle>
        <Card flush style={styles.listCard}>
          <Text style={styles.dataHint}>{t('setDataHint')}</Text>
          <View style={styles.btnRow}>
            <Btn
              testID="set-export"
              label={t('expJson')}
              onPress={doExport}
              disabled={busy}
              style={styles.btn}
            />
            <Btn
              testID="set-import"
              label={t('impJson')}
              onPress={doImport}
              disabled={busy}
              style={styles.btn}
            />
          </View>
          <View style={styles.btnRow}>
            <Btn
              testID="set-reset"
              label={t('reset')}
              variant="ghost"
              onPress={doReset}
              style={styles.btn}
            />
          </View>
        </Card>

        <Text testID="set-ver" style={styles.ver}>
          {t('abVer', APP_VER)}
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
    content: { paddingTop: 6, paddingHorizontal: 18 },
    listCard: { paddingTop: 4, paddingBottom: 4 },

    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.color.line,
    },
    /** 跟随系统时整行变淡（选项不可用） */
    langOff: { opacity: 0.45 },
    langTxt: { flex: 1, gap: 2 },
    langTtl: { fontSize: 14, color: theme.color.ink, fontWeight: '500' },
    langHint: { fontSize: 12, color: theme.color.sub, lineHeight: 17 },

    dataHint: { fontSize: 12.5, color: theme.color.sub, lineHeight: 18, paddingVertical: 8 },
    btnRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    btn: { flex: 1 },
    ver: { marginTop: 14, textAlign: 'center', fontSize: 12, color: theme.color.sub },
  });
