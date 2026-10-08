import type { Lang, Preset, PresetCfg } from './types';
import { ALL_TENSE_KEYS, LV_TENSE } from './tenses';

/**
 * 难度档（六选一）：4 个固定预设 + 2 个自定义槽。
 *
 * 每档 = 一套「这次练什么」：词库范围 + 时态 + 答题方式。
 * **不含练习模式**（题型是单独一行，永远由用户自己选），
 * 也**不碰「设置」栏里的全局项**（语言 / vosotros / 隐藏原形 / 严格重音）。
 * 预设只读；自定义槽可改并实时保存。
 *
 * icon 存的是 lucide 图标名（旧版存 SVG 字符串），由 UI 层映射成组件。
 */
export const PRESETS: Preset[] = [
  {
    k: 'starter',
    icon: 'sprout',
    name: { zh: '零基础 · A1 起步', en: 'Starter · A1' },
    desc: { zh: 'A1 词库 · 现在时 · 选择题', en: 'A1 verbs · present · multiple choice' },
    cfg: { levels: ['A1'], tenses: ['p'], tagFilter: '', inputMode: 'choice' },
  },
  {
    k: 'build',
    icon: 'tree-deciduous',
    name: { zh: '入门 · A2 三时态', en: 'Building · A2 three tenses' },
    desc: {
      zh: 'A1–A2 词库 · 现在 / 简单过去 / 未完成 · 手写',
      en: 'A1–A2 verbs · present, preterite, imperfect · type it',
    },
    cfg: { levels: ['A1', 'A2'], tenses: ['p', 'pr', 'i'], tagFilter: '', inputMode: 'type' },
  },
  {
    k: 'verbs',
    icon: 'rocket',
    name: { zh: '进阶 · B1 八时态', en: 'Advancing · B1 eight tenses' },
    desc: { zh: 'A2–B1 词库 · 8 个时态 · 手写', en: 'A2–B1 verbs · 8 tenses · type it' },
    cfg: { levels: ['A2', 'B1'], tenses: LV_TENSE.B1, tagFilter: '', inputMode: 'type' },
  },
  {
    k: 'exam',
    icon: 'trophy',
    name: { zh: '考试冲刺 · B2 全时态', en: 'Exam sprint · B2' },
    desc: { zh: 'A1–B2 词库 · 全部 15 个时态 · 手写', en: 'A1–B2 verbs · all 15 tenses · type it' },
    cfg: { levels: ['A1', 'A2', 'B1', 'B2'], tenses: ALL_TENSE_KEYS.slice(), tagFilter: '', inputMode: 'type' },
  },
];

export const CUSTOM_KEYS: string[] = ['custom1', 'custom2'];
export const CUSTOM_ICONS: string[] = ['wrench', 'puzzle'];

/** 自定义槽的预填充：A2 词库 + 三个基础时态（避免有人没配置就开始练自定义） */
export function defaultCustom(): PresetCfg {
  return { levels: ['A2'], tenses: ['p', 'pr', 'i'], tagFilter: '', inputMode: 'type' };
}

export const ALL_KEYS: string[] = PRESETS.map((p) => p.k).concat(CUSTOM_KEYS);

export const isCustomKey = (k: string): boolean => CUSTOM_KEYS.indexOf(k) > -1;

export const presetOf = (k: string): Preset | null =>
  PRESETS.filter((p) => p.k === k)[0] || null;

/**
 * 档位的显示名：预设用它表里的名字，自定义槽用「自定义 N」。
 * 这两句是**结构性名称**（不是正文文案），所以先内联在这儿；
 * 等 `src/i18n/` 落地（方案阶段 9）再统一收编。
 */
export function keyName(k: string, lang: Lang = 'zh'): string {
  const p = presetOf(k);
  if (p) return p.name[lang];
  const i = CUSTOM_KEYS.indexOf(k);
  if (i < 0) return k;
  return lang === 'en' ? `Custom ${i + 1}` : `自定义 ${i + 1}`;
}

/** 档位对应的 lucide 图标名 */
export function keyIcon(k: string): string {
  const p = presetOf(k);
  if (p) return p.icon;
  const i = CUSTOM_KEYS.indexOf(k);
  return i < 0 ? 'circle-help' : CUSTOM_ICONS[i];
}
