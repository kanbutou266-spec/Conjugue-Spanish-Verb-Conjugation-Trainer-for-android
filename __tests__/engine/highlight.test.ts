import verbsJson from '@/data/verbs.json';
import type { HlRow, PersonIdx, TenseKey, Verb } from '@/data/types';
import { codesOf, forms, hlOf } from '@/engine/pool';
import { hasHighlight, joinSegments, segments } from '@/engine/highlight';

/**
 * highlight.ts —— 变位形式着色。
 *
 * 网页版用 marked() 拼 `<i class="hl">`，颜色实际来自 CSS `.w-* .hl`；
 * RN 版改成返回分段数组，颜色由 FormText 按 kind 映射。
 * 这里断言的就是「哪几个字母被染成哪一类」。
 */

const VERBS = (verbsJson as unknown as { v: Verb[] }).v;
const byInf = (w: string): Verb => VERBS.find((x) => x.i === w)!;

/** 走真实数据取某个形式的分段 */
const seg = (w: string, k: TenseKey, person: PersonIdx) => {
  const v = byInf(w);
  const f = forms(v, k)!;
  return segments(f[person], codesOf(v, k), hlOf(v, k), person);
};

describe('segments —— 已知着色样例', () => {
  it('pensar 现在时 yo：pienso → 染 ie（词干变化）', () => {
    expect(seg('pensar', 'p', 0)).toEqual([
      { text: 'p', kind: 'plain' },
      { text: 'ie', kind: 's' },
      { text: 'nso', kind: 'plain' },
    ]);
  });

  it('pensar 现在时 tú：piensas → 同样染 ie', () => {
    expect(seg('pensar', 'p', 1)).toEqual([
      { text: 'p', kind: 'plain' },
      { text: 'ie', kind: 's' },
      { text: 'nsas', kind: 'plain' },
    ]);
  });

  it('tener 现在时 tú：tienes → 染 ie', () => {
    expect(seg('tener', 'p', 1)).toEqual([
      { text: 't', kind: 'plain' },
      { text: 'ie', kind: 's' },
      { text: 'nes', kind: 'plain' },
    ]);
  });

  it('practicar 简单过去时 yo：practiqué → 染 qu（正字法拼写变化）', () => {
    // c → qu 才是不规则之处，é 上的重音属于常规拼写，不染色
    expect(seg('practicar', 'pr', 0)).toEqual([
      { text: 'practi', kind: 'plain' },
      { text: 'qu', kind: 'o' },
      { text: 'é', kind: 'plain' },
    ]);
  });

  it('tener 现在时 yo：tengo → 只染 g（其他不规则）', () => {
    expect(seg('tener', 'p', 0)).toEqual([
      { text: 'ten', kind: 'plain' },
      { text: 'g', kind: 'i' },
      { text: 'o', kind: 'plain' },
    ]);
  });

  it('ser 现在时 yo：soy → 只染 y', () => {
    expect(seg('ser', 'p', 0)).toEqual([
      { text: 'so', kind: 'plain' },
      { text: 'y', kind: 'i' },
    ]);
  });

  it('ir 现在时 yo：voy → 整词都变了', () => {
    expect(seg('ir', 'p', 0)).toEqual([{ text: 'voy', kind: 'i' }]);
  });

  it('自复动词带空格也算得对：me acuesto → 染 ue', () => {
    expect(seg('acostarse', 'p', 0)).toEqual([
      { text: 'me ac', kind: 'plain' },
      { text: 'ue', kind: 's' },
      { text: 'sto', kind: 'plain' },
    ]);
  });

  it('时态里规则的那一格不染色：pensar 现在时 nosotros', () => {
    expect(seg('pensar', 'p', 3)).toEqual([{ text: 'pensamos', kind: 'plain' }]);
  });

  it('完全规则的动词一律不染色', () => {
    const v = byInf('hablar');
    ['p', 'pr', 'i', 'f', 'sp', 'ia'].forEach((k) => {
      const f = forms(v, k as TenseKey)!;
      for (let i = 0; i < 6; i++) {
        if (!f[i] || !f[i].trim()) continue; // 命令式没有 yo 这一格
        expect(seg('hablar', k as TenseKey, i as PersonIdx)).toEqual([
          { text: f[i], kind: 'plain' },
        ]);
      }
    });
  });
});

