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
 *   node tools/gen-city-params.js --check   只比对，差异非空则 exit 1（check-sync B 用）
 *   node tools/gen-city-params.js --write   重写标记区（人工确认来源变更后运行）
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

function main() {
  const mode = process.argv[2];
  const data = readJson();
  const built = buildBlock(data);
  const doc = fs.readFileSync(abs(DOC_PATH), 'utf8');
  const block = extractBlock(doc);

  const mismatch = jsonCitiesMismatch();
  if (mismatch) {
    console.error('✗ ' + mismatch);
    process.exitCode = 1;
    return;
  }

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

module.exports = { buildBlock, extractBlock, jsonCitiesMismatch, JSON_PATH, DOC_PATH, BEGIN, END };
