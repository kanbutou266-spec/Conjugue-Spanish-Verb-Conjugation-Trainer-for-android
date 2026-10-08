import { DEFAULT_ACTIVE_KEY, initialSettings } from '@/data/settings';
import { ALL_KEYS, PRESETS, defaultCustom } from '@/data/levels';
import { ALL_TENSE_KEYS, LEVELS } from '@/data/tenses';
import { LEVELS_IN_DATA } from '@/data/verbs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { cfgOfKey, resetSlotAndApply, saveSlotAndApply, selectKey } from '@/store/actions';
import { mergeCustomState, partializeCustom, useCustomStore } from '@/store/custom';
import { STORAGE_KEYS, clearAllStores } from '@/store/persist';
import { mergeSettingsState, useSettingsStore } from '@/store/settings';

import type { InputMode } from '@/data/types';
import type { CustomState } from '@/store/custom';
import type { SettingsState } from '@/store/settings';

const S = () => useSettingsStore.getState();
const C = () => useCustomStore.getState();

beforeEach(() => {
  S().reset();
  C().resetAll();
});

describe('settings store · 默认状态', () => {
  it('首屏 = 零基础档（A1 · 现在时 · 选择题）', () => {
    expect(S().activeKey).toBe(DEFAULT_ACTIVE_KEY);
    expect(S().activeKey).toBe('starter');
    expect(S().levels).toEqual(['A1']);
    expect(S().tenses).toEqual(['p']);
    expect(S().inputMode).toBe('choice');
  });

  it('全局开关是默认值', () => {
    expect(S().modes).toEqual(['produce']);
    expect(S().hideInf).toBe(false);
    expect(S().vosotros).toBe(true);
    expect(S().showZh).toBe(true);
    expect(S().strictAccent).toBe(true);
    expect(S().tagFilter).toBe('');
    expect(S().lang).toBe('zh');
    expect(S().langMode).toBe('system');
  });
});

describe('settings store · 练习模式是单选', () => {
  it('setMode 只留一个', () => {
    S().setMode('recognize');
    expect(S().modes).toEqual(['recognize']);
    S().setMode('transfer');
    expect(S().modes).toEqual(['transfer']);
    expect(S().modes).toHaveLength(1);
  });
});

describe('settings store · 等级', () => {
  it('加等级时按 LEVELS 顺序插入（不是追加到末尾）', () => {
    expect(S().levels).toEqual(['A1']);
    S().toggleLevel('B1');
    expect(S().levels).toEqual(['A1', 'B1']);
    S().toggleLevel('A2');
    expect(S().levels).toEqual(['A1', 'A2', 'B1']);
  });

  it('取消等级', () => {
    S().setTenses(ALL_TENSE_KEYS);
    S().toggleLevel('A1'); // 目前只有 A1 → 最后一个，忽略
    expect(S().levels).toEqual(['A1']);
    S().toggleLevel('B2');
    S().toggleLevel('A1');
    expect(S().levels).toEqual(['B2']);
  });

  it('**至少保留 1 个**：点掉最后一个会被忽略', () => {
    S().toggleLevel('A1');
    expect(S().levels).toEqual(['A1']);
    // 各种手法都试一遍，仍然是 1 个
    for (let i = 0; i < 5; i++) S().toggleLevel('A1');
    expect(S().levels).toEqual(['A1']);
    expect(S().levels.length).toBeGreaterThanOrEqual(1);
  });

  it('新增的等级在词表里都存在', () => {
    S().toggleLevel('C2');
    expect(S().levels).toEqual(['A1', 'C2']);
    S().levels.forEach((lv) => expect(LEVELS_IN_DATA).toContain(lv));
    expect(LEVELS).toContain('C2');
  });
});

describe('settings store · 标签是单选', () => {
  it('点未选中的 → 选中；再点同一个 → 回「全部」', () => {
    S().setTag('不规则');
    expect(S().tagFilter).toBe('不规则');
    S().setTag('不规则');
    expect(S().tagFilter).toBe('');
  });

  it('点另一个标签会直接换过去（不会变成两个）', () => {
    S().setTag('不规则');
    S().setTag('高频');
    expect(S().tagFilter).toBe('高频');
  });
});

