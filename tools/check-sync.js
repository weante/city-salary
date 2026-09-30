#!/usr/bin/env node
/*
 * 漂移检查（CI 守卫）。
 *
 * 五类检查：
 *   A. 镜像文件是否与源文件逐字节相同（防止改了 calculator.html 忘了同步 site/index.html）
 *   B. 各城市参数是否在文档中都有记录（防止加了城市忘了写文档）
 *   C. 文档陈旧表述 lint（防止机制改版时漏改措辞）
 *   D. 文档断言数与 test-calc.js 实际输出一致（防止加了测试忘了改文档）
 *   E. 各城市 dataYear/dataNext 是否与省份年度基线表一致（防止年度口径标错年份）
 *
 * 运行：node tools/check-sync.js
 * 退出码：0 = 无漂移，1 = 有漂移
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const { loadCalculator } = require('./calc-harness.js');

let fail = 0;

/* ---------- A. 镜像一致性 ---------- */
console.log('A. 镜像文件一致性');
const PAIRS = [
  ['skills/city-salary/assets/calculator.html', 'site/index.html'],
  ['skills/city-salary/SKILL.md', 'SKILL.md'],
];
for (const [src, dst] of PAIRS) {
  let a, b;
  try { a = read(src); } catch (e) { console.log(`  ! 源文件缺失：${src}`); fail++; continue; }
  try { b = read(dst); } catch (e) { console.log(`  ! 镜像缺失：${dst}（应运行 node tools/sync.js）`); fail++; continue; }
  if (a === b) { console.log(`  ✓ ${src}  ==  ${dst}`); }
  else {
    const la = a.split('\n').length, lb = b.split('\n').length;
    console.log(`  ✗ ${src}（${la}行）  !=  ${dst}（${lb}行）  → 运行 node tools/sync.js`);
    fail++;
  }
}

/* ---------- B. 城市参数是否都在文档里 ---------- */
console.log('\nB. 城市参数与文档的一致性');
/* 用共享脚手架取出 CITIES（原先本文件自带一份 DOM 桩，与 test-calc /
   test-export 三份重复）。 */
const CITIES = loadCalculator().CITIES;
/* 守卫一律读**源文件**；镜像与源的一致性由 A 检查单独负责。
   （B 曾经读根级镜像、F 读源文件，规则不统一，排查时容易误判是谁在报错。） */
const docs = {
  'AGENTS.md': { content: read('AGENTS.md'), checkValues: true },
  'SKILL.md':  { content: read('skills/city-salary/SKILL.md'), checkValues: true },
  'README.md': { content: read('README.md'), checkValues: false },
};

/* ---- B 的锚定工具 ----
   原实现是 content.indexOf(String(v))，只查"这个数值有没有在文档里出现过"，
   不查它挂在哪座城市名下。审查报告指出：某市数值被错抄到相邻城市段落里，
   检查照样通过。现在按城市名锚定，并把数值比较改成 token 集合——
   文档写 5901.40 而代码是 5901.4，子串匹配会漏；反过来更长数字里的子串
   （如 2330 命中 12330）也不会再被误判为命中。 */
function numbersIn(text) {
  const out = new Set();
  const re = /\d[\d,]*(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(text))) {
    const n = Number(m[0].replace(/,/g, ''));
    if (!Number.isNaN(n)) out.add(n);
  }
  return out;
}
const CITY_NAMES = Object.keys(CITIES).map(k => CITIES[k].name).filter((v, i, a) => a.indexOf(v) === i);

/* 所有城市名的出现位置（按位置排序；同位置取最长名，避免"吉林市"被"吉林"截断） */
function nameHits(text) {
  const hits = [];
  for (const n of CITY_NAMES) {
    let i = text.indexOf(n);
    while (i >= 0) { hits.push({ i, n }); i = text.indexOf(n, i + 1); }
  }
  hits.sort((a, b) => a.i - b.i || b.n.length - a.n.length);
  const out = [];
  for (const h of hits) {
    if (out.length && h.i < out[out.length - 1].i + out[out.length - 1].n.length) continue;
    out.push(h);
  }
  return out;
}

/* SKILL.md 的城市参数表（表头：城市 | 医保费率 | 医保基数下限 | 医保基数上限 | 公积金下限 | 公积金上限）。
   有表就逐格比 —— 这是最强的一档，能直接发现"数值被写到相邻行"。 */
function parseCityTable(text) {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\|.*城市.*医保基数下限.*\|\s*$/.test(lines[i])) { start = i + 2; break; }
  }
  const map = {};
  if (start < 0) return map;
  for (let i = start; i < lines.length && /^\|/.test(lines[i]); i++) {
    const c = lines[i].split('|').slice(1, -1).map(s => s.trim());
    if (c.length < 6) continue;
    const n = (s) => Number(String(s).replace(/\*\*/g, '').replace(/,/g, ''));
    map[c[0].replace(/\*\*/g, '')] = { medMin: n(c[2]), medMax: n(c[3]), hfMin: n(c[4]), hfMax: n(c[5]), line: i + 1 };
  }
  return map;
}

