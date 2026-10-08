import verbsJson from '@/data/verbs.json';
import { isRefl, norm, stripAcc } from '@/utils/unicode';

/**
 * unicode.ts —— 判分与去重的共同基础。
 * isRefl 的判定必须与旧版 build_final.py / classify.py 的 is_refl 一致，
 * 否则数据侧和运行侧对「哪些是自复动词」的看法会分叉。
 */

describe('norm —— 归一化', () => {
  it('去首尾空白、转小写', () => {
    expect(norm('  Hablo  ')).toBe('hablo');
  });

  it('内部连续空白压成一个空格', () => {
    expect(norm('he   hablado')).toBe('he hablado');
    expect(norm('me\tacuesto')).toBe('me acuesto');
  });

  it('西语字母大小写正确折叠（含重音字母）', () => {
    expect(norm('PRACTIQUÉ')).toBe('practiqué');
    expect(norm('Ñ')).toBe('ñ');
  });

  it('不改动重音符本身', () => {
    expect(norm('habló')).toBe('habló');
  });

  it('非字符串输入走 String() 转换', () => {
    expect(norm(123)).toBe('123');
    expect(norm(null)).toBe('null');
  });
});

describe('stripAcc —— 去重音', () => {
  it('去掉元音重音符', () => {
    expect(stripAcc('habló')).toBe('hablo');
    expect(stripAcc('practiqué')).toBe('practique');
    expect(stripAcc('canción')).toBe('cancion');
  });

  it('ñ 归一成 n', () => {
    expect(stripAcc('mañana')).toBe('manana');
    expect(stripAcc('ñandú')).toBe('nandu');
  });

  it('ü 也归一成 u', () => {
    expect(stripAcc('pingüino')).toBe('pinguino');
  });

  it('多个重音一起处理', () => {
    expect(stripAcc('MÉXICO')).toBe('MEXICO');
  });

  it('不含重音的串原样返回', () => {
    expect(stripAcc('hablo')).toBe('hablo');
  });
});

describe('isRefl —— 自复动词判定', () => {
  it('三类变位 + se 都算自复', () => {
    expect(isRefl('acostarse')).toBe(true); // ar
    expect(isRefl('comerse')).toBe(true);   // er
    expect(isRefl('irse')).toBe(true);      // ir
  });

  it('irse 只有 4 个字母，不能被长度卡掉（历史上踩过的坑）', () => {
    expect('irse'.length).toBe(4);
    expect(isRefl('irse')).toBe(true);
  });

  it('裸的 arse / erse / irse 也算', () => {
    expect(isRefl('arse')).toBe(true);
    expect(isRefl('erse')).toBe(true);
    expect(isRefl('irse')).toBe(true);
  });

  it('普通动词不算', () => {
    expect(isRefl('hablar')).toBe(false);
    expect(isRefl('comer')).toBe(false);
    expect(isRefl('vivir')).toBe(false);
    expect(isRefl('ser')).toBe(false);
  });

  it('只是碰巧以 se 结尾的词不算（词尾必须真的是 ar/er/ir）', () => {
    expect(isRefl('case')).toBe(false);
    expect(isRefl('fase')).toBe(false);
    expect(isRefl('base')).toBe(false);
  });

  it('太短的串不算', () => {
    expect(isRefl('se')).toBe(false);
    expect(isRefl('a')).toBe(false);
    expect(isRefl('')).toBe(false);
  });

  it('大小写敏感：Se 结尾不算（数据里原形一律小写）', () => {
    expect(isRefl('acostarSe')).toBe(false);
  });

  it('空值不抛错', () => {
    expect(isRefl(null)).toBe(false);
    expect(isRefl(undefined)).toBe(false);
    expect(isRefl(0)).toBe(false);
  });

  it('与真实词表一致：30 个自复动词', () => {
    // 动态验证一次，防止词表新增自复动词后这里与数据脱节
    const verbs = (verbsJson as unknown as { v: { i: string }[] }).v;
    const refl = verbs.filter((v) => isRefl(v.i)).map((v) => v.i);
    expect(refl.length).toBe(30);
    expect(refl).toContain('acostarse');
    expect(refl).toContain('irse');
    expect(refl.every((x) => x.endsWith('se'))).toBe(true);
  });
});
