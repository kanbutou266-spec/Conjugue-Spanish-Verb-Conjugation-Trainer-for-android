import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CUSTOM_KEYS, defaultCustom, isCustomKey, keyIcon, keyName } from '@/data/levels';
import {
  normalizeTenses,
  sameCfg,
  toggleLevelIn,
  toggleTagIn,
  toggleTenseIn,
} from '@/data/settings';
import { LEVELS, TENSES, TENSE_RECS, LV_TENSE } from '@/data/tenses';
import { COUNT_BY_LEVEL, VERBS } from '@/data/verbs';
import { buildPool, tagMatch } from '@/engine/pool';
import { TAG_FILTERS, useI18n } from '@/i18n';
import { saveSlotAndApply } from '@/store/actions';
import { useCustomStore } from '@/store/custom';
import { Icon } from '@/ui/Icon';
import { Btn } from '@/ui/components/Btn';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { RichText } from '@/ui/components/RichText';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { TenseGrid } from '@/ui/components/TenseGrid';
import { useTheme, type Theme } from '@/ui/theme';

import type { GroupKey, InputMode, PresetCfg, TenseKey } from '@/data/types';
import type { I18nKey, TextArg } from '@/i18n';
import type { SegOption } from '@/ui/components/SegmentedControl';

type Tr = (key: I18nKey, ...args: TextArg[]) => string;

/** 答题方式二选一：显式标注，免得 options 里的字面量被推成 string */
const inputOpts = (t: Tr): SegOption<InputMode>[] => [
  { k: 'type', label: t('typeType') },
  { k: 'choice', label: t('typeChoice') },
];

/**
 * 自定义槽设置页 —— 方案 §3.9。
 *
 * 从首页难度轮播里**自定义 1 / 自定义 2** 卡片右上角的 `[编辑]` 推入
 * （`router.push('/slot-settings?key=custom1')`）。预设档只读，没有入口。
 *
 * 三条设计约束（别改回网页那套）：
 *  1. **纯受控表单**：草稿放 `useState`，全程不碰 store；
 *     只有点「保存」才落盘 —— 于是「恢复默认」和「取消返回」都是零副作用的。
 *     （网页原版是"改一下就存"，RN 版有意收敛成显式保存。）
 *  2. **「恢复默认」只重置草稿**，不算写入：误触了再点一下「保存」之外没有任何损失。
 *  3. 保存成功 = 写槽 + 载入设置 + 把 `activeKey` 设成该槽（`saveSlotAndApply`），
 *     然后回首页 —— 用户的意图本来就是"让这套配置生效"。
 */
