/**
 * 语法讲解的正文数据 —— **由 `scripts/extract-guide.mjs` 从网页版模板抽取**，
 * 请勿手改：要改文案请改网页版 `data/app_template.html` 里的 GUIDE，然后重跑
 * `node scripts/extract-guide.mjs`，两边才会保持一致。
 *
 * 正文是 **HTML 子集**（h3 / p / ul / li / div.tip / span.es / b / i / br），
 * 外加一个宏 `{{G:动词,动词|时态键}}` —— 渲染前由 `src/ui/html.ts` 解析成节点树，
 * 宏在 `GuideBody` 里变成内嵌变位网格（对应网页的 `expandGuide` / `guideGrid`）。
 *
 * 与网页版的对应关系：
 *   GUIDE / LK_* / lkRae   → 这里
 *   GUIDE_MAP / guideTxt / guideBody / guideVerbs → 文件末尾的几个纯函数
 *   TENSE_GUIDE            → 时态 → 讲解页（作答页「相关语法」跳转用）
 */
import type { Lang, TenseKey } from './types';

/** 一条中英双语文本（网页里到处在用的 `{zh, en}`） */
export interface Bi {
  zh: string;
  en: string;
}

/** 权威外链：地址 + 名字 + 一句说明 */
export interface GuideLink {
  u: string;
  n: Bi;
  d: Bi;
}

/** 一页讲解 */
export interface GuidePage {
  /** 稳定 slug（路由 `/guide/[slug]` 用它） */
  k: string;
  /** 完整标题（正文页 h2，带 ① 序号） */
  t: Bi;
  /** 目录里的短标题 */
  s: Bi;
  /** 中文正文（HTML 子集） */
  zh: string;
  /** 英文正文 */
  en: string;
  /** 该页的权威外链 */
  lk: GuideLink[];
}

/* 常用权威外链 */
const lkRae = (v: string): GuideLink => ({
  u:'https://dle.rae.es/'+encodeURIComponent(v)+'?m=form',
  n:{zh:'RAE 词典 · '+v+' 的完整变位表', en:'RAE dictionary · full conjugation of '+v},
  d:{zh:'西班牙皇家语言学院官方词典的变位页，含全部简单与复合时态，可用来核对本程序里的形式。',
     en:'The RAE’s official conjugation page: every simple and compound form, handy for cross-checking.'}});
const LK_RAE_GRAM = {
  u:'https://www.rae.es/gramática/',
  n:{zh:'RAE · 新西班牙语语法（NGLE）', en:'RAE · Nueva gramática (NGLE)'},
  d:{zh:'西班牙皇家语言学院与 22 个西语学院合编的官方语法，是西语语法的权威依据。',
     en:'The official grammar written by the RAE and the 22 Spanish-language academies.'}};
const LK_DPD = {
  u:'https://www.rae.es/dpd/',
  n:{zh:'RAE · 泛西班牙语疑问词典（DPD）', en:'RAE · Diccionario panhispánico de dudas'},
  d:{zh:'按词条解答实际用法与拼写疑问；遇到「到底能不能这样说 / 这样写」时最好用。',
     en:'Entry-by-entry answers to real usage and spelling doubts.'}};
const LK_FUNDEU = {
  u:'https://www.fundeu.es/',
  n:{zh:'Fundéu · 西班牙语紧急服务', en:'Fundéu · Fundación del Español Urgente'},
  d:{zh:'由 RAE 参与支持的用法咨询机构，每天更新实际语言问题的答疑，适合查细节。',
     en:'Daily advice on real usage questions, backed by the RAE.'}};
const LK_CVC_A = {
  u:'https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/niveles/02_gramatica_inventario_a1-a2.htm',
  n:{zh:'塞万提斯学院 · 语法教学大纲 A1–A2', en:'Instituto Cervantes · grammar syllabus A1–A2'},
  d:{zh:'官方的分级语法清单，能看到入门阶段要求掌握哪些形式。',
     en:'The official level-by-level grammar inventory for beginners.'}};
const LK_CVC_B = {
  u:'https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/niveles/02_gramatica_inventario_b1-b2.htm',
  n:{zh:'塞万提斯学院 · 语法教学大纲 B1–B2', en:'Instituto Cervantes · grammar syllabus B1–B2'},
  d:{zh:'中级阶段的官方语法清单，虚拟式、命令式都在这一级的要求里。',
     en:'The official inventory for intermediate levels — subjunctive and imperative included.'}};
const LK_WIKI_PRES = {
  u:'https://www.wikilengua.org/index.php/Presente_de_indicativo',
  n:{zh:'Wikilengua · 一般现在时', en:'Wikilengua · Presente de indicativo'},
  d:{zh:'由 Fundéu 与塞万提斯学院维护的语法百科，条目短、查得快。',
     en:'Grammar wiki maintained by Fundéu and the Instituto Cervantes.'}};
const LK_WIKI_SUBJ = {
  u:'https://www.wikilengua.org/index.php/Subjuntivo',
  n:{zh:'Wikilengua · 虚拟式', en:'Wikilengua · Subjuntivo'},
  d:{zh:'虚拟式的概览条目，适合在弄清形式之后再看用法。',
     en:'An overview of the subjunctive — best read after the forms are clear.'}};
const LK_WIKI_ORTH = {
  u:'https://www.wikilengua.org/index.php/Ortografía',
  n:{zh:'Wikilengua · 正字法', en:'Wikilengua · Ortografía'},
  d:{zh:'西语拼写规则的汇总条目，c / g / z / qu 的换写规则都在里面。',
     en:'A round-up of Spanish spelling rules, including c / g / z / qu alternations.'}};
const LK_WIKI_IRR = {
  u:'https://www.wikilengua.org/index.php/Verbo_irregular',
  n:{zh:'Wikilengua · 不规则动词', en:'Wikilengua · Verbo irregular'},
  d:{zh:'按类型整理的不规则动词清单，可以和本页的分类对照着看。',
     en:'Irregular verbs grouped by type — good to read alongside this page.'}};
const LK_WIKI_ACC = {
  u:'https://www.wikilengua.org/index.php/Acentuación',
  n:{zh:'Wikilengua · 重音符规则', en:'Wikilengua · Acentuación'},
  d:{zh:'重音位置与重音符用法的完整梳理，含双元音、元音连读（hiato）与区分性音符。',
     en:'A full account of stress placement and the written accent, diphthongs and hiatos included.'}};
const LK_DPD_TILDE = {
  u:'https://www.rae.es/dpd/tilde',
  n:{zh:'RAE 疑问词典 · 重音符（tilde）', en:'RAE DPD · tilde'},
  d:{zh:'RAE 官方对「什么时候必须写重音符」的逐条规定，最权威的查证处。',
     en:'The RAE’s official, clause-by-clause rules on when the accent mark is required.'}};
const LK_DPD_ACCENT = {
  u:'https://www.rae.es/dpd/acento',
  n:{zh:'RAE 疑问词典 · 重音（acento）', en:'RAE DPD · acento'},
  d:{zh:'先讲清「重读」与「重音符」是两件事，再说明词按重音分成四类（aguda / llana / esdrújula / sobresdrújula）。',
     en:'First separates stress from the written accent, then classifies words by stress position.'}};

