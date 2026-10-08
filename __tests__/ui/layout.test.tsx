import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { useState } from 'react';
import { PixelRatio, StyleSheet } from 'react-native';

import { MODES } from '@/data/modes';
import { ALL_KEYS } from '@/data/levels';
import { theme } from '@/ui/theme';
import { useSettingsStore } from '@/store/settings';
import { useCustomStore } from '@/store/custom';
import { ConjText } from '@/ui/components/ConjText';
import { MODE_BTN, ModeSelector, modeBtnColors } from '@/ui/components/ModeSelector';
import { PersonGrid } from '@/ui/components/PersonGrid';
import {
  CARD_GAP,
  CARD_PEEK,
  CAROUSEL_FADE,
  PresetCarousel,
  SCROLL_SETTLE_MS,
  carouselGeom,
} from '@/ui/components/PresetCarousel';
import { TenseGrid } from '@/ui/components/TenseGrid';
import verbsData from '@/data/verbs.json';

import type { HlRow, PersonIdx, TenseKey, Verb } from '@/data/types';

const VERBS = (verbsData as unknown as { v: Verb[] }).v;
const byInf = (i: string): Verb => {
  const v = VERBS.find((x) => x.i === i);
  if (!v) throw new Error(`词表里没有 ${i}`);
  return v;
};

/**
 * 语言固定成中文，免得断言依赖系统语言（jest-expo 给的是 en）。
 *
 * 放在 `beforeAll` 而不是 `beforeEach`：这两个动作会写 zustand store、
 * 进而触发一次 React 更新；RNTL v14 的 `render()` / 清理都是异步的，
 * 在测试之间写 store 会和它的 act 作用域叠在一起（表现为后一个用例
 * "找不到 testID"），一次性设好就没这问题。用例本身不改 store。
 */
beforeAll(() => {
  useSettingsStore.getState().setLang('zh', 'manual');
  useCustomStore.getState().resetAll();
});

function flat(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style) || {}) as Record<string, unknown>;
}
const styleOf = (el: { props: { style?: unknown } }) => flat(el.props.style);

/**
 * 取节点里所有文本 —— 要同时认两种形态：
 *   · host 节点（`toJSON()` 出来的）用 `children`
 *   · React 元素（从父节点 `props.children` 拿到的手写 JSX）用 `props.children`
 */
function texts(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n === null || n === undefined || typeof n === 'boolean') return;
    if (typeof n === 'string' || typeof n === 'number') {
      out.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.children !== undefined) walk(n.children);
    if (n.props && n.props.children !== undefined) walk(n.props.children);
  };
  walk(node);
  return out;
}

/**
 * 扫出一棵树里的「文字 + 颜色」叶子，用来断言**哪几个字母被上了什么色**。
 * 不能用 `JSON.stringify(元素)` —— React 元素的 `_owner` 指向 Fiber，
 * 里面有循环引用，`JSON.stringify` 会直接抛。
 */
interface Painted {
  text: string;
  color?: string;
}
function painted(node: unknown): Painted[] {
  const out: Painted[] = [];
  const walk = (n: any, inherited: string | undefined) => {
    if (n === null || n === undefined || typeof n === 'boolean') return;
    if (typeof n === 'string' || typeof n === 'number') {
      out.push({ text: String(n), color: inherited });
      return;
    }
    if (Array.isArray(n)) {
      n.forEach((x) => walk(x, inherited));
      return;
    }
    const props = n.props ?? n;
    const st = flat(props.style);
    const color = (st.color as string | undefined) ?? inherited;
    const kids = props.children;
    if (Array.isArray(kids)) kids.forEach((k) => walk(k, color));
    else walk(kids, color);
  };
  walk(node, undefined);
  return out;
}

/** 只取被染成指定色的那几段文字 */
const coloredText = (node: unknown, color: string): string =>
  painted(node)
    .filter((p) => p.color === color)
    .map((p) => p.text)
    .join('');

/** ConjText 的根 View 里，每个「词」是一个 Text 子节点 */
interface WordNode {
  props: { style?: unknown; numberOfLines?: number; children?: unknown };
}
function wordsOf(el: { props: { children?: unknown } }): WordNode[] {
  const kids = el.props.children;
  return (Array.isArray(kids) ? kids : [kids]).filter(Boolean) as WordNode[];
}

/* ================================================================== *
 * ModeSelector —— 用户 2026-10-02 的两条设计要求之一
 * ================================================================== */
