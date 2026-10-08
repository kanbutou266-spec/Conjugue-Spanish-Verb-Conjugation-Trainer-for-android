import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';

import SettingsScreen from '@/app/settings';
import { sysLangRef } from '@/i18n';
import { useSettingsStore } from '@/store/settings';
import { useStatsStore } from '@/store/stats';

const { txt, textsOf } = require('./_tree');

/**
 * 全局设置（从「我的」推入）—— 对应网页的齿轮抽屉 `#st`。
 *
 * 四段：语言 / 界面 / 出题 / 数据。这里重点验三件事：
 *   ① 「跟随系统」是总闸：开着的时候语言分段控件点不动（网页同语义）；
 *   ② 四个开关直连 settings store，切了立刻落盘（zustand persist）；
 *   ③ 导出的 JSON 与网页**同形状**（`{stats, settings}`），导入能吃网页的存档 ——
 *      这是"两版数据互通"的契约，坏了就等于用户换设备丢数据。
 *
 * 文件系统 / 分享 / 选文件三个原生模块全部替换成 jest.fn，只验调用参数。
 */

jest.setTimeout(20000);

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () => '{}'),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

const asMock = (f: unknown) => f as jest.Mock;

const tap = (testID: string) =>
  act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });

/** 拨动设置行的开关（Switch 的 onValueChange 在宿主节点上，用 fireEvent 让 RNTL 往上找） */
const flip = (testID: string, v: boolean) =>
  act(async () => {
    await fireEvent(screen.getByTestId(testID), 'valueChange', v);
  });

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  asMock(useRouter).mockReturnValue({
    back: jest.fn(),
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  });
  asMock(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: true, assets: [] } as never);
  asMock(Sharing.isAvailableAsync).mockResolvedValue(true);
  await act(async () => {
    // 「跟随系统」模式下语言由 `sysLangRef` 决定（jest 里 `getLocales()` 不可靠），
    // 显式钉成中文，否则断言中文文案会随机挂。
    sysLangRef.value = 'zh';
    const st = useSettingsStore.getState();
    st.reset(); // → langMode: 'system'（这正是 App 的出厂默认）
    useStatsStore.getState().clear();
  });
});

describe('设置 · 语言段', () => {
  it('「跟随系统」默认开，语言控件整行变淡（网页同语义）', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByTestId('set-follow-sw').props.value).toBe(true);
    expect(useSettingsStore.getState().langMode).toBe('system');
    // langRow 加了 langOff（opacity 0.45）
    expect(JSON.stringify(screen.getByTestId('set-lang').parent)).toContain('0.45');
  });

  it('跟随系统开着时点「English」不生效（语言仍是中文）', async () => {
    await render(<SettingsScreen />);
    await tap('set-lang-en');
    expect(useSettingsStore.getState().lang).toBe('zh');
    expect(useSettingsStore.getState().langMode).toBe('system');
    expect(useSettingsStore.getState().showZh).toBe(true); // 分支里直接 return，什么都没改
  });

  it('关掉「跟随系统」后可以手动切语言，界面立刻变英文', async () => {
    await render(<SettingsScreen />);
    await flip('set-follow-sw', false);
    expect(useSettingsStore.getState().langMode).toBe('manual');
    expect(screen.getByTestId('set-lang').parent).toBeTruthy();

    await tap('set-lang-en');
    expect(useSettingsStore.getState().lang).toBe('en');
    expect(useSettingsStore.getState().langMode).toBe('manual');
    // 界面真的换了语言：标题变成英文（「界面」段的段名 = Display）
    expect(textsOf('set-body')).toContain('Display');
  });
});

