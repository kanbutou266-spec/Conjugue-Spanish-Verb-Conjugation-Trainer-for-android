import verbsJson from '@/data/verbs.json';
import type { Settings, TenseKey, Verb } from '@/data/types';
import { ALL_TENSE_KEYS, TENSES } from '@/data/tenses';
import {
  askedPersons,
  buildPool,
  codesOf,
  countByLevel,
  forms,
  formHits,
  hlOf,
  tagMatch,
  tensePoolOf,
  validPersons,
} from '@/engine/pool';

/**
 * pool.ts —— 词库与数据访问。
 * 断言的数字全部对照旧版网页的数据层回归（105 项）与 verbs_data.json 实况。
 */

const VERBS = (verbsJson as unknown as { v: Verb[] }).v;

function byInf(w: string): Verb {
  const v = VERBS.find((x) => x.i === w);
  if (!v) throw new Error(`词表里没有 ${w}`);
  return v;
}

const base: Settings = {
  levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  modes: ['produce'],
  tenses: ALL_TENSE_KEYS.slice(),
  tagFilter: '',
  inputMode: 'type',
  hideInf: false,
  vosotros: true,
  showZh: true,
  strictAccent: true,
  lang: 'zh',
  langMode: 'system',
  themeMode: 'system',
};
const cfg = (o: Partial<Settings> = {}): Settings => ({ ...base, ...o });

describe('数据不变量（迁移自旧仓库 verbs_data.json）', () => {
  it('词表共 487 个动词', () => {
    expect(VERBS.length).toBe(487);
  });

  it('等级只出现 A1–C2，且分布与旧版一致', () => {
    expect(countByLevel(VERBS, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])).toEqual({
      A1: 72, A2: 97, B1: 107, B2: 151, C1: 35, C2: 25,
    });
  });

  it('每个动词都有原形、释义、等级、词频与标签', () => {
    const bad = VERBS.filter(
      (v) =>
        !v.i || typeof v.z !== 'string' || typeof v.e !== 'string' ||
        !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(v.l) ||
        typeof v.r !== 'number' || !Array.isArray(v.g)
    );
    expect(bad).toEqual([]);
  });

  it('每个动词的每个时态都有 6 个人称形式（命令式两处例外）', () => {
    const bad: string[] = [];
    const impMissing: string[] = [];
    VERBS.forEach((v) => {
      ALL_TENSE_KEYS.forEach((k) => {
        const f = forms(v, k);
        const imp = k === 'ia' || k === 'in';
        if (!f) {
          // 助动词 haber 没有人称命令式（habe tú / no habe tú 在语法上不成立），
          // 数据里干脆没有这两个键 —— 全表仅此一例
          if (imp) {
            impMissing.push(`${v.i}.${k}`);
            return;
          }
          bad.push(`${v.i}.${k}: 不是 6 段`);
          return;
        }
        for (let i = 0; i < 6; i++) {
          const filled = !!(f[i] && f[i].trim());
          // 命令式没有 yo 这一格，数据里就该是空串
          if (imp && i === 0) {
            if (filled) bad.push(`${v.i}.${k}[0]: 命令式不该有 yo 形式`);
          } else if (!filled) {
            bad.push(`${v.i}.${k}[${i}]: 空形式`);
          }
        }
      });
    });
    expect(bad).toEqual([]);
    expect(impMissing).toEqual(['haber.ia', 'haber.in']);
  });

  it('c 与 h 的时态键集合一致，且只出现在 239 个动词上', () => {
    const withCodes = VERBS.filter((v) => v.c && Object.keys(v.c).length);
    expect(withCodes.length).toBe(239);
    const mismatch: string[] = [];
    withCodes.forEach((v) => {
      const ck = Object.keys(v.c || {}).sort().join(',');
      const hk = Object.keys(v.h || {}).sort().join(',');
      if (ck !== hk) mismatch.push(v.i);
    });
    expect(mismatch).toEqual([]);
  });

  it('着色码 c 每串 6 位、只含 . o s i', () => {
    const bad: string[] = [];
    VERBS.forEach((v) => {
      Object.entries(v.c || {}).forEach(([k, s]) => {
        if (s.length !== 6 || /[^osi.]/.test(s)) bad.push(`${v.i}.${k}=${s}`);
      });
    });
    expect(bad).toEqual([]);
  });

  it('变化区间 h 合法：0 ≤ 起 < 止 ≤ 该形式长度', () => {
    const bad: string[] = [];
    VERBS.forEach((v) => {
      Object.entries(v.h || {}).forEach(([k, row]) => {
        const f = forms(v, k as TenseKey);
        row.forEach((sp, i) => {
          if (!sp) return;
          const w = f ? f[i] : '';
          if (!(sp[0] >= 0 && sp[0] < sp[1] && sp[1] <= w.length)) {
            bad.push(`${v.i}.${k}[${i}] ${sp} vs "${w}"`);
          }
        });
      });
    });
    expect(bad).toEqual([]);
  });

  it('c[i] === "." 与 h[i] === null 严格等价', () => {
    const bad: string[] = [];
    VERBS.forEach((v) => {
      Object.entries(v.c || {}).forEach(([key, s]) => {
        const k = key as TenseKey;
        const row = (v.h || {})[k] || [];
        for (let i = 0; i < 6; i++) {
          if ((s[i] === '.') !== (!row[i])) bad.push(`${v.i}.${k}[${i}] ${s[i]} ${row[i]}`);
        }
      });
    });
    expect(bad).toEqual([]);
  });
});

