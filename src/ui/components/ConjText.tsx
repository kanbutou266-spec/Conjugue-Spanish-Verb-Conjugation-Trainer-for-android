import { useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import type { HlRow, PersonIdx } from '@/data/types';
import { segments, wordSegments } from '@/engine/highlight';
import { CHAR_W_FACTOR, WORD_GAP_FACTOR, fitFontSize, wordExceeds } from '@/ui/fitText';
import { useTheme, type Theme } from '@/ui/theme';
import { segmentColor } from './FormText';

import type { LayoutChangeEvent, StyleProp, TextStyle, ViewStyle } from 'react-native';
import type { Segment } from '@/engine/highlight';

/**
 * **会自己折行的变位形式** —— 作答页题干、六人称对照网格、变位表都用它。
 *
 * 与 `FormText` 的分工：
 *   · `FormText` 是**着色原语**：一个 `<Text>` 里套若干只带 color 的内层 `<Text>`，
 *     它不认识"词"，长串交给系统去折行（安卓会在词中间硬断）。
 *   · `ConjText` 是**排版层**：先用 `wordSegments()` 把着色分段切成一个个词，
 *     每个词渲染成独立的 `<Text>`，放进一个 `flexWrap` 的行容器 ——
 *     折行只发生在**词与词之间**，词内部永远是原子的。
 *
 * 两条用户明确要求（改这里之前先读 `ui/fitText.ts` 的注释）：
 *   ① 不从单词中间裂开换行；
 *   ② 两个词分两行没问题，一个词太长就**缩字号**。
 *
 * ==== 「绝不出现省略号」的三道保险（用户 2026-10-05、10-07 两次报同一问题）====
 *   ① **系统字号缩放进估算**：`Text` 默认 `allowFontScaling`，`fontSize` 会被系统的
 *      「字体大小」再乘一遍 `fontScale`，而容器宽是真实 dp。不把 `fontScale` 算进去，
 *      用户把系统字体调大后长词就会溢出 —— 这是「有时候」的真正来源。见 `fitText.normFontScale`。
 *   ② **扣掉根容器自己的左右内边距**：`onLayout` 量到的是边框盒宽度，而
 *      `style`（如作答页 `stemForm: paddingHorizontal 4`）会再吃掉 8px；
 *      不减掉的话可用宽永远虚高 8px，边缘刚好临界的长词就会溢出。
 *   ③ **触底就放开 `numberOfLines`**：万一缩到 `minSize` 仍装不下（超窄格 + 超长词），
 *      该词不再挂 `numberOfLines={1}`，允许它自己折成两行 —— 宁可难看，绝不丢字母。
 */
export interface ConjTextProps {
  /** 要显示的变位形式，如 'pienso' / 'me acuesto' / 'nos hubiéramos despertado' */
  form: string;
  /** 该时态的 6 位着色码（`v.c[k]`）；缺省视为全规则 */
  code?: string | null;
  /** 该时态的 6 个人称变化区间（`v.h[k]`）；缺省视为无区间 */
  hl?: HlRow | null;
  /** 人称下标，决定读哪一位；缺省 0（yo） */
  person?: PersonIdx;
  /** 强制单色输出（答案回显、不想染色时） */
  plain?: boolean;
  /** 基准字号（装得下就用它） */
  baseSize?: number;
  /** 缩字下限 */
  minSize?: number;
  /** 已知容器宽度（px）。不传就在根容器上 `onLayout` 自己量 */
  width?: number;
  color?: string;
  weight?: TextStyle['fontWeight'];
  /** 词间距系数（× 最终字号），默认 0.28 ≈ 一个空格 */
  gapFactor?: number;
  align?: 'center' | 'flex-start' | 'flex-end';
  /**
   * 根容器样式。**不要在这里设字号/字重** —— 它们由本组件按 `fitFontSize()` 算出来，
   * 设在 style 上会和内联值打架。
   */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function ConjText({
  form,
  code,
  hl,
  person = 0,
  plain = false,
  baseSize,
  minSize = 20,
  width,
  color,
  weight = '600',
  gapFactor = WORD_GAP_FACTOR,
  align = 'center',
  style,
  accessibilityLabel,
  testID,
}: ConjTextProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  // 未显式传字号/颜色时，按当前主题取默认（深色下要跟着变）
  const base = baseSize ?? theme.font.xxl;
  const ink = color ?? theme.color.ink;
  /** 系统「字体大小」缩放；`Text` 默认 allowFontScaling，字号实际会被再乘一遍 */
  const fontScale = PixelRatio.getFontScale();
  /** 容器实测宽度；传了 `width` 就以它为准（网格那种"已知半格宽"的场合） */
  const [measured, setMeasured] = useState(0);
  // `onLayout` 量到的是**边框盒**宽，`style` 上的左右内边距得先扣掉才是真正可用宽
  const padX = useMemo(() => horizontalPadding(style), [style]);
  const avail =
    width != null && width > 0
      ? // 外部给的已是「内容宽」（调用方自己算过内边距），不再重复扣
        width
      : Math.max(0, measured - padX);

  const onLayout = (e: LayoutChangeEvent) => {
    if (width != null) return; // 外部已给定，不用量
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== measured) setMeasured(w);
  };

  const size = fitFontSize({ text: form, avail, base, min: minSize, scale: fontScale });
  /** 量到宽度了才有资格判断「装不装得下」；没量到就先都放开，绝不提前截断 */
  const measuredOnce = avail > 0;

  const words: Segment[][] = plain
    ? wordSegments([{ text: String(form ?? ''), kind: 'plain' }])
    : wordSegments(segments(form, code, hl, person));

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel ?? form}
      style={[
        styles.row,
        // 用 flex 的 alignSelf 顶掉父级的 alignItems:center —— 这样根容器永远是
        // 「父容器的整条内容宽」，量到的 avail 才等于真正可用的宽度
        styles.stretch,
        { justifyContent: align, columnGap: Math.round(size * gapFactor) },
        style,
      ]}
    >
      {words.map((parts, i) => {
        const word = parts.map((p) => p.text).join('');
        // 超宽（多半是缩到 minSize 还是不够）→ 放开 numberOfLines，让它自己折行
        const clip = measuredOnce && !wordExceeds(word, avail, size, CHAR_W_FACTOR, fontScale);
        return (
          <Text
            key={i}
            // 装得下就锁一行（保证"词内绝不折断"）；装不下就放开（保证"绝不出省略号"）
            numberOfLines={clip ? 1 : undefined}
            style={{
              fontSize: size,
              fontWeight: weight,
              color: ink,
              // 缩过字号的长词再收一点字距 —— 网页 `.pcell b.sm/.xs` 也是这么做的
              // （`letter-spacing:-.2/-.3px`）。只会让词更窄，不会影响上面的宽度估算。
              letterSpacing: size < base ? -0.3 : undefined,
            }}
            // 每个词一个节点：安卓的 StaticLayout 因此没有机会在词内部找断点
          >
            {parts.map((seg, k) => {
              const c = segmentColor(seg.kind, theme);
              // 无色段直接以字符串入列（少一层布局节点），与 FormText 同一套做法
              return c === undefined ? (
                seg.text
              ) : (
                <Text key={k} style={{ color: c }}>
                  {seg.text}
                </Text>
              );
            })}
          </Text>
        );
      })}
    </View>
  );
}

/** 从（可能为数组 / 嵌套的）样式里取出左右内边距之和 */
function horizontalPadding(style: StyleProp<ViewStyle> | undefined): number {
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const h = Number(flat.paddingHorizontal);
  if (isFinite(h) && h > 0) return h * 2;
  const l = Number(flat.paddingLeft);
  const r = Number(flat.paddingRight);
  return (isFinite(l) ? l : 0) + (isFinite(r) ? r : 0);
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      // 同一行的词坐在同一条基线上，中英混排时不会忽高忽低
      alignItems: 'baseline',
    },
    stretch: { alignSelf: 'stretch' },
  });

export default ConjText;
