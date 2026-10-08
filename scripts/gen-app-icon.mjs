/**
 * 生成「变位君」的整套图标资源。
 *
 * 设计源：`D:\我爱学习！！\语言\espanol\动词变位\logo-设计方案.html` 的
 * **方案 C · 重音符号 á**（用户 2026-10-07 晚改选，原先做过一版 B1 田字）。
 * 120×120 设计栅格：品牌蓝渐变满底 + 白色几何小写「a」（环形碗 + 右竖笔）
 * + 金色重音符号。
 *
 * ⚠️ 重音方向（用户 10-07 明确指出的问题）：西语的 acute accent `´` 是
 *    **左下 → 右上**。方案 C 首版画成了「左上 → 右下」（那是法语 grave ` 的方向），
 *    已修正。判据写在 `TILDE` 常量上：x2 > x1 且 y2 < y1（SVG 的 y 轴向下）。
 *
 * 为什么用 Playwright：本项目 `gen-tab-icons.mjs` 已是这条路，沙箱里也没有
 * sharp / cairosvg；同一个无头 Chromium 渲染，跨平台一致，且是矢量缩放，
 * 1024px 与 48px 的排版完全同源、不会走形。
 *
 * 为什么直接写 `android/.../res`：仓库当时还没有任何 commit，跑 `expo prebuild`
 * 没有回退手段；而资源就是每个密度 5 个文件 + 启动屏 1 个，直接替换最可控。
 * app.json 里的 assets（icon/adaptiveIcon/splash）也同步换成了本脚本的产物，
 * 所以将来真跑 prebuild，结果也是同一套图。
 *
 * 用法（RN 仓库根目录，无需环境变量）：
 *   node scripts/gen-app-icon.mjs
 *
 * 产出：
 *   assets/brand/*.svg                       ← 矢量母版（改设计改这里，再重跑）
 *   assets/images/{icon,splash-icon,favicon,logo-badge}.png 等
 *   android/.../res/mipmap-…/ic_launcher…png         ← 启动器图标（各密度，PNG）
 *   android/.../res/drawable-…/splashscreen_logo.png ← 原生启动屏（各密度）
 *
 * ⚠️ 两个颜色必须多处一致：
 *    · `SPLASH_BG` = `app.json` 的 expo-splash-screen backgroundColor
 *      = `res/values/colors.xml` 的 splashscreen_background
 *      = `src/components/animated-icon.tsx` 的 splashOverlay 底色。
 *    · `FALLBACK_BG` = `app.json` 的 adaptiveIcon.backgroundColor
 *      = `res/values/colors.xml` 的 iconBackground（渐变底图的兜底色）。
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES = resolve(ROOT, 'assets/images');
const BRAND = resolve(ROOT, 'assets/brand');
const RES = resolve(ROOT, 'android/app/src/main/res');

/* ============================== 设计常量 ============================== */

/** 品牌蓝渐变（与 logo 提案页同一组值） */
const GRAD_DEFS =
  '<defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#5b93ff"/><stop offset="1" stop-color="#255ee0"/>' +
  '</linearGradient></defs>';

const WHITE = '#ffffff';
/** 重音符号的金色（方案 C 原值）。蓝底上对比度 3.2:1，做图形够用 */
const GOLD = '#ffd166';

/** 这两个底色必须与 app.json / res/values/colors.xml 逐字一致 */
export const FALLBACK_BG = '#2f6df6';
export const SPLASH_BG = '#2f6df6';

/* ---------- 「á」的几何（120 栅格，坐标是「居中之前」的） ---------- */

/**
 * 小写 a 的碗：**实心圆挖孔**（不是描边环）。
 *
 * 为什么不用 plan C 首版的「描边环 + 独立竖笔」：渲染出来竖笔与环之间有一条
 * 缝，读起来像「ól」而不是「a」。改成「实心圆 + 竖笔融合 + 挖孔」后，
 * 字腔（洞）偏左、竖笔长在右侧，才是单层 a 的正确结构。
 */
const BOWL = { cx: 52, cy: 72, rOut: 21, rIn: 10.5 };
/** 右竖笔：顶略高出碗顶（光学补偿），底与基线（碗底）齐 */
const STEM = { x: 64.5, y: 49.5, w: 11.5, h: 44, rx: 5.75 };
/**
 * 重音符号 —— **左下 → 右上**（x2 > x1 且 y2 < y1）。
 * 画反了就会变成 `\`（grave），用户 10-07 指出的就是这个。
 */
