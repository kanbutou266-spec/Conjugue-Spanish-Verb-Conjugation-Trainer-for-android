/**
 * CSS 文件的 jest 替身 —— 空模块。
 *
 * `src/constants/theme.ts` 顶部有一句 `import '@/global.css'`（web 端需要它注入样式），
 * 于是**任何**导入 `@/constants/theme` 的模块（比如练习首页要用 `BottomTabInset`）
 * 都会顺着这条链把 `.css` 拉进 jest —— 而 jest 不认识 CSS，会报
 * `SyntaxError: Unexpected token ':'`。映射成空模块即可。
 */
module.exports = {};
