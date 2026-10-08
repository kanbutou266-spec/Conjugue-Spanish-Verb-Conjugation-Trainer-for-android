import { useRouter } from 'expo-router';

import ConjTableScreen from '@/app/(tabs)/conj-table';

/**
 * 推入式变位查询页 —— 从练习作答页点「变位表」按钮进来。
 *
 * 与 tab 版本的差别（用户 2026-10-04）：
 *  · 走根 Stack，不在 (tabs) 内 → 不显示底栏；
 *  · 顶栏左侧多一个退键，点一下 **退回 practice**（不是回到练习 tab），
 *    `from=practice` 参数让 router.back 沿着栈退。
 *
 * tab 版本（`app/(tabs)/conj-table.tsx`）由底栏第三个 tab 进入，无退键、无参数。
 */
export default function ConjLookupScreen() {
  const router = useRouter();
  return (
    <ConjTableScreen
      showBackButton
      onBack={() => {
        // 显式 navigate 到 /practice，避开「先回到 tabs 群再 back」两步路径
        if (router.canGoBack()) router.back();
        else router.navigate('/practice');
      }}
    />
  );
}