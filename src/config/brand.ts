/**
 * 品牌常量 —— 与网页版 `app_template.html` 顶部的 `BRAND` / `APP_VER` 一一对应
 * （网页那两行注释就写着「换仓库、改作者名或发新版只动这里」）。
 *
 * 关于页只从这里取数据，页面里不许出现字面量地址 —— 换仓库时改一处即可。
 *
 * `APP_VER` 是**内容版本号**，与网页版口径一致（都是 2.0.0）。
 * `app.json` 里的 `version: 1.0.0` 是安卓打包用的构建号，两回事。
 */
export const APP_VER = '2.0.0';

export const BRAND = {
  repo: 'https://github.com/kanbutou266-spec/Spanish-Verb-Conjugation-Trainer',
  issues: 'https://github.com/kanbutou266-spec/Spanish-Verb-Conjugation-Trainer/issues/new',
  author: 'kanbutou266-spec',
  authorUrl: 'https://github.com/kanbutou266-spec',
} as const;
