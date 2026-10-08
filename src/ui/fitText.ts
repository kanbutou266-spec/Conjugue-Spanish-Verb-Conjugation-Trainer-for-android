/**
 * 变位形式的**换行与字号适配** —— 纯函数，零 UI 依赖，可单独单测。
 *
 * 要解决的正是用户提的第 2 条：
 *   ① 「不要从单词中间裂开换行」；
 *   ② 「两个单词可以分两行没问题」；
 *   ③ 「一个单词若太长请缩小字体」。
 *
 * ①、② 靠 `splitWords()` —— 把形式拆成一个个**词**，每个词单独一个 `<Text>`
 * 交给同一个 flex 容器去排（见 `components/ConjText.tsx`）：容器只在**词之间**
 * 折行，词内部是原子的。安卓的 StaticLayout 在「一个词装不下」时会在任意字符处
 * 硬断（它没有 CSS 的 `word-break: keep-all`），所以只能靠结构避免，不能靠样式。
 *
 * ③ 靠 `fitFontSize()` —— 按**最长那个词**（不是整串）估宽度；放不下就等比缩字号，
 * 缩到 `min` 为止。因为缩到「最长词刚好装下」时每个词都装得下，
 * 结构上就永远不会触到安卓的硬断分支。
 */

/**
 * 每字符宽度 / 字号 的**保守上界**。
 *
 * Roboto 小写拉丁的平均字宽约为字号的 0.50（`m`/`w` 到 0.85，`i`/`l` 只有 0.24）；
 * 取 0.55 是留余量 —— 宁可把字号估小一点（真的装得下），
 * 也不能估大（估大就会溢出、进而被 `numberOfLines={1}` 悄悄截掉字母）。
 * 数据里最长的词是 16 字（desarrollaríamos），按 0.55 算约 0.55×16 = 8.8em。
 */
export const CHAR_W_FACTOR = 0.55;

/** 词与词之间的空隙 ≈ 一个空格宽度，占字号的比例 */
export const WORD_GAP_FACTOR = 0.28;

/**
 * **还没量到容器宽度时**用的兜底可用宽度（px）。
 *
 * 为什么需要它：`ConjText` 是「先在根容器上 `onLayout` 量宽，再按宽度算字号」，
 * 首帧 `measured === 0` → `avail <= 0` → 旧版直接返回 `base` 不缩字。
 * 而每个词都挂着 `numberOfLines={1}`，于是首帧那个**超长词**就被截成
 * 「……」（用户 2026-10-05 报的第 7 条：「有时候在题干，有时候在语法讲解里面，
 * 动词太长导致后面变成省略号，为什么没有自动缩小字体？」）。
 *
 * 实测一次要等一帧，但**缩字不能等**。所以首帧先按一个保守的窄宽度估：
 * 取 320dp（比市面最窄的手机内容区还窄；360dp 屏减去左右各 18dp 内边距后
 * 通常还有 320dp 上下），按它算出来的字号只会**偏小不会偏大**；
 * 量到真宽度后 `setMeasured` 触发重算，若其实装得下就自动回到 `base`。
 * 视觉上最多是首帧略小一点点、下一帧回正 —— 远好过露出一串省略号。
 */
export const FALLBACK_AVAIL = 320;

/**
 * 归一化「系统字号缩放」（`PixelRatio.getFontScale()`）。
 *
 * 为什么必须有它（用户 2026-10-07 再次报「有时候题干给的动词太长会出现省略号」）：
 * RN 的 `<Text>` 默认 `allowFontScaling = true`，**`fontSize` 会被系统「字体大小」
 * 设置再乘一遍 `fontScale`**；而 `onLayout` 量出来的容器宽度是真实 dp、不缩放。
 * 于是「估算用的宽度」与「实际渲染的宽度」差了一个 `fontScale`：
 *   · 用户把系统字体调大到 1.15~1.5 倍（很常见），长词就悄悄溢出；
 *   · 溢出后每个词还挂着 `numberOfLines={1}` → 尾字母被吃掉、变成「……」。
 * 这也是为什么它**只"有时候"出现** —— 取决于机型宽度 + 系统字号，而不是某个固定的词。
 *
 * `scale` 是乘在「按 `base` 估出来的宽度」上的：要装下就得
 *   `size ≤ avail / (len × factor × fontScale)`，即缩字结果要**正比于 1/fontScale**。
 */
