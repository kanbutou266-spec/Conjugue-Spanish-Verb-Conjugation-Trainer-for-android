import type { Dict } from './types';

/**
 * zh 文案表 —— 逐条等价于网页版 app_template.html 的 `I18N.zh`。
 *
 * 与网页版的唯一差别是**标记**：网页直接塞 HTML，RN 不能渲染 HTML，于是
 *   <b>x</b> -> [[x]]   由 i18n/rich.ts 的 parseRich() 解析成「强调」分段
 *   <br>    -> \n
 *   <span>/<kbd> 一律去掉（样式归 UI 层，文案只留字）
 *
 * 改文案请**两个语言文件一起改**：__tests__/i18n 会断言 zh/en 键集完全一致。
 * 本文件是**手改源文件**（初版于 2026-10-02 由脚本从网页模板一次性抽取后校订）；
 * 网页版里已无引用的死文案（optAskTense / optAskTenseT / optAskTenseShort / mzSoft*）没有搬过来。
 */
export const zh = {
  htmlLang: 'zh-CN',
  title: '西语动词变位练习器',
  sub: (n) => "Practicador de conjugaciones · 本地词库 [["+n+"]] 个动词 · 支持 vosotros，不含 voseo",
  statsBtn: '📊 学习统计',
  custom: '自定义',
  quickStart: '快速开始',
  setDrawer: '设置',
  editCustom: '编辑',
  editCustomTtl: (n) => '编辑「'+n+'」',
  savedOk: '修改成功',
  presetCount: (n) => n+' 个动词',
  hKeys: '难度',
  hKeysMeta: '（选一套练什么；自定义槽点「编辑」来改）',
  keyCustom: (n) => '自定义 '+n,
  keyCustomInfo: (lv,nt,n) => lv+' 词库 · '+nt+' 个时态 · '+n+' 个动词',
  keyEmpty: '还没设置：点这个键来配置',
  secLib: '1 · 词库',
  secTense: '2 · 时态',
  secOther: '3 · 其它',
  applyKey: '应用这套设置',
  appliedKey: (x) => '已应用「'+x+'」。',
  appliedCustom: (x) => '已切到「'+x+'」，改动会自动保存。',
  presetOnly: (n,c) => '已应用「'+n+'」：'+c+' 个动词。点「开始练习」出题。',
  presetNoTense: '这套设置没有可用时态，请换一套或自己配。',
  presetNoPool: '这套设置的题库为空，请换一套或自己配。',
  modeEnd: '练习模式已换，练习已结束 —— 点「开始练习」重新开始。',
  applyReset: '恢复默认',
  save: '保存',
  saveDiscardT: '放弃修改？',
  saveDiscardD: (n) => '「'+n+'」这次改的内容还没保存，返回就会丢掉。',
  saveDiscardOk: '放弃修改',
  saveDiscardCancel: '继续编辑',
  pickNow: (n) => '当前 '+n+' 个动词',
  diagStem: (x) => '这一格是词干变化（不只是换词尾），正确形式是 '+x+'。',
  diagOrth: (x) => '这一格是正字法拼写变化（为了保住读音才改拼写），正确形式是 '+x+'。',
  diagIrr: (x) => '这一格是不规则形式，需要单独记，正确形式是 '+x+'。',
  poolUnit: '个动词',
  levelN: (n) => '本级共 '+n+' 个动词',
  hMode: '练习模式',
  tAll: '全选',
  tNone: '清空',
  tRec: '推荐时态组：',
  tRecT: (lv,n) => '套用 '+lv+' 对应的 '+n+' 个时态',
  tCount: (n,tot) => '已选 [['+n+']] / '+tot+' 个时态',
  tCountNone: '未选任何时态 —— 请至少选 1 个',
  tenseXfer: '（平移模式借用它判断词形是否齐备）',
  tagAll: '全部动词',
  tagIrreg: '只练不规则',
  tagReg: '只练规则',
  tagFreq: '只练高频',
  tagSpell: '只练拼写变化',
  tagStem: '只练词干变化',
  optShowZh: '显示中文释义',
  optShowZhT: '题干下面给一句中文意思',
  optHideInf: '隐藏动词原形',
  optHideInfT: '题干不再给出原形，要先从这个变位形式认出动词；作答后自动显示。'
             +'复现模式必须看到原形，所以那一屏不受影响',
  optStrict: '严格要求重音',
  optStrictT: '关掉后「hablo / habló」这类只差重音的回答算对',
  infLabel: '原形',
  // 辨认模式原形输入框的占位提示（用户 2026-10-03：这一格要写什么，得说清楚）
  infPh: '写出该动词的原形',
  infWrong: (inf, given) => '原形不对：正确是 [['+inf+']]，你写的是 '+given+'。',
  recInfHint: '不显示原形：从这个变位形式认出动词并写出它的原形；',
  optType: '答题方式',
  optTypeT: '手写：自己敲出变位；选择：从四到六个形式里挑',
  typeType: '手写',
  typeChoice: '选择',
  optVosotros: '含 vosotros',
  optVosotrosT: '开启后题目里会包含第 6 人称（vosotros / vosotras）；关掉则完全不出该人称的题。',
  // setHint 已不再被页面引用（用户 2026-10-05 要求删掉设置页顶部那句提示）；
  // 保留键是为了与网页版 I18N 键集完全一致（i18n.test.ts 只断言键数一致）。
  setHint: '这一栏是全局项，对每一套设置都生效。',
  pool: (v,t) => '当前题库：[['+v+']] 个动词 / [['+t+']] 个时态',
  poolNoTense: '当前题库：还没有选择任何时态',
  poolNoTenseNa: '当前题库：本模式不按单个时态出题',
  startNa: '换个模式吧',
  warnShift: '「转换模式」需要至少 2 个时态',
  warnTransfer: '「平移模式」需要题库里至少 2 个动词',
  warnTail: (x) => '　· 已选模式里的 '+x+' 才能出题，会自动改用其他模式',
  start: '开始练习',
  startPick: '请先选择时态',
  startEmpty: '题库为空',
  keys: '快捷键：1–6 选人称，Enter 确认 / 下一题。',
  hGuide: '变位规则速览',
  gdPrev: '← 上一页',
  gdNext: '下一页 →',
  gdCount: (i,n) => '第 '+i+' / '+n+' 页',
  gdLinks: '权威外链',
  guideShortBtn: '变位规则速览 →',
  lgIrr: '不规则',
  lgOrth: '正字法拼写变化',
  lgStem: '词干变化',
  lgNote: '着色只落在真正变了的那几个字母上（如 poder→pue-do 只标 ue、tocar→to-qué 只标 qu）。',
  tblAuth: '权威对照：',
  tblRae: 'RAE 官方变位表',
  relGrammar: '相关语法：',
  tblBtn: (v) => '看 '+v+' 的变位查询',
  dwTab: '变位查询',
  dwPh: '输入原形 / 变位形式 / 释义…',
  dwCount: (n) => n+' 个动词',
  dwHint: '左栏简单、右栏复合；命令式分肯定 / 否定。随时可拉开、可收回。',
  affirm: '肯定',
  negative: '否定',
  tblGap: '「前过去时」（hube + 分词）现代西语已基本不用，故留空。',
  sugNone: (q) => '没找到「'+q+'」——试试动词原形。',
  sugMore: (n) => '另有 '+n+' 个匹配…',
  xferAlt: (f,ts,alts) => '说明：A 的 [['+f+']] 在「'+ts+'」里也读作同一个人称，所以 B 写成 '+alts+' 同样算对。',
  footer: "变位数据来源：Fred Jehle's Conjugated Spanish Verb Database（CC BY-NC-SA 3.0，600+ 动词）\n"
        +"已剔除 voseo 专栏、修正源库个别重音错误；等级 / 中文释义为本程序自行标注。",
  exit: '← 退出',
  prev: '上一题',
  navStats: '学习统计',
  navTable: '变位表',
  /** 底栏 tab 专用短标签（中文与全称相同，仅为与 en 表键对齐而存在） */
  navTableShort: '变位表',
  navPractice: '练习',
  back: '← 返回',
  // 「第 x 题 · 正确 y%」—— 原来写「x / n 题」，可作答页是动态出题的，
  // 总数会随作答不断变（第 1 题时永远是 1/1），那个分母没有信息量（用户 2026-10-03）
  progress: (i, _n, p) => '第 ' + i + ' 题 · 正确 ' + p + '%',
  mzRecognize: '辨认模式 · 写出原形，判断它的主语人称（和时态）',
  mzProduce: '复现模式 · 写出该人称的变位',
  mzShift: '转换模式 · 人称不变，换一个时态',
  mzTransfer: '平移模式 · 人称、时态都不变，换成另一个动词',
  sSrc: '原时态',
  sTgt: '目标时态',
  sMood: '语式',
  sTense: '时态',
  sForm: '形式',
  transferHint: '照 A 的人称与时态，把 B 变位写出来',
  peek: '看原形',
  peekT: '只显示本题的原形，不影响判定',
  placeholder: '输入变位形式…',
  check: '确认',
  next: '下一题',
  enterNext: '按 Enter 继续',
  ok: '回答正确',
  bad: '回答错误',
  warn: '正确（重音需注意）',
  yourAns: '你的答案：',
  blank: '（未作答）',
  correctAns: '正确答案：',
  /** 辨认模式专属：这一题答的是**原形**，不是变位形式（用户 2026-10-05 定的口径） */
  correctInf: '正确原形：',
  alsoW: (x) => '（也可写作 '+x+'）',
  correctPerson: '正确人称：',
  tenseIs: '时态：',
  homoLead: (x) => '注意：[['+x+']] 这个形式',
  homoTense: (x) => '在「'+x+'」里同形',
  homoPers: (x) => '同时对应「'+x+'」',
  homoTail: '，所以以上任一选择都算正确。',
  tenseWrong: (p, l, t) => '时态不对：'+p+'的形式在 '+l+' 中出现，没有「'+t+'」这一读法。',
  tenseWrongNone: (p, t) => '时态不对：'+p+'的形式在本题所选时态里没有出现，没有「'+t+'」这一读法。',
  tenseWrongNoneP: '本题所选时态里没有该形式',
  cameFrom: (x) => '本题原本取自 [['+x+']]。',
  gridLead: (x) => '这个时态下六个人称的完整变位（高亮为本题的人称）：',
  shiftSame: (inf,a,b,p) => inf+'：'+a+' → '+b+'，人称 '+p,
  shiftIdent: (p) => '注意：这两个时态在 '+p+' 上同形，所以换时态后写法不变。',
  xferNote: (a,t,p,f,b) => a+' 的 '+t+' '+p+' 是 [['+f+']] → '+b+' 在同样的人称时态下应是 ',
  gridLead2: (inf,t) => inf+' 在「'+t+'」下的完整变位（高亮为本题的人称）：',
  hRec: '提示：本题只在',
  hRec2: '时态中选（简单/复合一眼可辨）。',
  hRec3: '同一个形式可能属于多个时态或对应多个人称（如 nosotros 的 compramos 既是现在时也是简单过去时），选其中任何一种都算正确。',
  hRecHide: '本题隐藏了原形：请直接从词尾判断人称。',
  hProduce: '可直接输入变位形式，无需写主语代词。虚拟式过去未完成时的 -ra / -se 两种形式都算正确。',
  hRefl: '这是自复动词，变位形式要带上代词（me / te / se / nos / os）才完整，例如 me acuesto、acuéstate。',
  negImp: '⚠️ 否定命令式请写出完整形式（no + 动词）',
  hShiftSame: '人称不变，语式不变，只把时态换成目标那一栏。',
  hShiftCross: (a,b) => '人称不变；这一题连语式也要换（'+a+' → '+b+'），请一并留意。',
  hShiftHide: '本题隐藏了原形：先从这个形式认出动词，再变到目标时态。',
  hTransfer: '人称和时态都不变，只把动词换成 B；词尾规律与 A 相同，但 B 是不是规则动词要自己判断。'
           +'虚拟式过去未完成时的 -ra / -se 两种形式都算正确。',
  simple: '简单',
  compound: '复合',
  simpleT: '简单时态',
  compoundT: '复合时态',
  groupAll: '全选',
  groupNone: '清空',
  tenseQ: '这个形式属于哪个时态？',
  // 与人称选项那一行对称的小标题（用户 2026-10-03：时态问了，人称也要问）
  personQ: '这个形式属于哪个人称？',
  tenseQOnly: (x) => '· 只列'+x,
  emptyPoolAlert: '题库为空：请检查难度 / 时态 / 错题设置。',
  emptyNext: '题库为空：请返回调整难度 / 时态 / 错题设置。',
  endConfirm: (n,p) => '结束本次练习？\n本次共答 '+n+' 题，正确率 '+p+'%。',
  stStats: '学习统计',
  stAnswers: '累计答题',
  stAcc: '总正确率',
  stErr: '累计错误',
  stVerbs: '练习过的动词',
  stHardest: '最容易错的动词',
  stNoErr: '还没有错误记录，先练几题吧。',
  thVerb: '动词',
  thMean: '释义',
  thLv: '等级',
  thErrAtt: '错/答',
  thRate: '错误率',
  stByTense: '各时态错误率',
  thTense: '时态',
  stNoData: '暂无数据。',
  stByMode: '各模式正确率',
  thMode: '模式',
  thOkAtt: '对/答',
  thAcc: '正确率',
  stNoData2: '暂无数据',
  /** 分区标题右侧的条数上限（用户 2026-10-05：希望知道每项有没有上限） */
  stLimit: (n) => '最多 ' + n + ' 条',
  /** 错题本已从统计页移除，但导出 JSON 仍带 `wrong` 字段；
      这三条文案保留是为了与网页版 I18N 键集一致（网页的热键 / 兼容仍可能引用）。 */
  stWrong: '错题本',
  stWrongN: (n) => '最近 '+n+' 条',
  stNoWrong: '还没有错题。',
  thPerson: '人称',
  thYou: '你写的',
  thRight: '正确',
  stData: '数据管理',
  setDataHint:
    '统计数据与设置都保存在这台设备上，不会上传到任何服务器；卸载应用会丢失，建议定期导出备份。',
  expJson: '导出 JSON',
  impJson: '导入 JSON',
  reset: '清空统计',
  impOk: '导入成功。',
  impBad: (m) => '文件格式不正确：'+m,
  resetConfirm: '确定清空全部答题统计与错题本？此操作不可恢复。',
  totalLbl: '共',
  langLabel: '中文',

  /* ---- RN 端新增（网页版没有这些元素，故不在网页 I18N 里） ---- */
  /** 难度档卡片下方「词库详情」联动栏的四个键名 */
  lbLib: '词库',
  lbTense: '时态',
  lbInput: '答题',
  lbTag: '标签',
  /** 该行为空时的占位（如「标签 —」＝没有筛选） */
  lbNone: '—',
  /** 预设档为只读时的说明（轮播里选中预设卡时显示） */
  presetFixed: '预设档是固定配方，不可改；要微调请用自定义槽。',
  /** 自定义槽卡片上那个小铅笔的提示 */
  slotEditHint: '微调这一档的词库 / 时态 / 答题方式',
  carouselPrev: '上一档',
  carouselNext: '下一档',
  /** 作答框右侧那颗「×」—— 一键清空输入框 */
  clearInput: '清除',
  /** 作答页：已有作答进度时按返回，弹窗的两个按钮 */
  stayPractice: '继续练习',
  leavePractice: '退出练习',

  /** 开屏品牌（语言跟随系统，见 components/animated-icon.tsx） */
  brand: '变位君',
  brandSub: '西语动词变位训练器',

  /* ================================================================== *
   * 讲解 / 我的 两个 tab 及各自子页（2026-10-04 组装）
   * ================================================================== */

  /** 底栏第三个 tab：语法讲解（4 个字，与「变位表」等宽） */
  navGuide: '讲解',
  /** 底栏第四个 tab：个人中心 */
  navMe: '我的',

  /** 讲解：目录页标题与一句话说明 */
  gdTitle: '语法讲解',
  gdIntro: '八页讲清变位怎么读、怎么记：时态、命令式、不规则与重音。',
  /** 详情页底部那圈目录 chips 的小标题 */
  gdToc: '八页目录',

  meNoStats: '还没有练习记录，先去做几题吧。',
  /** 「我的」三行入口的名字（用户 2026-10-05：去掉三个一级标题与每行的副标题，
      只留「学习统计 / 设置 / 关于」三个键） */
  meStats: '学习统计',
  meAbout: '关于',

  /* ---- 设置页分区标题（开关本身复用 opt* / 数据管理复用 stData* 那批） ----
     用户 2026-10-05 重新分段：语言 → 界面（并入深色模式）；界面与出题 → 出题。 */
  setSecUI: '界面',
  setFollow: '跟随系统语言',
  setFollowT: '中文系统显示中文，其它语言显示英文',
  setLang: '界面语言',
  setLangT: '关掉「跟随系统语言」后才可手动选择',
  /** 深色模式（用户 2026-10-05）：默认跟随系统深色开关 */
  setDarkFollow: '跟随系统深色模式',
  setDarkFollowT: '跟着手机的深色开关走；系统设了日出日落自动切换，这里也会自动变',
  setDark: '深浅色',
  setDarkT: '关掉「跟随系统深色模式」后才可手动选择',
  darkLight: '浅色',
  darkDark: '深色',
  setSecQuiz: '出题',
  setSecData: '数据',
  /** 手动选择界面语言时那两个选项的名字（两种语言里都写自己的名字，不翻译） */
  langZh: '中文',
  langEn: 'English',
  /** 通用「取消」（弹窗第二个按钮） */
  cancel: '取消',

  /* ---- 关于页（文案与网页版 renderAbout 的 i18n 逐字一致，
     只有两处按 RN 改写：隐私里的「浏览器 localStorage」→「本机存储」，
     外链提示「在新标签页打开」→「在浏览器中打开」） ---- */
  navAbout: '关于',
  abTagline: 'Practicador de conjugaciones · 离线安卓应用',
  abVer: (v) => '版本 ' + v,
  abSecOpen: '开源',
  abRepo: 'GitHub 项目仓库',
  abRepoSub: '源码、Issue、Release 都在这里',
  abIssues: '报告问题 / 提建议',
  abIssuesSub: '遇到 bug 或有想法，欢迎开一个 Issue',
  abSecAuthor: '作者',
  abAuthorNote: '一位被西语变位折磨的小白',
  abSecThanks: '赞助',
  abDonate: '赞赏码',
  abDonateSub: '觉得有用的话，扫码请作者的大肥鱼吃口鱼饲料 🐟（完全自愿，不捐也一点不影响使用）',
  abSecLegal: '声明',
  abAi: 'AI 参与声明',
  abAiT: '本作品由人工与 AI 协作完成，数据与讲解均经人工校对。',
  abSrc: '数据来源与许可',
  abSrcT:
    "变位数据：Fred Jehle's Conjugated Spanish Verb Database（CC BY-NC-SA 3.0）；"
    + '图标：Lucide Icons（ISC）。等级与中文释义为本程序自行标注。',
  abPriv: '隐私说明',
  abPrivT:
    '学习记录只存在这台设备上（本机存储），不上传服务器、不收集任何信息；'
    + '卸载应用即彻底删除。',
  abOpenNew: '在浏览器中打开',
} satisfies Dict;
