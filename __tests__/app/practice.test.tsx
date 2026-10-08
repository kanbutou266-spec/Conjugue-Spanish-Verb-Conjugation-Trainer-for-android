import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';

import { statsSummary } from '@/data/stats';
import { T } from '@/data/tenses';
import { useSettingsStore } from '@/store/settings';
import { useStatsStore } from '@/store/stats';
import { theme } from '@/ui/theme';

import PracticeScreen, { canSubmit, showInfAt, shownAnswer } from '@/app/practice';

import type { ModeKey, Question, SettingsSnapshot, TenseKey } from '@/data/types';

/** 首个用例要付整棵页面树的冷启动开销 */
jest.setTimeout(20000);

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockBack = jest.fn();
const asMock = (f: unknown) => f as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  asMock(useRouter).mockReturnValue({ back: mockBack, push: jest.fn(), replace: jest.fn(), canGoBack: () => true });
});

/** 干净 store + 指定模式/时态/答题方式，再渲染 */
async function fresh(
  opts: { mode: ModeKey; tenses?: TenseKey[]; inputMode?: 'type' | 'choice' } = { mode: 'produce' }
) {
  await act(async () => {
    const st = useSettingsStore.getState();
    st.reset();
    st.setLang('zh', 'manual');
    st.setMode(opts.mode);
    st.setTenses(opts.tenses ?? ['p']);
    // 默认档（零基础）是选择题，但本文件绝大多数用例要的是手写输入框 —— 显式固定住
    st.setInputMode(opts.inputMode ?? 'type');
    useStatsStore.getState().clear();
  });
  return render(<PracticeScreen />);
}

const val = (id: string): string => String(screen.getByTestId(id).props.value ?? '');

/** 某个 `<Text>` 节点的纯文本（host 节点的 children 通常是字符串） */
const txt = (id: string): string => String(screen.getByTestId(id).props.children ?? '');

/** 递归取某 testID 节点下的全部文字（容器节点要走到内层 `<Text>` 才有字符串） */
function textsOf(testID: string): string {
  /* ⚠️ 起点必须是**实例树的 `.children`**（host 节点链），不能从 `props.children` 起：
     后者拿到的是"元素"，一旦中间夹着自定义组件（`<TenseTag/>` / `<XferRow/>`），
     沿 `props.children` 走会在那些节点上断掉 —— 组件元素的 `.children` 是 undefined，
     而它 `props.children` 里的东西属于**另一个组件**的渲染结果，递归就静默返回空串
     （症状：`expect(textsOf('stem-meta')).toBe('现在时')` 收到 ""）。 */
  return collect(screen.getByTestId(testID).children).join('');
}

/** 整页文字 —— 用来断言"某段文案没出现" */
function pageText(): string {
  return collect(screen.toJSON()).join(' ');
}

/** 递归收集一棵实例树 / host 树里的全部字符串 */
function collect(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (n === null || n === undefined || typeof n === 'boolean') return;
    if (typeof n === 'string' || typeof n === 'number') {
      out.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    // RNTL 实例有 `.children`（host 实例链）；toJSON 的 host 节点两者都有，
    // 优先走 `children`（那是 host 节点）免得重复计数
    const el = n as { children?: unknown; props?: { children?: unknown } };
    if (el.children !== undefined) walk(el.children);
    else if (el.props?.children !== undefined) walk(el.props.children);
  };
  walk(node);
  return out;
}

const flatStyle = (s: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(s) || {}) as Record<string, unknown>;

/** 造一个最小的 Question，只用来测纯函数 */
function mkQ(p: Partial<Question>): Question {
  const s = {
    inputMode: 'type',
    showZh: false,
    hideInf: false,
    strictAccent: true,
    vosotros: false,
  } as SettingsSnapshot;
  return {
    inf: 'hablar',
    idx: 0,
    zh: '说',
    g: [],
    lv: 'A1',
    mode: 'produce',
    tense: 'p',
    person: 0,
    answer: 'hablo',
    key: 'k',
    s,
    userAnswer: null,
    correct: null,
    ...p,
  } as Question;
}

/* ==================================================================== */

