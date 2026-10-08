import { LEVELS } from './tenses';
import raw from './verbs.json';

import type { Level, Verb } from './types';

/**
 * 应用级词表入口 —— 引擎层（`engine/*`）一律**显式接收 verbs 参数**，
 * 这里负责把打包进来的 verbs.json 交出去，并建好两个查表索引。
 *
 * `verbs.json` 只读，永不写入（对应"数据文件零改动"的约定，方案 §4.1）。
 */
const data = raw as unknown as { v: Verb[] };

/** 全量词表，487 个 */
export const VERBS: Verb[] = data.v;

const INF_INDEX = new Map<string, number>();
VERBS.forEach((v, i) => INF_INDEX.set(v.i, i));

/** 原形 → 词表下标；不存在返回 -1 */
export const verbIndex = (inf: string): number => INF_INDEX.get(inf) ?? -1;

/** 原形 → 动词；不存在返回 undefined */
export const verbByInf = (inf: string): Verb | undefined => {
  const i = INF_INDEX.get(inf);
  return i === undefined ? undefined : VERBS[i];
};

/** 词表里实际出现过的等级（新增 C1/C2 词汇后会自动出现在筛选行里） */
export const LEVELS_IN_DATA: Level[] = LEVELS.filter((lv) => VERBS.some((v) => v.l === lv));

/** 六个等级各自有多少动词（没有的等级为 0），用来渲染 chip 上的计数 */
export const COUNT_BY_LEVEL: Record<Level, number> = LEVELS.reduce((acc, lv) => {
  acc[lv] = 0;
  return acc;
}, {} as Record<Level, number>);
VERBS.forEach((v) => {
  COUNT_BY_LEVEL[v.l] += 1;
});
