import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { defaultCustom } from '@/data/levels';
import { ALL_TENSE_KEYS, LV_TENSE, TENSES } from '@/data/tenses';
import { VERBS } from '@/data/verbs';
import { buildPool } from '@/engine/pool';
import { useCustomStore } from '@/store/custom';
import { useSettingsStore } from '@/store/settings';

import SlotSettingsScreen from '@/app/slot-settings';

import type { GroupKey, PresetCfg } from '@/data/types';

/**
 * `expo-router` 的两支 hook 用 `jest.fn()` 顶掉 —— 用「先 mock 成 jest.fn、
 * 再在 import 之后 mockReturnValue」的写法，而不是在 factory 里闭包引用外面的
 * 变量（`jest.mock` 会被提升到 `const` 之前，闭包写法会踩 TDZ）。
 */
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

/** 页面只用 `useSafeAreaInsets` 一支，给个常量最省事（不必去转译包里的 mock.tsx） */
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
let canGoBack = true;

const asMock = (f: unknown) => f as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  canGoBack = true;
  asMock(useRouter).mockReturnValue({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => canGoBack,
  });
  asMock(useLocalSearchParams).mockReturnValue({ key: 'custom1' });
});

/**
 * 每个用例都从**干净的 store**开跑 —— 这个页面把槽里的配置读进草稿，
 * 上一个用例点过什么会直接影响下一个用例的初值（试过，确实会串）。
 *
 * 两处细节：
 *  · 写 store 一律包 `act`；裸写会留下未闭合的 act 作用域，污染后面的用例。
 *  · `reset()` 会把 `langMode` 打回 `system`，而 jest 环境的系统语言是 en ——
 *    所以**必须 reset 之后再 `setLang('zh','manual')`**，顺序反了就全线出英文。
 */
async function freshStores() {
  await act(async () => {
    useSettingsStore.getState().reset();
    useCustomStore.getState().resetAll();
    useSettingsStore.getState().setLang('zh', 'manual');
  });
}

/** 干净 store + 渲染（绝大多数用例的起手式） */
async function open(params: Record<string, unknown> = { key: 'custom1' }) {
  await freshStores();
  asMock(useLocalSearchParams).mockReturnValue(params);
  return render(<SlotSettingsScreen />);
}

/** 把一个槽预置成指定配置（同样先清干净，避免受上一个用例影响） */
async function seedSlot(k: string, cfg: PresetCfg) {
  await freshStores();
  await act(async () => {
    useCustomStore.getState().save(k, cfg);
  });
}

/**
 * 取某个节点下的**全部文本**（递归）。
 * `ss-tcount` 是个 View，里面套着 `RichText` 的多个 `<Text>` 段，
 * 所以不能只看直接 children —— 那样只会拿到 React 元素本身（`[object Object]`）。
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

/** 计数行里的「已选 N」（注意别把尾巴上的总数 M 也当进来） */
function selectedN(): number {
  const m = textsOf('ss-tcount').match(/已选\s*(\d+)/);
  return m ? Number(m[1]) : Number.NaN;
}

/** 「当前 N 个动词」里的 N */
function poolN(): number {
  const m = textsOf('ss-pool').match(/\d+/);
  return m ? Number(m[0]) : Number.NaN;
}

const tap = (testID: string) => fireEvent.press(screen.getByTestId(testID));