describe('作答页 —— 纯函数', () => {
  it('shownAnswer：转换模式取目标时态，其余取 answer', () => {
    expect(shownAnswer(mkQ({ mode: 'produce', answer: 'hablo' }))).toBe('hablo');
    expect(shownAnswer(mkQ({ mode: 'shift', answer: 'hablo', answer2: 'hablaré' }))).toBe('hablaré');
    // 没有 answer2 时退回 answer（数据不全也不能崩）
    expect(shownAnswer(mkQ({ mode: 'shift', answer: 'hablo' }))).toBe('hablo');
  });

  it('canSubmit：手写模式要有非空输入', () => {
    const q = mkQ({ mode: 'produce' });
    expect(canSubmit(q, '')).toBe(false);
    expect(canSubmit(q, '   ')).toBe(false);
    expect(canSubmit(q, 'hablo')).toBe(true);
  });

  it('canSubmit：辨认模式要原形 + 人称（+ 时态）齐了才放行', () => {
    const base = mkQ({ mode: 'recognize', askTense: false, pickPerson: null });
    expect(canSubmit(base, '')).toBe(false);
    expect(canSubmit({ ...base, pickPerson: 0 }, '')).toBe(false); // 只有人称
    expect(canSubmit(base, 'hablar')).toBe(false); // 只有原形
    expect(canSubmit({ ...base, pickPerson: 0 }, 'hablar')).toBe(true);

    const askT = mkQ({ mode: 'recognize', askTense: true, pickPerson: 0, pickTense: null });
    expect(canSubmit(askT, 'hablar')).toBe(false); // 还要选时态
    expect(canSubmit({ ...askT, pickTense: 'p' }, 'hablar')).toBe(true);
  });

  it('canSubmit：已作答的题不能再提交', () => {
    expect(canSubmit(mkQ({ mode: 'produce', correct: true }), 'hablo')).toBe(false);
  });

  it('showInfAt：辨认模式作答前一律不给看原形 —— 连 peek 都不行', () => {
    // 那题考的就是"从变位认回原形"，看一眼就没得做了（网页 recognize 分支
    // 干脆不渲染 infLine）
    const rec = mkQ({ mode: 'recognize' });
    expect(showInfAt(rec, false)).toBe(false);
    expect(showInfAt(rec, true)).toBe(false);
    // 作答之后才放回来（复盘要看正确答案）
    expect(showInfAt({ ...rec, correct: true }, false)).toBe(true);
    expect(showInfAt({ ...rec, correct: false }, true)).toBe(true);
  });

  it('showInfAt：其余模式看 hideInf，按「看原形」或作答后露出来', () => {
    const hidden = mkQ({
      mode: 'transfer',
      s: { ...mkQ({}).s, hideInf: true } as SettingsSnapshot,
    });
    expect(showInfAt(hidden, false)).toBe(false);
    expect(showInfAt(hidden, true)).toBe(true); // 手动 peek
    expect(showInfAt({ ...hidden, correct: true }, false)).toBe(true); // 作答后自动放回

    const shown = mkQ({ mode: 'transfer' });
    expect(showInfAt(shown, false)).toBe(true); // 没开 hideInf 就一直显示

    // 复现模式本来就给原形，不受 hideInf 影响
    const produce = mkQ({ mode: 'produce', s: { ...mkQ({}).s, hideInf: true } as SettingsSnapshot });
    expect(showInfAt(produce, false)).toBe(true);
  });
});

