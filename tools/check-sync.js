#!/usr/bin/env node
/*
 * 漂移检查（CI 守卫）。
 *
 * 两类检查：
 *   A. 镜像文件是否与源文件逐字节相同（防止改了 calculator.html 忘了同步 site/index.html）
 *   B. 各城市参数是否在文档中都有记录（防止加了城市忘了写文档）
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
const docs = { 'AGENTS.md': read('AGENTS.md'), 'SKILL.md': read('SKILL.md') };
const num = (n) => n.toLocaleString('en-US');

let missing = 0;
for (const key in CITIES) {
  const c = CITIES[key];
  const vals = [
    ['医保基数下限', c.med.min], ['医保基数上限', c.med.max],
    ['公积金基数下限', c.hf.min], ['公积金基数上限', c.hf.max],
  ];
  for (const dname in docs) {
    for (const [label, v] of vals) {
      if (docs[dname].indexOf(String(v)) < 0 && docs[dname].indexOf(num(v)) < 0) {
        console.log(`  ✗ ${c.name}(${key}) ${label}=${v} 未出现在 ${dname}`);
        missing++; fail++;
      }
    }
    /* 城市名必须被文档提到 */
    if (docs[dname].indexOf(c.name) < 0) {
      console.log(`  ✗ 城市 ${c.name} 未出现在 ${dname}`);
      missing++; fail++;
    }
  }
}
if (!missing) console.log(`  ✓ ${Object.keys(CITIES).length} 个城市的基数与名称在 AGENTS.md / SKILL.md 中均可检索到`);

/* ---------- C. 文档陈旧表述 lint ----------
   教训来自一次真实漂移：时效机制改成双检查点后，README/SKILL/AGENTS 都改了，
   docs/ 下的安装文档漏改，残留"每年 7 月 15 日后"的单检查点表述长达一个版本。
   机制类措辞改版时，这里跟着加对应的 lint 模式。 */
console.log('\nC. 文档陈旧表述');
const MD_FILES = ['README.md', 'SKILL.md', 'AGENTS.md']
  .concat(fs.existsSync(path.join(ROOT, 'docs'))
    ? fs.readdirSync(path.join(ROOT, 'docs')).filter(f => f.endsWith('.md')).map(f => 'docs/' + f)
    : []);
const STALE_PATTERNS = [
  [/7\s*月\s*15\s*日后/, '单一检查点表述"7月15日后"（双检查点机制下应为：1月(医保)/7月(养老公积金)/限期费率到期）'],
  [/广东省\s*21\s*个?\s*地级市(?!.*北京)/, '城市清单未包含京沪'],
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