let missing = 0;
const anchored = {};
for (const dname in docs) {
  const { content, checkValues } = docs[dname];

  if (!checkValues) {
    /* README 只核对城市名（它不逐市列基数） */
    let bad = 0;
    for (const key in CITIES) {
      if (content.indexOf(CITIES[key].name) < 0) {
        console.log(`  ✗ 城市 ${CITIES[key].name} 未出现在 ${dname}`);
        bad++; missing++; fail++;
      }
    }
    anchored[dname] = { tabled: 0, prose: 0, namesOnly: true, bad };
    continue;
  }

  const table = parseCityTable(content);
  const hits = nameHits(content);
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) if (content[i] === '\n') lineStarts.push(i + 1);
  const lines = content.split(/\r?\n/);
  const lineOf = (idx) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; }
    return lo;
  };

  let tabled = 0, prose = 0;
  for (const key in CITIES) {
    const c = CITIES[key];
    if (content.indexOf(c.name) < 0) {
      console.log(`  ✗ 城市 ${c.name} 未出现在 ${dname}`);
      missing++; fail++;
      continue;
    }

    /* 一档：有参数表格行 → 逐格精确比对 */
    const row = table[c.name];
    if (row) {
      tabled++;
      const bad = [];
      if (row.medMin !== Number(c.med.min)) bad.push(`医保基数下限 表=${row.medMin} 代码=${c.med.min}`);
      if (row.medMax !== Number(c.med.max)) bad.push(`医保基数上限 表=${row.medMax} 代码=${c.med.max}`);
      if (row.hfMin !== Number(c.hf.min)) bad.push(`公积金下限 表=${row.hfMin} 代码=${c.hf.min}`);
      if (row.hfMax !== Number(c.hf.max)) bad.push(`公积金上限 表=${row.hfMax} 代码=${c.hf.max}`);
      /* 大额医疗固定额（medFixEmp）：表里写在费率列内（如「7%/2%（另大额18.33元/月）」），
         故按"该行是否出现该数值"核对。此前完全未检查——2026-09-30 发现
         AGENTS.md 记「三门峡/南阳/商丘未找到」而代码已有 18.33/19.16/12.5，
         守卫却没报警，就是因为漏了这一项。
         `0` 表示"个人不缴"，文档不会写这个数字，故跳过。 */
      if (c.medFixEmp > 0 && !numbersIn(lines[row.line - 1] || '').has(Number(c.medFixEmp))) {
        bad.push(`大额医疗固定额=${c.medFixEmp} 不在表格行内`);
      }
      if (bad.length) {
        console.log(`  ✗ ${dname}:${row.line} ${c.name}(${key}) 表格与代码不符 —— ${bad.join('；')}`);
        missing++; fail++;
      }
      continue;
    }

    /* 二档：散文 → 公积金值锚定到"本城市名之后、下一个城市名之前"的片段 */
    prose++;
    const mine = hits.filter(h => h.n === c.name);
    const slotNums = numbersIn(mine.map(h => {
      const nxt = hits.find(x => x.i > h.i);
      return content.slice(h.i, nxt ? nxt.i : Math.min(content.length, h.i + 500));
    }).join('\n'));
    for (const [label, v] of [['公积金基数下限', c.hf.min], ['公积金基数上限', c.hf.max]]) {
      if (!slotNums.has(Number(v))) {
        console.log(`  ✗ ${c.name}(${key}) ${label}=${v} 不在 ${dname} 中"该城市名之后、下一个城市名之前"的片段内`);
        missing++; fail++;
      }
    }
    /* 医保值可能省级统一（写在省名附近而非市名后）→ 放宽到"含该城市名的任一行内" */
    const lineNums = numbersIn([...new Set(mine.map(h => lineOf(h.i)))].map(i => lines[i]).join('\n'));
    for (const [label, v] of [['医保基数下限', c.med.min], ['医保基数上限', c.med.max]]) {
      if (!lineNums.has(Number(v))) {
        console.log(`  ✗ ${c.name}(${key}) ${label}=${v} 不在 ${dname} 中含该城市名的任一行内`);
        missing++; fail++;
      }
    }
    /* 大额医疗固定额：两种写法都要认——
       ① 逐市列出（「郑州10.83、开封15、…」）→ 落在"该城市名之后、下一个城市名之前"的片段内；
       ② 全省统一（「个人2%+大病15元/月（全省统一）」）→ 落在该省份条目行内。
       ⚠️ 必须**排除两个"派生提及"来源**，否则会漏报（实测 0/3 → 3/3 的关键）：
         · 规则 1「先确认城市」的城市清单（「…漯河/三门峡/南阳/商丘…」）
         · 规则 37「个人社保」的大额汇总（「…三门峡18.33元/月…」）
       三门峡在 AGENTS.md 里共出现 7 次，其中这两处是**重复提及而非权威值**。
       实测：只改省份条目里的值，若把这两处也算进片段并集，仍能从规则 37 找到旧值 → 漏报。
       `0` 表示"个人不缴"，文档不会写这个数字，故跳过。 */
    if (c.medFixEmp > 0) {
      const DERIVED = /^\d+\.\s+\*\*(先确认城市|个人社保)\*\*/;
      const authoritative = mine.filter(h => !DERIVED.test(lines[lineOf(h.i)] || ''));
      const authNums = numbersIn(authoritative.map(h => {
        const nxt = hits.find(x => x.i > h.i);
        return content.slice(h.i, nxt ? nxt.i : Math.min(content.length, h.i + 500));
      }).join('\n'));
      /* 还要认"省份条目行"：全省统一的值常写在城市清单**之前**
         （如湖南「个人2%+大病15元/月（全省统一）；公积金基数（下限~上限）长沙2200~32744…」），
         此时按"城市名之后的片段"永远找不到。省份条目行本身是权威行，可以安全纳入。
         直辖市没有「**直辖市**」条目行，此时只用权威片段。 */
      const provRe = new RegExp('^\\d+\\.\\s+\\*\\*' + (c.region || '') + '\\*\\*');
      const provLine = lines.findIndex(l => provRe.test(l));
      const provNums = provLine >= 0 ? numbersIn(lines[provLine]) : new Set();
      if (!authNums.has(Number(c.medFixEmp)) && !provNums.has(Number(c.medFixEmp))) {
        console.log(`  ✗ ${c.name}(${key}) 大额医疗固定额=${c.medFixEmp} 不在 ${dname} 该城市的权威条目片段内，也不在「${c.region}」条目行内`);
        missing++; fail++;
      }
    }
  }
  anchored[dname] = { tabled, prose };
}

/* B-2 五险基数（pension）锚定 —— 2026-09-30 补
   缺口来源：守卫 B 原先只核对 medMin/medMax/hfMin/hfMax/medFixEmp，**pension 完全没锚定**。
   SKILL.md 的表格列是「城市|医保费率|医保基数下限|医保基数上限|公积金下限|公积金上限」——
   当某省的 **医保基数与五险基数口径不同**时（福建/贵州/内蒙古等），表格只记了 med，
   五险基数（决定养老/失业/工伤缴费）在 SKILL.md 里**无任何记录**，且守卫不会报警。
   实测：只改 CITIES 的 pension 而不动文档，守卫 A/D 会因镜像与断言报警，
   但**守卫 B 沉默** —— 也就是说两份 HTML 与测试都同步后，文档仍可能漏记。
   本检查：凡有城市 pension≠med 的省，其 pension 上下限必须出现在 SKILL.md 中。 */
{
  const byRegion = {};
  for (const key in CITIES) {
    const c = CITIES[key];
    const r = c.region || '其他';
    (byRegion[r] = byRegion[r] || []).push(c);
  }
  const skillDoc = docs['SKILL.md'];
  if (skillDoc) {
    let b2 = 0;
    for (const r of Object.keys(byRegion)) {
      const cs = byRegion[r];
      if (!cs.some(c => Number(c.pension.min) !== Number(c.med.min) || Number(c.pension.max) !== Number(c.med.max))) continue;
      const c = cs[0];
      const nums = numbersIn(skillDoc.content);
      for (const [label, v] of [['五险基数下限', c.pension.min], ['五险基数上限', c.pension.max]]) {
        if (!nums.has(Number(v))) {
          console.log(`  ✗ ${r} 的医保基数与五险基数口径不同，但 ${label}=${v}（以 ${c.name} 为例）未出现在 SKILL.md 中`);
          b2++; missing++; fail++;
        }
      }
    }
    if (!b2) console.log(`  ✓ 医保基数与五险基数口径不同的省份，其五险基数均已记录在 SKILL.md`);
  }
}