export default function SlotSettingsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const params = useLocalSearchParams();

  // 非自定义槽的 key 一律不认（预设档没有编辑入口，正常也走不到这儿）
  const rawKey = Array.isArray(params.key) ? params.key[0] : params.key;
  const slot = typeof rawKey === 'string' && isCustomKey(rawKey) ? rawKey : null;

  /** 出栈：优先 pop，没栈可退（比如深链直接进来的）就换到首页 */
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  // 进页时把槽的**已存配置**读出来做草稿（槽永远有值，见 store/custom.ts 的说明）
  const saved = useCustomStore((s) => (slot ? s.cfgOf(slot) : null));

  const [draft, setDraft] = useState<PresetCfg>(
    () => (slot ? (useCustomStore.getState().cfgOf(slot) ?? defaultCustom()) : defaultCustom())
  );

  const dirty = !!saved && !sameCfg(draft, saved);

  // key 非法：不该发生，兜底直接退出去
  useEffect(() => {
    if (!slot) goBack();
  }, [slot, goBack]);

  // 改了没存就想返回 → 先问一句（返回键与顶栏「返回」走同一个判断）
  const tryBack = useCallback(() => {
    if (!dirty) {
      goBack();
      return;
    }
    Alert.alert(t('saveDiscardT'), t('saveDiscardD', keyName(slot ?? '', lang)), [
      { text: t('saveDiscardCancel'), style: 'cancel' },
      { text: t('saveDiscardOk'), style: 'destructive', onPress: goBack },
    ]);
  }, [dirty, goBack, t, slot, lang]);

  // 安卓实体返回键也要受同一个判断约束，否则"改了没存按一下就没了"
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dirty) return false; // 交回系统（正常出栈）
      tryBack();
      return true; // 拦下：等用户在弹窗里做决定
    });
    return () => sub.remove();
  }, [dirty, tryBack]);

  // 词库实时计数：等级 ∩ 标签 ∩ 时态，现算不缓存（方案 §3.9）
  const poolCount = useMemo(() => buildPool(VERBS, draft).length, [draft]);

  /** 各标签能筛出多少动词（与词库面板的计数口径一致，不受当前选中影响） */
  const tagCount = useMemo(() => {
    const out: Record<string, number> = {};
    TAG_FILTERS.forEach((f) => {
      out[f.k] = f.k ? VERBS.filter((v) => tagMatch(v, f.k)).length : VERBS.length;
    });
    return out;
  }, []);

  const onSave = () => {
    if (!slot) return;
    saveSlotAndApply(slot, draft);
    if (Platform.OS === 'android') ToastAndroid.show(t('savedOk'), ToastAndroid.SHORT);
    goBack();
  };

  if (!slot) return null;

  const inGroup = (g: GroupKey): TenseKey[] => TENSES.filter((x) => x.g === g).map((x) => x.k);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="slot-settings">
      {/* ---------------------------- 顶栏 ---------------------------- */}
      <View style={styles.top}>
        {/* 文案本身就是「← 返回」，所以这里**不要**再画一个 arrow-left 图标 —— 会变成「← ← 返回」 */}
        <Pressable
          testID="ss-back"
          onPress={tryBack}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          style={({ pressed }) => [styles.back, pressed ? styles.backPressed : null]}
        >
          <Text style={styles.backTxt}>{t('back')}</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <Icon name={keyIcon(slot)} size={18} color={theme.color.accent} />
          <Text style={styles.title}>{t('keyCustom', CUSTOM_KEYS.indexOf(slot) + 1)}</Text>
          {dirty ? <Text style={styles.dot} testID="ss-dirty">●</Text> : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 20 }]}
      >
        {/* ------------------------ 1 · 词库范围 ------------------------ */}
        <Card testID="ss-lib">
          <SectionTitle testID="ss-sec-lib">{t('secLib')}</SectionTitle>

          <View style={styles.wrapRow}>
            {LEVELS.map((lv) => {
              const n = COUNT_BY_LEVEL[lv] ?? 0;
              // 该等级在词表里一个动词都没有、又没被选中时不必画空按钮（网页同款）
              if (!n && !draft.levels.includes(lv)) return null;
              return (
                <Chip
                  key={lv}
                  testID={`ss-lv-${lv}`}
                  label={lv}
                  count={n}
                  selected={draft.levels.includes(lv)}
                  accessibilityHint={t('levelN', n)}
                  onPress={() => setDraft((d) => ({ ...d, levels: toggleLevelIn(d.levels, lv) }))}
                />
              );
            })}
          </View>

          <View style={[styles.wrapRow, styles.gapTop]}>
            {TAG_FILTERS.map((f) => (
              <Chip
                key={f.k || 'all'}
                testID={`ss-tag-${f.k || 'all'}`}
                size="sm"
                label={t(f.key)}
                count={tagCount[f.k] ?? 0}
                selected={draft.tagFilter === f.k}
                onPress={() => setDraft((d) => ({ ...d, tagFilter: toggleTagIn(d.tagFilter, f.k) }))}
              />
            ))}
          </View>

          <Text style={[styles.hint, styles.gapTop]} testID="ss-pool">
            {t('pickNow', poolCount)}
          </Text>
        </Card>

        {/* --------------------------- 2 · 时态 -------------------------- */}
        <Card testID="ss-tense">
          <SectionTitle testID="ss-sec-tense">{t('secTense')}</SectionTitle>

          <Text style={styles.label}>{t('tRec')}</Text>
          <View style={styles.wrapRow}>
            {TENSE_RECS.map((lv) => {
              const set = LV_TENSE[lv];
              // 一键套用：整串替换（不是追加），对应网页 mkRecChips
              const on =
                draft.tenses.length === set.length && set.every((k) => draft.tenses.includes(k));
              return (
                <Chip
                  key={lv}
                  testID={`ss-rec-${lv}`}
                  size="sm"
                  label={lv}
                  selected={on}
                  accessibilityHint={t('tRecT', lv, set.length)}
                  onPress={() => setDraft((d) => ({ ...d, tenses: set.slice() }))}
                />
              );
            })}
          </View>

          <TenseGrid
            testID="ss-grid"
            selected={draft.tenses}
            onToggle={(k) => setDraft((d) => ({ ...d, tenses: toggleTenseIn(d.tenses, k) }))}
            onGroupAll={(g) =>
              setDraft((d) => ({ ...d, tenses: normalizeTenses(d.tenses.concat(inGroup(g))) }))
            }
            onGroupNone={(g) =>
              setDraft((d) => ({ ...d, tenses: d.tenses.filter((k) => inGroup(g).indexOf(k) < 0) }))
            }
          />

          <View style={styles.gapTop} testID="ss-tcount">
            {/* `tCount` 里带 [[…]] 强调标记（网页是 <b>8</b>），必须走 RichText，
                直接塞进 <Text> 会把方括号原样显示出来 */}
            {draft.tenses.length ? (
              <RichText text={t('tCount', draft.tenses.length, TENSES.length)} style={styles.hint} />
            ) : (
              <Text style={styles.hint}>{t('tCountNone')}</Text>
            )}
          </View>
        </Card>

        {/* --------------------------- 3 · 其它 -------------------------- */}
        <Card testID="ss-other">
          <SectionTitle testID="ss-sec-other">{t('secOther')}</SectionTitle>

          <Text style={styles.label}>{t('optType')}</Text>
          <SegmentedControl
            testID="ss-input"
            options={inputOpts(t)}
            value={draft.inputMode}
            onChange={(m) => setDraft((d) => ({ ...d, inputMode: m }))}
          />
          <Text style={[styles.hint, styles.gapTop]}>{t('optTypeT')}</Text>
        </Card>
      </ScrollView>

      {/* --------------------------- 底部操作栏 --------------------------- */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Btn
          testID="ss-reset"
          variant="default"
          label={t('applyReset')}
          onPress={() => setDraft(defaultCustom())}
        />
        <View style={styles.footerGap} />
        <Btn
          testID="ss-save"
          variant="primary"
          wide
          label={t('save')}
          disabled={!dirty}
          onPress={onSave}
        />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },

    top: {
      paddingHorizontal: 18,
      paddingTop: 6,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingRight: 8, minHeight: 44 },
    backPressed: { opacity: 0.6 },
    backTxt: { fontSize: theme.font.md, color: theme.color.sub, fontWeight: '600' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
    title: { fontSize: theme.font.lg, fontWeight: '700', color: theme.color.ink },
    /** 草稿与已存配置不一致时的小圆点 —— 比文案省地方，也不打扰 */
    dot: { fontSize: theme.font.sm, color: theme.color.warn, marginLeft: 2 },

    scroll: { flex: 1 },
    content: { paddingHorizontal: 0 },

    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    gapTop: { marginTop: 10 },
    label: { fontSize: theme.font.sm, color: theme.color.sub, fontWeight: '600', marginBottom: 6 },
    hint: { fontSize: theme.font.xs, color: theme.color.sub, lineHeight: 17 },

    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 12,
      backgroundColor: theme.color.card,
      borderTopWidth: 1,
      borderTopColor: theme.color.line,
    },
    footerGap: { width: 10 },
  });
