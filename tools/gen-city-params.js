#!/usr/bin/env node
/*
 * 城市参数总表生成器。
 *
 * 单一事实来源：skills/city-salary/data/cities.json（从 CITIES 逐字段导出，顺序稳定）。
 * 生成物：skills/city-salary/references/city-parameters.md 中
 *         <!-- generated:begin ... --> 与 <!-- generated:end --> 之间的表格。
 * 标记外内容人工维护，本脚本绝不覆盖。
 *
 * 用法：
 *   node tools/gen-city-params.js --extract 从 CITIES 重建 data/cities.json（保留人工维护的 docRate/docNote）
 *   node tools/gen-city-params.js --check   只比对，差异非空则 exit 1（check-sync B 用）
 *   node tools/gen-city-params.js --write   重写标记区（人工确认来源变更后运行）
 *
 * 日常维护：只改 calculator.html 里的 CITIES → --extract → --write。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { loadCalculator } = require('./calc-harness.js');

const JSON_PATH = 'skills/city-salary/data/cities.json';
const DOC_PATH = 'skills/city-salary/references/city-parameters.md';
const BEGIN = '<!-- generated:begin 城市参数总表（源：skills/city-salary/data/cities.json；生成：node tools/gen-city-params.js --write；勿手改） -->';
const END = '<!-- generated:end -->';

const abs = (p) => path.join(ROOT, p);
const readJson = () => JSON.parse(fs.readFileSync(abs(JSON_PATH), 'utf8'));

/* ---------- docRate / docNote 与 CITIES 数值的可验证关联 ----------
 *
 * docRate 形如「6.5%/2%（含生育0.5%）」「一档6%/2%、二档1.5%/0.5%」「6%+生育1%/2%」。
 * 规则：解析出所有「X%/Y%」组合（加法式 X%+…Y%/Z% 先合成 X+Y），
 *       要求其中至少一对等于 (med.comp×100, med.emp×100)（允许单位/个人顺序互换）；
 *       medFixEmp>0 时，docRate 必须出现等值的「N元」，或明确写「无个人固定额」。
 * 已知不一致逐条登记，且白名单自身也校验：数值再变、或措辞改好后都会报错，
 * 不会变成"加一条白名单就永远绿"。
 */
const DOC_RATE_WHITELIST = [
  { key: 'quanz', name: '泉州', comp: 8, emp: 2, docComp: 7.5, docEmp: 2, why: 'docRate 引 2022 件 7.5%/2%，CITIES 取 8%/2%，口径待核' },
  { key: 'nd', name: '宁德', comp: 8, emp: 2, docComp: 8.5, docEmp: 2, why: 'docRate 记含生育合计 8.5%/2%，CITIES 取 8%/2%' },
  { key: 'yanan', name: '延安', comp: 6.9, emp: 2, docComp: 7, docEmp: 2, why: 'docRate 记 7%/2%（暂算待核实），CITIES 取 6.9%/2%' },
  { key: 'shangl', name: '商洛', comp: 6.6, emp: 2, docComp: 7, docEmp: 2, why: 'docRate 记 7%/2%（暂算待核实），CITIES 取 6.6%/2%' },
  { key: 'yuln', name: '玉林', comp: 6.5, emp: 2, docComp: 6, docEmp: 2, why: 'docRate 记 2025-07-01 起 6%/2%，CITIES 取 6.5%/2%' },
  { key: 'lij', name: '丽江', comp: 6, emp: 2, docComp: 8, docEmp: 2, why: 'docRate 记 8%/2%（暂算待核实），CITIES 取 6%/2%' },
  { key: 'nuj', name: '怒江', comp: 7, emp: 2, docComp: 8, docEmp: 2, why: 'docRate 记 8%/2%（暂算待核实），CITIES 取 7%/2%' },
  { key: 'alt', name: '阿勒泰', comp: 9.5, emp: 2, docComp: 7.5, docEmp: 2, why: 'docRate 记 7.5%/2%（暂算待核实），CITIES 取 9.5%/2%' },
];
/* docNote 里没有可核数字的条目：只登记"指向官网入口缺失"的纯 warn 说明 */
const DOC_NOTE_WHITELIST = [
  { key: 'fx', name: '阜新', why: 'docNote 无数值，只记录公积金中心官网入口缺失（warn）' },
  { key: 'tl', name: '铁岭', why: 'docNote 无数值，只记录公积金中心官网入口缺失（warn）' },
];