describe('segments —— 边界与容错', () => {
  it('空形式返回空数组', () => {
    expect(segments('', 'sss..s', null, 0)).toEqual([]);
  });

  it('没有着色码时整词普通色', () => {
    expect(segments('hablo', undefined, null, 0)).toEqual([{ text: 'hablo', kind: 'plain' }]);
    expect(segments('hablo', '', null, 0)).toEqual([{ text: 'hablo', kind: 'plain' }]);
  });

  it('该人称是规则位时整词普通色', () => {
    expect(segments('hablo', 'sss...', null, 0)).toEqual([{ text: 'hablo', kind: 'plain' }]);
  });

  it('有码但缺区间时整词普通色 —— 颜色只在 .hl 上，没有区间就没有颜色', () => {
    expect(segments('hablo', 'sss...', null, 0)).toEqual([{ text: 'hablo', kind: 'plain' }]);
    const none: HlRow = [null, null, null, null, null, null];
    expect(segments('hablo', 'sss...', none, 0)).toEqual([
      { text: 'hablo', kind: 'plain' },
    ]);
  });

  it('起止相等的空区间不染色', () => {
    const hl: HlRow = [[2, 2], null, null, null, null, null];
    expect(segments('hablo', 'sss...', hl, 0)).toEqual([{ text: 'hablo', kind: 'plain' }]);
  });

  it('越界区间被夹紧，不抛错也不丢字', () => {
    const hl: HlRow = [[2, 999], null, null, null, null, null];
    expect(joinSegments(segments('hablo', 'sss...', hl, 0))).toBe('hablo');
    expect(segments('hablo', 'sss...', hl, 0)).toEqual([
      { text: 'ha', kind: 'plain' },
      { text: 'blo', kind: 's' },
    ]);
  });

  it('区间覆盖整词时只产出一段', () => {
    const hl: HlRow = [[0, 3], null, null, null, null, null];
    expect(segments('voy', 'iii...', hl, 0)).toEqual([{ text: 'voy', kind: 'i' }]);
  });

  it('非字符串输入不抛错', () => {
    expect(() => segments(null as unknown as string, 'sss...', null, 0)).not.toThrow();
    expect(segments(null as unknown as string, 'sss...', null, 0)).toEqual([]);
  });
});

describe('hasHighlight', () => {
  it('有码有区间为真', () => {
    const v = byInf('pensar');
    expect(hasHighlight(codesOf(v, 'p'), hlOf(v, 'p'), 0)).toBe(true);
  });

  it('规则位为假', () => {
    const v = byInf('pensar');
    expect(hasHighlight(codesOf(v, 'p'), hlOf(v, 'p'), 3)).toBe(false);
  });

  it('没有着色数据为假', () => {
    const v = byInf('hablar');
    expect(hasHighlight(codesOf(v, 'p'), hlOf(v, 'p'), 0)).toBe(false);
  });
});

describe('全量自检：397 个着色时态 × 6 人称', () => {
  it('分段拼回原文一字不差，且变化段恰好等于数据给出的区间', () => {
    const bad: string[] = [];
    let checked = 0;

    VERBS.forEach((v) => {
      Object.keys(v.c || {}).forEach((k) => {
        const key = k as TenseKey;
        const f = forms(v, key);
        if (!f) {
          bad.push(`${v.i}.${key}: 取不到 6 个人称形式`);
          return;
        }
        const code = codesOf(v, key);
        const hl = hlOf(v, key);
        for (let i = 0; i < 6; i++) {
          const segs = segments(f[i], code, hl, i as PersonIdx);
          checked++;

          if (joinSegments(segs) !== f[i]) {
            bad.push(`${v.i}.${key}[${i}] 拼接后 "${joinSegments(segs)}" != "${f[i]}"`);
            continue;
          }

          const changed = segs.filter((s) => s.kind !== 'plain');
          const ch = code[i];

          if (ch === '.') {
            if (changed.length) bad.push(`${v.i}.${key}[${i}] 规则位却染了色`);
            continue;
          }
          if (changed.length !== 1) {
            bad.push(`${v.i}.${key}[${i}] 变化段数量 ${changed.length} != 1`);
            continue;
          }
          if (changed[0].kind !== ch) {
            bad.push(`${v.i}.${key}[${i}] 染色类别 ${changed[0].kind} != ${ch}`);
          }
          const sp = hl ? hl[i] : null;
          if (!sp) {
            bad.push(`${v.i}.${key}[${i}] 有码却无区间`);
            continue;
          }
          if (changed[0].text !== f[i].slice(sp[0], sp[1])) {
            bad.push(`${v.i}.${key}[${i}] 染色文字 "${changed[0].text}" != "${f[i].slice(sp[0], sp[1])}"`);
          }
        }
      });
    });

    expect(bad).toEqual([]);
    expect(checked).toBeGreaterThan(2000);
  });
});