/* 8 页讲解。t = 标题，s = 目录里的短标题，b = 正文（HTML），lk = 权威外链 */
export const GUIDE: GuidePage[] = [
{
  k:'basics',
  t:{zh:'① 入门：动词、词干与一般现在时', en:'① Basics: verbs, stems and the present'},
  s:{zh:'① 入门与一般现在时', en:'① Basics & present'},
  zh:`
<h3>三类动词与「词干 + 词尾」</h3>
<p>西语动词按不定式词尾分三类：<span class="es">-ar</span>（hablar）、<span class="es">-er</span>（comer）、<span class="es">-ir</span>（vivir）。去掉词尾剩下的部分叫<b>词干</b>（raíz），变位就是「词干 + 人称词尾」。三类的词尾各不相同，所以记变位先认词尾。</p>
<h3>一般现在时（presente de indicativo）</h3>
{{G:hablar,comer,vivir|p}}
<p><span class="es">-er</span> 和 <span class="es">-ir</span> 只有 nosotros、vosotros 两格不同（-emos / -imos、-éis / -ís），其余四个人称完全一致 —— 这是西语变位里最省力的一条规律。</p>
<h3>主语代词通常省略</h3>
<p>词尾已经表明了人称，所以 yo / tú / él 一般不说；只有强调对比或消除歧义时才加。</p>
<h3>词干元音变化：e→ie、o→ue、e→i</h3>
<p>变化只发生在<b>重音落在词干上</b>的四个人称（yo、tú、él、ellos），nosotros 和 vosotros 保持原形，形状像一只靴子（习称 <i>verbos de bota</i>）。三类的典型代表各举一个：</p>
{{G:pensar,poder,pedir|p}}
<h3>只在 yo 上不规则的常见动词</h3>
<p>下面这些动词其余五个人称完全规则，只有第一人称单数要单独记。表里着色的就是那个多出来的字母：</p>
{{G:tener,poner,salir,hacer,conocer,conducir,dar,saber,ver|p}}
<div class="tip">这个 yo 形式的词干会一直<b>传染到虚拟式</b>：tener → tenga、hacer → haga、salir → salga、conocer → conozca。记住 yo 形式，等于顺手记住了虚拟式的一半。</div>
<h3>什么时候用现在时</h3>
<ul>
<li>当前的事实与状态：<span class="es">Vivo en Madrid.</span></li>
<li>习惯与反复发生的动作：<span class="es">Desayuno a las siete.</span></li>
<li>普遍真理：<span class="es">El agua hierve a 100 grados.</span></li>
<li>近期将来（口语常用）：<span class="es">Mañana te llamo.</span></li>
</ul>`,
  en:`
<h3>Three conjugations, one recipe</h3>
<p>Spanish verbs fall into three groups by infinitive ending: <span class="es">-ar</span> (hablar), <span class="es">-er</span> (comer), <span class="es">-ir</span> (vivir). Drop the ending and you get the <b>stem</b> (raíz); conjugating is just “stem + person ending”. Because the three groups have different endings, learn the endings first.</p>
<h3>Present indicative (presente de indicativo)</h3>
{{G:hablar,comer,vivir|p}}
<p><span class="es">-er</span> and <span class="es">-ir</span> differ only in nosotros and vosotros (-emos / -imos, -éis / -ís); the other four persons are identical. That is the single biggest shortcut in Spanish conjugation.</p>
<h3>Subject pronouns are usually dropped</h3>
<p>The ending already marks the person, so yo / tú / él are only added for emphasis or to remove ambiguity.</p>
<h3>Stem-vowel changes: e→ie, o→ue, e→i</h3>
<p>The change happens only where the <b>stress falls on the stem</b> — yo, tú, él, ellos. Nosotros and vosotros keep the original vowel, which is why this pattern is nicknamed the <i>boot</i> verb (verbos de bota). One representative verb for each type:</p>
{{G:pensar,poder,pedir|p}}
<h3>Verbs irregular only in yo</h3>
<p>Everything else about these verbs is regular — only the first person singular has to be memorised. The coloured letters in the tables are the ones that were added or swapped:</p>
{{G:tener,poner,salir,hacer,conocer,conducir,dar,saber,ver|p}}
<div class="tip">That yo stem is then <b>inherited by the whole present subjunctive</b>: tener → tenga, hacer → haga, salir → salga, conocer → conozca. Learn the yo form and you get half the subjunctive for free.</div>
<h3>When the present is used</h3>
<ul>
<li>Current facts and states: <span class="es">Vivo en Madrid.</span></li>
<li>Habits and repeated actions: <span class="es">Desayuno a las siete.</span></li>
<li>General truths: <span class="es">El agua hierve a 100 grados.</span></li>
<li>Near future in speech: <span class="es">Mañana te llamo.</span></li>
</ul>`,
  lk:[lkRae('hablar'), LK_WIKI_PRES, LK_RAE_GRAM, LK_CVC_A]
},
{
  k:'past',
  t:{zh:'② 四种过去时：一次说清', en:'② The four past tenses'},
  s:{zh:'② 四种过去时', en:'② Four past tenses'},
  zh:`
<h3>先分清四种「过去」</h3>
<table>
<tr><th>时态</th><th>构成</th><th>核心感觉</th></tr>
<tr><td>现在完成时<br><span class="es">pretérito perfecto</span></td><td>he / has / ha / hemos / habéis / han + 分词</td><td>与「现在」仍然相连的一段过去：今天、这周、刚刚</td></tr>
<tr><td>简单过去时<br><span class="es">pretérito indefinido</span></td><td>hablé, hablaste, habló…</td><td>一次性的、已经结束的动作，强调「发生了」</td></tr>
<tr><td>过去未完成时<br><span class="es">pretérito imperfecto</span></td><td>hablaba, hablabas, hablaba…</td><td>背景、描写、习惯、正在进行的动作，不关心起止点</td></tr>
<tr><td>过去完成时<br><span class="es">pluscuamperfecto</span></td><td>había + 分词</td><td>「过去的过去」，比另一个过去动作更早</td></tr>
</table>
<h3>规则词尾</h3>
{{G:hablar,comer|pr}}
{{G:hablar,comer|i}}
<p>三点值得留意：简单过去时 <span class="es">-ar</span> 与 <span class="es">-er/-ir</span> 的词尾完全不同；过去未完成时 <span class="es">-er/-ir</span> 共用一套词尾（-ía…），且这个 <b>í 永远带重音</b>；过去未完成时只有三个不规则 —— ser → era、ir → iba、ver → veía。</p>
<h3>不规则的「强过去式」</h3>
<p>一批最高频的动词换掉整个词干，并且<b>词尾重音不再打在结尾</b>（-e, -iste, -o, -imos, -isteis, -ieron）。十二个动词排成两排，注意整张表里没有一格是规则形状：</p>
{{G:estar,tener,andar,haber,hacer,decir|pr}}
{{G:venir,querer,poder,poner,saber,traer|pr}}
<p>其中 ser 与 ir 的简单过去时<b>完全同形</b>，而且六个形式没有一个是规则的：</p>
{{G:ser,ir|pr}}
<div class="tip ok">这套词干会<b>原封不动地传给虚拟式过去未完成时</b>：tuve → tuviera / tuviese，hice → hiciera / hiciese。记一个词干，等于拿下一整片形式。</div>
<ul>
<li>-ir 的强过去式还有「第三人称换元音」：dormir → durmió / durmieron；pedir → pidió / pidieron；sentir → sintió / sintieron。</li>
<li>decir、traer 这类以 j 结尾的词干，第三人称复数写作 -jeron：dijeron、trajeron。</li>
</ul>
<h3>常见的不规则过去分词</h3>
<p>还有一批动词的分词不走 -ado / -ido，只能单独记（放在现在完成时里看）：</p>
{{G:hacer,decir,ver,poner|pp}}
{{G:escribir,abrir,cubrir,romper|pp}}
{{G:volver,morir,resolver,devolver|pp}}
<p>它们同时出现在现在完成时、过去完成时、将来完成时和被动语态里 —— 一个记错会连错好几处。</p>
<h3>选哪个：一个判断顺序</h3>
<ul>
<li>还影响「现在」→ 现在完成时。<span class="es">Hoy he comido paella.</span></li>
<li>是「发生了一件事」→ 简单过去时。<span class="es">Ayer comí paella.</span></li>
<li>是「当时的样子 / 习惯 / 正在做」→ 过去未完成时。<span class="es">Cuando era niño, comía paella todos los domingos.</span></li>
<li>比另一个过去动作更早 → 过去完成时。<span class="es">Cuando llegué, ya habían comido.</span></li>
</ul>
<div class="tip">同一个句子里，过去未完成时提供「布景」，简单过去时推进「剧情」：<span class="es">Leía cuando sonó el teléfono.</span></div>`,
  en:`
<h3>Telling the four pasts apart</h3>
<table>
<tr><th>Tense</th><th>Formed with</th><th>Core feeling</th></tr>
<tr><td>Present perfect<br><span class="es">pretérito perfecto</span></td><td>he / has / ha / hemos / habéis / han + participle</td><td>A past still connected to now: today, this week, just now</td></tr>
<tr><td>Preterite<br><span class="es">pretérito indefinido</span></td><td>hablé, hablaste, habló…</td><td>A one-off, finished action — it happened</td></tr>
<tr><td>Imperfect<br><span class="es">pretérito imperfecto</span></td><td>hablaba, hablabas, hablaba…</td><td>Background, description, habit, ongoing action — no interest in start or end</td></tr>
<tr><td>Pluperfect<br><span class="es">pluscuamperfecto</span></td><td>había + participle</td><td>The past of the past — earlier than another past action</td></tr>
</table>
<h3>Regular endings</h3>
{{G:hablar,comer|pr}}
{{G:hablar,comer|i}}
<p>Three things to notice: preterite endings are completely different for <span class="es">-ar</span> and <span class="es">-er/-ir</span>; the imperfect shares one set of endings for <span class="es">-er/-ir</span> (-ía…) and that <b>í always carries an accent</b>; and the imperfect has only three irregular verbs — ser → era, ir → iba, ver → veía.</p>
<h3>Strong preterites</h3>
<p>A group of very frequent verbs swaps the whole stem and <b>moves the stress off the ending</b> (-e, -iste, -o, -imos, -isteis, -ieron). Twelve verbs in two rows — not one cell in either table has a regular shape:</p>
{{G:estar,tener,andar,haber,hacer,decir|pr}}
{{G:venir,querer,poder,poner,saber,traer|pr}}
<p>Most frequent of all, the preterites of <span class="es">ser</span> and <span class="es">ir</span> are <b>completely identical</b> — and not one of the six forms is regular:</p>
{{G:ser,ir|pr}}
<div class="tip ok">Those stems are then <b>reused unchanged by the past subjunctive</b>: tuve → tuviera / tuviese, hice → hiciera / hiciese. One stem buys you a whole family of forms.</div>
<ul>
<li>Some <span class="es">-ir</span> verbs also change the vowel in the third person: dormir → durmió / durmieron; pedir → pidió / pidieron; sentir → sintió / sintieron.</li>
<li>Stems ending in j take -jeron in the third person plural: dijeron, trajeron.</li>
</ul>
<h3>Common irregular participles</h3>
<p>Another group forms the participle without -ado / -ido and simply has to be learnt (shown here inside the present perfect):</p>
{{G:hacer,decir,ver,poner|pp}}
{{G:escribir,abrir,cubrir,romper|pp}}
{{G:volver,morir,resolver,devolver|pp}}
<p>They appear in the present perfect, pluperfect, future perfect and the passive — one mistake propagates through several tenses.</p>
<h3>Choosing: a decision order</h3>
<ul>
<li>Still connected to now → present perfect. <span class="es">Hoy he comido paella.</span></li>
<li>A single finished event → preterite. <span class="es">Ayer comí paella.</span></li>
<li>How things were / a habit / in progress → imperfect. <span class="es">Cuando era niño, comía paella todos los domingos.</span></li>
<li>Earlier than another past action → pluperfect. <span class="es">Cuando llegué, ya habían comido.</span></li>
</ul>
<div class="tip">In one sentence the imperfect sets the <b>scene</b> and the preterite moves the <b>plot</b>: <span class="es">Leía cuando sonó el teléfono.</span></div>`,
  lk:[lkRae('tener'), lkRae('ser'), LK_RAE_GRAM, LK_CVC_B]
},
{
  k:'imperative',
  t:{zh:'③ 命令式：形式与代词位置', en:'③ The imperative: forms and pronoun placement'},
  s:{zh:'③ 命令式', en:'③ Imperative'},
  zh:`
<h3>肯定命令式（imperativo afirmativo）</h3>
<p>只有五个人称（没有 yo），三条规则就能拼完：<b>tú</b> 用第三人称单数的现在时；<b>usted / nosotros / ustedes</b> 直接用虚拟式现在时；<b>vosotros</b> 把不定式的 -r 换成 -d。右边就是这三条规则的结果：</p>
{{G:hablar,comer,vivir|ia}}
<div class="tip warnx">八个不规则的 tú 形式必须单独背：<b>di</b>（decir）、<b>haz</b>（hacer）、<b>ve</b>（ir）、<b>pon</b>（poner）、<b>sal</b>（salir）、<b>sé</b>（ser）、<b>ten</b>（tener）、<b>ven</b>（venir）。它们都很短，凑在一起很好记：</div>
{{G:decir,hacer,ir,poner|ia}}
{{G:salir,ser,tener,venir|ia}}
<h3>否定命令式（imperativo negativo）</h3>
<p>规则极其统一：<b>no + 虚拟式现在时</b>，六个人称全部如此 —— no hables, no hable, no hablemos, no habléis, no hablen。所以真正要记的其实只有虚拟式现在时的词形；词干变化也照旧带进来（pensar → no pienses）：</p>
{{G:hablar,pensar|in}}
<h3>代词放哪：肯定后置、否定前置</h3>
<ul>
<li>肯定：代词粘在动词后面，写成一个词。<span class="es">dime、cómpralo、levántate、siéntese</span></li>
<li>否定：代词放在动词前面，写成三个词。<span class="es">no me digas、no lo compres、no te levantes</span></li>
</ul>
<div class="tip">后面接代词时常常要补回重音，保持原来的重读位置：dar + me + lo → <b>dámelo</b>；poner + te + lo → <b>ponértelo</b>；poner + te → <b>ponte</b>（两音节，不必补）；irse + te → <b>vete</b>。</div>
<h3>两个细节</h3>
<ul>
<li><b>vosotros</b> 的唯一不规则是 ir：ir → id → 加 os 时写 <b>¡íos!</b>（去掉 d）。</li>
<li>否定命令式的虚拟式词干照旧继承 yo 形式的不规则与词干变化：tener → <span class="es">no tengas</span>；pensar → <span class="es">no pienses</span>；pedir → <span class="es">no pidas</span>。</li>
</ul>
<h3>不要滥用命令式</h3>
<p>对不熟的人直接用命令式会显得强硬。日常更常用疑问句或条件式来「下命令」：<span class="es">¿Puede usted…? / ¿Podría cerrar la ventana?</span></p>`,
  en:`
<h3>Affirmative imperative</h3>
<p>Only five persons (there is no yo) and three rules: <b>tú</b> takes the third person singular of the present; <b>usted / nosotros / ustedes</b> take the present subjunctive as it stands; <b>vosotros</b> swaps the infinitive’s -r for -d. The tables below are those three rules at work:</p>
{{G:hablar,comer,vivir|ia}}
<div class="tip warnx">Eight tú forms are irregular and worth memorising on their own: <b>di</b> (decir), <b>haz</b> (hacer), <b>ve</b> (ir), <b>pon</b> (poner), <b>sal</b> (salir), <b>sé</b> (ser), <b>ten</b> (tener), <b>ven</b> (venir). They are all short, so they stick easily:</div>
{{G:decir,hacer,ir,poner|ia}}
{{G:salir,ser,tener,venir|ia}}
<h3>Negative imperative</h3>
<p>Perfectly regular: <b>no + present subjunctive</b> for all six persons — no hables, no hable, no hablemos, no habléis, no hablen. So the only thing you really need is the present subjunctive, stem changes included (pensar → no pienses):</p>
{{G:hablar,pensar|in}}
<h3>Where pronouns go</h3>
<ul>
<li>Affirmative: glued to the end, written as one word. <span class="es">dime, cómpralo, levántate, siéntese</span></li>
<li>Negative: in front, written as separate words. <span class="es">no me digas, no lo compres, no te levantes</span></li>
</ul>
<div class="tip">When pronouns are attached, an accent is often added to keep the original stress: dar + me + lo → <b>dámelo</b>; poner + te + lo → <b>ponértelo</b>; poner + te → <b>ponte</b> (two syllables, no accent); irse + te → <b>vete</b>.</div>
<h3>Two details</h3>
<ul>
<li>The only irregular <b>vosotros</b> form is ir: ir → id → with os it becomes <b>¡íos!</b> (the d is dropped).</li>
<li>The negative imperative inherits all the yo-form irregularity and stem changes: tener → <span class="es">no tengas</span>; pensar → <span class="es">no pienses</span>; pedir → <span class="es">no pidas</span>.</li>
</ul>
<h3>Do not overuse it</h3>
<p>With strangers a bare command sounds blunt. Questions and conditionals are the politer route: <span class="es">¿Puede usted…? / ¿Podría cerrar la ventana?</span></p>`,
  lk:[lkRae('haber'), lkRae('hacer'), LK_DPD, LK_CVC_B]
},
{
  k:'future',
  t:{zh:'④ 将来式：将来时与条件式是「一对」', en:'④ The future: simple future and conditional come as a pair'},
  s:{zh:'④ 将来式', en:'④ Future'},
  zh:`
<h3>将来时（futuro simple）</h3>
<p>所有动词共用一个词干 —— <b>整个不定式</b>，再统一加词尾：</p>
{{G:hablar,comer,vivir|f}}
<p>三类动词共用同一套词尾，<b>重音全落在词尾</b>；注意 -er / -ir 也保留自己的元音（comeré，不是 comaré）。</p>
<h3>十二个不规则词干</h3>
<p>这里变的不是词尾，而是词干，最好整块背下来：</p>
<ul>
<li>tener → tendr-；poner → pondr-；salir → saldr-；venir → vendr-</li>
<li>poder → podr-；querer → querr-；saber → sabr-；haber → habr-</li>
<li>hacer → har-；decir → dir-；caber → cabr-；valer → valdr-</li>
</ul>
<p>放进整张表里看更清楚：不规则的只是<b>词干里多出来的那个字母</b>，词尾和完全规则的动词一模一样：</p>
{{G:tener,poner,hacer,decir|f}}
<h3>条件式用的是同一套词干</h3>
<p>条件式 = 同一个词干 + <span class="es">-ía</span> 系列词尾（-ía, -ías, -ía, -íamos, -íais, -ían）。所以 <b>将来时与条件式永远成对出现</b>，不规则也完全一致，把两张表对照着记，一门等于两门：</p>
{{G:tener,decir|f}}
{{G:tener,decir|c}}
<h3>复合形式</h3>
<p><span class="es">haber</span> 的将来时 + 过去分词 = 将来完成时：<span class="es">habré hablado, habrás comido</span>；条件完成时同理：<span class="es">habría hablado</span>。</p>
<h3>用法</h3>
<ul>
<li>真正的将来：<span class="es">Mañana lloverá.</span></li>
<li>对现在的推测：<span class="es">Serán las tres.</span>（大概三点了）</li>
<li>语气强一点的吩咐：<span class="es">Harás lo que te digo.</span></li>
</ul>
<div class="tip">口语里表示「将要做某事」，更常用 <b>ir a + 不定式</b>：<span class="es">Voy a llamarte.</span> 但「推测」这一层含义是 ir a 做不到的，正是将来时最独特的地方。</div>`,
  en:`
<h3>Simple future</h3>
<p>Every verb uses one and the same stem — the <b>whole infinitive</b> — plus one shared set of endings:</p>
{{G:hablar,comer,vivir|f}}
<p>All three conjugations share the endings and the <b>stress always falls on the ending</b>. Note that -er / -ir keep their own vowel: comeré, never comaré.</p>
<h3>Twelve irregular stems</h3>
<p>Here it is the stem, not the ending, that changes. Best learnt as one block:</p>
<ul>
<li>tener → tendr-; poner → pondr-; salir → saldr-; venir → vendr-</li>
<li>poder → podr-; querer → querr-; saber → sabr-; haber → habr-</li>
<li>hacer → har-; decir → dir-; caber → cabr-; valer → valdr-</li>
</ul>
<p>In full tables it is clearer: the only irregular thing is the <b>extra letter inside the stem</b> — the endings are exactly the regular ones:</p>
{{G:tener,poner,hacer,decir|f}}
<h3>The conditional uses the very same stems</h3>
<p>Conditional = same stem + the <span class="es">-ía</span> endings (-ía, -ías, -ía, -íamos, -íais, -ían). So the future and the conditional <b>always travel together</b>, irregulars and all. Read the two tables side by side and one buys you the other:</p>
{{G:tener,decir|f}}
{{G:tener,decir|c}}
<h3>Compound forms</h3>
<p>Future of <span class="es">haber</span> + participle = future perfect: <span class="es">habré hablado, habrás comido</span>. The conditional perfect works the same way: <span class="es">habría hablado</span>.</p>
<h3>Uses</h3>
<ul>
<li>Real future: <span class="es">Mañana lloverá.</span></li>
<li>Speculation about the present: <span class="es">Serán las tres.</span> (it must be about three)</li>
<li>A firm instruction: <span class="es">Harás lo que te digo.</span></li>
</ul>
<div class="tip">In speech, “going to do something” is usually <b>ir a + infinitive</b>: <span class="es">Voy a llamarte.</span> But ir a cannot express speculation — that is the future tense’s own speciality.</div>`,
  lk:[lkRae('tener'), lkRae('hacer'), LK_RAE_GRAM, LK_CVC_B]
},
{
  k:'subj',
  t:{zh:'⑤ 虚拟语气与条件式', en:'⑤ The subjunctive and the conditional'},
  s:{zh:'⑤ 虚拟语气与条件式', en:'⑤ Subjunctive & conditional'},
  zh:`
<h3>虚拟式现在时：从 yo 形式出发</h3>
<p>造虚拟式现在时只有两步：</p>
<ul>
<li>取<b>现在时的 yo 形式</b>，去掉词尾 -o，得到词干；</li>
<li><span class="es">-ar</span> 动词加 <b>-e</b> 系列词尾，<span class="es">-er/-ir</span> 动词加 <b>-a</b> 系列词尾（两类正好对调）。</li>
</ul>
{{G:hablar,comer,tener|sp}}
<p>因为都从 yo 形式出发，现在时里「只在 yo 上不规则」的词干会自动带进来：tener → tengo → <b>tenga</b>，hacer → hago → <b>haga</b>，salir → salgo → <b>salga</b>，conocer → conozco → <b>conozca</b>。词干元音变化也照搬：pensar → piense、poder → pueda、pedir → pida。</p>
<div class="tip warnx">六个必须单独记：<b>ser → sea</b>、<b>estar → esté</b>、<b>ir → vaya</b>、<b>haber → haya</b>、<b>saber → sepa</b>、<b>dar → dé</b>（带重音，用来和介词 de 区分；它是唯一带重音的虚拟式形式）。</div>
<h3>虚拟式过去未完成时：从 ellos 形式出发</h3>
<p>取<b>简单过去时第三人称复数</b>，去掉 -ron，再加 <span class="es">-ra</span> 或 <span class="es">-se</span> 词尾：</p>
<ul>
<li>hablaron → habla- → <span class="es">hablara / hablase</span></li>
<li>comieron → comie- → <span class="es">comiera / comiese</span></li>
<li>tuvieron → tuvie- → <span class="es">tuviera / tuviese</span>（强过去式的词干自动继承）</li>
</ul>
<p><b>-ra 与 -se 两种形式都正确</b>，只是地区习惯不同；在本程序里两种都判为正确。左边规则动词、右边强词干动词，对照着看：</p>
{{G:hablar,tener|si}}
<h3>什么时候用虚拟式</h3>
<ul>
<li>主句表达愿望、情感、怀疑、评价，从句由 que 引导：<span class="es">Quiero que vengas. / Dudo que sea cierto.</span></li>
<li>ojalá、quizá、tal vez 之后：<span class="es">Ojalá llueva.</span></li>
<li>指将来的时间、目的、条件从句：<span class="es">Cuando llegues, llámame.</span></li>
<li>否定命令式：<span class="es">No hables.</span></li>
</ul>
<p>核心判据只有一个：从句说的是<b>事实</b>还是<b>意向中的事</b>。陈述事实用陈述式，表达意愿、怀疑、未定则用虚拟式。（这里的用法规则比形式复杂得多，需要细究时请走下面的权威外链。）</p>
<h3>条件式（condicional simple）</h3>
<p>构词法与将来时完全同源（词干相同、词尾换成 -ía 系列），所以不规则也完全一样：tendría、haría、pondría、diría… 两组并排看，一眼就明白为什么说「一门等于两门」：</p>
{{G:tener|f}}
{{G:tener|c}}
<ul>
<li>礼貌请求：<span class="es">¿Podrías ayudarme?</span></li>
<li>假设条件下的结果：<span class="es">Si tuviera tiempo, iría.</span></li>
<li>过去视角里的将来：<span class="es">Dijo que vendría.</span></li>
</ul>
<h3>si 句型的三种搭配</h3>
<table>
<tr><th>条件从句</th><th>主句</th><th>例子</th></tr>
<tr><td>si + 现在时</td><td>将来时 / 现在时 / 命令式</td><td>Si tengo tiempo, iré.</td></tr>
<tr><td>si + 虚拟式过去未完成时</td><td>条件式</td><td>Si tuviera tiempo, iría.</td></tr>
<tr><td>si + 虚拟式过去完成时</td><td>条件完成时</td><td>Si hubiera tenido tiempo, habría ido.</td></tr>
</table>
<div class="tip warnx">si 后面<b>永远不接</b>条件式或将来时：<s>si tendría</s>、<s>si tendré</s> 都是错的。</div>`,
  en:`
<h3>Present subjunctive: start from yo</h3>
<p>Two steps only:</p>
<ul>
<li>Take the <b>yo form of the present</b>, drop the -o to get the stem;</li>
<li><span class="es">-ar</span> verbs take the <b>-e</b> endings, <span class="es">-er/-ir</span> verbs take the <b>-a</b> endings (the two groups swap).</li>
</ul>
{{G:hablar,comer,tener|sp}}
<p>Because everything starts from the yo form, the “irregular only in yo” stems come along for free: tener → tengo → <b>tenga</b>, hacer → hago → <b>haga</b>, salir → salgo → <b>salga</b>, conocer → conozco → <b>conozca</b>. Stem-vowel changes transfer as well: pensar → piense, poder → pueda, pedir → pida.</p>
<div class="tip warnx">Six to memorise separately: <b>ser → sea</b>, <b>estar → esté</b>, <b>ir → vaya</b>, <b>haber → haya</b>, <b>saber → sepa</b>, <b>dar → dé</b> (accented, to distinguish it from the preposition de — the only accented subjunctive form).</div>
<h3>Past subjunctive: start from ellos</h3>
<p>Take the <b>third person plural of the preterite</b>, drop -ron, add <span class="es">-ra</span> or <span class="es">-se</span>:</p>
<ul>
<li>hablaron → habla- → <span class="es">hablara / hablase</span></li>
<li>comieron → comie- → <span class="es">comiera / comiese</span></li>
<li>tuvieron → tuvie- → <span class="es">tuviera / tuviese</span> (strong preterite stems carry over automatically)</li>
</ul>
<p><b>Both the -ra and the -se forms are correct</b> — only regional preference differs. This app accepts either. A regular verb and a strong-stem verb, side by side:</p>
{{G:hablar,tener|si}}
<h3>When the subjunctive is used</h3>
<ul>
<li>Wishes, emotions, doubt or judgements in the main clause, with a que clause: <span class="es">Quiero que vengas. / Dudo que sea cierto.</span></li>
<li>After ojalá, quizá, tal vez: <span class="es">Ojalá llueva.</span></li>
<li>Time, purpose and conditional clauses referring to the future: <span class="es">Cuando llegues, llámame.</span></li>
<li>The negative imperative: <span class="es">No hables.</span></li>
</ul>
<p>The one core test: does the clause state a <b>fact</b> or something <b>intended / unreal</b>? Facts take the indicative; wishes, doubt and non-reality take the subjunctive. (The usage rules are far more intricate than the forms — follow the authoritative links below for detail.)</p>
<h3>Conditional (condicional simple)</h3>
<p>Built exactly like the future (same stems, endings replaced by the -ía set), so the irregulars are identical: tendría, haría, pondría, diría… Side by side, it is obvious why one buys you the other:</p>
{{G:tener|f}}
{{G:tener|c}}
<ul>
<li>Polite requests: <span class="es">¿Podrías ayudarme?</span></li>
<li>Result under a hypothetical condition: <span class="es">Si tuviera tiempo, iría.</span></li>
<li>Future seen from the past: <span class="es">Dijo que vendría.</span></li>
</ul>
<h3>The three si-patterns</h3>
<table>
<tr><th>If-clause</th><th>Main clause</th><th>Example</th></tr>
<tr><td>si + present</td><td>future / present / imperative</td><td>Si tengo tiempo, iré.</td></tr>
<tr><td>si + past subjunctive</td><td>conditional</td><td>Si tuviera tiempo, iría.</td></tr>
<tr><td>si + pluperfect subjunctive</td><td>conditional perfect</td><td>Si hubiera tenido tiempo, habría ido.</td></tr>
</table>
<div class="tip warnx">After si you <b>never</b> use the conditional or the future: <s>si tendría</s>, <s>si tendré</s> are both wrong.</div>`,
  lk:[lkRae('tener'), lkRae('ser'), LK_WIKI_SUBJ, LK_DPD, LK_RAE_GRAM]
},
{
  k:'orth',
  t:{zh:'⑥ 正字法不规则：只改拼写，不改读音', en:'⑥ Spelling changes: the sound stays, the letters move'},
  s:{zh:'⑥ 正字法不规则整理', en:'⑥ Spelling changes'},
  zh:`
<h3>这一类变化是什么</h3>
<p>它<b>不改变读音，只改变拼写</b>。原因是 c、g、z、qu 这些字母在不同元音前读音不同：词尾一变，为了保住原来的读音，字母就必须跟着调整。</p>
<p>判断方法只有一句话：先按规则写出「理论上」的形式，读一遍；<b>读音变了就换写法，读音没变就不动</b>。</p>
<h3>1 · 保住 c 的 /k/ 音：c → qu</h3>
<p>代表动词：<span class="es">sacar、buscar、explicar、tocar</span>。用 tocar 走一遍 —— 注意范围不同：简单过去时只有 yo 要改，虚拟式是<b>六个人称全改</b>：</p>
{{G:tocar|pr}}
{{G:tocar|sp}}
<p>c 在 e、i 前读 /θ/ 或 /s/，所以在简单过去时 yo 和整个虚拟式里必须换成 qu，才能保住 /k/。</p>
<h3>2 · 保住 g 的 /g/ 音：g → gu</h3>
<p>代表动词：<span class="es">llegar、pagar、jugar、investigar</span>。范围与上面一致 —— 简单过去时只有 yo，虚拟式六个人称全改：</p>
{{G:llegar|pr}}
{{G:llegar|sp}}
<p><span class="es">jugar</span> 是唯一的 <b>u → ue</b> 动词，于是两种变化叠在一起：虚拟式 <span class="es">juegue</span> 里两个 u 各管一摊 —— <b>ue</b> 是词干交替，<b>gu</b> 是保住 /g/ 的写法。</p>
{{G:jugar|pr}}
{{G:jugar|sp}}
<h3>3 · -zar 动词：z → c</h3>
<p>代表动词：<span class="es">empezar、cruzar、abrazar、realizar</span>。</p>
{{G:empezar|pr}}
{{G:empezar|sp}}
<p>z 永远不出现在 e、i 前，所以一律改写成 c，读音完全不变。empezar 还兼有 e → ie 的词干交替，在同一张表里也一并看得见。</p>
<h3>4 · -ger / -gir 动词：g → j</h3>
<p>代表动词：<span class="es">coger、dirigir、elegir、proteger</span>。这一类改的是<b>现在时 yo</b> 和<b>整个虚拟式</b>：</p>
{{G:coger|p}}
{{G:coger|sp}}
<p>g 在 e、i 前读 /x/，想保持 /x/ 就直接写 j。所以 coger 的 yo 是 <span class="es">cojo</span>，不是 <s>cogo</s>。</p>
<h3>5 · 元音之间的 i → y</h3>
<p>两类：<span class="es">-uir</span> 动词（<span class="es">construir、incluir</span>）除 nosotros / vosotros 外，其余人称都在词尾加 y；<span class="es">leer、creer、oír</span> 这类则只在第三人称把 i 换成 y。两种写法对照：</p>
{{G:construir|p}}
{{G:leer|pr}}
<h3>6 · -guir：g 脱落</h3>
<p>代表动词：<span class="es">seguir、conseguir、distinguir</span>。g 后面的 u 只为保住 /g/ 而存在，一旦词尾是 e、i，u 就多余，直接脱落：</p>
{{G:seguir|p}}
<p>seguir 同时还有 <b>e → i</b> 的词干交替，所以 yo 是 <span class="es">sigo</span>，不是 <s>siguo</s>。</p>
<h3>7 · 命令式里的重音书写</h3>
<p>代词粘到动词后面时，单词变长但<b>重音位置不变</b>，因此常常要补写重音符号：dar + me + lo → <b>dámelo</b>；poner + te + lo → <b>ponértelo</b>；irse + te → <b>vete</b>（两音节，不必补）。这些形式正是靠重音符号与普通陈述句区分开。看两组自复动词的命令式，重音符的位置一目了然：</p>
{{G:levantarse|ia}}
{{G:irse|ia}}
<div class="tip">一句话总结：<b>先按规则变，再读一遍；读音不变就不改，读音变了就换字母。</b> 在本程序里，这一类形式统一用青色标出。</div>`,
  en:`
<h3>What this category is</h3>
<p>These changes <b>never alter the pronunciation, only the spelling</b>. The reason is that c, g, z and qu sound different depending on the following vowel: when the ending changes, the letters must change with it to preserve the original sound.</p>
<p>The test is one sentence long: write the “theoretical” form by the rules, then read it out. <b>If the sound changed, change the letters; if it did not, leave them alone.</b></p>
<h3>1 · Keep the /k/ of c: c → qu</h3>
<p>Typical verbs: <span class="es">sacar, buscar, explicar, tocar</span>. Here it is with tocar — note the different scope: in the preterite only yo changes, in the subjunctive <b>all six persons do</b>:</p>
{{G:tocar|pr}}
{{G:tocar|sp}}
<p>Before e and i, c is pronounced /θ/ or /s/, so the preterite yo form and the whole subjunctive must switch to qu to keep the /k/.</p>
<h3>2 · Keep the /g/ of g: g → gu</h3>
<p>Typical verbs: <span class="es">llegar, pagar, jugar, investigar</span>. The scope matches the previous group — preterite yo only, subjunctive in all six persons:</p>
{{G:llegar|pr}}
{{G:llegar|sp}}
<p><span class="es">jugar</span> is the only <b>u → ue</b> verb, so the two changes stack here: in the subjunctive <span class="es">juegue</span> the two u’s have separate jobs — <b>ue</b> is the stem alternation, <b>gu</b> is what keeps the /g/ sound.</p>
{{G:jugar|pr}}
{{G:jugar|sp}}
<h3>3 · -zar verbs: z → c</h3>
<p>Typical verbs: <span class="es">empezar, cruzar, abrazar, realizar</span>.</p>
{{G:empezar|pr}}
{{G:empezar|sp}}
<p>z never appears before e or i, so it is always rewritten as c — the sound is untouched. empezar also carries an e → ie alternation, visible in the same table.</p>
<h3>4 · -ger / -gir verbs: g → j</h3>
<p>Typical verbs: <span class="es">coger, dirigir, elegir, proteger</span>. What changes is the <b>present-tense yo</b> and the <b>whole subjunctive</b>:</p>
{{G:coger|p}}
{{G:coger|sp}}
<p>Before e and i, g is pronounced /x/, so it is written j to keep that sound. That is why the yo form of coger is <span class="es">cojo</span>, not <s>cogo</s>.</p>
<h3>5 · i → y between vowels</h3>
<p>Two kinds: <span class="es">-uir</span> verbs (<span class="es">construir, incluir</span>) add a y in every person except nosotros / vosotros; verbs like <span class="es">leer, creer, oír</span> only swap i for y in the third person. Side by side:</p>
{{G:construir|p}}
{{G:leer|pr}}
<h3>6 · -guir: the g disappears</h3>
<p>Typical verbs: <span class="es">seguir, conseguir, distinguir</span>. The u after g exists only to keep the /g/ sound, so as soon as the ending is e or i the u is redundant and drops out:</p>
{{G:seguir|p}}
<p>seguir also carries an <b>e → i</b> alternation, so the yo form is <span class="es">sigo</span>, not <s>siguo</s>.</p>
<h3>7 · Written accents in the imperative</h3>
<p>When pronouns are attached, the word grows longer but the <b>stress stays where it was</b>, so an accent is often added: dar + me + lo → <b>dámelo</b>; poner + te + lo → <b>ponértelo</b>; irse + te → <b>vete</b> (two syllables, no accent needed). Those accents are exactly what distinguishes these forms from ordinary statements. Two reflexive paradigms show the accent position at a glance:</p>
{{G:levantarse|ia}}
{{G:irse|ia}}
<div class="tip">In one line: <b>conjugate by the rules, then read it aloud — unchanged sound, unchanged spelling.</b> In this app, forms of this kind are shown in teal.</div>`,
  lk:[lkRae('empezar'), lkRae('seguir'), LK_WIKI_ORTH, LK_DPD]
},
{
  k:'stem',
  t:{zh:'⑦ 词根变化不规则：元音交替与强词干', en:'⑦ Stem changes: vowel alternation and strong stems'},
  s:{zh:'⑦ 词根变化不规则整理', en:'⑦ Stem changes'},
  zh:`
<h3>这一类变化是什么</h3>
<p>它动的是<b>词干里的元音或辅音</b>，真的改变了读音 —— 这和正字法（只改拼写）完全不同。判断依据很简单：看同一个动词在不同人称 / 时态下，词干是否还是原来的样子。</p>
<h3>1 · 词干元音交替：e→ie、o→ue、e→i</h3>
<p>只在重读词干的人称（yo、tú、él、ellos）出现，nosotros / vosotros 保持原样：</p>
<ul>
<li><b>e → ie</b>：pensar → pienso；cerrar → cierro；entender → entiendo；querer → quiero</li>
<li><b>o → ue</b>：poder → puedo；dormir → duermo；volver → vuelvo；contar → cuento</li>
<li><b>e → i</b>（只限 -ir 动词）：pedir → pido；servir → sirvo；repetir → repito；seguir → sigo</li>
<li><b>u → ue</b>（唯一一个）：jugar → juego</li>
</ul>
<p>四种交替各挑一个代表，排成整表最直观 —— 六个人称里<b>只有 nosotros / vosotros 保持原样</b>，其余四个正好是重读词干的人称：</p>
{{G:pensar,poder,pedir,jugar|p}}
<p>同一个交替会一并带进虚拟式现在时，同样<b>不进</b> nosotros / vosotros：</p>
{{G:pensar,poder,pedir,jugar|sp}}
<h3>2 · -ir 动词在第三人称的额外变化</h3>
<p><span class="es">-ir</span> 动词在简单过去时和虚拟式里，第三人称还会再变一次元音：</p>
<ul>
<li>e → i：pedir → pidió / pidieron；sentir → sintió / sintieron；repetir → repitió / repitieron</li>
<li>o → u：dormir → durmió / durmieron；morir → murió / murieron</li>
</ul>
<p>看表最清楚 —— 只有 él / ellos 两格换元音，nosotros / vosotros 反而回到原样（pedimos / pedisteis、dormimos / dormisteis）：</p>
{{G:pedir,dormir|pr}}
{{G:pedir,dormir|si}}
<h3>3 · 强过去式：换掉整个词干</h3>
<p>这批动词的简单过去时既换词干、又换词尾，而且重音不打在结尾 —— 这正是它们与上面「只换词干元音」最大的区别。十二个动词，分成两排：</p>
{{G:tener,estar,hacer,decir,venir,poder|pr}}
{{G:poner,saber,querer,traer,andar,haber|pr}}
<p>而它们的词干会被虚拟式过去未完成时<b>完整继承</b>（-ra / -se 两种词尾都合法，本程序都判对）：</p>
{{G:tener,estar,hacer,decir,venir,poder|si}}
<p>注意以 j 结尾的词干：dije → dije<b>ron</b>（不是 dicieron），而且虚拟式里 j 原样保留：dijera。</p>
<h3>4 · 不规则过去分词</h3>
<p>这些动词的过去分词不走 -ado / -ido，要单独记。放进现在完成时里看最直观（顺便验证它们确实要配 haber）：</p>
{{G:hacer,decir,ver,poner|pp}}
{{G:escribir,abrir,cubrir,romper|pp}}
{{G:volver,morir,resolver,devolver|pp}}
<p>它们同时影响现在完成时、过去完成时、将来完成时和被动语态 —— 一个记错会连错好几处，值得单独整理成表。（imprimir 两种分词都通行：<span class="es">impreso</span> / <span class="es">imprimido</span>，本程序按后者显示。）</p>
<h3>5 · 记忆策略：按「词干」而不是按「时态」记</h3>
<ul>
<li>一个不规则词干往往同时供好几个时态使用：tendr- → tendré、tendría、tendrás…</li>
<li>派生词跟随原词：tener → mantener / obtener / detener / contener，全是 tengo、tuve、tendré、tendría</li>
<li>decir 传给 predecir、contradecir；poner 传给 componer、suponer；venir 传给 convenir、prevenir</li>
</ul>
<div class="tip">所以遇到没见过的动词，先找它的<b>词根</b>：如果词根是不规则动词，它几乎一定跟着不规则。在本程序里，这类形式统一用橙色标出。</div>`,
  en:`
<h3>What this category is</h3>
<p>Here the <b>vowel or consonant of the stem</b> changes, so the pronunciation really does change — quite unlike the spelling-change group. The test is simple: does the verb keep the same stem across persons and tenses?</p>
<h3>1 · Stem-vowel alternation: e→ie, o→ue, e→i</h3>
<p>Only where the stem is stressed (yo, tú, él, ellos); nosotros / vosotros keep the original vowel:</p>
<ul>
<li><b>e → ie</b>: pensar → pienso; cerrar → cierro; entender → entiendo; querer → quiero</li>
<li><b>o → ue</b>: poder → puedo; dormir → duermo; volver → vuelvo; contar → cuento</li>
<li><b>e → i</b> (<span class="es">-ir</span> verbs only): pedir → pido; servir → sirvo; repetir → repito; seguir → sigo</li>
<li><b>u → ue</b> (the only one): jugar → juego</li>
</ul>
<p>One representative verb per alternation makes it clearest in a full table — of the six persons <b>only nosotros / vosotros keep the original vowel</b>, and the other four are exactly the ones with a stressed stem:</p>
{{G:pensar,poder,pedir,jugar|p}}
<p>The same alternation is carried into the present subjunctive as well, and again <b>never</b> into nosotros / vosotros:</p>
{{G:pensar,poder,pedir,jugar|sp}}
<h3>2 · Extra changes in the third person of -ir verbs</h3>
<p>In the preterite and the subjunctive, <span class="es">-ir</span> verbs change the vowel once more in the third person:</p>
<ul>
<li>e → i: pedir → pidió / pidieron; sentir → sintió / sintieron; repetir → repitió / repitieron</li>
<li>o → u: dormir → durmió / durmieron; morir → murió / murieron</li>
</ul>
<p>The table says it best — only the él / ellos cells change vowel, while nosotros / vosotros go back to the original (pedimos / pedisteis, dormimos / dormisteis):</p>
{{G:pedir,dormir|pr}}
{{G:pedir,dormir|si}}
<h3>3 · Strong preterites: a whole new stem</h3>
<p>These verbs take both a new stem and new endings in the preterite, with the stress off the ending — that is the real difference from the “vowel alternation only” group above. Twelve verbs, in two rows:</p>
{{G:tener,estar,hacer,decir,venir,poder|pr}}
{{G:poner,saber,querer,traer,andar,haber|pr}}
<p>The past subjunctive inherits the stem <b>untouched</b> (both the -ra and the -se endings are correct, and this app accepts either):</p>
{{G:tener,estar,hacer,decir,venir,poder|si}}
<p>Watch the j-stems: dije → dije<b>ron</b> (not dicieron), and the j survives into the subjunctive: dijera.</p>
<h3>4 · Irregular past participles</h3>
<p>These verbs do not form the participle with -ado / -ido, so they must be learnt separately. Seen inside the present perfect (which also confirms they take haber):</p>
{{G:hacer,decir,ver,poner|pp}}
{{G:escribir,abrir,cubrir,romper|pp}}
{{G:volver,morir,resolver,devolver|pp}}
<p>They show up in the present perfect, pluperfect, future perfect and the passive — one mistake spreads across several tenses, so they deserve a table of their own. (imprimir accepts two participles, <span class="es">impreso</span> / <span class="es">imprimido</span>; this app shows the latter.)</p>
<h3>5 · Learn by stem, not by tense</h3>
<ul>
<li>One irregular stem often serves several tenses: tendr- → tendré, tendría, tendrás…</li>
<li>Derived verbs follow their base: tener → mantener / obtener / detener / contener, all with tengo, tuve, tendré, tendría</li>
<li>decir passes on to predecir, contradecir; poner to componer, suponer; venir to convenir, prevenir</li>
</ul>
<div class="tip">So when you meet an unfamiliar verb, look for its <b>base verb</b> first: if the base is irregular, the new verb almost certainly is too. In this app these forms are shown in orange.</div>`,
  lk:[lkRae('tener'), lkRae('pedir'), LK_WIKI_IRR, LK_FUNDEU]
},
{
  k:'accent',
  t:{zh:'⑧ 重音与重音符：哪几个形式必须写 ´', en:'⑧ Stress and the written accent'},
  s:{zh:'⑧ 重音与重音符', en:'⑧ Stress & accents'},
  zh:`
<h3>重音落在哪：两条默认规则</h3>
<p>不写重音符时，重音位置由词尾决定：<b>以元音或 -n、-s 结尾的，重音落在倒数第二个音节</b>（ha-blo、can-tas、ha-blan）；<b>以其他辅音结尾的，重音落在最后一个音节</b>（ha-blar、co-mer、vi-vir）。</p>
<p>重音符（tilde，´）只干一件事：<b>打破这个默认</b>。写了它，重音就落在带符的那个元音上 —— 反过来说，只要看到重音符，就说明这个地方按默认规则读是不对的。</p>
<div class="tip">做题时的口诀：<b>先按规则读一遍，读出来不对就加符。</b>「到底要不要写重音符」的疑问，绝大多数这样就能解决。</div>
<h3>变位里要特别注意重音的四处</h3>
<p><b>1 · 简单过去时的 yo 与 él</b>：<span class="es">-ar</span> 动词写 <span class="es">é / ó</span>（hablé、habló），<span class="es">-er / -ir</span> 动词写 <span class="es">í / ió</span>（comí、comió）。这两个重音符正是「过去」和「现在」在听觉上的分界线：hablo / habló、como / comió。</p>
{{G:hablar,comer|pr}}
<p><b>2 · nosotros 的「同形撞车」</b>：现在时和简单过去时的 nosotros 都是 -mos 结尾、写法完全一样（hablamos、comimos），只能靠上下文判断是哪一个。而虚拟式过去未完成时的 nosotros / vosotros 重音落在倒数第三音节，就必须写符了：<span class="es">habláramos、hablarais</span>。</p>
{{G:hablar|si}}
<p><b>3 · 词干元音交替只发生在重读词干上</b>：重音落在词干的四个人称（yo、tú、él、ellos）才双元音化；nosotros、vosotros 的重音在词尾，词干保持原样 —— 这就是「靴子」形状的来源。重音变了，元音才跟着变，两件事是绑在一起的。</p>
{{G:pensar,poder|p}}
<p><b>4 · 重音落在 i / u 上时必须写符</b>（本程序给这类动词标「重音变化」）：i、u 是闭元音，若重读又与后面的 a、e、o 相连，必须写重音符把两个元音<b>拆成两个音节</b>，否则会被读成一个双元音：actuar → <span class="es">actúo / actúas / actúa / actúan</span>（actuamos 重音在词尾，不写符）；enviar → <span class="es">envío / envías / envía / envían</span>；criar → <span class="es">crío / crías / cría / crían</span>。</p>
{{G:actuar,enviar|p}}
<p><span class="es">averiguar</span> 还多一步：在 e、i 前面要写两点（<span class="es">ü</span>）才能保住 u 的读音 —— <span class="es">averigüé、averigüe</span>。</p>
{{G:averiguar|sp}}
<h3>命令式加代词：把原来的重音补回来</h3>
<p>代词粘到动词后面，词变长了，但<b>重音位置不变</b>。重音原本落在最后一个音节，加了代词后被挤到倒数第三、第四音节，就必须补写重音符：dar + me + lo → <span class="es">dámelo</span>；poner + te + lo → <span class="es">ponértelo</span>；levantar + te → <span class="es">levántate</span>。反过来，两音节的形式就不必补：poner + te → <span class="es">ponte</span>、ir + te → <span class="es">vete</span>。</p>
{{G:levantarse|ia}}
<h3>将来时与条件式：重音永远在词尾</h3>
<p>这两个时态用<b>整个不定式</b>加词尾，重音一律落在词尾（hablaré、hablarás…；hablaría、hablarías…），所以规则动词在这里一个重音符都不多写。词干不规则也不影响这一点：tendré、diré 照旧只重读最后一个音节。</p>
{{G:hablar|f}}
<h3>和本程序里的三种着色对上号</h3>
<p>重音符属于<b>拼写层面</b>的调整，所以和正字法变化归在同一套着色里（<b>青色</b>）；橙色的「词干变化」是真的改变了读音，两者性质不同。带「重音变化」标签的动词共 11 个：<span class="es">enviar、continuar、actuar、confiar、prohibir、averiguar、variar、situar、efectuar、criar、guiar</span> —— 它们的共同点就是上面第 4 条。</p>`,
  en:`
<h3>Where the stress falls: two default rules</h3>
<p>With no written accent, the stress position follows from the ending: <b>a word ending in a vowel or in -n / -s takes the stress on the second-to-last syllable</b> (ha-blo, can-tas, ha-blan); <b>a word ending in any other consonant takes it on the last syllable</b> (ha-blar, co-mer, vi-vir).</p>
<p>The written accent (tilde, ´) does exactly one job: <b>it breaks that default</b>. With the accent, the stress lands on the marked vowel — so an accent always means the default reading would have been wrong.</p>
<div class="tip">The working rule: <b>read the word by the rules first; if it comes out wrong, write the accent.</b> That settles most “do I need an accent here?” doubts.</div>
<h3>Four things to watch in the conjugation</h3>
<p><b>1 · Preterite yo and él</b>: <span class="es">-ar</span> verbs write <span class="es">é / ó</span> (hablé, habló); <span class="es">-er / -ir</span> verbs write <span class="es">í / ió</span> (comí, comió). Those accents are what make the past audible against the present: hablo / habló, como / comió.</p>
{{G:hablar,comer|pr}}
<p><b>2 · The nosotros collision</b>: present and preterite nosotros both end in -mos and are written identically (hablamos, comimos), so only context tells them apart. The past subjunctive, by contrast, stresses the third-from-last syllable, so it does need the accent: <span class="es">habláramos, hablarais</span>.</p>
{{G:hablar|si}}
<p><b>3 · Stem-vowel changes only happen on a stressed stem</b>: the change appears in the four persons that stress the stem (yo, tú, él, ellos); nosotros and vosotros stress the ending and keep the original vowel — which is where the “boot” shape comes from. Stress and stem move together.</p>
{{G:pensar,poder|p}}
<p><b>4 · A stressed i or u must carry an accent</b> (this app tags such verbs “accent change”): i and u are closed vowels, so when one of them is stressed next to a following a, e or o, the accent mark is required to <b>split the two vowels into separate syllables</b> instead of a diphthong: actuar → <span class="es">actúo / actúas / actúa / actúan</span> (actuamos stresses the ending, no accent); enviar → <span class="es">envío / envías / envía / envían</span>; criar → <span class="es">crío / crías / cría / crían</span>.</p>
{{G:actuar,enviar|p}}
<p><span class="es">averiguar</span> needs one more step: before e and i the u takes a diaeresis (ü) to keep its sound — <span class="es">averigüé, averigüe</span>.</p>
{{G:averiguar|sp}}
<h3>Imperative + pronouns: put the original stress back</h3>
<p>Attaching pronouns makes the word longer but <b>does not move the stress</b>. When the stress would land on the third- or fourth-from-last syllable, an accent has to be written: dar + me + lo → <span class="es">dámelo</span>; poner + te + lo → <span class="es">ponértelo</span>; levantar + te → <span class="es">levántate</span>. Two-syllable results need nothing: poner + te → <span class="es">ponte</span>, ir + te → <span class="es">vete</span>.</p>
{{G:levantarse|ia}}
<h3>Future and conditional: the stress is always on the ending</h3>
<p>Both tenses build on the <b>whole infinitive</b> plus an ending, so the stress always falls on the ending (hablaré, hablarás…; hablaría, hablarías…). Regular verbs therefore need no extra accents here, and an irregular stem changes nothing: tendré and diré are still stressed on the final syllable.</p>
{{G:hablar|f}}
<h3>How this maps onto the three colours</h3>
<p>An accent mark is a <b>spelling-level</b> adjustment, so it is shown in the same colour as orthographic changes (<b>teal</b>); the orange “stem change” colour means the pronunciation itself changed. Eleven verbs in this app carry the “accent change” tag: <span class="es">enviar, continuar, actuar, confiar, prohibir, averiguar, variar, situar, efectuar, criar, guiar</span> — all of them for reason 4 above.</p>`,
  lk:[LK_WIKI_ACC, LK_DPD_TILDE, LK_DPD_ACCENT, lkRae('actuar'), lkRae('averiguar')]
}
];

