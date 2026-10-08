import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { isCustomKey, ALL_KEYS, keyIcon, keyName, presetOf } from '@/data/levels';
import { T } from '@/data/tenses';
import { VERBS } from '@/data/verbs';
import { buildPool } from '@/engine/pool';
import { useI18n } from '@/i18n';
import { useCustomStore } from '@/store/custom';
import { Icon } from '@/ui/Icon';
import { useTheme, type Theme } from '@/ui/theme';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { Lang, PresetCfg, TenseKey } from '@/data/types';

/**
 * 难度档选择器 —— 对应网页的 `.key-grid`（6 个难度键）。
 *
 * **横向滑动 + 整卡吸附**（2026-10-02 用户第二次定稿，取代了上一版的左右键）：
 * 6 张卡排在一条横向轨道上，一次滑一档、松手自动对齐到最近的整卡。
 * 上一版曾因为「滑不准」改成左右键，这次把滑动做对了 —— 关键是
 * `snapToInterval` + **`disableIntervalMomentum`**（惯性再大也只走一档）
 * + `decelerationRate="fast"`，再加上左右各露出一点邻卡（`CARD_PEEK`）当"能滑"的提示。
 *
 * ⚠️ 6 张卡**同时挂在树上**（不像上一版只渲染当前那张）：宽度统一由 `carouselGeom`
 * 算，高度靠行容器的 `alignItems: 'stretch'` **自动拉平**（最高的那张决定行高），
 * 所以卡片恒等高、滑动时行高不会跳。
 *
 * 卡片下方那栏「词库详情」仍然**常驻在轨道外**、且换档时**淡出 → 换内容 → 淡入**
 * （见 `CAROUSEL_FADE`）：卡片是跟着手指平移的，再叠一层透明度会很怪；
 * 详情栏是"硬切换"的，才需要渐变。注意它跟的是 `shownIdx`（比 `idx` 慢半步）。
 */
export interface PresetCarouselProps {
  /** 当前选中的档位；null 表示一个都没选（RN 里首屏一定有值，见 data/settings.ts） */
  activeKey: string | null;
  onSelect: (k: string) => void;
  /** 自定义槽卡片右上角「编辑」的回调；不传则不画那个按钮 */
  onEdit?: (k: string) => void;
  testID?: string;
}

/** 卡片之间的间隙 */
export const CARD_GAP = 8;
/**
 * 左右各露出邻卡的宽度 —— 让「这儿能滑」一眼可见。
 * 太小看不见（等于没有提示），太大当前卡就窄了（内容挤），18 是折中。
 */
export const CARD_PEEK = 18;

export interface CarouselGeom {
  /** 卡片宽 */
  cardW: number;
  /** 相邻两档之间的步进（卡宽 + 间隙）= `snapToInterval` 的值 */
  step: number;
  /** 露出的邻卡宽度 */
  peek: number;
  gap: number;
}

/**
 * 轮播几何：卡宽 = 可用宽度 − 左右各露出的邻卡；步进 = 卡宽 + 间隙。
 *
 * ⚠️ `availW` 必须是**实测到的宽度**，不能图省事直接传窗口宽 ——
 * 轮播外面往往还套着卡片的内边距（练习首页就是 `<Card>` 里），拿窗口宽算出来的卡
 * 会顶出容器（踩过）。组件里用 `onLayout` 量真实宽度，`winW` 只在第一帧还没量到时兜一下。
 */
export function carouselGeom(availW: number, gap = CARD_GAP, peek = CARD_PEEK): CarouselGeom {
  // 120 是兜底下限：容器再窄也不让卡片被算成 0 或负数
  const cardW = Math.max(120, Math.round(availW - peek * 2));
  return { cardW, gap, peek, step: cardW + gap };
}

/** 换档时的淡出 / 淡入时长（毫秒）。
 *
 * `enabled` 是给测试用的开关：动画是**异步**的，`shownIdx` 要等淡出结束才切过去，
 * 断言会读到"上一档"的内容。绝大多数用例 `enabled = false`（同步换内容），
 * 只有专门测过渡的那条用例打开它并 `waitFor` 等落定。
 */
export const CAROUSEL_FADE = { enabled: true, out: 110, in: 190 };