describe('设置 · 深色模式（用户 2026-10-05）', () => {
  it('默认跟随系统，且此时深浅色二选一不可点', async () => {
    await render(<SettingsScreen />);
    expect(useSettingsStore.getState().themeMode).toBe('system');
    expect(screen.getByTestId('set-dark-follow-sw').props.value).toBe(true);
  });

  it('关掉「跟随系统深色模式」后可手动选深 / 浅，写回 store', async () => {
    await render(<SettingsScreen />);
    await flip('set-dark-follow-sw', false);
    // 关掉跟随的瞬间落到"当前实际那一档"（测试环境系统是浅色 → light）
    expect(useSettingsStore.getState().themeMode).toBe('light');

    await tap('set-dark-dark');
    expect(useSettingsStore.getState().themeMode).toBe('dark');

    await tap('set-dark-light');
    expect(useSettingsStore.getState().themeMode).toBe('light');
  });

  it('再打开「跟随系统」即回到 system 档', async () => {
    await render(<SettingsScreen />);
    await flip('set-dark-follow-sw', false);
    await tap('set-dark-dark');
    expect(useSettingsStore.getState().themeMode).toBe('dark');

    await flip('set-dark-follow-sw', true);
    expect(useSettingsStore.getState().themeMode).toBe('system');
  });

  it('深色模式设置归在「界面」段（与语言同一张卡）', async () => {
    await render(<SettingsScreen />);
    const body = textsOf('set-body');
    for (const s of ['界面', '跟随系统语言', '跟随系统深色模式', '深浅色', '出题', '数据']) {
      expect(body).toContain(s);
    }
  });
});

describe('设置 · 出题段', () => {
  it('四个开关的值来自 store，打开就写回 store', async () => {
    await render(<SettingsScreen />);
    const s = () => useSettingsStore.getState();

    for (const [id, key] of [
      ['set-showzh-sw', 'showZh'],
      ['set-hideinf-sw', 'hideInf'],
      ['set-vosotros-sw', 'vosotros'],
      ['set-strict-sw', 'strictAccent'],
    ] as const) {
      const before = s()[key];
      expect(screen.getByTestId(id).props.value).toBe(before);
      await flip(id, !before);
      expect(s()[key]).toBe(!before);
      await flip(id, before); // 拨回来，免得影响同一用例里的下一项
    }
  });

  it('段名是「出题」（用户 2026-10-05 由「界面与出题」改名），四个开关在里面', async () => {
    await render(<SettingsScreen />);
    const body = textsOf('set-body');
    expect(body).toContain('出题');
    expect(body).not.toContain('界面与出题'); // 旧段名已不复存在
    // 四行的标题都还在（顺序即界面 → 出题）
    for (const s of ['显示中文释义', '隐藏动词原形', '含 vosotros', '严格要求重音']) {
      expect(body).toContain(s);
    }
  });

  /*
   * 回归：用户 2026-10-05 第 5 条 ——「设置界面的『这一项是全局项……』不需要」。
   * 顶部那句 setHint 提示已删除，这里同时断「旧的没了」和「该在的还在」。
   * 2026-10-05（三）：顶层标题由「语言 / 界面与出题 / 数据」改为「界面 / 出题 / 数据」。
   */
  it('顶部不再有「全局项说明」，但顶层标题齐全', async () => {
    await render(<SettingsScreen />);
    const body = textsOf('set-body');
    expect(body).not.toContain('这一栏是全局项');
    for (const s of ['界面', '出题', '数据']) {
      expect(body).toContain(s);
    }
  });
});