const TILDE = { x1: 44.5, y1: 34, x2: 68.5, y2: 19, w: 11 };
/** 整组平移，把 á 的 bbox 挪到画布正中 */
const MARK_SHIFT = 'translate(6.5 6.75)';
/** 居中后 á 的 bbox（= tight 版 PNG 的 viewBox，也用于算安全半径） */
const MARK_BOX = { x: 37.5, y: 20.25, w: 45, h: 79.5 };
/** 以画布中心 (60,60) 为原点，á 最远那一点的距离（竖笔右下圆头） */
const MARK_R = 44.1;

/**
 * 安卓自适应图标安全区缩放。
 *
 * ⚠️ 安全区是**圆**不是方形：官方口径是 108dp 画布中央 66dp 直径的圆
 * （真机 Pixel 启动器实测可见圆 ≈ 0.62 × 画布 → 半径 ≈ 37.2 设计单位）。
 * á 的最远点距中心 44.1，要落进 37.2 的圆 → 0.84 是上限，取 0.84。
 */
const SAFE_ART = 0.84;

/**
 * 安卓 12+ 系统启动屏专用缩放。
 * `windowSplashScreenAnimatedIcon` 会被铺满 **288dp 容器再裁成圆形**（真机实测
 * 可见圆 ≈ 画布的 2/3 → 半径 96dp = 40 设计单位）。这里画布是 288dp，1 单位 = 2.4dp，
 * 所以 44.3 × k × 2.4 ≤ 96 → k ≤ 0.90；取 0.70 让 á 占可见圆的 ~67%（不塞满）。
 */
const SAFE_SPLASH = 0.70;

/* ============================== SVG 片段 ============================== */

/**
 * 「á」标记 = 实心圆挖孔的碗 + 融合的右竖笔 + 重音。
 *
 * 挖孔用 `<mask>`（前景层底是透明的，不能用「画一个底色圆」来假装挖孔）。
 * ⚠️ mask 内容坐标是 userSpaceOnUse —— 显式写死，别依赖默认值（各家实现在
 * mask 内容嵌进变换过的 `<g>` 时有分歧，10-07 踩过）。
 * ⚠️ 所有属性一律**行内**写死（不用文档级 CSS）：这些图形会被 `<use>` /
 * `<mask>` 卷进影子树，CSS 不保证作用得到。
 */
const mark = (ink, accent) =>
  `<defs><mask id="ahole" maskContentUnits="userSpaceOnUse">` +
  `<rect x="-20" y="-20" width="160" height="160" fill="#ffffff"/>` +
  `<circle cx="${BOWL.cx}" cy="${BOWL.cy}" r="${BOWL.rIn}" fill="#000000"/>` +
  `</mask></defs>` +
  `<g transform="${MARK_SHIFT}">` +
  `<g mask="url(#ahole)">` +
  `<circle cx="${BOWL.cx}" cy="${BOWL.cy}" r="${BOWL.rOut}" fill="${ink}"/>` +
  `<rect x="${STEM.x}" y="${STEM.y}" width="${STEM.w}" height="${STEM.h}" rx="${STEM.rx}" fill="${ink}"/>` +
  `</g>` +
  `<line x1="${TILDE.x1}" y1="${TILDE.y1}" x2="${TILDE.x2}" y2="${TILDE.y2}" ` +
  `stroke="${accent}" stroke-width="${TILDE.w}" stroke-linecap="round"/>` +
  `</g>`;

/** 绕画布中心缩放 */
const scaled = (inner, k) => `<g transform="translate(60 60) scale(${k}) translate(-60 -60)">${inner}</g>`;

/** 圆角底板 */
const PLATE_RAD = 27; // = 22.5%，安卓自适应 / iOS 蒙版的常用比例
const plate = (fill) => `<rect x="0" y="0" width="120" height="120" rx="${PLATE_RAD}" fill="${fill}"/>`;

/** 拼一个完整 SVG（尺寸必须显式给出，避免浏览器默认 300×150） */
const svg = (body, size, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">${defs}${body}</svg>`;

/** tight 版：viewBox 正好框住 á（给启动屏用，避免大片留白撑小主体） */
const svgTight = (body, h, defs = '') => {
  const w = Math.round((h * MARK_BOX.w) / MARK_BOX.h);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.w} ${MARK_BOX.h}">${defs}${body}</svg>`
  );
};

/* ---------- 六种成图 ---------- */