export function normFontScale(scale?: number): number {
  return typeof scale === 'number' && isFinite(scale) && scale > 0 ? scale : 1;
}

/** 把形式按空白拆成词；空串 / 全空白 → `[]` */
export function splitWords(text: string | null | undefined): string[] {
  return String(text == null ? '' : text)
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** 最长的那个词（按字符数）；没有词时返回空串 */
export function longestWord(text: string | null | undefined): string {
  return splitWords(text).reduce((a, b) => (b.length > a.length ? b : a), '');
}

export interface FitInput {
  /**
   * 完整形式（含空格），如 'nos hubiéramos despertado'
   */
  text: string;
  /**
   * 容器可用宽度（px）。
   *
   * `<= 0` 表示**还没量到** —— 此时不再原样返回 `base`（那样超长词会被
   * `numberOfLines={1}` 截成省略号），而是改用 `FALLBACK_AVAIL` 先保守缩一档，
   * 等量到真宽度再重算。见 `FALLBACK_AVAIL` 的注释。
   */
  avail: number;
  /** 基准字号 */
  base: number;
  /** 缩字下限（再小就不缩了，宁可略微溢出也不要小到看不清） */
  min: number;
  /** 覆盖默认的每字符宽度比例（测试用） */
  factor?: number;
  /**
   * 系统字号缩放（`PixelRatio.getFontScale()`）。
   *
   * 缺省 1（测试与旧调用不受影响）。**实际渲染宽度 = 字号 × 字符比例 × fontScale**，
   * 所以它必须进估算，否则系统字体一放大就溢出、被 `numberOfLines={1}` 截成省略号。
   * 见 `normFontScale()` 的注释。
   */
  scale?: number;
}

/**
 * 算出这串形式该用多大字号：**只看最长的那个词**。
 *
 * 例（factor=0.55、base=34、scale=1）：
 *   'poder'                      → 5 字，估宽 93px  → 不缩，34
 *   'nos hubiéramos despertado'  → 最长词 10 字，估宽 187px → 不缩，34（靠词间折行排两行）
 *   'desarrollaríamos'（16 字）  → 估宽 299px，容器 260px → 缩到 29
 */
export function fitFontSize({
  text,
  avail,
  base,
  min,
  factor = CHAR_W_FACTOR,
  scale = 1,
}: FitInput): number {
  const w = longestWord(text);
  if (!w || !(base > 0)) return base;
  // 还没量到宽度 → 用保守的兜底宽度，绝不放行 `base`（否则首帧长词被截省略号）
  const usable = avail > 0 ? avail : FALLBACK_AVAIL;
  // fontScale 乘进「需要的宽度」里：它是真实渲染时会被系统再乘一遍的那一档
  const need = w.length * factor * base * normFontScale(scale);
  if (need <= usable) return base;
  return Math.max(min, Math.floor((base * usable) / need));
}

/** 估算某个词在给定字号下的像素宽（与 `fitFontSize` 同一套口径） */
export function estimateWidth(word: string, size: number, factor = CHAR_W_FACTOR): number {
  return word.length * factor * size;
}

/**
 * 这个**词**在给定字号下是否仍然装不下（即会被 `numberOfLines={1}` 截短）。
 *
 * `ConjText` 用它做最后一道保险：一旦某词触到了 `min` 下限还是超宽，
 * 就**放开那一行的 `numberOfLines`** —— 宁可让它在词内折成两行，
 * 也绝不吐出一串省略号（用户 2026-10-05 / 10-07 两次强调：看不到完整形式比不好看严重得多）。
 *
 * `avail <= 0`（还没量到容器宽）时无从判断，返回 `false`；
 * 调用方此时**不要**挂 `numberOfLines={1}`（宁可先允许折行）。
 */
export function wordExceeds(
  word: string,
  avail: number,
  size: number,
  factor = CHAR_W_FACTOR,
  scale = 1
): boolean {
  if (!(avail > 0) || !word || !(size > 0)) return false;
  return word.length * factor * size * normFontScale(scale) > avail;
}