/* 每个时态对应的讲解页（网页 `TENSE_GUIDE`：作答页的「相关语法」按钮用它跳转） */
export const TENSE_GUIDE = {
  p:'basics', pr:'past', i:'past', pp:'past', pq:'past',
  f:'future', fp:'future', c:'subj', cp:'subj',
  sp:'subj', si:'subj', spt:'subj', sq:'subj',
  ia:'imperative', in:'imperative',
};

/* ------------------------------------------------------------------ *
 * 与网页版同名的几个小工具
 * ------------------------------------------------------------------ */

/** slug → 在 GUIDE 里的下标 */
export const GUIDE_MAP: Record<string, number> = {};
GUIDE.forEach((g, i) => {
  GUIDE_MAP[g.k] = i;
});

/** 双语字段取值（缺英文回退中文；都没有给空串） */
export function guideText(o: Bi | undefined, lang: Lang): string {
  if (!o) return '';
  return (lang === 'en' ? o.en || o.zh : o.zh) ?? '';
}

/** 某一页的正文（按当前语言） */
export const guideBody = (it: GuidePage, lang: Lang): string =>
  (lang === 'en' ? it.en || it.zh : it.zh) || '';

/** 目录里的短标题 */
export const guideShort = (k: string, lang: Lang): string => {
  const i = GUIDE_MAP[k];
  return i == null ? '' : guideText(GUIDE[i]?.s, lang);
};

