import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { useSettingsStore } from '@/store/settings';

import ConjLookupScreen from '@/app/conj-lookup';

jest.setTimeout(20000);

/** 推入式变位查询页（/conj-lookup）—— 从作答页点「变位表」进来 */
const mockBack = jest.fn();
const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const asMock = (f: unknown) => f as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  asMock(useRouter).mockReturnValue({
    back: mockBack,
    navigate: mockNavigate,
    canGoBack: mockCanGoBack,
  });
});

async function fresh() {
  await act(async () => {
    const st = useSettingsStore.getState();
    st.reset();
    st.setLang('zh', 'manual');
  });
  return render(<ConjLookupScreen />);
}

describe('推入式变位查询页', () => {
  it('顶栏左侧有退键（作答页入口特征）', async () => {
    await fresh();
    expect(screen.getByTestId('table-back')).toBeTruthy();
  });

  it('点退键：栈能退就直接 router.back 退回 practice；不能退才 navigate 兜底', async () => {
    await fresh();
    fireEvent.press(screen.getByTestId('table-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('栈不能退时（直接挂载）退键 navigate 到 /practice', async () => {
    mockCanGoBack.mockReturnValueOnce(false);
    await fresh();
    fireEvent.press(screen.getByTestId('table-back'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/practice');
  });

  it('带 inf/t/p 参数时仍高亮对应时态块 + 人称格', async () => {
    // 动态覆盖 useLocalSearchParams 的返回值
    (require('expo-router').useLocalSearchParams as jest.Mock).mockReturnValueOnce({
      inf: 'hablar',
      t: 'p',
      p: '1',
    });
    await fresh();
    expect(screen.getByTestId('dwc-p-p1')).toBeTruthy();
    const pair = screen.getByTestId('dwp-p-pp');
    const StyleSheet = require('react-native').StyleSheet;
    const flat = (s: unknown) => StyleSheet.flatten(s) || {};
    // 高亮那一对卡的底色跟着**该时态的语式**走（网页 `.dwb.hi` 用 --gs）
    const themeMod = require('@/ui/theme').theme;
    const { T } = require('@/data/tenses');
    expect(flat((pair as unknown as { props: { style: unknown } }).props.style).backgroundColor).toBe(
      themeMod.mood[T.p.g].soft
    );
  });
});