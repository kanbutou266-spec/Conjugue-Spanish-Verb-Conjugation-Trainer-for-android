/* 给 **RN 的 web 预览** 截图 + 自检 —— 改完 UI 后不开手机也能先看一眼。
 *
 * 为什么不用网页版那个 `run_headless.js`：
 *   那个走 `file://` 打开单文件 HTML；这里要访问的是 **http://localhost**，
 *   是 Metro 现打的包，URL 形态与等待条件都不同，所以分开。
 *
 * 前置：另开一个终端把 web 服务起起来
 *   npm run web                     # 默认 http://localhost:8081
 *   CI=1 npx expo start --web --clear   # CI=1 不自动开浏览器；
 *                                       # ⚠️ CI 模式禁用 watch，改完代码必须重启才会生效
 *
 * 用法（在项目根目录）：
 *   node scripts/shot-web.js <url> <out.png> [W,H] [mustHave]
 *
 *   url       http://localhost:8081（或 /explore）
 *   out.png   输出路径，同时会写一张 <out>_viewport.png（只截首屏）
 *   W,H       viewport，默认 420,2200（420 ≈ 常见手机逻辑宽度）
 *   mustHave  逗号分隔的「必须出现在页面文字里」的串；前缀 ! 表示"必须不出现"。
 *             例：'开发预览,零基础 · A1 起步,!Welcome to Expo'
 *
 * 输出一段 JSON：mounted（关键卡片是否挂上）、每条 mustHave 的命中情况、
 * pageerror / console.error 列表、页面文字开头 400 字（用来快速判断渲染到哪了）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* playwright 装在哪随机器而变（换台机器用户名就变了），按候选列表找 */
function loadPlaywright() {
  const dirs = [
    process.env.ESCONJ_PW_DIR,
    path.join(os.homedir(), '.workbuddy', 'binaries', 'node', 'workspace'),
    ROOT,
    path.join(ROOT, 'node_modules'),
  ].filter(Boolean);
  for (const d of dirs) {
    for (const p of [path.join(d, 'node_modules', 'playwright'), path.join(d, 'playwright')]) {
      try {
        return require(p);
      } catch (e) {
        /* 继续找下一个 */
      }
    }
  }
  try {
    return require('playwright');
  } catch (e) {
    /* fallthrough */
  }
  console.error(
    '找不到 playwright。先装：\n' +
      '  cd %USERPROFILE%/.workbuddy/binaries/node/workspace\n' +
      '  npm install playwright && node node_modules/playwright/cli.js install chromium-headless-shell'
  );
  process.exit(3);
}
const { chromium } = loadPlaywright();

(async () => {
  const [, , url, out, sizeArg, mustArg] = process.argv;
  if (!url || !out) {
    console.error('usage: node scripts/shot-web.js <url> <out.png> [W,H] [mustHave]');
    process.exit(2);
  }
  const [w, h] = (sizeArg || '420,2200').split(',').map((n) => parseInt(n, 10));
  const must = (mustArg || '').split(',').map((s) => s.trim()).filter(Boolean);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--force-device-scale-factor=2',
      /* 环境里挂着 HTTP(S)_PROXY，Chromium 会当真：
         访问 localhost 也要过代理 → 连不上，或者启动/关闭时被代理拖住。
         本机 web 预览一律直连。 */
      '--no-proxy-server',
    ],
  });

  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('CONSOLE ' + m.text());
    });

    /* 首次请求要等 Metro 现打包，给足时间 */
    await page.goto(url, { waitUntil: 'load', timeout: 180000 });

    /* 等真正的页面挂上来，比单纯 sleep 可靠 */
    let mounted = true;
    try {
      await page.waitForSelector(
        '[data-testid="card-quiz"],[data-testid="card-progress"]',
        { timeout: 180000 }
      );
    } catch (e) {
      mounted = false;
    }
    await page.waitForTimeout(2500);

    const text = await page.evaluate(() => document.body.innerText || '');

    const checks = must.map((raw) => {
      const neg = raw.startsWith('!');
      const needle = neg ? raw.slice(1) : raw;
      const hit = text.indexOf(needle) > -1;
      return { needle, want: !neg, hit, pass: hit === !neg };
    });

    fs.writeSync(
      1,
      JSON.stringify(
        {
          mounted,
          textLen: text.length,
          checks,
          errors: errors.slice(0, 10),
          head: text.slice(0, 400).replace(/\n+/g, ' | '),
        },
        null,
        1
      ) + '\n'
    );

    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
    await page.screenshot({ path: out.replace(/\.png$/, '_viewport.png'), fullPage: false });
    fs.writeSync(1, 'shot ' + out + '\n');
  } finally {
    /* headless shell 关不干净：close() 有时一直挂着不 resolve，
       表现就是「图都出来了命令却要等到超时」。给它 3 秒就强制走人 ——
       JSON 是同步写的，截图在 screenshot() resolve 时已经落盘，都不会丢。 */
    await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
  }
  process.exit(0);
})().catch((e) => {
  console.error('ERR ' + ((e && e.message) || e));
  process.exit(1);
});