/** 完整标题 */
export const guideFull = (k: string, lang: Lang): string => {
  const i = GUIDE_MAP[k];
  return i == null ? '' : guideText(GUIDE[i]?.t, lang);
};

/** 某一页在 GUIDE 里的下标（认不出给 -1） */
export const guideIndex = (k: string): number =>
  Object.prototype.hasOwnProperty.call(GUIDE_MAP, k) ? GUIDE_MAP[k] : -1;

/** 时态 → 讲解页 slug（认不出给 ''） */
export const guideForTense = (tk: TenseKey): string =>
  (TENSE_GUIDE as Record<string, string>)[tk] ?? '';

/**
 * 正文里出现过的所有动词 —— 供测试核对「讲解页提到的动词都在词表里」
 * （网页版同名函数 `guideVerbs()`，test_tense.js 用它兜底）。
 */
export function guideVerbs(): string[] {
  const out: string[] = [];
  GUIDE.forEach((it) => {
    (['zh', 'en'] as const).forEach((l) => {
      String(it[l] || '').replace(/\{\{G:([^}|]+)\|/g, (m, names: string) => {
        names.split(',').forEach((n) => {
          const x = n.trim();
          if (x && out.indexOf(x) < 0) out.push(x);
        });
        return m;
      });
    });
  });
  return out;
}
