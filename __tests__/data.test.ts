import verbs from '../src/data/verbs.json';

/**
 * 环境自检：确认动词数据已从旧仓库迁移且结构未变。
 * 这条测试同时验证 jest + jest-expo + JSON 导入链路可用。
 */
describe('动词数据（迁移自旧仓库 verbs_data.json）', () => {
  const list = (verbs as { v: any[] }).v;

  it('包含 487 个动词', () => {
    expect(list.length).toBe(487);
  });

  it('每个动词都有原形、等级与变位表', () => {
    expect(
      list.every(
        (v) => typeof v.i === 'string' && v.i.length > 0 && typeof v.l === 'string' && !!v.t
      )
    ).toBe(true);
  });

  it('ser 的陈述式现在时正确', () => {
    const ser = list.find((v) => v.i === 'ser');
    expect(ser).toBeTruthy();
    expect(ser!.t.p).toBe('soy|eres|es|somos|sois|son');
  });

  it('等级只出现 A1–C2', () => {
    const levels = new Set(list.map((v) => v.l));
    expect([...levels].every((l) => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(l))).toBe(true);
  });
});
