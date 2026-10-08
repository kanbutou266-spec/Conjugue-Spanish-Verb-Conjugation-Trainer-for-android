import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useMemo } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { dark, light, useIsDark } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

/**
 * 根布局：一个 Stack，三层屏。
 *
 * - `(tabs)`：底部 tab（**练习 / 讲解 / 变位表 / 我的**，用户 2026-10-04 定顺序），
 *   导航器在 `components/app-tabs.tsx`；
 * - `practice`：练习作答页，**推入式全屏**（方案 §3.2）—— 开练之后底部 tab 栏消失，
 *   顶栏换成「返回 / 变位表 / 进度 / 正确率」，把整屏让给题干与作答区；
 * - `slot-settings`：自定义槽设置页，**推入式全屏**（方案 §3.9）；
 * - `conj-lookup`：从 practice 点「变位表」进来的变位查询页，**推入式全屏**，
 *   无底栏、有退键、退回 practice（用户 2026-10-04）；
 * - `guide/[slug]`：讲解详情页（从「讲解」tab 推入）；
 * - `stats` / `settings` / `about`：从「我的」推入的三个子页（2026-10-04 组装）。
 *
 * 三屏都 `headerShown: false` —— 顶栏由页面自己画，
 * 这样能沿用 App 自己的视觉语言（accent 主色、`← 返回` 文案），
 * 不用去调 React Navigation 的原生标题栏样式。
 *
 * 转场（用户 2026-10-02 定）：设置类页面一律 **从右往左推入、从左往右退走**，
 * 层级关系一眼可见（安卓原生栈的默认动画是自下而上淡入，跟"推入下一层"对不上）。
 *
 * ⚠️ 这里用的是 **`ios_from_right` 而不是 `slide_from_right`** —— 用户反馈
 * 「编辑页出来得太慢」。两者方向一致，差别在时长（react-native-screens 的
 * Android 动画资源）：
 *   · `slide_from_right` → `@android:integer/config_mediumAnimTime` = **300ms**
 *   · `ios_from_right`   → `@android:integer/config_shortAnimTime`  = **150ms**
 * 而且 `ios_from_right` 是 iOS 那种"新页压着旧页推进"的视差（前景 100%→0%、
 * 背景 0%→−30%），观感上也更像"推进一层"，比纯平移更利落。
 * （`animationDuration` 这个选项只对 iOS 的 fade/slide_from_bottom 那几种生效，
 *  安卓这条路调不动，所以只能换动画种类。）
 *
 * ⚠️ **导航容器的配色必须跟 App 自己的 `themeMode` 走**（2026-10-06 修）——
 * 原来写的是 `useColorScheme() === 'dark' ? DarkTheme : DefaultTheme`，只认**系统**
 * 开关：设置里选「深色」而系统是浅色时，导航容器仍拿 `DefaultTheme`（background 是
 * 白的），于是题干框 / 输入框 / 返回键底下露白。现在改成：
 *   · 深浅判断走 `useIsDark()`（认 `themeMode`，跟随档才看系统）；
 *   · `colors` 整组换成 `src/ui/theme.ts` 的调色板，和页面里画的是同一套色，
 *     不留 React Navigation 默认色（它的 `card` 是纯白、`text` 是纯黑）。
 */
export default function RootLayout() {
  const isDark = useIsDark();

  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    const p = isDark ? dark : light;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: p.accent,
        background: p.bg,
        card: p.card,
        text: p.ink,
        border: p.line,
      },
    };
  }, [isDark]);

  return (
    <ThemeProvider value={navTheme}>
      {/* 状态栏图标色跟 App 的深浅走：`app.json` 的 `userInterfaceStyle:"automatic"`
          只让原生主题跟**系统**，用户在设置里选深色而系统是浅色时，状态栏会变成
          深色图标压在深色底上（看不见）。这里显式覆盖。 */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* 开屏品牌页：放在 Stack **之前**（B1 版当时验证可用的排布）。zIndex 之外
          再给 elevation —— react-native-screens 的路由容器在 Android 上有自己的
          Z 轴，光靠 zIndex/绘制顺序会被主页盖住（2026-10-07 逐帧截图实测）。 */}
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* 作答页同样是"推入下一层"的语义，用同一条更快的转场 */}
        <Stack.Screen
          name="practice"
          options={{ headerShown: false, animation: 'ios_from_right' }}
        />
        <Stack.Screen
          name="slot-settings"
          options={{ headerShown: false, animation: 'ios_from_right' }}
        />
        {/* 从 practice 点「变位表」进来的推入式版本：与 tab 版本同组件，
            但走根 Stack，无底栏、退回 practice（用户 2026-10-04）。 */}
        <Stack.Screen
          name="conj-lookup"
          options={{ headerShown: false, animation: 'ios_from_right' }}
        />
        {/* 「我的」下挂的三个页面（2026-10-04 组装）：都是推入式全屏，退回「我的」 */}
        <Stack.Screen
          name="stats"
          options={{ headerShown: false, animation: 'ios_from_right' }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false, animation: 'ios_from_right' }}
        />
        <Stack.Screen
          name="about"
          options={{ headerShown: false, animation: 'ios_from_right' }}
        />
        {/* 讲解详情页：从「讲解」目录推入，退回目录 tab */}
        <Stack.Screen
          name="guide/[slug]"
          options={{ headerShown: false, animation: 'ios_from_right' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