/* 省份分组名必须被每份文档提到（防止新增省份时漏更新城市清单） */
const REGIONS = [];
for (const key in CITIES) {
  const r = CITIES[key].region || '其他';
  if (REGIONS.indexOf(r) < 0) REGIONS.push(r);
}
for (const r of REGIONS) {
  for (const dname in docs) {
    if (docs[dname].content.indexOf(r) < 0) {
      console.log(`  ✗ 省份分组 ${r} 未出现在 ${dname}`);
      missing++; fail++;
    }
  }
}
if (!missing) {
  const parts = Object.keys(anchored).map(d => {
    const a = anchored[d];
    return a.namesOnly ? `${d}（仅核对城市名）` : `${d}（表格逐格 ${a.tabled} + 散文锚定 ${a.prose}）`;
  }).join('、');
  console.log(`  ✓ ${Object.keys(CITIES).length} 个城市按城市名锚定核对通过：${parts}；${REGIONS.length} 个省份分组名均已出现`);
}

/* ---------- C. 文档陈旧表述 lint ----------
   教训来自一次真实漂移：时效机制改成双检查点后，README/SKILL/AGENTS 都改了，
   docs/ 下的安装文档漏改，残留"每年 7 月 15 日后"的单检查点表述长达一个版本。
   机制类措辞改版时，这里跟着加对应的 lint 模式。 */
console.log('\nC. 文档陈旧表述');
const MD_FILES = ['README.md', 'SKILL.md', 'AGENTS.md', 'CONTRIBUTING.md']
  .concat(fs.existsSync(path.join(ROOT, 'docs'))
    ? fs.readdirSync(path.join(ROOT, 'docs')).filter(f => f.endsWith('.md')).map(f => 'docs/' + f)
    : []);
const STALE_PATTERNS = [
  [/7\s*月\s*15\s*日后/, '单一检查点表述"7月15日后"（双检查点机制下应为：1月(医保)/7月(养老公积金)/限期费率到期）'],
  [/广东省\s*21\s*个?\s*地级市(?!.*北京)/, '城市清单未包含京沪'],
  [/23\s*城/, '城市数"23城"已过时（当前城市数以 AGENTS.md 第 1 条为准）'],
  [/\b44\s*(?:个)?\s*(?:城|市)/, '城市数"44"已过时（当前城市数以 AGENTS.md 第 1 条为准）'],
  [/\b97\s*(?:个)?\s*(?:城|市)/, '城市数"97"已过时（当前城市数以 AGENTS.md 第 1 条为准）'],
  [/\b122\s*(?:个)?\s*(?:城|市)/, '城市数"122"已过时（当前城市数以 AGENTS.md 第 1 条为准）'],
  [/\b202\s*(?:个)?\s*(?:城|市)/, '城市数"202"已过时（当前城市数以 AGENTS.md 第 1 条为准）'],
  [/\b273\s*(?:个)?\s*(?:城|市)/, '城市数"273"已过时（当前城市数以 AGENTS.md 第 1 条为准）'],
  [/\b330\s*(?:个)?\s*(?:城|市)/, '城市数"330"已过时（当前城市数以 AGENTS.md 第 1 条为准）'],
  [/广东\s*21\s*市\s*\+\s*北京\s*\/\s*上海(?!.*四川)/, '城市清单未包含四川21市州'],
  [/京沪\s*\+\s*广东\s*21\s*市\s*\+\s*四川\s*21\s*市州(?!.*(?:山东|重庆))/, '城市清单未包含重庆/山东/辽宁/吉林/黑龙江'],
  /* 年度口径事故（2026-09-27）：吉林被列进 2026 年度组（实为社保年度 2025.7-2026.6），
     湖北压根没进任何年度组，100 城页脚把 2025 年度基数标成「2026年度」。
     下面几条拦截"措辞改回去"。注意：新写的文档不要原样引用这些旧串，否则会被自己拦下。
     数据侧的一致性由检查 E（tools/province-year.js）负责，本条只管文档措辞。 */
  [/鲁\/辽\/吉\/皖/, '年度分组仍把吉林列在 2026 年度（吉林实为社保年度 2025.7-2026.6，应标 2025-2026）'],
  [/辽宁\/吉林\/安徽/, '年度分组仍把吉林列在 2026 年度（同上）'],
  [/吉林全省（9 市州）·\s*2026\s*年度/, '吉林小节标题仍写 2026 年度（实为 2025-2026 社保年度）'],
  [/黑龙江\/江西\/海南、(?!.*湖北)/, '年度分组遗漏湖北（湖北实为社保基数 2025 年度、2026 年度待公布）'],
  [/黑\/赣\/琼、(?!.*鄂)/, '年度分组遗漏湖北（同上）'],
];
let staleHits = 0;
for (const f of MD_FILES) {
  let content;
  try { content = read(f); } catch (e) { continue; }
  for (const [re, why] of STALE_PATTERNS) {
    const m = content.match(re);
    if (m) {
      const line = content.slice(0, m.index).split('\n').length;
      console.log(`  ✗ ${f}:${line} 残留 ${why}`);
      staleHits++; fail++;
    }
  }
}

/* C-2. 部署地址一致性
   线上地址出现在 README + 3 份 SOP 文档共 7 处（含徽章）。改域名时漏改任何一处
   就是死链——用户点到的那个链接恰好没改，是最难自查的失败。所以要求：
   ① 规范地址必须在 README.md 里出现；② 全部文档里**不得出现别的 *.pages.dev 主机**。
   只做离线字符串校验，不联网（联网校验会让 CI 因 Cloudflare 抖动而红）。 */