describe('settings store · 时态', () => {
  it('toggle 后自动按 TENSES 顺序重排', () => {
    expect(S().tenses).toEqual(['p']); // starter 档
    S().clearTenses();
    S().toggleTense('sp');
    S().toggleTense('p');
    expect(S().tenses).toEqual(['p', 'sp']); // 而不是 ['sp','p']
  });

  it('allTenses / clearTenses', () => {
    S().allTenses();
    expect(S().tenses).toEqual(ALL_TENSE_KEYS);
    S().clearTenses();
    expect(S().tenses).toEqual([]);
  });

  it('setTenses 过滤非法键', () => {
    S().setTenses(['zzz' as never, 'pr', 'p']);
    expect(S().tenses).toEqual(['p', 'pr']);
  });
});

describe('settings store · 开关与语言', () => {
  it('setFlag 四个全局项', () => {
    S().setFlag('hideInf', true);
    S().setFlag('vosotros', false);
    S().setFlag('showZh', false);
    S().setFlag('strictAccent', false);
    expect(S().hideInf).toBe(true);
    expect(S().vosotros).toBe(false);
    expect(S().showZh).toBe(false);
    expect(S().strictAccent).toBe(false);
  });

  it('setLang 可选带 langMode', () => {
    S().setLang('en', 'manual');
    expect(S().lang).toBe('en');
    expect(S().langMode).toBe('manual');
    S().setLang('zh');
    expect(S().lang).toBe('zh');
    expect(S().langMode).toBe('manual'); // 不带第二个参数就不动它
  });
});

describe('store/actions · selectKey', () => {
  it('选中预设 → 载入它的配置 + 记下 activeKey', () => {
    expect(selectKey('exam')).toBe(true);
    expect(S().activeKey).toBe('exam');
    expect(S().levels).toEqual(PRESETS[3].cfg.levels);
    expect(S().tenses).toEqual(PRESETS[3].cfg.tenses);
    expect(S().inputMode).toBe('type');
  });

  it('**切档不动练习模式与全局开关**（红线）', () => {
    S().setMode('recognize');
    S().setFlag('hideInf', true);
    S().setFlag('strictAccent', false);
    S().setLang('en', 'manual');

    selectKey('verbs');
    expect(S().modes).toEqual(['recognize']);
    expect(S().hideInf).toBe(true);
    expect(S().strictAccent).toBe(false);
    expect(S().lang).toBe('en');
    expect(S().langMode).toBe('manual');
  });

  it('选中自定义槽 → 载入槽里的配置（首次是默认配方 A2 三时态）', () => {
    expect(selectKey('custom2')).toBe(true);
    expect(S().activeKey).toBe('custom2');
    expect(S().levels).toEqual(['A2']);
    expect(S().tenses).toEqual(['p', 'pr', 'i']);
    expect(S().inputMode).toBe('type');
  });

  it('未知 key 返回 false，且什么都不改', () => {
    S().setMode('shift');
    const before = { ...S() };
    expect(selectKey('nope')).toBe(false);
    expect(S().activeKey).toBe(before.activeKey);
    expect(S().modes).toEqual(['shift']);
  });

  it('六个档位全部可选中', () => {
    ALL_KEYS.forEach((k) => {
      expect(selectKey(k)).toBe(true);
      expect(S().activeKey).toBe(k);
    });
  });

  it('cfgOfKey：预设读表，自定义读槽，未知为 null', () => {
    expect(cfgOfKey('starter')).toEqual(PRESETS[0].cfg);
    expect(cfgOfKey('custom1')).toEqual(defaultCustom());
    expect(cfgOfKey('nope')).toBeNull();
  });
});

