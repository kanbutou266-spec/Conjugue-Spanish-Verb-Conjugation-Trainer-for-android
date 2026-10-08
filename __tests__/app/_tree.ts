import { screen } from '@testing-library/react-native';

/**
 * 页面测试公用的两个取文本小工具。
 *
 * RNTL 的 `getByTestId(...).props.children` 只拿**直接**子节点，容器（Card、View）
 * 里嵌着好几层时拿不到字；`textsOf` 递归把整棵子树的字符串拼起来，
 * 用来断言"这一段里有/没有某个词"最省事。
 */

/** 递归收集任意节点下的全部字符串 */
export function collect(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (n === null || n === undefined || typeof n === 'boolean') return;
    if (typeof n === 'string' || typeof n === 'number') {
      out.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    const el = n as { children?: unknown; props?: { children?: unknown } };
    if (el.children !== undefined) walk(el.children);
    else if (el.props?.children !== undefined) walk(el.props.children);
  };
  walk(node);
  return out;
}

/** 某 testID 节点下的全部文字（不带分隔符） */
export function textsOf(testID: string): string {
  return collect(screen.getByTestId(testID).children).join('');
}

/** 某 testID 节点下的全部文字，元素之间用 `sep` 隔开（断言顺序或"独立成段"时用） */
export function partsOf(testID: string, sep = '|'): string {
  return collect(screen.getByTestId(testID).children).join(sep);
}

/** 直接子节点就是一段文字的节点的文本（`<Text testID>xx</Text>` 这种） */
export function txt(testID: string): string {
  return String(screen.getByTestId(testID).props.children ?? '');
}