describe('ModeSelector · 四个按钮排一行、图标在字上方、字更小', () => {
  it('四个按钮恒排一行（容器 row + 每格 flex:1）', async () => {
    const { getByTestId } = await render(<ModeSelector value="produce" onChange={() => {}} testID="m" />);
    expect(styleOf(getByTestId('m')).flexDirection).toBe('row');
    MODES.forEach((m) => {
      expect(styleOf(getByTestId(`m-${m.k}`)).flex).toBe(1);
    });
  });

  it('图标在字**上方**：按钮是 column 布局、内容居中', async () => {
    const { getByTestId } = await render(<ModeSelector value="produce" onChange={() => {}} testID="m" />);
    const s = styleOf(getByTestId('m-produce'));
    expect(s.flexDirection).toBe('column');
    expect(s.alignItems).toBe('center');
    expect(s.justifyContent).toBe('center');
  });

  it('文字用短名（辨认/复现/转换/平移），且字号比 chip 更小', async () => {
    const { getByText, queryByText, getByTestId } = await render(
      <ModeSelector value="produce" onChange={() => {}} testID="m" />
    );
    ['辨认', '复现', '转换', '平移'].forEach((s) => expect(getByText(s)).toBeTruthy());
    expect(queryByText('辨认模式')).toBeNull(); // 全名让给按钮下方那行
    expect(flat(getByText('复现').props.style).fontSize).toBe(MODE_BTN.label);
    expect(MODE_BTN.label).toBeLessThan(13); // 网页 .chip.sm 是 13
    expect(getByTestId('m-produce')).toBeTruthy();
  });

  it('无障碍上是单选组，每个按钮带完整模式名与规则说明', async () => {
    const { getByTestId } = await render(<ModeSelector value="shift" onChange={() => {}} testID="m" />);
    expect(getByTestId('m').props.accessibilityRole).toBe('radiogroup');
    expect(getByTestId('m-shift').props.accessibilityRole).toBe('radio');
    expect(getByTestId('m-shift').props.accessibilityLabel).toBe('转换模式');
    expect(getByTestId('m-shift').props.accessibilityHint).toContain('时态');
    expect(getByTestId('m-shift').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('m-produce').props.accessibilityState).toEqual({ selected: false });
  });

  it('选中态：主色铺满 + 白字白图标 + 字重 700', async () => {
    const { getByTestId, getByText } = await render(
      <ModeSelector value="produce" onChange={() => {}} testID="m" />
    );
    const s = styleOf(getByTestId('m-produce'));
    expect(s.backgroundColor).toBe(theme.color.accent);
    expect(s.borderColor).toBe(theme.color.accent);
    expect(flat(getByText('复现').props.style).color).toBe('#ffffff');
    expect(flat(getByText('复现').props.style).fontWeight).toBe('700');

    const off = styleOf(getByTestId('m-recognize'));
    expect(off.backgroundColor).toBe('#ffffff');
    expect(off.borderColor).toBe(theme.color.line);
    expect(flat(getByText('辨认').props.style).color).toBe(theme.color.ink);
  });

  it('点别的模式回调该键；点当前选中的不回调', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<ModeSelector value="produce" onChange={onChange} testID="m" />);
    await fireEvent.press(getByTestId('m-recognize'));
    expect(onChange).toHaveBeenCalledWith('recognize');
    onChange.mockClear();
    await fireEvent.press(getByTestId('m-produce'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('按下态查表：selected > pressed > 默认（RNTL 驱动不了 pressIn，只能测纯函数）', () => {
    expect(modeBtnColors(true).bg).toBe(theme.color.accent);
    expect(modeBtnColors(true, true).bg).toBe(theme.color.accent); // 选中时按下不变色
    expect(modeBtnColors(false, true).bg).toBe(theme.press.soft);
    expect(modeBtnColors(false, true).border).toBe(theme.press.softBorder);
    expect(modeBtnColors(false, false).bg).toBe('#ffffff');
    expect(modeBtnColors(false, false).weight).toBe('600');
    expect(modeBtnColors(true, false).weight).toBe('700');
  });

  it('四个按钮的高度下限一致（一排不会忽高忽低）', async () => {
    const { getByTestId } = await render(<ModeSelector value="produce" onChange={() => {}} testID="m" />);
    MODES.forEach((m) => {
      expect(styleOf(getByTestId(`m-${m.k}`)).minHeight).toBe(MODE_BTN.minHeight);
    });
  });
});

/* ================================================================== *
 * ConjText —— 用户 2026-10-02 的两条设计要求之二
 * ================================================================== */
describe('ConjText · 不在词中间断行', () => {
  it('单个词只有一个 Text 节点，且强制单行', async () => {
    const { getByTestId } = await render(<ConjText form="pienso" width={300} testID="c" />);
    const ws = wordsOf(getByTestId('c'));
    expect(ws).toHaveLength(1);
    expect(ws[0].props.numberOfLines).toBe(1);
    expect(texts(ws[0]).join('')).toBe('pienso');
  });

  it('两个词 → 两个独立 Text 节点（折行只可能发生在它们之间）', async () => {
    const { getByTestId } = await render(<ConjText form="me acuesto" width={300} testID="c" />);
    const ws = wordsOf(getByTestId('c'));
    expect(ws).toHaveLength(2);
    expect(ws.map((w) => texts(w).join(''))).toEqual(['me', 'acuesto']);
    expect(ws.every((w) => w.props.numberOfLines === 1)).toBe(true);
  });

  it('三个词（复合 + 自复）→ 三个节点，顺序与原文一致', async () => {
    const { getByTestId } = await render(
      <ConjText form="nos hubiéramos despertado" width={220} testID="c" />
    );
    const ws = wordsOf(getByTestId('c'));
    expect(ws.map((w) => texts(w).join(''))).toEqual(['nos', 'hubiéramos', 'despertado']);
  });

  it('词与词之间靠容器 gap 隔开（不是塞一个空格进 Text）', async () => {
    const { getByTestId } = await render(<ConjText form="me acuesto" width={300} testID="c" />);
    expect(typeof styleOf(getByTestId('c')).columnGap).toBe('number');
    wordsOf(getByTestId('c')).forEach((w) => {
      expect(texts(w).join('')).not.toMatch(/\s/);
    });
  });

  it('根容器 alignSelf: stretch —— 这样量到的宽度才是真正可用的宽度', async () => {
    const { getByTestId } = await render(<ConjText form="hablo" width={300} testID="c" />);
    expect(styleOf(getByTestId('c')).alignSelf).toBe('stretch');
  });
});

describe('ConjText · 长词缩字号', () => {
  const LONG = 'desarrollaríamos'; // 数据里最长的词（16 字）

  // 这一组测的是**几何逻辑**（容器宽 ↔ 字号），与系统「字体大小」无关。
  // jest 环境里 PixelRatio.getFontScale() 默认返回 2（RN mock 的 window.fontScale），
  // 不钉成 1 的话，所有按 292/300px 容器校准的断言都会被放大两倍而误报。
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('容器够宽 → 用基准字号', async () => {
    const { getByTestId } = await render(
      <ConjText form={LONG} width={600} baseSize={34} minSize={20} testID="c" />
    );
    expect(flat(wordsOf(getByTestId('c'))[0].props.style).fontSize).toBe(34);
  });

  it('容器太窄 → 缩字号，且不小于下限', async () => {
    const { getByTestId } = await render(
      <ConjText form={LONG} width={200} baseSize={34} minSize={20} testID="c" />
    );
    const size = flat(wordsOf(getByTestId('c'))[0].props.style).fontSize as number;
    expect(size).toBeLessThan(34);
    expect(size).toBeGreaterThanOrEqual(20);
  });

  it('缩过字号的词再收一点字距（网页 .pcell b.sm/.xs 同款）', async () => {
    const narrow = await render(<ConjText form={LONG} width={200} baseSize={34} minSize={20} testID="c" />);
    expect(flat(wordsOf(narrow.getByTestId('c'))[0].props.style).letterSpacing).toBe(-0.3);
    const wide = await render(<ConjText form={LONG} width={600} baseSize={34} minSize={20} testID="c" />);
    expect(flat(wordsOf(wide.getByTestId('c'))[0].props.style).letterSpacing).toBeUndefined();
  });

  it('整串长但每个词都短 → 不缩字号（排两行即可）', async () => {
    const { getByTestId } = await render(
      <ConjText form="nos hubiéramos despertado" width={220} baseSize={34} minSize={20} testID="c" />
    );
    wordsOf(getByTestId('c')).forEach((w) => {
      expect(flat(w.props.style).fontSize).toBe(34);
    });
  });

  it('没量到宽度时（首帧）按兜底宽度保守缩字，绝不放大也不溢出', async () => {
    const { getByTestId } = await render(<ConjText form={LONG} baseSize={34} minSize={20} testID="c" />);
    // 10-05 起 avail<=0 走 FALLBACK_AVAIL=320：16 字 @34pt 估宽 299 ≤ 320 → 仍是基准；
    // 但**不允许**比基准更大（那会溢出），也不允许低于下限（那会小到看不清）。
    const size = flat(wordsOf(getByTestId('c'))[0].props.style).fontSize as number;
    expect(size).toBeLessThanOrEqual(34);
    expect(size).toBeGreaterThanOrEqual(20);
  });
});

describe('ConjText · 着色', () => {
  it('自复形式的词干变化仍染在正确的字母上（跨词切分不丢色）', async () => {
    const v = byInf('acostarse');
    const { getByTestId } = await render(
      <ConjText form="me acuesto" code={v.c?.p} hl={v.h?.p} person={0} width={300} testID="c" />
    );
    const ws = wordsOf(getByTestId('c'));
    // 第一个词「me」没有任何染色
    expect(coloredText(ws[0], theme.color.fStem)).toBe('');
    // 第二个词里 'ue' 被染成词干色，且仍在词内（没有因为切分而丢色或错位）
    expect(coloredText(ws[1], theme.color.fStem)).toBe('ue');
    expect(texts(ws[1]).join('')).toBe('acuesto');
  });

  it('plain 强制单色', async () => {
    const v = byInf('acostarse');
    const { getByTestId } = await render(
      <ConjText form="me acuesto" code={v.c?.p} hl={v.h?.p} person={0} plain width={300} testID="c" />
    );
    const leaves = painted(getByTestId('c'));
    expect(leaves.map((p) => p.text).join('')).toBe('meacuesto');
    expect(leaves.every((p) => p.color === theme.color.ink)).toBe(true);
  });

  it('accessibilityLabel 默认用完整形式（逐词渲染对外仍读成一个词串）', async () => {
    const { getByTestId } = await render(<ConjText form="me acuesto" width={300} testID="c" />);
    expect(getByTestId('c').props.accessibilityLabel).toBe('me acuesto');
  });
});

/* ================================================================== *
 * PersonGrid
 * ================================================================== */
describe('PersonGrid · 3×2', () => {
  const FORMS = ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'];

  it('六个格子都在，两行三列', async () => {
    const { getByTestId } = await render(<PersonGrid forms={FORMS} tense="p" testID="g" />);
    for (let i = 0; i < 6; i++) expect(getByTestId(`g-${i}`)).toBeTruthy();
    const grid = getByTestId('g');
    expect(styleOf(grid).gap).toBe(4);
  });

  it('本体形式逐格渲染，人称标签写在格子里', async () => {
    const { getByTestId } = await render(<PersonGrid forms={FORMS} tense="p" testID="g" />);
    expect(texts(getByTestId('g-3')).join('')).toContain('nosotros');
    expect(texts(getByTestId('g-3')).join('')).toContain('hablamos');
  });

  it('active 那一格用主色浅底标出来（网页 .pcell.hi）', async () => {
    const { getByTestId } = await render(<PersonGrid forms={FORMS} tense="p" active={2} testID="g" />);
    const s = styleOf(getByTestId('g-2'));
    expect(s.backgroundColor).toBe(theme.color.accentSoft);
    expect(s.borderColor).toBe(theme.color.accent);
    expect(styleOf(getByTestId('g-0')).backgroundColor).toBe('#ffffff');
  });

  it('该时态不存在的人称（命令式的 yo）→ 破折号 + 降透明度', async () => {
    const v = byInf('hablar');
    const forms = String(v.t.ia).split('|');
    const { getByTestId } = await render(<PersonGrid forms={forms} tense="ia" testID="g" />);
    const cell = getByTestId('g-0');
    expect(texts(cell).join('')).toContain('—');
    expect(styleOf(cell).opacity).toBe(0.45);
  });

  it('给了 onPress 就能点，回调带人称下标', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <PersonGrid forms={FORMS} tense="p" onPress={onPress} testID="g" />
    );
    await fireEvent.press(getByTestId('g-4'));
    expect(onPress).toHaveBeenCalledWith(4);
    expect(getByTestId('g-4').props.accessibilityRole).toBe('button');
  });

  it('不给 onPress 就是只读（没有点击处理）', async () => {
    const { getByTestId } = await render(<PersonGrid forms={FORMS} tense="p" testID="g" />);
    expect(getByTestId('g-2').props.onPress).toBeUndefined();
  });

  it('着色按 person 逐个取（6 格各自读自己那一位）', async () => {
    const v = byInf('tener');
    const forms = String(v.t.p).split('|');
    const { getByTestId } = await render(
      <PersonGrid forms={forms} code={v.c?.p} hl={v.h?.p as HlRow} tense="p" testID="g" />
    );
    // tengo（yo）里的 g 是不规则色
    expect(coloredText(getByTestId('g-f0'), theme.color.fIrr)).toBe('g');
    // 别的格各自读自己那一位：hablan 是规则形式，没有染色
    expect(coloredText(getByTestId('g-f5'), theme.color.fIrr)).toBe('');
  });
});