const DEPLOY_URL = 'https://city-salary.pages.dev/';
const DEPLOY_HOST = 'city-salary.pages.dev';
const pagesHosts = new Set();
for (const f of MD_FILES) {
  let content;
  try { content = read(f); } catch (e) { continue; }
  for (const m of content.matchAll(/https:\/\/([a-z0-9.-]+\.pages\.dev)/g)) pagesHosts.add(m[1]);
}
const strayHosts = [...pagesHosts].filter(h => h !== DEPLOY_HOST);
if (strayHosts.length) {
  console.log(`  ✗ 出现非规范部署主机：${strayHosts.join('、')}（规范地址为 ${DEPLOY_HOST}）`);
  staleHits++; fail++;
}
if (read('README.md').indexOf(DEPLOY_URL) < 0) {
  console.log(`  ✗ README.md 里没有线上地址 ${DEPLOY_URL}（用户第一眼看到的入口，不能缺）`);
  staleHits++; fail++;
}
/* C-3. 机制规模表述
   C 原本只认「城市数 / 时效机制」两类措辞，于是**机制升级后规模数字没跟上**成了盲区：
   加检查 F/G/H、加黄金用例、命令链从 5 条变 6 条之后，仍有 13 处写着"A–F""五连验证"
   散在 4 份文档里——靠人工审计才发现。
   现在补上这一类。判据是"规模数字"而非"提及某个检查"：
     · `A–F` 这种范围写法（单个 `（F 检查）` 不算）
     · `五连验证 / 五命令链 / 5 命令链`
     · `一次跑完下面四项`
     · `N 项守卫`，但排除"第 5 项守卫"这种序数（check-dom 的第 5 项，不是"共 5 项"）

   **历史文档豁免**：带 `> 📌 **历史快照**（…）` 标记的文档跳过本检查。
   历史报告里"当时跑了 5 条命令"是事实陈述，改掉它反而是篡改记录；
   正确做法是加快照标记 + 把前瞻性 SOP 段落补成现行，两件事都已做。

   标记必须**独占行首**（`^> 📌 **历史快照（`）：否则在 CONTRIBUTING 里
   说明这个约定时，CONTRIBUTING 自己会被豁免——最重要的文档反而脱离检查。
   （这不是假设：第一版就是这样，写文档的动作把文档本身豁免了。）
   而 CONTRIBUTING 里的示例写在反引号内（行首是 `> \``），不会自我匹配。 */
const SNAPSHOT_MARK = /^>\s*📌\s*\*\*历史快照（/m;
const SCALE_RULES = [
  { re: /A\s*[–\-—~]\s*[A-H]\b/g, why: '检查范围写成过时的终点（现为 A–I 九项）' },
  { re: /五连验证|五连全绿|五命令验证|五命令链|\b5\s*命令链/g, why: '验证链写"五连"（现为六连，多一条 check-golden.js）' },
  { re: /一次跑完下面四项|跑完下面四项/g, why: 'npm test 写"四项"（现为 5 条）' },
  { re: /(?:\b[3-8]\s*项|[三四五六七八]\s*项)守卫/g, why: '守卫总数写错（现为 A–I 九项）', ordinal: true },
];
let scaleHits = 0;
const snapshots = [];
for (const f of MD_FILES) {
  let content;
  try { content = read(f); } catch (e) { continue; }
  if (SNAPSHOT_MARK.test(content)) { snapshots.push(f); continue; }
  for (const r of SCALE_RULES) {
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(content)) !== null) {
      /* 排除"第 5 项守卫"这类序数用法 */
      if (r.ordinal && /第\s*$/.test(content.slice(Math.max(0, m.index - 3), m.index))) continue;
      const line = content.slice(0, m.index).split('\n').length;
      console.log(`  ✗ ${f}:${line} ${r.why}`);
      console.log(`      ${content.split('\n')[line - 1].trim().slice(0, 104)}`);
      scaleHits++; fail++;
    }
  }
}
if (!staleHits && !scaleHits) {
  const n = MD_FILES.reduce((a, f) => { try { return a + (read(f).split(DEPLOY_URL).length - 1); } catch (e) { return a; } }, 0);
  console.log(`  ✓ ${MD_FILES.length} 份文档无陈旧表述（含机制规模数字）；线上地址 ${DEPLOY_HOST} 一致（共 ${n} 处）`);
  if (snapshots.length) console.log(`  · 历史快照豁免 ${snapshots.length} 份：${snapshots.join('、')}`);
}

/* ---------- D. 文档断言数与实际一致 ----------
   教训来自一次真实漂移：测试从 530 涨到 546，README/SKILL 里的"530 项断言"没人改。
   以 test-calc.js 的实际计数为准，文档写错这里会拦下。

   实现方式（2026-09-27 改）：直接 require 拿计数，不再 execSync 起子进程。
   原实现有两个问题：① 在受限环境下经 cmd.exe 中转会 EBUSY 直接起不来；
   ② 未设 maxBuffer（默认 1MB），断言输出继续膨胀会 ENOBUFS 静默失败；
   而 catch 又吞掉了 e.message，于是"环境起不来"被误报成"测试失败（先修复测试）"，
   归因完全错误。现在 test-calc 被 require 时静默跑完整套断言并导出计数，
   依赖消失，且任何异常都会带类型与消息打印出来。 */