describe('作答页 —— 出题与作答区', () => {
  it('进页即出第一题，顶栏显示「第 1 题」', async () => {
    await fresh({ mode: 'produce' });
    expect(screen.getByTestId('stem')).toBeTruthy();
    expect(screen.getByTestId('input-ans')).toBeTruthy();
    expect(txt('progress')).toContain('第 1 题');
    // 旧口径「1 / 1 题」的分母是动态出题的总数，恒等于当前题号 —— 纯噪音（用户 2026-10-03）
    expect(txt('progress')).not.toContain('/');
  });

  it('模式徽标在最上面，且不再和题面挤在同一个框里', async () => {
    await fresh({ mode: 'produce' });
    expect(txt('mode-tag')).toBe('复现模式');
    // 题干框里只留题目本身 —— 徽标拎出去了
    expect(textsOf('stem-box')).not.toContain('复现模式');
    // 「在上面」：host 树的先序即渲染顺序（这里 stringify 的是 toJSON() 的普通对象，
    // 不是 React 元素，安全）
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('mode-tag');
    expect(tree.indexOf('mode-tag')).toBeLessThan(tree.indexOf('stem-box'));
  });

  it('模式徽标下面有一句话介绍（与首页同文案），且锁单行不许折', async () => {
    await fresh({ mode: 'produce' });
    // 文案与首页 mode-rule 同源（modeDesc），且**不重复模式名**
    expect(txt('mode-desc')).toBe('给出人称与时态，直接写出变位');
    // 单行锁死（用户 2026-10-03「注意不要断行」）
    expect(screen.getByTestId('mode-desc').props.numberOfLines).toBe(1);
    // 徽标字号放大到 15（Tag 的 size 入参）
    const tagStyle = StyleSheet.flatten(screen.getByTestId('mode-tag').props.style) as Record<
      string,
      unknown
    >;
    expect(tagStyle.fontSize).toBe(15);
    // 介绍在徽标之后、题干框之前
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('mode-tag')).toBeLessThan(tree.indexOf('mode-desc'));
    expect(tree.indexOf('mode-desc')).toBeLessThan(tree.indexOf('stem-box'));
  });

  it('辨认模式：给原形输入框 + 六个人称 + 重音条，没有手写答案框', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });
    expect(screen.getByTestId('input-inf')).toBeTruthy();
    expect(screen.queryByTestId('input-ans')).toBeNull();
    for (let i = 0; i < 6; i++) expect(screen.getByTestId(`person-${i}`)).toBeTruthy();
    expect(screen.getByTestId('accent-bar')).toBeTruthy();
  });

  it('辨认模式：题干不剧透 —— 不写时态、不给原形、也没有「看原形」', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });
    // 时态是这题要选的，写在题面上等于送答案
    expect(screen.queryByTestId('stem-meta')).toBeNull();
    // 原形是这题要写的，连「看原形」都不提供
    expect(screen.queryByTestId('peek')).toBeNull();
  });

  it('辨认模式：作答前整页不出现原形，作答后反馈里才给（用统计里记的原形验）', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });
    const before = pageText();

    // 故意写错的"原形" + 选一个人称 → 提交
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-inf'), 'zzzzzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('person-0'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('check-btn'));
    });

    // 引擎把这道题的原形记进了统计 —— 拿它当真值，不用猜抽到哪个动词
    const inf = useStatsStore.getState().wrong[0]?.inf ?? '';
    expect(inf).toBeTruthy();
    expect(before).not.toContain(inf); // 作答前没露过
    expect(pageText()).toContain(inf); // 反馈里给出来了
  });

  it('辨认模式：原形输入框有一句占位提示，说清这一格要写什么', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });
    expect(String(screen.getByTestId('input-inf').props.placeholder)).toBe('写出该动词的原形');
  });

  it('辨认模式：反馈给的是**原形**，不是变位形式（用户 2026-10-05）', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });

    // 故意写错的"原形" + 选一个人称 → 提交
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-inf'), 'zzzzzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('person-0'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('check-btn'));
    });

    const inf = useStatsStore.getState().wrong[0]?.inf ?? '';
    const ans = useStatsStore.getState().wrong[0]?.ans ?? '';
    expect(inf).toBeTruthy();
    expect(ans).toBeTruthy();
    expect(inf).not.toBe(ans); // 原形与变位形式本来就不是一个词

    // 反馈顶部那行「正确原形：」写的就是原形
    expect(textsOf('fb-inf')).toContain(inf);
    // 而**不能**把变位形式冒充成「正确答案」贴在这一屏（那是上一版的 bug）
    expect(pageText()).not.toContain('正确答案：');
  });

  it('辨认模式：人称选项上方有一句小标题，与时态那句对称', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });
    // 时态问「属于哪个时态」，人称也要问「属于哪个人称」（用户 2026-10-03）
    expect(pageText()).toContain('这个形式属于哪个人称');
  });

  it('辨认模式：不再铺一大段讲解文字，只在要选时态时留一行小标题', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });
    const all = pageText();
    // 原来那三句（recInfHint / hRec+hRec2 / hRec3）都删了
    expect(all).not.toContain('不显示原形');
    expect(all).not.toContain('选其中任何一种都算正确');
    // 单个时态时不问时态
    expect(screen.queryByTestId('tense-chips')).toBeNull();
  });

  it('辨认模式：多同类时态时才问，并给一行小标题指路', async () => {
    await fresh({ mode: 'recognize', tenses: ['p', 'pr'] }); // 都是简单时态 → 一定问
    expect(screen.getByTestId('tense-chips')).toBeTruthy();
    expect(pageText()).toContain('这个形式属于哪个时态');
  });

  it('辨认模式：时态选项做成语式选项卡（用户 2026-10-05 二次改版）', async () => {
    await fresh({ mode: 'recognize', tenses: ['p', 'pr'] });

    expect(screen.getByTestId('tense-chips')).toBeTruthy();

    // 至少两种语式才有 tab 可言；逐个 tab 点过去，点完下面都放得出时态键
    const tabs = screen.getAllByTestId(/^tpick-tab-/);
    expect(tabs.length).toBeGreaterThan(1);

    // 「只列同类时态」那句说明已按用户要求删除
    expect(pageText()).not.toContain('只列');
    // 确认没有旧的「分组卡」遗留
    expect(screen.queryByTestId(/^tpick-g-/)).toBeNull();
  });

  it('辨认模式：选项卡默认停在本题语式上，点别的 tab 才放出该语式的时态', async () => {
    await fresh({ mode: 'recognize', tenses: ['p', 'pr'] });

    // 默认 tab = 本题时态所属语式（现在时 → 陈述式）
    const tabs = screen.queryAllByTestId(/^tpick-tab-/);
    expect(tabs.length).toBeGreaterThan(0);
    // 点到一个非当前的 tab，再回来，都不炸
    for (const el of tabs) {
      await fireEvent.press(el);
      expect(screen.getByTestId('tense-chips')).toBeTruthy();
    }
  });

  it('时态选项键按语式上色（陈述=蓝底 / 虚拟=紫底 / 命令=橙边），不再全白', async () => {
    await fresh({ mode: 'recognize', tenses: ['p', 'pr'] });
    /* 本题的时态 chip 是「这个动词真正有形式、且与本题同类」的那些 —— 具体是哪些
       取决于随机抽到的动词，所以**不要写死某一个键**（`tense-ia` 这种断言会随
       抽到的动词忽红忽绿，是套假绿灯）。改成：逐个 chip 校验它按自己所属的语式上色。
       现在时态做成 tab，只有当前语式的 chip 在屏上 —— 所以逐个 tab 点过去逐组校验。 */
    const tabs = screen.getAllByTestId(/^tpick-tab-/);
    expect(tabs.length).toBeGreaterThan(1);

    const seen = new Set<string>();
    for (const tabEl of tabs) {
      await fireEvent.press(tabEl);
      const chips = screen
        .getAllByTestId(/^tense-/)
        .filter((el) => String(el.props.testID) !== 'tense-chips');
      expect(chips.length).toBeGreaterThan(0);
      chips.forEach((el) => {
        const k = String(el.props.testID).replace('tense-', '') as TenseKey;
        seen.add(T[k].g);
        expect(flatStyle(el.props.style).backgroundColor).toBe(theme.mood[T[k].g].soft);
        expect(flatStyle(el.props.style).borderColor).toBe(theme.mood[T[k].g].border);
      });
    }
    // 简单时态里既有陈述式也有虚拟 / 命令式 → tab 里至少两种语式，颜色才看得出差别
    expect(seen.size).toBeGreaterThan(1);
  });

  it('辨认模式没有主语药丸（那题就是要认人称，给了就白送）', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });
    expect(screen.queryByTestId('subj')).toBeNull();
  });

  it('复现模式：主语在输入框左边，且只取一个代词（不是「él / ella / usted」整组）', async () => {
    await fresh({ mode: 'produce', tenses: ['p'] });
    const subj = textsOf('subj');
    expect(subj).toBeTruthy();
    expect(subj).not.toContain('/'); // 整组会被输入框挤没
    expect(subj).not.toContain(' ');
  });

  it('复现模式：题干只写时态，不再重复人称（人称由主语药丸表达，说两遍是冗余）', async () => {
    await fresh({ mode: 'produce', tenses: ['p'] });
    const meta = textsOf('stem-meta');
    expect(meta).toBe('现在时');
    expect(meta).not.toContain(textsOf('subj'));
  });

  it('复现模式：框内顺序 = 中文释义 → 大字原形 → 目标时态，且原形不再出现两遍', async () => {
    // 默认设置 showZh 为开，所以框里一定有一行中文释义
    await fresh({ mode: 'produce', tenses: ['p'] });

    const inf = textsOf('stem'); // 大字原形
    expect(inf).toBeTruthy();
    // 释义行只写意思 —— 以前是 `${inf} · ${zh}`，原形在大字那行已经给过了（用户 2026-10-03）
    expect(txt('stem-zh')).toBeTruthy();
    expect(txt('stem-zh')).not.toContain(inf);

    // 渲染顺序（host 先序遍历）：释义 → 原形 → 时态药丸
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('stem-zh')).toBeLessThan(tree.indexOf('"stem"'));
    expect(tree.indexOf('"stem"')).toBeLessThan(tree.indexOf('stem-meta'));
  });

  it('题干里的时态按语式染色：复现模式那格是陈述式浅蓝底', async () => {
    await fresh({ mode: 'produce', tenses: ['p'] });
    const pill = screen.getByTestId('stem-tense-p');
    expect(flatStyle(pill.props.style).backgroundColor).toBe(theme.mood.ind.soft);
    expect(flatStyle(pill.props.style).borderColor).toBe(theme.mood.ind.border);
  });

  /* ---- 选择题（用户 2026-10-05：一行三个对齐、词内不断行、点选不即判） ---- */
  it('选择题：选项一格一行三个（flexBasis 30%）', async () => {
    await fresh({ mode: 'produce', tenses: ['p'], inputMode: 'choice' });
    const grid = screen.getByTestId('choices');
    // 容器是三列换行网格
    expect(flatStyle(grid.props.style).flexWrap).toBe('wrap');
    const opts = screen.getAllByTestId(/^opt-/);
    expect(opts.length).toBeGreaterThan(2);
    // 每个选项 flexBasis 30%（一行三个）
    opts.forEach((o) => expect(flatStyle(o.props.style).flexBasis).toBe('30%'));
  });

  it('选择题：点选项只选中、不立即判分；按确认才提交', async () => {
    await fresh({ mode: 'produce', tenses: ['p'], inputMode: 'choice' });
    const opts = screen.getAllByTestId(/^opt-/);
    await fireEvent.press(opts[0]);
    // 还没提交：反馈面板不出现、按钮仍是「确认」
    expect(screen.queryByTestId('feedback')).toBeNull();
    expect(screen.getByTestId('check-btn')).toBeTruthy();
    // 点了之后确认键可用（draft 非空）
    await fireEvent.press(screen.getByTestId('check-btn'));
    expect(screen.getByTestId('feedback')).toBeTruthy();
  });

  it('选择题：作答后正确项一律标绿（theme.color.ok）', async () => {
    await fresh({ mode: 'produce', tenses: ['p'], inputMode: 'choice' });
    const opts = screen.getAllByTestId(/^opt-/);
    await fireEvent.press(opts[0]);
    await fireEvent.press(screen.getByTestId('check-btn'));
    const bg = screen.getAllByTestId(/^opt-/).map((o) => flatStyle(o.props.style).backgroundColor);
    // 正确项一定被标绿；其余干扰项要么置灰、要么（若选错）标红
    expect(bg).toContain(theme.color.ok);
  });

  it('选择题：已作答后再点选项不改变选择（不再接受新的点选）', async () => {
    await fresh({ mode: 'produce', tenses: ['p'], inputMode: 'choice' });
    const opts = screen.getAllByTestId(/^opt-/);
    await fireEvent.press(opts[0]);
    await fireEvent.press(screen.getByTestId('check-btn'));
    expect(screen.getByTestId('feedback')).toBeTruthy();
    // 作答后再点第二个选项：不应重新判分（反馈还在、不崩）
    await fireEvent.press(screen.getAllByTestId(/^opt-/)[1]);
    expect(screen.getByTestId('feedback')).toBeTruthy();
  });

  it('转换模式：框内两行 —— 原时态 → 目标时态 / 形式 → ?；目标那格更醒目', async () => {
    await fresh({ mode: 'shift', tenses: ['p', 'f'] });
    // 第一行：两个时态；第二行：给出的形式 + 待填的「?」（用户 2026-10-03）
    expect(screen.getByTestId('shift-box')).toBeTruthy();
    expect(txt('shift-q')).toBe('?');
    expect(textsOf('shift-src').length).toBeGreaterThan(0);
    // 「超过整行一半就算长」（用户 2026-10-03）：形式格封顶 52%，超了在词间折行
    expect(flatStyle(screen.getByTestId('shift-src').props.style).maxWidth).toBe('52%');

    const pills = screen.getAllByTestId(/^stem-tense-/);
    expect(pills.length).toBe(2);

    // 第一格是"原时态"：灰底灰字，只交代出处
    expect(flatStyle(pills[0].props.style).backgroundColor).toBe(theme.color.tag);
    expect(flatStyle(pills[0].props.style).borderColor).toBe(theme.color.line);

    // 第二格是"目标时态"：语式浅底 + 同色边框（四个语式里必有一个）
    const tgtBorders = (['ind', 'cond', 'sub', 'imp'] as const).map((g) => theme.mood[g].border);
    const tgtStyle = flatStyle(pills[1].props.style);
    expect(tgtBorders).toContain(tgtStyle.borderColor);
    expect(tgtStyle.backgroundColor).not.toBe(theme.color.tag);

    // 两个药丸**字号一致**（用户 2026-10-04：名字大小要一样，只差配色和字重）
    const pillFontSize = (el: { props: { children?: unknown } }) => {
      const txt = (el.props.children ?? {}) as { props?: { style?: unknown } };
      return flatStyle(txt.props?.style).fontSize;
    };
    expect(pillFontSize(pills[0])).toBe(pillFontSize(pills[1]));
    expect(pillFontSize(pills[0])).toBe(15);
  });

  it('平移模式：A 原形 + 变位形式，B 原形 + 「?」，且**不给时态**（要自己认）', async () => {
    await fresh({ mode: 'transfer', tenses: ['p'] });
    expect(screen.getByTestId('xfer')).toBeTruthy();
    expect(txt('xfer-q')).toBe('?'); // B 那一格还没填
    // A 给的是已变位形式；走 ConjText 词级折行 —— 长形式排两行，不是缩字也不是截断
    const a = textsOf('xfer-a');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toContain('…');
    // 时态刻意不给：题干里一个时态名都不该出现（否则就没有"自己认时态"的考察）
    expect(screen.queryByTestId('stem-meta')).toBeNull();
    expect(pageText()).not.toContain('现在时');
    // A / B 两个字母标都在
    expect(textsOf('xfer')).toContain('A');
    expect(textsOf('xfer')).toContain('B');
  });

  it('复现模式 × 命令式：第三人称只给 usted / ustedes（没有 él / ella / ellos）', async () => {
    await fresh({ mode: 'produce', tenses: ['ia'] });
    const subj = textsOf('subj');
    ['él', 'ella', 'ellos', 'ellas'].forEach((p) => expect(subj).not.toContain(p));
    expect(['tú', 'usted', 'nosotros', 'vosotros', 'ustedes']).toContain(subj);
  });

  it('辨认模式 × 命令式：六格候选照常渲染（yo 格回退成通用标签，不崩）', async () => {
    // 回归（2026-10-02 真机）：命令式没有 yo，IMP_GLOSS/IMP_LABEL 只有 1~5 号键，
    // 渲染六格候选时若走命令式感知的释义，`IMP_GLOSS[0][lang]` 直接抛
    // "Cannot convert undefined value to object"。按网页口径，候选格释义永远用通用口径。
    await fresh({ mode: 'recognize', tenses: ['ia'] });
    expect(screen.getByTestId('stem')).toBeTruthy();
    for (let i = 0; i < 6; i++) expect(screen.getByTestId(`person-${i}`)).toBeTruthy();
    // yo 格（命令式语法上不存在，但同形读法需要它）显示代词 yo
    expect(textsOf('person-0')).toContain('yo');
  });

  it('重音快捷条：点字符进输入框；右侧清除键一键清空（不再是逐字退格）', async () => {
    await fresh({ mode: 'produce' });
    expect(val('input-ans')).toBe('');
    await act(async () => {
      fireEvent.press(screen.getByTestId('accent-á'));
    });
    expect(val('input-ans')).toBe('á');
    await act(async () => {
      fireEvent.press(screen.getByTestId('accent-ñ'));
    });
    expect(val('input-ans')).toBe('áñ');

    // 清除键在输入框那一行的右侧，一次清空
    expect(screen.getByTestId('input-clear')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('input-clear'));
    });
    expect(val('input-ans')).toBe('');
    // 老的那个退格键已经撤掉（用户 2026-10-02：换成清除键，省一行）
    expect(screen.queryByTestId('accent-backspace')).toBeNull();
  });

  it('没输入时「确认」是禁用的', async () => {
    await fresh({ mode: 'produce' });
    expect(screen.getByTestId('check-btn').props.accessibilityState?.disabled).toBe(true);
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-ans'), 'x');
    });
    expect(screen.getByTestId('check-btn').props.accessibilityState?.disabled).toBe(false);
  });
});