/* ================================================================== *
 * TenseGrid
 * ================================================================== */
describe('TenseGrid · 四个语式分组卡', () => {
  it('四张分组卡都在', async () => {
    const { getByTestId } = await render(<TenseGrid selected={['p']} onToggle={() => {}} testID="tg" />);
    ['ind', 'cond', 'sub', 'imp'].forEach((g) => expect(getByTestId(`tg-${g}`)).toBeTruthy());
  });

  it('默认列出全部 15 个时态', async () => {
    const { getByTestId } = await render(<TenseGrid selected={[]} onToggle={() => {}} testID="tg" />);
    const keys = [...'p pp pr i pq f fp c cp sp spt si sq ia in'.split(' ')];
    keys.forEach((k) => expect(getByTestId(`tg-${k}`)).toBeTruthy());
  });

  it('only 过滤：没被列到的分组整张卡消失', async () => {
    const { getByTestId, queryByTestId } = await render(
      <TenseGrid selected={['p']} onToggle={() => {}} only={['p', 'pr']} testID="tg" />
    );
    expect(getByTestId('tg-p')).toBeTruthy();
    expect(getByTestId('tg-pr')).toBeTruthy();
    expect(queryByTestId('tg-i')).toBeNull();
    expect(queryByTestId('tg-sub')).toBeNull();
  });

  it('选中的 chip 用该语式的主色铺满', async () => {
    const { getByTestId } = await render(
      <TenseGrid selected={['sp']} onToggle={() => {}} testID="tg" />
    );
    expect(styleOf(getByTestId('tg-sp')).backgroundColor).toBe(theme.mood.sub.main);
    expect(styleOf(getByTestId('tg-p')).backgroundColor).toBe(theme.mood.ind.soft);
  });

  it('点 chip 回调时态键', async () => {
    const onToggle = jest.fn();
    const { getByTestId } = await render(<TenseGrid selected={[]} onToggle={onToggle} testID="tg" />);
    await fireEvent.press(getByTestId('tg-i'));
    expect(onToggle).toHaveBeenCalledWith('i');
  });

  it('分组卡左色条用该语式主题色', async () => {
    const { getByTestId } = await render(<TenseGrid selected={[]} onToggle={() => {}} testID="tg" />);
    expect(styleOf(getByTestId('tg-sub')).borderLeftColor).toBe(theme.mood.sub.main);
    expect(styleOf(getByTestId('tg-imp')).borderLeftColor).toBe(theme.mood.imp.main);
  });

  it('给了 onGroupAll / onGroupNone 才出现「全选 / 清空」，回调带分组键', async () => {
    const onAll = jest.fn();
    const onNone = jest.fn();
    const a = await render(<TenseGrid selected={[]} onToggle={() => {}} testID="tg" />);
    expect(a.queryByTestId('tg-ind-all')).toBeNull();

    const b = await render(
      <TenseGrid selected={[]} onToggle={() => {}} onGroupAll={onAll} onGroupNone={onNone} testID="tg" />
    );
    await fireEvent.press(b.getByTestId('tg-ind-all'));
    await fireEvent.press(b.getByTestId('tg-ind-none'));
    expect(onAll).toHaveBeenCalledWith('ind');
    expect(onNone).toHaveBeenCalledWith('ind');
  });

  it('组标题右侧的计数显示「已选 / 总数」', async () => {
    const { getByTestId } = await render(
      <TenseGrid selected={['p', 'pp']} onToggle={() => {}} testID="tg" />
    );
    expect(texts(getByTestId('tg-ind')).join('')).toContain('2/7');
  });

  /*
   * 回归：用户 2026-10-05 ——「英语模式 custom 里 simple / compound 词内换行，很丑」。
   * 根因是 `th` 被写成固定 `width:26`，装不下英文 "compound"（8 字符）；
   * 网页是 `min-width:26px`（可被内容撑开）。这里断言**不能有固定 width**
   * 且必须是 `minWidth`，否则又会退回折行。
   */
  it('行首标签用 minWidth 而非固定 width（英文 compound 不折行）', async () => {
    const { getByTestId, toJSON } = await render(
      <TenseGrid selected={[]} onToggle={() => {}} testID="tg" />
    );
    expect(getByTestId('tg-ind')).toBeTruthy();

    const tree = JSON.parse(JSON.stringify(toJSON()));
    const ths: Record<string, unknown>[] = [];
    const walk = (n: any) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      const s = flat(n.props?.style);
      if (s.minWidth === 26) ths.push(s);
      (n.children || []).forEach(walk);
    };
    walk(tree);

    expect(ths.length).toBeGreaterThan(0);
    ths.forEach((s) => {
      expect(s.width).toBeUndefined();
      expect(s.minWidth).toBe(26);
    });
  });
});

