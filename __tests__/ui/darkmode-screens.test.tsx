import { act, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useSettingsStore } from '@/store/settings';
import { useStatsStore } from '@/store/stats';
import { dark, light } from '@/ui/theme';

import PracticeScreen from '@/app/practice';
import ConjTableScreen from '@/app/(tabs)/conj-table';
import { GuideBody } from '@/ui/components/GuideBody';

import type { ModeKey } from '@/data/types';

/**
 * 深色模式 · **具体页面**的配色（用户 2026-10-06 报的 bug）。
 *
 * 用户原话：「手机版的深色模式还是有问题，虽然屏幕已经深色了，但是题干框，
 * 输入框，返回按钮等等还是白的，字也有一些是浅色的。讲解页里面也出现了这样的问题」
 *
 * 根因：这些组件在 `makeStyles()` 里**直接写死** `backgroundColor: '#ffffff'`，
 * 绕过了 `theme.color.*`。屏幕底色走了调色板（所以变深了），可框体没走
 * （所以还是白的），而框里的字按调色板变成了浅色 —— 白底浅字，看不见。
 *
 * 这个文件把这些"用户看得见的框"逐个钉住：深色档下底色必须是 `dark.card`
 * （或对应的派生令牌），**绝不允许是 `#ffffff`**。
 * `no-hardcoded-colors.test.ts` 从源码层拦，这里从渲染层再兜一道。
 */

jest.setTimeout(20000);

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const WHITE = '#ffffff';
/** 把 style（可能是数组 / 注册过的样式 / undefined）摊平成可直接读属性的对象 */
type StyleRec = Record<string, string | number | undefined>;
const flat = (s: unknown): StyleRec => (StyleSheet.flatten(s as never) ?? {}) as StyleRec;

/** 把设置调成深色档 + 指定练习模式，然后渲染 */
async function boot(opts: { mode?: ModeKey; inputMode?: 'type' | 'choice' } = {}) {
  await act(async () => {
    const st = useSettingsStore.getState();
    st.reset();
    st.setLang('zh', 'manual');
    st.setThemeMode('dark');
    st.setMode(opts.mode ?? 'produce');
    st.setTenses(['p']);
    st.setInputMode(opts.inputMode ?? 'type');
    useStatsStore.getState().clear();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  });
});

describe('深色模式 · 作答页的框体不再留白', () => {
  it('题干框 / 输入框 / 返回键 / 变位表键 都用 dark.card，不是 #ffffff', async () => {
    await boot({ mode: 'produce' });
    await render(<PracticeScreen />);

    const boxes: [string, string][] = [
      ['back-btn', '返回键'],
      ['table-btn', '变位表入口'],
      ['stem-box', '题干框'],
      ['input-ans', '输入框'],
    ];
    for (const [id, name] of boxes) {
      const bg = flat(screen.getByTestId(id).props.style).backgroundColor;
      expect(`${name}=${bg}`).toBe(`${name}=${dark.card}`);
      expect(bg).not.toBe(WHITE);
    }
  });

  it('清除键 / 重音键也是 dark.card（它们跟输入框同底）', async () => {
    await boot({ mode: 'produce' });
    await render(<PracticeScreen />);
    for (const id of ['input-clear', 'accent-á']) {
      const bg = flat(screen.getByTestId(id).props.style).backgroundColor;
      expect(bg).toBe(dark.card);
    }
  });

  it('辨认模式的时态选项框是 dark.card2（比卡片沉一档）', async () => {
    await boot({ mode: 'recognize' });
    // 时态选择器只在「同类的可选时态不止一个」时才出现（recAskTense），
    // 所以这里多选几个简单时态，把 TensePick 逼出来
    await act(async () => {
      useSettingsStore.getState().setTenses(['p', 'pr', 'i', 'f']);
    });
    await render(<PracticeScreen />);
    const pick = screen.queryByTestId('tense-chips');
    expect(pick).toBeTruthy();
    expect(flat(pick!.props.style).backgroundColor).toBe(dark.card2);
    expect(flat(pick!.props.style).backgroundColor).not.toBe(WHITE);
  });

  it('选择题的选项按钮是 dark.card（深色下不再是白块）', async () => {
    await boot({ mode: 'produce', inputMode: 'choice' });
    await render(<PracticeScreen />);
    const opts = screen.getAllByTestId(/^opt-/);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) {
      const bg = flat(o.props.style).backgroundColor;
      // 未选中的选项就是卡片底；已选/已判的会是 accent/ok/bad，这里只排除白色
      expect(bg).not.toBe(WHITE);
    }
  });

  it('平移模式的对照框：A/B 行与「?」占位都不是写死的白/浅灰', async () => {
    await boot({ mode: 'shift' });
    await render(<PracticeScreen />);
    const box = screen.queryByTestId('shift-box');
    if (box) {
      const bg = flat(box.props.style).backgroundColor;
      expect(bg === undefined || bg === dark.card).toBe(true);
    }
    const q = screen.queryByTestId('shift-q');
    if (q) {
      // 待填的「?」用 faint 色，深色下必须是深色版（#5b636f），不是浅灰 #b9c2d4
      expect(flat(q.props.style).color).toBe(dark.faint);
      expect(flat(q.props.style).color).not.toBe(light.faint);
    }
  });
});