describe('custom store · 两个槽', () => {
  it('槽永远可用：初始化就是默认配方', () => {
    expect(Object.keys(C().slots).sort()).toEqual(['custom1', 'custom2']);
    expect(C().slots.custom1).toEqual(defaultCustom());
    expect(C().slots.custom2).toEqual(defaultCustom());
  });

  it('cfgOf 越界返回 null', () => {
    expect(C().cfgOf('custom1')).toEqual(defaultCustom());
    expect(C().cfgOf('starter')).toBeNull();
    expect(C().cfgOf('nope')).toBeNull();
  });

  it('save 写入并按规则归一（非法时态被丢掉、顺序重排）', () => {
    C().save('custom1', {
      levels: ['B2', 'A1'],
      tenses: ['c', 'p', 'zzz' as never],
      tagFilter: '不规则',
      inputMode: 'choice',
    });
    expect(C().slots.custom1).toEqual({
      levels: ['A1', 'B2'], // 按 LEVELS 顺序
      tenses: ['p', 'c'], // 按 TENSES 顺序，zzz 丢掉
      tagFilter: '不规则',
      inputMode: 'choice',
    });
  });

  it('save 越界 key 被忽略', () => {
    C().save('nope', defaultCustom());
    expect(Object.keys(C().slots).sort()).toEqual(['custom1', 'custom2']);
  });

  it('reset / resetAll 回到默认配方', () => {
    C().save('custom1', { levels: ['C1'], tenses: ['ia'], tagFilter: '', inputMode: 'type' });
    expect(C().slots.custom1.levels).toEqual(['C1']);
    C().reset('custom1');
    expect(C().slots.custom1).toEqual(defaultCustom());

    C().save('custom1', { levels: ['C1'], tenses: ['ia'], tagFilter: '', inputMode: 'type' });
    C().save('custom2', { levels: ['C2'], tenses: ['in'], tagFilter: '', inputMode: 'type' });
    C().resetAll();
    expect(C().slots.custom1).toEqual(defaultCustom());
    expect(C().slots.custom2).toEqual(defaultCustom());
  });

  it('两个槽互不影响', () => {
    C().save('custom1', { levels: ['C1'], tenses: ['ia'], tagFilter: '', inputMode: 'choice' });
    expect(C().slots.custom2).toEqual(defaultCustom());
  });
});

describe('store/actions · 保存并应用（设置页的「保存」）', () => {
  it('写槽 → 载入设置 → 选中该槽', () => {
    expect(saveSlotAndApply('custom1', {
      levels: ['B1', 'B2'],
      tenses: ['p', 'pr', 'i', 'f'],
      tagFilter: '',
      inputMode: 'type',
    })).toBe(true);

    expect(C().slots.custom1.levels).toEqual(['B1', 'B2']);
    expect(S().activeKey).toBe('custom1');
    expect(S().levels).toEqual(['B1', 'B2']);
    expect(S().tenses).toEqual(['p', 'pr', 'i', 'f']);
  });

  it('预设 key 不能当自定义槽保存', () => {
    expect(saveSlotAndApply('starter', defaultCustom())).toBe(false);
    expect(S().activeKey).toBe(DEFAULT_ACTIVE_KEY);
  });

  it('保存后再切走再切回来，配置还在（槽是持久的那个）', () => {
    saveSlotAndApply('custom2', {
      levels: ['A2'],
      tenses: ['sp', 'si'],
      tagFilter: '不规则',
      inputMode: 'choice',
    });
    selectKey('exam'); // 切到别的档
    expect(S().levels).toEqual(PRESETS[3].cfg.levels);
    selectKey('custom2'); // 切回来
    expect(S().levels).toEqual(['A2']);
    expect(S().tenses).toEqual(['sp', 'si']);
    expect(S().tagFilter).toBe('不规则');
    expect(S().inputMode).toBe('choice');
  });

  it('resetSlotAndApply：恢复默认并立刻生效', () => {
    saveSlotAndApply('custom1', { levels: ['C1'], tenses: ['ia'], tagFilter: '', inputMode: 'choice' });
    expect(resetSlotAndApply('custom1')).toBe(true);
    expect(C().slots.custom1).toEqual(defaultCustom());
    expect(S().levels).toEqual(['A2']);
    expect(S().tenses).toEqual(['p', 'pr', 'i']);
    expect(S().inputMode).toBe('type');
  });
});