/* ================================================================== *
 * PresetCarousel
 * ================================================================== */
describe('PresetCarousel · 几何纯函数', () => {
  it('卡宽 = 可用宽度 − 左右各露出的邻卡；步进 = 卡宽 + 间隙', () => {
    const g = carouselGeom(360);
    expect(g.cardW).toBe(360 - CARD_PEEK * 2);
    expect(g.step).toBe(g.cardW + CARD_GAP);
    // 卡宽 + 左右露头正好铺满可用宽度 —— 不溢出容器
    expect(g.cardW + g.peek * 2).toBe(360);
  });

  it('窄到离谱的屏也不会算出 0 / 负数宽度', () => {
    expect(carouselGeom(80).cardW).toBe(120);
    expect(carouselGeom(0).cardW).toBe(120);
  });

  it('各种宽度下都装得进容器，且吸附步长 = 真实步进', () => {
    [320, 360, 412, 700].forEach((w) => {
      const g = carouselGeom(w);
      expect(g.cardW + g.peek * 2).toBeLessThanOrEqual(w);
      // 步长算错一点，滑到后面就越偏越远（吸附点跟卡片对不上）
      expect(g.step).toBe(g.cardW + g.gap);
    });
  });
});

/** 从渲染出来的 ScrollView 上读吸附步长 —— 测试不用猜窗口宽 */
const stepOf = (el: { props: { snapToInterval?: number } }): number =>
  el.props.snapToInterval as number;

