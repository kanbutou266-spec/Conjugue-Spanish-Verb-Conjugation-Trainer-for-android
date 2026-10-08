import { defaultSettings, sanitizeSettings } from '@/data/settings';
import {
  cardShadow,
  cardShadowDark,
  dark,
  font,
  light,
  mood,
  moodDark,
  press,
  pressDark,
  radius,
  space,
  theme,
} from '@/ui/theme';

/**
 * 期望值**逐字抄自**网页版 `data/app_template.html`：
 *   · `:root{}`                → 第 8-16 行
 *   · `.g-ind/cond/sub/imp{}`   → 第 19-22 行
 * 这些是两版并排比对时的基准，改之前先改网页（或先确认两边确实要分叉）。
 */
describe('theme · 与网页 CSS 变量逐值一致', () => {
  it('亮色调色板的全部值完全一致（且没有多余字段）', () => {
    expect(light).toEqual({
      bg: '#f5f6f8',
      card: '#ffffff',
      ink: '#1b1d21',
      sub: '#6b7280',
      line: '#e4e6eb',
      accent: '#2f6df6',
      accentSoft: '#e8f0ff',
      ok: '#12855a',
      okSoft: '#e6f6ef',
      bad: '#c0392b',
      badSoft: '#fdecea',
      warn: '#b7791f',
      warnSoft: '#fdf5e3',
      tag: '#eef1f6',
      // 派生底 / 派生字（用户 2026-10-06 补：深色下组件写死 #ffffff 会漏白）
      card2: '#fbfcfe',
      raise: '#fcfdff',
      muteInk: '#4b5563',
      bodyInk: '#334155',
      bodyInk2: '#475569',
      faint: '#b9c2d4',
      hiInk: '#1f4fbb',
      line2: '#c9d3e6',
      lineAcc: '#c3d4fb',
      fIrr: '#c0392b',
      fOrth: '#0b7a7a',
      fStem: '#b26a00',
    });
  });

  it('亮/深两套调色板**键集合一一对应**（加字段不能只加一边）', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it('新增派生令牌的深浅取值与网页 CSS 变量逐值一致', () => {
    // 网页 :root 与 html[data-theme=dark] 里那批派生变量
    const webLight = {
      card2: '#fbfcfe',
      raise: '#fcfdff',
      muteInk: '#4b5563',
      bodyInk: '#334155',
      bodyInk2: '#475569',
      faint: '#b9c2d4',
      hiInk: '#1f4fbb',
      line2: '#c9d3e6',
      lineAcc: '#c3d4fb',
    };
    const webDark = {
      card2: '#15181d',
      raise: '#1f232a',
      muteInk: '#b6bfcd',
      bodyInk: '#cdd4de',
      bodyInk2: '#c2c9d4',
      faint: '#5b636f',
      hiInk: '#a8c4ff',
      line2: '#3a4150',
      lineAcc: '#2f4470',
    };
    for (const k of Object.keys(webLight) as (keyof typeof webLight)[]) {
      expect(light[k]).toBe(webLight[k]);
      expect(dark[k]).toBe(webDark[k]);
    }
  });

  it('四个语式主题色四键齐全且取值一致', () => {
    expect(mood).toEqual({
      ind: { main: '#2f6df6', soft: '#e9f1ff', ink: '#1f4fbb', border: '#bcd0fa' },
      cond: { main: '#0b7a7a', soft: '#e1f5f5', ink: '#0a6b6b', border: '#a8dede' },
      sub: { main: '#7b45d6', soft: '#f2eaff', ink: '#5f31ad', border: '#ccb5f0' },
      imp: { main: '#b85c07', soft: '#fdf1e2', ink: '#9a4d08', border: '#efcfa6' },
    });
    expect(Object.keys(mood).sort()).toEqual(['cond', 'imp', 'ind', 'sub']);
  });

  it('所有颜色都是 #rrggbb', () => {
    const bad: string[] = [];
    const check = (path: string, v: string) => {
      if (!/^#[0-9a-f]{6}$/.test(v)) bad.push(`${path}=${v}`);
    };
    Object.entries(light).forEach(([k, v]) => check(`light.${k}`, v));
    Object.entries(mood).forEach(([g, p]) =>
      Object.entries(p).forEach(([k, v]) => check(`mood.${g}.${k}`, v))
    );
    expect(bad).toEqual([]);
  });

  it('着色三色与网页 --f-* 完全一致（FormText 依赖它）', () => {
    expect(light.fIrr).toBe('#c0392b');
    expect(light.fOrth).toBe('#0b7a7a');
    expect(light.fStem).toBe('#b26a00');
  });
});

describe('theme · 尺度令牌', () => {
  it('radius 四档', () => {
    // 网页 --radius:14px → lg；sm/md 是手机端新增的小尺寸
    expect(radius).toEqual({ sm: 8, md: 12, lg: 14, pill: 999 });
  });

  it('space 是 4pt 网格', () => {
    expect([0, 1, 2, 3, 4, 6].map(space)).toEqual([0, 4, 8, 12, 16, 24]);
  });

  it('字号档位对应网页关键 class', () => {
    // .verb-big{font-size:34px} / .verb-mid{font-size:22px} / h1{font-size:24px}
    expect(font.xxl).toBe(34);
    expect(font.xl).toBe(22);
    expect(font.h1).toBe(24);
    // 档位递增且唯一
    const stairs = [font.xs, font.sm, font.md, font.lg, font.xl, font.h1, font.xxl];
    expect(stairs).toEqual([...stairs].sort((a, b) => a - b));
    expect(new Set(stairs).size).toBe(stairs.length);
  });

  it('卡片阴影有一层 + Android elevation', () => {
    expect(cardShadow.shadowOffset).toEqual({ width: 0, height: 1 });
    expect(cardShadow.shadowOpacity).toBeCloseTo(0.06, 5);
    expect(cardShadow.shadowRadius).toBe(3);
    expect(cardShadow.elevation).toBeGreaterThan(0);
  });

  it('聚合对象 theme 是取用入口', () => {
    expect(theme.color).toBe(light);
    expect(theme.mood).toBe(mood);
    expect(theme.radius).toBe(radius);
    expect(theme.font).toBe(font);
    expect(theme.space(3)).toBe(12);
  });
});

/**
 * 深色模式（用户 2026-10-05）—— 三档：system（默认，跟随手机深色开关）/ dark / light。
 * 这里只测"令牌层"：两套调色板同形、深色下必须真的不同、对比度可读；
 * 至于「设置里改档位 → 界面真的变深」由 `__tests__/ui/darkmode.test.tsx` 渲染层覆盖。
 */
describe('theme · 深色模式', () => {
  it('深色调色板的字段与亮色完全一致（同形，不会漏字段）', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    expect(Object.keys(moodDark).sort()).toEqual(Object.keys(mood).sort());
    Object.keys(mood).forEach((g) => {
      const k = g as 'ind' | 'cond' | 'sub' | 'imp';
      expect(Object.keys(moodDark[k]).sort()).toEqual(['border', 'ink', 'main', 'soft']);
    });
  });

  it('深色 ≠ 亮色：底色变深、主文字变亮', () => {
    expect(dark.bg).not.toBe(light.bg);
    expect(dark.card).not.toBe(light.card);
    // 亮度关系要正确：深色下 bg 比 card 暗（层次靠亮度差）
    expect(lum(dark.bg)).toBeLessThan(lum(dark.card));
    // 深色下文字比底色亮得多
    expect(lum(dark.ink)).toBeGreaterThan(lum(dark.bg) + 0.4);
    // 亮色下反过来
    expect(lum(light.ink)).toBeLessThan(lum(light.bg));
    expect(lum(light.bg)).toBeLessThan(lum(light.card));
  });

  it('四个语式主题色在深色下也换成了一套（不是照抄亮色）', () => {
    (['ind', 'cond', 'sub', 'imp'] as const).forEach((k) => {
      expect(moodDark[k].main).not.toBe(mood[k].main);
      expect(moodDark[k].soft).not.toBe(mood[k].soft);
      // 深色下的浅底应当"压深"（比卡片还暗或接近）
      expect(lum(moodDark[k].soft)).toBeLessThan(0.5);
    });
  });

  it('深色下主文字压在各底色上对比度足够（AA 4.5:1）', () => {
    // 正文落在 card / bg 上、彩色文字落在各自浅底上 —— 逐个过一遍
    const pairs: [string, string][] = [
      [dark.ink, dark.card],
      [dark.ink, dark.bg],
      [dark.ok, dark.okSoft],
      [dark.bad, dark.badSoft],
      [dark.warn, dark.warnSoft],
      [dark.accent, dark.accentSoft],
      [moodDark.ind.ink, moodDark.ind.soft],
      [moodDark.cond.ink, moodDark.cond.soft],
      [moodDark.sub.ink, moodDark.sub.soft],
      [moodDark.imp.ink, moodDark.imp.soft],
    ];
    const bad = pairs
      .map(([fg, bg]) => [contrast(fg, bg), fg, bg] as const)
      .filter(([r]) => r < 4.5);
    expect(bad).toEqual([]);
  });

  it('深色所有颜色都是 #rrggbb', () => {
    const bad: string[] = [];
    const check = (p: string, v: string) => {
      if (!/^#[0-9a-f]{6}$/.test(v)) bad.push(`${p}=${v}`);
    };
    Object.entries(dark).forEach(([k, v]) => check(`dark.${k}`, v));
    Object.entries(moodDark).forEach(([g, p]) =>
      Object.entries(p).forEach(([k, v]) => check(`moodDark.${g}.${k}`, v))
    );
    expect(bad).toEqual([]);
  });

  it('按下态与卡片阴影也各有一套深色版', () => {
    expect(pressDark.soft).not.toBe(press.soft);
    expect(pressDark.ghost).not.toBe(press.ghost);
    expect(cardShadowDark.shadowColor).not.toBe(cardShadow.shadowColor);
    // 结构一致（同键）
    expect(Object.keys(pressDark).sort()).toEqual(Object.keys(press).sort());
    expect(Object.keys(cardShadowDark).sort()).toEqual(Object.keys(cardShadow).sort());
  });

  it('默认档是 system（跟随系统深色开关）', () => {
    expect(defaultSettings().themeMode).toBe('system');
  });

  it('老存档没有 themeMode 字段 → 清洗回 system，且非法值也回 system', () => {
    expect(sanitizeSettings({}).themeMode).toBe('system');
    expect(sanitizeSettings({ themeMode: 'nonsense' }).themeMode).toBe('system');
    expect(sanitizeSettings({ themeMode: 'dark' }).themeMode).toBe('dark');
    expect(sanitizeSettings({ themeMode: 'light' }).themeMode).toBe('light');
  });
});

/** #rrggbb → 相对亮度（WCAG 2.x 公式的简化版，够用来比大小） */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** WCAG 对比度（1~21） */
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
