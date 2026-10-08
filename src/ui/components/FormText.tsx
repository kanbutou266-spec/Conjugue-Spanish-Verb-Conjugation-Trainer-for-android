import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import type { HlRow, PersonIdx } from '@/data/types';
import { segments, type Segment, type SegmentKind } from '@/engine/highlight';
import { theme as defaultTheme, useTheme, type Theme } from '@/ui/theme';

/**
 * 变位形式的**着色文本** —— 网页版是拼 HTML 字符串（`marked()`），
 * RN 不能碰 innerHTML，这里把 `segments()` 的分段渲染成嵌套 `<Text>`。
 *
 * 三条硬规则（照抄网页 `app_template.html` 第 148-156 行的意图，改动前先读那段）：
 *   ① **只设 color**。内层 Text 绝不设 fontWeight / fontSize / letterSpacing /
 *      backgroundColor / padding —— 任一项与相邻字母不同，占宽就会变，
 *      整词的字距会忽宽忽窄。要加粗就在外层 `style` 上加，内层自然继承。
 *   ② **不铺底色**。网页的 `.hl` 是 `background:none;padding:0`，颜色只落在
 *      "真正变了的那几个字母"上。
 *   ③ 无区间 / 规则形式（码为 `.`）**整词同色**，由 `segments()` 直接返回单段。
 *
 * 用法：
 *   <FormText form="pienso" code={v.c.p} hl={v.h.p} person={0} />
 *   <FormText form={q.answer} plain style={{ fontSize: theme.font.xxl }} />
 */

/** 变化字母的颜色：与网页版 `--f-irr` / `--f-orth` / `--f-stem` 一致（随主题走） */
export function segmentColor(kind: SegmentKind, theme: Theme = defaultTheme): string | undefined {
  switch (kind) {
    case 'i':
      return theme.color.fIrr;
    case 'o':
      return theme.color.fOrth;
    case 's':
      return theme.color.fStem;
    default:
      // plain：不上色，继承父级 color
      return undefined;
  }
}

export interface FormTextProps {
  /** 要显示的变位形式，如 'pienso' / 'me acuesto' */
  form: string;
  /** 该时态的 6 位着色码（`v.c[k]`）；缺省视为全规则 */
  code?: string | null;
  /** 该时态的 6 个人称变化区间（`v.h[k]`）；缺省视为无区间 */
  hl?: HlRow | null;
  /** 人称下标，决定读哪一位；缺省 0（yo） */
  person?: PersonIdx;
  /** 强制单色输出（如"隐藏原形"、答案回显、或本就不想染色时） */
  plain?: boolean;
  /** 外层样式：字号/字重/行高都放这里，别放到内层 */
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** 无障碍朗读用；不传则用 form 本身 */
  accessibilityLabel?: string;
  testID?: string;
}

export function FormText({
  form,
  code,
  hl,
  person = 0,
  plain = false,
  style,
  numberOfLines,
  accessibilityLabel,
  testID,
}: FormTextProps) {
  const theme = useTheme();
  const parts: Segment[] = plain
    ? [{ text: String(form ?? ''), kind: 'plain' }]
    : segments(form, code, hl, person);

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel ?? form}
      testID={testID}
    >
      {parts.map((seg, i) => {
        const color = segmentColor(seg.kind, theme);
        // plain 段不套 <Text>（少一层布局节点），直接以字符串入列；
        // 需要上色的段才生成内层 Text，且**只带 color**。
        if (color === undefined) return seg.text;
        return (
          <Text key={i} style={{ color }}>
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}

export default FormText;
