/**
 * 生成底栏 tab 的 PNG 图标（1x/2x/3x）—— `assets/images/tabIcons/`。
 *
 * 为什么需要脚本：`expo-router` 的 **NativeTabs 只吃图片资源**，不吃
 * `lucide-react-native` 的组件（它是 SVG 组件，原生底栏拿不到）。
 * 手画几何图形又会和 App 里其它 Lucide 图标风格对不上，所以这里改成
 * **把 Lucide 的矢量路径原样栅格化**：
 *
 *   1. 从 `lucide-react-native/dist/esm/icons/<name>.mjs` 里读出路径数据
 *      （这个包已经把每个图标的 `node` 数组单独放好了，解析出来就是 JSON）；
 *   2. 拼成一个 24×24 的 SVG；
 *   3. 用 Playwright 的无头 Chromium 按 24 / 48 / 72 三种尺寸截图（透明底）。
 *
 * 用法（在 RN 仓库根目录）：
 *   NODE_PATH=<托管 node workspace>/node_modules node scripts/gen-tab-icons.mjs
 *
 * 加新 tab 图标就在下面 NAMES 里加一行，然后重跑 —— 别手工往 tabIcons 里塞图。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICON_SRC = resolve(ROOT, 'node_modules/lucide-react-native/dist/esm/icons');
const OUT_DIR = resolve(ROOT, 'assets/images/tabIcons');

/** 图标名（lucide）→ 输出文件前缀 */
const NAMES = [
  ['house', 'home'],
  ['graduation-cap', 'guide'],
  ['table', 'table'],
  ['user-round', 'me'],
];

/** 三种密度：1x / 2x / 3x（安卓 mdpi/xhdpi/xxhdpi 的底栏图标惯例） */
const SIZES = [
  ['', 24],
  ['@2x', 48],
  ['@3x', 72],
];

/**
 * lucide 的图标数据是 **JS 对象字面量**（键没加引号：`{ d: "M12 …" }`），
 * 不是合法 JSON。这里做个极小的转换：把「字符串外面」的裸键加上引号，
 * 再交给 `JSON.parse` —— 比 `eval` 安全，也不用为了几个图标把 babel 拉进来。
 */
function quoteKeys(text) {
  let out = '';
  let inStr = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += text[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(i));
      const word = m[0];
      let j = i + word.length;
      while (/\s/.test(text[j] ?? '')) j++;
      if (text[j] === ':') {
        out += `"${word}"`;
        i += word.length;
        continue;
      }
      out += word;
      i += word.length;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** 从 .mjs 里抠出 `node: [...]` 那段并解析 */
function iconNodes(name) {
  const file = resolve(ICON_SRC, `${name}.mjs`);
  if (!existsSync(file)) throw new Error(`找不到图标源码：${file}`);
  const src = readFileSync(file, 'utf8');
  const at = src.indexOf('node: [');
  if (at < 0) throw new Error(`${name} 里没找到 node 数组`);
  const start = src.indexOf('[', at);
  // 括号配对找到数组结束（数组里可能有字符串含 ]，这里按「成对」走更稳）
  let depth = 0;
  let end = -1;
  let inStr = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`${name} 的 node 数组没闭合`);
  return JSON.parse(quoteKeys(src.slice(start, end)));
}

function svgOf(name, size) {
  const nodes = iconNodes(name);
  const body = nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${tag} ${a} />`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    'viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" ' +
    `stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  );
}

/**
 * Playwright 装在**托管 node workspace** 里（本机没往项目里装它）。
 * ESM 的解析规则不看 NODE_PATH，所以只能按绝对路径动态 import；
 * 顺手保留两个回退：环境变量 `PLAYWRIGHT_HOME` 与项目本地安装。
 */
async function loadPlaywright() {
  const { pathToFileURL } = await import('node:url');
  const candidates = [
    process.env.PLAYWRIGHT_HOME
      ? pathToFileURL(resolve(process.env.PLAYWRIGHT_HOME, 'playwright/index.js')).href
      : null,
    'playwright',
    pathToFileURL(
      'C:/Users/123/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js'
    ).href,
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
  // CJS 包走动态 import 时具名导出可能探测不到，统一从 default 兜一层
  const chromium = mod.chromium ?? mod.default?.chromium;
  if (!chromium) throw new Error('playwright 载入成功但拿不到 chromium');
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const [icon, base] of NAMES) {
    for (const [suffix, size] of SIZES) {
      const svg = svgOf(icon, size);
      await page.setContent(
        `<body style="margin:0;background:transparent"><div id="box" style="display:inline-block;line-height:0">${svg}</div></body>`
      );
      const buf = await page.locator('#box').screenshot({ omitBackground: true });
      const out = resolve(OUT_DIR, `${base}${suffix}.png`);
      writeFileSync(out, buf);
      console.log(`${base}${suffix}.png  ${size}x${size}`);
    }
  }
  // 这台机器上 chromium 的关闭会挂住（沙箱），图已经写盘了 —— 别 await close
  browser.close().catch(() => {});
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