describe('store · 反序列化清洗（merge / partialize）', () => {
  const curSettings = () => useSettingsStore.getState();
  const curCustom = () => useCustomStore.getState();

  it('mergeSettingsState：存档先过 sanitize，activeKey 单独清洗', () => {
    const merged = mergeSettingsState(
      { levels: [], modes: ['zzz'], tenses: ['sp', 'nope'], activeKey: 'nope', lang: 'fr' },
      curSettings()
    );
    expect(merged.levels).toEqual(LEVELS_IN_DATA); // 空 → 词表里的全部等级
    expect(merged.modes).toEqual(['produce']); // 非法模式 → 默认
    expect(merged.tenses).toEqual(['sp']); // 非法时态剔除
    expect(merged.lang).toBe('zh');
    expect(merged.activeKey).toBe(DEFAULT_ACTIVE_KEY); // 非法 key → 回默认档
  });

  it('mergeSettingsState：存档里的合法 activeKey 与 null 都保留', () => {
    expect(mergeSettingsState({ activeKey: 'exam' }, curSettings()).activeKey).toBe('exam');
    expect(mergeSettingsState({ activeKey: null }, curSettings()).activeKey).toBeNull();
  });

  it('mergeSettingsState：完全没有设置字段的存档 → 整份保持当前默认（不含 activeKey 与设置打架）', () => {
    const before = curSettings();
    [null, undefined, 42, 'x', {}, []].forEach((bad) => {
      const merged = mergeSettingsState(bad, before);
      expect(merged.levels).toEqual(before.levels);
      expect(merged.tenses).toEqual(before.tenses);
      expect(merged.modes).toEqual(before.modes);
      expect(merged.activeKey).toBe(before.activeKey);
    });
    // 就算存档只带了 activeKey，设置也不该被"顺带"换成全量默认
    const onlyKey = mergeSettingsState({ activeKey: 'exam' }, before);
    expect(onlyKey.activeKey).toBe('exam');
    expect(onlyKey.levels).toEqual(before.levels);
  });

  it('mergeSettingsState：有设置字段的老存档 → 逐字段清洗，缺的补默认', () => {
    const merged = mergeSettingsState({ levels: ['B1'] }, curSettings());
    expect(merged.levels).toEqual(['B1']);
    // 只给了 levels，其余字段按默认补齐（不是保留 starter 档的 A1/现在时）
    expect(merged.tenses).toEqual(ALL_TENSE_KEYS);
    expect(merged.showZh).toBe(true);
    expect(merged.vosotros).toBe(true);
  });

  it('mergeSettingsState 不丢动作方法（合并结果仍可调用）', () => {
    const merged = mergeSettingsState({}, curSettings());
    expect(typeof merged.setMode).toBe('function');
    expect(typeof merged.reset).toBe('function');
  });

  it('mergeCustomState：按 CUSTOM_KEYS 补齐两个槽，坏值补默认', () => {
    const m = mergeCustomState(
      { slots: { custom1: { levels: ['C1'], tenses: ['ia'] }, custom2: 'garbage', extra: 1 } },
      curCustom()
    );
    expect(Object.keys(m.slots).sort()).toEqual(['custom1', 'custom2']);
    expect(m.slots.custom1).toEqual({ levels: ['C1'], tenses: ['ia'], tagFilter: '', inputMode: 'type' });
    expect(m.slots.custom2).toEqual(defaultCustom());
    expect((m.slots as Record<string, unknown>).extra).toBeUndefined();
  });

  it('mergeCustomState：垃圾输入 → 两个默认槽', () => {
    [null, undefined, 7, {}].forEach((bad) => {
      const m = mergeCustomState(bad, curCustom());
      expect(m.slots.custom1).toEqual(defaultCustom());
      expect(m.slots.custom2).toEqual(defaultCustom());
    });
  });

  it('partializeCustom：只留 slots，且已归一', () => {
    const state: CustomState = {
      ...curCustom(),
      slots: {
        custom1: { levels: ['B2', 'A1'], tenses: ['sp', 'p'], tagFilter: '', inputMode: 'choice' },
        custom2: defaultCustom(),
      },
    };
    const out = partializeCustom(state);
    expect(Object.keys(out)).toEqual(['slots']);
    expect(out.slots.custom1.levels).toEqual(['A1', 'B2']);
    expect(out.slots.custom1.tenses).toEqual(['p', 'sp']);
    expect(Object.prototype.hasOwnProperty.call(out.slots.custom1, 'save')).toBe(false);
  });

  it('mergeSettingsState 的输入类型宽松（unknown）—— 显式给类型做一次回归', () => {
    const stub = { ...curSettings() } as SettingsState;
    expect(mergeSettingsState(undefined, stub).activeKey).toBe(stub.activeKey);
  });
});