describe('深色模式 · 讲解页不再留白（用户也点名了讲解页）', () => {
  it('正文 / h3 / `.es` 词条 都走深色令牌，不含任何亮色底或亮色字', async () => {
    await boot({});
    await render(
      <GuideBody
        testID="gd"
        lang="zh"
        blocks={[
          { t: 'h3', kids: [{ t: 'text', v: '规则' }] },
          { t: 'p', kids: [{ t: 'text', v: '看 ' }, { t: 'es', kids: [{ t: 'text', v: 'hablar' }] }] },
          { t: 'tip', tone: 'warn', kids: [{ t: 'text', v: '注意重音' }] },
        ]}
      />
    );
    const json = JSON.stringify(screen.toJSON());

    // 曾经写死的那些浅色一个都不能再出现
    expect(json).not.toContain('#f1f4f9'); // .es / code 的浅灰底
    expect(json).not.toContain(light.bodyInk); // #334155
    expect(json).not.toContain(light.bodyInk2); // #475569
    expect(json).not.toContain(light.tag); // #eef1f6

    // 深色版确实用上了
    expect(json).toContain(dark.tag);
    expect(json).toContain(dark.bodyInk);
    expect(json).toContain(dark.bodyInk2);
  });
});

describe('深色模式 · 变位表页不再留白', () => {
  it('推入版的返回键用 dark.card（tab 版没有返回键）', async () => {
    await boot({});
    await render(<ConjTableScreen showBackButton onBack={jest.fn()} />);
    expect(flat(screen.getByTestId('table-back').props.style).backgroundColor).toBe(dark.card);
  });

  it('分组卡用 dark.raise；时态对卡用 dark.card；搜索框不是白的', async () => {
    await boot({});
    await render(<ConjTableScreen />);

    const groups = screen.getAllByTestId(/^dwg-/);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(flat(g.props.style).backgroundColor).toBe(dark.raise);
      expect(flat(g.props.style).backgroundColor).not.toBe(WHITE);
    }

    const pairs = screen.getAllByTestId(/^dwp-/);
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      expect(flat(p.props.style).backgroundColor).toBe(dark.card);
      expect(flat(p.props.style).backgroundColor).not.toBe(WHITE);
    }

    // 搜索框：RN 的 TextInput 不显式设底时是透明的（透出下面的卡片底），
    // 只要不是写死的白就行 —— 深色下它会跟着卡片的 dark.card 走
    const searchBg = flat(screen.getByTestId('dw-q').props.style).backgroundColor;
    expect(searchBg === undefined || searchBg === dark.card).toBe(true);
  });
});