describe('设置 · 数据段', () => {
  it('导出：写出 {stats, settings} 同形状 JSON，再交给系统分享', async () => {
    await act(async () => {
      useStatsStore.getState().record({
        inf: 'hablar',
        tense: 'p',
        person: 0,
        mode: 'recognize',
        ok: false,
        user: 'habla',
        ans: 'hablo',
      });
    });
    await render(<SettingsScreen />);
    await tap('set-export');

    expect(asMock(FS.writeAsStringAsync)).toHaveBeenCalledTimes(1);
    const [uri, json] = asMock(FS.writeAsStringAsync).mock.calls[0] as [string, string];
    expect(uri).toBe('file:///cache/conjugue-backup.json');

    const o = JSON.parse(json) as { stats: Record<string, unknown>; settings: Record<string, unknown> };
    expect(Object.keys(o).sort()).toEqual(['settings', 'stats']);
    // stats 逐字段等于 store 的持久化切片
    expect(Object.keys(o.stats).sort()).toEqual(['modes', 'tenses', 'total', 'verbs', 'wrong']);
    expect(o.stats.total).toEqual({ att: 1, err: 1 });
    // settings 里不该出现方法函数
    expect(Object.keys(o.settings)).toContain('lang');
    expect(typeof o.settings.setLang).toBe('undefined');

    expect(asMock(Sharing.shareAsync)).toHaveBeenCalledWith(
      uri,
      expect.objectContaining({ mimeType: 'application/json' })
    );
  });

  it('导入：吃一份网页导出的存档，stats 与 settings 一起生效', async () => {
    const dump = {
      stats: {
        verbs: { comer: { att: 4, err: 2, byT: { p: { att: 4, err: 2 } }, last: 1 } },
        tenses: { p: { att: 4, err: 2 } },
        modes: { produce: { att: 4, err: 2 } },
        total: { att: 4, err: 2 },
        wrong: [],
      },
      settings: { lang: 'en', langMode: 'manual', showZh: false, vosotros: true },
    };
    asMock(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///dl/backup.json', name: 'backup.json' }],
    } as never);
    asMock(FS.readAsStringAsync).mockResolvedValue(JSON.stringify(dump));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<SettingsScreen />);
    await tap('set-import');

    expect(asMock(FS.readAsStringAsync)).toHaveBeenCalledWith('file:///dl/backup.json');
    expect(useStatsStore.getState().total).toEqual({ att: 4, err: 2 });
    expect(useStatsStore.getState().verbs.comer?.err).toBe(2);
    expect(useSettingsStore.getState().lang).toBe('en');
    expect(useSettingsStore.getState().vosotros).toBe(true);
    expect(alert).toHaveBeenCalled();
  });

  it('导入：用户取消选文件就什么都不做', async () => {
    await render(<SettingsScreen />);
    await tap('set-import');
    expect(asMock(FS.readAsStringAsync)).not.toHaveBeenCalled();
    expect(useStatsStore.getState().total).toEqual({ att: 0, err: 0 });
  });

  it('导入：坏 JSON 给出错提示，不崩', async () => {
    asMock(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///dl/bad.json', name: 'bad.json' }],
    } as never);
    asMock(FS.readAsStringAsync).mockResolvedValue('{ not json');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<SettingsScreen />);
    await tap('set-import');
    expect(alert).toHaveBeenCalled();
    expect(useStatsStore.getState().total).toEqual({ att: 0, err: 0 });
  });

  it('清空统计：先弹确认，点了确认才真的清', async () => {
    await act(async () => {
      useStatsStore.getState().record({
        inf: 'vivir',
        tense: 'p',
        person: 0,
        mode: 'recognize',
        ok: true,
        user: 'vivo',
        ans: 'vivo',
      });
    });
    const calls: { text?: string; onPress?: () => void }[][] = [];
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((...args) => {
      calls.push(args[2] as never);
    });

    await render(<SettingsScreen />);
    await tap('set-reset');
    expect(alert).toHaveBeenCalled();
    expect(useStatsStore.getState().total.att).toBe(1); // 只弹窗，还没清

    const btns = calls[0]!;
    await act(async () => {
      btns[btns.length - 1]!.onPress?.();
    });
    expect(useStatsStore.getState().total).toEqual({ att: 0, err: 0 });
  });
});

describe('设置 · 页脚', () => {
  it('版本号与「我的」页一致，退键回上一屏', async () => {
    await render(<SettingsScreen />);
    expect(txt('set-ver')).toBe('版本 2.0.0');
    await tap('page-back');
  });
});
