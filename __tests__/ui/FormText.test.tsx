import { render } from '@testing-library/react-native';
import React from 'react';

import type { HlRow, PersonIdx, TenseKey, Verb } from '@/data/types';
import { FormText, segmentColor } from '@/ui/components/FormText';
import { theme } from '@/ui/theme';
import verbsData from '@/data/verbs.json';

const VERBS = (verbsData as unknown as { v: Verb[] }).v;
const byInf = (i: string): Verb => {
  const v = VERBS.find((x) => x.i === i);
  if (!v) throw new Error(`词表里没有 ${i}`);
  return v;
};

/* ------------------------------------------------------------------ *
 * 把渲染出的 JSON 树扫成「文字 + 颜色」序列。
 * 之所以扫 JSON 而不是用 getByText：要验证的是**哪几个字母被上了什么色**，
 * 以及内层 Text 的 style 里**除了 color 没有别的键**（见 FormText 的硬规则 ①）。
 * ------------------------------------------------------------------ */
interface Painted {
  text: string;
  color?: string;
}

interface Scan {
  /** 全部可见文字（拼起来应等于原形式） */
  text: string;
  /** 所有叶子节点，按顺序 */
  leaves: Painted[];
  /** 被上色的叶子 */
  colored: Painted[];
  /** 树里出现过的全部 style 键（未去重） */
  styleKeys: string[];
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flattenStyle(s)), {});
  }
  if (typeof style === 'object') return { ...(style as Record<string, unknown>) };
  return {};
}

function scan(node: unknown, inherited: string | undefined, res: Scan): void {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string') {
    if (node) res.leaves.push({ text: node, color: inherited });
    return;
  }
  if (typeof node === 'number') {
    res.leaves.push({ text: String(node), color: inherited });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => scan(n, inherited, res));
    return;
  }
  const n = node as { props?: { style?: unknown }; children?: unknown };
  const st = flattenStyle(n.props?.style);
  const keys = Object.keys(st);
  if (keys.length) res.styleKeys.push(...keys);
  const color = (st.color as string | undefined) ?? inherited;
  const kids = n.children;
  if (Array.isArray(kids)) kids.forEach((k) => scan(k, color, res));
  else scan(kids, color, res);
}

/** 渲染并扫成可断言的结构（RNTL v14 的 render 是异步的） */
async function paint(element: React.ReactElement): Promise<Scan> {
  const { toJSON } = await render(element);
  const res: Scan = { text: '', leaves: [], colored: [], styleKeys: [] };
  scan(toJSON(), undefined, res);
  res.text = res.leaves.map((l) => l.text).join('');
  res.colored = res.leaves.filter((l) => l.color !== undefined);
  return res;
}

/* ------------------------------------------------------------------ */

describe('FormText · 已知着色样例', () => {
  it('pensar 现在时 yo：pienso → ie 染词干色', async () => {
    const v = byInf('pensar');
    const r = await paint(<FormText form="pienso" code={v.c?.p} hl={v.h?.p} person={0} />);
    expect(r.text).toBe('pienso');
    expect(r.colored).toEqual([{ text: 'ie', color: theme.color.fStem }]);
  });

  it('tener 现在时 yo：tengo → g 染不规则色', async () => {
    const v = byInf('tener');
    const r = await paint(<FormText form="tengo" code={v.c?.p} hl={v.h?.p} person={0} />);
    expect(r.text).toBe('tengo');
    expect(r.colored).toEqual([{ text: 'g', color: theme.color.fIrr }]);
  });

  it('practicar 简单过去 yo：practiqué → qu 染正字法色（不是 ué）', async () => {
    const v = byInf('practicar');
    const r = await paint(<FormText form="practiqué" code={v.c?.pr} hl={v.h?.pr} person={0} />);
    expect(r.text).toBe('practiqué');
    expect(r.colored).toEqual([{ text: 'qu', color: theme.color.fOrth }]);
  });

  it('ir 现在时 yo：voy → 整词染不规则色（区间覆盖全词）', async () => {
    const v = byInf('ir');
    const r = await paint(<FormText form="voy" code={v.c?.p} hl={v.h?.p} person={0} />);
    expect(r.text).toBe('voy');
    expect(r.colored).toEqual([{ text: 'voy', color: theme.color.fIrr }]);
  });

  it('acostarse 现在时 yo：me acuesto → ue 染词干色（自复形式含空格也算整串下标）', async () => {
    const v = byInf('acostarse');
    const r = await paint(<FormText form="me acuesto" code={v.c?.p} hl={v.h?.p} person={0} />);
    expect(r.text).toBe('me acuesto');
    expect(r.colored).toEqual([{ text: 'ue', color: theme.color.fStem }]);
  });

  it('规则形式整词同色（hablar 现在时 yo：hablo）', async () => {
    const v = byInf('hablar');
    const r = await paint(<FormText form="hablo" code={v.c?.p} hl={v.h?.p} person={0} />);
    expect(r.text).toBe('hablo');
    expect(r.colored).toEqual([]);
    expect(r.leaves).toHaveLength(1);
  });
});

