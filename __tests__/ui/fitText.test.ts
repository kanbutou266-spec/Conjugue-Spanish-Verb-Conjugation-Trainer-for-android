import {
  CHAR_W_FACTOR,
  FALLBACK_AVAIL,
  estimateWidth,
  fitFontSize,
  longestWord,
  normFontScale,
  splitWords,
  wordExceeds,
} from '@/ui/fitText';
import verbsData from '@/data/verbs.json';

import type { Verb } from '@/data/types';

const VERBS = (verbsData as unknown as { v: Verb[] }).v;

/** 词表里出现过的全部「词」（自复形式按空格拆开） */
function allWords(): string[] {
  const set = new Set<string>();
  VERBS.forEach((v) => {
    Object.keys(v.t).forEach((k) => {
      String(v.t[k as keyof typeof v.t] || '')
        .split('|')
        .forEach((form) => {
          splitWords(form).forEach((w) => set.add(w));
        });
    });
  });
  return [...set];
}

describe('splitWords', () => {
  it('按空白拆词，多空格 / 首尾空格都不留空串', () => {
    expect(splitWords('me acuesto')).toEqual(['me', 'acuesto']);
    expect(splitWords('  nos   hubiéramos  despertado ')).toEqual([
      'nos',
      'hubiéramos',
      'despertado',
    ]);
    expect(splitWords('poder')).toEqual(['poder']);
  });

  it('空值不炸', () => {
    expect(splitWords('')).toEqual([]);
    expect(splitWords('   ')).toEqual([]);
    expect(splitWords(null)).toEqual([]);
    expect(splitWords(undefined)).toEqual([]);
  });
});

describe('longestWord', () => {
  it('取字符数最多的那个词', () => {
    expect(longestWord('nos hubiéramos despertado')).toBe('hubiéramos');
    expect(longestWord('me acuesto')).toBe('acuesto');
    expect(longestWord('')).toBe('');
  });
});

describe('fitFontSize', () => {
  const base = 34;
  const min = 20;

  /*
   * 回归：用户 2026-10-05 第 7 条 ——「动词太长导致后面变成省略号，为什么没有
   * 自动缩小字体？」根因就是「没量到宽度时不缩字」，首帧长词被
   * `numberOfLines={1}` 截成「……」。现在改为按保守的兜底宽度先缩一档。
   */
  it('还没量到容器宽度时，按兜底宽度保守缩字（绝不原样放行 base）', () => {
    // 用能真的撑爆兜底宽度的字号（题干那档是 34pt，16 字 ≈ 299px，还不够宽；
    // 这里换成词表里最长的 16 字 + 40pt，确保它一定过 FALLBACK_AVAIL）
    const b = 40;
    const long = 'desarrollaríamos'; // 16 字
    const need = long.length * CHAR_W_FACTOR * b;
    expect(need).toBeGreaterThan(FALLBACK_AVAIL);

    const s0 = fitFontSize({ text: long, avail: 0, base: b, min });
    const sNan = fitFontSize({ text: long, avail: NaN, base: b, min });
    expect(s0).toBeGreaterThanOrEqual(min);
    expect(s0).toBeLessThan(b);
    expect(sNan).toBe(s0);
    // 兜底缩出来的字号，按兜底宽度算一定装得下
    expect(estimateWidth(long, s0)).toBeLessThanOrEqual(FALLBACK_AVAIL);
  });

  it('还没量到宽度时，短词仍用基准字号（不会无脑缩小）', () => {
    expect(fitFontSize({ text: 'poder', avail: 0, base, min })).toBe(base);
  });

  it('装得下就用基准字号', () => {
    expect(fitFontSize({ text: 'poder', avail: 300, base, min })).toBe(base);
    expect(fitFontSize({ text: 'nos hubiéramos despertado', avail: 300, base, min })).toBe(base);
  });

  it('**只看最长那个词**：整串很长但每个词都短 → 不缩字号（靠词间折行排两行）', () => {
    const long = 'nos hubiéramos despertado'; // 26 字，最长词 10 字
    const size = fitFontSize({ text: long, avail: 200, base, min });
    expect(size).toBe(base);
    // 而"整串字数"口径会误判成必须缩字：
    expect(long.length * CHAR_W_FACTOR * base).toBeGreaterThan(200);
  });

  it('单个词太长就按比例缩，且缩完刚好装得下', () => {
    const word = 'desarrollaríamos'; // 16 字
    const avail = 260;
    const size = fitFontSize({ text: word, avail, base, min });
    expect(size).toBeLessThan(base);
    expect(estimateWidth(word, size)).toBeLessThanOrEqual(avail);
  });

  it('缩到下限就不缩了（宁可略微溢出，也不要小到看不清）', () => {
    expect(fitFontSize({ text: 'desarrollaríamos', avail: 60, base, min })).toBe(min);
    expect(fitFontSize({ text: 'desarrollaríamos', avail: 1, base, min })).toBe(min);
  });

  it('下限高于基准时不会把字放大（Math.max 的顺序别写反）', () => {
    expect(fitFontSize({ text: 'poder', avail: 300, base: 12, min: 20 })).toBe(12);
  });

  it('空形式返回基准字号', () => {
    expect(fitFontSize({ text: '', avail: 100, base, min })).toBe(base);
  });
});

/*
 * 用户 2026-10-07 又报了一次「题干给的动词太长会出现省略号」。根因不是"某个词太长"，
 * 而是 **系统字号缩放没进估算**：RN 的 Text 默认 allowFontScaling，fontSize 会被系统
 * 「字体大小」再乘一遍，而容器宽是真实 dp —— 用户把系统字体调到 1.15~1.5 后长词就溢出，
 * 再被 numberOfLines={1} 截成「……」。这就是"有时候"的来源。
 */
