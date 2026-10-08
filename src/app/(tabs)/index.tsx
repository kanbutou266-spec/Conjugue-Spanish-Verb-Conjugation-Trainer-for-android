import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { modeDesc } from '@/data/modes';
import { VERBS } from '@/data/verbs';
import { buildPool } from '@/engine/pool';
import { useI18n } from '@/i18n';
import { selectKey } from '@/store/actions';
import { useSettingsStore } from '@/store/settings';
import { Btn } from '@/ui/components/Btn';
import { ModeSelector } from '@/ui/components/ModeSelector';
import { PresetCarousel } from '@/ui/components/PresetCarousel';
import { RichText } from '@/ui/components/RichText';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * 练习首页 —— 对应网页 `#scr-menu`（方案 §3.1）。
 *
 * 整页只做一件事：**「选模式 → 选难度档 → 开始练习」**，从上到下三段。
 * 所有配置（等级 / 标签 / 时态 / 答题方式）都不在这页上改：
 * 预设档是只读配方，自定义槽的微调走卡片右上角 `[编辑]` 推入 `slot-settings`。
 * 这样首页没有折叠区、没有 inline 表单，高度稳定，也不会一进来就被设置项淹没。
 *
 * 三处信息层级：
 *   ① `SectionTitle` 分区（练习模式 / 难度）；
 *   ② `ModeSelector` 四钮一行（图标在上、短名）；
 *   ③ `PresetCarousel` 整卡轮播 + 常驻词库详情（联动栏在组件内部）。
 *
 * 底部 `startbar` 是**常驻**的（不是滚动到底才出现）：它是这一页唯一的出口，
 * 滑到哪都应该能按到。放在 `ScrollView` 外面用 flex 布局顶住底部，
 * 顺带给原生底部 tab 栏让出 `BottomTabInset`。
 */
export default function PracticeHomeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const router = useRouter();

  // 精确订阅需要的字段，不用全量订阅 —— 这页会随设置变化重排，少订阅少重渲染。
  // （`buildPool` 只要 levels / tenses / tagFilter 三样，见 engine/pool.ts）
  const modes = useSettingsStore((s) => s.modes);
  const activeKey = useSettingsStore((s) => s.activeKey);
  const levels = useSettingsStore((s) => s.levels);
  const tenses = useSettingsStore((s) => s.tenses);
  const tagFilter = useSettingsStore((s) => s.tagFilter);
  const setMode = useSettingsStore((s) => s.setMode);

  const mode = modes[0];

  /** 当前题库大小 —— **现算**（等级 ∩ 时态 ∩ 标签），不是等级里的动词个数 */
  const pool = useMemo(
    () => buildPool(VERBS, { levels, tenses, tagFilter }),
    [levels, tenses, tagFilter]
  );

  /* ------------------------------------------------------------------ *
   * 启动栏口径 —— 逐条对照网页 `renderStartbar()`
   * ------------------------------------------------------------------ */

  const noTense = tenses.length === 0;

  /**
   * 「这个模式当前出不了题」的提示。
   * 注意**只提示、不拦截** —— 真正的降级在 `makeQuestion` 内部做
   * （它会在「本次真能出题」的模式里挑一个），所以用户仍可以按开始，
   * 只是提前知道自己选的那个模式这次用不上。
   */
  const warns: string[] = [];
  if (mode === 'shift' && tenses.length === 1) warns.push(t('warnShift'));
  if (mode === 'transfer' && pool.length < 2) warns.push(t('warnTransfer'));

  const canStart = pool.length > 0 && !noTense;

  // 三种按钮文案互斥，优先级：没选时态 > 题库空 > 正常
  const startLabel = noTense ? t('startPick') : pool.length ? t('start') : t('startEmpty');

  const start = useCallback(() => {
    if (!canStart) return; // 按钮本身就禁用了，这里是双保险
    router.push('/practice');
  }, [canStart, router]);

  return (
    <View style={styles.root}>
      <ScrollView
        testID="home-scroll"
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          // web 上顶栏是绝对定位的（app-tabs.web.tsx），得给它让出高度；真机是底部原生 tab，不用让
          { paddingTop: insets.top + (Platform.OS === 'web' ? 76 : 12) },
        ]}
      >
        {/* 大标题/副标题撤掉了（2026-10-02 用户定稿：省主屏空间）——
            应用名与词库规模挪到开屏加载页（components/animated-icon.tsx） */}

        {/* ------------------------- 练习模式 ------------------------- */}
        <SectionTitle testID="sec-mode">{t('hMode')}</SectionTitle>
        <ModeSelector testID="mode" lang={lang} value={mode} onChange={setMode} />
        {/* 一句话规则：**不重复模式名**（用户 2026-10-03）——
            按钮上已经有「辨认/复现/转换/平移」了，再写一句「辨认模式 · …」是废话 */}
        <Text testID="mode-rule" style={styles.modeRule}>
          {modeDesc(mode, lang)}
        </Text>

        {/* -------------------------- 难度 -------------------------- */}
        <SectionTitle testID="sec-keys">{t('hKeys')}</SectionTitle>
        {/* 难度下的括号说明（「这一套练什么…」）按简约要求删掉了，词库详情栏足够 */}

        {/* 轮播 + 常驻词库详情（详情栏在组件内部，跟着档位联动） */}
        <PresetCarousel
          testID="carousel"
          activeKey={activeKey}
          onSelect={(k) => selectKey(k)}
          onEdit={(k) => router.push(`/slot-settings?key=${k}`)}
        />
      </ScrollView>

      {/* ------------------------ Sticky 底栏 ------------------------ */}
      <View
        testID="startbar"
        style={[styles.startbar, { paddingBottom: insets.bottom + BottomTabInset + 8 }]}
      >
        <RichText
          testID="pool-line"
          // 没选时态时换成专门那句（网页 poolNoTense）；否则是「N 个动词 / M 个时态」
          text={noTense ? t('poolNoTense') : t('pool', pool.length, tenses.length)}
          style={styles.pool}
        />
        {warns.length ? (
          <Text testID="warn-line" style={styles.warnLine}>
            {t('warnTail', warns.join(lang === 'en' ? ', ' : '、'))}
          </Text>
        ) : null}
        {/* 开始键不带任何箭头 —— 用户 2026-10-02：按钮文案自己有动词，
            前面一个 `>` 图标、后面一个 `→` 都是噪音（文案里的 → 也已去掉）。
            变位查询入口已上移为底栏第三个 tab（用户 2026-10-04），这里不再放小按钮 */}
        <Btn
          testID="start-btn"
          wide
          variant="primary"
          disabled={!canStart}
          label={startLabel}
          onPress={start}
        />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
    scroll: { flex: 1 },
    // 底部不用留大内边距 —— startbar 是 flex 布局里真实占位的兄弟节点，不遮内容
    content: { paddingHorizontal: 18, paddingBottom: 20 },

    header: { gap: 6, marginBottom: 4 },

    /** 模式按钮下面那行「完整模式名 · 规则」 */
    modeRule: { fontSize: theme.font.sm, color: theme.color.sub, lineHeight: 19, marginTop: 8 },

    startbar: {
      paddingHorizontal: 18,
      paddingTop: 10,
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: theme.color.line,
      backgroundColor: theme.color.bg,
    },
    pool: { fontSize: theme.font.sm, color: theme.color.ink, lineHeight: 19 },
    warnLine: { fontSize: theme.font.xs, color: theme.color.warn, lineHeight: 17 },
  });