const eqNum = (x, y) => Math.abs(x - y) < 0.0005;
const PAIR_RE = /(\d+(?:\.\d+)?)\s*%\s*\/\s*(\d+(?:\.\d+)?)\s*%/g;
const ADD_RE = /(\d+(?:\.\d+)?)\s*%\s*\+\s*[^\d%/]{0,12}(\d+(?:\.\d+)?)\s*%\s*\/\s*(\d+(?:\.\d+)?)\s*%/g;
const NUM_RE = /\d+(?:\.\d+)?/g;

/* 解析 docRate 中的所有费率对：[单位, 个人] */
function parseRatePairs(text) {
  const out = [];
  for (const m of text.matchAll(ADD_RE)) out.push([+m[1] + +m[2], +m[3]]);
  for (const m of text.matchAll(PAIR_RE)) out.push([+m[1], +m[2]]);
  return out;
}

/* 一个城市的"数字池"：CITIES 里该城所有数值字段与 note/prose 中的数字 token */
function numPool(c) {
  const s = new Set();
  const walk = (v) => {
    if (typeof v === 'number') s.add(String(v));
    else if (typeof v === 'string') for (const m of v.match(NUM_RE) || []) s.add(m);
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(c);
  return s;
}

function docTextCheck(data) {
  const CITIES = loadCalculator().CITIES;
  const problems = [], summary = [];
  const rateWl = new Map(DOC_RATE_WHITELIST.map(w => [w.key, w]));
  const noteWl = new Map(DOC_NOTE_WHITELIST.map(w => [w.key, w]));

  let rateOk = 0, rateWhite = 0, noteTotal = 0, noteOk = 0, noteWhite = 0;
  for (const j of data) {
    const c = CITIES[j.key];
    if (!c) continue;
    const comp = +(c.med.comp * 100).toFixed(2);
    const emp = +(c.med.emp * 100).toFixed(2);
    const pairs = parseRatePairs(j.docRate || '');
    const matched = pairs.some(([a, b]) => (eqNum(a, comp) && eqNum(b, emp)) || (eqNum(a, emp) && eqNum(b, comp)));
    const w = rateWl.get(j.key);
    if (matched) {
      rateOk++;
      if (w) problems.push(`docRate 白名单已过期：${j.name}(${j.key}) 已与 CITIES ${comp}%/${emp}% 一致，请从 DOC_RATE_WHITELIST 删除该条`);
    } else if (w && w.comp === comp && w.emp === emp) {
      rateWhite++;
    } else if (w) {
      problems.push(`docRate 白名单失效：${j.name}(${j.key}) 登记 ${w.comp}%/${w.emp}%，现值 CITIES ${comp}%/${emp}%；请复核 docRate 后更新白名单`);
    } else {
      problems.push(`docRate 与 CITIES 不一致：${j.name}(${j.key}) docRate「${(j.docRate || '').slice(0, 60)}」解析 ${pairs.map(p => p[0] + '/' + p[1]).join('、') || '(无 X%/Y% 结构)'}，CITIES med=${comp}%/${emp}%`);
    }
    if (c.medFixEmp > 0) {
      const re = new RegExp('(^|[^0-9])' + fmt(c.medFixEmp) + '\\s*元');
      if (!re.test(j.docRate || '') && !/无个人固定额/.test(j.docRate || '')) {
        problems.push(`docRate 未体现个人固定额：${j.name}(${j.key}) medFixEmp=${c.medFixEmp} 未在 docRate 中以「${c.medFixEmp}元」出现`);
      }
    }

    if (!j.docNote) continue;
    noteTotal++;
    const pool = numPool(c);
    const tokens = [];
    for (const m of (j.docNote || '').matchAll(NUM_RE)) {
      const before = j.docNote.slice(Math.max(0, m.index - 3), m.index);
      if (m[0].replace(/\./g, '').length < 3) continue;      // 单位数、月份片段不可靠
      if (/由$|原$|原为|旧值/.test(before)) continue;          // 「由 X 调为 Y」里的 X 是历史值
      tokens.push(m[0]);
    }
    if (!tokens.length) {
      if (noteWl.has(j.key)) noteWhite++;
      else problems.push(`docNote 无可核数值：${j.name}(${j.key}) 的 docNote 中没有任何可核到 CITIES 数字字段的 token`);
      continue;
    }
    const miss = tokens.filter(t => !pool.has(t));
    if (miss.length) {
      problems.push(`docNote 数字无法回溯：${j.name}(${j.key}) 缺失 ${miss.join('、')}（应为 CITIES 字段或 note 中出现过的数字）`);
    } else {
      noteOk++;
    }
  }
  summary.push(`✓ docRate：${rateOk} 条数字与 med.comp/emp 一致，${rateWhite} 条白名单（${(rateWhite / data.length * 100).toFixed(1)}%）`);
  summary.push(`✓ docNote：${noteOk} 条数字全部可回溯，${noteWhite} 条白名单（无数字说明）`);
  return { problems, summary, rateOk, rateWhite, noteOk, noteWhite, noteTotal };
}


function pct(x) {
  if (!x) return '0';
  const v = (Number(x) * 100).toFixed(2).replace(/\.?0+$/, '');
  return v + '%';
}

function fmt(n) {
  return String(Number(n));
}

function rateText(c) {
  if (c.docRate) return c.docRate;
  let s = `${pct(c.med.comp)}/${pct(c.med.emp)}`;
  if (c.medFixEmp > 0) s += `+${fmt(c.medFixEmp)}元`;
  return s;
}

/* 稳定生成：数组顺序即 CITIES 插入顺序；字段按固定列序拼接 */
function buildBlock(cities) {
  const rows = [
    BEGIN,
    `### 城市参数总表（${cities.length} 城，生成物，勿手改）`,
    '',
    '| 城市 | 省份 | 医保费率（档位） | 医保基数下限 | 医保基数上限 | 公积金下限 | 公积金上限 | 五险基数下限 | 五险基数上限 | 说明 |',
    '|------|------|----------------|------------|------------|-----------|-----------|------------|------------|------|',
  ];
  for (const c of cities) {
    const cells = [
      c.name,
      c.region || '其他',
      rateText(c),
      fmt(c.med.min),
      fmt(c.med.max),
      fmt(c.hf.min),
      fmt(c.hf.max),
      fmt(c.pension.min),
      fmt(c.pension.max),
      c.docNote || '',
    ];
    rows.push('| ' + cells.join(' | ') + ' |');
  }
  rows.push(END);
  return rows.join('\n');
}

function extractBlock(doc) {
  const lines = doc.split('\n');
  const b = lines.findIndex(l => l === BEGIN);
  const e = lines.findIndex(l => l === END);
  if (b < 0 || e < 0 || e < b) return null;
  return { text: lines.slice(b, e + 1).join('\n'), beginLine: b + 1, endLine: e + 1 };
}

/* JSON ↔ CITIES 深度比对：防止有人只改代码不改来源，或反之 */
function jsonCitiesMismatch() {
  const CITIES = loadCalculator().CITIES;
  const data = readJson();
  if (!Array.isArray(data)) return `${JSON_PATH} 不是数组`;
  if (data.length !== Object.keys(CITIES).length) {
    return `${JSON_PATH} 有 ${data.length} 城，CITIES 有 ${Object.keys(CITIES).length} 城`;
  }
  for (let i = 0; i < data.length; i++) {
    const a = data[i];
    const c = CITIES[a.key];
    if (!c) return `${JSON_PATH} 第 ${i + 1} 项 key=${a.key} 在 CITIES 中不存在`;
    if (a.name !== c.name) return `${a.key}: 名称 ${a.name} ≠ CITIES ${c.name}`;
    for (const f of ['region', 'dataYear', 'dataNext', 'rent', 'hfRateMax', 'medFixEmp', 'note']) {
      if (JSON.stringify(a[f]) !== JSON.stringify(c[f])) {
        return `${a.key}(${a.name}): 字段 ${f} JSON=${JSON.stringify(a[f])} CITIES=${JSON.stringify(c[f])}`;
      }
    }
    for (const g of ['pension', 'med', 'unemp', 'mat', 'inj', 'hf']) {
      const x = a[g] || {}, y = c[g] || {};
      for (const k of Object.keys(y)) {
        if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) {
          return `${a.key}(${a.name}): ${g}.${k} JSON=${JSON.stringify(x[k])} CITIES=${JSON.stringify(y[k])}`;
        }
      }
    }
  }
  return null;
}

