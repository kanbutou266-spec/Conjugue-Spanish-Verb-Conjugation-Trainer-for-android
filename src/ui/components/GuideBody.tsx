import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { T } from '@/data/tenses';
import { VERBS } from '@/data/verbs';
import { codesOf, forms, hlOf } from '@/engine/pool';
import { useTheme, type Theme } from '@/ui/theme';
import { PersonGrid } from './PersonGrid';

import type { Block, Inline, TipTone } from '@/engine/guide';
import type { Lang, TenseKey } from '@/data/types';
import type { ReactNode } from 'react';

/**
 * 讲解正文渲染器 —— 把 `engine/guide.ts` 解析出来的节点树画成 RN 视图。
 *
 * 逐值照抄网页 `.gd` 那套 CSS（`app_template.html` 第 249-294 行）：
 *   p      15px / line-height 1.8 / margin 9
 *   ul     15px / line-height 1.8 / 左缩进 20，li 间距 5
 *   h3     13.5px 700（bodyInk2）字距 1 + 左侧 3px 主色条（色条只占标题那一行）
 *   .es    tag 底 / 圆角 6 / 内边距 1×7 / 13.5px / bodyInk 字
 *   .tip   左 4px 色条 + 浅底 + 右圆角 10，14.5px / line-height 1.75
 *   table  14px，单元格下线 + padding 6×9
 *
 * `{{G:…}}` 宏渲染成内嵌变位网格（网页 `.gex`）：动词头 + 六人称网格。
 * 手机宽度一定小于网页那条 520px 断点，所以网页的「一行两个动词」在手机上
 * 本来就会折成**一行一个**，这里直接按整行宽竖排 —— 与网页窄屏表现一致。
 */
export interface GuideBodyProps {
  blocks: Block[];
  lang: Lang;
  testID?: string;
}

/** 行内节点 → 文本/嵌套 Text（样式随主题传入） */
function inlineNodes(
  kids: Inline[],
  lang: Lang,
  styles: ReturnType<typeof makeStyles>
): ReactNode[] {
  return kids.map((k, i) => {
    switch (k.t) {
      case 'text':
        return k.v;
      case 'br':
        return '\n';
      case 'b':
        return (
          <Text key={i} style={styles.b}>
            {inlineNodes(k.kids, lang, styles)}
          </Text>
        );
      case 'i':
        return (
          <Text key={i} style={styles.i}>
            {inlineNodes(k.kids, lang, styles)}
          </Text>
        );
      case 's':
        return (
          <Text key={i} style={styles.s}>
            {inlineNodes(k.kids, lang, styles)}
          </Text>
        );
      case 'es':
        return (
          <Text key={i} style={styles.es}>
            {inlineNodes(k.kids, lang, styles)}
          </Text>
        );
      case 'G':
        // 宏只出现在块级；万一混进行内，就按纯文本兜底，不白屏
        return `{{G:${k.verbs.join(',')}|${k.tense}}}`;
      default:
        return null;
    }
  });
}

const makeTip = (theme: Theme): Record<TipTone, { line: string; bg: string }> => ({
  tip: { line: theme.color.warn, bg: theme.color.warnSoft },
  ok: { line: theme.color.ok, bg: theme.color.okSoft },
  warn: { line: theme.color.bad, bg: theme.color.badSoft },
});