describe('作答页 —— 判分与落盘', () => {
  it('写错 → 出反馈面板、统计记为 1 答 1 错、错题本记 1 条', async () => {
    await fresh({ mode: 'produce' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-ans'), 'zzzzzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('check-btn'));
    });

    expect(screen.getByTestId('feedback')).toBeTruthy();
    const st = useStatsStore.getState();
    const sum = statsSummary(st);
    expect(sum.answers).toBe(1);
    expect(sum.err).toBe(1);
    expect(sum.acc).toBe(0);
    expect(st.wrong.length).toBe(1);
    // 反馈里给出正确答案
    expect(screen.getByTestId('feedback')).toBeTruthy();
  });

  it('作答后按钮从「确认」变成「下一题」，并出现六人称对照网格', async () => {
    await fresh({ mode: 'produce' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-ans'), 'zzzzzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('check-btn'));
    });
    expect(screen.queryByTestId('check-btn')).toBeNull();
    expect(screen.getByTestId('next-btn')).toBeTruthy();
    expect(screen.getByTestId('grid')).toBeTruthy();
    // 文案里不再带「→」（用户 2026-10-04：符号太多）—— 箭头由 chevron 图标画在文字右边
    expect(textsOf('next-btn')).not.toContain('→');
    expect(textsOf('next-btn')).toContain('下一题');
  });

  it('作答页顶栏有变位查询入口：推到 /conj-lookup（推入式、无底栏），带 inf/t/p 参数', async () => {
    await fresh({ mode: 'produce', tenses: ['p'] });
    fireEvent.press(screen.getByTestId('table-btn'));
    const push = (useRouter as jest.Mock).mock.results[0].value.push as jest.Mock;
    expect(push).toHaveBeenCalledTimes(1);
    const arg = push.mock.calls[0][0];
    expect(arg.pathname).toBe('/conj-lookup');
    expect(arg.params.inf).toBeTruthy();
    expect(arg.params.t).toBe('p');
    expect(arg.params.p).toMatch(/^[0-5]$/);
  });

  it('重复点确认不会重复计数（已作答的题不再接受提交）', async () => {
    await fresh({ mode: 'produce' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-ans'), 'zzzzzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('check-btn'));
    });
    // 作答后 check-btn 已经换成 next-btn，再确认也无从触发
    expect(useStatsStore.getState().total.att).toBe(1);
  });
});

