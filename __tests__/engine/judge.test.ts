import verbsJson from '@/data/verbs.json';
import type { PersonIdx, Question, TenseKey, Verb } from '@/data/types';
import { cleanAnswer, diagnose, diagOf, judge, siAlt } from '@/engine/judge';

/**
 * judge.ts —— 判分。
 * 对照旧版 app_template.html 的 cleanAnswer / siAlt / judge / diagOf。
 */

const VERBS = (verbsJson as unknown as { v: Verb[] }).v;
const byInf = (w: string): Verb => VERBS.find((x) => x.i === w)!;

describe('cleanAnswer —— 剔除多写的代词与标点', () => {
  it('去首尾空白', () => {
    expect(cleanAnswer('  hablo  ')).toBe('hablo');
  });

  it('保留大小写（比较交给 norm 处理）', () => {
    expect(cleanAnswer('Hablo')).toBe('Hablo');
  });

  it('去掉首尾的西语标点', () => {
    expect(cleanAnswer('¡Hable!')).toBe('Hable');
    expect(cleanAnswer('¿Hablas?')).toBe('Hablas');
    expect(cleanAnswer('hablo.')).toBe('hablo');
  });

  it('去掉多写的显式主语代词', () => {
    expect(cleanAnswer('yo hablo')).toBe('hablo');
    expect(cleanAnswer('él habla')).toBe('habla');
    expect(cleanAnswer('nosotros hablamos')).toBe('hablamos');
  });

  it('自复动词的 me / te / se 是答案的一部分，不能当多余代词删掉', () => {
    expect(cleanAnswer('me acuesto')).toBe('me acuesto');
    expect(cleanAnswer('se acuesta')).toBe('se acuesta');
    expect(cleanAnswer('nos vamos')).toBe('nos vamos');
  });

  it('内部多余空白压成一个空格', () => {
    expect(cleanAnswer('he   hablado')).toBe('he hablado');
  });

  it('纯标点或空串得到空串', () => {
    expect(cleanAnswer('')).toBe('');
    expect(cleanAnswer('¿?')).toBe('');
    expect(cleanAnswer('   ')).toBe('');
  });

  it('非字符串输入不抛错（内部走 String() 转换）', () => {
    expect(() => cleanAnswer(null)).not.toThrow();
    expect(() => cleanAnswer(undefined)).not.toThrow();
  });
});

describe('siAlt —— 虚拟式过去未完成时的 -ra / -se 互换', () => {
  it('-ra 系换 -se 系', () => {
    expect(siAlt('hablara')).toBe('hablase');
    expect(siAlt('comiera')).toBe('comiese');
    expect(siAlt('hubiera')).toBe('hubiese');
  });

  it('-se 系换回 -ra 系', () => {
    expect(siAlt('hablase')).toBe('hablara');
    expect(siAlt('comiese')).toBe('comiera');
  });

  it('复数人称同样成立', () => {
    expect(siAlt('habláramos')).toBe('hablásemos');
    expect(siAlt('hablarais')).toBe('hablaseis');
    expect(siAlt('hablaran')).toBe('hablasen');
  });

  it('复合时态只换第一个词（haber 部分）', () => {
    expect(siAlt('hubiera hablado')).toBe('hubiese hablado');
    expect(siAlt('hubiese hablado')).toBe('hubiera hablado');
  });

  it('按后缀长度优先匹配，不会先吃掉短的', () => {
    // 'hablarais' 应命中 5 字母后缀 'arais'，而不是 3 字母的 'ara'
    expect(siAlt('hablarais')).toBe('hablaseis');
  });

  it('不长于后缀的词不换（避免误伤）', () => {
    expect(siAlt('era')).toBe('era');
    expect(siAlt('hablar')).toBe('hablar');
  });
});

