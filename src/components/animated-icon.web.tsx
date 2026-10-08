/**
 * web 平台没有原生启动屏，品牌页直接不渲染（native 版才有，见
 * `animated-icon.tsx`）。保留同名导出让 `@/components/animated-icon`
 * 的引用在两个平台上都对得上。
 *
 * 2026-10-07：删掉了 Expo 模板残留的 `AnimatedIcon`（expo-logo / logo-glow
 * 死代码）—— 自家 logo 只出现在「关于」页（`about.tsx` 的 logo-badge）。
 */
export function AnimatedSplashOverlay() {
  return null;
}
