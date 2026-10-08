import {
  DEFAULT_ACTIVE_KEY,
  defaultSettings,
  initialSettings,
  isValidCfg,
  loadCfg,
  normalizeLevels,
  normalizeTenses,
  sameCfg,
  sameMembers,
  sameSet,
  sanitizeActiveKey,
  sanitizeCfg,
  sanitizeSettings,
  toggleLevelIn,
  toggleTagIn,
  toggleTenseIn,
} from '@/data/settings';
import { ALL_KEYS, CUSTOM_KEYS, PRESETS, defaultCustom } from '@/data/levels';
import { ALL_TENSE_KEYS, LEVELS, LV_TENSE, T } from '@/data/tenses';
import { LEVELS_IN_DATA, VERBS } from '@/data/verbs';
import { MODE_KEYS } from '@/data/modes';

import type { Level, PresetCfg, Settings, TenseKey } from '@/data/types';

describe('settings · sameSet', () => {
  it('元素与顺序都相同才算相同', () => {
    expect(sameSet(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameSet(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameSet(['a'], ['a', 'b'])).toBe(false);
    expect(sameSet([], [])).toBe(true);
  });

  it('非数组一律 false（老存档可能是 null）', () => {
    expect(sameSet(undefined, ['a'])).toBe(false);
    expect(sameSet(['a'], undefined)).toBe(false);
    expect(sameSet(null as unknown as string[], ['a'])).toBe(false);
  });
});

describe('settings · normalizeTenses', () => {
  it('剔除失效键并按 TENSES 固定顺序重排', () => {
    // 故意给乱序 + 非法键 + 重复
    expect(normalizeTenses(['sp', 'p', 'zzz', 'p', 'pr'])).toEqual(['p', 'pr', 'sp']);
    expect(normalizeTenses([...ALL_TENSE_KEYS].reverse())).toEqual(ALL_TENSE_KEYS);
  });

  it('空 / 非法输入得到空数组（"一个时态都不选"是合法状态）', () => {
    expect(normalizeTenses([])).toEqual([]);
    expect(normalizeTenses(undefined)).toEqual([]);
    expect(normalizeTenses('p')).toEqual([]);
    expect(normalizeTenses([1, null, {}])).toEqual([]);
  });

  it('顺序基准：与网页 TENSES 的书写顺序一致（重排它会连带影响预设比对）', () => {
    expect(ALL_TENSE_KEYS).toEqual([
      'p', 'pr', 'i', 'f', 'pp', 'pq', 'fp', 'c', 'cp', 'sp', 'si', 'spt', 'sq', 'ia', 'in',
    ]);
    // 预设/推荐组的时态都必须是规范序的子序列
    PRESETS.forEach((p) => expect(normalizeTenses(p.cfg.tenses)).toEqual(p.cfg.tenses));
    Object.values(LV_TENSE).forEach((ks) => expect(normalizeTenses(ks)).toEqual(ks));
  });

  it('15 个时态键全部认得', () => {
    expect(normalizeTenses(ALL_TENSE_KEYS)).toHaveLength(15);
    expect(ALL_TENSE_KEYS).toHaveLength(15);
    ALL_TENSE_KEYS.forEach((k) => expect(T[k]).toBeTruthy());
  });
});

describe('settings · normalizeLevels', () => {
  it('按 LEVELS 顺序重排并去重', () => {
    expect(normalizeLevels(['C1', 'A1', 'A1', 'B2'])).toEqual(['A1', 'B2', 'C1']);
  });

  it('一个合法等级都没有时回退到词表里实际出现的全部等级', () => {
    expect(LEVELS_IN_DATA).toEqual(LEVELS); // 本词表六个等级都有词
    expect(normalizeLevels([])).toEqual(LEVELS);
    expect(normalizeLevels(['Z9'])).toEqual(LEVELS);
    expect(normalizeLevels(undefined)).toEqual(LEVELS);
  });
});

describe('settings · defaultSettings', () => {
  const d = defaultSettings();

  it('与网页 defaultSettings 的语义一致（已下线的 askTense 不再出现）', () => {
    expect(d.levels).toEqual(LEVELS_IN_DATA);
    expect(d.modes).toEqual(['produce']);
    expect(d.tenses).toEqual(ALL_TENSE_KEYS);
    expect(d.showZh).toBe(true);
    expect(d.strictAccent).toBe(true);
    expect(d.vosotros).toBe(true);
    expect(d.hideInf).toBe(false);
    expect(d.tagFilter).toBe('');
    expect(d.inputMode).toBe('type');
    expect(d.lang).toBe('zh');
    expect(d.langMode).toBe('system');
    expect(Object.prototype.hasOwnProperty.call(d, 'askTense')).toBe(false);
  });

  it('每次返回新对象（调用方可以随便改）', () => {
    const a = defaultSettings();
    a.levels.push('A1');
    a.modes.push('shift');
    a.tenses.length = 0;
    expect(defaultSettings().levels).toEqual(LEVELS_IN_DATA);
    expect(defaultSettings().modes).toEqual(['produce']);
    expect(defaultSettings().tenses).toEqual(ALL_TENSE_KEYS);
  });

  it('等级默认覆盖词表里全部 487 个动词', () => {
    const ids = VERBS.filter((v) => d.levels.includes(v.l));
    expect(ids).toHaveLength(VERBS.length);
    expect(VERBS).toHaveLength(487);
  });
});

describe('settings · loadCfg（只搬四样）', () => {
  const before: Settings = {
    ...defaultSettings(),
    modes: ['recognize'],
    hideInf: true,
    vosotros: false,
    showZh: false,
    strictAccent: false,
    lang: 'en',
    langMode: 'manual',
  };

  it('只改词库范围 / 时态 / 标签 / 答题方式', () => {
    const after = loadCfg(before, {
      levels: ['B1'],
      tenses: ['c'],
      tagFilter: '不规则',
      inputMode: 'choice',
    });
    expect(after.levels).toEqual(['B1']);
    expect(after.tenses).toEqual(['c']);
    expect(after.tagFilter).toBe('不规则');
    expect(after.inputMode).toBe('choice');
  });

  it('练习模式与四个全局开关绝不被档位改掉（红线）', () => {
    const after = loadCfg(before, { ...PRESETS[3].cfg });
    expect(after.modes).toEqual(['recognize']);
    expect(after.hideInf).toBe(true);
    expect(after.vosotros).toBe(false);
    expect(after.showZh).toBe(false);
    expect(after.strictAccent).toBe(false);
    expect(after.lang).toBe('en');
    expect(after.langMode).toBe('manual');
  });

  it('不动原对象（返回新对象）', () => {
    const s = defaultSettings();
    const after = loadCfg(s, { levels: ['A1'], tenses: ['p'], tagFilter: '', inputMode: 'type' });
    expect(after).not.toBe(s);
    expect(s.levels).toEqual(LEVELS_IN_DATA);
    expect(s.tenses).toEqual(ALL_TENSE_KEYS);
  });

  it('把档位自带的时态顺序**原样**搬过来（不重排，否则 sameSet 会误判）', () => {
    PRESETS.forEach((p) => {
      expect(loadCfg(defaultSettings(), p.cfg).tenses).toEqual(p.cfg.tenses);
    });
    // 人造一个乱序 cfg：loadCfg 必须原样保留，而 normalizeTenses 会重排
    const odd: PresetCfg = {
      levels: ['A1'],
      tenses: ['sp', 'p', 'fp'],
      tagFilter: '',
      inputMode: 'type',
    };
    expect(loadCfg(defaultSettings(), odd).tenses).toEqual(['sp', 'p', 'fp']);
    expect(normalizeTenses(odd.tenses)).toEqual(['p', 'fp', 'sp']);
  });
});

describe('settings · sanitizeSettings', () => {
  it('垃圾输入 → 全套默认', () => {
    [null, undefined, 42, 'x', [], {}].forEach((bad) => {
      const s = sanitizeSettings(bad);
      expect(s).toEqual(defaultSettings());
    });
  });

  it('老存档的多选 modes 只留第一个合法项', () => {
    expect(sanitizeSettings({ modes: ['recognize', 'produce'] }).modes).toEqual(['recognize']);
    expect(sanitizeSettings({ modes: ['nope', 'shift'] }).modes).toEqual(['shift']);
    expect(sanitizeSettings({ modes: [] }).modes).toEqual(['produce']);
    expect(sanitizeSettings({ modes: 'produce' }).modes).toEqual(['produce']);
  });

  it('MODE_KEYS 就是四个模式的合法集合', () => {
    expect(MODE_KEYS).toEqual(['recognize', 'produce', 'shift', 'transfer']);
    MODE_KEYS.forEach((k) => expect(sanitizeSettings({ modes: [k] }).modes).toEqual([k]));
  });

  it('bool 字段：非法值回默认，显式 false 必须保留', () => {
    const s = sanitizeSettings({
      hideInf: 1,
      vosotros: 'no',
      showZh: false,
      strictAccent: null,
    });
    expect(s.hideInf).toBe(false); // 1 不是 boolean → 回默认 false
    expect(s.vosotros).toBe(true); // 只有**显式** false 才关（对应网页 `!== false`）
    expect(s.showZh).toBe(false); // false 必须留住（别被 `!== false` 翻转）
    expect(s.strictAccent).toBe(true); // null 不是 boolean → 回默认 true
  });

  it('四个开关显式设过就照实存', () => {
    const s = sanitizeSettings({
      hideInf: true,
      vosotros: false,
      showZh: false,
      strictAccent: false,
    });
    expect(s).toMatchObject({
      hideInf: true,
      vosotros: false,
      showZh: false,
      strictAccent: false,
    });
  });

  it('时态字段缺失 ≠ 显式清空', () => {
    // 缺失（老存档 / 垃圾输入）→ 回默认 15 个时态，别让一次坏存档变成"练不了"
    expect(sanitizeSettings({}).tenses).toEqual(ALL_TENSE_KEYS);
    expect(sanitizeSettings({ levels: ['A1'] }).tenses).toEqual(ALL_TENSE_KEYS);
    // 显式清空是用户操作，照实保留
    expect(sanitizeSettings({ tenses: [] }).tenses).toEqual([]);
  });

  it('lang / langMode 收敛到合法值', () => {
    expect(sanitizeSettings({ lang: 'en' }).lang).toBe('en');
    expect(sanitizeSettings({ lang: 'fr' }).lang).toBe('zh');
    expect(sanitizeSettings({ langMode: 'manual' }).langMode).toBe('manual');
    expect(sanitizeSettings({ langMode: 'x' }).langMode).toBe('system');
  });

  it('时态 / 标签 / 答题方式都归一', () => {
    const s = sanitizeSettings({
      tenses: ['zzz', 'sp', 'p'],
      tagFilter: 42,
      inputMode: 'CHOICE',
    });
    expect(s.tenses).toEqual(['p', 'sp']);
    expect(s.tagFilter).toBe('');
    expect(s.inputMode).toBe('type');
  });
});

describe('settings · sanitizeActiveKey', () => {
  it('合法键原样保留', () => {
    ALL_KEYS.forEach((k) => expect(sanitizeActiveKey(k, 'fallback')).toBe(k));
  });

  it('显式 null 也保留（"一个都没选"是合法状态）', () => {
    expect(sanitizeActiveKey(null, 'fallback')).toBeNull();
  });

  it('老存档缺字段 / 存了非法值 → 回退', () => {
    expect(sanitizeActiveKey(undefined, 'fallback')).toBe('fallback');
    expect(sanitizeActiveKey('nope', 'fallback')).toBe('fallback');
    expect(sanitizeActiveKey(7, 'fallback')).toBe('fallback');
  });
});

describe('settings · cfg 校验', () => {
  it('四个预设的 cfg 全部合法', () => {
    PRESETS.forEach((p) => {
      expect(isValidCfg(p.cfg)).toBe(true);
      const s = sanitizeCfg(p.cfg);
      expect(s).toEqual(p.cfg);
      p.cfg.levels.forEach((lv) => expect(LEVELS.includes(lv)).toBe(true));
      p.cfg.tenses.forEach((t) => expect(ALL_TENSE_KEYS.includes(t)).toBe(true));
    });
  });

  it('defaultCustom 合法且与预设不同（A2 三时态 + 手写）', () => {
    const c = defaultCustom();
    expect(isValidCfg(c)).toBe(true);
    expect(sanitizeCfg(c)).toEqual(c);
    expect(c).toEqual({ levels: ['A2'], tenses: ['p', 'pr', 'i'], tagFilter: '', inputMode: 'type' });
  });

  it('isValidCfg 只认「有非空 levels 数组」的对象', () => {
    expect(isValidCfg({ levels: ['A1'] })).toBe(true);
    expect(isValidCfg({ levels: [] })).toBe(false);
    expect(isValidCfg({ levels: 'A1' })).toBe(false);
    expect(isValidCfg(null)).toBe(false);
    expect(isValidCfg('x')).toBe(false);
  });

  it('sanitizeCfg 把残缺配置补全', () => {
    expect(sanitizeCfg({ levels: ['B1', 'zzz'], tenses: ['c', 'nope'] })).toEqual({
      levels: ['B1'],
      tenses: ['c'],
      tagFilter: '',
      inputMode: 'type',
    });
  });
});

describe('settings · 首屏默认', () => {
  it('默认档位 = 第一张卡（零基础）', () => {
    expect(DEFAULT_ACTIVE_KEY).toBe('starter');
    expect(ALL_KEYS[0]).toBe('starter');
    expect(ALL_KEYS).toEqual([...PRESETS.map((p) => p.k), ...CUSTOM_KEYS]);
    expect(ALL_KEYS).toHaveLength(6);
  });

  it('首屏设置 = 默认档位那套配置（不是"全开"）', () => {
    const s = initialSettings();
    expect(s.levels).toEqual(['A1']);
    expect(s.tenses).toEqual(['p']);
    expect(s.inputMode).toBe('choice');
    // 全局项仍是默认
    expect(s.vosotros).toBe(true);
    expect(s.showZh).toBe(true);
    expect(s.strictAccent).toBe(true);
    expect(s.modes).toEqual(['produce']);
  });
});

/**
 * 切换类纯函数 —— 网页 `mkLevelChips` / `mkTagChips` / 时态 chip 的点击逻辑逐条对齐。
 *
 * 这几个函数**被 store 与设置页共用**（`store/settings.ts` 的 toggleLevel /
 * setTag / toggleTense 就是它们的薄封装），所以这里测一遍等于把两条路都测了。
 */
describe('settings · 三个切换动作', () => {
  it('等级：多选，新增时按 LEVELS 固定顺序插入', () => {
    expect(toggleLevelIn(['B1'], 'A1')).toEqual(['A1', 'B1']);
    expect(toggleLevelIn(['A1', 'C2'], 'B2')).toEqual(['A1', 'B2', 'C2']);
  });

  it('等级：**至少保留 1 个** —— 点掉最后一个被拒绝，原样返回', () => {
    expect(toggleLevelIn(['A2'], 'A2')).toEqual(['A2']);
  });

  it('等级：还能删时会正常删掉', () => {
    expect(toggleLevelIn(['A1', 'A2'], 'A1')).toEqual(['A2']);
  });

  it('等级：拒绝时不会把调用方的数组改坏（返回的是副本）', () => {
    const cur: Level[] = ['A2'];
    const next = toggleLevelIn(cur, 'A2');
    next.push('B1');
    expect(cur).toEqual(['A2']);
  });

  it('标签：单选，点已选中的 = 回到「全部」（空串）', () => {
    expect(toggleTagIn('', '不规则')).toBe('不规则');
    expect(toggleTagIn('不规则', '规则')).toBe('规则');
    expect(toggleTagIn('不规则', '不规则')).toBe('');
  });

  it('时态：来回切，切完按 ALL_TENSE_KEYS 固定顺序重排', () => {
    expect(toggleTenseIn([], 'pr')).toEqual(['pr']);
    expect(toggleTenseIn(['pr'], 'pr')).toEqual([]);
    // 'i' 在 ALL_TENSE_KEYS 里排在 'pr' 之后 —— 输入顺序反了也要纠正过来
    expect(toggleTenseIn(['i'], 'p')).toEqual(['p', 'i']);
  });

  it('时态：非法键进不来（沿用 normalizeTenses 的清洗）', () => {
    expect(toggleTenseIn([], 'nope' as TenseKey)).toEqual([]);
  });
});

describe('settings · 草稿比对（判断设置页改没改）', () => {
  const base = (): PresetCfg => ({
    levels: ['A2'],
    tenses: ['p', 'pr', 'i'],
    tagFilter: '',
    inputMode: 'type',
  });

  it('sameMembers 忽略顺序，但看长度与成员', () => {
    expect(sameMembers(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameMembers(['a'], ['a', 'b'])).toBe(false);
    expect(sameMembers(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameMembers([], [])).toBe(true);
  });

  it('逐字段一致 → 不算改过', () => {
    expect(sameCfg(base(), base())).toBe(true);
  });

  it('时态只是重排 → 不算改过（顺序不影响出题）', () => {
    const a = base();
    const b = base();
    b.tenses = ['i', 'pr', 'p'];
    expect(sameCfg(a, b)).toBe(true);
  });

  it('动到等级 / 时态 / 标签 / 答题方式任意一样 → 算改过', () => {
    const a = base();

    const lv = base();
    lv.levels = ['A2', 'B1'];
    expect(sameCfg(a, lv)).toBe(false);

    const ts = base();
    ts.tenses = ['p', 'pr'];
    expect(sameCfg(a, ts)).toBe(false);

    const tg = base();
    tg.tagFilter = '不规则';
    expect(sameCfg(a, tg)).toBe(false);

    const im = base();
    im.inputMode = 'choice';
    expect(sameCfg(a, im)).toBe(false);
  });

  it('默认配方与「A2 + 三个基础时态」等价 —— 进页面不改任何东西时不该显示"已修改"', () => {
    expect(sameCfg(defaultCustom(), base())).toBe(true);
  });
});
