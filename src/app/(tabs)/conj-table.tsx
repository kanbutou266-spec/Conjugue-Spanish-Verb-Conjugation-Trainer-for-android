import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { PERSONS, IMP_LABEL, isImp } from '@/data/persons';
import { T, TENSE_GROUPS } from '@/data/tenses';
import { VERBS } from '@/data/verbs';
import { codesOf, forms, hlOf } from '@/engine/pool';
import { SUG_LIMIT, defaultTableVerb, searchVerbs } from '@/engine/search';
import { tagName, useI18n } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/components/Tag';
import { ConjText } from '@/ui/components/ConjText';
import { theme as defaultTheme, useTheme, type Theme } from '@/ui/theme';
import { norm } from '@/utils/unicode';

import type { HlRow, Lang, PersonIdx, TenseKey, Verb } from '@/data/types';
import type { LayoutChangeEvent } from 'react-native';

/**
 * 变位查询页 —— 对应网页右栏抽屉 `#dw`（renderTable / tblBlock / searchVerbs）。
 *
 * RN 上是**底栏第三个 tab**（用户 2026-10-04：「变位查询的入口＝底栏的另一个键，
 * 与现在的练习键同类」）；作答页顶栏仍保留带参入口（点过去带着当前动词 + 时态 +
 * 人称，那一格直接高亮并滚到眼前）。首页启动栏里的小按钮随 tab 化移除。
 *
 * 结构（自上而下）：
 *   顶栏（标题 / 词库数） → 查询框 + 建议列表 → 动词头（原形 / 等级 /
 *   释义 / 标签 / 着色图例） → 四个语式分组卡（每个时态对一张卡：
 *   主语一列共用，左简单右复合同行对齐） → RAE 外链页脚。
 *
 * 排版（用户 2026-10-04 定稿）：**每行主语只显示一次**，简单时态和复合时态
 * 共用——原来左右两块各自带一套主语列，复合形式一折行两边行数就对不上。
 * 现在一个时态对渲染成一张卡：头行两列时态名，下面每行
 * `[主语 | 左形式 | 右形式]`，行对齐由布局结构本身保证。
 *
 * 折行与缩字**全部交给 `ConjText`**（词间折行、单词超格才缩字）。
 */

/** 与网页 `TBL_ROWS` 一致：每个语式按「左简单 / 右复合」两列排 */
const TBL_ROWS: { g: string; rows: ([TenseKey | null, TenseKey | null])[]; cap?: 'affirm' }[] = [
  { g: 'ind', rows: [['p', 'pp'], ['pr', null], ['i', 'pq'], ['f', 'fp']] },
  { g: 'cond', rows: [['c', 'cp']] },
  { g: 'sub', rows: [['sp', 'spt'], ['si', 'sq']] },
  { g: 'imp', rows: [['ia', 'in']], cap: 'affirm' },
];

/** 一个时态预取好的形式 / 着色码 / 高亮位（每时态只算一次，行间共用） */
interface Side {
  k: TenseKey;
  f: string[] | null;
  code: string;
  hl: HlRow | null;
}