/**
 * 模拟「滑到某个位置后停住」。
 *
 * ⚠️ 组件**不听**松手事件（真机上 `onScrollEndDrag` 的 contentOffset 报过假值 0），
 * 落位只认 `onScroll` + 120ms 静默 —— 所以这里喂 `scroll` 事件，再等防抖计时器走完。
 */
async function swipe(el: unknown, x: number) {
  await fireEvent(el as never, 'scroll', {
    nativeEvent: { contentOffset: { x, y: 0 } },
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, SCROLL_SETTLE_MS + 40));
  });
}

/** 详情栏里那一串键值文字（节点传进来，别传查询函数） */
const detailOf = (el: unknown): string => texts(el).join(' ');

describe('PresetCarousel · 横向滑动换档（整卡吸附）', () => {
  it('6 张卡全在轨道上、宽度一致；高度不写死（等高交给行内 stretch）', async () => {
    const { getByTestId } = await render(<Harness />);
    const w = styleOf(getByTestId('c-card-starter')).width;
    expect(typeof w).toBe('number');
    ALL_KEYS.forEach((k) => {
      const st = styleOf(getByTestId(`c-card-${k}`));
      // 同一个基准宽度 → 吸附点才对齐得了
      expect(st.width).toBe(w);
      // ⚠️ 不许写死 height：内容稍长就会被裁掉；等高靠 contentContainer 的
      //    alignItems:'stretch' 把每张卡拉到行高
      expect(st.height).toBeUndefined();
      expect(st.minHeight).toBeGreaterThanOrEqual(120);
    });
    expect(ALL_KEYS).toHaveLength(6);
  });

  it('吸附四件套齐了：snapToInterval / 关掉区间惯性 / fast / 横向', async () => {
    const { getByTestId } = await render(<Harness />);
    const p = getByTestId('c-scroll').props;
    expect(p.horizontal).toBe(true);
    expect(p.snapToInterval).toBeGreaterThan(0);
    // 少一个就会退回"要么没动、要么一下跳两档"（上一版被投诉的老毛病）
    expect(p.disableIntervalMomentum).toBe(true);
    expect(p.decelerationRate).toBe('fast');
  });

  it('往右滑一档 → 选中下一档', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <PresetCarousel activeKey="starter" onSelect={onSelect} testID="c" />
    );
    await swipe(getByTestId('c-scroll'), stepOf(getByTestId('c-scroll')));
    expect(onSelect).toHaveBeenCalledWith('build');
  });

  it('往左滑一档 → 选中上一档', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <PresetCarousel activeKey="build" onSelect={onSelect} testID="c" />
    );
    await swipe(getByTestId('c-scroll'), 0);
    expect(onSelect).toHaveBeenCalledWith('starter');
  });

  it('松手时按"最近的整卡"落位（四舍五入到整格）', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <PresetCarousel activeKey="starter" onSelect={onSelect} testID="c" />
    );
    const step = stepOf(getByTestId('c-scroll'));

    // 不到半格 → 弹回本档，不该回调
    await swipe(getByTestId('c-scroll'), step * 0.4);
    expect(onSelect).not.toHaveBeenCalled();

    // 过半格 → 落到下一档
    await swipe(getByTestId('c-scroll'), step * 0.6);
    expect(onSelect).toHaveBeenCalledWith('build');
  });

  it('落在本档上不重复回调（靠 activeKey 去重）', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <PresetCarousel activeKey="verbs" onSelect={onSelect} testID="c" />
    );
    await swipe(getByTestId('c-scroll'), stepOf(getByTestId('c-scroll')) * 2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('拖动中途不落位，停稳（120ms 静默）才按最后位置落 —— 中途的偏移不作数', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <PresetCarousel activeKey="starter" onSelect={onSelect} testID="c" />
    );
    const step = stepOf(getByTestId('c-scroll'));

    // 滚动经过 build（x=step），但还没停稳就继续滚 → 只认最后停下的位置
    await fireEvent(getByTestId('c-scroll'), 'scroll', {
      nativeEvent: { contentOffset: { x: step, y: 0 } },
    });
    expect(onSelect).not.toHaveBeenCalled(); // 防抖没到，不落位

    await swipe(getByTestId('c-scroll'), step * 2);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('verbs');
  });

  it('指示点：6 个，当前档实心', async () => {
    const { getByTestId } = await render(
      <PresetCarousel activeKey="verbs" onSelect={() => {}} testID="c" />
    );
    ALL_KEYS.forEach((k) => expect(getByTestId(`c-dot-${k}`)).toBeTruthy());
    expect(getByTestId('c-dot-verbs').props.accessibilityState).toEqual({ selected: true });
    expect(styleOf(getByTestId('c-dot-verbs')).backgroundColor).toBe(theme.color.accent);
    expect(styleOf(getByTestId('c-dot-starter')).backgroundColor).toBe(theme.color.line2);
  });

  it('点指示点直接跳档', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <PresetCarousel activeKey="starter" onSelect={onSelect} testID="c" />
    );
    await fireEvent.press(getByTestId('c-dot-exam'));
    expect(onSelect).toHaveBeenCalledWith('exam');
  });

  it('滑到哪一档都能对上指示点（几何与索引同源）', async () => {
    const { getByTestId } = await render(<Harness />);
    expect(getByTestId('c-dot-starter').props.accessibilityState).toEqual({ selected: true });
    await swipe(getByTestId('c-scroll'), stepOf(getByTestId('c-scroll')) * 2);
    await waitFor(() =>
      expect(getByTestId('c-dot-verbs').props.accessibilityState).toEqual({ selected: true })
    );
  });
});

