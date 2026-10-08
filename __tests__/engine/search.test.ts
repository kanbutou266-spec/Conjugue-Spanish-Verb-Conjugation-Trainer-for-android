import { T } from '@/data/tenses';
import { VERBS } from '@/data/verbs';
import { defaultTableVerb, searchVerbs } from '@/engine/search';

/** 搜索引擎 —— 口径逐条对照网页 `searchVerbs()` */

const infOf = (idx: number): string => VERBS[idx].i;

describe('变位查询搜索引擎', () => {
  it('空查询返回空列表', () => {
    expect(searchVerbs('')).toEqual([]);
    expect(searchVerbs('   ')).toEqual([]);
  });

  it('① 原形前缀命中排最前：habl 的第一条是 hablar', () => {
    const hits = searchVerbs('habl');
    expect(hits.length).toBeGreaterThan(0);
    expect(infOf(hits[0].idx)).toBe('hablar');
    // 前缀命中不带形式信息
    expect(hits[0].form).toBe('');
    expect(hits[0].tk).toBe('');
  });

  it('② 原形包含命中排在前缀之后：bla 也能找到 hablar', () => {
    const hits = searchVerbs('bla');
    const hab = hits.find((h) => infOf(h.idx) === 'hablar');
    expect(hab).toBeTruthy();
  });

  it('③ 释义能搜（中文）', () => {
    const hits = searchVerbs('穿');
    expect(hits.some((h) => infOf(h.idx) === 'vestir')).toBe(true);
  });

  it('④ 变位形式反查：hable 能找到 hablar，并带时态信息', () => {
    const hits = searchVerbs('hable');
    const hab = hits.find((h) => infOf(h.idx) === 'hablar');
    expect(hab).toBeTruthy();
    expect(hab!.form).toBe('hable');
    // hable 在虚拟式现在时 / 肯定命令式里都有 —— 索引只记第一个，但一定是合法时态
    expect(T[hab!.tk as keyof typeof T]).toBeTruthy();
  });

  it('同一动词只出现一次（四路召回去重）', () => {
    const hits = searchVerbs('habl');
    const infs = hits.map((h) => infOf(h.idx));
    expect(new Set(infs).size).toBe(infs.length);
  });

  it('结果总数封顶 24（网页 add() 的 out.length >= 24）', () => {
    // 'a' 几乎命中所有动词
    expect(searchVerbs('a').length).toBeLessThanOrEqual(24);
  });

  it('默认动词是 hablar（网页 DW_VERB 同款）', () => {
    expect(defaultTableVerb()).toBe('hablar');
  });
});
