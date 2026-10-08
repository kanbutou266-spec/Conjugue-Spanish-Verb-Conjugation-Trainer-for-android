import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { VERBS } from '@/data/verbs';
import { buildPool } from '@/engine/pool';
import { useSettingsStore } from '@/store/settings';

import PracticeHomeScreen from '@/app/(tabs)/index';

import type { ModeKey, PresetCfg, TenseKey } from '@/data/types';

/** 首个用例要付整个页面树的冷启动开销，5s 默认值不够 */
jest.setTimeout(20000);

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPush = jest.fn();
const asMock = (f: unknown) => f as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  asMock(useRouter).mockReturnValue({ push: mockPush, back: jest.fn(), replace: jest.fn() });
});

/**
 * 每个用例都从干净 store 起跑。
 * `reset()` 会把 `langMode` 打回 `system`，而 jest 系统的语言是 en ——
 * 必须 **reset 之后再 `setLang('zh','manual')`**，顺序反了整页会是英文。
 */
async function fresh(
  opts: { mode?: ModeKey; tenses?: TenseKey[]; cfg?: Partial<PresetCfg> } = {}
) {
  await act(async () => {
    const st = useSettingsStore.getState();
    st.reset();
    st.setLang('zh', 'manual');
    if (opts.cfg) st.applyCfg({ levels: ['A1'], tenses: ['p'], tagFilter: '', inputMode: 'type', ...opts.cfg });
    if (opts.mode) st.setMode(opts.mode);
    if (opts.tenses) st.setTenses(opts.tenses);
  });
  return render(<PracticeHomeScreen />);
}

/**
 * 递归取某个 testID 节点下的全部文字（RichText 会套多层 `<Text>`）。
 *
 * ⚠️ 起点必须是 **host 节点**（`screen.getByTestId(x).children`），
 * 不能从 `props.children` 起 —— 后者给的是 React 元素，而 React 元素的子节点在
 * `props.children` 上、不在 `children` 上，递归会静默跳过所有嵌套 `<Text>`，
 * 结果只收到纯字符串、数字全丢（表现为 `当前题库： 个动词 /  个时态`）。
 */
function textsOf(testID: string): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (typeof node === 'string' || typeof node === 'number') {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const kids = (node as { children?: unknown }).children;
    if (Array.isArray(kids)) kids.forEach(walk);
  };
  walk(screen.getByTestId(testID).children);
  return out.join('');
}

const startDisabled = (): boolean =>
  !!screen.getByTestId('start-btn').props.accessibilityState?.disabled;

/**
 * 从渲染出来的 host 树里捞出某个 testID 的**节点本身**（不是 RNTL 的 instance）。
 * 用来对一个子树做序列化断言 —— 比如「这个按钮里不该有图标」。
 */
function hostNode(testID: string): unknown {
  const find = (n: unknown): unknown => {
    if (n === null || n === undefined || typeof n !== 'object') return null;
    if (Array.isArray(n)) {
      for (const c of n) {
        const r = find(c);
        if (r) return r;
      }
      return null;
    }
    const el = n as { props?: { testID?: string }; children?: unknown };
    if (el.props?.testID === testID) return el;
    return find(el.children);
  };
  return find(screen.toJSON());
}

/* ==================================================================== */

describe('练习首页 —— 三段式结构与启动栏', () => {
  it('三个分区都在：练习模式 / 难度 / 启动栏', async () => {
    await fresh();
    expect(screen.getByTestId('sec-mode')).toBeTruthy();
    expect(screen.getByTestId('sec-keys')).toBeTruthy();
    expect(screen.getByTestId('startbar')).toBeTruthy();
  });

  it('四个模式按钮 + 下方只留一句话规则（不再重复模式名）', async () => {
    await fresh({ mode: 'produce' });
    // ModeSelector 的四个键
    (['recognize', 'produce', 'shift', 'transfer'] as ModeKey[]).forEach((k) => {
      expect(screen.getByTestId(`mode-${k}`)).toBeTruthy();
    });
    const rule = textsOf('mode-rule');
    expect(rule).toContain('给出人称与时态');
    // 模式名已经印在按钮上了，下面再写一句「复现模式 · …」是同一句话说两遍
    expect(rule).not.toContain('复现模式');
  });

  it('点另一个模式会切换（并只切一次）', async () => {
    await fresh({ mode: 'recognize' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('mode-shift'));
    });
    expect(useSettingsStore.getState().modes[0]).toBe('shift');
  });
});