describe('FormText · 不染色的入口', () => {
  it('plain 强制单色，哪怕数据里有区间', async () => {
    const v = byInf('pensar');
    const r = await paint(<FormText form="pienso" code={v.c?.p} hl={v.h?.p} person={0} plain />);
    expect(r.text).toBe('pienso');
    expect(r.colored).toEqual([]);
    expect(r.styleKeys).toEqual([]);
  });

  it('不给 code / hl 时整词单色', async () => {
    const r = await paint(<FormText form="pienso" />);
    expect(r.text).toBe('pienso');
    expect(r.colored).toEqual([]);
  });

  it('空串不炸，输出空', async () => {
    const r = await paint(<FormText form="" />);
    expect(r.text).toBe('');
  });

  it('form 为 null / undefined 时按空串处理（不炸）', async () => {
    const a = await paint(<FormText form={null as unknown as string} />);
    expect(a.text).toBe('');
    const b = await paint(<FormText form={undefined as unknown as string} />);
    expect(b.text).toBe('');
    // plain 分支也要走一遍空值兜底（这条是 `String(form ?? '')` 唯一的覆盖路径）
    const c = await paint(<FormText form={null as unknown as string} plain />);
    expect(c.text).toBe('');
  });
});

describe('FormText · 两条硬规则', () => {
  it('内层 Text 的 style 里**只有 color**（字号/字重/字距/底色一律不设）', async () => {
    const v = byInf('pensar');
    const r = await paint(<FormText form="pienso" code={v.c?.p} hl={v.h?.p} person={0} />);
    expect([...new Set(r.styleKeys)]).toEqual(['color']);
  });

  it('外层 style 只落在根节点上，内层不复制（否则占宽会变）', async () => {
    const v = byInf('pensar');
    const { toJSON } = await render(
      <FormText
        form="pienso"
        code={v.c?.p}
        hl={v.h?.p}
        person={0}
        style={{ fontSize: theme.font.xxl, fontWeight: '700' }}
      />
    );
    const root = toJSON() as unknown as { props: { style: Record<string, unknown> } };
    expect(root.props.style).toMatchObject({ fontSize: theme.font.xxl, fontWeight: '700' });

    // 扫全树：除了根自己的 fontSize/fontWeight，其余 style 键只允许是 color
    const scanRes: Scan = { text: '', leaves: [], colored: [], styleKeys: [] };
    scan(root, undefined, scanRes);
    const innerKeys = [...new Set(scanRes.styleKeys)].filter(
      (k) => k !== 'fontSize' && k !== 'fontWeight'
    );
    expect(innerKeys).toEqual(['color']);
  });

  it('颜色取值与网页 --f-* 一致', () => {
    expect(segmentColor('i')).toBe('#c0392b');
    expect(segmentColor('o')).toBe('#0b7a7a');
    expect(segmentColor('s')).toBe('#b26a00');
    expect(segmentColor('.')).toBeUndefined();
    expect(segmentColor('plain')).toBeUndefined();
  });
});

