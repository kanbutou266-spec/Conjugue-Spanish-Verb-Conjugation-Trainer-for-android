import { INF_MODES, MODES, MODE_KEYS, modeDesc, modeName, modeOf } from '@/data/modes';

describe('modes · 四个练习模式', () => {
  it('顺序与网页 MODES 一致（辨认 → 复现 → 转换 → 平移）', () => {
    expect(MODE_KEYS).toEqual(['recognize', 'produce', 'shift', 'transfer']);
    expect(MODES.map((m) => m.k)).toEqual(MODE_KEYS);
    expect(MODES).toHaveLength(4);
  });

  it('每个模式都有非空的中英名与规则', () => {
    const bad: string[] = [];
    MODES.forEach((m) => {
      if (!m.zh.trim()) bad.push(`${m.k}.zh`);
      if (!m.en.trim()) bad.push(`${m.k}.en`);
      if (!m.d.trim()) bad.push(`${m.k}.d`);
      if (!m.ed.trim()) bad.push(`${m.k}.ed`);
      if (!m.icon.trim()) bad.push(`${m.k}.icon`);
    });
    expect(bad).toEqual([]);
  });

  it('图标名与方案 §7.1 的 lucide 映射一致', () => {
    expect(MODES.map((m) => m.icon)).toEqual([
      'eye',
      'pencil',
      'repeat',
      'arrow-left-right',
    ]);
  });

  it('modeName / modeDesc 按语言取，未知 key 兜底', () => {
    expect(modeName('recognize')).toBe('辨认模式');
    expect(modeName('recognize', 'en')).toBe('Recognition');
    expect(modeName('nope' as never)).toBe('nope');

    expect(modeDesc('produce')).toBe('给出人称与时态，直接写出变位');
    expect(modeDesc('produce', 'en')).toBe('Given a person and a tense, write the form');
    expect(modeDesc('nope' as never)).toBe('');
  });

  it('modeOf 命中与未命中', () => {
    expect(modeOf('shift')?.zh).toBe('转换模式');
    expect(modeOf('nope' as never)).toBeUndefined();
  });

  it('规则文案：只讲怎么玩，不重复模式名（用户 2026-10-03 定）', () => {
    expect(modeDesc('recognize')).toBe('看一个变位形式，判断人称、时态');
    expect(modeDesc('transfer')).toBe('照 A 动词的时态和人称，写出 B 动词的变位');
    expect(modeDesc('produce')).toContain('写出变位');
    expect(modeDesc('shift')).toContain('只换一个时态');
    // 首页那行现在**只显示 modeDesc**，所以描述里一旦出现模式名,
    // 界面上就是同一句话说两遍 —— 这里逐个模式把这条钉死
    MODES.forEach((m) => {
      expect(m.d).not.toContain(m.zh);
      expect(m.ed).not.toContain(m.en);
    });
  });

  it('INF_MODES：隐藏原形只对 辨认/转换/平移 生效，不含复现', () => {
    expect(INF_MODES).toEqual(['recognize', 'shift', 'transfer']);
    expect(INF_MODES).not.toContain('produce');
    INF_MODES.forEach((k) => expect(MODE_KEYS).toContain(k));
  });
});
