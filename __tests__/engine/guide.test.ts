import { GUIDE, GUIDE_MAP, TENSE_GUIDE, guideBody, guideVerbs } from '@/data/guide';
import { VERBS } from '@/data/verbs';
import { parseGuide } from '@/engine/guide';

import type { Block, Inline } from '@/engine/guide';

/** 把行内节点摊平成纯文本（断言内容用） */
const flat = (kids: Inline[]): string =>
  kids
    .map((k) => {
      if (k.t === 'text') return k.v;
      if (k.t === 'br') return '\n';
      if (k.t === 'G') return `{{G:${k.verbs.join(',')}|${k.tense}}}`;
      return flat(k.kids);
    })
    .join('')
    .replace(/\}\}$/, '}');

/** 一页正文里的所有块 */
const blocksOf = (k: string, lang: 'zh' | 'en' = 'zh') =>
  parseGuide(guideBody(GUIDE[GUIDE_MAP[k]!]!, lang));

const of = <T extends Block['t']>(bs: Block[], t: T) =>
  bs.filter((b): b is Extract<Block, { t: T }> => b.t === t);

describe('讲解数据 —— 与网页版一致', () => {
  it('共 8 页，slug 唯一且都能被 GUIDE_MAP 查到', () => {
    expect(GUIDE.length).toBe(8);
    const slugs = GUIDE.map((g) => g.k);
    expect(new Set(slugs).size).toBe(8);
    slugs.forEach((k) => expect(typeof GUIDE_MAP[k]).toBe('number'));
  });

  it('每页都有中英标题、短标题与正文', () => {
    GUIDE.forEach((g) => {
      expect(g.t.zh.length).toBeGreaterThan(0);
      expect(g.t.en.length).toBeGreaterThan(0);
      expect(g.s.zh.length).toBeGreaterThan(0);
      expect(g.s.en.length).toBeGreaterThan(0);
      expect(g.zh.length).toBeGreaterThan(200);
      expect(g.en.length).toBeGreaterThan(200);
    });
  });

  it('TENSE_GUIDE 的十五个时态全部指向真实存在的讲解页', () => {
    const keys = Object.keys(TENSE_GUIDE);
    expect(keys.length).toBe(15);
    keys.forEach((k) => {
      const slug = (TENSE_GUIDE as Record<string, string>)[k]!;
      expect(typeof GUIDE_MAP[slug]).toBe('number');
    });
  });

  it('正文里 {{G:…}} 提到的动词都在词表里（网页 test_tense.js 同样会查）', () => {
    const all = new Set(VERBS.map((v) => v.i));
    const missing = guideVerbs().filter((x) => !all.has(x));
    expect(missing).toEqual([]);
  });

  it('讲解用到的时态键都是合法的（宏里出现即要能查到）', () => {
    const bad: string[] = [];
    GUIDE.forEach((g) => {
      (['zh', 'en'] as const).forEach((l) => {
        String(g[l]).replace(/\{\{G:([^}]+)\}\}/g, (m, spec: string) => {
          const tk = spec.split('|')[1]?.trim() ?? 'p';
          if (!/^(p|pp|pr|pq|i|f|fp|c|cp|sp|spt|si|sq|ia|in)$/.test(tk)) bad.push(tk);
          return m;
        });
      });
    });
    expect(bad).toEqual([]);
  });
});

describe('讲解解析 —— 标签支持', () => {
  it('八页都能解析出块，且每页至少两个小标题（h3）', () => {
    GUIDE.forEach((g) => {
      const bs = parseGuide(g.zh);
      expect(bs.length).toBeGreaterThan(4);
      expect(of(bs, 'h3').length).toBeGreaterThanOrEqual(2);
      expect(parseGuide(g.en).length).toBeGreaterThan(4);
    });
  });

  it('段落 / 加粗 / 西语词条 / 列表 / 表格 / 提示框 各自落到对应节点', () => {
    const bs = blocksOf('basics');
    expect(of(bs, 'p').length).toBeGreaterThan(3);
    expect(of(bs, 'tip').length).toBeGreaterThan(0);
    const p0 = flat(of(bs, 'p')[0]!.kids);
    expect(p0).toContain('hablar');
    // 段里的 span.es 要单独成节点（网页按它上色）
    const es = of(bs, 'p')
      .flatMap((p) => p.kids)
      .filter((k) => k.t === 'es');
    expect(es.length).toBeGreaterThan(0);
    // 列表项
    const lists = of(bs, 'ul');
    expect(lists.length).toBeGreaterThan(0);
    expect(lists[0]!.items.length).toBeGreaterThan(1);
    expect(flat(lists[0]!.items[0]!)).toMatch(/Vivo en Madrid/);
  });

  it('past 页的表格解析成「首行表头 + 四行数据」', () => {
    const tb = of(blocksOf('past'), 'table');
    expect(tb.length).toBe(1);
    expect(tb[0]!.rows[0]!.head).toBe(true);
    expect(tb[0]!.rows.length).toBe(5);
    expect(tb[0]!.rows[0]!.cells.length).toBe(3);
    expect(flat(tb[0]!.rows[0]!.cells[0]!)).toBe('时态');
    // 格里的 <br> 要保留成换行
    expect(flat(tb[0]!.rows[1]!.cells[0]!)).toContain('\n');
  });

  it('三种提示框语气分得开（tip / ok / warn）', () => {
    const tones = new Set<string>();
    GUIDE.forEach((g) => {
      of(parseGuide(g.zh), 'tip').forEach((t) => tones.add(t.tone));
    });
    expect(tones.has('tip')).toBe(true);
    expect(tones.has('ok')).toBe(true);
    expect(tones.has('warn')).toBe(true);
  });

  it('{{G:…}} 解析成 G 块，动词与时态都对', () => {
    const bs = blocksOf('basics');
    const gs = of(bs, 'G');
    expect(gs.length).toBeGreaterThan(0);
    expect(gs[0]).toEqual({ t: 'G', verbs: ['hablar', 'comer', 'vivir'], tense: 'p' });
    const many = gs.find((g) => g.verbs.length === 9);
    expect(many?.tense).toBe('p');
  });

  it('划掉的错误写法用 s 节点（si tendría 之类）', () => {
    const bs = blocksOf('subj');
    const hasS = of(bs, 'p')
      .flatMap((p) => p.kids)
      .some((k) => k.t === 's');
    const tipHasS = of(bs, 'tip').some((t) => t.kids.some((k) => k.t === 's'));
    expect(hasS || tipHasS).toBe(true);
  });

  it('不闭合 / 认不出的标签不抛错，文字照样收下', () => {
    const bs = parseGuide('<p>前面<b>加粗没关</p><p>下一段</p><div class="tip">提示</div>');
    expect(of(bs, 'p').length).toBe(2);
    expect(flat(of(bs, 'p')[0]!.kids)).toBe('前面加粗没关');
    expect(of(bs, 'tip')[0]!.tone).toBe('tip');
  });

  it('八页正文里没有漏网的标签（解析后文本里不该残留 < 或 >）', () => {
    GUIDE.forEach((g) => {
      (['zh', 'en'] as const).forEach((l) => {
        const text = parseGuide(String(g[l]))
          .map((b) => {
            if (b.t === 'ul') return b.items.map(flat).join('\n');
            if (b.t === 'table') return b.rows.map((r) => r.cells.map(flat).join('\t')).join('\n');
            if (b.t === 'G') return '';
            return flat(b.kids);
          })
          .join('\n');
        expect(text).not.toMatch(/<[a-zA-Z/]/);
      });
    });
  });
});
