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
const html = read('skills/city-salary/assets/calculator.html');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

/* 在最小 DOM 桩上取出 CITIES */
function makeEl(id) {
  return { id, value: '', textContent: '', innerHTML: '', style: {}, dataset: {}, checked: false,
    disabled: false, addEventListener() {}, querySelectorAll() { return []; },
    querySelector() { return null; }, setAttribute() {}, getAttribute() { return null; },
    classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, max: '' };
}
const els = new Map();
const document = {
  getElementById: (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement: () => makeEl('n'), head: { appendChild() {} }, querySelectorAll: () => [],
};
const api = new Function('document', 'window', 'console', 'setTimeout',
  src + '\n;return {CITIES};')(document, {}, console, setTimeout);

const CITIES = api.CITIES;
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
  }
  anchored[dname] = { tabled, prose };
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
if (!staleHits) console.log(`  ✓ ${MD_FILES.length} 份文档无陈旧表述`);

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
