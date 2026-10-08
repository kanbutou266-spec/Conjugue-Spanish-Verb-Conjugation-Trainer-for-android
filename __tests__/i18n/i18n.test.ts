jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

import { act, renderHook } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';

import {
  DICTS,
  I18N_PARITY_OK,
  TAG_FILTERS,
  currentLang,
  refreshSystemLang,
  resolveLang,
  sysLangRef,
  systemLang,
  tagName,
  tr,
  useI18n,
} from '@/i18n';
import { en } from '@/i18n/en';
import { zh } from '@/i18n/zh';
import { useSettingsStore } from '@/store/settings';

import type { I18nKey } from '@/i18n';
import type { TextValue } from '@/i18n/types';

const mockLocales = getLocales as unknown as jest.Mock;

beforeEach(() => {
  mockLocales.mockReturnValue([{ languageCode: 'zh' }]);
});

const KEYS = Object.keys(zh) as I18nKey[];

/** 把一条文案"渲染"出来：函数型的用等量假参数调用 */
function render(v: TextValue): string {
  return typeof v === 'function' ? v(...Array.from({ length: v.length }, () => 1)) : v;
}

describe('i18n —— 两张语言表的结构', () => {
  it('键集完全一致（编译期断言也是 true）', () => {
    expect(I18N_PARITY_OK).toBe(true);
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });

  it('键的数量与预期一致（改文案时这条会提醒你更新计数）', () => {
    // 2026-10-04：+navGuide/navMe/setSec*/langZh/langEn/cancel 与「关于」页那 20 条 ab*
    // （底栏改成 练习·讲解·变位表·我的 四个 tab 时一并补齐）
    // 2026-10-05：-meSecLearn/-meSecGeneral/-meSecOther 与三条 *Sub（「我的」页去掉
    //             一级标题与副标题）、-setSecQuiz（并入 setSecUI）、+navTableShort（底栏短标签）
    // 2026-10-05（二）：+correctInf（辨认模式反馈「正确原形：」，替换掉之前误显示的变位形式）
    //                 +stLimit（统计页榜单右上角「最多 N 条」；同时删掉错题本段）
    // 2026-10-05（三）：设置页重新分段 —— -setSecLang（「语言」段改名为「界面」，
    //                 复用 setSecUI）、+setSecQuiz（「界面与出题」改名「出题」，重新启用）；
    //                 深色模式 +setDarkFollow/setDarkFollowT/setDark/setDarkT/darkLight/darkDark
    expect(KEYS.length).toBe(271);
  });

  it('每对同键的函数型文案**形参个数相同**', () => {
    const bad: string[] = [];
    for (const k of KEYS) {
      const a = zh[k];
      const b = en[k];
      const fa = typeof a === 'function';
      const fb = typeof b === 'function';
      if (fa !== fb) bad.push(`${k}: zh ${fa ? 'fn' : 'str'} vs en ${fb ? 'fn' : 'str'}`);
      else if (fa && fb && a.length !== b.length) bad.push(`${k}: ${a.length} vs ${b.length}`);
    }
    expect(bad).toEqual([]);
  });

  it('英文表里没有漏译的中文字（语言名之类的例外单独列）', () => {
    // en 里允许出现中文的键 —— 只有一种情况：**语言名用母语书写**。
    // 网页版也是这么做的（`[['zh','中文'],['en','English']]`，见 app_template.html
    // 的语言选择器），所以 `langZh` 不是漏译，是故意保留。
    const ALLOW: I18nKey[] = ['langZh'];
    const bad: string[] = [];
    for (const k of KEYS) {
      if (ALLOW.includes(k)) continue;
      const s = render(en[k]);
      if (/[\u4e00-\u9fff]/.test(s)) bad.push(`${k}: ${s}`);
    }
    expect(bad).toEqual([]);
  });

  it('中文表里每一条都能渲染成非空字符串', () => {
    const bad: string[] = [];
    for (const k of KEYS) {
      const s = render(zh[k]);
      if (typeof s !== 'string' || !s.trim()) bad.push(k);
    }
    expect(bad).toEqual([]);
  });

  it('渲染结果里不出现 undefined / NaN / [object', () => {
    const bad: string[] = [];
    for (const lang of ['zh', 'en'] as const) {
      for (const k of KEYS) {
        const s = render(DICTS[lang][k]);
        if (/undefined|NaN|\[object/.test(s)) bad.push(`${lang}.${k}: ${s}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('没有残留的 HTML 标记（<b> / <span> / <br> / <kbd>）', () => {
    const bad: string[] = [];
    for (const lang of ['zh', 'en'] as const) {
      for (const k of KEYS) {
        const raw = DICTS[lang][k];
        const src = typeof raw === 'function' ? raw.toString() : raw;
        if (/<[a-z/]/.test(src)) bad.push(`${lang}.${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('[[…]] 标记成对出现', () => {
    const bad: string[] = [];
    for (const k of KEYS) {
      const s = render(zh[k]);
      const open = (s.match(/\[\[/g) || []).length;
      const close = (s.match(/\]\]/g) || []).length;
      if (open !== close) bad.push(`${k}: ${open} vs ${close}`);
    }
    expect(bad).toEqual([]);
  });

  it('带强调标记的文案已被"数字化"（标记只包参数，不包整句）', () => {
    // 这些键是网页里用 <b> 强调参数的地方，标记应该原样落在参数两侧
    expect(tr('zh', 'tCount', 3, 15)).toBe('已选 [[3]] / 15 个时态');
    expect(tr('en', 'tCount', 3, 15)).toBe('[[3]] / 15 tenses selected');
    expect(tr('zh', 'cameFrom', 'ser')).toBe('本题原本取自 [[ser]]。');
    expect(tr('en', 'pool', 42, 8)).toBe('Current pool: [[42]] verbs / [[8]] tenses');
  });
});

describe('i18n —— tr()', () => {
  it('取字符串文案', () => {
    // 开始键不再带箭头（用户 2026-10-02：按钮上那个 → 是噪音）
    expect(tr('zh', 'start')).toBe('开始练习');
    expect(tr('en', 'start')).toBe('Start');
  });

  it('取函数型文案并插值', () => {
    expect(tr('zh', 'presetCount', 487)).toBe('487 个动词');
    expect(tr('en', 'presetCount', 487)).toBe('487 verbs');
    expect(tr('zh', 'gdCount', 2, 8)).toBe('第 2 / 8 页');
  });

  it('当前语言缺键时回退中文（与网页 tr() 一致）', () => {
    const saved = en.title;
    delete (en as Record<string, unknown>).title;
    try {
      expect(tr('en', 'title')).toBe(zh.title);
    } finally {
      (en as Record<string, unknown>).title = saved;
    }
  });

  it('两张表都没有的键，原样返回键名', () => {
    expect(tr('zh', 'noSuchKey' as I18nKey)).toBe('noSuchKey');
    expect(tr('en', 'noSuchKey' as I18nKey)).toBe('noSuchKey');
  });

  it('参数不足时也不会抛错（只是少拼一段）', () => {
    expect(() => tr('zh', 'tRecT')).not.toThrow();
  });
});

describe('i18n —— 语言解析', () => {
  it('手选模式：听用户的', () => {
    expect(resolveLang('en', 'manual', 'zh')).toBe('en');
    expect(resolveLang('zh', 'manual', 'en')).toBe('zh');
  });

  it('跟随系统：系统是中文才中文，其余一律英语', () => {
    expect(resolveLang('en', 'system', 'zh')).toBe('zh');
    expect(resolveLang('zh', 'system', 'en')).toBe('en');
  });

  it('systemLang()：zh / zh-Hans / zh-TW 都算中文', () => {
    for (const code of ['zh', 'zh-Hans', 'zh-TW']) {
      mockLocales.mockReturnValue([{ languageCode: code }]);
      expect(systemLang()).toBe('zh');
    }
  });

  it('systemLang()：非中文一律英语', () => {
    for (const code of ['en', 'fr', 'ja', 'es', 'de-AT']) {
      mockLocales.mockReturnValue([{ languageCode: code }]);
      expect(systemLang()).toBe('en');
    }
  });

  it('systemLang()：取不到语言时回退中文，原生模块抛错也不崩', () => {
    mockLocales.mockReturnValue([]);
    expect(systemLang()).toBe('zh');
    mockLocales.mockReturnValue([{}]);
    expect(systemLang()).toBe('zh');
    mockLocales.mockImplementation(() => {
      throw new Error('no native module');
    });
    expect(systemLang()).toBe('zh');
  });

  it('refreshSystemLang() 刷新缓存并返回新值', () => {
    mockLocales.mockReturnValue([{ languageCode: 'en' }]);
    expect(refreshSystemLang()).toBe('en');
    expect(sysLangRef.value).toBe('en');
    mockLocales.mockReturnValue([{ languageCode: 'zh-CN' }]);
    expect(refreshSystemLang()).toBe('zh');
    expect(sysLangRef.value).toBe('zh');
  });

  it('currentLang() 读 store 的 lang + langMode', () => {
    refreshSystemLang();
    mockLocales.mockReturnValue([{ languageCode: 'zh' }]);
    refreshSystemLang();

    useSettingsStore.getState().setLang('en', 'manual');
    expect(currentLang()).toBe('en');

    // 跟随系统 → 不管手选过什么，都听系统的
    useSettingsStore.getState().setLang('en', 'system');
    expect(currentLang()).toBe('zh');

    mockLocales.mockReturnValue([{ languageCode: 'es' }]);
    refreshSystemLang();
    expect(currentLang()).toBe('en');

    // 复原，别影响别的用例
    useSettingsStore.getState().setLang('zh', 'system');
    mockLocales.mockReturnValue([{ languageCode: 'zh' }]);
    refreshSystemLang();
  });
});

describe('i18n —— useI18n()（组件里用的那个）', () => {
  it('跟随系统：系统中文就是中文', async () => {
    mockLocales.mockReturnValue([{ languageCode: 'zh' }]);
    refreshSystemLang();
    useSettingsStore.getState().setLang('zh', 'system');

    const { result } = await renderHook(() => useI18n());
    expect(result.current.lang).toBe('zh');
    expect(result.current.t('start')).toBe(zh.start);
  });

  it('改成手选英语后立刻生效（t 会重新绑定语言）', async () => {
    mockLocales.mockReturnValue([{ languageCode: 'zh' }]);
    refreshSystemLang();
    useSettingsStore.getState().setLang('zh', 'system');

    const { result } = await renderHook(() => useI18n());
    await act(async () => {
      useSettingsStore.getState().setLang('en', 'manual');
    });
    expect(result.current.lang).toBe('en');
    expect(result.current.t('start')).toBe(en.start);
    expect(result.current.t('presetCount', 487)).toBe('487 verbs');
  });

  it('系统是非中文时，跟随系统就直接英文', async () => {
    mockLocales.mockReturnValue([{ languageCode: 'es' }]);
    refreshSystemLang();
    useSettingsStore.getState().setLang('zh', 'system');

    const { result } = await renderHook(() => useI18n());
    expect(result.current.lang).toBe('en');
  });

  it('用完后把语言状态复原，别影响别的用例', async () => {
    mockLocales.mockReturnValue([{ languageCode: 'zh' }]);
    refreshSystemLang();
    await act(async () => {
      useSettingsStore.getState().setLang('zh', 'system');
    });
    expect(currentLang()).toBe('zh');
  });
});

describe('i18n —— 词表标签', () => {
  it('中文下原样返回', () => {
    expect(tagName('不规则', 'zh')).toBe('不规则');
    expect(tagName('词干变化(e→ie)', 'zh')).toBe('词干变化(e→ie)');
  });

  it('英文下查表', () => {
    expect(tagName('不规则', 'en')).toBe('irregular');
    expect(tagName('强过去式', 'en')).toBe('strong preterite');
    expect(tagName('不规则分词', 'en')).toBe('irregular participle');
    expect(tagName('重音变化', 'en')).toBe('accent shift');
    expect(tagName('拼写变化', 'en')).toBe('spelling change');
    expect(tagName('高频', 'en')).toBe('high-frequency');
  });

  it('带参数的「词干变化(x→y)」拆成 stem change (x→y)', () => {
    expect(tagName('词干变化(e→ie)', 'en')).toBe('stem change (e→ie)');
    expect(tagName('词干变化(o→ue)', 'en')).toBe('stem change (o→ue)');
  });

  it('认不出的标签原样返回，不显示空白', () => {
    expect(tagName('自造标签', 'en')).toBe('自造标签');
    expect(tagName('词干变化', 'en')).toBe('词干变化'); // 没有括号里的参数就不匹配
  });

  it('TAG_FILTERS：六个选项、值唯一、键都在文案表里', () => {
    expect(TAG_FILTERS).toHaveLength(6);
    expect(TAG_FILTERS.map((o) => o.k)).toEqual([
      '',
      '不规则',
      '规则',
      '高频',
      '拼写变化',
      '词干变化',
    ]);
    expect(new Set(TAG_FILTERS.map((o) => o.k)).size).toBe(6);
    for (const o of TAG_FILTERS) expect(zh[o.key]).toBeDefined();
  });
});