describe('forms', () => {
  it('正确切出 6 个人称', () => {
    expect(forms(byInf('ser'), 'p')).toEqual(['soy', 'eres', 'es', 'somos', 'sois', 'son']);
  });

  it('自复动词的形式连代词一起返回', () => {
    expect(forms(byInf('acostarse'), 'p')![0]).toBe('me acuesto');
  });

  it('不存在的时态返回 null', () => {
    expect(forms({ i: 'x', z: '', e: '', l: 'A1', r: 1, g: [], t: {} }, 'p')).toBeNull();
  });

  it('不是 6 段的数据返回 null（不假装能用）', () => {
    const v: Verb = { i: 'x', z: '', e: '', l: 'A1', r: 1, g: [], t: { p: 'a|b|c' } };
    expect(forms(v, 'p')).toBeNull();
  });
});

describe('formHits —— 同形判定', () => {
  it('hablar 的 habla 有两种成立读法：现在时 él 与肯定命令式 tú', () => {
    expect(formHits(byInf('hablar'), 'habla')).toEqual([
      { p: 2, k: 'p' },
      { p: 1, k: 'ia' },
    ]);
  });

  it('hablar 的 hablo 只有一种读法', () => {
    expect(formHits(byInf('hablar'), 'hablo')).toEqual([{ p: 0, k: 'p' }]);
  });

  it('comprar 的 compramos 在现在时与简单过去时同形', () => {
    expect(formHits(byInf('comprar'), 'compramos')).toEqual([
      { p: 3, k: 'p' },
      { p: 3, k: 'pr' },
    ]);
  });

  it('空串与不存在的形式返回空数组', () => {
    expect(formHits(byInf('hablar'), '')).toEqual([]);
    expect(formHits(byInf('hablar'), 'zzzz')).toEqual([]);
  });

  it('读法按 TENSES 的固定顺序返回', () => {
    const hits = formHits(byInf('ser'), 'fuera');
    expect(hits.length).toBeGreaterThan(0);
    const order = hits.map((h) => ALL_TENSE_KEYS.indexOf(h.k));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('codesOf / hlOf', () => {
  it('规则动词没有着色码', () => {
    expect(codesOf(byInf('hablar'), 'p')).toBe('');
    expect(hlOf(byInf('hablar'), 'p')).toBeNull();
  });

  it('pensar 的现在时着色码是 sss..s', () => {
    expect(codesOf(byInf('pensar'), 'p')).toBe('sss..s');
  });

  it('ser 的现在时变化区间与数据一致', () => {
    expect(hlOf(byInf('ser'), 'p')).toEqual([[2, 3], [0, 2], [0, 2], [1, 2], [1, 2], [1, 2]]);
  });
});

describe('tagMatch —— 标签筛选', () => {
  it('空标签恒为真', () => {
    expect(tagMatch(byInf('hablar'), '')).toBe(true);
  });

  it('规则 / 不规则 互斥且覆盖全表', () => {
    const rule = VERBS.filter((v) => tagMatch(v, '规则')).length;
    const irr = VERBS.filter((v) => tagMatch(v, '不规则')).length;
    expect(rule).toBe(331);
    expect(irr).toBe(156);
    expect(rule + irr).toBe(487);
    expect(VERBS.filter((v) => tagMatch(v, '规则') && tagMatch(v, '不规则'))).toEqual([]);
  });

  it('其余标签走前缀匹配', () => {
    const count = (t: string) => VERBS.filter((v) => tagMatch(v, t)).length;
    expect(count('强过去式')).toBe(86);
    expect(count('高频')).toBe(122);
    expect(count('拼写变化')).toBe(65);
    expect(count('不规则分词')).toBe(25);
    expect(count('重音变化')).toBe(11);
  });

  it('「词干变化」一口气吃掉四种元音变体', () => {
    const variants = ['词干变化(e→ie)', '词干变化(o→ue)', '词干变化(e→i)', '词干变化(u→ue)'];
    const sum = variants
      .map((t) => VERBS.filter((v) => v.g.includes(t)).length)
      .reduce((a, b) => a + b, 0);
    expect(sum).toBe(92);
    expect(VERBS.filter((v) => tagMatch(v, '词干变化')).length).toBe(92);
  });

  it('pensar 同时命中不规则与词干变化，但不命中规则', () => {
    const p = byInf('pensar');
    expect(tagMatch(p, '不规则')).toBe(true);
    expect(tagMatch(p, '词干变化')).toBe(true);
    expect(tagMatch(p, '规则')).toBe(false);
  });
});

describe('validPersons / askedPersons', () => {
  it('命令式只有 5 个人称（没有 yo）', () => {
    expect(validPersons('ia')).toEqual([1, 2, 3, 4, 5]);
    expect(validPersons('in')).toEqual([1, 2, 3, 4, 5]);
  });

  it('其余时态是完整 6 个人称', () => {
    expect(validPersons('p')).toEqual([0, 1, 2, 3, 4, 5]);
    expect(validPersons('si')).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('关掉 vosotros 后不再出第 6 人称（下标 4）的题', () => {
    expect(askedPersons('p', true)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(askedPersons('p', false)).toEqual([0, 1, 2, 3, 5]);
    expect(askedPersons('ia', false)).toEqual([1, 2, 3, 5]);
  });
});

describe('tensePoolOf', () => {
  it('只保留该动词真的有形式的已选时态', () => {
    expect(tensePoolOf(byInf('hablar'), ['p', 'pr', 'zzz' as TenseKey])).toEqual(['p', 'pr']);
  });

  it('保持传入时态的顺序（调用方负责按 TENSES 排好）', () => {
    expect(tensePoolOf(byInf('ser'), ['pr', 'p'])).toEqual(['pr', 'p']);
  });

  it('时态列表为空时返回空', () => {
    expect(tensePoolOf(byInf('ser'), [])).toEqual([]);
  });
});

describe('buildPool —— 等级与标签是交集，不是并集', () => {
  it('只按等级筛：A1 得 72 个', () => {
    expect(buildPool(VERBS, cfg({ levels: ['A1'] })).length).toBe(72);
  });

  it('等级 + 标签同时生效（交集）', () => {
    const pool = buildPool(VERBS, cfg({ levels: ['A1'], tagFilter: '不规则' }));
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((v) => v.l === 'A1' && v.g.includes('不规则'))).toBe(true);
    // 严格小于「只按 A1」与「只按不规则」的较小者 → 证明是交集
    expect(pool.length).toBeLessThan(72);
  });

  it('等级 + 时态：没有该时态形式的动词被剔除', () => {
    const pool = buildPool(VERBS, cfg({ levels: ['A1'], tenses: ['p'] }));
    expect(pool.every((v) => !!forms(v, 'p'))).toBe(true);
  });

  it('六档全选时不筛掉任何动词', () => {
    expect(buildPool(VERBS, cfg()).length).toBe(487);
  });

  it('等级为空数组时词库为空', () => {
    expect(buildPool(VERBS, cfg({ levels: [] }))).toEqual([]);
  });

  it('时态为空数组时词库为空（没有任何可出的题）', () => {
    expect(buildPool(VERBS, cfg({ tenses: [] }))).toEqual([]);
  });

  it('返回的是原数组里的同一批对象引用（quiz 靠 indexOf 定位）', () => {
    const pool = buildPool(VERBS, cfg({ levels: ['A1'] }));
    expect(VERBS.indexOf(pool[0])).toBeGreaterThanOrEqual(0);
  });
});

describe('TENSES 元数据自洽', () => {
  it('15 个时态，键不重复', () => {
    expect(TENSES.length).toBe(15);
    expect(new Set(ALL_TENSE_KEYS).size).toBe(15);
  });

  it('每个时态都有中英西三语名称与分组', () => {
    TENSES.forEach((t) => {
      expect(t.zh && t.en && t.es).toBeTruthy();
      expect(['ind', 'cond', 'sub', 'imp']).toContain(t.g);
      expect([0, 1]).toContain(t.cp);
    });
  });

  it('命令式的两个人称档都是简单时态', () => {
    expect(TENSES.filter((t) => t.g === 'imp').every((t) => t.cp === 0)).toBe(true);
  });
});