console.log('\nD. 文档断言数');
let actualCount = null, testOk = true, testErr = '';
try {
  const tc = require('./test-calc.js');   /* 静默运行整套断言，只取计数 */
  actualCount = tc.pass;
  testOk = tc.fail === 0;
  if (!testOk) {
    const first = (tc.failures && tc.failures.length) ? String(tc.failures[0]).split('\n')[0] : '';
    testErr = `${tc.fail} 项断言失败${first ? '；首个：' + first : ''}`;
  }
} catch (e) {
  testOk = false;
  testErr = `${e.name}: ${e.message}`;
}
if (!testOk) {
  console.log(`  ✗ test-calc 未能通过，无法核对断言数：${testErr}`);
  fail++;
} else if (typeof actualCount !== 'number') {
  console.log(`  ✗ test-calc 未导出 pass 计数（实际类型 ${typeof actualCount}）`);
  fail++;
} else {
  const COUNT_FILES = MD_FILES.concat(['skills/city-salary/SKILL.md']);
  /* 句式扩展：原来只认「N 项断言」，于是 docs/plan-nationwide-coverage.md 里
     「断言数为 N」这一整类写法都从指缝漏过（2026-09-27 复核发现的真实漏检）。
     注意：带「→」的是历史演进记录（如「断言数 2444 → 3950」），不是当前值声明，予以豁免。 */
  const COUNT_PATTERNS = [
    { re: /(\d+)\s*项\s*断言/g, label: 'N 项断言', arrow: false },
    { re: /(\d+)\s*条\s*断言/g, label: 'N 条断言', arrow: false },
    { re: /断言数\s*(?:为|是|：|:)?\s*\**\s*(\d+)/g, label: '断言数 N', arrow: true },
    { re: /断言总数\s*(?:为|是|：|:)?\s*\**\s*(\d+)/g, label: '断言总数 N', arrow: true },
  ];
  let countHits = 0;
  for (const f of COUNT_FILES) {
    let content;
    try { content = read(f); } catch (e) { continue; }
    for (const { re, label, arrow } of COUNT_PATTERNS) {
      re.lastIndex = 0;
      let cm;
      while ((cm = re.exec(content))) {
        /* 数字后面紧跟「→」的是历史演进记录（如「断言数 2444 → 3950」），不是当前值声明。
           这个判断必须放在代码里做：若写成正则负向前瞻 (?!\s*→)，
           引擎会为满足前瞻而把 1961 回退成 196，反而产生错误匹配。 */
        if (arrow) {
          const after = content.slice(cm.index + cm[0].length, cm.index + cm[0].length + 8);
          if (/^\s*→/.test(after)) continue;
        }
        if (Number(cm[1]) !== actualCount) {
          const line = content.slice(0, cm.index).split('\n').length;
          console.log(`  ✗ ${f}:${line} 写着「${cm[0].trim().replace(/\s+/g, ' ')}」（${label}），实际 ${actualCount} 项`);
          countHits++; fail++;
        }
      }
    }
  }
  if (!countHits) console.log(`  ✓ 文档断言数均为实际值 ${actualCount}（已覆盖 ${COUNT_PATTERNS.length} 种句式）`);
}

/* ---------- E. 省份年度口径 ----------
   教训来自一次真实事故：CIU() 工厂默认 dataYear:"2026"，新增省份城市时只覆盖了
   region 没覆盖 dataYear，导致吉林/黑龙江/江苏/浙江/河南/湖北/福建/江西/海南共 100 城
   的页脚显示「数据依据：哈尔滨 2026年度」——而这些省的 2026 年度基数其实尚未公布，
   用户会误以为基数已更新。原 B 检查只查"数值是否出现在文档里"，拦不住这类漂移。
   基线表见 tools/province-year.js（改年度先改表，再改 CITIES）。 */
console.log('\nE. 省份年度口径');
const { PROVINCE_YEAR } = require('./province-year.js');
let yearMiss = 0, yearSamples = 0;
const seenRegions = new Set();
for (const key in CITIES) {
  const c = CITIES[key];
  const region = c.region || '其他';
  seenRegions.add(region);
  const base = PROVINCE_YEAR[region];
  if (!base) {
    console.log(`  ✗ ${c.name}(${key}) 省份分组「${region}」未登记在 tools/province-year.js`);
    yearMiss++; fail++;
    continue;
  }
  const gotNext = c.dataNext || null;
  const expNext = base.dataNext || null;
  if (c.dataYear !== base.dataYear) {
    if (yearSamples++ < 12) console.log(`  ✗ ${c.name}(${key}) dataYear="${c.dataYear}"，基线表要求 "${base.dataYear}"`);
    yearMiss++; fail++;
  }
  if (gotNext !== expNext) {
    if (yearSamples++ < 12) console.log(`  ✗ ${c.name}(${key}) dataNext=${JSON.stringify(gotNext)}，基线表要求 ${JSON.stringify(expNext)}`);
    yearMiss++; fail++;
  }
}
if (yearMiss > yearSamples) console.log(`  …… 另有 ${yearMiss - yearSamples} 处同类不一致（已省略）`);
/* 反向检查：基线表登记了但 CITIES 里没人用的省份分组（防新增省份只改了一边） */
for (const r of Object.keys(PROVINCE_YEAR)) {
  if (!seenRegions.has(r)) {
    console.log(`  ✗ 基线表登记了省份「${r}」，但 CITIES 中没有任何城市使用该分组`);
    yearMiss++; fail++;
  }
}
if (!yearMiss) console.log(`  ✓ ${Object.keys(CITIES).length} 个城市的 dataYear/dataNext 与基线表一致（${Object.keys(PROVINCE_YEAR).length} 个省份分组）`);

/* ---------- F. 数据状态表的年度与基线表一致 ----------
   SKILL.md 的「数据状态」表是第四处人工维护年度的地方（前三处：CITIES.dataYear
   决定页脚、tools/province-year.js 基线表、各省小节标题）。检查 E 只管
   CITIES ↔ 基线表，管不到这张表——2026-09-27 修吉林年度时就漏了它：
   CITIES 已改成 2025-2026，表里却仍写「2025 年度」。本检查按省份分组核对这张表。 */
console.log('\nF. 数据状态表年度');
const statusRows = (() => {
  const lines = read('skills/city-salary/SKILL.md').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\|\s*分组\s*\|\s*数据年度\s*\|/.test(lines[i])) { start = i + 2; break; }
  }
  const rows = [];
  if (start < 0) return rows;
  for (let i = start; i < lines.length && /^\|/.test(lines[i]); i++) {
    const c = lines[i].split('|').slice(1, -1).map(s => s.trim());
    if (c.length < 2) continue;
    rows.push({ line: i + 1, group: c[0].replace(/\*\*/g, ''), year: c[1].replace(/\*\*/g, '') });
  }
  return rows;
})();

const MUNICIPALITIES = ['北京', '上海', '天津', '重庆'];
let yearTableMiss = 0;
for (const region of Object.keys(PROVINCE_YEAR)) {
  const base = PROVINCE_YEAR[region];
  const isMuni = region === '直辖市';
  const mine = statusRows.filter(r => isMuni
    ? MUNICIPALITIES.some(c => r.group.indexOf(c) >= 0)
    : r.group.indexOf(region) >= 0);
  if (!mine.length) {
    console.log(`  ✗ 基线表登记了「${region}」，但 SKILL.md 数据状态表里没有对应行`);
    yearTableMiss++; fail++;
    continue;
  }
  /* 认账条件：要么直接写 "Y 年度"，要么（Y 跨年时）组成年度都写出来。
     福建写成「养老 2025 年度；医保/工伤 2026 年度」，与基线的 2025-2026 等价。 */
  const consistent = (cell) => {
    if (cell.indexOf(base.dataYear + ' 年度') >= 0) return true;
    if (base.dataYear.indexOf('-') > 0) {
      return base.dataYear.split('-').every(p => cell.indexOf(p + ' 年度') >= 0);
    }
    return false;
  };
  /* 直辖市四行都要对；其余省份只要有一行认账即可
     （广东/四川/江苏/浙江按「养老板块 / 医保板块」分行，后者的年度写在执行期里） */
  const bad = isMuni ? mine.filter(r => !consistent(r.year))
                     : (mine.some(r => consistent(r.year)) ? [] : mine);
  if (bad.length) {
    const detail = bad.map(r => `L${r.line}「${r.group}」= "${r.year.slice(0, 46)}…"`).join('；');
    console.log(`  ✗ ${region} 基线表要求 dataYear="${base.dataYear}"，但数据状态表不符：${detail}`);
    yearTableMiss++; fail++;
  }
}
if (!yearTableMiss) console.log(`  ✓ 数据状态表 ${statusRows.length} 行的年度均与基线表一致（${Object.keys(PROVINCE_YEAR).length} 个省份分组）`);

