/**
 * 引擎层类型定义。
 *
 * 字段名刻意保持单字母（i/z/e/l/r/g/t/c/h）—— 这是从旧版
 * data/verbs_data.json 迁移过来的、已验证过的数据资产，不重新设计，
 * 避免搬运过程中引入隐性偏差。详见 RN移植方案.md §4.1。
 */

/** 15 个时态键（与 verbs_data.json 的 t/c/h 的键一一对应） */
export type TenseKey =
  | 'p' | 'pp' | 'pr' | 'i' | 'pq' | 'f' | 'fp'
  | 'c' | 'cp' | 'sp' | 'spt' | 'si' | 'sq' | 'ia' | 'in';

/** 四个语式分组：陈述 / 条件 / 虚拟 / 命令 */
export type GroupKey = 'ind' | 'cond' | 'sub' | 'imp';

/** 词表难度等级（与 build_final.py 的 LEVELS 必须一致） */
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** 「按难度推荐时态」只到 B2：B2 已是全部 15 个时态，C1/C2 再列一遍没有意义 */
export type RecLevel = 'A1' | 'A2' | 'B1' | 'B2';

/** 人称下标：0-2 单数，3-5 复数。命令式没有 0（yo） */
export type PersonIdx = 0 | 1 | 2 | 3 | 4 | 5;

/** 四个练习模式 */
export type ModeKey = 'recognize' | 'produce' | 'shift' | 'transfer';

/** 答题方式 */
export type InputMode = 'type' | 'choice';

/** 界面语言 */
export type Lang = 'zh' | 'en';

/** 语言来源：跟系统（默认）还是用户手选 */
export type LangMode = 'system' | 'manual';

/**
 * 深浅色来源（用户 2026-10-05 定，三档）：
 *   'system' —— 跟随**手机系统的深色开关**（默认）。系统若设了「日出日落自动
 *               切换」，App 就跟着自动变；App 自己不看表。
 *   'dark'   —— 强制深色（白天也想用深色的人）
 *   'light'  —— 强制浅色
 */
export type ThemeMode = 'system' | 'dark' | 'light';

/**
 * 形式着色码：'.' 规则 / o 正字法拼写变化 / s 词干变化 / i 其他不规则。
 * 注意 —— 颜色只落在「真正变了的那几个字母」上（见 engine/highlight.ts），
 * 这个字符本身只是「哪一类」的语义标记。
 */
export type CodeKind = 'i' | 'o' | 's' | '.';

/** 答错时的定性诊断，由 UI 层翻译成文案 */
export type DiagKind = 'irr' | 'orth' | 'stem';

/** 变化字母的区间 [起, 止) */
export type Span = [number, number];

/** 某时态 6 个人称位置的变化字母区间；规则形式为 null */
export type HlRow = (Span | null)[];

export interface Tense {
  k: TenseKey;
  zh: string;
  en: string;
  es: string;
  g: GroupKey;
  /** 1 = 复合时态（haber + 过去分词），0 = 简单时态 */
  cp: 0 | 1;
  lv: Level;
}

export interface TenseGroup {
  k: GroupKey;
  zh: string;
  en: string;
  es: string;
  hint: string;
  ehint: string;
}

/**
 * 人称表。pro = 该人称在语法上成立的全部主语代词 ——
 * 辨认模式的选项、练习页的主语提示都用它整组显示（拉美的 ustedes 不会漏）。
 */
export interface Person {
  l: string;
  sl: string;
  S: string;
  pro: string[];
  gl: string;
  E: string;
}

export interface Verb {
  /** 原形 */
  i: string;
  /** 中文释义 */
  z: string;
  /** 英文释义 */
  e: string;
  /** 等级 */
  l: Level;
  /** 词频排名 */
  r: number;
  /** 标签 */
  g: string[];
  /** 变位表：每时态一个 'a|b|c|d|e|f' 串（6 个人称） */
  t: Partial<Record<TenseKey, string>>;
  /** 着色码：每时态一个 6 字符串，只有含非规则形式的时态才出现 */
  c?: Partial<Record<TenseKey, string>>;
  /** 变化字母区间，与 c 平行；只有非规则形式才有区间 */
  h?: Partial<Record<TenseKey, HlRow>>;
}

/** 出题范围配置（难度档的正文） */
export interface PresetCfg {
  levels: Level[];
  tenses: TenseKey[];
  tagFilter: string;
  inputMode: InputMode;
}

/** 难度档：4 个固定预设 + 2 个自定义槽 */
export interface Preset {
  k: string;
  /** lucide 图标名，由 UI 层映射成组件（旧版存的是 SVG 字符串） */
  icon: string;
  name: Record<Lang, string>;
  desc: Record<Lang, string>;
  cfg: PresetCfg;
}

/** 全局设置（对应旧版的 DB.settings） */
export interface Settings {
  levels: Level[];
  modes: ModeKey[];
  tenses: TenseKey[];
  tagFilter: string;
  inputMode: InputMode;
  hideInf: boolean;
  vosotros: boolean;
  showZh: boolean;
  strictAccent: boolean;
  lang: Lang;
  /** 'system' = 跟随系统语言（默认）；'manual' = 用 lang 字段 */
  langMode: LangMode;
  /** 深浅色：'system'（跟随系统深色开关，默认）/ 'dark' / 'light' */
  themeMode: ThemeMode;
}

/**
 * 本题的设置快照。渲染与判分只认它、不读全局设置，
 * 这样中途怎么改设置，题干/选项/判分口径都自洽。
 */
export type SettingsSnapshot = Pick<
  Settings,
  'inputMode' | 'showZh' | 'hideInf' | 'strictAccent' | 'vosotros'
>;

/** 一个形式在整张变位表里的某一种读法 */
export interface FormHit {
  p: PersonIdx;
  k: TenseKey;
}

export interface Question {
  /** 要变位的动词原形 */
  inf: string;
  /** 该动词在词表中的下标 */
  idx: number;
  zh: string;
  g: string[];
  lv: Level;
  mode: ModeKey;
  tense: TenseKey;
  person: PersonIdx;
  answer: string;
  /** 转换模式的目标时态与答案 */
  tense2?: TenseKey;
  answer2?: string;
  /** 平移模式：A 动词（已知的那一个） */
  srcInf?: string;
  srcZh?: string;
  srcForm?: string;
  /** A 出示的形式在同一人称下的其他成立读法 */
  srcAlts?: TenseKey[];
  /** 一并接受的备选答案 */
  answersAlt?: string[];
  /** 辨认模式：本题形式的全部成立读法 */
  hits?: FormHit[];
  /** 辨认模式：是否要额外问「这是哪个时态」 */
  askTense?: boolean;
  pickPerson?: PersonIdx | null;
  pickTense?: TenseKey | null;
  userInf?: string;
  options?: string[];
  /** 去重用的题目标识 */
  key: string;
  s: SettingsSnapshot;
  userAnswer: string | null;
  correct: boolean | null;
  diag?: DiagKind | null;
  /**
   * 作答结果补充：
   *  · `soft`  = 判对但只差重音（网页的 warn 态，`judge().soft`）
   *  · 后三项是**辨认模式「考三项」的判定明细** —— 反馈面板要能说清
   *    「原形错 / 人称错 / 时态错」到底是哪一项，不能只给一个总的对错。
   *    对应网页在 `q` 上就地挂的 `q.infOK / q.personOK / q.tenseOK`。
   */
  soft?: boolean;
  infOK?: boolean | null;
  personOK?: boolean | null;
  tenseOK?: boolean | null;
}

/** 可注入的随机源，便于单测固定取值 */
export type Rand = () => number;