/* 从 CITIES 重建 JSON：字段顺序照 CITIES，docRate/docNote 按 key（回退 name）沿用磁盘旧值 */
function extractCities() {
  const CITIES = loadCalculator().CITIES;
  const disk = readJson();
  const byKey = new Map(disk.map(c => [c.key, c]));
  const out = [], added = [], dropped = [];
  for (const k of Object.keys(CITIES)) {
    const c = CITIES[k];
    const old = byKey.get(k) || disk.find(o => o.name === c.name);
    const row = { key: k };
    for (const f of Object.keys(c)) row[f] = c[f];
    if (old) {
      if (old.docRate !== undefined) row.docRate = old.docRate;
      if (old.docNote !== undefined) row.docNote = old.docNote;
    } else added.push(c.name);
    out.push(row);
  }
  const liveKeys = new Set(out.map(r => r.key));
  const liveNames = new Set(out.map(r => r.name));
  for (const o of disk) if (!liveKeys.has(o.key) && !liveNames.has(o.name)) dropped.push(o.name || o.key);
  return { data: out, added, dropped };
}

function firstFieldDiff(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const x = a[k], y = b[k];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x)) {
      for (const kk of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (JSON.stringify(x[kk]) !== JSON.stringify(y[kk])) {
          return `${k}.${kk} JSON=${JSON.stringify(x[kk])} CITIES=${JSON.stringify(y[kk])}`;
        }
      }
    }
    return `${k} JSON=${JSON.stringify(x)} CITIES=${JSON.stringify(y)}`;
  }
  return '键序不一致';
}

