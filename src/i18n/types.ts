/**
 * i18n 的值类型。
 *
 * 网页版 `I18N` 是 `{ key: string | (...args) => string }`，
 * RN 端**保持同样的形状**——不引入 ICU / 复数规则那些重家伙：
 * 本应用全部文案要么是死字符串，要么只是把参数拼进去（`n => n+' 个动词'`），
 * 自己写 `tr()` 的迁移成本最低（方案 §7.2）。
 */

/** 可以插进文案的参数：数字或字符串 */
export type TextArg = string | number;

/** 函数型文案（网页 `sub: n => '…'+n+'…'`） */
export type TFn = (...args: TextArg[]) => string;

export type TextValue = string | TFn;

/** 一张语言的文案表 */
export type Dict = Record<string, TextValue>;