describe('store/persist · AsyncStorage 适配', () => {
  it('三个键都带 es-conj: 前缀且互不相同', () => {
    const keys = Object.values(STORAGE_KEYS);
    expect(keys).toEqual(['es-conj:settings', 'es-conj:custom', 'es-conj:stats']);
    expect(new Set(keys).size).toBe(3);
    keys.forEach((k) => expect(k.startsWith('es-conj:')).toBe(true));
  });

  it('clearAllStores 只清自己的三个键，别的不动', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.settings, '{}');
    await AsyncStorage.setItem(STORAGE_KEYS.custom, '{}');
    await AsyncStorage.setItem(STORAGE_KEYS.stats, '{}');
    await AsyncStorage.setItem('someone-else', 'keep me');

    await clearAllStores();

    expect(await AsyncStorage.getItem(STORAGE_KEYS.settings)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.custom)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.stats)).toBeNull();
    expect(await AsyncStorage.getItem('someone-else')).toBe('keep me');
  });

  it('端到端：坏存档写进存储 → rehydrate → 状态被清洗', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        state: { levels: [], modes: ['zzz'], tenses: ['c', 'bogus'], activeKey: 'nope' },
        version: 0,
      })
    );
    await useSettingsStore.persist.rehydrate();
    const s = useSettingsStore.getState();
    expect(s.levels).toEqual(LEVELS_IN_DATA);
    expect(s.modes).toEqual(['produce']);
    expect(s.tenses).toEqual(['c']);
    expect(s.activeKey).toBe(DEFAULT_ACTIVE_KEY);
    expect(s.vosotros).toBe(true);
  });

  it('端到端：正常存档能原样回来', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        state: {
          levels: ['B1'],
          modes: ['shift'],
          tenses: ['p', 'pr'],
          tagFilter: '',
          inputMode: 'type',
          hideInf: true,
          vosotros: false,
          showZh: false,
          strictAccent: false,
          lang: 'en',
          langMode: 'manual',
          activeKey: 'custom2',
        },
        version: 0,
      })
    );
    await useSettingsStore.persist.rehydrate();
    const s = useSettingsStore.getState();
    expect(s.levels).toEqual(['B1']);
    expect(s.modes).toEqual(['shift']);
    expect(s.tenses).toEqual(['p', 'pr']);
    expect(s.activeKey).toBe('custom2');
    expect(s.hideInf).toBe(true);
    expect(s.vosotros).toBe(false);
    expect(s.lang).toBe('en');
    expect(s.langMode).toBe('manual');
  });

  it('端到端：自定义槽存档能回来', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.custom,
      JSON.stringify({
        state: {
          slots: {
            custom1: { levels: ['C1'], tenses: ['ia'], tagFilter: '不规则', inputMode: 'choice' },
          },
        },
        version: 0,
      })
    );
    await useCustomStore.persist.rehydrate();
    const c = useCustomStore.getState();
    expect(c.slots.custom1).toEqual({
      levels: ['C1'],
      tenses: ['ia'],
      tagFilter: '不规则',
      inputMode: 'choice',
    });
    expect(c.slots.custom2).toEqual(defaultCustom()); // 存档里没有 → 补默认
  });
});

describe('settings store · 零碎动作（轮播选中 / 答题方式 / 恢复默认）', () => {
  it('setActiveKey：可以选中，也可以清空成 null（网页允许一个都不选）', () => {
    useSettingsStore.getState().setActiveKey('exam');
    expect(useSettingsStore.getState().activeKey).toBe('exam');
    useSettingsStore.getState().setActiveKey(null);
    expect(useSettingsStore.getState().activeKey).toBeNull();
    useSettingsStore.getState().setActiveKey(DEFAULT_ACTIVE_KEY);
  });

  it('setInputMode：只认 type / choice，其它值一律按手写处理', () => {
    useSettingsStore.getState().setInputMode('choice');
    expect(useSettingsStore.getState().inputMode).toBe('choice');
    useSettingsStore.getState().setInputMode('nonsense' as unknown as InputMode);
    expect(useSettingsStore.getState().inputMode).toBe('type');
  });

  it('reset：设置与档位一起回到首屏默认', () => {
    useSettingsStore.getState().setMode('transfer');
    useSettingsStore.getState().setLang('en', 'manual');
    useSettingsStore.getState().setFlag('hideInf', true);
    useSettingsStore.getState().setActiveKey('verbs');

    useSettingsStore.getState().reset();
    const s = useSettingsStore.getState();
    expect(s).toMatchObject(initialSettings());
    expect(s.activeKey).toBe(DEFAULT_ACTIVE_KEY);
  });
});
