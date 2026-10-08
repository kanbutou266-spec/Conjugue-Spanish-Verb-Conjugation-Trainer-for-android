import type { Lang, ModeKey } from './types';

/**
 * 四个练习模式（**单选**：网页 2.0 起 modes 只留第一个有效值）。
 *
 * d / ed = 练习首页模式按钮下方那行「游戏规则」说明（对应网页 MODES[].d）；
 * icon  = lucide 图标名，由 UI 层映射成组件（网页存的是 SVG 字符串）。
 */
export interface ModeDef {
  k: ModeKey;
  zh: string;
  en: string;
  /** 窄屏用的短名（四个按钮排一行时用，见 ModeSelector） */
  sz: string;
  se: string;
  /** 一句话游戏规则（中文） */
  d: string;
  /** 一句话游戏规则（英文） */
  ed: string;
  icon: string;
}

export const MODES: ModeDef[] = [
  {
    k: 'recognize',
    zh: '辨认模式',
    en: 'Recognition',
    sz: '辨认',
    se: 'Recognize',
    d: '看一个变位形式，判断人称、时态',
    ed: 'See a conjugated form — tell the person and tense',
    icon: 'eye',
  },
  {
    k: 'produce',
    zh: '复现模式',
    en: 'Production',
    sz: '复现',
    se: 'Produce',
    d: '给出人称与时态，直接写出变位',
    ed: 'Given a person and a tense, write the form',
    icon: 'pencil',
  },
  {
    k: 'shift',
    zh: '转换模式',
    en: 'Tense shift',
    sz: '转换',
    se: 'Shift',
    d: '同一个动词：人称不变，只换一个时态',
    ed: 'Same verb and person — switch to another tense',
    icon: 'repeat',
  },
  {
    k: 'transfer',
    zh: '平移模式',
    en: 'Verb transfer',
    sz: '平移',
    se: 'Transfer',
    d: '照 A 动词的时态和人称，写出 B 动词的变位',
    ed: "Follow verb A's tense and person — write verb B's form",
    icon: 'arrow-left-right',
  },
];

export const MODE_KEYS: ModeKey[] = MODES.map((m) => m.k);

export const modeOf = (k: ModeKey): ModeDef | undefined => MODES.filter((m) => m.k === k)[0];

/** 模式名（zh 用表里的中文，en 用英文名） */
export const modeName = (k: ModeKey, lang: Lang = 'zh'): string => {
  const m = modeOf(k);
  if (!m) return k;
  return lang === 'en' ? m.en : m.zh;
};

/**
 * 模式**短名** —— 四个按钮挤在一行时用（`ui/components/ModeSelector`）。
 * 「辨认模式」→「辨认」省掉 2 个字，让 4 个按钮在 360dp 的窄屏上也能一排放下。
 *
 * 完整名仍由 `modeName` 提供（作答页顶部徽标、无障碍标签都靠它）；
 * 但首页那行**不再重复模式名**（用户 2026-10-03：「不需要再说一遍这个模式的名字」），
 * 只留一句话规则 —— 见 `modeDesc`。
 */
export const modeShort = (k: ModeKey, lang: Lang = 'zh'): string => {
  const m = modeOf(k);
  if (!m) return k;
  return lang === 'en' ? m.se : m.sz;
};

/** 模式规则说明 */
export const modeDesc = (k: ModeKey, lang: Lang = 'zh'): string => {
  const m = modeOf(k);
  if (!m) return '';
  return lang === 'en' ? m.ed : m.d;
};

/**
 * 「隐藏动词原形」只对这三个模式生效 —— 对应的另一个是复现模式，
 * 它本来就没给原形（答案就是原形所在的形式），不需要"隐藏"。
 */
export const INF_MODES: ModeKey[] = ['recognize', 'shift', 'transfer'];