describe('slot-settings · 页面骨架', () => {
  it('渲染出三小节与底部两个按钮', async () => {
    await open();
    expect(screen.getByTestId('slot-settings')).toBeTruthy();
    expect(screen.getByTestId('ss-sec-lib')).toBeTruthy();
    expect(screen.getByTestId('ss-sec-tense')).toBeTruthy();
    expect(screen.getByTestId('ss-sec-other')).toBeTruthy();
    expect(screen.getByTestId('ss-reset')).toBeTruthy();
    expect(screen.getByTestId('ss-save')).toBeTruthy();
  });

  it('顶栏显示「自定义 1」（按 key 推导槽号）', async () => {
    await open();
    expect(screen.getByText('自定义 1')).toBeTruthy();
  });

  it('custom2 显示「自定义 2」', async () => {
    await open({ key: 'custom2' });
    expect(screen.getByText('自定义 2')).toBeTruthy();
  });

  it('六个等级 chip 都在（A1~C2 词表里都有动词）', async () => {
    await open();
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].forEach((lv) => {
      expect(screen.getByTestId(`ss-lv-${lv}`)).toBeTruthy();
    });
  });

  it('标签 chip 是 6 项（含「全部」）', async () => {
    await open();
    ['all', '不规则', '规则', '高频', '拼写变化', '词干变化'].forEach((k) => {
      expect(screen.getByTestId(`ss-tag-${k}`)).toBeTruthy();
    });
  });

  it('进页面不改任何东西 → 不算改过（保存禁用、没有小圆点）', async () => {
    await open();
    expect(screen.queryByTestId('ss-dirty')).toBeNull();
    expect(screen.getByTestId('ss-save').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('slot-settings · 等级（多选，至少留 1 个）', () => {
  it('默认只选 A2；点 A1 会加上，两个都亮', async () => {
    await open();
    expect(screen.getByTestId('ss-lv-A2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('ss-lv-A1').props.accessibilityState.selected).toBe(false);

    await fireEvent.press(screen.getByTestId('ss-lv-A1'));
    expect(screen.getByTestId('ss-lv-A1').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('ss-lv-A2').props.accessibilityState.selected).toBe(true);
  });

  it('点掉最后一个等级会被拒绝 —— A2 仍然亮着', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-lv-A2'));
    expect(screen.getByTestId('ss-lv-A2').props.accessibilityState.selected).toBe(true);
  });

  it('有两个等级时可以点掉一个', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-lv-A1'));
    await fireEvent.press(screen.getByTestId('ss-lv-A2'));
    expect(screen.getByTestId('ss-lv-A2').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('ss-lv-A1').props.accessibilityState.selected).toBe(true);
  });
});

describe('slot-settings · 标签（单选）', () => {
  it('点一个标签就选中它，「全部」让位', async () => {
    await open();
    expect(screen.getByTestId('ss-tag-all').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(screen.getByTestId('ss-tag-不规则'));
    expect(screen.getByTestId('ss-tag-不规则').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('ss-tag-all').props.accessibilityState.selected).toBe(false);
  });

  it('再点一次回到「全部」', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-tag-不规则'));
    await fireEvent.press(screen.getByTestId('ss-tag-不规则'));
    expect(screen.getByTestId('ss-tag-all').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('ss-tag-不规则').props.accessibilityState.selected).toBe(false);
  });

  it('点另一个标签是**替换**而不是叠加（任何时刻只有一个亮）', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-tag-不规则'));
    await fireEvent.press(screen.getByTestId('ss-tag-规则'));
    expect(screen.getByTestId('ss-tag-规则').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('ss-tag-不规则').props.accessibilityState.selected).toBe(false);
  });
});

describe('slot-settings · 时态', () => {
  it('推荐键 A1 一键套用（整串替换，不是追加）', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-rec-A1'));

    // 套用后 A1 档亮、A2 档灭
    expect(screen.getByTestId('ss-rec-A1').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('ss-rec-A2').props.accessibilityState.selected).toBe(false);
    // 计数行跟着变
    expect(selectedN()).toBe(LV_TENSE.A1.length);
  });

  it('计数行走 RichText —— 界面上不能出现 [[ ]] 标记', async () => {
    // `tCount` 的原文是 '已选 [[8]] / 15 个时态'，[[…]] 是给 RichText 的强调标记。
    // 一旦被当成纯文本塞进 <Text>，用户看到的就是带方括号的原文（真机上踩过）。
    await open();
    expect(textsOf('ss-tcount')).not.toContain('[[');
    expect(textsOf('ss-tcount')).toContain('已选');
  });

  it('切一个时态 chip：取消已选的「现在时」', async () => {
    await open();
    const before = selectedN();
    // TenseGrid 里 chip 的 testID 是 `<testID>-<时态键>`
    await fireEvent.press(screen.getByTestId('ss-grid-p'));
    expect(selectedN()).toBe(before - 1);
  });

  it('组的「清空」把该语式的时态全摘掉，别的语式不受影响', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-rec-B2')); // 先全选
    expect(selectedN()).toBe(ALL_TENSE_KEYS.length);

    const indN = TENSES.filter((x) => x.g === 'ind').length;
    // 陈述式组头右侧的「清空」（testID 形如 ss-grid-<语式>-none）
    await fireEvent.press(screen.getByTestId('ss-grid-ind-none'));

    expect(selectedN()).toBe(ALL_TENSE_KEYS.length - indN);
    // 别的语式一个没动 —— 证明只清了本组。
    // 注意 testID：`ss-grid-<语式>` 是**分组卡**（View，没有 accessibilityState），
    // chip 是 `ss-grid-<时态键>`，所以这里取各语式的第一个时态键。
    const firstOf = (g: GroupKey) => TENSES.filter((x) => x.g === g)[0].k;
    expect(screen.getByTestId(`ss-grid-${firstOf('sub')}`).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId(`ss-grid-${firstOf('cond')}`).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId(`ss-grid-${firstOf('imp')}`).props.accessibilityState.selected).toBe(true);
  });
});

describe('slot-settings · 词库实时计数', () => {
  it('计数 = 当前草稿跑一遍 buildPool', async () => {
    await open();
    expect(poolN()).toBe(buildPool(VERBS, defaultCustom()).length);
  });

  it('加一个等级 → 计数变大', async () => {
    await open();
    const before = poolN();
    await fireEvent.press(screen.getByTestId('ss-lv-A1'));
    expect(poolN()).toBeGreaterThan(before);
  });

  it('选标签 → 计数变小（等级 ∩ 标签 是交集）', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-lv-B2'));
    const before = poolN();
    await fireEvent.press(screen.getByTestId('ss-tag-不规则'));
    expect(poolN()).toBeLessThan(before);
  });
});

