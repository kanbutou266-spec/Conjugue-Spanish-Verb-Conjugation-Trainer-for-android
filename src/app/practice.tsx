import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { modeDesc, modeName } from '@/data/modes';
import { PERSONS, mainPronoun, personLabel, personProSet } from '@/data/persons';
import { T, TENSE_GROUPS } from '@/data/tenses';
import { VERBS } from '@/data/verbs';
import { diagnose, judge, siAlt } from '@/engine/judge';
import { codesOf, forms, hlOf } from '@/engine/pool';
import { makeQuestion, recognizeTenseChips } from '@/engine/quiz';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/store/settings';
import { useStatsStore } from '@/store/stats';
import { Icon } from '@/ui/Icon';
import { Btn } from '@/ui/components/Btn';
import { Chip } from '@/ui/components/Chip';
import { ConjText } from '@/ui/components/ConjText';
import { PersonGrid } from '@/ui/components/PersonGrid';
import { RichText } from '@/ui/components/RichText';
import { Tag } from '@/ui/components/Tag';
import { useTheme, type Theme } from '@/ui/theme';
import { norm } from '@/utils/unicode';

import type { LayoutChangeEvent } from 'react-native';
import type { DiagKind, GroupKey, Lang, PersonIdx, Question, TenseKey } from '@/data/types';
import type { I18nKey, TextArg } from '@/i18n';

/** `useI18n()` 的 `t` —— 第一个参数是文案键，不能用 `TFn` 标注 */
type Tr = (key: I18nKey, ...args: TextArg[]) => string;

/**
 * 练习作答页 —— 对应网页 `#scr-practice`（方案 §3.2）。
 *
 * 推入式全屏（Stack 里已注册，底部 tab 栏会消失），顶栏只剩「返回 / 进度 / 正确率」。
 *
 * 页面状态就一份：`items`（出过的题，含作答结果）+ `cur`（当前在第几题）。
 * 作答数据**直接挂在 `Question` 上**（`pickPerson` / `pickTense` / `userInf` /
 * `userAnswer` / `correct`）—— `Question` 类型里本来就留了这些字段（对应网页
 * `SESS.history[i]` 的用法），所以「上一题」翻回去时**作答痕迹原样还在**，
 * 不需要另开一份平行的状态去同步。
 *
 * 唯一不在 `Question` 上的是输入框的**实时文本** `draft`：它每敲一个字母都变，
 * 塞进 items 会让整页每键重渲染一次；提交/翻页时才写回题目对象。
 *
 * 判分口径**逐条对照网页 `submitAnswer()`**，尤其辨认模式的「三项」：
 *   `ok = infOK && (askTense ? hits 含 (selPerson, selTense) : personOK)`
 * 同形多读法（compramos 既是现在时也是简单过去时）走 `hits` 判定，不是简单比等。
 */
