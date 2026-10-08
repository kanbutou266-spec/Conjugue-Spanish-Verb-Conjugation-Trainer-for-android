import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import GuideTocScreen from '@/app/(tabs)/guide';
import GuidePageScreen from '@/app/guide/[slug]';
import { GUIDE, guideText } from '@/data/guide';
import { useSettingsStore } from '@/store/settings';

const { txt, textsOf, partsOf } = require('./_tree');

/**
 * 讲解栏 —— 目录页（底栏第 2 个 tab）+ 详情页（推入式 `guide/[slug]`）。
 *
 * 页面本身很薄（数据与解析都在 `data/guide.ts` / `engine/guide.ts`，
 * 那里已有 13 个单测），这里只验"接得对不对"：八页都列出来了吗、
 * 点了有没有推对路由、翻页/目录切换是不是 `replace`（不能堆返回栈）、
 * 前后页禁用状态、认不出的 slug 会不会白屏。
 *
 * ⚠️ RNTL 14 的 `render` / `fireEvent` / `unmount` 全是 **async**，漏 `await`
 * 会拿到未定型的 Promise（`screen` 一直是"render 还没调用"的占位对象）。
 */
jest.setTimeout(20000);

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
/** 页面里渲染的 `<Stack.Screen options={...}>` 收到的 options（转场方向断言用）。
    mock 的 Stack.Screen 把它挂到 `globalThis.__lastStackOptions` 上。 */
let mockSetOptions = jest.fn();

let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: jest.fn(),
    useLocalSearchParams: jest.fn(),
    // 翻页方向现在是页面内 `<Stack.Screen options>` 驱动的（见页面注释）。
    // 这里 mock 成"把 options 记下来"的假组件，供断言读取。
    Stack: {
      Screen: ({ options }: { options?: unknown }) => {
        mockSetOptions(options);
        return null;
      },
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const asMock = (f: unknown) => f as jest.Mock;

/** 点一下（press 在 RNTL 14 是 async，必须包在 act + await 里） */
const tap = (testID: string) =>
  act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  mockSetOptions = jest.fn();
  asMock(useRouter).mockReturnValue({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
    navigate: mockNavigate,
    canGoBack: () => true,
  });
  asMock(useLocalSearchParams).mockImplementation(() => mockParams);

  await act(async () => {
    const st = useSettingsStore.getState();
    st.reset();
    st.setLang('zh', 'manual');
  });
});

/* ================================ 目录页 ================================ */

describe('讲解 · 目录页', () => {
  it('标题与简介在，八页一条不落', async () => {
    await render(<GuideTocScreen />);
    expect(txt('guide-title')).toBe('语法讲解');
    expect(GUIDE.length).toBe(8);
    for (const g of GUIDE) {
      expect(screen.getByTestId(`guide-row-${g.k}`)).toBeTruthy();
    }
  });

  it('每行 = 序号圆标 + 去掉序号的完整标题 + 短标题副标题', async () => {
    await render(<GuideTocScreen />);
    const text = textsOf('guide-row-past');
    // 序号 ② 在圆标里；标题正文不该再带一遍序号（splitGuideTitle 拆过）
    expect(text).toContain('②');
    const rest = guideText(GUIDE[1]!.t, 'zh').replace(/^\s*②\s*/, '');
    expect(text).toContain(rest);
    expect(text).toContain(guideText(GUIDE[1]!.s, 'zh'));
  });

  it('最后一页不画分隔线（last）', async () => {
    await render(<GuideTocScreen />);
    const last = GUIDE[GUIDE.length - 1]!;
    expect(JSON.stringify(screen.getByTestId(`guide-row-${last.k}`))).not.toContain(
      'borderBottomWidth'
    );
    // 反面参照：中间那行是带分隔线的
    expect(JSON.stringify(screen.getByTestId('guide-row-basics'))).toContain('borderBottomWidth');
  });

  it('点某一行推入对应 slug 的详情页', async () => {
    await render(<GuideTocScreen />);
    await tap('guide-row-subj');
    expect(mockPush).toHaveBeenCalledWith('/guide/subj');
  });
});

/* ================================ 详情页 ================================ */

const open = async (slug?: string) => {
  mockParams = slug === undefined ? {} : { slug };
  return render(<GuidePageScreen />);
};

