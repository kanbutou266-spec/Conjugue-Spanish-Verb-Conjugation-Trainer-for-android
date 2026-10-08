/**
 * 文案里的「强调」标记。
 *
 * 网页版把强调直接写成 HTML（`'已选 <b>'+n+'</b> / …'`），RN 渲染不了 HTML，
 * 于是 i18n 表里统一改用 `[[…]]` 标记，由这里解析成分段交给嵌套 `<Text>`。
 * 约定只有两种分段，够用且不会把样式判断漏进文案表：
 *   - `plain`  普通文字
 *   - `strong` 需要加粗（对应网页的 `<b>`）
 *
 * 颜色、字号这类**样式一律不写进文案**（与「高亮只改 color」无关，这条是 i18n 层的事）。
 */

export type RichKind = 'plain' | 'strong';

export interface RichSeg {
  text: string;
  kind: RichKind;
}

const MARK = /\[\[([\s\S]*?)\]\]/g;

/**
 * 把带 `[[…]]` 标记的文案切成有序分段。
 *
 * 容错：落单的 `[[` 或 `]]` 原样当普通文字（文案改坏了也不至于吞字）。
 * 空标记 `[[]]` 会被忽略（不产出空分段）。
 */
export function parseRich(s: string): RichSeg[] {
  const out: RichSeg[] = [];
  const src = String(s ?? '');
  /** 同 kind 的相邻段合并 —— 少一层嵌套 Text，也顺手吃掉 `[[]]` 留下的空档 */
  const push = (text: string, kind: RichKind) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  let last = 0;
  MARK.lastIndex = 0;
  for (let m = MARK.exec(src); m; m = MARK.exec(src)) {
    push(src.slice(last, m.index), 'plain');
    push(m[1], 'strong');
    last = m.index + m[0].length;
  }
  push(src.slice(last), 'plain');
  return out;
}

/** 去掉标记，只留字（用于无障碍标签、Toast、纯文本场景） */
export function plainText(s: string): string {
  return parseRich(s)
    .map((x) => x.text)
    .join('');
}

/** 文案里是否带强调标记（UI 可据此走简单路径，省一层嵌套 Text） */
export function isRich(s: string): boolean {
  return String(s ?? '').indexOf('[[') > -1;
}