describe('练习首页 —— 启动栏口径（逐条对照网页 renderStartbar）', () => {
  it('正常态：题库行显示动词数与时态数，按钮可点、文案是「开始练习」', async () => {
    await fresh({ mode: 'produce', tenses: ['p', 'pr', 'i'] });
    const n = buildPool(VERBS, useSettingsStore.getState()).length;
    const line = textsOf('pool-line');
    expect(line).toContain(`${n} 个动词`);
    expect(line).toContain('3 个时态');
    expect(startDisabled()).toBe(false);
    expect(textsOf('start-btn')).toContain('开始练习');
  });

  it('题库行里的 [[…]] 强调标记不得裸显示', async () => {
    await fresh({ mode: 'produce' });
    expect(textsOf('pool-line')).not.toContain('[[');
    expect(textsOf('pool-line')).not.toContain(']]');
  });

  it('开始键不带任何箭头：文案末尾没有 →，按钮里也不挂 > 图标', async () => {
    await fresh({ mode: 'produce', tenses: ['p'] });
    expect(textsOf('start-btn')).toBe('开始练习');
    // 图标（lucide → react-native-svg）一个都不该有：整个按钮的 host 子树里没有 svg 节点
    expect(JSON.stringify(hostNode('start-btn'))).not.toContain('svg');
  });

  it('变位查询已上移为底栏 tab（用户 2026-10-04）：启动栏里不再有小按钮', async () => {
    await fresh({ mode: 'produce', tenses: ['p'] });
    expect(screen.queryByTestId('table-btn')).toBeNull();
    // 开始键独占一行
    expect(textsOf('start-btn')).toBe('开始练习');
  });

  it('没选任何时态 → 换成专门那句、按钮禁用、文案变「请先选择时态」', async () => {
    await fresh({ mode: 'produce', tenses: [] });
    expect(textsOf('pool-line')).toContain('还没有选择任何时态');
    expect(startDisabled()).toBe(true);
    expect(textsOf('start-btn')).toContain('请先选择时态');
    // 没选时态时不显示「N 个动词」
    expect(textsOf('pool-line')).not.toContain('个动词');
  });

  it('题库空 → 按钮禁用、文案变「题库为空」', async () => {
    /* 「B2 + 只练高频」是全库里唯一两个空组合之一（另一个是 C2 + 高频）——
       词表里 B2/C2 没有任何带「高频」标签的动词，所以这个组合必然出空库。
       （选它是因为「等级至少留 1 个」的约束挡住了"把等级清空"这条更直觉的路。） */
    await fresh({ mode: 'produce', cfg: { levels: ['B2'], tagFilter: '高频' }, tenses: ['p'] });
    expect(buildPool(VERBS, useSettingsStore.getState()).length).toBe(0);
    expect(startDisabled()).toBe(true);
    expect(textsOf('start-btn')).toContain('题库为空');
  });

  it('转换模式 + 只有 1 个时态 → 提示需要至少 2 个时态（但不禁用按钮）', async () => {
    await fresh({ mode: 'shift', tenses: ['p'] });
    expect(textsOf('warn-line')).toContain('需要至少 2 个时态');
    // 只提示不拦截：降级由 makeQuestion 内部做，用户仍可按开始
    expect(startDisabled()).toBe(false);
  });

  it('转换模式 + 2 个时态 → 不再提示', async () => {
    await fresh({ mode: 'shift', tenses: ['p', 'pr'] });
    expect(screen.queryByTestId('warn-line')).toBeNull();
  });

  it('平移模式 + 题库只有 1 个动词 → 提示需要至少 2 个动词', async () => {
    // C1 + 只练高频 = 恰好 1 个动词
    await fresh({ mode: 'transfer', cfg: { levels: ['C1'], tagFilter: '高频' }, tenses: ['p'] });
    expect(buildPool(VERBS, useSettingsStore.getState()).length).toBe(1);
    // warnTail 会把 warnTransfer 整个嵌进去：「…已选模式里的「平移模式」需要题库里至少 2 个动词 才能出题…」
    expect(textsOf('warn-line')).toContain('需要题库里至少 2 个动词');
  });

  it('平移模式 + 题库够大 → 不提示', async () => {
    await fresh({ mode: 'transfer', tenses: ['p'] });
    expect(buildPool(VERBS, useSettingsStore.getState()).length).toBeGreaterThan(1);
    expect(screen.queryByTestId('warn-line')).toBeNull();
  });

  it('非转换/平移模式：即使单时态也不提示', async () => {
    await fresh({ mode: 'recognize', tenses: ['p'] });
    expect(screen.queryByTestId('warn-line')).toBeNull();
  });
});