/** 顶栏是否画返回键（被 practice push 进来才带）—— props 化好让 tab / push 两版复用 */
export interface ConjTableProps {
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function ConjTableScreen(props: ConjTableProps = {}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const router = useRouter();

  /* 路由参数：作答页跳过来时带当前动词 / 时态 / 人称，那一格高亮 */
  const params = useLocalSearchParams<{ inf?: string; t?: string; p?: string }>();
  const hiT = params.t && T[params.t] ? (params.t as TenseKey) : null;
  const hiP = params.p != null && params.p !== '' ? (Number(params.p) || 0) as PersonIdx : null;

  const [verb, setVerb] = useState<string>(() =>
    params.inf && VERBS.some((v) => v.i === params.inf) ? params.inf : defaultTableVerb()
  );
  const [query, setQuery] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  /** 高亮块的纵向位置：量到一次就滚过去（只滚这一回，用户手动滚不被打断） */
  const hiY = useRef<number | null>(null);
  const scrolled = useRef(false);

  const onHiLayout = useCallback((e: LayoutChangeEvent) => {
    hiY.current = Math.round(e.nativeEvent.layout.y);
  }, []);

  useEffect(() => {
    if (scrolled.current || hiY.current == null || !scrollRef.current) return;
    scrolled.current = true;
    scrollRef.current.scrollTo({ y: Math.max(0, hiY.current - 8), animated: false });
  });

  const v = useMemo(() => VERBS.find((x) => x.i === verb) ?? VERBS[0], [verb]);

  /* 建议列表：有输入、且不等于当前动词时才出现（网页 renderSug 同口径） */
  const sug = useMemo(() => {
    const q = query.trim();
    if (!q || norm(q) === norm(v?.i ?? '')) return null;
    return { q, list: searchVerbs(q).slice(0, SUG_LIMIT), total: searchVerbs(q).length };
  }, [query, v]);

  if (!v) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.hint}>{t('emptyPoolAlert')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ---------------------------- 顶栏 ---------------------------- */}
      <View style={styles.topbar}>
        {props.showBackButton ? (
          <Pressable
            testID="table-back"
            onPress={() => (props.onBack ? props.onBack() : router.back())}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            hitSlop={8}
            style={styles.tBackBtn}
          >
            <Icon name="arrow-left" size={20} color={theme.color.ink} />
          </Pressable>
        ) : null}
        <Text style={styles.ttl}>{t('navTable')}</Text>
        <Text testID="dw-count" style={styles.cnt}>
          {t('dwCount', VERBS.length)}
        </Text>
      </View>

