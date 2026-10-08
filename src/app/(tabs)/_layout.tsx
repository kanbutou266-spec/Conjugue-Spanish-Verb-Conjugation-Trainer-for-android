import AppTabs from '@/components/app-tabs';

/**
 * `(tabs)` 路由组 —— 底部四个 tab（练习 / 讲解 / 变位表 / 我的）。
 *
 * 真正的导航器在 `components/app-tabs.tsx` 里（原生走 `NativeTabs`、web 走 `expo-router/ui`），
 * 这里只是把它挂进 expo-router 的文件路由。
 *
 * 为什么要多这一层：`slot-settings` 是**推入式全屏页**（方案 §3.9），
 * 直接放在 `src/app/` 下会被当成第三个 tab。用 `(tabs)` 分组把 tab 们圈起来，
 * 外面的根 `_layout.tsx` 就能用 Stack 把 `slot-settings` 盖在 tab 之上。
 * `(.)` 这种分组名**不进 URL**，所以 `/`、`/guide`、`/conj-table`、`/me` 四个地址都没变。
 */
export default function TabsLayout() {
  return <AppTabs />;
}
