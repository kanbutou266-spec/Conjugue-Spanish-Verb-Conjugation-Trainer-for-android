/**
 * 深色模式防回归：**组件里不许写死颜色**。
 *
 * 背景（用户 2026-10-06 报的 bug）：`practice.tsx` / `conj-table.tsx` /
 * `guide/[slug].tsx` / `GuideBody.tsx` / `PresetCarousel.tsx` 等文件里散着
 * 20 多处 `backgroundColor: '#ffffff'`，还有一堆 `borderColor: '#bcd0fa'`
 * 之类的浅色。它们绕过了 `theme.color.*`，于是**深色下这些块原样留白**，
 * 而上面的字却跟着调色板变成了浅色 —— 白底浅字，直接看不清。
 * 底栏 `app-tabs.tsx` 更彻底：读的是 Expo 模板残留的 `Colors`，压根不认
 * `themeMode`。
 *
 * 这个测试把「写死颜色」这件事钉死：组件源码里出现非白名单的十六进制色值
 * 就直接失败，逼着后来人走 `useTheme()`。
 */
import fs from 'fs';
import path from 'path';

import { dark, light, mood, moodDark, press, pressDark } from '@/ui/theme';

const SRC = path.join(__dirname, '..', '..', 'src');

/**
 * 允许写死的颜色（都有明确理由，不是"懒得改"）：
 *   · `#ffffff` / `#fff` —— 铺在强调色 / 深色填充上的白字白图标。
 *     深色下这类底**本身**就是亮色（accent / ok / bad / 深色药丸），
 *     字继续留白才是对的，跟着调色板变反而会看不见。
 *   · `#1b1d21` / `#2b3038` —— 主语药丸的深底（对应网页 `.pill.dark`），
 *     深浅两色下都该是"深底白字"，所以故意不跟主题走。
 *   · `#2f6df6` —— 开屏品牌页的底色（`animated-icon`），与主题无关：
 *     它必须与 app.json 的 splash backgroundColor、安卓 `res/values/colors.xml`
 *     的 splashscreen_background **三处逐字一致**，所以只能写死。
 *     （2026-10-07 从 Expo 模板蓝 `#208AEF` 换成 App 的品牌蓝。）
 *   · `rgba(...)` —— 半透明遮罩/阴影，两套主题共用。
 */
const ALLOWED_LITERALS = new Set([
  '#ffffff',
  '#fff',
  '#1b1d21',
  '#2b3038',
  '#2f6df6',
]);

/** 调色板本体不算违规（它就是定义颜色的地方） */
const SKIP_FILES = new Set([path.join('ui', 'theme.ts')]);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