/* JSON 是否等于"CITIES 提取后的结果"（docRate/docNote 已按旧值回填，所以只暴露 CITIES 侧漂移） */
function jsonExtractMismatch() {
  const { data, added, dropped } = extractCities();
  const disk = readJson();
  const hint = '请运行 node tools/gen-city-params.js --extract 重建 JSON';
  if (disk.length !== data.length) {
    return `JSON 有 ${disk.length} 城，CITIES 有 ${data.length} 城`
      + (added.length ? `；新增：${added.join('、')}` : '')
      + (dropped.length ? `；删除：${dropped.join('、')}` : '')
      + `（${hint}）`;
  }
  for (let i = 0; i < data.length; i++) {
    const a = disk[i] || {}, b = data[i];
    if (a.key !== b.key) return `第 ${i + 1} 项 key：JSON=${a.key} CITIES=${b.key}（${hint}）`;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      return `${b.key}(${b.name}): ${firstFieldDiff(a, b)}（${hint}）`;
    }
  }
  return null;
}

function main() {
  const mode = process.argv[2];

  if (mode === '--extract') {
    const { data: next, added, dropped } = extractCities();
    fs.writeFileSync(abs(JSON_PATH), JSON.stringify(next, null, 2) + '\n', 'utf8');
    const kept = next.filter(r => r.docRate).length;
    const notes = next.filter(r => r.docNote).length;
    console.log(`✓ 已从 CITIES 重建 ${JSON_PATH}：${next.length} 城（docRate 保留 ${kept} 条、docNote 保留 ${notes} 条）`);
    console.log(`  新增城市：${added.length ? added.join('、') + '（无旧 docRate/docNote，需手工补 docRate，否则 --check 会报"无 X%/Y% 结构"）' : '无'}`);
    console.log(`  删除城市：${dropped.length ? dropped.join('、') + '（其 docRate/docNote 一并移除）' : '无'}`);
    console.log('  接着运行 node tools/gen-city-params.js --write 重写生成区');
    return;
  }

  const mm = jsonExtractMismatch();
  if (mm) {
    console.error('✗ ' + mm);
    process.exitCode = 1;
    return;
  }

  const data = readJson();
  const text = docTextCheck(data);
  for (const s of text.summary) console.log(s);
  if (text.problems.length) {
    for (const p of text.problems) console.error('✗ ' + p);
    process.exitCode = 1;
    return;
  }

  const built = buildBlock(data);
  const doc = fs.readFileSync(abs(DOC_PATH), 'utf8');
  const block = extractBlock(doc);

  if (!block) {
    console.error(`✗ ${DOC_PATH} 缺少 generated 标记（begin/end 必须各占一行）`);
    process.exitCode = 1;
    return;
  }

  if (mode === '--write') {
    const lines = doc.split('\n');
    const next = lines.slice(0, block.beginLine - 1).concat(built.split('\n'), lines.slice(block.endLine)).join('\n');
    fs.writeFileSync(abs(DOC_PATH), next, 'utf8');
    console.log(`✓ 已重写 ${DOC_PATH} 的生成区（${data.length} 城）`);
    return;
  }

  if (block.text === built) {
    console.log(`✓ 生成物与磁盘一致：${data.length} 城、${new Set(data.map(c => c.region || '其他')).size} 个省份分组`);
    return;
  }

  const a = block.text.split('\n');
  const b = built.split('\n');
  const n = Math.max(a.length, b.length);
  let shown = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    if (shown < 8) {
      const lineNo = block.beginLine + i;
      console.log(`  ✗ 第 ${lineNo} 行 diff`);
      console.log(`      磁盘: ${a[i] === undefined ? '(缺行)' : a[i]}`);
      console.log(`      生成: ${b[i] === undefined ? '(缺行)' : b[i]}`);
    }
    shown++;
  }
  console.error(`✗ 生成物与磁盘不一致：${shown} 行差异（运行 node tools/gen-city-params.js --write 前先确认来源正确）`);
  process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  buildBlock, extractBlock, jsonCitiesMismatch, jsonExtractMismatch, extractCities, docTextCheck,
  JSON_PATH, DOC_PATH, BEGIN, END,
};
