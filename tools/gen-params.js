#!/usr/bin/env node
'use strict';
/**
 * gen-params.js —— 从 CITIES 生成文档里的「参数块」字符串
 *
 * 背景：AGENTS.md 第 5~6、8~9、11~36 条、SKILL.md 的省级表格里，
 * 大量「城市名+数值」的参数串是**手写维护**的。本会话中反复出现
 * 「改了 CITIES 却漏改文档」或「改了文档却漏改 CITIES」——
 * 每次都靠守卫 B（check-sync.js）兜住，共 6 次。
 *
 * 本工具把「生成」这一步机械化：直接输出可粘贴的参数串，
 * 避免手写。用法：
 *
 *   node tools/gen-params.js                 # 输出全部省份
 *   node tools/gen-params.js 安徽             # 只输出某省
 *   node tools/gen-params.js 安徽 --field hf  # 只输出公积金基数
 *
 * 注：**「文档与 CITIES 是否一致」的校验由 `tools/check-sync.js` 的守卫 B 负责**，
 * 本工具只负责**生成**。早期版本曾内置一个 `--diff`，但它的定位逻辑
 * （`AGENTS.md.indexOf(城市名)`）会命中第 1 条规则里的城市清单而非省份参数块，
 * 导致误报 337/337 —— 与守卫 B 重复且更差，已移除。
 *
 * 字段：hf（公积金基数下限~上限）/ med（医保单位费率）/ rent（租金档位）
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { loadCalculator } = require(path.join(ROOT, 'tools', 'calc-harness.js'));

const A = loadCalculator();
const CITIES = A.CITIES;

/* 城市 key → 条目；按 region 分组，保持 CITIES 的原始顺序 */
const byRegion = {};
for (const k of Object.keys(CITIES)) {
  const c = CITIES[k];
  (byRegion[c.region] = byRegion[c.region] || []).push({ key: k, ...c });
}

function fmtHf(c) {
  const min = c.hf.min, max = c.hf.max;
  const s = c.hf.min2 ? `${min}/${c.hf.min2}` : `${min}`;
  return `${c.name}${s}~${max}`;
}
function fmtMed(c) {
  const pct = v => (v * 100).toFixed(v * 100 % 1 === 0 ? 0 : 2).replace(/\.?0+$/, '');
  return `${c.name}${pct(c.med.comp)}%`;
}
function fmtRent(c) {
  return `${c.name}${c.rent}`;
}
const FIELDS = { hf: fmtHf, med: fmtMed, rent: fmtRent };

const args = process.argv.slice(2);
const fieldArg = (args.includes('--field') ? args[args.indexOf('--field') + 1] : null);
const wantDiff = args.includes('--diff');
const provArg = args.find(a => !a.startsWith('--') && a !== fieldArg);

const fields = fieldArg ? [fieldArg] : Object.keys(FIELDS);
for (const f of fields) if (!FIELDS[f]) { console.error('未知字段：' + f + '（可选 ' + Object.keys(FIELDS).join('/') + '）'); process.exit(1); }

let regions = Object.keys(byRegion);
if (provArg) {
  regions = regions.filter(r => r === provArg || r.includes(provArg));
  if (!regions.length) { console.error('未找到省级单位：' + provArg); process.exit(1); }
}

const out = [];
for (const r of regions) {
  out.push('### ' + r + '（' + byRegion[r].length + ' 城）');
  for (const f of fields) {
    out.push('  [' + f + '] ' + byRegion[r].map(c => FIELDS[f](c)).join('；'));
  }
  out.push('');
}

if (!wantDiff) {
  console.log(out.join('\n'));
  process.exit(0);
}

/* --diff：把生成的串与 AGENTS.md 里的现有串比对，只报「文档里有但值不同」的项 */
const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
const numbersIn = s => (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
let checked = 0, drift = 0;
for (const r of regions) {
  for (const c of byRegion[r]) {
    const idx = agents.indexOf(c.name);
    if (idx < 0) { console.log('  ⚠️ ' + r + '·' + c.name + '：AGENTS.md 中未出现该城市名'); drift++; continue; }
    /* 取城市名之后的一段（到下一个城市名为止，或 220 字符） */
    const seg = agents.slice(idx, idx + 220);
    const nums = numbersIn(seg);
    const want = [c.hf.min, c.hf.max];
    const hit = want.every(n => nums.includes(n));
    checked++;
    if (!hit) { console.log('  ✗ ' + r + '·' + c.name + '：公积金 ' + want.join('~') + ' 未在该城之后的片段中出现'); drift++; }
  }
}
console.log('\n  已比对 ' + checked + ' 城，发现 ' + drift + ' 处不一致');
process.exit(drift ? 1 : 0);