/** 去掉注释后再扫，否则文档里举例说明的老色值会误报 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')) // 块注释 → 占位保行号
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // 行注释（避开 http:// ）
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

describe('深色模式 · 组件里不许写死颜色', () => {
  const files = walk(SRC).filter((f) => {
    const rel = path.relative(SRC, f);
    return !SKIP_FILES.has(rel) && !/\.(test|spec)\./.test(rel);
  });

  it('扫到了源码文件（防止 glob 写错导致这个测试变成空转）', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('没有非白名单的十六进制色值', () => {
    const bad: string[] = [];
    for (const f of files) {
      const rel = path.relative(SRC, f).replace(/\\/g, '/');
      const lines = stripComments(fs.readFileSync(f, 'utf8')).split(/\r?\n/);
      lines.forEach((line, i) => {
        const hits = line.match(HEX);
        if (!hits) return;
        for (const h of hits) {
          const norm = h.toLowerCase();
          if (ALLOWED_LITERALS.has(norm)) continue;
          bad.push(`${rel}:${i + 1}  ${h}   ← ${line.trim().slice(0, 70)}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('浅色系（白/灰/浅蓝）一律不许写死 —— 它们是深色下留白的元凶', () => {
    const bad: string[] = [];
    /** 亮色调色板里"浅"的那些值，写死任何一个都会在深色下露白 */
    const lightSurfaces = [
      light.bg,
      light.card,
      light.card2,
      light.raise,
      light.line,
      light.line2,
      light.lineAcc,
      light.tag,
      press.soft,
      press.softBorder,
      press.ghost,
      light.accentSoft,
      light.okSoft,
      light.badSoft,
      light.warnSoft,
      light.muteInk,
      light.bodyInk,
      light.bodyInk2,
      light.faint,
      mood.ind.soft,
      mood.ind.border,
      mood.cond.soft,
      mood.imp.soft,
      mood.sub.soft,
    ]
      .map((c) => c.toLowerCase())
      // #ffffff 是白名单（铺在强调色上的白字），别在这里重复报
      .filter((c) => !ALLOWED_LITERALS.has(c));
    for (const f of files) {
      const rel = path.relative(SRC, f).replace(/\\/g, '/');
      const src = stripComments(fs.readFileSync(f, 'utf8')).toLowerCase();
      for (const c of lightSurfaces) {
        if (src.includes(c)) bad.push(`${rel} 里写死了 ${c}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('深色调色板里的底色也不许写死（会造成"半深半浅"）', () => {
    const bad: string[] = [];
    const darkSurfaces = [dark.card2, dark.raise, dark.tag, pressDark.soft, moodDark.ind.soft].map(
      (c) => c.toLowerCase()
    );
    for (const f of files) {
      const rel = path.relative(SRC, f).replace(/\\/g, '/');
      const src = stripComments(fs.readFileSync(f, 'utf8')).toLowerCase();
      for (const c of darkSurfaces) {
        if (src.includes(c)) bad.push(`${rel} 里写死了 ${c}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('底栏用的是 useTheme()，不是模板残留的 Colors', () => {
    for (const name of ['app-tabs.tsx', 'app-tabs.web.tsx']) {
      const code = stripComments(fs.readFileSync(path.join(SRC, 'components', name), 'utf8'));
      // 配色必须来自我们的调色板
      expect(code).toContain('useTheme');
      // 不许再出现模板那套 `Colors`，也不许自己读 useColorScheme
      // （那会绕过设置里的 themeMode："系统浅色 + 用户选深色"时底栏就白了）
      expect(code).not.toMatch(/\bColors\b/);
      expect(code).not.toContain('useColorScheme');
      // 从 constants/theme 只允许借布局常量（Spacing / MaxContentWidth）
      const imports = code.match(/import\s*\{[^}]*\}\s*from\s*'@\/constants\/theme'/g) ?? [];
      for (const imp of imports) {
        expect(imp).not.toMatch(/Colors|ThemeColor|Fonts/);
      }
    }
  });

  it('根布局的导航主题跟 themeMode 走，且配色来自我们的调色板', () => {
    const code = stripComments(fs.readFileSync(path.join(SRC, 'app', '_layout.tsx'), 'utf8'));
    // 深浅判断必须走 useIsDark（认设置里的 themeMode）；直接读 useColorScheme
    // 会只认**系统**开关 —— "系统浅色 + 用户选深色"时导航容器仍是白的
    expect(code).toContain('useIsDark');
    expect(code).not.toContain('useColorScheme');
    // React Navigation 的 DefaultTheme 的 background/card 是白/浅灰，
    // 必须整组换成我们的调色板，否则 Stack 容器一露底就是白的
    expect(code).toMatch(/background:\s*p\.bg/);
    expect(code).toMatch(/card:\s*p\.card/);
    expect(code).toMatch(/text:\s*p\.ink/);
    expect(code).toMatch(/border:\s*p\.line/);
    // 两套调色板都得引进来
    expect(code).toMatch(/import\s*\{[^}]*\bdark\b[^}]*\blight\b[^}]*\}\s*from\s*'@\/ui\/theme'/);
  });

  it('Expo 模板残留的 Colors / themed-* 已彻底删除', () => {
    const gone = [
      'components/themed-text.tsx',
      'components/themed-view.tsx',
      'components/web-badge.tsx',
      'components/hint-row.tsx',
      'components/ui/collapsible.tsx',
      'hooks/use-theme.ts',
      'hooks/use-color-scheme.ts',
      'hooks/use-color-scheme.web.ts',
    ];
    for (const g of gone) {
      expect(fs.existsSync(path.join(SRC, g))).toBe(false);
    }
    // 布局常量文件还在，但不再导出配色
    const constants = fs.readFileSync(path.join(SRC, 'constants', 'theme.ts'), 'utf8');
    expect(constants).toContain('BottomTabInset');
    expect(constants).not.toMatch(/export const Colors/);
  });
});
