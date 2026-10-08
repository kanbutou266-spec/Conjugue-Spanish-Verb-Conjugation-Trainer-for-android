import { joinSegments, joinWords, segments, wordSegments } from '@/engine/highlight';
import verbsData from '@/data/verbs.json';

import type { HlRow, PersonIdx, TenseKey, Verb } from '@/data/types';
import type { Segment } from '@/engine/highlight';

const VERBS = (verbsData as unknown as { v: Verb[] }).v;
const byInf = (i: string): Verb => {
  const v = VERBS.find((x) => x.i === i);
  if (!v) throw new Error(`词表里没有 ${i}`);
  return v;
};

/** 把「一词一组」拍平成一段段，便于逐段断言 */
const flat = (w: Segment[][]): Segment[] => w.reduce<Segment[]>((a, x) => a.concat(x), []);

describe('wordSegments · 基本切分', () => {
  it('单个词原样返回一组', () => {
    const segs = segments('pienso', 'sss..s', null, 0);
    expect(wordSegments(segs)).toEqual([[{ text: 'pienso', kind: 'plain' }]]);
  });

  it('自复形式按空格切开，且**词内仍保留着色**', () => {
    const v = byInf('acostarse');
    const segs = segments('me acuesto', v.c?.p, v.h?.p, 0);
    // segments 给的是 ['me ', 'ue', 'sto']
    expect(joinSegments(segs)).toBe('me acuesto');

    const w = wordSegments(segs);
    expect(joinWords(w)).toEqual(['me', 'acuesto']);
    expect(w).toEqual([
      [{ text: 'me', kind: 'plain' }],
      [
        { text: 'ac', kind: 'plain' },
        { text: 'ue', kind: 's' },
        { text: 'sto', kind: 'plain' },
      ],
    ]);
  });

  it('三个词（复合时态 + 自复）切成三组，顺序与原文一致', () => {
    const w = wordSegments(segments('nos hubiéramos despertado', null, null, 3));
    expect(joinWords(w)).toEqual(['nos', 'hubiéramos', 'despertado']);
  });

  it('连续空格 / 首尾空格不会切出空组', () => {
    expect(joinWords(wordSegments(segments('  me   acuesto ', null, null, 0)))).toEqual([
      'me',
      'acuesto',
    ]);
  });

  it('空串 → 空数组', () => {
    expect(wordSegments([])).toEqual([]);
    expect(wordSegments(segments('', null, null, 0))).toEqual([]);
  });

  it('整词着色（ir 的 voy）也照样按词切', () => {
    const v = byInf('ir');
    const w = wordSegments(segments('voy', v.c?.p, v.h?.p, 0));
    expect(w).toEqual([[{ text: 'voy', kind: 'i' }]]);
  });
});

describe('wordSegments · 不变量（拿真实词表全量扫）', () => {
  it('拼回原文一字不差，且词序列等于按空白切分的结果', () => {
    const bad: string[] = [];
    let checked = 0;

    VERBS.forEach((v) => {
      (Object.keys(v.t) as TenseKey[]).forEach((k) => {
        const forms = String(v.t[k] || '').split('|');
        const code = (v.c || {})[k];
        const hl = (v.h || {})[k] as HlRow | undefined;
        for (let p = 0; p < 6; p++) {
          const form = forms[p];
          if (!form) continue;
          checked += 1;
          const segs = segments(form, code, hl, p as PersonIdx);
          const w = wordSegments(segs);

          const tag = `${v.i}.${k}[${p}]`;
          const want = form.split(/\s+/).filter(Boolean);
          // ① 段内容一字不差 —— 注意 wordSegments **有意丢掉空白**
          //    （词与词之间的空档由渲染层的 gap 还原，见 ConjText），
          //    所以这里比对的是"词接词"，不是原串
          if (joinSegments(flat(w)) !== want.join('')) {
            bad.push(`${tag}: 段内容被改动`);
          }
          // ② 词序列 = 按空白切分
          const got = joinWords(w);
          if (got.join('|') !== want.join('|')) {
            bad.push(`${tag}: 词序列 '${got.join('|')}' != '${want.join('|')}'`);
          }
          // ③ 每一组里不含空白（词内绝无断点）
          if (w.some((g) => g.some((s) => /\s/.test(s.text)))) {
            bad.push(`${tag}: 组内残留空白`);
          }
        }
      });
    });

    expect(checked).toBeGreaterThan(5000);
    expect(bad.slice(0, 8)).toEqual([]);
  });
});
