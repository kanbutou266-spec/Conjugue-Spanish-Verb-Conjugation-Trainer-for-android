import { Text } from 'react-native';

import { parseRich } from '@/i18n/rich';

import type { StyleProp, TextStyle } from 'react-native';

export interface RichTextProps {
  /** 带 `[[…]]` 强调标记的文案（来自 `t()`） */
  text: string;
  style?: StyleProp<TextStyle>;
  /** 强调段的样式；默认只加粗（对应网页的 `<b>`），颜色随父级 */
  strongStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
}

const STRONG: TextStyle = { fontWeight: '700' };

/**
 * 渲染带 `[[…]]` 标记的文案。
 *
 * 没有标记时**直接渲染成单个字符串**，不多套一层 `<Text>` ——
 * 应用里绝大多数文案是平文，别为每一条都付一次节点成本。
 */
export function RichText({ text, style, strongStyle, numberOfLines, testID }: RichTextProps) {
  const segs = parseRich(text);
  if (segs.length === 1 && segs[0].kind === 'plain') {
    return (
      <Text style={style} numberOfLines={numberOfLines} testID={testID}>
        {segs[0].text}
      </Text>
    );
  }
  return (
    <Text style={style} numberOfLines={numberOfLines} testID={testID}>
      {segs.map((s, i) =>
        s.kind === 'strong' ? (
          <Text key={i} style={strongStyle ?? STRONG}>
            {s.text}
          </Text>
        ) : (
          s.text
        )
      )}
    </Text>
  );
}
