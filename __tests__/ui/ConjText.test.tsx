import { fireEvent, render } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { ConjText } from '@/ui/components/ConjText';
import { CHAR_W_FACTOR } from '@/ui/fitText';

/**
 * `ConjText` 的「**绝不出现省略号**」契约（用户 2026-10-05 / 10-07 两次报同一问题）。
 *
 * 三个失效场景，逐个钉死：
 *   ① 系统字体被放大（`PixelRatio.getFontScale()` ≠ 1）→ 字号必须跟着缩，
 *      否则文本实际宽度超出容器，被 `numberOfLines={1}` 截成「……」；
 *   ② 缩到 `minSize` 还是装不下（超窄格 + 超长词）→ 该词必须**放开** `numberOfLines`，
 *      允许它自己折行，而不是被截短；
 *   ③ 根容器自己的左右内边距（`paddingHorizontal`）会吃掉可用宽度，必须扣掉。
 */

type Screen = Awaited<ReturnType<typeof render>>;

/** 词级 `<Text>`（带了 fontSize 的那层；着色用的内层 Text 没有 fontSize） */
function words(screen: Screen): { props: Record<string, any> }[] {
  const out: { props: Record<string, any> }[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.type === 'Text' && n.props?.style?.fontSize !== undefined) out.push(n);
    if (n.children) walk(n.children);
  };
  walk(screen.toJSON());
  return out;
}

/** 让根容器「量到」指定宽度（模拟 onLayout 回调） */
async function layout(screen: Screen, width: number) {
  await fireEvent(screen.getByTestId('ct'), 'layout', {
    nativeEvent: { layout: { width, height: 40, x: 0, y: 0 } },
  });
}

beforeEach(() => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const LONG = 'desarrollaríamos'; // 词表里最长的词（16 字）

describe('ConjText · 系统字号缩放', () => {
  it('fontScale=1、容器 292px：缩一档后锁一行', async () => {
    const s = await render(<ConjText form={LONG} testID="ct" baseSize={34} minSize={20} />);
    await layout(s, 292);
    const w = words(s)[0];
    expect(w.props.style.fontSize).toBeLessThan(34);
    expect(w.props.numberOfLines).toBe(1);
  });

  it('系统字体放大到 1.5：字号必须进一步缩小，渲染宽度才装得下', async () => {
    const a = await render(<ConjText form={LONG} testID="ct" baseSize={34} minSize={10} />);
    await layout(a, 292);
    const sizeAt1 = words(a)[0].props.style.fontSize as number;

    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.5);
    const b = await render(<ConjText form={LONG} testID="ct" baseSize={34} minSize={10} />);
    await layout(b, 292);
    const sizeAt15 = words(b)[0].props.style.fontSize as number;

    expect(sizeAt15).toBeLessThan(sizeAt1);
    // 真实渲染宽 = 字号 × 每字比例 × 系统缩放，必须 ≤ 容器宽
    expect(LONG.length * CHAR_W_FACTOR * sizeAt15 * 1.5).toBeLessThanOrEqual(292);
  });

  it('系统字体放到 2.0 也不溢出（没触到 minSize 的前提下）', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    const s = await render(<ConjText form={LONG} testID="ct" baseSize={34} minSize={10} />);
    await layout(s, 292);
    const size = words(s)[0].props.style.fontSize as number;
    expect(size).toBeGreaterThanOrEqual(10);
    expect(LONG.length * CHAR_W_FACTOR * size * 2).toBeLessThanOrEqual(292);
  });
});

describe('ConjText · 缩到底也不许出现省略号', () => {
  it('装得下 → numberOfLines=1（词内绝不折断）', async () => {
    const s = await render(<ConjText form="pienso" testID="ct" baseSize={34} minSize={20} />);
    await layout(s, 292);
    expect(words(s)[0].props.numberOfLines).toBe(1);
  });

  it('缩到 minSize 仍装不下 → 放开 numberOfLines，让它自己折行', async () => {
    // 62px 是极端窄格：16 字 × 0.55 × 10(min) = 88 > 62
    const s = await render(<ConjText form={LONG} testID="ct" baseSize={15} minSize={10} />);
    await layout(s, 62);
    const w = words(s)[0];
    expect(w.props.style.fontSize).toBe(10);
    expect(w.props.numberOfLines).toBeUndefined();
  });

  it('还没量到宽度时先不锁行（宁可首帧折行，也不冒险截成省略号）', async () => {
    const s = await render(<ConjText form={LONG} testID="ct" baseSize={34} minSize={20} />);
    expect(words(s)[0].props.numberOfLines).toBeUndefined();
  });

  it('多词形式：只有超宽的那个词放开，其余词照旧锁一行', async () => {
    const s = await render(
      <ConjText form={`${LONG} despertado`} testID="ct" baseSize={15} minSize={10} />
    );
    await layout(s, 62);
    const [a, b] = words(s);
    expect(a.props.numberOfLines).toBeUndefined(); // 超长的那个
    expect(b.props.numberOfLines).toBe(1); // 短词仍锁一行
  });
});

describe('ConjText · 可用宽度要把容器自身内边距扣掉', () => {
  it('paddingHorizontal 会从实测宽度里扣掉再算字号', async () => {
    const a = await render(<ConjText form={LONG} testID="ct" baseSize={34} minSize={10} />);
    await layout(a, 300);
    const noPad = words(a)[0].props.style.fontSize as number;

    const b = await render(
      <ConjText form={LONG} testID="ct" baseSize={34} minSize={10} style={{ paddingHorizontal: 20 }} />
    );
    await layout(b, 300);
    const withPad = words(b)[0].props.style.fontSize as number;

    expect(withPad).toBeLessThan(noPad);
    expect(LONG.length * CHAR_W_FACTOR * withPad).toBeLessThanOrEqual(300 - 40);
  });
});