describe('练习首页 —— 进练习', () => {
  it('点「开始练习」推入作答页', async () => {
    await fresh({ mode: 'produce', tenses: ['p', 'pr'] });
    await act(async () => {
      fireEvent.press(screen.getByTestId('start-btn'));
    });
    expect(mockPush).toHaveBeenCalledWith('/practice');
  });

  it('按钮禁用时点了也不会跳转', async () => {
    await fresh({ mode: 'produce', tenses: [] });
    await act(async () => {
      fireEvent.press(screen.getByTestId('start-btn'));
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('练习首页 —— 难度轮播与自动槽编辑', () => {
  it('轮播渲染滑动轨道 + 六张卡 + 常驻词库详情', async () => {
    await fresh({ mode: 'produce' });
    expect(screen.getByTestId('carousel-stage')).toBeTruthy();
    expect(screen.getByTestId('carousel-scroll')).toBeTruthy();
    expect(screen.getByTestId('carousel-detail')).toBeTruthy();
    // 6 档的卡同时挂在轨道上（滑动的物质基础）
    for (const k of ['starter', 'build', 'verbs', 'exam', 'custom1', 'custom2']) {
      expect(screen.getByTestId(`carousel-card-${k}`)).toBeTruthy();
    }
  });

  it('往右滑一档，activeKey 跟着变（滑动 → store → props 的闭环）', async () => {
    await fresh({ mode: 'produce' });
    const before = useSettingsStore.getState().activeKey;
    const step = screen.getByTestId('carousel-scroll').props.snapToInterval as number;

    // 落位只听 onScroll + 120ms 静默（松手事件在真机上不可靠），喂完要等防抖
    await act(async () => {
      fireEvent(screen.getByTestId('carousel-scroll'), 'scroll', {
        nativeEvent: { contentOffset: { x: step, y: 0 } },
      });
      await new Promise((r) => setTimeout(r, 200));
    });

    const after = useSettingsStore.getState().activeKey;
    expect(after).not.toBe(before);
    expect(after).toBeTruthy();
  });

  it('自定义槽卡片上的「编辑」推入设置页（预设档没有这个按钮）', async () => {
    await fresh({ mode: 'produce' });
    await act(async () => {
      useSettingsStore.getState().setActiveKey('custom1');
    });
    // 卡片恒在轨道上，但详情栏有淡出→换内容→淡入，`shownIdx` 比 `idx` 慢半步 → 等它落定
    const edit = await waitFor(() => screen.getByTestId('carousel-edit-custom1'), { timeout: 3000 });
    await act(async () => {
      fireEvent.press(edit);
    });
    expect(mockPush).toHaveBeenCalledWith('/slot-settings?key=custom1');
  });
});