/**
 * 滚动"静止"多久才算落位（毫秒）。
 *
 * ⚠️ **不能信 `onScrollEndDrag` / `onMomentumScrollEnd` 里的 `contentOffset`** ——
 * 真机（Android 12 / RN 0.86）实测：一次快速滑动会收到**两个**落点事件，
 * 第一个报的偏移是假的 `x=0`（把档位拽回第一档）。所以改用最稳的办法：
 * `onScroll` 持续刷新最新偏移，**静默 120ms** 才按"最近的整卡"落位；
 * 松手类事件一个都不听。
 */
export const SCROLL_SETTLE_MS = 120;

/** 该档当前那套配置：预设读表，自定义槽读槽；都不认识返回 null */
function cfgOfSlots(k: string, slots: Record<string, PresetCfg>): PresetCfg | null {
  const p = presetOf(k);
  if (p) return p.cfg;
  return isCustomKey(k) ? (slots[k] ?? null) : null;
}

export function PresetCarousel({ activeKey, onSelect, onEdit, testID }: PresetCarouselProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { width: winW } = useWindowDimensions();
  const { lang, t } = useI18n();
  const slots = useCustomStore((s) => s.slots);

  /**
   * 轨道的**实测**可用宽度（0 = 还没量到，先拿窗口宽兜）。
   * 轨道宽度由父容器决定，跟卡片多宽无关，所以量一次就稳定，不会来回抖。
   */
  const [availW, setAvailW] = useState(0);
  const { cardW, gap, peek, step } = carouselGeom(availW || winW);
  const n = ALL_KEYS.length;
  const idx = Math.max(0, ALL_KEYS.indexOf(activeKey ?? ''));

  const scrollRef = useRef<ScrollView>(null);
  /**
   * 这次 `idx` 变化是不是**滑动**造成的。
   * 是滑动来的 → 卡片已经被原生吸附放好了，effect 不能再 `scrollTo`（会打架）；
   * 是外面改的（点指示点、从设置页保存回来）→ 才要跳过去。
   */
  const fromScroll = useRef(false);
  /** `onScroll` 里持续刷新的最新偏移（落位只认它，不信松手事件） */
  const lastX = useRef(0);
  /** "静止多久算落位"的计时器 */
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 界面上**实际显示**的那一档（详情栏用）。
   * 平时与 `idx` 同步；换档时它会比 `idx` 慢半步（等淡出跑完才切内容），
   * 于是旧内容淡出、新内容淡入 —— 这就是"渐变"的实现。
   */
  const [shownIdx, setShownIdx] = useState(idx);
  const fade = useRef(new Animated.Value(1)).current;
  /** 是否有一段「淡出 → 换内容 → 淡入」正跑到一半（用于"中途折返"的复位） */
  const fading = useRef(false);

  useEffect(() => {
    if (shownIdx === idx) {
      // 中途折返（连点指示点 / 快速来回滑）：回到了本来就没换过的那一档。
      // 此时上一段淡出可能还在跑，而它的完成回调已经被下面的 cleanup 用
      // `alive = false` 掐掉了 —— 没人接着做淡入，透明度就**永远停在 0**
      // （真机上表现为"换档后详情栏一片空白"）。所以这里必须补一段淡入。
      if (fading.current) {
        fading.current = false;
        Animated.timing(fade, {
          toValue: 1,
          duration: CAROUSEL_FADE.in,
          useNativeDriver: true,
        }).start();
      }
      return undefined;
    }

    if (!CAROUSEL_FADE.enabled) {
      setShownIdx(idx);
      fade.setValue(1);
      fading.current = false;
      return undefined;
    }

    let alive = true;
    fading.current = true;
    const out = Animated.timing(fade, {
      toValue: 0,
      duration: CAROUSEL_FADE.out,
      useNativeDriver: true,
    });
    out.start(({ finished }) => {
      if (!alive || !finished) return;
      setShownIdx(idx);
      Animated.timing(fade, {
        toValue: 1,
        duration: CAROUSEL_FADE.in,
        useNativeDriver: true,
      }).start();
      fading.current = false;
    });

    // ⚠️ cleanup 里**不许**调用 `out.stop()`（2026-10-02 真机踩过的坑）：
    // CompositeAnimation.stop() 的实现是 `value.stopAnimation()` —— 停的是这个
    // `Animated.Value` **当前**挂着的动画，而不是当初那个 out。时序是：淡出自然结束
    // →（`animate()` 先把 `_animation` 置 null 再回调）→ 回调里启动淡入（`_animation`
    // 变成淡入）→ `setShownIdx` 触发重渲染 → 本 cleanup 执行 → `out.stop()` 把刚起跑的
    // **淡入**掐死在 opacity 0 —— 表现就是换档后详情栏永远空白。
    // （连点箭头时掐掉上一段淡出这件事，`animate()` 第一行本来就做，这里不需要再做。）
    return () => {
      alive = false;
    };
  }, [idx, shownIdx, fade]);

  // 卸载时掐掉还在跑的原生动画（deps 只有稳定的 `fade`，所以只在卸载时执行一次）
  useEffect(
    () => () => {
      fade.stopAnimation();
    },
    [fade]
  );

  // 档位对齐：只处理**外面**改档（点指示点 / 从设置页保存回来）。
  // 用 `animated: false` 一步跳准 —— 动画式滚动会路过中间几档，
  // 那些中间偏移会被下面的落位逻辑当成"用户滑到了那一档"，造成连锁换档。
  useEffect(() => {
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ x: idx * step, y: 0, animated: false });
  }, [idx, step]);

  /** 滚动停稳了：按最新偏移落到最近的整卡 */
  const commit = useCallback(
    (x: number) => {
      const i = Math.min(n - 1, Math.max(0, Math.round(x / step)));
      if (ALL_KEYS[i] === activeKey) return; // 已经是这档了
      fromScroll.current = true;
      onSelect(ALL_KEYS[i]);
    },
    [n, step, activeKey, onSelect]
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastX.current = e.nativeEvent.contentOffset.x;
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        settle.current = null;
        commit(lastX.current);
      }, SCROLL_SETTLE_MS);
    },
    [commit]
  );

  // 卸载时清掉计时器，免得对已卸载组件 setState
  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    []
  );

  const goTo = useCallback(
    (i: number) => {
      const j = Math.min(n - 1, Math.max(0, i));
      if (ALL_KEYS[j] === activeKey) return; // 已经是这档了，别再回调
      onSelect(ALL_KEYS[j]);
    },
    [n, activeKey, onSelect]
  );

  const shownKey = ALL_KEYS[shownIdx];
  const shownCfg = cfgOfSlots(shownKey, slots);
  const shownPool = useMemo(
    () => (shownCfg ? buildPool(VERBS, shownCfg).length : 0),
    [shownCfg]
  );
  const tenseNames = shownCfg
    ? shownCfg.tenses
        .map((k: TenseKey) => (T[k] ? (lang === 'en' ? T[k].en : T[k].zh) : k))
        .join(' / ')
    : '';

  return (
    <View testID={testID}>
      {/* ------------------------------ 轨道 ------------------------------ */}
      <View
        testID={testID ? `${testID}-stage` : undefined}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== availW) setAvailW(w);
        }}
      >
        <ScrollView
          ref={scrollRef}
          testID={testID ? `${testID}-scroll` : undefined}
          horizontal
          showsHorizontalScrollIndicator={false}
          // fast + 关掉区间惯性：甩得再快也只走一档（上一版"一下跳两档"的病根）
          decelerationRate="fast"
          disableIntervalMomentum
          snapToInterval={step}
          snapToAlignment="start"
          // 落位只听 onScroll（+120ms 静默），松手事件的 contentOffset 在真机上不可靠
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: peek }}
          style={styles.track}
        >
          {ALL_KEYS.map((k, i) => (
            <Card
              key={k}
              slotKey={k}
              slots={slots}
              width={cardW}
              // 行容器（contentContainer）默认 alignItems: 'stretch' → 每张卡都被
              // 拉成行高，等高是这么来的，不需要逐张量高度
              style={i < n - 1 ? { marginRight: gap } : null}
              lang={lang}
              t={t}
              onEdit={onEdit}
              testID={testID}
            />
          ))}
        </ScrollView>
      </View>

      {/* ---------------------------- 指示点 ---------------------------- */}
      <View style={styles.dots}>
        {ALL_KEYS.map((k, i) => (
          <Pressable
            key={k}
            testID={testID ? `${testID}-dot-${k}` : undefined}
            onPress={() => goTo(i)}
            accessibilityRole="button"
            accessibilityLabel={keyName(k, lang)}
            accessibilityState={{ selected: i === idx }}
            // 圆点本身就是触摸目标（7px 太小，靠 hitSlop 补到 ~19px）
            hitSlop={6}
            style={[styles.dot, i === idx ? styles.dotOn : null]}
          />
        ))}
      </View>

      {/* ------------------- 词库详情（常驻联动，只读） ------------------- */}
      {/* 详情下的提示行（「预设档不可改 / 自定义槽去点编辑」）按简约要求删掉了：
          「编辑」按钮就长在自定义槽卡片右上角，不需要再用文字指路 */}
      <Animated.View testID={testID ? `${testID}-fade-detail` : undefined} style={{ opacity: fade }}>
        <View style={styles.detail} testID={testID ? `${testID}-detail` : undefined}>
          <KV
            k={t('lbLib')}
            v={`${shownCfg ? shownCfg.levels.join(' · ') : ''} · ${t('presetCount', shownPool)}`}
          />
          <KV k={t('lbTense')} v={tenseNames || t('lbNone')} />
          <KV
            k={t('lbInput')}
            v={shownCfg && shownCfg.inputMode === 'choice' ? t('typeChoice') : t('typeType')}
          />
        </View>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

