import { parseRich, plainText, isRich } from '@/i18n/rich';

describe('i18n/rich —— [[…]] 强调标记', () => {
  it('没有标记时整段是 plain', () => {
    expect(parseRich('开始练习 →')).toEqual([{ text: '开始练习 →', kind: 'plain' }]);
  });

  it('单处标记切成三段，且不产出空分段', () => {
    expect(parseRich('已选 [[3]] / 15 个时态')).toEqual([
      { text: '已选 ', kind: 'plain' },
      { text: '3', kind: 'strong' },
      { text: ' / 15 个时态', kind: 'plain' },
    ]);
  });

  it('多处标记按顺序切分', () => {
    expect(parseRich('[[a]] 和 [[b]] 都对')).toEqual([
      { text: 'a', kind: 'strong' },
      { text: ' 和 ', kind: 'plain' },
      { text: 'b', kind: 'strong' },
      { text: ' 都对', kind: 'plain' },
    ]);
  });

  it('标记落在首尾时不产生空 plain 段', () => {
    expect(parseRich('[[x]]')).toEqual([{ text: 'x', kind: 'strong' }]);
    expect(parseRich('[[x]]尾')).toEqual([
      { text: 'x', kind: 'strong' },
      { text: '尾', kind: 'plain' },
    ]);
  });

  it('落单的 [[ 或 ]] 原样保留，不吞字', () => {
    expect(plainText('半截 [[ 标记')).toBe('半截 [[ 标记');
    expect(plainText('半截 ]] 标记')).toBe('半截 ]] 标记');
  });

  it('空标记 [[]] 被忽略', () => {
    expect(parseRich('a[[]]b')).toEqual([{ text: 'ab', kind: 'plain' }]);
  });

  it('保留换行', () => {
    expect(plainText('第一行\n第二行')).toBe('第一行\n第二行');
  });

  it('plainText / isRich', () => {
    expect(plainText('已选 [[3]] / 15')).toBe('已选 3 / 15');
    expect(isRich('已选 [[3]] / 15')).toBe(true);
    expect(isRich('已选 3 / 15')).toBe(false);
  });

  it('null / undefined 不炸', () => {
    expect(parseRich(null as unknown as string)).toEqual([]);
    expect(plainText(undefined as unknown as string)).toBe('');
  });
});