describe('PresetCarousel · 自定义槽的编辑入口', () => {
  it('「编辑」只长在自定义槽卡上，预设卡永远没有', async () => {
    const { getByTestId, queryByTestId } = await render(
      <PresetCarousel activeKey="starter" onSelect={() => {}} onEdit={() => {}} testID="c" />
    );
    ['starter', 'build', 'verbs', 'exam'].forEach((k) => {
      expect(queryByTestId(`c-edit-${k}`)).toBeNull();
    });
    // 6 张卡同时挂在轨道上，两个自定义槽的入口都在（不用先滑过去）
    expect(getByTestId('c-edit-custom1')).toBeTruthy();
    expect(getByTestId('c-edit-custom2')).toBeTruthy();
  });

  it('点自定义槽的「编辑」回调该键（不改变选中）', async () => {
    const onEdit = jest.fn();
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <PresetCarousel activeKey="custom2" onSelect={onSelect} onEdit={onEdit} testID="c" />
    );
    await fireEvent.press(getByTestId('c-edit-custom2'));
    expect(onEdit).toHaveBeenCalledWith('custom2');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('不给 onEdit 时自定义卡上也没有编辑入口（预览页没路由）', async () => {
    const { queryByTestId } = await render(
      <PresetCarousel activeKey="custom1" onSelect={() => {}} testID="c" />
    );
    expect(queryByTestId('c-edit-custom1')).toBeNull();
  });
});

describe('PresetCarousel · 词库详情栏（常驻联动）', () => {
  it('三行键值：词库 / 时态 / 答题，且随选中档实时变', async () => {
    const s = await render(<PresetCarousel activeKey="starter" onSelect={() => {}} testID="c" />);
    const detail = texts(s.getByTestId('c-detail')).join(' ');
    expect(detail).toContain('词库');
    expect(detail).toContain('时态');
    expect(detail).toContain('答题');
    expect(detail).toContain('现在时'); // 零基础档 = A1 · 现在时
    expect(detail).toContain('选择'); // 选择题

    const b = await render(<PresetCarousel activeKey="build" onSelect={() => {}} testID="c" />);
    const detail2 = texts(b.getByTestId('c-detail')).join(' ');
    expect(detail2).toContain('简单过去时'); // 入门档多两个时态
    expect(detail2).toContain('手写');
  });

  it('「标签」那一行已删（用户 2026-10-02）：预设档永远显示「—」，纯属噪音', async () => {
    const { getByTestId } = await render(
      <PresetCarousel activeKey="starter" onSelect={() => {}} testID="c" />
    );
    const detail = texts(getByTestId('c-detail')).join(' ');
    expect(detail).not.toContain('标签');
    expect(detail).not.toContain('筛选');
  });

  it('自定义槽显示「自定义 N」并在详情栏里给出它自己的配置', async () => {
    const { getByTestId } = await render(
      <PresetCarousel activeKey="custom1" onSelect={() => {}} testID="c" />
    );
    expect(texts(getByTestId('c-card-custom1')).join(' ')).toContain('自定义 1');
    // 默认配方 = A2 + 现在/简单过去/未完成 + 手写
    const detail = texts(getByTestId('c-detail')).join(' ');
    expect(detail).toContain('A2');
    expect(detail).toContain('手写');
  });

  it('详情下的提示行已删（简约定稿）：说明文字不再出现，编辑入口只剩卡片右上角的按钮', async () => {
    // 旧断言命中的是提示行里的「编辑」二字；提示行删掉后，
    // 自定义槽的编辑入口 = 卡片右上角那个按钮（要传 onEdit 才有）
    const p = await render(<PresetCarousel activeKey="starter" onSelect={() => {}} testID="c" />);
    expect(texts(p.toJSON()).join(' ')).not.toContain('不可改');
    const c = await render(
      <PresetCarousel activeKey="custom1" onSelect={() => {}} onEdit={() => {}} testID="c" />
    );
    expect(texts(c.toJSON()).join(' ')).toContain('编辑');
    // 详情下的指路文字（「不可改」「去点编辑」）两头都没有了
    expect(texts(c.toJSON()).join(' ')).not.toContain('不可改');
    expect(texts(c.toJSON()).join(' ')).not.toContain('点右上角');
  });
});

/** 带状态的壳：滑动/指示点 → onSelect → props → 换档，模拟真实闭环 */
function Harness({ initial = 'starter' }: { initial?: string }) {
  const [k, setK] = useState(initial);
  return <PresetCarousel activeKey={k} onSelect={setK} testID="c" />;
}

/**
 * 内容基准：再渲一份"直接定死在某档"的轮播，取它的详情栏文字。
 * 比手写一串期望字符串稳 —— 预设的文案改了不用回来改断言。
 */
async function refDetail(key: string): Promise<string> {
  const r = await render(<PresetCarousel activeKey={key} onSelect={() => {}} testID="r" />);
  return texts(r.getByTestId('r-detail')).join(' ');
}

/**
 * 换档过渡（用户 2026-10-02 要求：「下方详情页的改动要渐变」）。
 *
 * 只对**详情栏**做渐变：卡片是跟着手指平移的，再叠一层透明度会很怪；
 * 详情栏是硬切换的，才需要"淡出 → 换内容 → 淡入"。
 *
 * 默认状态下单测里不会跑动画（那些用例都是一次性 `render`，`shownIdx` 一开始
 * 就等于 `idx`），所以这里用一个**带状态的壳**模拟真实闭环。
 *
 * ⚠️ 这条断言返工过一次，记下来免得再踩：
 *   · 最初写的是「按下后旧内容还在」—— 看着像在守渐变，其实**把时长改成 0 它照样过**：
 *     `Animated.timing` 无论时长多少都把完成回调推迟到下一帧，"旧内容还在"只证明
 *     切换是异步的，不证明中间有过渡。
 *   · 也试过读 `Animated.View` 的 `props.style.opacity` —— `Animated.timing` 走
 *     `setNativeProps`（不触发重渲染），host props 里那个数字是"上次渲染解析出来的"
 *     旧值，拿不到动画中的真实透明度（实测是死值）。
 *   · 还试过用假时钟按帧推进，RN 的 `TimingAnimation` 在 jest 假时钟下节奏和真实帧率
 *     对不上（推进 `out - 20` 毫秒时内容已经换掉了），当断言基线只会得到脆弱的绿灯。
 *   所以最后落成下面几条**各自能区分"有/无渐变"**的断言：
 *     · 时长常量非 0 —— 硬切的唯一判据（0 = 硬切）
 *     · 详情栏那一层在轨道**之外**且挂着 opacity —— 渐变挂在详情栏上，不挂在卡片上
 *     · 换内容是异步的 + 开关关掉后变同步 —— 保证过渡真的挂在动画上
 */
describe('PresetCarousel · 换档是渐变而不是硬切', () => {
  afterEach(() => {
    CAROUSEL_FADE.enabled = true;
  });

  it('时长非 0 —— 0 就是硬切，这条是"渐变还在"的守门员', () => {
    expect(CAROUSEL_FADE.out).toBeGreaterThan(0);
    expect(CAROUSEL_FADE.in).toBeGreaterThan(0);
    // 太短看着仍像硬切、太长会拖
    expect(CAROUSEL_FADE.out).toBeGreaterThanOrEqual(80);
    expect(CAROUSEL_FADE.in).toBeGreaterThanOrEqual(120);
  });

  it('详情栏挂着一层透明度，且常驻在滑动轨道之外（渐变只挂在它身上）', async () => {
    const { getByTestId } = await render(<Harness />);

    const detail = getByTestId('c-fade-detail');
    expect(within(detail).getByTestId('c-detail')).toBeTruthy();
    // 静止时完全不透明
    expect(styleOf(detail).opacity).toBe(1);
    // 卡片不受这层控制 —— 它们在轨道里跟着手指走，不参与淡入淡出
    expect(within(getByTestId('c-scroll')).queryByTestId('c-detail')).toBeNull();
  });

  it('换内容发生在"下一拍"，不是同步硬切', async () => {
    CAROUSEL_FADE.enabled = true;
    const verbsText = await refDetail('verbs');
    const { getByTestId } = await render(<Harness />);
    const before = detailOf(getByTestId('c-detail'));

    await fireEvent.press(getByTestId('c-dot-verbs'));

    // 按下的那一拍：还是旧内容（正在淡出）—— 同步硬切的话这里已经是新内容了
    expect(detailOf(getByTestId('c-detail'))).toBe(before);
    // 过渡跑完：换成新档的详情
    await waitFor(() => expect(detailOf(getByTestId('c-detail'))).toBe(verbsText), { timeout: 4000 });
  });

  it('滑过去也一样走渐变，不是只有点指示点才淡', async () => {
    CAROUSEL_FADE.enabled = true;
    const buildText = await refDetail('build');
    const { getByTestId } = await render(<Harness />);
    const before = detailOf(getByTestId('c-detail'));

    await swipe(getByTestId('c-scroll'), stepOf(getByTestId('c-scroll')));

    expect(detailOf(getByTestId('c-detail'))).toBe(before);
    await waitFor(() => expect(detailOf(getByTestId('c-detail'))).toBe(buildText), { timeout: 4000 });
  });

  it('连点两次（不等第一次过渡跑完）→ 最终落在第二目标，内容不错乱', async () => {
    // 这条守的是 effect cleanup 里 `alive = false` 那条路径：
    // 第一次淡出中途又点了一下 → 旧动画的完成回调必须被掐掉（finished=false / alive=false），
    // 否则回调乱序会把 shownIdx 覆写回旧目标，最后显示的档位与指示点对不上。
    CAROUSEL_FADE.enabled = true;
    const verbsText = await refDetail('verbs');
    const { getByTestId } = await render(<Harness />);

    // 不等第一次过渡跑完就连点第二下
    await fireEvent.press(getByTestId('c-dot-build'));
    await fireEvent.press(getByTestId('c-dot-verbs'));

    await waitFor(() => expect(detailOf(getByTestId('c-detail'))).toBe(verbsText), { timeout: 4000 });
  });

  it('中途折返（点到别档又马上点回来）→ 内容还在，且后续换档照常', async () => {
    // 折返时 `shownIdx === idx`，那条分支必须把还在跑的淡出补回 1：
    // 否则它的完成回调已被 `alive = false` 掐掉，没人接着做淡入，
    // 详情栏就永远停在透明。透明度在 RNTL 里读不到，所以断言"内容没乱 + 没被卡住"。
    CAROUSEL_FADE.enabled = true;
    const starterText = await refDetail('starter');
    const verbsText = await refDetail('verbs');
    const { getByTestId } = await render(<Harness />);

    await fireEvent.press(getByTestId('c-dot-exam'));
    await fireEvent.press(getByTestId('c-dot-starter'));
    expect(detailOf(getByTestId('c-detail'))).toBe(starterText);

    // 状态机没卡住：再换一档仍然能换过去
    await fireEvent.press(getByTestId('c-dot-verbs'));
    await waitFor(() => expect(detailOf(getByTestId('c-detail'))).toBe(verbsText), { timeout: 4000 });
  });

  it('关掉动画开关后是同步换内容（证明上面那条的"等一拍"确实来自动画）', async () => {
    CAROUSEL_FADE.enabled = false;
    const verbsText = await refDetail('verbs');
    const { getByTestId } = await render(<Harness />);

    await fireEvent.press(getByTestId('c-dot-verbs'));

    expect(detailOf(getByTestId('c-detail'))).toBe(verbsText);
  });
});

describe('PresetCarousel · 量到的是容器的真实宽度（不是窗口宽）', () => {
  it('容器比窗口窄时（外面还有卡片内边距）按容器算，六张卡一起收窄', async () => {
    const { getByTestId } = await render(<Harness />);
    // jest 里没有真实布局，直接把 layout 事件喂进去（等价于真机上量到容器宽）
    await fireEvent(getByTestId('c-stage'), 'layout', {
      nativeEvent: { layout: { width: 348, height: 240, x: 0, y: 0 } },
    });
    const want = carouselGeom(348).cardW;
    await waitFor(() => expect(styleOf(getByTestId('c-card-starter')).width).toBe(want));
    ALL_KEYS.forEach((k) => expect(styleOf(getByTestId(`c-card-${k}`)).width).toBe(want));
  });
});
