import type { CodeKind, HlRow, PersonIdx } from '@/data/types';

/**
 * 变位形式着色的**分段输出** —— 网页版用 marked() 拼 HTML，
 * RN 不能碰 innerHTML，必须输出可渲染的 [{text, kind}] 给嵌套 <Text> 用。
 *
 * 两条硬规则（与网页版一致，改动前先看 data/app_template.html 第 148-156 行）：
 *   ① **只改文字颜色，不铺底色** —— 颜色只落在「真正变了的那几个字母」上；
 *   ② 字号 / 字重 / 字距必须继承 —— 只要其中之一与相邻字母不同，
 *      这个字母的占宽就会变，整词的字距就会忽宽忽窄。
 *      FormText 里请**不要**给内层 Text 设 fontWeight。
 */

export type SegmentKind = 'plain' | CodeKind;

export interface Segment {
  text: string;
  kind: SegmentKind;
}

/**
 * 把一个变位形式切成若干段。
 *
 * @param form   变位形式，如 'pienso' / 'practiqué' / 'me acuesto'
 * @param code   该时态的 6 位着色码串（v.c[k]），如 'sss..s'；缺省视为全规则
 * @param hl     该时态的 6 个变化字母区间（v.h[k]）；缺省视为无区间
 * @param person 人称下标
 *
 * 规则码（'.'）或不带区间的形式**整词保持原色**：颜色只在
 * `.hl` 上，而 .hl 只在有区间时才生成 —— 这正是网页版的实现行为。
 *
 * 例：segments('pienso', 'sss..s', [[1,3],…], 0)
 *   → [{text:'p',kind:'plain'}, {text:'ie',kind:'s'}, {text:'nso',kind:'plain'}]
 */
export function segments(
  form: string,
  code: string | undefined | null,
  hl: HlRow | null | undefined,
  person: PersonIdx
): Segment[] {
  const val = String(form == null ? '' : form);
  if (!val) return [];

  const c = (((code || '')[person] || '.') as CodeKind);
  const span = c === '.' ? null : (hl ? hl[person] : null);
  if (!span) return [{ text: val, kind: 'plain' }];

  // 越界一律夹紧 —— 数据里 h 的区间理应合法，但不给坏数据炸掉渲染的机会
  const s = Math.max(0, Math.min(span[0], val.length));
  const e = Math.max(s, Math.min(span[1], val.length));
  if (s === e) return [{ text: val, kind: 'plain' }];

  const out: Segment[] = [];
  if (s > 0) out.push({ text: val.slice(0, s), kind: 'plain' });
  out.push({ text: val.slice(s, e), kind: c });
  if (e < val.length) out.push({ text: val.slice(e), kind: 'plain' });
  return out;
}

/** 该形式是否有可着色的变化字母（UI 用来决定要不要走分段渲染） */
export function hasHighlight(
  code: string | undefined | null,
  hl: HlRow | null | undefined,
  person: PersonIdx
): boolean {
  const c = (code || '')[person] || '.';
  if (c === '.') return false;
  const span = hl ? hl[person] : null;
  return !!span && span[1] > span[0];
}

/** 把一个形式的所有段落拼回纯文本（测试与导出用） */
export const joinSegments = (segs: Segment[]): string =>
  segs.map((s) => s.text).join('');

/**
 * 把分段结果再按**空白**切成「一词一组」，每组仍是一串带颜色的分段。
 *
 * 用途：变位形式要在窄屏上折行，但**不能从词中间裂开**（用户明确要求）。
 * `segments()` 给出的段是「按变化字母」切的（如 me acuesto → ['me ', 'ue', 'sto']），
 * 一个段可能跨越空格，所以必须在这里再过一道：外层按空格切片，
 * 段内的颜色标记原样带走 —— 于是「词」成了新的渲染原子，
 * UI 层把每个词渲染成一个独立的 `<Text>` 交给 flex 容器，折行只会发生在词之间。
 *
 * 例：wordSegments(segments('me acuesto', 'sss..s', [[3,5],…], 0))
 *   → [[{text:'me', kind:'plain'}], [{text:'a',kind:'plain'},{text:'ue',kind:'s'},{text:'sto',kind:'plain'}]]
 *
 * 不变量：把结果拍平拼回去，必须与原形式**一字不差**（含空格的数量与位置在词数>1 时
 * 由渲染层用 `gap` 还原，所以这里只保证词序列与原文一致）。
 */
export function wordSegments(segs: Segment[]): Segment[][] {
  const words: Segment[][] = [];
  let cur: Segment[] = [];

  segs.forEach((seg) => {
    // 捕获组保留分隔符，才能知道「哪一步是空格」
    String(seg.text ?? '')
      .split(/(\s+)/)
      .forEach((piece) => {
        if (!piece) return;
        if (!piece.trim()) {
          if (cur.length) {
            words.push(cur);
            cur = [];
          }
          return;
        }
        cur.push({ text: piece, kind: seg.kind });
      });
  });

  if (cur.length) words.push(cur);
  return words;
}

/** `wordSegments()` 的逆操作：把「一词一组」拼回纯文本词序列 */
export const joinWords = (words: Segment[][]): string[] =>
  words.map((w) => w.map((s) => s.text).join(''));