/** 内嵌变位网格（网页 `guideGrid` 的 `.gex` 部分） */
function ConjGrid({ verbs, tense, lang }: { verbs: string[]; tense: TenseKey; lang: Lang }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const t = T[tense];
  if (!t) return null;
  const known = verbs
    .map((name) => VERBS.find((v) => v.i === name.trim()))
    .filter((v): v is NonNullable<typeof v> => !!v);
  if (!known.length) return null;

  return (
    <View testID={`g-${tense}`}>
      {known.map((v) => {
        const f = forms(v, tense);
        if (!f) return null;
        const mood = theme.mood[t.g];
        return (
          <View key={v.i} style={styles.gex} testID={`gex-${v.i}-${tense}`}>
            <View style={styles.gexHead}>
              <Text style={styles.gexVerb}>{v.i}</Text>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: mood.soft, borderColor: mood.border },
                ]}
              >
                <Text style={[styles.pillTxt, { color: mood.ink }]}>
                  {lang === 'en' ? t.en : t.zh}
                </Text>
              </View>
              <Text style={styles.gexZh}>{lang === 'en' ? v.e || v.z : v.z}</Text>
            </View>
            <View style={styles.gexGrid}>
              <PersonGrid
                forms={f}
                code={codesOf(v, tense)}
                hl={hlOf(v, tense)}
                tense={tense}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function GuideBody({ blocks, lang, testID }: GuideBodyProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tip = useMemo(() => makeTip(theme), [theme]);
  return (
    <View testID={testID}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h3':
            return (
              <View key={i} style={[styles.h3Row, i === 0 ? styles.h3First : null]}>
                <View style={styles.h3Bar} />
                <Text style={styles.h3}>{inlineNodes(b.kids, lang, styles)}</Text>
              </View>
            );
          case 'p':
            return (
              <Text key={i} style={styles.p}>
                {inlineNodes(b.kids, lang, styles)}
              </Text>
            );
          case 'ul':
            return (
              <View key={i} style={styles.ul}>
                {b.items.map((it, j) => (
                  <View key={j} style={styles.li}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.liTxt}>{inlineNodes(it, lang, styles)}</Text>
                  </View>
                ))}
              </View>
            );
          case 'tip': {
            const tone = tip[b.tone];
            return (
              <View
                key={i}
                style={[
                  styles.tip,
                  { borderLeftColor: tone.line, backgroundColor: tone.bg },
                ]}
              >
                <Text style={styles.tipTxt}>{inlineNodes(b.kids, lang, styles)}</Text>
              </View>
            );
          }
          case 'table':
            return (
              <View key={i} style={styles.table}>
                {b.rows.map((r, j) => (
                  <View key={j} style={styles.tr}>
                    {r.cells.map((c, k) => (
                      <View key={k} style={styles.td}>
                        <Text style={r.head ? styles.thTxt : styles.tdTxt}>
                          {inlineNodes(c, lang, styles)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          case 'G':
            return <ConjGrid key={i} verbs={b.verbs} tense={b.tense} lang={lang} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /* ---- 小标题：左侧 3px 主色条 + 灰字小标题 ---- */
    h3Row: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 30, marginBottom: 13 },
    h3First: { marginTop: 4 },
    h3Bar: { width: 3, borderRadius: 2, backgroundColor: theme.color.accent },
    h3: { flex: 1, fontSize: 13.5, fontWeight: '700', color: theme.color.bodyInk2, letterSpacing: 1 },

    p: { fontSize: 15, lineHeight: 15 * 1.8, color: theme.color.ink, marginVertical: 9 },

    ul: { marginTop: 10, marginBottom: 10, paddingLeft: 20 },
    li: { flexDirection: 'row', gap: 7, marginVertical: 5 },
    bullet: { fontSize: 15, lineHeight: 15 * 1.8, color: theme.color.ink },
    liTxt: { flex: 1, fontSize: 15, lineHeight: 15 * 1.8, color: theme.color.ink },

    b: { fontWeight: '700' },
    i: { fontStyle: 'italic' },
    s: { textDecorationLine: 'line-through', color: theme.color.sub },
    es: {
      backgroundColor: theme.color.tag,
      borderRadius: 6,
      color: theme.color.bodyInk,
      fontSize: 13.5,
      paddingHorizontal: 7,
      paddingVertical: 1,
    },

    tip: {
      borderLeftWidth: 4,
      borderRadius: 10,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginVertical: 14,
    },
    tipTxt: { fontSize: 14.5, lineHeight: 14.5 * 1.75, color: theme.color.ink },

    table: { marginVertical: 12 },
    tr: { flexDirection: 'row' },
    td: { flex: 1, borderBottomWidth: 1, borderBottomColor: theme.color.line, paddingVertical: 6, paddingHorizontal: 9 },
    thTxt: { fontSize: 14, fontWeight: '700', color: theme.color.ink, textAlign: 'center' },
    tdTxt: { fontSize: 14, color: theme.color.ink },

    /* ---- 内嵌变位网格（网页 .gex） ---- */
    gex: {
      borderWidth: 1,
      borderColor: theme.color.line,
      borderRadius: 12,
      backgroundColor: theme.color.card2,
      paddingTop: 9,
      paddingHorizontal: 10,
      paddingBottom: 11,
      marginTop: 11,
      marginBottom: 4,
    },
    gexHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
    gexVerb: { fontSize: 16.5, fontWeight: '700', color: theme.color.ink, letterSpacing: 0.2 },
    gexZh: { fontSize: 12.5, color: theme.color.sub },
    pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
    pillTxt: { fontSize: 11.5, fontWeight: '700' },
    gexGrid: { marginTop: 7 },
  });
