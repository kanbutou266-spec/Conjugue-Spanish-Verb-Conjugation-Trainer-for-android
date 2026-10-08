/**
 * Jest 配置 —— 引擎层（src/engine、src/utils、src/i18n）是纯逻辑，必须单测；
 * 数据层（src/data）与 store（src/store）的纯函数、UI 层（src/ui）的渲染色
 * 同样纳入覆盖率。
 *
 * preset: jest-expo 会自动处理 RN 组件、transformIgnorePatterns、JSON 导入。
 */
const expoPreset = require('jest-expo/jest-preset');

/**
 * `lucide-react-native` 是**纯 ESM 包**（main 走 dist/esm/*.mjs），
 * jest-expo 默认的"转译白名单"里没有它 → 直接 import 会报 `Unexpected token 'export'`。
 * 这里在预设的正则里补一个包名，再给 `.mjs` 补一条 transform（预设只认 .[jt]sx?）。
 * 用「读预设再改」而不是「手抄一份」——升级 jest-expo 时不会漏掉它新增的包。
 */
const needTransform = 'lucide-react-native';
const transformIgnorePatterns = (expoPreset.transformIgnorePatterns || []).map((p) =>
  p.replace('/node_modules/(?!(', `/node_modules/(?!(?:${needTransform}|`)
);

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  /**
   * ⚠️ 默认 5s 对**页面级**用例太紧：某个文件里第一个渲染整棵页面树的用例
   * 要付冷启动开销，机器一忙（比如同时开着模拟器）就会 `Exceeded timeout of 5000 ms`。
   * 这不是代码有问题，是默认值不合适 —— 少数文件里已经各自 `jest.setTimeout(20000)`，
   * 但漏掉的那个（slot-settings）就会偶发失败。统一提到 20s，省得以后再加文件又踩。
   */
  testTimeout: 20000,
  // tsconfig 里的 "@/*" 路径别名，让测试与源码用同一套导入写法；
  // AsyncStorage 在 Node 里没有原生实现，指向官方提供的 jest mock
  //
  // ⚠️ **顺序有意义**：moduleNameMapper 是按书写顺序取第一条命中的。
  // `src/constants/theme.ts` 里有 `import '@/global.css'`，若不把 `\.css$`
  // 排在 `^@/` 前面，它会被 `^@/` 抢先解析成 `<rootDir>/src/global.css`，
  // 于是又把 CSS 拉进 jest 报 `Unexpected token ':'`（踩过）。
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/style-mock.js',
    // `@/assets/*` 是 tsconfig 里**比 `@/*` 更具体**的一条（指向仓库根的 assets/，
    // 而不是 src/assets/）。这里必须照抄同样的优先级：按书写顺序取第一条命中，
    // 所以这条要排在 `^@/` 前面，否则 `require('@/assets/images/donation.png')`
    // 会被解析成 `src/assets/...` 报 "Could not locate module"。
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
  transform: {
    ...expoPreset.transform,
    '^.+\\.mjs$': expoPreset.transform['\\.[jt]sx?$'],
  },
  transformIgnorePatterns,
  collectCoverageFrom: [
    'src/engine/**/*.{ts,tsx}',
    'src/utils/**/*.{ts,tsx}',
    'src/ui/**/*.{ts,tsx}',
    'src/i18n/**/*.{ts,tsx}',
    'src/data/settings.ts',
    'src/data/modes.ts',
    'src/store/**/*.{ts,tsx}',
    // 两张语言表是**纯数据**（每行一个键，没有分支），统计进来只会虚高整体覆盖率
    '!src/i18n/zh.ts',
    '!src/i18n/en.ts',
    // 同理：纯类型声明文件
    '!src/i18n/types.ts',
    '!**/*.d.ts',
  ],
};
