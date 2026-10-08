import { act, render } from '@testing-library/react-native';
import { Text, View, useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settings';
import { dark, font, light, mood, moodDark, useIsDark, usePalette, useTheme } from '@/ui/theme';
import type { GroupKey } from '@/data/types';

/**
 * 深色模式渲染层（用户 2026-10-05）。
 *
 * 令牌层（两套颜色本身、对比度、清洗）在 `theme.test.ts` 里覆盖；
 * 这里只回答一个问题：**设置里改档位 / 系统切深浅，组件真的换色吗？**
 * 顺带把 `useTheme()` 的契约钉住 —— 组件里必须用它，不能用静态的 `theme`。
 */

/** 探针：把当前主题的若干关键值渲染成文本，方便断言 */
function Probe() {
  const theme = useTheme();
  return (
    <View testID="probe">
      <Text testID="p-bg">{theme.color.bg}</Text>
      <Text testID="p-ink">{theme.color.ink}</Text>
      <Text testID="p-ind">{theme.mood.ind.main}</Text>
      <Text testID="p-press">{theme.press.ghost}</Text>
      <Text testID="p-shadow">{theme.cardShadow.shadowColor}</Text>
      <Text testID="p-isDark">{String(useIsDark())}</Text>
    </View>
  );
}

function PaletteProbe() {
  return <Text testID="p-palette">{usePalette().bg}</Text>;
}

beforeEach(() => {
  useSettingsStore.getState().reset();
});

/** 把系统深浅色改成指定值（模拟手机切到深色） */
function setSystemScheme(scheme: 'light' | 'dark') {
  (useColorScheme as jest.Mock).mockReturnValue(scheme);
}

describe('深色模式 · useTheme 立刻跟着档位走', () => {
  it('themeMode=dark → 拿到的就是深色那套', async () => {
    await act(async () => {
      useSettingsStore.getState().setThemeMode('dark');
    });
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('p-bg').props.children).toBe(dark.bg);
    expect(getByTestId('p-ink').props.children).toBe(dark.ink);
    expect(getByTestId('p-ind').props.children).toBe(moodDark.ind.main);
    expect(getByTestId('p-press').props.children).not.toBe('#eceff4');
    expect(getByTestId('p-isDark').props.children).toBe('true');
  });

  it('themeMode=light → 拿到的就是亮色那套', async () => {
    await act(async () => {
      useSettingsStore.getState().setThemeMode('light');
    });
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('p-bg').props.children).toBe(light.bg);
    expect(getByTestId('p-ind').props.children).toBe(mood.ind.main);
    expect(getByTestId('p-isDark').props.children).toBe('false');
  });

  it('改档位当场重渲染，不需要重新挂载', async () => {
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('p-bg').props.children).toBe(light.bg);

    await act(async () => {
      useSettingsStore.getState().setThemeMode('dark');
    });
    expect(getByTestId('p-bg').props.children).toBe(dark.bg);

    await act(async () => {
      useSettingsStore.getState().setThemeMode('light');
    });
    expect(getByTestId('p-bg').props.children).toBe(light.bg);
  });

  it('usePalette() 与 useTheme().color 是同一份', async () => {
    await act(async () => {
      useSettingsStore.getState().setThemeMode('dark');
    });
    const { getByTestId } = await render(<PaletteProbe />);
    expect(getByTestId('p-palette').props.children).toBe(dark.bg);
  });
});

describe('深色模式 · 默认档跟随系统深色开关', () => {
  it('system + 系统深色 → 深色', async () => {
    setSystemScheme('dark');
    const { getByTestId } = await render(<Probe />);
    expect(useSettingsStore.getState().themeMode).toBe('system');
    expect(getByTestId('p-isDark').props.children).toBe('true');
    expect(getByTestId('p-bg').props.children).toBe(dark.bg);
  });

  it('system + 系统浅色 → 浅色', async () => {
    setSystemScheme('light');
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('p-isDark').props.children).toBe('false');
    expect(getByTestId('p-bg').props.children).toBe(light.bg);
  });

  it('系统切深浅，跟随档当场跟着变（不重新挂载）', async () => {
    setSystemScheme('light');
    const { getByTestId, rerender } = await render(<Probe />);
    expect(getByTestId('p-bg').props.children).toBe(light.bg);

    // 系统切到深色 → 重渲染（真实设备上由 useColorScheme 触发）
    setSystemScheme('dark');
    await act(async () => {
      rerender(<Probe />);
    });
    expect(getByTestId('p-bg').props.children).toBe(dark.bg);
  });

  it('手动档位优先于系统：设成 light 时系统再黑也保持亮色', async () => {
    setSystemScheme('dark');
    await act(async () => {
      useSettingsStore.getState().setThemeMode('light');
    });
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('p-isDark').props.children).toBe('false');
    expect(getByTestId('p-bg').props.children).toBe(light.bg);
  });

  it('手动档位优先于系统：设成 dark 时系统是浅色也保持深色', async () => {
    setSystemScheme('light');
    await act(async () => {
      useSettingsStore.getState().setThemeMode('dark');
    });
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('p-isDark').props.children).toBe('true');
  });
});

describe('深色模式 · 令牌形状', () => {
  it('useTheme() 返回的对象与旧 theme 常量同形（可以直接换用）', async () => {
    await act(async () => {
      useSettingsStore.getState().setThemeMode('dark');
    });
    let seen: ReturnType<typeof useTheme> | null = null;
    function Grab() {
      seen = useTheme();
      return null;
    }
    await render(<Grab />);
    const t = seen as unknown as ReturnType<typeof useTheme>;
    expect(Object.keys(t).sort()).toEqual(
      ['cardShadow', 'color', 'font', 'mood', 'press', 'radius', 'space'].sort()
    );
    // 非颜色令牌（字号 / 圆角 / 间距）明暗共用同一份
    expect(t.font).toBe(font);
    expect(t.space(3)).toBe(12);
    expect(t.radius.lg).toBe(14);
  });

  it('四个语式在深色下都能取到', async () => {
    await act(async () => {
      useSettingsStore.getState().setThemeMode('dark');
    });
    let seen: ReturnType<typeof useTheme> | null = null;
    function Grab() {
      seen = useTheme();
      return null;
    }
    await render(<Grab />);
    const t = seen as unknown as ReturnType<typeof useTheme>;
    (['ind', 'cond', 'sub', 'imp'] as GroupKey[]).forEach((k) => {
      expect(t.mood[k].main).toBe(moodDark[k].main);
    });
  });
});