/* ---------- G. 限期费率清单 ----------
   第三类检查点（限期费率）没有固定日期，靠人记——而它恰恰最容易"标记为已核查、
   实际已过期"。本检查把它变成可执行的：
     · 已到期且未记录处置 → 失败，强制联网核查
     · 已到期但记录了处置理由 → 只提示（理由可审计，见 tools/policy-expiry.js）
     · 60 天内到期 → 提前提醒
     · SKILL.md 限期费率表的日期集合必须与清单一致（防双源漂移）
   用 CITY_SALARY_TODAY 可覆盖"今天"，便于写实验用例。 */
console.log('\nG. 限期费率清单');
const { POLICIES, triggerOf, ISO } = require('./policy-expiry.js');
const TODAY = process.env.CITY_SALARY_TODAY || new Date().toISOString().slice(0, 10);
const SOON_DAYS = 60;
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

let polFail = 0, polNotice = 0;
const moduleDates = new Set();
for (const p of POLICIES) {
  if (p.until === null) {
    console.log(`  ! ${p.id} ${p.scope}：到期日未知，需先联网确认有效期才能排期核查`);
    polNotice++;
    continue;
  }
  if (!ISO.test(p.until)) {
    console.log(`  ✗ ${p.id} 的 until="${p.until}" 不是合法 ISO 日期（YYYY-MM-DD）`);
    polFail++; fail++;
    continue;
  }
  moduleDates.add(p.until);
  const trig = triggerOf(p.until);
  const left = daysBetween(TODAY, trig);
  if (left <= 0) {
    if (p.acknowledged && p.acknowledged.date && p.acknowledged.reason) {
      console.log(`  · ${p.id} 已于 ${p.until} 到期，处置记录（${p.acknowledged.date}）：${p.acknowledged.reason.slice(0, 44)}…`);
      polNotice++;
    } else {
      console.log(`  ✗ ${p.id} ${p.scope} 已于 ${p.until} 到期（触发日 ${trig}），且未记录处置 —— 必须联网核查后更新 current/until，或补 acknowledged 说明`);
      polFail++; fail++;
    }
  } else if (left <= SOON_DAYS) {
    console.log(`  ! ${p.id} ${p.scope} 将于 ${p.until} 到期（${left} 天后，触发日 ${trig}），请提前核查`);
    polNotice++;
  }
}
/* SKILL.md 限期费率表的日期集合必须与清单一致 */
const polRows = (() => {
  const lines = read('skills/city-salary/SKILL.md').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\|\s*政策\s*\|\s*现行费率\s*\|\s*文件有效期至\s*\|/.test(lines[i])) { start = i + 2; break; }
  }
  const rows = [];
  if (start < 0) return rows;
  for (let i = start; i < lines.length && /^\|/.test(lines[i]); i++) {
    const c = lines[i].split('|').slice(1, -1).map(s => s.trim());
    if (c.length < 3) continue;
    rows.push({ line: i + 1, policy: c[0], until: c[2] });
  }
  return rows;
})();
if (!polRows.length) {
  console.log('  ✗ SKILL.md 里找不到「限期费率」表（表头应为 | 政策 | 现行费率 | 文件有效期至 | 下次触发核查 |）');
  polFail++; fail++;
} else {
  const tableDates = new Set();
  for (const r of polRows) for (const m of r.until.match(/\d{4}-\d{2}-\d{2}/g) || []) tableDates.add(m);
  const onlyModule = [...moduleDates].filter(d => !tableDates.has(d));
  const onlyTable = [...tableDates].filter(d => !moduleDates.has(d));
  if (onlyModule.length) {
    console.log(`  ✗ 清单里有、SKILL.md 限期费率表里没有的到期日：${onlyModule.join('、')}`);
    polFail++; fail++;
  }
  if (onlyTable.length) {
    console.log(`  ✗ SKILL.md 限期费率表里有、清单里没有的到期日：${onlyTable.join('、')}（新增政策请先加到 tools/policy-expiry.js）`);
    polFail++; fail++;
  }
}
if (!polFail) {
  console.log(`  ✓ ${POLICIES.length} 条限期费率与 SKILL.md 表一致（今天 ${TODAY}）；${polNotice} 条需留意，${[...moduleDates].length} 个到期日已登记`);
}

/* ---------- H. warn 缺口清单与 CITIES 一致 ----------
   docs/warn-backlog.md 由 tools/gen-warn-backlog.js 生成，列出全部 warn 城市
   及其缺口分类与下一次核查时间。手写 172 行必然漂移，所以这里只校验**集合相等**：
   新增 warn 城市忘了重新生成 → CI 红；取到官方文件清掉 warn 但忘了重新生成 → 也红。
   「缺口只有被登记才算被追踪」。 */
console.log('\nH. warn 缺口清单');
const warnCities = Object.keys(CITIES).filter(k => CITIES[k].warn).map(k => CITIES[k].name).sort();
const backlogCities = (() => {
  const lines = read('docs/warn-backlog.md').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\|\s*城市\s*\|\s*省份\s*\|\s*类别\s*\|/.test(lines[i])) { start = i + 2; break; }
  }
  const out = [];
  if (start < 0) return out;
  for (let i = start; i < lines.length && /^\|/.test(lines[i]); i++) {
    const c = lines[i].split('|').slice(1, -1).map(s => s.trim());
    if (c.length < 2 || !c[0]) continue;
    out.push(c[0]);
  }
  return out.sort();
})();