describe('slot-settings · 保存', () => {
  it('保存 = 写槽 + 载入设置 + activeKey 指向该槽 + 回上一页', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-lv-A1'));
    await fireEvent.press(screen.getByTestId('ss-tag-高频'));
    await fireEvent.press(screen.getByTestId('ss-input-choice'));
    await fireEvent.press(screen.getByTestId('ss-save'));

    const slot = useCustomStore.getState().cfgOf('custom1');
    expect(slot?.levels).toEqual(['A1', 'A2']);
    expect(slot?.tagFilter).toBe('高频');
    expect(slot?.inputMode).toBe('choice');

    const s = useSettingsStore.getState();
    expect(s.levels).toEqual(['A1', 'A2']);
    expect(s.tagFilter).toBe('高频');
    expect(s.inputMode).toBe('choice');
    expect(s.activeKey).toBe('custom1');

    expect(mockBack).toHaveBeenCalled();
  });

  it('另一个槽不受影响（custom1 改了，custom2 还是默认）', async () => {
    await seedSlot('custom2', defaultCustom());
    await render(<SlotSettingsScreen />);
    await fireEvent.press(screen.getByTestId('ss-lv-B1'));
    await fireEvent.press(screen.getByTestId('ss-save'));

    expect(useCustomStore.getState().cfgOf('custom2')).toEqual(defaultCustom());
  });

  it('保存后不再算"改过"（store 里的值已和草稿一致）', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('ss-lv-A1'));
    await fireEvent.press(screen.getByTestId('ss-save'));

    const saved = useCustomStore.getState().cfgOf('custom1');
    expect(saved?.levels).toEqual(['A1', 'A2']);
  });
});

describe('slot-settings · 恢复默认', () => {
  it('只重置草稿，**不写盘**', async () => {
    const custom: PresetCfg = {
      levels: ['B1', 'B2'],
      tenses: ['f'],
      tagFilter: '不规则',
      inputMode: 'choice',
    };
    await seedSlot('custom1', custom);
    await render(<SlotSettingsScreen />);

    // 先把草稿改脏，再恢复默认
    await fireEvent.press(screen.getByTestId('ss-lv-A2'));
    expect(screen.getByTestId('ss-dirty')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('ss-reset'));

    // 草稿回到默认配方 → 与盘上的 custom 不一致，所以仍是"改过"状态
    expect(screen.getByTestId('ss-lv-A2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('ss-lv-B1').props.accessibilityState.selected).toBe(false);
    // 但盘上那份**一个字节都没动**
    expect(useCustomStore.getState().cfgOf('custom1')).toEqual(custom);
  });

  it('盘上就是默认配方时，恢复默认后回到"没改过"（保存重新禁用）', async () => {
    await seedSlot('custom1', defaultCustom());
    await render(<SlotSettingsScreen />);
    await fireEvent.press(screen.getByTestId('ss-lv-B1'));
    expect(screen.getByTestId('ss-dirty')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('ss-reset'));
    expect(screen.queryByTestId('ss-dirty')).toBeNull();
    expect(screen.getByTestId('ss-save').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('slot-settings · 未保存就返回', () => {
  it('没改动 → 直接返回，不弹确认框', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await open();
    await fireEvent.press(screen.getByTestId('ss-back'));

    expect(spy).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('改了没存 → 弹「放弃修改？」，选「继续编辑」不返回', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await open();
    await fireEvent.press(screen.getByTestId('ss-lv-A1'));
    await fireEvent.press(screen.getByTestId('ss-back'));

    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toBe('放弃修改？');
    // 第一个按钮是「继续编辑」（cancel），点了不该出栈
    expect(mockBack).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('弹窗里选「放弃修改」才真的返回', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await open();
    await fireEvent.press(screen.getByTestId('ss-lv-A1'));
    await fireEvent.press(screen.getByTestId('ss-back'));

    const buttons = spy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const discard = buttons.find((b) => b.text === '放弃修改');
    expect(discard).toBeTruthy();
    await act(async () => {
      discard?.onPress?.();
    });
    expect(mockBack).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('slot-settings · key 兜底', () => {
  it('key 不是自定义槽 → 不渲染内容，直接退出去', async () => {
    await open({ key: 'starter' });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(screen.queryByTestId('slot-settings')).toBeNull();
  });

  it('完全没有 key → 同样退出去', async () => {
    await open({});
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('没有上一页可退（深链进来）→ 换成首页而不是卡死', async () => {
    canGoBack = false;
    await open({ key: 'zzz' });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockBack).not.toHaveBeenCalled();
  });
});