describe('FormText · 透传', () => {
  it('testID / accessibilityLabel / numberOfLines 透到根 Text', async () => {
    const { getByTestId } = await render(
      <FormText form="hablo" testID="ft" accessibilityLabel="说吧" numberOfLines={1} />
    );
    const node = getByTestId('ft');
    expect(node.props.accessibilityLabel).toBe('说吧');
    expect(node.props.numberOfLines).toBe(1);
  });

  it('不传 accessibilityLabel 时默认用 form 本身', async () => {
    const { getByTestId } = await render(<FormText form="hablo" testID="ft2" />);
    expect(getByTestId('ft2').props.accessibilityLabel).toBe('hablo');
  });
});

/* ------------------------------------------------------------------ *
 * 全量自检：拿真实 487 动词的每一个着色格子渲染一遍（抽样），
 * 验证「拼回原文一字不差 + 染色段恰为数据区间 + 只设 color」。
 * ------------------------------------------------------------------ */
interface Cell {
  inf: string;
  tense: TenseKey;
  person: PersonIdx;
  form: string;
  code: string;
  hl: HlRow;
  kind: 'i' | 'o' | 's';
  s: number;
  e: number;
}

function allCells(): { colored: Cell[]; combos: number; total: number } {
  const colored: Cell[] = [];
  let combos = 0;
  let total = 0;
  VERBS.forEach((v) => {
    const codes = v.c || {};
    (Object.keys(codes) as TenseKey[]).forEach((tense) => {
      const code = codes[tense];
      if (!code) return;
      combos += 1;
      const row = (v.h || {})[tense] as HlRow | undefined;
      const forms = (v.t[tense] || '').split('|');
      for (let p = 0; p < 6; p++) {
        total += 1;
        const person = p as PersonIdx;
        const k = code[person];
        const span = row ? row[person] : null;
        const form = forms[person];
        if (k === '.' || !span || !form) continue;
        colored.push({
          inf: v.i,
          tense,
          person,
          form,
          code,
          hl: row as HlRow,
          kind: k as 'i' | 'o' | 's',
          s: span[0],
          e: span[1],
        });
      }
    });
  });
  return { colored, combos, total };
}

describe('FormText · 全量数据自检', () => {
  const { colored, combos, total } = allCells();

  it('数据面：1286 个着色时态 / 7716 格 / 其中 5701 格真有着色', () => {
    expect(combos).toBe(1286);
    expect(total).toBe(7716);
    expect(colored).toHaveLength(5701);
  });

  it('三种着色类别都覆盖到', () => {
    const byKind = (k: string) => colored.filter((c) => c.kind === k).length;
    expect(byKind('i')).toBe(2165);
    expect(byKind('o')).toBe(1884);
    expect(byKind('s')).toBe(1652);
  });

  it('抽样渲染：拼回原文一致、染色段恰为数据区间、只设 color', async () => {
    const STEP = 29; // 5701 / 29 ≈ 197 次真实渲染
    const bad: string[] = [];
    let checked = 0;

    for (let i = 0; i < colored.length; i += STEP) {
      const c = colored[i];
      checked += 1;
      const tag = `${c.inf}.${c.tense}[${c.person}]`;
      const r = await paint(<FormText form={c.form} code={c.code} hl={c.hl} person={c.person} />);

      if (r.text !== c.form) bad.push(`${tag}: 拼回 '${r.text}' != '${c.form}'`);

      const want = c.form.slice(c.s, c.e);
      const got = r.colored.map((x) => x.text).join('');
      if (got !== want) bad.push(`${tag}: 染色 '${got}' != '${want}'`);

      const wantColor = segmentColor(c.kind);
      const colors = [...new Set(r.colored.map((x) => x.color))];
      if (colors.length !== 1 || colors[0] !== wantColor) {
        bad.push(`${tag}: 颜色 ${JSON.stringify(colors)} != ${wantColor}`);
      }

      const extra = [...new Set(r.styleKeys)].filter((k) => k !== 'color');
      if (extra.length) bad.push(`${tag}: 内层多设了 ${extra.join(',')}`);
    }

    expect(checked).toBeGreaterThan(150);
    expect(bad.slice(0, 10)).toEqual([]);
  });
});