let warnMiss = 0;
if (!backlogCities.length) {
  console.log('  ✗ docs/warn-backlog.md 里找不到逐城明细表（表头应为 | 城市 | 省份 | 类别 | … |）');
  console.log('    生成：node tools/gen-warn-backlog.js --update');
  warnMiss++; fail++;
} else {
  const onlyCities = warnCities.filter(n => backlogCities.indexOf(n) < 0);
  const onlyBacklog = backlogCities.filter(n => warnCities.indexOf(n) < 0);
  if (onlyCities.length) {
    console.log(`  ✗ CITIES 里 warn 但清单里没有（${onlyCities.length} 城）：${onlyCities.slice(0, 8).join('、')}${onlyCities.length > 8 ? ' …' : ''}`);
    console.log('    重新生成：node tools/gen-warn-backlog.js --update');
    warnMiss++; fail++;
  }
  if (onlyBacklog.length) {
    console.log(`  ✗ 清单里有但 CITIES 已不是 warn（${onlyBacklog.length} 城）：${onlyBacklog.slice(0, 8).join('、')}${onlyBacklog.length > 8 ? ' …' : ''}`);
    console.log('    取到官方文件后请重新生成清单：node tools/gen-warn-backlog.js --update');
    warnMiss++; fail++;
  }
}
if (!warnMiss) {
  const dup = backlogCities.filter((n, i) => backlogCities.indexOf(n) !== i);
  if (dup.length) { console.log(`  ✗ 清单里有重复城市名：${[...new Set(dup)].join('、')}`); warnMiss++; fail++; }
  else console.log(`  ✓ warn 城市集合与清单一致（${warnCities.length} 城 / 全国 ${Object.keys(CITIES).length} 城）`);
}

/* ---------- H-2. warn 与 note 必须一致 ----------
   规则来自 docs/plan-nationwide-coverage.md 的兜底原则：
   「任何一项数据联网查不到 →（a）CITIES 标 warn:true（橙框「数据待确认」）；（b）note 写明「未找到」与暂用口径」。
   ——即 note 承认不确定时，warn **必须**置位，否则用户在页面上看不到"数据待确认"提示。

   2026-09-30 实测发现 14 城违反此规则（四川 9 市 note 写"暂按省平…待核实"、
   湖南株洲/衡阳写"公积金未找到"、云南玉溪、重庆/天津），warn 数由 172 修正为 186。
   这条检查防止回退。 */
{
  const UNCERTAIN = /未找到|未公布|未取得|未发布|未更新|待核实|待确认|待公布|暂按|暂用|暂算|存疑|未能核查|延续未|未见/;
  const violators = Object.keys(CITIES)
    .filter(k => UNCERTAIN.test(CITIES[k].note || '') && !CITIES[k].warn)
    .map(k => CITIES[k].name);
  if (violators.length) {
    console.log(`  ✗ note 承认不确定但未标 warn（${violators.length} 城）：${violators.slice(0, 10).join('、')}${violators.length > 10 ? ' …' : ''}`);
    console.log('    规则见 docs/plan-nationwide-coverage.md：查不到就标 warn:true，否则用户看不到「数据待确认」');
    fail++;
  } else {
    console.log(`  ✓ note 承认不确定的城市均已标 warn（${warnCities.length} 城）`);
  }
}

/* ---------- H-3. warn 城市必须登记进 docs/policy-*.md ----------
   规则来自 docs/plan-nationwide-coverage.md 的兜底原则第 (c) 条：
   「任何一项数据联网查不到 → …（c）写入 docs/policy-*.md 缺口清单」。
   2026-09-30 实测发现 7 份 policy 文档覆盖 29 个省级单位，**独缺广东/北京/上海**，
   而茂名（广东）是 warn 城市 —— 它的缺口无处登记，违反 (c)。
   已新建 docs/policy-yuejinghu-2026.md 补齐。本检查防止再次出现"有 warn 无登记"。 */
{
  const polDir = path.join(__dirname, '..', 'docs');
  const polFiles = fs.readdirSync(polDir).filter(f => /^policy-.*\.md$/.test(f));
  let blob = '';
  for (const f of polFiles) blob += fs.readFileSync(path.join(polDir, f), 'utf8');
  const unlisted = Object.keys(CITIES).filter(k => CITIES[k].warn && blob.indexOf(CITIES[k].name) < 0).map(k => CITIES[k].name);
  if (unlisted.length) {
    console.log(`  ✗ warn 城市未登记进任何 docs/policy-*.md（${unlisted.length} 城）：${unlisted.slice(0, 10).join('、')}${unlisted.length > 10 ? ' …' : ''}`);
    console.log('    规则见 docs/plan-nationwide-coverage.md 第 (c) 条：查不到要写入政策文档的缺口清单');
    fail++;
  } else {
    console.log(`  ✓ ${warnCities.length} 个 warn 城市均已登记进 docs/policy-*.md（${polFiles.length} 份）`);
  }
}

/* ---------- I. 计算口径白皮书常量 ----------
   docs/calculation-spec.md 是"从税前工资到到手现金"的规则定义，通篇是公式与常量。
   这类文档最大的风险不是写错，而是**写得对、然后代码改了没人改它**——
   它会变成一份"权威的错误答案"，比没有文档更糟。
   所以这里把文档里的常量与税率表**逐项拉回实现比对**：
     I-1 标量常量：从 calculator.html 用正则取实现值，与文档常量表比对
     I-2 三张表：BR（综合所得预扣率）/ BBR（年终奖月换算）/ TRAPS（临界值）
     I-3 租金档位：CITIES 的 rent 只能取 800/1100/1500，且文档写明
   只做离线比对，不联网。 */
console.log('\nI. 计算口径白皮书常量');
const specSrc = read('docs/calculation-spec.md');
const calcSrc = read('skills/city-salary/assets/calculator.html');

/* 取"某个表头之后的第一张表"的行（用于精确定位，避免误读别的表） */
function tableAfter(text, headerRe) {
  const lines = text.split(/\r?\n/);
  let i = lines.findIndex(l => headerRe.test(l));
  if (i < 0) return null;
  const rows = [];
  for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
    const c = lines[i].split('|').slice(1, -1).map(s => s.trim());
    if (c.length) rows.push(c);
  }
  return rows;
}
const num = (s) => String(s).replace(/[,\s]/g, '').replace(/%$/, '');
const pct = (s) => Math.round(parseFloat(num(s)) * 100) / 100;

let specFail = 0;

