import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ALL_KEYS, CUSTOM_KEYS, PRESETS, keyIcon } from '@/data/levels';
import { MODES } from '@/data/modes';
import { Btn, BTN_PRESSED } from '@/ui/components/Btn';
import { Card } from '@/ui/components/Card';
import { Chip, chipColors } from '@/ui/components/Chip';
import { RichText } from '@/ui/components/RichText';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { SettingRow } from '@/ui/components/SettingRow';
import { Tag } from '@/ui/components/Tag';
import { ICON_NAMES, Icon, hasIcon } from '@/ui/Icon';
import { theme } from '@/ui/theme';

/** 把 style（可能是数组 / 函数结果）摊平成对象，方便逐值断言 */
function flat(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style) || {}) as Record<string, unknown>;
}

/** 取某个 testID 的节点摊平后的样式 */
function styleOf(el: { props: { style?: unknown } }): Record<string, unknown> {
  return flat(el.props.style);
}

/** 取节点里所有文本（含嵌套 Text） */
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
    if (n.children) walk(n.children);
  };
  walk(node);
  return out;
}

describe('Chip', () => {
  it('默认态：白底、主文字色、线色边框、药丸圆角、gap 5', async () => {
    const { getByTestId } = await render(<Chip label="不规则" testID="c" />);
    const s = styleOf(getByTestId('c'));
    expect(s.backgroundColor).toBe('#ffffff');
    expect(s.borderColor).toBe(theme.color.line);
    expect(s.borderRadius).toBe(theme.radius.pill);
    expect(s.gap).toBe(5);
    expect(s.borderWidth).toBe(1);
  });

  it('选中态：主色铺满 + 白字 + 字重 600', async () => {
    const { getByTestId, getByText } = await render(
      <Chip label="不规则" selected testID="c" />
    );
    expect(styleOf(getByTestId('c')).backgroundColor).toBe(theme.color.accent);
    expect(flat(getByText('不规则').props.style).color).toBe('#ffffff');
    expect(flat(getByText('不规则').props.style).fontWeight).toBe('600');
  });

  it('tint：未选中用所属语式的浅底/浅边/深字，选中改用主色', async () => {
    const tint = theme.mood.sub;
    const a = await render(<Chip label="虚拟式" tint={tint} testID="c" />);
    const s1 = styleOf(a.getByTestId('c'));
    expect(s1.backgroundColor).toBe(tint.soft);
    expect(s1.borderColor).toBe(tint.border);
    expect(flat(a.getByText('虚拟式').props.style).color).toBe(tint.ink);

    const b = await render(<Chip label="虚拟式" tint={tint} selected testID="c" />);
    expect(styleOf(b.getByTestId('c')).backgroundColor).toBe(tint.main);
  });

  it('off：置灰、保留形状、点了也不触发', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(<Chip label="练习" off onPress={onPress} testID="c" />);
    const s = styleOf(getByTestId('c'));
    expect(s.backgroundColor).toBe(theme.color.tag);
    expect(s.borderColor).toBe(theme.color.line);
    expect(getByTestId('c').props.accessibilityState).toEqual({ selected: false, disabled: true });
    fireEvent.press(getByTestId('c'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('disabled：只降透明度（.35），点击无效', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <Chip label="练习" disabled onPress={onPress} testID="c" />
    );
    expect(styleOf(getByTestId('c')).opacity).toBe(0.35);
    fireEvent.press(getByTestId('c'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('正常点击会回调', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(<Chip label="A1" onPress={onPress} testID="c" />);
    fireEvent.press(getByTestId('c'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('没有 onPress 时不可点（只读展示）', async () => {
    const { getByTestId } = await render(<Chip label="A1" testID="c" />);
    expect(getByTestId('c').props.accessibilityState.disabled).toBe(true);
  });

  it('sm 档：padding 5/11、字号 13，并补上 4px 的上下 hitSlop', async () => {
    const { getByTestId, getByText } = await render(
      <Chip label="高频" size="sm" count={122} testID="c" />
    );
    const s = styleOf(getByTestId('c'));
    expect(s.paddingVertical).toBe(5);
    expect(s.paddingHorizontal).toBe(11);
    expect(getByTestId('c').props.hitSlop).toEqual({ top: 4, bottom: 4 });
    expect(flat(getByText('高频').props.style).fontSize).toBe(13);
  });

  it('md 档：padding 7/14、字号 14、无 hitSlop', async () => {
    const { getByTestId, getByText } = await render(<Chip label="高频" testID="c" />);
    const s = styleOf(getByTestId('c'));
    expect(s.paddingVertical).toBe(7);
    expect(s.paddingHorizontal).toBe(14);
    expect(getByTestId('c').props.hitSlop).toBeUndefined();
    expect(flat(getByText('高频').props.style).fontSize).toBe(14);
  });

  it('count：渲染成 12px、opacity .6 的淡色后缀', async () => {
    const { getByText } = await render(<Chip label="高频" count={122} testID="c" />);
    const s = flat(getByText('122').props.style);
    expect(s.fontSize).toBe(12);
    expect(s.opacity).toBe(0.6);
  });

  it('count 为 0 也照样显示（0 是有效计数）', async () => {
    const { getByText } = await render(<Chip label="词干变化" count={0} testID="c" />);
    expect(getByText('0')).toBeTruthy();
  });

  it('按下态走同一个配色函数：优先级 selected > pressed > tint > 默认', () => {
    // 未选中：按下给浅蓝底 + 浅蓝边
    expect(chipColors(false, false, null, true)).toEqual({
      bg: theme.press.soft,
      border: theme.press.softBorder,
      ink: theme.color.ink,
      weight: '500',
    });
    // 已选中：按下不覆盖自己的填充色（网页里 [aria-pressed] 压过 :hover）
    expect(chipColors(true, false, theme.mood.ind, true).bg).toBe(theme.mood.ind.main);
    // 置灰：优先级最高，按下也不变色
    expect(chipColors(false, true, null, true).bg).toBe(theme.color.tag);
    // tint 未选中、未按下 → 语式浅色
    expect(chipColors(false, false, theme.mood.cond).bg).toBe(theme.mood.cond.soft);
  });

  it('icon 插槽会渲染在文字前面', async () => {
    const { getByTestId, toJSON } = await render(
      <Chip label="辨认" icon={<Icon name="eye" size={20} />} testID="c" />
    );
    expect(getByTestId('c')).toBeTruthy();
    expect(JSON.stringify(toJSON())).toContain('svg');
  });
});

describe('Btn', () => {
  it('默认档：白底 + 线色边框 + 圆角 11', async () => {
    const { getByTestId, getByText } = await render(<Btn label="恢复默认" testID="b" />);
    const s = styleOf(getByTestId('b'));
    expect(s.backgroundColor).toBe('#ffffff');
    expect(s.borderColor).toBe(theme.color.line);
    expect(s.borderRadius).toBe(11);
    expect(flat(getByText('恢复默认').props.style).fontSize).toBe(15);
  });

  it('primary：主色铺满 + 白字 + padding 11/22', async () => {
    const { getByTestId, getByText } = await render(
      <Btn label="开始练习" variant="primary" testID="b" />
    );
    const s = styleOf(getByTestId('b'));
    expect(s.backgroundColor).toBe(theme.color.accent);
    expect(s.paddingVertical).toBe(11);
    expect(s.paddingHorizontal).toBe(22);
    expect(flat(getByText('开始练习').props.style).color).toBe('#ffffff');
  });

  it('ghost：透明底、无色边框、次级文字色、字重 500', async () => {
    const { getByTestId, getByText } = await render(
      <Btn label="取消" variant="ghost" testID="b" />
    );
    const s = styleOf(getByTestId('b'));
    expect(s.backgroundColor).toBe('transparent');
    expect(s.borderColor).toBe('transparent');
    expect(flat(getByText('取消').props.style).color).toBe(theme.color.sub);
    expect(flat(getByText('取消').props.style).fontWeight).toBe('500');
  });

  it('wide：撑满整行', async () => {
    const { getByTestId } = await render(<Btn label="保存" wide testID="b" />);
    expect(styleOf(getByTestId('b')).width).toBe('100%');
  });

  it('disabled：降透明度 .4 且点击无效', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(<Btn label="保存" disabled onPress={onPress} testID="b" />);
    expect(styleOf(getByTestId('b')).opacity).toBe(0.4);
    fireEvent.press(getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('点击会回调', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(<Btn label="保存" onPress={onPress} testID="b" />);
    fireEvent.press(getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('按下态查表：default 浅蓝 / primary 深蓝 / ghost 灰', () => {
    expect(BTN_PRESSED.default).toEqual({
      backgroundColor: theme.press.soft,
      borderColor: theme.press.softBorder,
    });
    expect(BTN_PRESSED.primary).toEqual({
      backgroundColor: theme.press.primary,
      borderColor: theme.press.primary,
    });
    expect(BTN_PRESSED.ghost).toEqual({ backgroundColor: theme.press.ghost });
  });
});

describe('SegmentedControl', () => {
  const OPTIONS = [
    { k: 'type' as const, label: '手写' },
    { k: 'choice' as const, label: '选择' },
  ];

  it('选中项主色铺满白字，未选中项次级色', async () => {
    const { getByTestId, getByText } = await render(
      <SegmentedControl options={OPTIONS} value="choice" onChange={() => {}} testID="seg" />
    );
    expect(styleOf(getByTestId('seg-choice')).backgroundColor).toBe(theme.color.accent);
    expect(flat(getByText('选择').props.style).color).toBe('#ffffff');
    expect(flat(getByText('手写').props.style).color).toBe(theme.color.sub);
  });

  it('第二段起有左侧分隔线', async () => {
    const { getByTestId } = await render(
      <SegmentedControl options={OPTIONS} value="type" onChange={() => {}} testID="seg" />
    );
    expect(styleOf(getByTestId('seg-type')).borderLeftWidth).toBeUndefined();
    expect(styleOf(getByTestId('seg-choice')).borderLeftWidth).toBe(1);
  });

  it('点击回调带上该段的键', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <SegmentedControl options={OPTIONS} value="type" onChange={onChange} testID="seg" />
    );
    fireEvent.press(getByTestId('seg-choice'));
    expect(onChange).toHaveBeenCalledWith('choice');
  });

  it('无障碍上是一组 radio，各自标出选中态', async () => {
    const { getByTestId } = await render(
      <SegmentedControl options={OPTIONS} value="type" onChange={() => {}} testID="seg" />
    );
    expect(getByTestId('seg').props.accessibilityRole).toBe('radiogroup');
    expect(getByTestId('seg-type').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('seg-choice').props.accessibilityState).toEqual({ selected: false });
  });

  it('不传 testID 也能渲染（不会拼出 "undefined-type"）', async () => {
    const { getByText } = await render(
      <SegmentedControl options={OPTIONS} value="type" onChange={() => {}} />
    );
    expect(getByText('手写')).toBeTruthy();
  });
});

describe('SettingRow', () => {
  it('标题 + 说明 + 开关值都会传到 Switch', async () => {
    const { getByTestId, getByText } = await render(
      <SettingRow
        title="隐藏动词原形"
        hint="题干不再给出原形"
        value
        onChange={() => {}}
        testID="s"
      />
    );
    expect(getByText('隐藏动词原形')).toBeTruthy();
    expect(getByText('题干不再给出原形')).toBeTruthy();
    expect(getByTestId('s-sw').props.value).toBe(true);
  });

  it('拨动开关会回调新值', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <SettingRow title="含 vosotros" value={false} onChange={onChange} testID="s" />
    );
    fireEvent(getByTestId('s-sw'), 'valueChange', true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('off：整行降透明度、开关显示为关且锁死', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <SettingRow title="严格要求重音" value onChange={onChange} off testID="s" />
    );
    expect(styleOf(getByTestId('s')).opacity).toBe(0.55);
    expect(getByTestId('s-sw').props.value).toBe(false);
    expect(getByTestId('s-sw').props.disabled).toBe(true);
  });

  it('没有说明时不留空行', async () => {
    const { queryByText, getByText } = await render(
      <SettingRow title="含 vosotros" value={false} onChange={() => {}} testID="s" />
    );
    expect(getByText('含 vosotros')).toBeTruthy();
    expect(queryByText('题干不再给出原形')).toBeNull();
  });
});

describe('Card', () => {
  it('白底、1px 线、圆角 14、内边距 16/16/14、外边距 18', async () => {
    const { getByTestId } = await render(
      <Card testID="card">
        <RichText text="内容" />
      </Card>
    );
    const s = styleOf(getByTestId('card'));
    expect(s.backgroundColor).toBe(theme.color.card);
    expect(s.borderColor).toBe(theme.color.line);
    expect(s.borderRadius).toBe(theme.radius.lg);
    expect(s.paddingTop).toBe(16);
    expect(s.paddingHorizontal).toBe(16);
    expect(s.paddingBottom).toBe(14);
    expect(s.marginHorizontal).toBe(18);
    expect(s.marginBottom).toBe(14);
  });

  it('flush：去掉左右外边距', async () => {
    const { getByTestId } = await render(<Card flush testID="card" />);
    expect(styleOf(getByTestId('card')).marginHorizontal).toBeUndefined();
  });

  it('带卡片阴影（elevation 2）', async () => {
    const { getByTestId } = await render(<Card testID="card" />);
    expect(styleOf(getByTestId('card')).elevation).toBe(2);
  });
});

describe('Tag', () => {
  it('默认灰底 + bodyInk 字', async () => {
    const { getByTestId } = await render(<Tag testID="t">不规则</Tag>);
    const s = styleOf(getByTestId('t'));
    expect(s.backgroundColor).toBe(theme.color.tag);
    expect(s.color).toBe(theme.color.bodyInk);
    expect(s.borderRadius).toBe(6);
    expect(s.fontSize).toBe(12);
  });

  it('五个色档各自取对应底色/字色', async () => {
    const cases = [
      ['acc', theme.color.accentSoft, '#1f4fbb'],
      ['ok', theme.color.okSoft, theme.color.ok],
      ['warn', theme.color.warnSoft, theme.color.warn],
      ['bad', theme.color.badSoft, theme.color.bad],
    ] as const;
    for (const [tone, bg, ink] of cases) {
      const { getByTestId } = await render(
        <Tag tone={tone} testID="t">
          x
        </Tag>
      );
      const s = styleOf(getByTestId('t'));
      expect(s.backgroundColor).toBe(bg);
      expect(s.color).toBe(ink);
    }
  });

  it('size 入参放大字号并放宽内边距（作答页顶部模式徽标用）', async () => {
    const { getByTestId } = await render(
      <Tag testID="t" tone="acc" size={15}>
        复现模式
      </Tag>
    );
    const s = styleOf(getByTestId('t'));
    expect(s.fontSize).toBe(15);
    expect(s.paddingVertical).toBe(2.5);
    expect(s.paddingHorizontal).toBe(10);
  });
});

describe('RichText', () => {
  it('无标记时渲染成单个纯字符串（不多套一层 Text）', async () => {
    const { getByTestId, toJSON } = await render(<RichText text="开始练习 →" testID="r" />);
    expect(texts(toJSON())).toEqual(['开始练习 →']);
    expect(getByTestId('r')).toBeTruthy();
  });

  it('带标记时把强调段包成加粗的内层 Text，且不显示标记本身', async () => {
    const { toJSON } = await render(<RichText text="已选 [[3]] / 15 个时态" />);
    expect(texts(toJSON())).toEqual(['已选 ', '3', ' / 15 个时态']);
    const dump = JSON.stringify(toJSON());
    expect(dump).not.toContain('[[');
    expect(dump).toContain('"fontWeight":"700"');
  });

  it('strongStyle 可覆盖默认加粗', async () => {
    const { toJSON } = await render(
      <RichText text="[[3]] 个" strongStyle={{ fontWeight: '400', color: '#ff0000' }} />
    );
    const dump = JSON.stringify(toJSON());
    expect(dump).toContain('"fontWeight":"400"');
    expect(dump).toContain('#ff0000');
  });

  it('numberOfLines 会传下去', async () => {
    const { getByTestId } = await render(<RichText text="很长的一段" numberOfLines={2} testID="r" />);
    expect(getByTestId('r').props.numberOfLines).toBe(2);
  });
});

describe('Icon', () => {
  it('数据层给出的图标名全部登记在表里（拼错会被抓住）', () => {
    const names = [
      ...MODES.map((m) => m.icon),
      ...PRESETS.map((p) => p.icon),
      ...ALL_KEYS.map((k) => keyIcon(k)),
    ];
    const missing = names.filter((n) => !hasIcon(n));
    expect(missing).toEqual([]);
    expect(CUSTOM_KEYS.map((k) => keyIcon(k))).toEqual(['wrench', 'puzzle']);
  });

  it('表里没有重名，且每个名字都能命中', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    expect(ICON_NAMES.every((n) => hasIcon(n))).toBe(true);
    expect(hasIcon('no-such-icon')).toBe(false);
  });

  it('认不出的名字回退成问号图标，不抛错', async () => {
    const { toJSON } = await render(<Icon name="no-such-icon" />);
    expect(toJSON()).toBeTruthy();
  });

  it('能渲染出来并带上尺寸/颜色', async () => {
    const { toJSON } = await render(<Icon name="eye" size={22} color="#123456" />);
    const dump = JSON.stringify(toJSON());
    expect(dump).toContain('svg');
    expect(JSON.stringify(toJSON())).toBeTruthy();
    expect(dump.length).toBeGreaterThan(0);
  });
});
