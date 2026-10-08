import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';

import AboutScreen from '@/app/about';
import MeScreen from '@/app/(tabs)/me';
import { APP_VER, BRAND } from '@/config/brand';
import { useSettingsStore } from '@/store/settings';
import { useStatsStore } from '@/store/stats';

const { txt, textsOf, partsOf } = require('./_tree');

/**
 * 「我的」入口页（底栏第 4 个 tab）+ 关于页（推入式）。
 *
 * 这一栏是 RN 版新增的一层：网页版把"统计"做成一个 tab、把"设置"挂在首页齿轮上，
 * 手机上底栏只放四个，于是统计 / 设置 / 关于都收进「我的」。所以这里验的是
 * **三个入口有没有正确接上**，以及用户卡片上的数字是不是从统计 store 现算的
 * （"不新增持久化字段"是本项目的红线之一）。
 */

jest.setTimeout(20000);

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const asMock = (f: unknown) => f as jest.Mock;

const tap = (testID: string) =>
  act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });

beforeEach(async () => {
  jest.clearAllMocks();
  asMock(useRouter).mockReturnValue({
    back: mockBack,
    push: mockPush,
    navigate: mockNavigate,
    replace: jest.fn(),
    canGoBack: () => true,
  });
  await act(async () => {
    const st = useSettingsStore.getState();
    st.reset();
    st.setLang('zh', 'manual');
    useStatsStore.getState().clear();
  });
});

/* =========================== 我的（入口页） =========================== */

describe('我的 · 入口页', () => {
  it('标题 + 三个入口 + 版本号都在', async () => {
    await render(<MeScreen />);
    expect(txt('me-title')).toBe('我的');
    expect(screen.getByTestId('me-stats')).toBeTruthy();
    expect(screen.getByTestId('me-settings')).toBeTruthy();
    expect(screen.getByTestId('me-about')).toBeTruthy();
    expect(txt('me-ver')).toBe(`版本 ${APP_VER}`);
  });

  it('三个入口只有名字，没有一级标题、也没有副标题（用户 2026-10-05）', async () => {
    await render(<MeScreen />);
    // 名字就是这三个，别的什么都不写
    expect(partsOf('me-stats')).toBe('学习统计');
    expect(partsOf('me-settings')).toBe('设置');
    expect(partsOf('me-about')).toBe('关于');
    // 「学习 / 通用 / 其它」三个分区标题已删；每行的简介文案也一并消失
    const all = JSON.stringify(screen.toJSON());
    for (const gone of ['学习统计与错题本', '总体正确率', '语言、界面、出题口径', '关于与许可',
      '版本、仓库、数据来源']) {
      expect(all).not.toContain(gone);
    }
    expect(screen.queryByText('通用')).toBeNull();
    expect(screen.queryByText('其它')).toBeNull();
  });

  it('三个入口分别推入 /stats、/settings、/about', async () => {
    await render(<MeScreen />);
    await tap('me-stats');
    await tap('me-settings');
    await tap('me-about');
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual(['/stats', '/settings', '/about']);
  });

  it('没答过题：数字全 0、正确率显示破折号、给出空态提示', async () => {
    await render(<MeScreen />);
    expect(txt('me-answers')).toBe('0');
    expect(txt('me-acc')).toBe('—');
    expect(txt('me-verbs')).toBe('0');
    expect(textsOf('me-card')).toContain('还没有练习记录');
  });

  it('答过题：三个数字现算自统计 store（不新增持久化字段）', async () => {
    await act(async () => {
      const st = useStatsStore.getState();
      st.record({ inf: 'hablar', tense: 'p', person: 0, mode: 'recognize', ok: true, user: 'hablo', ans: 'hablo' });
      st.record({ inf: 'comer', tense: 'p', person: 1, mode: 'recognize', ok: false, user: 'comes', ans: 'comes' });
      st.record({ inf: 'vivir', tense: 'p', person: 2, mode: 'recognize', ok: true, user: 'vive', ans: 'vive' });
    });
    await render(<MeScreen />);
    expect(txt('me-answers')).toBe('3');
    expect(txt('me-verbs')).toBe('3');
    expect(txt('me-acc')).toBe('67%'); // 2/3 四舍五入（有数据时带百分号，"没答过"才是破折号）
    expect(textsOf('me-card')).not.toContain('还没有练习记录');
  });

  it('英文界面下标题与版本号走英文文案', async () => {
    await act(async () => {
      useSettingsStore.getState().setLang('en', 'manual');
    });
    await render(<MeScreen />);
    expect(txt('me-title')).toBe('Me');
  });
});

/* ============================== 关于页 ============================== */

describe('我的 · 关于页', () => {
  it('品牌卡：应用名 / 一句话 / 版本号', async () => {
    await render(<AboutScreen />);
    expect(txt('ab-title')).toBe('西语动词变位练习器');
    expect(txt('ab-ver')).toBe(`版本 ${APP_VER}`);
    expect(textsOf('ab-brand')).toContain('离线安卓应用');
  });

  it('开源段：仓库行与 Issue 行都在，作者名来自 brand 常量', async () => {
    await render(<AboutScreen />);
    expect(textsOf('ab-repo')).toContain('GitHub 项目仓库');
    expect(textsOf('ab-issues')).toContain('报告问题');
    expect(textsOf('ab-author')).toContain(BRAND.author);
  });

  it('点仓库行用 Linking 打开 BRAND.repo（不是网页那套 target=_blank）', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<AboutScreen />);
    await tap('ab-repo');
    expect(spy).toHaveBeenCalledWith(BRAND.repo);
    await tap('ab-issues');
    expect(spy).toHaveBeenCalledWith(BRAND.issues);
    await tap('ab-author');
    expect(spy).toHaveBeenCalledWith(BRAND.authorUrl);
    spy.mockRestore();
  });

  it('赞助段：赞赏码图片（网页的 img alt 在这边是 accessibilityLabel）+ 说明', async () => {
    await render(<AboutScreen />);
    const qr = screen.getByTestId('ab-qr');
    expect(qr).toBeTruthy();
    expect(qr.props.accessibilityLabel).toBe('赞赏码');
    expect(textsOf('ab-donate')).toContain('完全自愿');
  });

  it('声明段三行都是纯信息行（不给点、没有 ↗）', async () => {
    await render(<AboutScreen />);
    for (const id of ['ab-ai', 'ab-src', 'ab-priv']) {
      const row = screen.getByTestId(id);
      expect(row.props.accessibilityRole).toBeUndefined();
      expect(JSON.stringify(row)).not.toContain('arrow-up-right');
    }
    expect(textsOf('ab-priv')).toContain('只存在这台设备上');
  });

  it('外链行右侧画 ↗（arrow-up-right）', async () => {
    await render(<AboutScreen />);
    expect(JSON.stringify(screen.getByTestId('ab-repo'))).toContain('arrow-up-right');
  });

  it('退键回上一屏', async () => {
    await render(<AboutScreen />);
    await tap('page-back');
    expect(mockBack).toHaveBeenCalled();
  });
});