/** 一张难度卡（6 张同时挂在轨道上，各算各的配置） */
function Card({
  slotKey,
  slots,
  width,
  style,
  lang,
  t,
  onEdit,
  testID,
}: {
  slotKey: string;
  slots: Record<string, PresetCfg>;
  width: number;
  style: { marginRight: number } | null;
  lang: Lang;
  t: ReturnType<typeof useI18n>['t'];
  onEdit?: (k: string) => void;
  testID?: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const cfg = cfgOfSlots(slotKey, slots);
  const pool = useMemo(() => (cfg ? buildPool(VERBS, cfg).length : 0), [cfg]);
  const preset = presetOf(slotKey);
  const custom = isCustomKey(slotKey);

  return (
    <View
      testID={testID ? `${testID}-card-${slotKey}` : undefined}
      style={[styles.card, styles.cardOn, { width }, style]}
    >
      {custom && onEdit ? (
        <Pressable
          testID={testID ? `${testID}-edit-${slotKey}` : undefined}
          onPress={() => onEdit(slotKey)}
          accessibilityRole="button"
          accessibilityLabel={`${t('editCustom')} ${keyName(slotKey, lang)}`}
          accessibilityHint={t('slotEditHint')}
          hitSlop={8}
          style={styles.edit}
        >
          <Icon name="sliders-horizontal" size={14} color={theme.color.accent} />
          <Text style={styles.editTxt}>{t('editCustom')}</Text>
        </Pressable>
      ) : null}

      <Icon name={keyIcon(slotKey)} size={26} color={theme.color.accent} />
      <Text numberOfLines={2} style={styles.name}>
        {keyName(slotKey, lang)}
      </Text>
      <Text numberOfLines={2} style={styles.desc}>
        {preset
          ? preset.desc[lang]
          : t(
              'keyCustomInfo',
              cfg ? cfg.levels.join('/') : '',
              cfg ? cfg.tenses.length : 0,
              pool
            )}
      </Text>
      <Text style={styles.count}>{t('presetCount', pool)}</Text>
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.kv}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={styles.kvV}>{v}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /**
     * `flexGrow: 0` 是必须的 —— ScrollView 默认 `flexGrow: 1`，
     * 高度不受约束时会被撑开（还会带上父容器剩余空间），卡片行就不再"贴着内容"。
     */
    track: { flexGrow: 0 },

    card: {
      alignItems: 'center',
      gap: 5,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.color.line,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.card2,
      minHeight: 132,
      justifyContent: 'center',
    },
    /** 全部卡片恒是"选中"外观 —— 当前档由它是否居中 + 下面的指示点表达 */
    cardOn: { borderColor: theme.color.accent, backgroundColor: theme.color.accentSoft },
    edit: {
      position: 'absolute',
      top: 7,
      right: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: theme.color.card,
      borderWidth: 1,
      borderColor: theme.color.line,
      zIndex: 2,
    },
    editTxt: { fontSize: 11.5, fontWeight: '600', color: theme.color.accent },
    name: { fontSize: 13.5, fontWeight: '700', color: theme.color.ink, textAlign: 'center' },
    desc: { fontSize: 11.5, color: theme.color.sub, textAlign: 'center', lineHeight: 16 },
    count: { fontSize: 11.5, fontWeight: '600', color: theme.color.sub },

    dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 10 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.color.line2 },
    dotOn: { backgroundColor: theme.color.accent },

    detail: { marginTop: 12, gap: 2 },
    kv: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    kvK: { width: 42, fontSize: 12, color: theme.color.sub, fontWeight: '600' },
    kvV: { flex: 1, fontSize: 12, color: theme.color.ink, lineHeight: 17 },
  });

export default PresetCarousel;