/** 满幅不透明渐变（应用图标本尊，交给系统蒙版） */
const artSquare = () => `<rect width="120" height="120" fill="url(#brand)"/>` + mark(WHITE, GOLD);
/** 自适应背景层：满幅渐变，不留白边（蒙版自己裁） */
const artBg = () => `<rect width="120" height="120" fill="url(#brand)"/>`;
/** 圆角渐变板（徽标 / favicon / 矢量母版；四角透明） */
const artPlate = () => plate('url(#brand)') + mark(WHITE, GOLD);
/** 自适应前景：只有 á，缩进安全圆，背景透明 */
const artForeground = () => scaled(mark(WHITE, GOLD), SAFE_ART);
/** 单色剪影（主题图标染成单色后仍是 á 的形状） */
const artMono = () => scaled(mark(WHITE, WHITE), SAFE_ART);
/** 安卓 12+ 系统启动屏：只有 á，缩到可见圆的 ~2/3 */
const artSplashSystem = () => scaled(mark(WHITE, GOLD), SAFE_SPLASH);
/** 启动屏 tight 版（App 内品牌页 + pre-12 兼容层）：只有 á，无边距 */
const artSplashTight = () => mark(WHITE, GOLD);

/* ============================== 产出清单 ============================== */

/** 启动屏 tight 图的像素高度；JS 品牌页按同一个视觉高度摆放（见 animated-icon.tsx） */
const TIGHT_H = 512;

const JOBS = [
  /* ---------- 矢量母版 ---------- */
  { dir: BRAND, name: 'logo-mark-plate.svg', size: 512, doc: svg(artPlate(), 512, GRAD_DEFS), note: '圆角板母版' },
  { dir: BRAND, name: 'logo-mark-square.svg', size: 512, doc: svg(artSquare(), 512, GRAD_DEFS), note: '满幅方形母版' },
  { dir: BRAND, name: 'logo-mark-mono.svg', size: 512, doc: svg(artMono(), 512), note: '单色剪影母版' },

  /* ---------- assets/images（app.json 引用的那一层） ---------- */
  {
    dir: IMAGES,
    name: 'icon.png',
    size: 1024,
    doc: svg(artSquare(), 1024, GRAD_DEFS),
    note: '应用图标（iOS / 遗产；不透明满幅）',
  },
  {
    dir: IMAGES,
    name: 'android-icon-background.png',
    size: 1024,
    doc: svg(artBg(), 1024, GRAD_DEFS),
    note: '安卓自适应背景（满幅渐变）',
  },
  {
    dir: IMAGES,
    name: 'android-icon-foreground.png',
    size: 1024,
    doc: svg(artForeground(), 1024),
    note: '安卓自适应前景（á 缩进安全圆）',
  },
  {
    dir: IMAGES,
    name: 'android-icon-monochrome.png',
    size: 1024,
    doc: svg(artMono(), 1024),
    note: '主题图标单色剪影',
  },
  {
    dir: IMAGES,
    name: 'splash-icon.png',
    size: TIGHT_H,
    doc: svgTight(artSplashTight(), TIGHT_H),
    note: '启动屏主视觉（tight，透明底）',
  },
  {
    dir: IMAGES,
    name: 'favicon.png',
    size: 128,
    doc: svg(artPlate(), 128, GRAD_DEFS),
    note: 'web favicon',
  },
  {
    dir: IMAGES,
    name: 'logo-badge.png',
    size: 216,
    doc: svg(artPlate(), 216, GRAD_DEFS),
    note: '「关于」页徽标（54pt × 4 倍图）',
  },
];

/**
 * 安卓各密度（写入 `android/.../res`）。
 * 尺寸 = dp × 密度倍数；dp 值必须与 Expo 生成的那套完全一致：
 *   ic_launcher / ic_launcher_round = 48dp，自适应前景/单色/背景 = 108dp，
 *   splashscreen_logo = 288dp（系统启动屏容器）。
 */
const ANDROID_DPI = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];
const LEGACY_DP = 48;
const LAYER_DP = 108;
const SYSSPLASH_DP = 288;