export default function PracticeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const router = useRouter();

  const [items, setItems] = useState<Question[]>([]);
  const [cur, setCur] = useState(-1);
  /** 输入框实时文本（未提交前）；提交或翻页时写回 `Question` */
  const [draft, setDraft] = useState('');
  const [score, setScore] = useState({ right: 0, done: 0 });
  const [peek, setPeek] = useState(false);
  /** 近期出过的题目标识 —— 交给引擎做近题去重（它不会就地改，返回值要自己存） */
  const recent = useRef<string[]>([]);
  /** 焦点标记：键盘弹出用 */
  const inputRef = useRef<TextInput>(null);

  const q: Question | null = cur >= 0 ? items[cur] : null;

  /** 只改当前这题（其余题保持引用不变，翻页时不会掉作答痕迹） */
  const patch = useCallback(
    (p: Partial<Question>) => {
      setItems((prev) => prev.map((it, i) => (i === cur ? { ...it, ...p } : it)));
    },
    [cur]
  );

  /* ------------------------------------------------------------------ *
   * 出题
   * ------------------------------------------------------------------ */

  const drawNew = useCallback(() => {
    const out = makeQuestion({
      verbs: VERBS,
      settings: useSettingsStore.getState(),
      // 出题权重：错得多的动词更容易被抽到（engine/quiz.ts 的 weightOf）
      stats: useStatsStore.getState().verbs,
      recent: recent.current,
    });
    if (!out) {
      Alert.alert(t('emptyNext'));
      return;
    }
    recent.current = out.recent;
    setItems((prev) => [...prev, out.q]);
    setCur((c) => c + 1);
    setDraft('');
    setPeek(false);
  }, [t]);

  // 首次挂载出第一题。drawNew 是稳定引用，所以只会跑一次。
  useEffect(() => {
    drawNew();
  }, [drawNew]);

  /* ------------------------------------------------------------------ *
   * 翻页 / 退出
   * ------------------------------------------------------------------ */

  const next = useCallback(() => {
    // 还在回看历史题 → 往后翻；已经在末尾 → 出新题
    if (cur < items.length - 1) {
      const nx = items[cur + 1];
      setCur(cur + 1);
      setDraft(nx.mode === 'recognize' ? (nx.userInf ?? '') : (nx.userAnswer ?? ''));
      setPeek(false);
      return;
    }
    drawNew();
  }, [cur, items, drawNew]);

  const prev = useCallback(() => {
    if (cur <= 0) return;
    const pv = items[cur - 1];
    setCur(cur - 1);
    setDraft(pv.mode === 'recognize' ? (pv.userInf ?? '') : (pv.userAnswer ?? ''));
    setPeek(false);
  }, [cur, items]);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  /** 有作答进度就先确认（对应网页的 `endConfirm`） */
  const tryLeave = useCallback(() => {
    if (score.done === 0) {
      leave();
      return;
    }
    const acc = Math.round((score.right / score.done) * 100);
    Alert.alert('', t('endConfirm', score.done, acc), [
      { text: t('stayPractice'), style: 'cancel' },
      { text: t('leavePractice'), style: 'destructive', onPress: leave },
    ]);
  }, [score, leave, t]);

  /* ------------------------------------------------------------------ *
   * 判分
   * ------------------------------------------------------------------ */

  const submit = useCallback(() => {
    if (!q || q.correct !== null) return;
    const v = VERBS[q.idx];

    let ok = false;
    let soft = false;
    let diag: DiagKind | null = null;
    let infOK: boolean | null = null;
    let personOK: boolean | null = null;
    let tenseOK: boolean | null = null;

    if (q.mode === 'recognize') {
      /* 辨认模式考三项：原形 + 人称 +（多同类时态时）时态。
         三项没凑齐**不算提交**（与网页一致：直接 return，不给判分）。
         ⚠️ 原形读的是**输入框里的实时文本 `draft`**，不是 `q.userInf` ——
         `userInf` 是提交时（下面 `patch`）才写回题目对象的，作答前恒为 null，
         读它会让「确认」永远点不动（回归用例逮到过）。 */
      const given = draft.trim();
      const selP = q.pickPerson ?? null;
      const selT = q.pickTense ?? null;
      if (!given) return;
      if (selP === null) return;
      if (q.askTense && selT === null) return;

      infOK = norm(given) === norm(q.inf);
      // hits = 这个形式**全部成立**的读法（人称/时态组合）
      const hits = q.hits ?? [];
      const hp = hits.filter((x) => x.p === selP);
      personOK = hp.length > 0;
      if (q.askTense) {
        tenseOK = hp.some((x) => x.k === selT);
        ok = infOK && tenseOK;
      } else {
        tenseOK = true;
        ok = infOK && personOK;
      }
    } else {
      const given = draft;
      if (!given.trim()) return;
      if (q.mode === 'shift') {
        const r = judge(given, q.answer2 ?? '', q.s.strictAccent, q.tense2 ?? q.tense);
        ok = r.ok;
        soft = r.soft;
      } else if (q.mode === 'transfer') {
        // A 出示的形式若有多重读法，B 在那些读法下的形式同样接受
        const r = judge(given, [q.answer, ...(q.answersAlt ?? [])], q.s.strictAccent, q.tense);
        ok = r.ok;
        soft = r.soft;
      } else {
        const r = judge(given, q.answer, q.s.strictAccent, q.tense);
        ok = r.ok;
        soft = r.soft;
      }
      if (!ok) {
        diag = diagnose(v, (q.mode === 'shift' ? q.tense2 : q.tense) as TenseKey, q.person);
      }
    }

    patch({
      correct: ok,
      soft,
      diag,
      infOK,
      personOK,
      tenseOK,
      // 写回原始输入，翻页回来时输入框能复原
      ...(q.mode === 'recognize' ? { userInf: draft } : { userAnswer: draft }),
    });
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), done: s.done + 1 }));

    useStatsStore.getState().record({
      inf: q.inf,
      tense: (q.mode === 'shift' ? q.tense2 : q.tense) as TenseKey,
      person: q.person,
      mode: q.mode,
      ok,
      user: draft,
      ans: q.mode === 'shift' ? (q.answer2 ?? q.answer) : q.answer,
    });
  }, [q, draft, patch]);

  /* ------------------------------------------------------------------ *
   * 渲染
   * ------------------------------------------------------------------ */

  if (!q) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.hint}>{t('emptyPoolAlert')}</Text>
        <Btn label={t('back')} onPress={leave} />
      </View>
    );
  }

  const answered = q.correct !== null;
  const acc = score.done ? Math.round((score.right / score.done) * 100) : 0;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ---------------------------- 顶栏 ---------------------------- */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="back-btn"
          onPress={tryLeave}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Icon name="arrow-left" size={20} color={theme.color.ink} />
        </Pressable>
        {/* 变位查询入口（网页作答页顶部的「变位表」按钮）：推到 /conj-lookup            —— 与 tab 版 /conj-table 同源组件，但走根 Stack，**无底栏、退回 practice**
            （用户 2026-10-04）。带 inf/t/p 参数：过去后那一格直接高亮。 */}
        <Pressable
          testID="table-btn"
          onPress={() =>
            router.push({
              pathname: '/conj-lookup',
              params: { inf: q.inf, t: targetTense(q), p: String(q.person) },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={t('navTable')}
          hitSlop={8}
          style={styles.tableBtn}
        >
          <Icon name="table" size={14} color={theme.color.ink} />
          <Text style={styles.tableBtnTxt}>{t('navTable')}</Text>
        </Pressable>
        <View style={styles.spacer} />
        <Text testID="progress" style={styles.progress}>
          {t('progress', cur + 1, items.length, acc)}
        </Text>
      </View>

      {/* 模式徽标 + 一句话玩法 —— 单独拎出来放在页面最上面（用户 2026-10-03）：
          以前它和题面挤在同一个白框里（styles.stem），既跟题干抢视线，
          又让「哪个框才是题目」变得含糊。现在题干框里只剩题目本身。
          徽标字号放大（15）让进页第一眼先落在这；下面跟一行与首页同文案的
          一句话介绍，**numberOfLines=1 不许折行**（用户 2026-10-03）——
          zh 最长一条 12.5px 下约 240px，en 最长一条 11.5px 下约 315px，
          360dp 窄屏（内容宽 324）都放得下，才敢锁单行。 */}
      <View style={styles.modeRow}>
        {/* Tag 自带 alignSelf:'flex-start'（变位表里的场景要它），在这里会把徽标
            拽到左边 —— 套一行 justifyContent:center 顶掉，和下面的介绍对齐 */}
        <View style={styles.modeBadgeRow}>
          <Tag testID="mode-tag" tone="acc" size={15}>
            {modeName(q.mode, lang)}
          </Tag>
        </View>
        <Text
          numberOfLines={1}
          testID="mode-desc"
          style={[styles.modeDesc, lang === 'en' ? styles.modeDescEn : null]}
        >
          {modeDesc(q.mode, lang)}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* --------------------------- 题干 --------------------------- */}
        <View testID="stem-box" style={styles.stem}>
          {q.mode === 'transfer' ? (
            /* 平移模式：题干主体是 A / B 对照表，不是单个形式（对齐网页 `.xfer`）。
               A 行已经写了原形、B 行也写了原形，所以**不再另起一行 infLine** —— 
               网页的 transfer 分支同样没有 infLine，那行在这里纯属重复。 */
            <XferBox q={q} />
          ) : q.mode === 'shift' ? (
            /* 转换模式（用户 2026-10-03）：与平移模式同构的虚线框 ——
               第一行「原时态 → 目标时态」，第二行「给出的形式 → ?」；
               原形（+释义）另起一行跟在框下，隐藏时就是那颗「看原形」。 */
            <>
              <ShiftBox q={q} lang={lang} />
              {showInfAt(q, peek) ? (
                <Text testID="stem-zh" style={styles.stemZh}>
                  {q.s.showZh ? `${q.inf} · ${q.zh}` : q.inf}
                </Text>
              ) : (
                <Pressable
                  testID="peek"
                  onPress={() => setPeek(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('peek')}
                  accessibilityHint={t('peekT')}
                  hitSlop={6}
                  style={styles.peek}
                >
                  <Icon name="eye" size={14} color={theme.color.accent} />
                  <Text style={styles.peekTxt}>{t('peek')}</Text>
                </Pressable>
              )}
            </>
          ) : q.mode === 'produce' ? (
            /* 复现模式（用户 2026-10-03 定死框内顺序）：中文释义 → 大字原形 → 目标时态。
               ⚠️ 原形只出现一次 —— 以前大字底下那行又写了一遍「原形 · 释义」，纯冗余。 */
            <>
              {q.s.showZh ? (
                <Text testID="stem-zh" style={styles.stemZh}>
                  {q.zh}
                </Text>
              ) : null}
              <ConjText
                testID="stem"
                form={q.inf}
                baseSize={theme.font.xxl}
                minSize={20}
                style={styles.stemForm}
              />
              <StemMeta q={q} lang={lang} />
            </>
          ) : (
            /* 辨认模式：只给这个变位形式（原形是答案，绝不给看，连「看原形」都没有）
               + 按全局「显示释义」给一句中文当线索，口径与网页的 `zhLine` 一致。 */
            <>
              <ConjText
                testID="stem"
                form={q.answer}
                code={codesOf(VERBS[q.idx], q.tense)}
                hl={hlOf(VERBS[q.idx], q.tense)}
                person={q.person}
                baseSize={theme.font.xxl}
                minSize={20}
                style={styles.stemForm}
              />
              {q.s.showZh ? (
                <Text testID="stem-zh" style={styles.stemZh}>
                  {q.zh}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* -------------------------- 作答区 -------------------------- */}
        {q.mode === 'recognize' ? (
          <View style={styles.answerBox}>
            {/* ① 原形 —— 辨认模式强制不显示原形，必须自己拼出来，所以给一句占位提示
                说清这一格要写什么（用户 2026-10-03）。输入框右侧是清除键
                （原来挤在重音条末尾的退格键，按用户要求换成「一键清空」并挪到这一行）。 */}
            <View style={styles.ansRow}>
              <TextInput
                testID="input-inf"
                ref={inputRef}
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('infPh')}
                placeholderTextColor={theme.color.faint}
                editable={!answered}
                returnKeyType="done"
              />
              <ClearKey
                label={t('clearInput')}
                disabled={answered}
                hit={draft.length > 0}
                onPress={() => setDraft('')}
              />
            </View>
            <AccentBar disabled={answered} onInsert={(c) => setDraft((d) => d + c)} />

            {/* ② 人称 —— 两行各三个（对齐网页 .opts.persons；六个都要给，
                命令式也没有 yo，因为 hable 这类同形形式也可以读作虚拟式 yo）。
                小标题与下面时态那句对称（用户 2026-10-03）：
                既然时态要问「属于哪个时态」，人称也要问「属于哪个人称」。 */}
            <Text style={styles.label}>{t('personQ')}</Text>
            <PersonPick
              q={q}
              lang={lang}
              answered={answered}
              onPick={(i) => patch({ pickPerson: i })}
            />

            {/* ③ 时态 —— 只在「与本题同类且确有形式的时态」不止一个时才问。
                chip 按语式上色（陈述蓝 / 条件青 / 虚拟紫 / 命令橙），与网页
                `.chip.sm.tint.g-<group>` 一致 —— 之前全是白底，一排看过去分不清语式。 */}
            {q.askTense ? (
              <>
                <Text style={styles.label}>{t('tenseQ')}</Text>
                {/* 时态选项按**语式分组**成卡片，一行最多两组（对齐网页 `.tpick` /
                    `.tpick-row`）—— 原来是一排自由换行的 chip，长短不齐、
                    与上面的人称网格对不上，看起来乱（用户 2026-10-05）。 */}
                <TensePick
                  q={q}
                  lang={lang}
                  answered={answered}
                  onPick={(k) => patch({ pickTense: k })}
                />
              </>
            ) : null}
          </View>
        ) : q.options && q.options.length ? (
          <View style={styles.answerBox}>
            {/* 选择题：主语提示单独一行（网页把 subj 放在选项上面那行） */}
            <View style={styles.wrapRow}>
              <SubjectPill q={q} />
            </View>
            {/* 选项：一行三个、等宽对齐；词形按 ConjText 规则渲染
                （多词可换行、词内绝不折断）。点选项只**选中**，不立即判分 ——
                按下方「确认」才提交（用户 2026-10-05）。 */}
            <ChoiceOpts
              q={q}
              answered={answered}
              picked={draft}
              onPick={setDraft}
            />
          </View>
        ) : (
          <View style={styles.answerBox}>
            {/* 手写：主语提示在**输入框左边**（对齐网页 .ansrow 的 .subj）——
                主语只取一个代词，否则「él / ella / usted」这种整组会把输入框挤没 */}
            <View style={styles.ansRow}>
              <SubjectPill q={q} />
              <TextInput
                testID="input-ans"
                ref={inputRef}
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('placeholder')}
                placeholderTextColor={theme.color.faint}
                editable={!answered}
                returnKeyType="done"
              />
              <ClearKey
                label={t('clearInput')}
                disabled={answered}
                hit={draft.length > 0}
                onPress={() => setDraft('')}
              />
            </View>
            <AccentBar disabled={answered} onInsert={(c) => setDraft((d) => d + c)} />
          </View>
        )}

        {/* -------------------------- 反馈面板 -------------------------- */}
        {answered ? <Feedback q={q} lang={lang} t={t} /> : null}
      </ScrollView>

      {/* ------------------------- Sticky 底栏 ------------------------- */}
      <View style={[styles.bottombar, { paddingBottom: insets.bottom + 12 }]}>
        <Btn
          testID="prev-btn"
          label={t('prev')}
          onPress={prev}
          disabled={cur <= 0}
          icon={<Icon name="chevron-left" size={16} />}
        />
        {answered ? (
          <Btn
            testID="next-btn"
            variant="primary"
            style={styles.grow}
            label={t('next')}
            onPress={next}
            /* 箭头画在文字右边，与「‹ 上一题」对称（用户 2026-10-04）。
               以前 i18n 文案自带「→」、这里又画一颗 chevron，符号叠符号。 */
            iconAfter={<Icon name="chevron-right" size={16} color="#ffffff" />}
          />
        ) : (
          <Btn
            testID="check-btn"
            variant="primary"
            style={styles.grow}
            label={t('check')}
            onPress={submit}
            disabled={!canSubmit(q, draft)}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );

  /**
   * 选择题：把选项当输入提交。
   * 单独一个函数是因为 `submit` 读的是 `draft`，而 `setDraft` 是异步的 ——
   * 直接改成「submit 接受一个可选覆盖值」最省事，也不必等一次重渲染。
   */
  function submitWith(value: string) {
    if (!q) return;
    setDraft(value);
    const v = VERBS[q.idx];
    const r =
      q.mode === 'shift'
        ? judge(value, q.answer2 ?? '', q.s.strictAccent, q.tense2 ?? q.tense)
        : q.mode === 'transfer'
          ? judge(value, [q.answer, ...(q.answersAlt ?? [])], q.s.strictAccent, q.tense)
          : judge(value, q.answer, q.s.strictAccent, q.tense);
    const diag = r.ok ? null : diagnose(v, (q.mode === 'shift' ? q.tense2 : q.tense) as TenseKey, q.person);
    patch({ correct: r.ok, soft: r.soft, diag, userAnswer: value });
    setScore((s) => ({ right: s.right + (r.ok ? 1 : 0), done: s.done + 1 }));
    useStatsStore.getState().record({
      inf: q.inf,
      tense: (q.mode === 'shift' ? q.tense2 : q.tense) as TenseKey,
      person: q.person,
      mode: q.mode,
      ok: r.ok,
      user: value,
      ans: q.mode === 'shift' ? (q.answer2 ?? q.answer) : q.answer,
    });
  }
}

/* ==================================================================== *
 * 派生量（纯函数，便于测试）
 * ==================================================================== */

/** 本题真正要写出来的那个形式（转换模式取目标时态，而不是题面已给的源形式） */
export function shownAnswer(q: Question): string {
  return q.mode === 'shift' && q.answer2 ? q.answer2 : q.answer;
}

/**
 * 本题考的时态：转换模式是**目标**时态（`tense2`），其余就是 `tense`。
 * 判分、诊断、主语提示、六人称对照都走它，别再各写一遍三元表达式。
 */
export function targetTense(q: Question): TenseKey {
  return (q.mode === 'shift' ? q.tense2 : q.tense) as TenseKey;
}

/**
 * 题干里是否显示原形。
 * `hideInf` 开启时默认藏起来，按「看原形」或**作答之后**都显示
 * （网页 `revealInf`：作答后自动放回，方便复盘）。
 *
 * ⚠️ **辨认模式例外**：那题考的就是"从变位形式认回原形"，作答前一律为 false，
 * 连「看原形」都不给（网页的 recognize 分支干脆不渲染 infLine）——
 * 否则一眼看到原形，这题就白做了。
 */
export function showInfAt(q: Question, peeked: boolean): boolean {
  if (q.correct !== null) return true;
  if (q.mode === 'recognize') return false;
  if (peeked) return true;
  // 复现模式本来就不给原形看也能做（题目问的就是它），不受 hideInf 影响
  if (q.mode === 'produce') return true;
  return !q.s.hideInf;
}

/** 提交按钮是否可用：辨认模式要原形 + 人称（+ 时态）齐了才算 */
export function canSubmit(q: Question | null, draft: string): boolean {
  if (!q || q.correct !== null) return false;
  if (q.mode === 'recognize') {
    if (!(q.userInf ?? '').trim() && !draft.trim()) return false;
    if (q.pickPerson === null || q.pickPerson === undefined) return false;
    if (q.askTense && (q.pickTense === null || q.pickTense === undefined)) return false;
    return true;
  }
  return !!draft.trim();
}

/* ==================================================================== *
 * 子组件
 * ==================================================================== */

/**
 * 时态名药丸 —— 按**语式**上色（陈述蓝 / 条件青 / 虚拟紫 / 命令橙），
 * 与网页 `.pill.g-<group>` 同口径（用户 2026-10-02：题干里出现的时态都要染色）。
 *
 * 两种形态：**字号一致**（用户 2026-10-04：「原时态和目标时态的名字大小一致，
 * 现在的很不美观」），只差配色与字重 ——
 *  · `src` 灰底 —— 转换模式里"原时态"那一格，只交代出处，不抢视线；
 *  · `tgt` 语式浅底 + 同色边框 + 加粗 —— 本题真正要写的那个时态，
 *    在一行字里最先被看到（用户 2026-10-02：「目标时态醒目一点」）。
 */
function TenseTag({ k, lang, variant }: { k: TenseKey; lang: Lang; variant: 'src' | 'tgt' }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const m = theme.mood[T[k].g];
  const tgt = variant === 'tgt';
  return (
    <View
      testID={`stem-tense-${k}`}
      style={[
        styles.tenseTag,
        tgt
          ? { backgroundColor: m.soft, borderColor: m.border }
          : { backgroundColor: theme.color.tag, borderColor: theme.color.line },
      ]}
    >
      <Text
        style={[
          styles.tenseTagTxt,
          tgt
            ? { color: m.ink, fontWeight: '800' }
            : { color: theme.color.sub, fontWeight: '600' },
        ]}
      >
        {lang === 'en' ? T[k].en : T[k].zh}
      </Text>
    </View>
  );
}

/**
 * 复现模式题干框里那行「目标时态」药丸。
 *
 * ⚠️ 只有复现模式走这里（用户 2026-10-03 起）：
 *   · **辨认模式**恒为 null —— 时态是那题要选的东西，写在题面上等于给答案；
 *   · **平移模式**恒为 null（用户 2026-10-02）—— 不给时态才有考察效果，
 *     得自己从 A 的变位形式认出这是哪个时态再照搬到 B 上；
 *   · **转换模式**改由 `<ShiftBox>` 承担（原时态 → 目标时态写在框里第一行）；
 * 复现模式只给时态、**不给人称**：人称由作答框左边那颗主语药丸表达，
 * 题干再写一遍就是同一句话说两遍。
 */
function StemMeta({ q, lang }: { q: Question; lang: Lang }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (q.mode !== 'produce') return null;
  return (
    <View testID="stem-meta" style={styles.metaLine}>
      <TenseTag k={q.tense} lang={lang} variant="tgt" />
    </View>
  );
}

/**
 * 转换模式的对照框（用户 2026-10-03：「框内界面与平移模式类似」）——
 * 与 `<XferBox>` 同一套虚线框外观，内容换成时态映射：
 *
 *   第一行：原时态 → 目标时态（源灰底细字 / 目标彩色加粗，一眼知道要写哪个）
 *   第二行：给出的这个形式 → 「?」（要写出来的那个）
 *
 * 人称不写 —— 由作答框左边那颗主语药丸给。
 */
function ShiftBox({ q, lang }: { q: Question; lang: Lang }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [rowW, setRowW] = useState(0);
  // 形式格的可用宽：与 XferRow 同一套公式（行宽 − 左右内边距，再封顶 52%）。
  // ⚠️ **必须显式传 width** —— 不传的话 ConjText 只能自己量自己，而它的容器宽度
  // 是内容撑出来的（maxWidth 52% + flexShrink），「字号 → 内容宽 → avail → 字号」
  // 成了反馈回路：最长词超格的形式每渲染一轮就缩一档，一路缩到 minSize
  // （真机踩过：「转换模式的动词字越来越小」）。传显式宽度后 avail 与字号解耦，
  // 缩字只发生一次、有下限，与平移框 A 格行为完全一致。
  const cellW = rowW > 0 ? Math.round((rowW - XROW_PAD) * FORM_COL) : 0;

  return (
    <View testID="shift-box" style={styles.xfer}>
      <View style={[styles.srow, styles.srowHead]}>
        <TenseTag k={q.tense} lang={lang} variant="src" />
        <Icon name="arrow-right" size={15} color={theme.color.sub} />
        {q.tense2 ? <TenseTag k={q.tense2} lang={lang} variant="tgt" /> : null}
      </View>
      <View
        style={[styles.srow, styles.srowBody]}
        onLayout={(e: LayoutChangeEvent) => setRowW(Math.round(e.nativeEvent.layout.width))}
      >
        {/* 「长」的口径（用户 2026-10-03）：**超过整行一半就算长** ——
            形式格封顶 52%（与平移框 A 格的 FORM_COL 同一口径），超了就在词间折行，
            单词本身超格才缩字（一次到位，不会越缩越小）。短形式照样一行。 */}
        <ConjText
          testID="shift-src"
          form={q.answer}
          plain
          align="flex-start"
          baseSize={19}
          minSize={13}
          weight="600"
          width={cellW}
          style={styles.sFormBox}
        />
        {/* 撑开剩下的空间，让「?」一直贴在行的最右端 */}
        <View style={styles.sFormSpace} />
        <Text testID="shift-q" style={styles.xFormQ}>
          ?
        </Text>
      </View>
    </View>
  );
}

/**
 * 平移模式的 A / B 对照（对齐网页 `.xfer` 的虚线框 + 圆形字母标）。
 *
 * ⚠️ 与网页的唯一差别：**不写时态**（用户 2026-10-02：「时态信息建议直接不要，
 * 这样有考察效果」）。网页上面还有一行时态药丸，RN 版去掉 —— 想知道是哪个时态，
 * 得自己从 A 的变位形式里认出来，再照搬到 B 上，这才是「平移」要练的东西。
 * 人称同理，由作答框左边那颗主语药丸给。
 */
function XferBox({ q }: { q: Question }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View testID="xfer" style={styles.xfer}>
      {/* A：已知的那个动词 —— 原形 + 释义 + 它的变位形式 */}
      <XferRow lab="A" inf={q.srcInf ?? ''} zh={q.srcZh ?? ''} form={q.srcForm ?? ''} />
      {/* B：本题要写的动词 —— 原形 + 释义，形式留一个「?」 */}
      <XferRow lab="B" inf={q.inf} zh={q.zh} form={null} />
    </View>
  );
}

/** 对照框里「形式」那一格占行内容宽的比例 —— 其余留给原形 + 释义 */
const FORM_COL = 0.52;
/** 对照框行的左右内边距合计（styles.xrow / styles.srow 的 paddingHorizontal × 2） */
const XROW_PAD = 24;
/** 行内元素间距（styles.xrow / styles.srow 的 gap） */
const XROW_GAP = 9;
/** 待填的「?」那一格固定占宽 */
const Q_W = 26;

function XferRow({
  lab,
  inf,
  zh,
  form,
}: {
  lab: 'A' | 'B';
  inf: string;
  zh: string;
  /** null = 待填（画成灰色的「?」） */
  form: string | null;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [rowW, setRowW] = useState(0);
  const cellW = rowW > 0 ? Math.round((rowW - XROW_PAD) * FORM_COL) : 0;

  return (
    <View
      style={[styles.xrow, lab === 'B' ? styles.xrowB : null]}
      onLayout={(e: LayoutChangeEvent) => setRowW(Math.round(e.nativeEvent.layout.width))}
    >
      <View style={styles.xlab}>
        <Text style={styles.xlabTxt}>{lab}</Text>
      </View>
      <View style={styles.xverb}>
        <Text numberOfLines={1} style={styles.xInf}>
          {inf}
        </Text>
        <Text numberOfLines={1} style={styles.xZh}>
          {zh}
        </Text>
      </View>
      {form ? (
        /* 形式可以很长（用户 2026-10-03 举的例：hubiéramos preparado）。
           原来是 `numberOfLines={1} + adjustsFontSizeToFit` —— 挤不下就整体缩字，
           一行小字很难看，而且 `adjustsFontSizeToFit` 在安卓上根本不生效。
           现在改成 **ConjText 的词级折行**：允许排成两行，但绝不在词中断开；
           只有「一个词本身就比这一格宽」时才缩字号（fitText 的老规矩）。 */
        <ConjText
          testID={lab === 'B' ? 'xfer-q' : 'xfer-a'}
          form={form}
          plain
          align="flex-end"
          baseSize={19}
          minSize={13}
          weight="600"
          width={cellW}
          style={styles.xFormCell}
        />
      ) : (
        <Text testID="xfer-q" style={styles.xFormQ}>
          ?
        </Text>
      )}
    </View>
  );
}

/**
 * 西语重音快捷条 —— 网页靠物理键盘打 á，手机没有，这是必须新增的一行。
 * 一排放 seven 个键（7×40 + 6×6 = 316 < 窄屏 324 的可用宽），不会折行；
 * 原来末尾那个退格键已按用户要求换成输入框右侧的清除键（见 `ClearKey`）。
 */
const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'];

function AccentBar({ disabled, onInsert }: { disabled: boolean; onInsert: (c: string) => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View testID="accent-bar" style={styles.accentBar}>
      {ACCENTS.map((c) => (
        <Pressable
          key={c}
          testID={`accent-${c}`}
          disabled={disabled}
          onPress={() => onInsert(c)}
          accessibilityRole="button"
          accessibilityLabel={c}
          hitSlop={4}
          style={({ pressed }) => [styles.accentKey, pressed ? styles.accentDown : null, disabled ? styles.dim : null]}
        >
          <Text style={styles.accentTxt}>{c}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * 输入框右侧的**清除键**（用户 2026-10-02：把重音条末尾的退格换成它，并挪到输入框右边）。
 *
 * 退格只能删一个字母，改重音位置时要按好几次；一键清空更适合"重新写一遍"的姿势。
 * 没有内容时只降透明度、不移除 —— 位置固定，手指不用重新找目标。
 */
function ClearKey({
  label,
  disabled,
  hit,
  onPress,
}: {
  label: string;
  disabled: boolean;
  /** 输入框里有没有内容（决定按键是实色还是淡化） */
  hit: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const dead = disabled;
  return (
    <Pressable
      testID="input-clear"
      disabled={dead}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.clearKey,
        pressed ? styles.clearDown : null,
        dead || !hit ? styles.dim : null,
      ]}
    >
      <Icon name="x" size={17} color={theme.color.sub} />
    </Pressable>
  );
}

/**
 * 作答框左边那个「主语提示」药丸（对齐网页 `.ansrow .subj`）。
 *
 * ⚠️ 只取**一个**代词（`mainPronoun`），不是整组：
 * 整组是「él / ella / usted」这种 17 个字符，手机会把输入框挤到没地方；
 * 同一格里这几个代词变位完全相同，写一个就够提示。
 * 命令式的第三人称走 `IMP_LABEL` → 只会是 **usted / ustedes**（没有 él / ellos）。
 */
function SubjectPill({ q }: { q: Question }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View testID="subj" style={styles.subjPill}>
      <Text numberOfLines={1} style={styles.subjTxt}>
        {mainPronoun(q.person, targetTense(q))}
      </Text>
    </View>
  );
}

/**
 * 辨认模式的**时态选项** —— 改为「语式选项卡」（用户 2026-10-05 二次改版）。
 *
 * 为什么不用原来「按语式分组的平铺卡片」：15 个时态全铺出来太长，手机要向下翻
 * 才能看全（用户原话：「时态的选项太多了，导致需要向下翻才能看」）。
 * 现在上面一排四个语式选项卡（陈述 / 条件 / 虚拟 / 命令，只显示本题真有选项的），
 * 点哪个 tab 下面才放出那个语式的时态；**每行两个**，宽度居中、整齐。
 *
 * 另外按用户要求**去掉**了「只列简单时态 / 只列复合时态」那句说明文字。
 *
 * 选项卡的选中态用该语式的主题色（陈述蓝 / 条件青 / 虚拟紫 / 命令橙）；
 * 默认停在**本题时态所在的那个语式**上（用户不用先找）。
 */
function TensePick({
  q,
  lang,
  answered,
  onPick,
}: {
  q: Question;
  lang: Lang;
  answered: boolean;
  onPick: (k: TenseKey) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const onlyCp = T[q.tense].cp ? 1 : 0;
  const chips = recognizeTenseChips(VERBS[q.idx], onlyCp).out;

  /** 只保留本题真有选项的语式（顺序照 TENSE_GROUPS 固定） */
  const groups = TENSE_GROUPS.map((g) => ({
    g,
    keys: chips.filter((k) => T[k].g === g.k),
  })).filter((x) => x.keys.length > 0);

  /** 当前 tab：默认本题时态所属语式；本题时态万一不在（不该发生）就取第一个 */
  const qGroup = T[q.tense].g;
  const [tab, setTab] = useState<GroupKey>(() =>
    groups.some((x) => x.g.k === qGroup) ? qGroup : groups[0]?.g.k ?? 'ind'
  );

  if (!groups.length) return null;
  /** 当前 tab 下要放的时态；tab 失效时兜底到第一个组 */
  const cur = groups.find((x) => x.g.k === tab) ?? groups[0];
  const m = theme.mood[cur.g.k];

  return (
    <View testID="tense-chips" style={styles.tpick}>
      {/* 选项卡一行四个：每个语式一格，等宽摊开（网页 4 个 tab 也是等宽） */}
      <View style={styles.tpickTabs}>
        {groups.map(({ g }) => {
          const on = g.k === cur.g.k;
          const gm = theme.mood[g.k];
          return (
            <Pressable
              key={g.k}
              testID={`tpick-tab-${g.k}`}
              onPress={() => setTab(g.k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={lang === 'en' ? g.en : g.zh}
              style={[
                styles.tpickTab,
                on ? { backgroundColor: gm.main, borderColor: gm.main } : null,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.tpickTabTxt, on ? styles.tpickTabTxtOn : { color: gm.ink }]}
              >
                {lang === 'en' ? g.en : g.zh}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 该语式的时态：每行两个、等宽、居中（用户要求「每行两个、整齐」） */}
      <View style={styles.tpickGrid}>
        {cur.keys.map((k) => (
          <View key={k} style={styles.tpickCell}>
            <Chip
              testID={`tense-${k}`}
              size="sm"
              tint={m}
              label={lang === 'en' ? T[k].en : T[k].zh}
              selected={q.pickTense === k}
              off={answered && q.pickTense !== k}
              accessibilityHint={T[k].es}
              onPress={() => {
                if (answered) return;
                onPick(k);
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * 人称选择 —— 两行各三个，每格是「主语代词组 + 语法人称」。
 *
 * 网页用的是 `.opts.persons` 两行 grid；这里同样**六格全给**（含命令式的 yo）：
 *  · `hable` 这类同形形式也可以读作虚拟式的 yo，少了 yo 就答不了那种读法；
 *  · 高亮 / 回显都按「选项位置 = 人称下标」对齐，砍成 5 个会整体错位。
 * 同形多答案由 `hits` 判定兜底（见 `submit()` 的 recognize 分支），不靠 UI 去限制。
 */
function PersonPick({
  q,
  lang,
  answered,
  onPick,
}: {
  q: Question;
  lang: Lang;
  answered: boolean;
  onPick: (i: PersonIdx) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View testID="persons" accessibilityRole="radiogroup" style={styles.pgrid}>
      {PERSONS.map((_, idx) => {
        const i = idx as PersonIdx;
        const sel = q.pickPerson === i;
        return (
          <Pressable
            key={i}
            testID={`person-${i}`}
            onPress={() => {
              if (!answered) onPick(i);
            }}
            accessibilityRole="radio"
            accessibilityLabel={personLabel(i, q.tense)}
            accessibilityState={{ selected: sel }}
            style={({ pressed }) => [
              styles.pbtn,
              sel ? styles.pbtnOn : null,
              pressed && !answered ? styles.pbtnDown : null,
              answered && !sel ? styles.dim : null,
            ]}
          >
            {/* 代词整组最长的是「ellos / ellas / ustedes」（23 字符），一格只有 ~110px 宽：
                字号压到 12.5 并允许**折两行**（网页 `.opt .pol` 也是 `word-break: break-word`
                换行 + 窄屏降到 12.5px）。挤成一行的话不是被截断就是撑破格子。 */}
            <Text numberOfLines={2} style={[styles.pPro, sel ? styles.pOn : null]}>
              {personProSet(i, q.tense).join(' / ')}
            </Text>
            <Text numberOfLines={1} style={[styles.pGloss, sel ? styles.pOn : null]}>
              {/* 人称候选格上的释义用**通用**口径（不带时态）—— 网页 `mkOpt` 就是
                  `personGloss(i)`；命令式感知的 `personGlossI` 只用在诊断提示里。
                  若在这里误用命令式感知版，`IMP_GLOSS` 没有 0 号键（命令式没有 yo），
                  渲染六格时 `IMP_GLOSS[0][lang]` 直接崩（真机踩过）。 */}
              {lang === 'en' ? PERSONS[i].E : PERSONS[i].gl}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 选择题的选项 —— 一行三个、等宽对齐（用户 2026-10-05）。
 *
 * 为什么不用 Chip：
 *   · Chip 是药丸（圆角 999 + 内容宽度自适应），一排长短不齐，对不齐；
 *   · 词形要按 **ConjText 的规则**渲染 —— 多词可换行、词内绝不折断
 *     （用户：「和其它出现动词的地方一样的规则，不要在单词内换行」）。
 *     所以这里用矩形按钮 + ConjText，两列/三列网格天然对齐。
 *
 * 交互（用户 2026-10-05）：点选项只**选中**（写进 draft），不立即判分；
 * 按下方「确认」才提交。提交后：选对 → 该项标绿；选错 → **所选那项标红** + 正确项标绿。
 */
function ChoiceOpts({
  q,
  answered,
  picked,
  onPick,
}: {
  q: Question;
  answered: boolean;
  /** 当前选中的选项文本（= draft） */
  picked: string;
  onPick: (v: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ans = shownAnswer(q);
  const opts = q.options ?? [];

  return (
    <View testID="choices" style={styles.ogrid}>
      {opts.map((o) => {
        const sel = norm(o) === norm(picked);
        const isRight = norm(o) === norm(ans);
        /* 作答后：正确项标绿；用户选错的那项标红；其余置灰 */
        const state = !answered
          ? sel
            ? 'sel'
            : 'idle'
          : isRight
            ? 'ok'
            : sel
              ? 'bad'
              : 'dim';
        return (
          <Pressable
            key={o}
            testID={`opt-${o}`}
            onPress={() => {
              if (!answered) onPick(o);
            }}
            accessibilityRole="button"
            accessibilityLabel={o}
            accessibilityState={{ selected: sel, disabled: answered }}
            style={({ pressed }) => [
              styles.opt,
              state === 'sel' ? styles.optSel : null,
              state === 'ok' ? styles.optOk : null,
              state === 'bad' ? styles.optBad : null,
              state === 'dim' ? styles.dim : null,
              pressed && !answered ? styles.optDown : null,
            ]}
          >
            {/* 与题干/网格同一套规则：多词可换行、词内不断；这里没有着色码，纯文本 */}
            <ConjText
              form={o}
              plain
              align="center"
              baseSize={15}
              minSize={11}
              weight="600"
              color={
                state === 'sel' || state === 'ok' || state === 'bad' ? '#ffffff' : theme.color.ink
              }
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** 判分反馈：对错 → 错在哪一类 → 答案对照 → 六人称对照 */
function Feedback({ q, lang, t }: { q: Question; lang: Lang; t: Tr }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const nm = (k: TenseKey) => (lang === 'en' ? T[k].en : T[k].zh);
  const v = VERBS[q.idx];
  const tone = q.correct ? (q.soft ? 'warn' : 'ok') : 'bad';
  const label = q.correct ? (q.soft ? t('warn') : t('ok')) : t('bad');

  const diag: I18nKey | null =
    q.diag === 'stem' ? 'diagStem' : q.diag === 'orth' ? 'diagOrth' : q.diag === 'irr' ? 'diagIrr' : null;

  const boxStyle = q.correct
    ? q.soft
      ? { backgroundColor: theme.color.warnSoft, borderColor: theme.color.warn }
      : { backgroundColor: theme.color.okSoft, borderColor: theme.color.ok }
    : { backgroundColor: theme.color.badSoft, borderColor: theme.color.bad };

  const ans = shownAnswer(q);
  const tk: TenseKey = targetTense(q);
  const f = forms(v, tk);

  // 辨认模式：这个形式的全部成立读法
  const hits = q.hits ?? [];
  const hitPersons = [...new Set(hits.map((x) => x.p))].sort((a, b) => a - b);
  const hitTenses = [...new Set(hits.map((x) => x.k))];

  return (
    <View testID="feedback" style={[styles.feedback, boxStyle]}>
      <View style={styles.fbHead}>
        <Tag tone={tone}>{label}</Tag>
        {/* ⚠️ 辨认模式**不显示 `correctAns`**（用户 2026-10-05）。
            这一屏的输入框要的是**原形**，而 `ans`（= `shownAnswer(q)`）是**变位形式**
            —— 答错时在这里写「正确答案：hablo」会让人以为要填的就是 hablo，
            与输入框的提示正好矛盾（"有的地方答案却是其它形式"就是这个）。
            网页的 recognize 分支同样不画这一行，只在原形写错时给 `infWrong`
            （下一段），那里写的才是要填的原形。 */}
        {q.correct === false && q.mode !== 'recognize' ? (
          <Text style={styles.fbLine}>{t('correctAns')}{ans}</Text>
        ) : null}
      </View>

      {/* 一眼先看到「错在哪一类」 */}
      {diag ? <RichText text={t(diag, ans)} style={styles.fbHint} /> : null}

      {q.mode === 'recognize' ? (
        <>
          {/* 辨认模式要填的是**原形** —— 所以这一行显式给出原形（用户 2026-10-05：
              「要填写动词原形的地方，有的地方答案却是其它形式」）。
              放在最上面，与别处的「正确答案：<形式>」同位，一眼就知道该填什么。
              原形写对了也照给：这是这一题的知识点，回头复习时有用。 */}
          <Text testID="fb-inf" style={styles.fbLine}>
            {t('correctInf')}
            <Text style={styles.bold}>{q.inf}</Text>
            {q.s.showZh ? <Text style={styles.fbHint}>{` ${q.zh}`}</Text> : null}
          </Text>

          <Text style={styles.fbLine}>
            {t('correctPerson')}
            {hitPersons.map((i) => personLabel(i as PersonIdx, q.tense)).join(' / ')}
            {'　'}
            {t('tenseIs')}
            {hitTenses.map(nm).join(' / ')}
          </Text>

          {/* 同形说明：人称歧义（hablaba = yo/él）或时态同形（compramos = 现在/简单过去） */}
          {hitPersons.length > 1 || hitTenses.length > 1 ? (
            <Text style={styles.fbHint}>
              {t('homoLead', q.answer)}
              {hitTenses.length > 1 ? t('homoTense', hitTenses.map(nm).join(' / ')) : ''}
              {hitPersons.length > 1
                ? (hitTenses.length > 1 ? (lang === 'en' ? ', ' : '，') : '') +
                  t('homoPers', hitPersons.map((i) => personLabel(i as PersonIdx, q.tense)).join(' / '))
                : ''}
              {t('homoTail')}
            </Text>
          ) : null}

          {q.infOK === false ? (
            <RichText text={t('infWrong', q.inf, q.userInf ?? '')} style={styles.fbHint} />
          ) : null}

          {/* 人称对、时态错 —— 说清这个形式到底属于哪些时态 */}
          {q.correct === false && q.askTense && q.personOK && q.tenseOK === false ? (
            <Text style={styles.fbHint}>
              {t(
                'tenseWrong',
                personLabel(q.pickPerson as PersonIdx, q.tense),
                hitPersons.length
                  ? [...new Set(hits.filter((x) => x.p === q.pickPerson).map((x) => x.k))].map(nm).join(' / ')
                  : t('tenseWrongNoneP'),
                nm(q.pickTense as TenseKey)
              )}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.fbLine}>
            {t('yourAns')}
            {(q.userAnswer ?? '').trim() ? q.userAnswer : t('blank')}
          </Text>
          <Text style={styles.fbLine}>
            {t('correctAns')}
            <Text style={styles.bold}>{ans}</Text>
            {/* 简单过去时还有 -ra / -se 两套写法 */}
            {tk === 'si' ? <Text style={styles.fbHint}>{` ${t('alsoW', siAlt(ans))}`}</Text> : null}
          </Text>
          {q.mode === 'shift' && q.tense2 ? (
            <Text style={styles.fbHint}>
              {t('shiftSame', q.inf, nm(q.tense), nm(q.tense2), personLabel(q.person, q.tense))}
            </Text>
          ) : null}
        </>
      )}

      {/* 六人称对照：辨认模式看本题时态，其余模式看目标时态 */}
      {f ? (
        <>
          <Text style={styles.fbHint}>
            {q.mode === 'recognize'
              ? t('gridLead', q.answer)
              : t('gridLead2', q.inf, nm(tk))}
          </Text>
          <PersonGrid
            testID="grid"
            forms={f}
            code={codesOf(v, tk)}
            hl={hlOf(v, tk)}
            tense={tk}
            active={q.person}
          />
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  scroll: { flex: 1 },
  content: { padding: 18, gap: 12 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: theme.color.bg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  /** 变位表入口（顶栏）：与返回键同高的胶囊，图标 + 文字（用户 2026-10-04） */
  tableBtn: {
    height: 38,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  tableBtnTxt: { fontSize: 12.5, fontWeight: '600', color: theme.color.ink },
  progress: { fontSize: theme.font.sm, fontWeight: '600', color: theme.color.sub },
  /** 顶栏里把进度推到右边（返回键在左、进度在右） */
  spacer: { flex: 1 },
  /** 模式徽标 + 一句话介绍 —— 在题干框之外，页面最上面（纵向居中排） */
  modeRow: { alignItems: 'center', gap: 3, paddingBottom: 8 },
  /** 徽标外面套的一行：抵掉 Tag 自带的 alignSelf:'flex-start'，让它水平居中 */
  modeBadgeRow: { flexDirection: 'row', justifyContent: 'center' },
  /** 徽标下面那行一句话玩法（与首页 modeDesc 同文案）；en 文案更长，压一档字号 */
  modeDesc: { fontSize: 12.5, color: theme.color.sub, paddingHorizontal: 12 },
  modeDescEn: { fontSize: 11.5 },

  stem: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  /** 元信息里「时态」那一行 */
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /** 时态药丸：底色与边框按语式给，见 `<TenseTag>`；字号两个 variant 一致 */
  tenseTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  tenseTagTxt: { fontSize: 15 },
  /** 字号由 ConjText 按容器实测宽度算，这里只留内边距 */
  stemForm: { paddingHorizontal: 4 },
  stemZh: { fontSize: theme.font.sm, color: theme.color.sub },

  /* ---- 平移模式的 A / B 对照框（几何照抄网页 .xfer / .xrow / .xlab） ---- */
  xfer: {
    alignSelf: 'stretch',
    marginTop: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.color.line2,
    borderRadius: 11,
    overflow: 'hidden',
  },
  xrow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, paddingHorizontal: 12 },
  /** B 行（待填那行）白底 + 上面一条虚线，和 A 行分开 */
  xrowB: {
    backgroundColor: theme.color.card,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: theme.color.line,
  },
  xlab: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.color.tag,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xlabTxt: { fontSize: 11.5, fontWeight: '700', color: theme.color.muteInk },
  xverb: { flex: 1, minWidth: 0 },
  xInf: { fontSize: 19, fontWeight: '600', color: theme.color.ink },
  xZh: { fontSize: 12.5, lineHeight: 16, color: theme.color.sub },
  /** 「形式」那一格：最多占内容的 52%，短形式让位给左边的原形 + 释义 */
  xFormCell: { maxWidth: '52%', flexShrink: 1, alignSelf: 'center' },
  /** 待填的「?」：淡灰 + 拉开字距（照抄网页 .xrow.b .xform） */
  xFormQ: { width: Q_W, textAlign: 'right', fontSize: 19, fontWeight: '600', color: theme.color.faint, letterSpacing: 2 },

  /* ---- 转换模式的对照框（复用 .xfer 外壳，两行与 .xrow 同内边距） ---- */
  srow: { flexDirection: 'row', alignItems: 'center', gap: XROW_GAP, paddingVertical: 9, paddingHorizontal: 12 },
  /** 第一行：原时态 → 目标时态（两个长名挤不下时换行，不许溢出裁切） */
  srowHead: { justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 4 },
  /** 第二行：形式 → ?（白底 + 上面一条虚线，和第一行分开，与 .xrowB 一致） */
  srowBody: {
    backgroundColor: theme.color.card,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: theme.color.line,
  },
  /** 第二行里装「形式」的那一格：封顶 52%（= FORM_COL），超了就在词间折行 */
  sFormBox: { maxWidth: '52%', flexShrink: 1 },
  /** 形式格右边的弹性空档，把「?」推到行的最右端 */
  sFormSpace: { flex: 1 },
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.color.lineAcc,
    backgroundColor: theme.color.accentSoft,
  },
  peekTxt: { fontSize: theme.font.xs, fontWeight: '600', color: theme.color.accent },

  answerBox: { gap: 8 },
  label: { fontSize: theme.font.sm, fontWeight: '600', color: theme.color.sub },

  /* ---- 辨认模式的时态选项：语式选项卡 + 每行两个（用户 2026-10-05 二次改版） ---- */
  /** 外框：浅底 + 细边，和题干框同一套视觉语言 */
  tpick: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 12,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 11,
    backgroundColor: theme.color.card2,
    gap: 10,
  },
  /** 选项卡一行：四个语式等宽摊开 */
  tpickTabs: { flexDirection: 'row', gap: 6 },
  tpickTab: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.card,
  },
  tpickTabTxt: { fontSize: 12.5, fontWeight: '600' },
  tpickTabTxtOn: { color: '#ffffff' },
  /** 时态格子：两列等宽（每行两个） */
  tpickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tpickCell: { flexBasis: '48%', flexGrow: 1, minWidth: 0, alignItems: 'center' },

  /** 作答行：主语药丸 + 输入框 + 清除键（网页 `.ansrow`） */
  ansRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    // flex 子项的默认 minWidth 是 auto，不给 0 的话长内容会把整行撑出容器
    minWidth: 0,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: theme.font.md,
    color: theme.color.ink,
    backgroundColor: theme.color.card,
    minHeight: 46,
  },
  /** 主语药丸：深底白字，一眼看到"要写谁的变位"（对齐网页 `.pill.dark.subj`） */
  subjPill: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#2b3038',
  },
  subjTxt: { fontSize: 13.5, fontWeight: '600', color: '#ffffff' },
  /** 清除键：跟输入框等高的一格，长在输入框右边 */
  clearKey: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.card,
  },
  clearDown: { backgroundColor: theme.press.soft, borderColor: theme.press.softBorder },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },

  accentBar: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  accentKey: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.card,
  },
  accentTxt: { fontSize: 17, fontWeight: '600', color: theme.color.ink },
  accentDown: { backgroundColor: theme.press.soft, borderColor: theme.press.softBorder },
  dim: { opacity: 0.4 },

  /** 人称网格：两行各三个（flexBasis 30% + grow → 每行正好三个） */
  pgrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },  pbtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.card,
  },
  pbtnOn: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  pbtnDown: { backgroundColor: theme.press.soft, borderColor: theme.press.softBorder },
  pPro: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', color: theme.color.ink, textAlign: 'center' },
  pGloss: { fontSize: 10.5, color: theme.color.sub, textAlign: 'center' },
  pOn: { color: '#ffffff' },

  /* ---- 选择题选项：一行三个、等宽对齐（用户 2026-10-05） ---- */
  /** 三列网格（flexBasis 30% + grow，每行正好三个；窄屏也不会变两列） */
  ogrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.card,
  },
  optSel: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  optOk: { backgroundColor: theme.color.ok, borderColor: theme.color.ok },
  optBad: { backgroundColor: theme.color.bad, borderColor: theme.color.bad },
  optDown: { backgroundColor: theme.press.soft, borderColor: theme.press.softBorder },

  feedback: { borderRadius: theme.radius.md, borderWidth: 1, padding: 12, gap: 5 },
  fbHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fbLine: { fontSize: theme.font.sm, color: theme.color.ink, lineHeight: 19 },
  fbHint: { fontSize: theme.font.xs, color: theme.color.sub, lineHeight: 17 },
  bold: { fontWeight: '700' },

  bottombar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    backgroundColor: theme.color.bg,
  },
  grow: { flex: 1 },

  hint: { fontSize: theme.font.sm, color: theme.color.sub, textAlign: 'center', lineHeight: 19 },
  /** 提示行（左对齐，辨认模式底部那几句） */
  hintLeft: { fontSize: theme.font.xs, color: theme.color.sub, lineHeight: 17 },
  });
