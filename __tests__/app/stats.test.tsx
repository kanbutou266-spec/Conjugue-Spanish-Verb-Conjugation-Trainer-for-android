import { act, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import StatsScreen from '@/app/stats';
import { useSettingsStore } from '@/store/settings';
import { useStatsStore } from '@/store/stats';

const { txt, textsOf } = require('./_tree');

/**
 * 学习统计与错题本（从「我的」推入）—— 对应网页 `renderStats()`。
 *
 * 排序规则在 `data/stats.ts`（已有单测），这里只验页面读得对：
 * 空态给的是不是四句"还没有…"，有数据时四段榜单是不是按 store 里的数现算，
 * 以及"数据管理"三个按钮**确实不在这一屏**（方案 §3.6 把它们挪去了设置页）。
 */

jest.setTimeout(20000);

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const asMock = (f: unknown) => f as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  asMock(useRouter).mockReturnValue({
    back: jest.fn(),
    push: jest.fn(),
    navigate: jest.fn(),
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

/** 造一份"答过几题、错了几个"的统计 */
async function seed() {
  await act(async () => {
    const st = useStatsStore.getState();
    // hablar：3 题错 3（错题率 100%）
    st.record({ inf: 'hablar', tense: 'p', person: 0, mode: 'recognize', ok: false, user: 'habla', ans: 'hablo' });
    st.record({ inf: 'hablar', tense: 'p', person: 1, mode: 'produce', ok: false, user: 'hablas', ans: 'hablas' });
    st.record({ inf: 'hablar', tense: 'pq', person: 2, mode: 'shift', ok: false, user: 'hablaba', ans: 'habló' });
    // comer：2 题错 1（错题率 50%）
    st.record({ inf: 'comer', tense: 'p', person: 0, mode: 'recognize', ok: true, user: 'como', ans: 'como' });
    st.record({ inf: 'comer', tense: 'p', person: 3, mode: 'transfer', ok: false, user: 'comes', ans: 'come' });
  });
}

describe('学习统计 · 空态', () => {
  it('四个大数字都是 0，四段榜单各给一句"还没有…"', async () => {
    await render(<StatsScreen />);
    expect(txt('st-answers')).toBe('0');
    expect(txt('st-acc')).toBe('0%');
    expect(txt('st-err')).toBe('0');
    expect(txt('st-verbs')).toBe('0');

    const body = textsOf('st-body');
    expect(body).toContain('还没有错误记录');
    expect(body).toContain('暂无数据');
    // 用户 2026-10-05 第 4 条：统计页去掉错题本 → 空态也不该再出现那句
    expect(body).not.toContain('还没有错题');
    // 榜单标题右上角的「最多 N 条」上限标注（用户要求「有个上限」）
    expect(body).toContain('最多 20 条');
  });

  it('这一屏没有"数据管理"三个按钮（按方案挪去了设置页）', async () => {
    await render(<StatsScreen />);
    expect(screen.queryByTestId('set-export')).toBeNull();
    expect(screen.queryByTestId('set-import')).toBeNull();
    expect(screen.queryByTestId('set-reset')).toBeNull();
  });
});

describe('学习统计 · 有数据', () => {
  it('四个大数字：答题 5 / 正确率 20% / 错误 4 / 动词 2', async () => {
    await seed();
    await render(<StatsScreen />);
    expect(txt('st-answers')).toBe('5');
    expect(txt('st-acc')).toBe('20%'); // 1/5
    expect(txt('st-err')).toBe('4');
    expect(txt('st-verbs')).toBe('2');
  });

  it('最容易错的动词：只有错过的上榜，出错/总次与百分比', async () => {
    await seed();
    await render(<StatsScreen />);
    expect(screen.getByTestId('st-hard-hablar')).toBeTruthy();
    expect(screen.getByTestId('st-hard-comer')).toBeTruthy();
    const talk = textsOf('st-hard-hablar');
    expect(talk).toContain('hablar');
    expect(talk).toContain('3/3');
    expect(talk).toContain('100%');
    const eat = textsOf('st-hard-comer');
    expect(eat).toContain('1/2');
    expect(eat).toContain('50%');
    // 全对的动词不会出现在榜上（这里没有这种，但榜上只应有 2 行）
    expect(screen.queryByTestId('st-hard-vivir')).toBeNull();
  });

  it('各时态错误率：只列有记录的时态，中文名 + 西语副名', async () => {
    await seed();
    await render(<StatsScreen />);
    expect(screen.getByTestId('st-tense-p')).toBeTruthy();
    expect(screen.getByTestId('st-tense-pq')).toBeTruthy();
    expect(screen.queryByTestId('st-tense-f')).toBeNull(); // 未来时没答过
    const now = textsOf('st-tense-p');
    expect(now).toContain('现在时');
    expect(now).toMatch(/presente/i);
    expect(now).toContain('3/4'); // 4 题错 3
  });

  it('各模式正确率：四种模式只列答过的，写的是"对/总 + 百分比"', async () => {
    await seed();
    await render(<StatsScreen />);
    expect(screen.getByTestId('st-mode-recognize')).toBeTruthy();
    expect(screen.getByTestId('st-mode-produce')).toBeTruthy();
    expect(screen.getByTestId('st-mode-shift')).toBeTruthy();
    expect(screen.getByTestId('st-mode-transfer')).toBeTruthy();
    const rec = textsOf('st-mode-recognize');
    expect(rec).toContain('辨认模式');
    expect(rec).toContain('1/2');
    expect(rec).toContain('50%');
  });

  /*
   * 回归：用户 2026-10-05 第 4 条 ——「不用显示错题本」。
   * 错题本整段已删（底层 `stats.wrong` 仍照记，导出 JSON 形状不变），
   * 所以这里同时断「界面没了」。误删数据的话上面「四段榜单」那几条会先炸。
   */
  it('错题本整段已删（界面不再列出任何错题条目）', async () => {
    await seed();
    await render(<StatsScreen />);
    expect(screen.queryByTestId('st-wrong-0')).toBeNull();
    expect(textsOf('st-body')).not.toContain('错题本');
  });

  it('榜单标题带「最多 N 条」上限标注（最容易错的动词 = 20）', async () => {
    await seed();
    await render(<StatsScreen />);
    expect(textsOf('st-body')).toContain('最多 20 条');
  });
});
