import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useSettingsStore } from '@/store/settings';
import { T } from '@/data/tenses';
import { theme } from '@/ui/theme';

import ConjTableScreen, { styles } from '@/app/(tabs)/conj-table';

/** 变位查询页 —— 对应网页右栏抽屉（renderTable / tblBlock / searchVerbs） */

jest.setTimeout(20000);

const mockBack = jest.fn();
const mockPush = jest.fn();

/* useLocalSearchParams 的返回值可按用例覆盖（作答页带 inf/t/p 跳转的高亮场景） */
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const asMock = (f: unknown) => f as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  asMock(useRouter).mockReturnValue({
    back: mockBack,
    push: mockPush,
    replace: jest.fn(),
    canGoBack: () => true,
  });
  asMock(useLocalSearchParams).mockImplementation(() => mockParams);
});

async function fresh() {
  await act(async () => {
    const st = useSettingsStore.getState();
    st.reset();
    st.setLang('zh', 'manual');
  });
  return render(<ConjTableScreen />);
}

const txt = (id: string): string => String(screen.getByTestId(id).props.children ?? '');

/** 递归取某 testID 节点下的全部文字（容器要走到内层 <Text>） */
function textsOf(testID: string): string {
  return collect(screen.getByTestId(testID).children).join('');
}

