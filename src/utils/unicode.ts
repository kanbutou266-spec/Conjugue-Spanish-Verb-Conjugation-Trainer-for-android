/**
 * 字符串归一化工具：判分与去重的共同基础。
 */

/**
 * 归一化：去首尾空白、转小写、内部连续空白压成一个空格。
 * 判分、选项查重、同形比较都用它。
 */
export const norm = (s: unknown): string =>
  String(s).trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * 去重音符（含 ñ → n），用于「只是重音打错」的宽容判定。
 * NFD 分解后 [\u0300-\u036f] 会一并吃掉 ñ 的组合波浪号，
 * 后面那句 replace 是历史保留（对 NFD 后的串其实已无 ñ 可换）。
 */
export const stripAcc = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g, 'n');

/**
 * 自复动词（acostarse / irse …）：变位形式带 me/te/se/nos/os，
 * 答案要连代词一起写。与 build_final.py / classify.py 的 is_refl 判定一致
 * —— irse 只有 4 个字母，不要卡长度。
 */
export function isRefl(inf: unknown): boolean {
  const s = String(inf || '');
  return (
    s.length >= 4 &&
    s.endsWith('se') &&
    ['ar', 'er', 'ir'].indexOf(s.slice(-4, -2)) > -1
  );
}