describe('judge —— 判分', () => {
  it('完全一致判对', () => {
    expect(judge('hablo', 'hablo', true, 'p')).toEqual({ ok: true, soft: false });
  });

  it('忽略大小写与首尾空白', () => {
    expect(judge('  HABLO ', 'hablo', true, 'p')).toEqual({ ok: true, soft: false });
  });

  it('多写了主语代词仍判对', () => {
    expect(judge('yo hablo', 'hablo', true, 'p')).toEqual({ ok: true, soft: false });
  });

  it('自复动词带对代词才判对，漏代词判错', () => {
    expect(judge('me acuesto', 'me acuesto', true, 'p')).toEqual({ ok: true, soft: false });
    expect(judge('acuesto', 'me acuesto', true, 'p')).toEqual({ ok: false, soft: false });
  });

  it('重音打错：严格模式判错，但标记 soft', () => {
    expect(judge('hablo', 'habló', true, 'p')).toEqual({ ok: false, soft: true });
  });

  it('重音打错：宽松模式判对，仍标记 soft（用于给提示）', () => {
    expect(judge('hablo', 'habló', false, 'p')).toEqual({ ok: true, soft: true });
  });

  it('ñ 与 n 的差异也算重音问题', () => {
    expect(judge('manana', 'mañana', false, 'p')).toEqual({ ok: true, soft: true });
  });

  it('-ra / -se 在 si 时态下互通，两种写法都判对', () => {
    expect(judge('hablase', 'hablara', true, 'si')).toEqual({ ok: true, soft: false });
    expect(judge('hablara', 'hablase', true, 'si')).toEqual({ ok: true, soft: false });
  });

  it('-ra / -se 互通只对 si / sq 生效，别的时态不认', () => {
    expect(judge('hablase', 'hablara', true, 'p')).toEqual({ ok: false, soft: false });
  });

  it('复合时态的 -ra / -se 互通', () => {
    expect(judge('hubiese hablado', 'hubiera hablado', true, 'sq')).toEqual({
      ok: true,
      soft: false,
    });
  });

  it('备选答案数组：命中任一个都判对', () => {
    expect(judge('hablas', ['hablo', 'hablas'], true, 'p')).toEqual({ ok: true, soft: false });
  });

  it('备选答案数组的每一个都能触发重音宽容', () => {
    expect(judge('habló', ['hablo', 'hablas'], false, 'p')).toEqual({ ok: true, soft: true });
  });

  it('多打一个字母属于真错，不是重音宽容', () => {
    expect(judge('hablos', ['hablo', 'hablas'], false, 'p')).toEqual({ ok: false, soft: false });
  });

  it('空答案一律判错，且不标 soft', () => {
    expect(judge('', 'hablo', true, 'p')).toEqual({ ok: false, soft: false });
    expect(judge('   ', 'hablo', false, 'p')).toEqual({ ok: false, soft: false });
    expect(judge('¿?', 'hablo', false, 'p')).toEqual({ ok: false, soft: false });
  });

  it('正确答案为 null / 空数组时不崩，判错', () => {
    expect(judge('hablo', null, true, 'p')).toEqual({ ok: false, soft: false });
    expect(judge('hablo', [], true, 'p')).toEqual({ ok: false, soft: false });
  });

  it('答得完全不相干判错', () => {
    expect(judge('comiendo', 'hablo', true, 'p')).toEqual({ ok: false, soft: false });
  });
});

describe('diagnose / diagOf —— 错因定性', () => {
  it('词干变化 → stem', () => {
    // pensar 现在时 él 是 piensa（e→ie）
    expect(diagnose(byInf('pensar'), 'p', 0)).toBe('stem');
  });

  it('正字法变化 → orth', () => {
    // entregar 简单过去时 yo 是 entregué（c→qu）
    expect(diagnose(byInf('entregar'), 'pr', 0)).toBe('orth');
  });

  it('其他不规则 → irr', () => {
    expect(diagnose(byInf('ser'), 'p', 0)).toBe('irr');
  });

  it('规则形式返回 null（没有可说的）', () => {
    expect(diagnose(byInf('hablar'), 'p', 0)).toBeNull();
    // pensar 的 nosotros 是规则的，同属该时态但不该给诊断
    expect(diagnose(byInf('pensar'), 'p', 3)).toBeNull();
  });

  it('动词不存在时返回 null 而不是抛错', () => {
    expect(diagnose(undefined, 'p', 0)).toBeNull();
  });

  const fakeQ = (mode: Question['mode'], tense: TenseKey, tense2?: TenseKey): Question =>
    ({ mode, tense, tense2, person: 0 as PersonIdx }) as Question;

  it('diagOf 普通模式看本题时态', () => {
    expect(diagOf(fakeQ('produce', 'p'), byInf('pensar'))).toBe('stem');
  });

  it('diagOf 转换模式看目标时态 tense2', () => {
    // 现在时是词干变化，简单过去时是规则的 → 诊断应跟着 tense2 走
    expect(diagOf(fakeQ('shift', 'p', 'pr'), byInf('pensar'))).toBeNull();
    expect(diagOf(fakeQ('shift', 'pr', 'p'), byInf('pensar'))).toBe('stem');
  });
});