/* --- I-1 标量常量 --- */
const SPEC_SCALARS = [
  ['个税减除费用（起征点）', /C\.hfE\+(\d+)\+D\.spT/],
  ['子女教育 / 婴幼儿照护上限', /cl\(gv\("childAmt"\),0,(\d+)\)/],
  ['继续教育上限', /cl\(gv\("eduAmt"\),0,(\d+)\)/],
  ['住房贷款利息', /houseMode===0\?(\d+):CITY\.rent/],
  ['赡养老人上限', /cl\(gv\("elderlyAmt"\),0,(\d+)\)/],
  ['大病医疗月度上限', /cl\(gv\("medicalAmt"\),0,(\d+)\)/],
  ['大病医疗年度限额', /medicalA\*12,(\d+)\)/],
  ['税优健康险上限', /cl\(gv\("healthIns"\),0,(\d+)\)/],
  ['个人养老金上限', /cl\(gv\("persPen"\),0,(\d+)\)/],
  ['企业年金个人比例上限', /cl\(gv\("annuity"\),0,(\d+)\)\/100/],
  ['公积金比例下限', /if\(v<(\d+)\)return 0/],
  ['公积金比例默认上限', /max=max\|\|(\d+)/],
];
const constRows = tableAfter(specSrc, /^\|\s*常量\s*\|\s*值\s*\|/);
if (!constRows) {
  console.log('  ✗ 白皮书里找不到「常量表」（表头应为 | 常量 | 值 | 单位 | 实现位置 |）');
  specFail++; fail++;
} else {
  const docConst = {};
  for (const r of constRows) if (r.length >= 2 && /^[\d,]+$/.test(r[1])) docConst[r[0]] = num(r[1]);
  for (const [name, re] of SPEC_SCALARS) {
    const m = calcSrc.match(re);
    if (!m) { console.log(`  ✗ 实现里找不到常量「${name}」的取值正则（代码结构变了？）`); specFail++; fail++; continue; }
    const codeVal = m[1];
    if (!(name in docConst)) { console.log(`  ✗ 白皮书常量表缺「${name}」（实现值 ${codeVal}）`); specFail++; fail++; continue; }
    if (docConst[name] !== codeVal) {
      console.log(`  ✗ 常量「${name}」不一致：白皮书写 ${docConst[name]}，实现是 ${codeVal}`);
      specFail++; fail++;
    }
  }
}

/* --- I-2 三张表 --- */
const A = loadCalculator();
const cmpTable = (label, docRows, codeRows, codeLimit, codeRate, codeDeduct, docLimit) => {
  if (!docRows) { console.log(`  ✗ 白皮书里找不到「${label}」表`); specFail++; fail++; return; }
  const doc = docRows.map(r => ({ limit: docLimit(r[0]), rate: pct(r[1]), ded: parseFloat(num(r[2])) }));
  const code = codeRows.map(r => ({ limit: codeLimit(r), rate: codeRate(r), ded: codeDeduct(r) }));
  if (doc.length !== code.length) {
    console.log(`  ✗ 「${label}」行数不符：白皮书 ${doc.length} 行，实现 ${code.length} 行`);
    specFail++; fail++; return;
  }
  for (let i = 0; i < code.length; i++) {
    if (doc[i].limit !== code[i].limit || Math.abs(doc[i].rate - code[i].rate) > 1e-9 || Math.abs(doc[i].ded - code[i].ded) > 1e-9) {
      console.log(`  ✗ 「${label}」第 ${i + 1} 行不符：白皮书 ${doc[i].limit}/${doc[i].rate}%/${doc[i].ded}，实现 ${code[i].limit}/${code[i].rate}%/${code[i].ded}`);
      specFail++; fail++;
    }
  }
};
cmpTable('综合所得预扣率',
  tableAfter(specSrc, /^\|\s*累计应纳税所得额\s*≤\s*\|/),
  A.BR,
  r => r[0], r => r[1] * 100, r => r[2],
  s => (/超过/.test(s) ? Infinity : parseFloat(num(s))));
cmpTable('年终奖月换算税率',
  tableAfter(specSrc, /^\|\s*月均（奖金÷12）≤\s*\|/),
  A.BBR,
  r => r[0], r => r[1] * 100, r => r[2],
  s => (/超过/.test(s) ? Infinity : parseFloat(num(s))));
/* 临界值表只有两列（临界点 / 多 1 元少拿），单独比对 */
const trapRows = tableAfter(specSrc, /^\|\s*临界点\s*\|\s*多 1 元少拿\s*\|/);
if (!trapRows) {
  console.log('  ✗ 白皮书里找不到「六个临界值陷阱」表');
  specFail++; fail++;
} else if (trapRows.length !== A.TRAPS.length) {
  console.log(`  ✗ 「年终奖临界值」行数不符：白皮书 ${trapRows.length} 行，实现 ${A.TRAPS.length} 行`);
  specFail++; fail++;
} else {
  for (let i = 0; i < A.TRAPS.length; i++) {
    const docLo = parseFloat(num(trapRows[i][0])), docLoss = parseFloat(num(trapRows[i][1]));
    if (docLo !== A.TRAPS[i][0] || Math.abs(docLoss - A.TRAPS[i][1]) > 0.005) {
      console.log(`  ✗ 「年终奖临界值」第 ${i + 1} 行不符：白皮书 ${docLo}/${docLoss}，实现 ${A.TRAPS[i][0]}/${A.TRAPS[i][1]}`);
      specFail++; fail++;
    }
  }
}

/* --- I-3 租金档位 --- */
const rents = [...new Set(Object.keys(CITIES).map(k => CITIES[k].rent))].sort((a, b) => a - b);
const rentOk = rents.length === 3 && rents.join(',') === '800,1100,1500' && /800\s*\/\s*1100\s*\/\s*1500/.test(specSrc);
if (!rentOk) {
  console.log(`  ✗ 租金档位：CITIES 实际为 [${rents.join(', ')}]，白皮书须写明 800 / 1100 / 1500`);
  specFail++; fail++;
}

if (!specFail) {
  console.log(`  ✓ 白皮书与实现一致：${SPEC_SCALARS.length} 个标量常量 + 3 张税率表（${A.BR.length}+${A.BBR.length}+${A.TRAPS.length} 行）+ 租金 3 档`);
}

/* ---------- 汇总 ---------- */
console.log('\n' + '='.repeat(58));
if (fail) {
  console.log(`发现 ${fail} 处漂移`);
  console.log('='.repeat(58));
  process.exit(1);
} else {
  console.log('无漂移');
  console.log('='.repeat(58));
  process.exit(0);
}