describe('讲解 · 详情页', () => {
  it('第一页：页码 / 标题 / 正文 / 底部翻页都在', async () => {
    await open('basics');
    expect(txt('gd-count')).toBe('第 1 / 8 页');
    expect(txt('gd-title')).toBe('入门：动词、词干与一般现在时');
    expect(screen.getByTestId('gd-blocks')).toBeTruthy();
    expect(screen.getByTestId('gd-prev')).toBeTruthy();
    expect(screen.getByTestId('gd-next')).toBeTruthy();
  });

  it('正文真的渲染出了段落与标题（不是空壳）', async () => {
    await open('basics');
    const body = textsOf('gd-blocks');
    expect(body).toContain('三类动词与「词干 + 词尾」');
    expect(body).toContain('词干');
    // 解析后的文本不该残留 HTML 标签或未展开的宏
    expect(body).not.toContain('<h3>');
    expect(body).not.toContain('{{G:');
  });

  it('`{{G:…}}` 宏变形成内嵌变位网格（人称 + 形式）', async () => {
    await open('basics');
    const body = textsOf('gd-blocks');
    expect(body).toContain('hablo'); // 现在时 hablar 的 yo
    expect(body).toContain('nosotros'); // 六个人称代词在场
  });

  it('序号圆标与标题分家：标题里没有 ⑧', async () => {
    await open('accent');
    expect(txt('gd-title')).not.toContain('⑧');
    expect(textsOf('gd-body')).toContain('⑧');
  });

  it('翻页用 replace（不往返回栈里压层），且落到相邻页', async () => {
    await open('basics');
    await tap('gd-next');
    expect(mockReplace).toHaveBeenCalledWith('/guide/past');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('翻页一律用淡入淡出（用户 2026-10-05：改「渐变到目标页」）', async () => {
    await open('basics');
    // 页面自己带的转场就是 fade（不再区分方向）
    expect(mockSetOptions).toHaveBeenLastCalledWith({ animation: 'fade' });

    // 下一页 / 上一页 / 目录跳页都是同一条 fade，不做横向位移
    await tap('gd-next');
    expect(mockSetOptions).toHaveBeenLastCalledWith({ animation: 'fade' });

    mockSetOptions.mockClear();
    await act(async () => {
      mockParams = { slug: 'past' };
      screen.rerender(<GuidePageScreen />);
    });
    await tap('gd-prev');
    expect(mockSetOptions).toHaveBeenLastCalledWith({ animation: 'fade' });
  });

  it('目录 chips 跳页也用淡入淡出（不分前后）', async () => {
    // GUIDE 顺序：basics, past, imperative, future, subj, orth, stem, accent
    await open('stem');
    await tap('gd-chip-accent');
    expect(mockSetOptions).toHaveBeenLastCalledWith({ animation: 'fade' });

    // 跳到更前面的页：仍是 fade（不做"从左进"这类方向动画）
    mockSetOptions.mockClear();
    await act(async () => {
      mockParams = { slug: 'accent' };
      screen.rerender(<GuidePageScreen />);
    });
    await tap('gd-chip-basics');
    expect(mockSetOptions).toHaveBeenLastCalledWith({ animation: 'fade' });
  });

  it('第一页的「上一页」禁用', async () => {
    await open('basics');
    expect(screen.getByTestId('gd-prev').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('gd-next').props.accessibilityState.disabled).toBe(false);
  });

  it('最后一页的「下一页」禁用', async () => {
    await open(GUIDE[GUIDE.length - 1]!.k);
    expect(txt('gd-count')).toBe(`第 ${GUIDE.length} / ${GUIDE.length} 页`);
    expect(screen.getByTestId('gd-next').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('gd-prev').props.accessibilityState.disabled).toBe(false);
  });

  it('上一页键回到相邻页（八页顺序与 GUIDE 数组一致）', async () => {
    await open('orth');
    await tap('gd-prev');
    expect(mockReplace).toHaveBeenCalledWith('/guide/subj');
  });

  it('八页目录 chips 全在，当前页选中；点别的页 replace 过去', async () => {
    await open('stem');
    for (const g of GUIDE) expect(screen.getByTestId(`gd-chip-${g.k}`)).toBeTruthy();
    expect(screen.getByTestId('gd-chip-stem').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('gd-chip-basics').props.accessibilityState.selected).toBe(false);

    await tap('gd-chip-future');
    expect(mockReplace).toHaveBeenCalledWith('/guide/future');
  });

  it('认不出的 slug 退回第一页，不白屏', async () => {
    await open('does-not-exist');
    expect(txt('gd-count')).toBe('第 1 / 8 页');
    expect(txt('gd-title')).toBe('入门：动词、词干与一般现在时');
  });

  it('完全没带 slug 也退回第一页', async () => {
    await open();
    expect(txt('gd-count')).toBe('第 1 / 8 页');
  });

  it('有权威外链的页渲染外链卡：名字与地址都在', async () => {
    const withLinks = GUIDE.find((p) => p.lk.length > 0)!;
    expect(withLinks).toBeTruthy();
    await open(withLinks.k);
    const l = withLinks.lk[0]!;
    expect(screen.getByTestId(`gd-link-${l.u}`)).toBeTruthy();
    const text = textsOf(`gd-link-${l.u}`);
    expect(text).toContain(guideText(l.n, 'zh'));
    expect(text).toContain(l.u);
  });

  it('顶栏退键回上一屏', async () => {
    await open('orth');
    await tap('page-back');
    expect(mockBack).toHaveBeenCalled();
  });
});

/* ============================== 英文口径 ============================== */

describe('讲解 · 语言切换', () => {
  it('切到英文后详情页出英文标题与英文正文', async () => {
    await act(async () => {
      useSettingsStore.getState().setLang('en', 'manual');
    });
    await open('basics');
    expect(txt('gd-title')).toBe('Basics: verbs, stems and the present');
    const body = textsOf('gd-blocks');
    expect(body).toMatch(/present/i);
    expect(body).not.toContain('三类动词');
  });

  it('切到英文后目录页出英文短标题', async () => {
    await act(async () => {
      useSettingsStore.getState().setLang('en', 'manual');
    });
    await render(<GuideTocScreen />);
    expect(textsOf('guide-row-basics')).toContain(guideText(GUIDE[0]!.s, 'en'));
    expect(partsOf('guide-row-basics')).not.toContain('入门与一般现在时');
  });
});