describe('作答页 —— 翻页与退出', () => {
  it('下一题出新题，顶栏变「第 2 题」', async () => {
    await fresh({ mode: 'produce' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-ans'), 'zzzzzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('check-btn'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('next-btn'));
    });
    expect(txt('progress')).toContain('第 2 题');
    // 新题是未作答态
    expect(screen.getByTestId('check-btn')).toBeTruthy();
    expect(screen.queryByTestId('feedback')).toBeNull();
  });

  it('上一题回到已作答的那题，作答痕迹还在（反馈面板重新出现）', async () => {
    await fresh({ mode: 'produce' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-ans'), 'zzzzzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('check-btn'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('next-btn'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('prev-btn'));
    });
    expect(txt('progress')).toContain('第 1 题');
    expect(screen.getByTestId('feedback')).toBeTruthy();
  });

  it('第一题的「上一题」是禁用的', async () => {
    await fresh({ mode: 'produce' });
    expect(screen.getByTestId('prev-btn').props.accessibilityState?.disabled).toBe(true);
  });

  it('还没答题时返回，不弹确认直接走', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fresh({ mode: 'produce' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('back-btn'));
    });
    expect(spy).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('答过题之后返回，先弹「结束本次练习」确认', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fresh({ mode: 'produce' });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('input-ans'), 'zzzzzz');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('check-btn'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('back-btn'));
    });
    expect(spy).toHaveBeenCalled();
    // 弹窗文案里带本次成绩
    expect(String(spy.mock.calls[0][1])).toContain('正确率');
    spy.mockRestore();
  });
});