describe('fitFontSize · 系统字号缩放（fontScale）', () => {
  const base = 34;
  const min = 20;

  it('normFontScale：缺省 / 非法值都归一为 1，正常值原样返回', () => {
    expect(normFontScale()).toBe(1);
    expect(normFontScale(NaN)).toBe(1);
    expect(normFontScale(0)).toBe(1);
    expect(normFontScale(-2)).toBe(1);
    expect(normFontScale(1.3)).toBe(1.3);
  });

  it('系统字体放大 → 同一个词要缩得更小，真实渲染宽度才装得下', () => {
    const word = 'desarrollaríamos';
    const avail = 292;
    const s1 = fitFontSize({ text: word, avail, base, min });
    const s13 = fitFontSize({ text: word, avail, base, min, scale: 1.3 });
    const s15 = fitFontSize({ text: word, avail, base, min, scale: 1.5 });
    expect(s13).toBeLessThan(s1);
    expect(s15).toBeLessThan(s13);
    // 关键口径：真实宽度 = 字号 × 字符比例 × fontScale
    [1.3, 1.5].forEach((scale) => {
      const size = fitFontSize({ text: word, avail, base, min, scale });
      expect(estimateWidth(word, size) * scale).toBeLessThanOrEqual(avail);
    });
  });

  it('wordExceeds：装得下为 false，装不下为 true；没量到宽度时不下判断', () => {
    const word = 'desarrollaríamos';
    expect(wordExceeds(word, 0, 34)).toBe(false); // 还没量到 → 不判定
    expect(wordExceeds(word, 400, 34)).toBe(false);
    expect(wordExceeds(word, 200, 34)).toBe(true);
    expect(wordExceeds(word, 260, 30, CHAR_W_FACTOR, 1.5)).toBe(true); // 系统字体放大后溢出
  });

  it('正向对照：**旧口径**（不把 fontScale 算进估算）在系统字体 1.3 下真的会溢出', () => {
    const word = 'desarrollaríamos';
    const avail = 292;
    // 旧代码等价于 scale=1 算字号，却没考虑渲染时还会被系统乘 1.3
    const legacySize = fitFontSize({ text: word, avail, base: 34, min: 20 });
    expect(wordExceeds(word, avail, legacySize, CHAR_W_FACTOR, 1.3)).toBe(true);
    // 新口径：把 scale 传进去就不溢出
    const fixedSize = fitFontSize({ text: word, avail, base: 34, min: 20, scale: 1.3 });
    expect(wordExceeds(word, avail, fixedSize, CHAR_W_FACTOR, 1.3)).toBe(false);
  });

  it('真实词表 × 真实容器：只要没缩到 min，就**一定**装得下（1.0 / 1.15 / 1.3 / 1.5 / 2.0 全档）', () => {
    const avail = 292; // 作答页题干在 360dp 屏上的真实可用宽
    const bad: string[] = [];
    allWords().forEach((w) => {
      [1, 1.15, 1.3, 1.5, 2].forEach((scale) => {
        const size = fitFontSize({ text: w, avail, base, min, scale });
        if (size > min && estimateWidth(w, size) * scale > avail) bad.push(`${w}@${scale}:${size}`);
      });
    });
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('真实词表 × 六人称网格窄格（约 90dp）：触底的词交给 ConjText 放开折行', () => {
    const avail = 90;
    const minCell = 10;
    const atMin: string[] = [];
    allWords().forEach((w) => {
      const size = fitFontSize({ text: w, avail, base: 15, min: minCell, scale: 1.3 });
      if (size === minCell && estimateWidth(w, size) * 1.3 > avail) atMin.push(w);
    });
    // 只有极少数 13 字以上的极端长词会触底；它们由 ConjText 放开 numberOfLines 兜底
    expect(atMin.length).toBeGreaterThan(0);
    expect(atMin.every((w) => w.length >= 13)).toBe(true);
    expect(atMin.length).toBeLessThan(allWords().length * 0.06);
  });
});

describe('fitFontSize · 用真实词表校准', () => {
  const words = allWords();

  it('最长词是 16 个字（desarrollaríamos 那一类），不是复合时态的整串', () => {
    const max = words.reduce((a, b) => (b.length > a.length ? b : a), '');
    expect(max).toHaveLength(16);
    expect(max).toBe('desarrollaríamos');
  });

  it('只要没触到下限，缩完之后**每一个**词都装得下', () => {
    const avail = 120;
    const min = 8;
    const bad: string[] = [];
    words.forEach((w) => {
      const size = fitFontSize({ text: w, avail, base: 15, min });
      if (size > min && estimateWidth(w, size) > avail) bad.push(`${w}:${size}`);
    });
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('作答页题干那条最窄的真实容器（约 260px）：只有 15 字以上的词才需要缩字号', () => {
    const shrunk = words.filter((w) => fitFontSize({ text: w, avail: 260, base: 34, min: 20 }) < 34);
    const longest = shrunk.reduce((a, b) => (b.length > a.length ? b : a), '');
    expect(longest.length).toBeLessThanOrEqual(16);
    expect(shrunk.length).toBeGreaterThan(0);
  });

  it('六人称网格那条最窄的真实容器（约 77px）：极少数长词会触到下限', () => {
    const atMin = words.filter(
      (w) => fitFontSize({ text: w, avail: 77, base: 15, min: 10 }) === 10 && w.length >= 15
    );
    // 触底的都是 15 字以上的极端长词，占比应当很小
    expect(atMin.length).toBeLessThan(words.length * 0.02);
  });
});