function collect(node: unknown): string[] {
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

const flatStyle = (s: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(s) || {}) as Record<string, unknown>;

describe('变位查询页', () => {
  it('默认展示 hablar：动词头 / 词库数 / 四个语式分组卡都在', async () => {
    await fresh();
    expect(txt('dw-inf')).toBe('hablar');
    expect(txt('dw-count')).toContain('487');
    for (const g of ['ind', 'cond', 'sub', 'imp']) {
      expect(screen.getByTestId(`dwg-${g}`)).toBeTruthy();
    }
  });

  it('15 个时态全渲染 + 简单过去时右侧留空位（前过去时）', async () => {
    await fresh();
    const keys = [
      'p', 'pp', 'pr', 'i', 'pq', 'f', 'fp',
      'c', 'cp', 'sp', 'spt', 'si', 'sq', 'ia', 'in',
    ];
    let rendered = 0;
    for (const k of keys) {
      // 每个时态的第一格：命令式从 tú（p1）开始，其余从 yo（p0）开始
      const first = ['ia', 'in'].includes(k) ? 'p1' : 'p0';
      if (screen.queryByTestId(`dwc-${k}-${first}`)) rendered++;
    }
    expect(rendered).toBe(15);
    // 留空位：网页 tblBlock(null) —— 只有一个，头行只画一个「—」
    expect(screen.getAllByTestId('dwb-none').length).toBe(1);
    expect(textsOf('dwb-none').trim()).toBe('—');
    // 那段「前过去时」说明文已按用户 2026-10-05 要求整段删除
    expect(screen.queryByTestId('dwg-gapnote')).toBeNull();
  });

  it('留空位那格只有「—」，没有任何说明文（说明文字已删）', async () => {
    await fresh();
    expect(screen.queryByTestId('dwg-gapnote')).toBeNull();
    // 头行那格只有「—」
    expect(textsOf('dwb-none')).not.toContain('hube');
    expect(textsOf('dwb-none')).not.toContain('留空');
  });

  it('人称行之间有极细的分割线，第一行不画（用户 2026-10-05）', async () => {
    await fresh();
    // 样式层：prowSep 就是那条 hairline
    const sep = StyleSheet.flatten(styles.prowSep) as { borderTopWidth?: number };
    expect(sep.borderTopWidth).toBeGreaterThan(0);

    // 渲染层：一个六人称的时态对有 6 行，第 1 行不带分隔线，其余 5 行都带
    const pair = screen.getByTestId('dwp-p-pp');
    interface Node {
      props?: { style?: unknown; testID?: string; children?: unknown };
      children?: unknown;
    }
    const rows: Node[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      const el = n as Node;
      const flat = StyleSheet.flatten(el.props?.style) as { flexDirection?: string } | undefined;
      if (flat?.flexDirection === 'row' && el.props?.testID === undefined) rows.push(el);
      if (el.children !== undefined) walk(el.children);
      else if (el.props?.children !== undefined) walk(el.props.children);
    };
    walk(pair);
    const styleOf = (r: Node) =>
      StyleSheet.flatten(r.props?.style) as { paddingVertical?: number; borderTopWidth?: number };
    const prowRows = rows.filter((r) => styleOf(r).paddingVertical === 1);
    expect(prowRows.length).toBe(6);
    const withSep = prowRows.filter((r) => (styleOf(r).borderTopWidth ?? 0) > 0);
    expect(withSep.length).toBe(5);
  });

  it('形式按人称一行一个；命令式从 tú 开始、没有 yo 格', async () => {
    await fresh();
    // 现在时 0 号 = yo hablo
    expect(textsOf('dwc-p-p0')).toContain('hablo');
    // 命令式肯定式：没有 0 号（yo），第一格是 1 号（tú）
    expect(screen.queryByTestId('dwc-ia-p0')).toBeNull();
    expect(screen.getByTestId('dwc-ia-p1')).toBeTruthy();
  });

  it('主语一列共用：一行里同时有简单形式和复合形式（用户 2026-10-04 排版）', async () => {
    await fresh();
    // [p, pp] 对：同一人称行里左（hablo）右（he hablado）并排，主语只出现一次
    const row = screen.getByTestId('dwp-p-pp');
    expect(JSON.stringify(row)).toContain('hablo');
    expect(JSON.stringify(row)).toContain('he hablado');
    // 一行只有一个主语标签（pl），不是左右各一套
    const pairJson = JSON.stringify(row);
    const labelCount = (pairJson.match(/"yo"/g) || []).length;
    expect(labelCount).toBeLessThanOrEqual(1);
  });

  it('动词头：原形 + 释义同行，A1 / 词性标签在标签行（用户 2026-10-04）', async () => {
    await fresh();
    // dw-inf 与 dw-zh 在同一父（vhead）里、且平级
    const vhead = screen.getByTestId('dw-inf').parent;
    expect(vhead).toBe(screen.getByTestId('dw-zh').parent);
    expect(textsOf('dw-zh')).toBeTruthy();
    // 标签行里有 A1 等级 + 高频标签（只要任一存在就说明 dw-tags 渲染了）
    const tagsRow = screen.getByTestId('dw-tags');
    expect(tagsRow).toBeTruthy();
  });

  it('虚线框外的「左简单 / 右复合 / 肯定 / 否定」列头说明文字不渲染（用户 2026-10-04）', async () => {
    await fresh();
    // 「肯定」/「否定」字面也出现在时态名「肯定命令式 / 否定命令式」里，
    // 所以光断字串不够；用结构特征：「列头说明」原是一对等宽小字文本。
    for (const g of ['ind', 'cond', 'sub', 'imp']) {
      const group = screen.getByTestId(`dwg-${g}`);
      const txt = collect(group.children).join('|');
      expect(txt).not.toContain('左简单');
      expect(txt).not.toContain('右复合');
      // 命令式原来写「肯定 / 否定」两个等宽列头——这类「独立成列的列头词」现已不再渲染
      expect(txt).not.toMatch(/^[^|]*\|肯定\|[^|]*$/m);
      expect(txt).not.toMatch(/^[^|]*\|否定\|[^|]*$/m);
    }
  });

  it('框内时态名：中文居中粗体 + 西语副文，统一两行（用户 2026-10-04）', async () => {
    await fresh();
    // 取一个时态对卡的头行，找第一格
    const pair = screen.getByTestId('dwp-p-pp');
    const headTexts = collect(pair.children).join('|');
    // 中文时态名（现在时 / 现在完成时）—— 实际文本是后者，不是「复合过去时」
    expect(headTexts).toContain('现在时');
    expect(headTexts).toContain('现在完成时');
    // 西语副文
    expect(headTexts).toMatch(/presente|perfecto/i);
  });

  it('主语列宽 = 58，能放下「ellos」/「ellas」而不折行', async () => {
    await fresh();
    // 取一对卡的人称行里一个主语 Text
    const pair = screen.getByTestId('dwp-p-pp');
    const json = JSON.stringify(pair);
    // 文本「ellos」「ellas」应在场（陈述式非命令式 p/pp 都列出 6 格）
    expect(json).toContain('ellos');
    expect(json).toContain('ellas');
    // 主语列 pl 的 width 必须是 58（旧值会让 ell/ellas 折行）
    expect(styles.pl.width).toBe(58);
  });

  it('带 inf/t/p 参数进来：那一对卡和人称格都高亮（配色跟语式走）', async () => {
    mockParams = { inf: 'vestir', t: 'pq', p: '3' };
    await fresh();
    expect(txt('dw-inf')).toBe('vestir');
    // 高亮那一对卡的边框/底色跟着**该时态的语式**走（网页 `.dwb.hi` 用 --gb/--gs）
    const hiMood = theme.mood[T.pq.g];
    const pair = screen.getByTestId('dwp-i-pq');
    expect(flatStyle(pair.props.style).backgroundColor).toBe(hiMood.soft);
    expect(flatStyle(pair.props.style).borderColor).toBe(hiMood.border);
    // 复合侧 pq 的 3 号格高亮（人称格走强调色浅底，与网页 .pcell.hi 同口径）
    const cell = screen.getByTestId('dwc-pq-p3');
    expect(flatStyle(cell.props.style).backgroundColor).toBe(theme.color.accentSoft);
    // 没被点名的时态对保持卡片底
    expect(flatStyle(screen.getByTestId('dwp-p-pp').props.style).backgroundColor).toBe(
      theme.color.card
    );
  });

  it('查询框：按建议切动词，切完建议列表收起', async () => {
    await fresh();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('dw-q'), 'vestir');
    });
    const sug = screen.getByTestId('dw-sug');
    expect(sug).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('sug-vestir'));
    });
    expect(txt('dw-inf')).toBe('vestir');
    // 输入框已清空、建议列表消失（query === 当前动词时也不再出现）
    expect(String(screen.getByTestId('dw-q').props.value ?? '')).toBe('');
    expect(screen.queryByTestId('dw-sug')).toBeNull();
  });

  it('查不到时给「没找到」提示', async () => {
    await fresh();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('dw-q'), 'zzzzzz');
    });
    expect(screen.getByTestId('dw-sug')).toBeTruthy();
    expect(textsOf('dw-sug')).toContain('没找到');
  });

  it('页脚有 RAE 官方外链', async () => {
    await fresh();
    expect(txt('rae-link')).toContain('RAE');
  });
});