for (const [dpi, k] of ANDROID_DPI) {
  JOBS.push(
    {
      dir: resolve(RES, `mipmap-${dpi}`),
      name: 'ic_launcher.png',
      size: LEGACY_DP * k,
      doc: svg(artSquare(), LEGACY_DP * k, GRAD_DEFS),
      note: '',
    },
    {
      dir: resolve(RES, `mipmap-${dpi}`),
      name: 'ic_launcher_round.png',
      size: LEGACY_DP * k,
      doc: svg(artSquare(), LEGACY_DP * k, GRAD_DEFS),
      note: '',
    },
    {
      dir: resolve(RES, `mipmap-${dpi}`),
      name: 'ic_launcher_foreground.png',
      size: LAYER_DP * k,
      doc: svg(artForeground(), LAYER_DP * k),
      note: '',
    },
    {
      dir: resolve(RES, `mipmap-${dpi}`),
      name: 'ic_launcher_monochrome.png',
      size: LAYER_DP * k,
      doc: svg(artMono(), LAYER_DP * k),
      note: '',
    },
    {
      dir: resolve(RES, `mipmap-${dpi}`),
      name: 'ic_launcher_background.png',
      size: LAYER_DP * k,
      doc: svg(artBg(), LAYER_DP * k, GRAD_DEFS),
      note: '',
    },
    {
      dir: resolve(RES, `drawable-${dpi}`),
      name: 'splashscreen_logo.png',
      size: SYSSPLASH_DP * k,
      doc: svg(artSplashSystem(), SYSSPLASH_DP * k),
      note: '',
    }
  );
}

/** 被 PNG 取代 / 已废弃的旧文件（同名不同扩展会判重复资源） */
const STALE = [
  // 上一版（B1 田字）的矢量母版
  resolve(BRAND, 'logo-b1.svg'),
  resolve(BRAND, 'logo-b1-square.svg'),
  resolve(BRAND, 'logo-b1-badge.svg'),
  resolve(BRAND, 'logo-b1-mono.svg'),
  // 自适应背景改用 `@mipmap/ic_launcher_background` 后，旧矢量底不要了
  resolve(RES, 'drawable', 'ic_launcher_background.xml'),
];
for (const [dpi] of ANDROID_DPI) {
  for (const f of [
    'ic_launcher',
    'ic_launcher_round',
    'ic_launcher_foreground',
    'ic_launcher_monochrome',
    'ic_launcher_background',
  ]) {
    STALE.push(resolve(RES, `mipmap-${dpi}`, `${f}.webp`));
  }
}

/* ============================== 栅格化 ============================== */

/**
 * 载入托管的 playwright：沙箱里裸 `import 'playwright'` 找不到（ESM 不认
 * NODE_PATH），所以按 `gen-tab-icons.mjs` 的老办法写死一条绝对路径兜底。
 */
async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_HOME &&
      pathToFileURL(resolve(process.env.PLAYWRIGHT_HOME, 'playwright/index.js')).href,
    'playwright',
    pathToFileURL('C:/Users/123/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js').href,
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return await import(c);
    } catch {
      /* 换下一个 */
    }
  }
  throw new Error('找不到 playwright：设 PLAYWRIGHT_HOME 或在本项目里 npm i -D playwright');
}

async function main() {
  const mod = await loadPlaywright();
  const chromium = mod.chromium ?? mod.default?.chromium;
  if (!chromium) throw new Error('playwright 载入成功但拿不到 chromium');

  mkdirSync(IMAGES, { recursive: true });
  mkdirSync(BRAND, { recursive: true });

  for (const f of STALE) {
    if (existsSync(f)) rmSync(f);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const job of JOBS) {
    mkdirSync(job.dir, { recursive: true });
    if (job.name.endsWith('.svg')) {
      writeFileSync(resolve(job.dir, job.name), job.doc + '\n');
    } else {
      // 位图走浏览器栅格化（矢量母版已直接落盘）
      const html =
        '<body style="margin:0;background:transparent">' +
        `<div id="box" style="display:inline-block;line-height:0">${job.doc}</div></body>`;
      await page.setContent(html);
      const buf = await page.locator('#box').screenshot({ omitBackground: true });
      writeFileSync(resolve(job.dir, job.name), buf);
    }
    const rel = job.dir.startsWith(BRAND)
      ? `assets/brand/${job.name}`
      : job.dir.startsWith(IMAGES)
        ? `assets/images/${job.name}`
        : `android/.../res/${job.name}`;
    console.log(`${rel.padEnd(46)} ${String(Math.round(job.size)).padStart(4)}px  ${job.note}`);
  }

  console.log(`\n自适应兜底色  ${FALLBACK_BG}   （app.json + res/values/colors.xml）`);
  console.log(`启动屏底色    ${SPLASH_BG}   （app.json + colors.xml + 开屏组件）`);
  console.log(`前景安全缩放  ${SAFE_ART}（最远点 ${MARK_R} / 可见圆半径 37.2）`);
  console.log(`启动屏缩放    ${SAFE_SPLASH}（画布 288dp，可见圆半径 96dp）`);
  // 这台机器上 chromium 的关闭会挂住（沙箱），文件已经写盘 —— 别 await close
  browser.close().catch(() => {});
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