      {/* --------------------------- 查询框 --------------------------- */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={theme.color.sub} />
          <TextInput
            testID="dw-q"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('dwPh')}
            placeholderTextColor={theme.color.faint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable
              testID="dw-clear"
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel={t('clearInput')}
              hitSlop={6}
            >
              <Icon name="x" size={16} color={theme.color.sub} />
            </Pressable>
          ) : null}
        </View>

        {/* 建议列表（网页 dw-sug）：内联渲染，点一条就切过去 */}
        {sug ? (
          <View testID="dw-sug" style={styles.sug}>
            {sug.list.map((hit) => {
              const sv = VERBS[hit.idx];
              return (
                <Pressable
                  key={sv.i}
                  testID={`sug-${sv.i}`}
                  onPress={() => {
                    setVerb(sv.i);
                    setQuery('');
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.sugRow, pressed ? styles.sugCur : null]}
                >
                  <Text style={styles.sugInf}>{sv.i}</Text>
                  <Text style={styles.sugZh}>{lang === 'en' ? sv.e || sv.z : sv.z}</Text>
                  {hit.form ? (
                    <Text style={styles.sugHit}>
                      {hit.form} · {lang === 'en' ? T[hit.tk].en : T[hit.tk].zh}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
            {sug.total > sug.list.length ? (
              <Text style={styles.sugNone}>{t('sugMore', sug.total - sug.list.length)}</Text>
            ) : null}
            {sug.list.length === 0 ? (
              <Text style={styles.sugNone}>{t('sugNone', sug.q)}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* --------------------------- 表体 --------------------------- */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 30 + insets.bottom + BottomTabInset },
        ]}
      >
        {/* 动词头：原形 + 释义同行（用户 2026-10-04），等级标签与词性标签共用一行 */}
        <View style={styles.vhead}>
          <Text testID="dw-inf" style={styles.vinf}>
            {v.i}
          </Text>
          <Text testID="dw-zh" style={styles.vzhInline}>
            {lang === 'en' ? v.e || v.z : v.z}
          </Text>
        </View>
        {(v.l || (v.g && v.g.length)) ? (
          <View testID="dw-tags" style={styles.vtagRow}>
            {v.l ? <Tag tone="plain">{v.l}</Tag> : null}
            {v.g && v.g.map((x) => (
              <Tag key={x} tone="plain">
                {tagName(x, lang)}
              </Tag>
            ))}
          </View>
        ) : null}

        {/* 着色图例（网页 formLegend）——只留三色点，那句「着色只落在…」
            的说明文按用户 2026-10-04 要求删掉了 */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendKey, { backgroundColor: theme.color.fIrr }]} />
            <Text style={styles.legendTxt}>{t('lgIrr')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendKey, { backgroundColor: theme.color.fOrth }]} />
            <Text style={styles.legendTxt}>{t('lgOrth')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendKey, { backgroundColor: theme.color.fStem }]} />
            <Text style={styles.legendTxt}>{t('lgStem')}</Text>
          </View>
        </View>

        {/* 「左栏简单、右栏复合…」的说明文也删了 —— 列头自己会说话 */}

        {/* 四个语式分组卡 */}
        {TBL_ROWS.map((gp) => {
          const g = TENSE_GROUPS.find((x) => x.k === gp.g)!;
          const n = gp.rows.reduce((a, r) => a + r.filter(Boolean).length, 0);
          return (
            <View key={gp.g} testID={`dwg-${gp.g}`} style={styles.group}>
              <View style={styles.gHead}>
                <Text style={[styles.gName, { color: theme.mood[g.k as keyof typeof theme.mood].ink }]}>
                  {lang === 'en' ? g.en : g.zh}
                </Text>
                <Text style={styles.gEs}>{g.es}</Text>
                <Text style={styles.gCnt}>{n}</Text>
              </View>
              {/* 两列头（用户 2026-10-04：去掉了「简单/复合/肯定/否定」那一行说明） */}
              {gp.rows.map((r, ri) => (
                <TblPair
                  key={ri}
                  v={v}
                  left={r[0]}
                  right={r[1]}
                  lang={lang}
                  hiT={hiT}
                  hiP={hiP}
                  onHiLayout={onHiLayout}
                />
              ))}
            </View>
          );
        })}

        {/* 页脚：RAE 官方外链（网页 tfoot；讲解页入口等 guide 页做完再补） */}
        <View style={styles.tfoot}>
          <Text style={styles.tfootMeta}>{t('tblAuth')}</Text>
          <Text
            testID="rae-link"
            style={styles.tfootLink}
            onPress={() => Linking.openURL(`https://dle.rae.es/${encodeURIComponent(v.i)}?m=form`)}
          >
            {t('tblRae')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ==================================================================== *
 * 时态对（一卡 = 左简单 + 右复合，主语列共用）
 * ==================================================================== */

/**
 * 一个时态对（网页里是两个 tblBlock 并排；RN 按用户 2026-10-04 改成一张卡）：
 * 头行左右两列时态名，下面每人一行 `[主语 | 左形式 | 右形式]`。
 * 右侧为 null 时（简单过去时 ←→ 前过去时留空）：头行右格画「—」+ 说明文字，
 * 人称行只有左形式占满整行宽。
 */
function TblPair({
  v,
  left,
  right,
  lang,
  hiT,
  hiP,
  onHiLayout,
}: {
  v: Verb;
  /** null = 右侧留空位（前过去时 hube + 分词） */
  left: TenseKey | null;
  right: TenseKey | null;
  lang: Lang;
  /** 高亮的时态（从作答页跳过来时）；null = 不高亮 */
  hiT: TenseKey | null;
  /** 高亮的人称下标 */
  hiP: PersonIdx | null;
  /** 高亮卡的布局回调（滚动定位用） */
  onHiLayout?: (e: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const imp = (left != null && isImp(left)) || (right != null && isImp(right));
  // 命令式没有 yo：从 tú 开始画五格（网页 personGrid 的 idx = [1..5]）
  const idxs: PersonIdx[] = imp ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5];
  const isHi = hiT != null && (hiT === left || hiT === right);
  /** 高亮那一对的边框/底色跟着**该时态的语式**走（网页 `.dwb.hi` 用 --gb/--gs） */
  const hiMood = isHi && hiT ? theme.mood[T[hiT].g] : null;

  // 每个时态的 forms / code / hl 只算一次，六行共用
  const sides: (Side | null)[] = [
    left ? { k: left, f: forms(v, left), code: codesOf(v, left), hl: hlOf(v, left) } : null,
    right ? { k: right, f: forms(v, right), code: codesOf(v, right), hl: hlOf(v, right) } : null,
  ];

  return (
    <View
      testID={`dwp-${left ?? 'x'}-${right ?? 'x'}`}
      style={[styles.pair, hiMood ? { backgroundColor: hiMood.soft, borderColor: hiMood.border } : null]}
      onLayout={isHi ? onHiLayout : undefined}
    >
      {/* 头行：左右两列时态名（用户 2026-10-04：中文居中粗体、西语副文，统一两行）
         —— 原来那个有色底药丸在长时态名（如「虚拟式过去未完成时」）上长短不齐，
            现在按两行对齐、文本 cell 等比片铺，长名 adjustsFontSizeToFit 缩字。
         用户 2026-10-05：留空位那格**只画一个「—」**，长的说明文挪到卡底一行 ——
         原来那段说明文在这一格里折成 4 行，把整个头行撑高，左边那格显得空了一大块。 */}
      <View style={styles.pairHead}>
        {sides.map((s, si) =>
          s ? (
            <View key={si} style={styles.headCell}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={[styles.tenseZh, { color: theme.mood[T[s.k].g].ink }]}
              >
                {lang === 'en' ? T[s.k].en : T[s.k].zh}
              </Text>
              <Text style={styles.tenseEs}>{T[s.k].es}</Text>
            </View>
          ) : (
            <View key={si} testID="dwb-none" style={styles.headNone}>
              <Text style={styles.tenseZh}>—</Text>
              <Text style={styles.tenseEs}>{''}</Text>
            </View>
          )
        )}
      </View>

      {/* 人称行：主语一列共用，简单 / 复合同行对齐 —— 复合形式折行只会把
          这一行撑高，左右两列永远不会错位。
          用户 2026-10-05：每行之间加一条极细的分割线，六个（命令式五个）人称
          一眼能分清；第一行不画，免得贴着卡片上沿。 */}
      {idxs.map((i, ri) => (
        <View key={i} style={[styles.prow, ri > 0 ? styles.prowSep : null]}>
          <Text style={styles.pl}>{imp ? IMP_LABEL[i] ?? PERSONS[i].l : PERSONS[i].sl}</Text>
          {sides.map((s, si) =>
            s ? <TblCell key={si} s={s} i={i} hi={hiT === s.k ? hiP : null} /> : null
          )}
        </View>
      ))}
      {/* 留空位那格原有的一行说明文（tr('tblGap')，讲前过去时 hube+分词）
          按用户 2026-10-05 要求删除 —— 头行那个「—」已足够表意。 */}
    </View>
  );
}

/** 时态对里一格变位形式（一个时态 × 一个人称） */
function TblCell({ s, i, hi }: { s: Side; i: PersonIdx; hi: PersonIdx | null }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const val = String((s.f && s.f[i]) || '').trim();
  return (
    <View
      testID={`dwc-${s.k}-p${i}`}
      style={[styles.cell, hi != null && hi === i ? styles.cellHi : null]}
    >
      {val ? (
        <ConjText
          form={val}
          code={s.code}
          hl={s.hl}
          person={i}
          baseSize={13.5}
          minSize={10}
          weight="600"
          align="flex-start"
        />
      ) : (
        <Text style={styles.pformDash}>—</Text>
      )}
    </View>
  );
}

/* ==================================================================== *
 * 样式
 * ==================================================================== */

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hint: { fontSize: theme.font.sm, color: theme.color.sub, textAlign: 'center', lineHeight: 19 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: theme.color.bg,
  },
  ttl: { fontSize: 15, fontWeight: '700', color: theme.color.ink },
  cnt: { marginLeft: 'auto', fontSize: theme.font.xs, color: theme.color.sub },
  /** 推入式版本顶栏的退键（与练习页同款胶囊） */
  tBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.line,
  },

  searchWrap: { paddingHorizontal: 14, paddingBottom: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 11,
    backgroundColor: theme.color.card,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: theme.font.md, color: theme.color.ink, paddingVertical: 8 },

  sug: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 11,
    backgroundColor: theme.color.card,
    overflow: 'hidden',
  },
  sugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.line,
  },
  sugCur: { backgroundColor: theme.color.accentSoft },
  sugInf: { fontSize: 14, fontWeight: '600', color: theme.color.ink },
  sugZh: { fontSize: 12.5, color: theme.color.sub, flexShrink: 1 },
  sugHit: { marginLeft: 'auto', fontSize: 11.5, fontStyle: 'italic', color: theme.color.sub },
  sugNone: { fontSize: 12.5, color: theme.color.sub, padding: 10 },

  body: { flex: 1 },
  content: { padding: 14 },

  vhead: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, flexWrap: 'wrap' },
  vinf: { fontSize: 24, fontWeight: '700', color: theme.color.ink },
  /** 释义放在原形右边、灰色小字（用户 2026-10-04） */
  vzhInline: { fontSize: theme.font.sm, color: theme.color.sub, paddingBottom: 2 },
  vtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendKey: { width: 12, height: 12, borderRadius: 3 },
  legendTxt: { fontSize: 12, color: theme.color.sub },

  group: {
    marginTop: 12,
    backgroundColor: theme.color.raise,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 10,
  },
  gHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  gName: { fontSize: 14, fontWeight: '700' },
  gEs: { fontSize: 11, color: theme.color.sub },
  gCnt: { marginLeft: 'auto', fontSize: 11, color: theme.color.sub },

  /** 一个时态对一张卡：主语列共用，左右两列同行对齐 */
  pair: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 11,
    paddingVertical: 6,
    paddingHorizontal: 7,
    marginTop: 7,
    backgroundColor: theme.color.card,
  },
  /** 从作答页跳过来时高亮的那一对（网页 .dwb.hi） */
    pairHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 3 },
  /** 时态对头行里一格：列向居中、上中文下西语，统一两行 */
  headCell: { flex: 1, minWidth: 0, alignItems: 'center' },
  /** 留空位（前过去时）的那一格：**只有头行一个「—」**，说明文挪到卡底（用户 2026-10-05）。
      上下结构与 headCell 完全一致（两行），头行高度才不会被撑高。 */
  headNone: { flex: 1, minWidth: 0, alignItems: 'center' },
  /** 留空位的说明文：整卡一行、卡片最下方、左侧对齐（不再挤在半格里折成四行） */
  /** 中文时态名：居中粗体、长名 adapts 缩字 */
  tenseZh: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  /** 西语副文：浅灰小号、紧贴中文 */
  tenseEs: { fontSize: 10, color: theme.color.sub, marginTop: 1, textAlign: 'center' },

  prow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 6,
    paddingVertical: 1,
  },
  /** 人称行之间的极细分割线（第一行不画）—— 用户 2026-10-05 */
  prowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line },
  /** 共用的主语列（网页 .pcell 的 .sl，短标签右对齐）——
         宽 58 是为「ellos」/「ellas」/「ustedes」这种 5 字母短标签不折行
         （用户 2026-10-04）。es 命令式正字段（「virtudeless」）宽度也一样。 */
  pl: {
    width: 58,
    fontSize: 10,
    color: theme.color.sub,
    textAlign: 'right',
    lineHeight: 19,
  },
  cell: { flex: 1, minWidth: 0, borderRadius: 6, paddingHorizontal: 3 },
  /** 高亮的那一格（网页 .pcell.hi） */
  cellHi: { backgroundColor: theme.color.accentSoft },
  pformDash: { fontSize: 13.5, color: theme.color.sub, lineHeight: 19 },

  tfoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  tfootMeta: { fontSize: 13, color: theme.color.sub },
  tfootLink: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.accent,
    textDecorationLine: 'underline',
  },
  });

/**
 * 亮色快照（测试引用它的几何值：`prowSep` / `pl.width`）；
 * 组件里一律走 `makeStyles(useTheme())` 才能跟着主题变。
 */
export const styles = makeStyles(defaultTheme);
