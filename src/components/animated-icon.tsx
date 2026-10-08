import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, Modal, StyleSheet, Text, View } from 'react-native';

import { systemLang, tr } from '@/i18n';

/** 藏掉原生启动屏后再停留的时长（用户要看清品牌） */
const HOLD = 600;
/** 淡出时长 */
const FADE = 900;
/** onShow 之外的安全兜底：万一 Modal 的 onShow 没触发，别把用户钉在原生启动屏上 */
const HIDE_SAFETY = 600;

/**
 * 开屏品牌页（2026-10-02 用户定稿）：应用名 + 副标题，替代原来 Expo 模板的 logo。
 *
 * 2026-10-07 晚换上方案 C 的「á」标记（`scripts/gen-app-icon.mjs` 产出，tight
 * 透明底，宽高比 45:79.5）。尺寸与原生启动屏对齐：原生启动屏把 288dp 画布里的
 * 标记缩到 0.70（= 79.5 × 0.70 × 2.4 ≈ 134dp 高），这层就按 134pt 高摆 ——
 * 原生启动屏消失、这层接管时标记不跳动。底色同样与原生启动屏/`colors.xml`
 * 三处一致（#2f6df6）。
 *
 * ⚠️⚠️ **必须用 `Modal` 承载，不能用「绝对定位的兄弟节点」**（2026-10-07 深夜定论）：
 * 这层挂在根布局里、和 `<Stack>` 平级。RN 的 `zIndex` 只在父容器是 ReactViewGroup
 * 时生效，而根布局这层没有可见的 View 祖先（`ThemeProvider`/`NavigationContainer`
 * 都不建 View），两个兄弟直接挂在根视图上 —— 根视图是普通 FrameLayout，绘制顺序
 * 按 addChild 顺序，`<Stack>` 排在后面就把这层整个盖住；`elevation` 也压不过
 * react-native-screens 路由容器自己的 Z 轴。逐帧截图实测：zIndex 1000、elevation 50
 * 全部无效，蓝屏一结束直接是主页。
 * `Modal` 在 Android 上是**独立的 Dialog 窗口**，天然浮在 activity 全部内容之上，
 * 从根上绕开 Z 轴问题。
 *
 * ⚠️ 淡出**故意不用 reanimated**：这层是 App 挂载后的第一批组件，冷启慢的机器上
 * reanimated 的 UI 线程常常还没就绪，`Keyframe` 入场动画整段不被接走、视图停在
 * 初始透明态。改用 RN 内置 `Animated.timing`（JS 驱动 + native driver），挂载即
 * 不透明，只依赖定时器，最坏情况是「没有淡出动画、到点直接消失」，品牌一定展示满 HOLD。
 *
 * ⚠️ 原生启动屏**等 Modal 真正上屏再藏**（`onShow`），不留「主页露一帧」的缝；
 * 另给 HIDE_SAFETY 兜底，防个别机型 onShow 不回调把用户钉在启动屏上。
 *
 * 语言**跟随系统**而不是设置里的手动语言 —— 此刻 persist 还没灌水（zustand
 * hydrate 是异步的），读 store 会拿到默认值；而且用户要的就是"开屏永远对系统语言"。
 * 纯函数 `tr(systemLang(), …)` 不碰 store，没有时序问题。
 */
export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    const safety = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), HIDE_SAFETY);
    const t1 = setTimeout(() => {
      RNAnimated.timing(opacity, { toValue: 0, duration: FADE, useNativeDriver: true }).start();
    }, HOLD);
    const t2 = setTimeout(() => setVisible(false), HOLD + FADE + 80);
    return () => {
      clearTimeout(safety);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [opacity]);

  const lang = systemLang();

  return (
    <Modal
      visible={visible}
      /** transparent：Dialog 窗口本身透明，淡出时透出的是**真正的 App**（真交叉
          淡化）。不透明档实测会透出 Dialog 窗口自带的浅色底 —— 蓝屏淡出中途
          「发白一闪」再跳到深色主页（10-07 录屏 f0025/f0026 逐帧确认）。 */
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => SplashScreen.hideAsync().catch(() => {})}
      onRequestClose={() => {}}
    >
      <RNAnimated.View style={[styles.splashOverlay, { opacity }]}>
        <View style={styles.brandBox}>
          <Image
            source={require('@/assets/images/splash-icon.png')}
            style={styles.logoMark}
            accessibilityLabel={tr(lang, 'brand')}
          />
          <Text style={styles.brand}>{tr(lang, 'brand')}</Text>
          <Text style={styles.brandSub}>{tr(lang, 'brandSub')}</Text>
        </View>
      </RNAnimated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** Modal 的根：撑满整个 Dialog 窗口（statusBar/navigationBarTranslucent 已全屏化） */
  splashOverlay: {
    flex: 1,
    backgroundColor: '#2f6df6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 品牌名：开屏主视觉（对应设置里那 4 个全局项之外的视觉层） */
  brandBox: { alignItems: 'center', gap: 10 },
  /** 与原生启动屏同视觉高度（134pt，宽按 tight 图 45:79.5 的比例） */
  logoMark: { width: 76, height: 134 },
  brand: {
    fontSize: 44,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
});
