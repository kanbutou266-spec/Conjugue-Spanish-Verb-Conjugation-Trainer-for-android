import type { Lang, Person, PersonIdx, TenseKey } from './types';

/**
 * 人称表。
 * pro = 这个人称在语法上成立的全部主语代词 ——
 * 辨认模式的选项、练习页的主语提示都用它整组显示（拉美的 ustedes 不会漏）；
 * gl / E 只作为母语释义放在选项下方的小字里。sl 是留给窄屏的短标签（目前未使用）。
 */
export const PERSONS: Person[] = [
  { l: 'yo',                      sl: 'yo',            S: 'yo',                      pro: ['yo'],                     gl: '我',            E: 'I' },
  { l: 'tú',                      sl: 'tú',            S: 'tú',                      pro: ['tú'],                     gl: '你',            E: 'you (informal)' },
  { l: 'él / ella / usted',       sl: 'él / ella',     S: 'él / ella / usted',       pro: ['él', 'ella', 'usted'],    gl: '他/她/您',      E: 'he / she / you (polite)' },
  { l: 'nosotros / nosotras',     sl: 'nosotros',      S: 'nosotros / nosotras',     pro: ['nosotros', 'nosotras'],   gl: '我们',          E: 'we' },
  { l: 'vosotros / vosotras',     sl: 'vosotros',      S: 'vosotros / vosotras',     pro: ['vosotros', 'vosotras'],   gl: '你们',          E: 'you all (Spain)' },
  { l: 'ellos / ellas / ustedes', sl: 'ellos / ellas', S: 'ellos / ellas / ustedes', pro: ['ellos', 'ellas', 'ustedes'], gl: '他们/她们/诸位', E: 'they / you all' },
];

/** 人称序数：前 3 个单数、后 3 个复数，选项与答案网格都按两行排 */
export const PERSON_ORD: string[] = [
  '第一人称单数', '第二人称单数', '第三人称单数',
  '第一人称复数', '第二人称复数', '第三人称复数',
];
export const PERSON_ORD_EN: string[] = [
  '1st person singular', '2nd person singular', '3rd person singular',
  '1st person plural', '2nd person plural', '3rd person plural',
];

export const PERS_ROW1: PersonIdx[] = [0, 1, 2];
export const PERS_ROW2: PersonIdx[] = [3, 4, 5];

/** 命令式只有 5 个人称（没有 yo），且用 usted / ustedes 而非 él / ella / ellos / ellas */
export const IMP_LABEL: Record<number, string> = {
  1: 'tú', 2: 'usted', 3: 'nosotros', 4: 'vosotros', 5: 'ustedes',
};

/** 主语代词白名单（判分时剔除用户多写的代词用） */
export const PRON: string[] = [
  'yo', 'tú', 'tu', 'él', 'ella', 'usted', 'nosotros', 'nosotras',
  'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes',
];

/** 命令式专属的释义（usted 视作「您」，仍属第二人称） */
export const IMP_GLOSS: Record<number, Record<Lang, string>> = {
  1: { zh: '你', en: 'you (informal)' },
  2: { zh: '您', en: 'you (polite)' },
  3: { zh: '我们', en: 'we' },
  4: { zh: '你们', en: 'you all (Spain)' },
  5: { zh: '诸位', en: 'you all' },
};

export const IMP_ORD: Record<number, Record<Lang, string>> = {
  1: { zh: '第二人称单数', en: '2nd person singular' },
  2: { zh: '第二人称单数（您）', en: '2nd person singular (polite)' },
  3: { zh: '第一人称复数', en: '1st person plural' },
  4: { zh: '第二人称复数', en: '2nd person plural' },
  5: { zh: '第二人称复数（诸位）', en: '2nd person plural (polite)' },
};

export const isImp = (k: TenseKey | string): boolean => k === 'ia' || k === 'in';

/**
 * 命令式用专属标签，其余时态用通用标签。
 *
 * ⚠️ `IMP_LABEL` / `IMP_GLOSS` / `IMP_ORD` 都只有 1~5 号键（命令式语法上没有 yo），
 * 但**调用方**（辨认模式的六格候选、`PersonGrid` 六人称对照）遍历的是 0~5 ——
 * 所以下标一律要兜底回通用标签，否则命令式题渲染 yo 格时
 * `IMP_GLOSS[0][lang]` 直接抛 "Cannot convert undefined value to object"（真机踩过）。
 */
export const personLabel = (i: PersonIdx, k: TenseKey): string =>
  isImp(k) ? (IMP_LABEL[i] ?? PERSONS[i].l) : PERSONS[i].l;

export const personGloss = (i: PersonIdx, k: TenseKey, lang: Lang): string =>
  isImp(k)
    ? (IMP_GLOSS[i]?.[lang] ?? (lang === 'en' ? PERSONS[i].E : PERSONS[i].gl))
    : (lang === 'en' ? PERSONS[i].E : PERSONS[i].gl);

export const personOrd = (i: PersonIdx, k: TenseKey, lang: Lang): string =>
  isImp(k)
    ? (IMP_ORD[i]?.[lang] ?? (lang === 'en' ? PERSON_ORD_EN[i] : PERSON_ORD[i]))
    : (lang === 'en' ? PERSON_ORD_EN[i] : PERSON_ORD[i]);

/** 命令式每格只对应一个代词（usted / ustedes…）；其余人称从候选里随机抽一个显示 */
export function personPro(i: PersonIdx, k: TenseKey): string[] {
  if (isImp(k)) return [IMP_LABEL[i] || 'yo'];
  const p = PERSONS[i];
  return p.pro && p.pro.length ? p.pro : [p.S];
}

/**
 * 「辨认是哪个人称」一律用**西语代词**作答：
 * yo / tú / él·ella·usted / nosotros·nosotras / vosotros·vosotras / ellos·ellas·ustedes。
 * 理由：① 英语 you 既单数又复数，中文「你/您/你们」也不是一一对应；
 *      ② 拉美的 ustedes 同时对应「你们」和「诸位」，摆出整组代词才不歧义；
 *      ③ 选项本身就是要在西语里认出来的东西，不该绕一层母语。
 * 多主语的人称（él / ella / usted）把一整组写出来，不再只显示其中一个。
 */
export function personProSet(i: PersonIdx, k: TenseKey): string[] {
  // 命令式没有 yo 这一格，但选项里仍要保留 yo 键
  // （hable 这类同形形式也可以读成虚拟式的 yo）—— 标签回退成 yo，不能留白
  if (isImp(k)) return [IMP_LABEL[i] || 'yo'];
  const p = PERSONS[i];
  return p.pro && p.pro.length ? p.pro.slice() : [p.S];
}

/**
 * 作答框左边那个「主语提示」只取**一个**代词（用户 2026-10-02 定）。
 *
 * 网页版是把整组写出来（`él / ella / usted`），手机上输入框会被挤到没地方；
 * 同一格里的代词变位完全相同，写一个就够提示了。取第一个，**确定性**优先
 * （随机挑会让「翻回上一题」时主语变样，测试也没法写死）。
 *
 * ⚠️ 命令式走 `IMP_LABEL`：第三人称只存在 **usted / ustedes**，
 * 没有 él / ella / ellos / ellas（`personProSet` 已经把这个差异吃掉了）。
 */
export function mainPronoun(i: PersonIdx, k: TenseKey): string {
  return personProSet(i, k)[0];
}
