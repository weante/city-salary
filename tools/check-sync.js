#!/usr/bin/env node
/*
 * 漂移检查（CI 守卫）。
 *
 * 四类检查：
 *   A. 镜像文件是否与源文件逐字节相同（防止改了 calculator.html 忘了同步 site/index.html）
 *   B. 各城市参数是否在文档中都有记录（防止加了城市忘了写文档）
 *   C. 文档陈旧表述 lint（防止机制改版时漏改措辞）
 *   D. 文档断言数与 test-calc.js 实际输出一致（防止加了测试忘了改文档）
 *
 * 运行：node tools/check-sync.js
 * 退出码：0 = 无漂移，1 = 有漂移
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
const docs = {
  'AGENTS.md': { content: read('AGENTS.md'), checkValues: true },
  'SKILL.md':  { content: read('SKILL.md'),  checkValues: true },
  'README.md': { content: read('README.md'), checkValues: false },
};
const num = (n) => n.toLocaleString('en-US');

let missing = 0;
for (const key in CITIES) {
  const c = CITIES[key];
  const vals = [
    ['医保基数下限', c.med.min], ['医保基数上限', c.med.max],
    ['公积金基数下限', c.hf.min], ['公积金基数上限', c.hf.max],
  ];
  for (const dname in docs) {
    const { content, checkValues } = docs[dname];
    if (checkValues) {
      for (const [label, v] of vals) {
        if (content.indexOf(String(v)) < 0 && content.indexOf(num(v)) < 0) {
          console.log(`  ✗ ${c.name}(${key}) ${label}=${v} 未出现在 ${dname}`);
          missing++; fail++;
        }
      }
    }
    /* 城市名必须被文档提到 */
    if (content.indexOf(c.name) < 0) {
      console.log(`  ✗ 城市 ${c.name} 未出现在 ${dname}`);
      missing++; fail++;
    }
  }
}
if (!missing) console.log(`  ✓ ${Object.keys(CITIES).length} 个城市的基数与名称在 AGENTS.md / SKILL.md 中均可检索到（README.md 核对城市名）`);

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
  [/23\s*城/, '城市数"23城"已过时，应为44城（含四川21市州）'],
  [/广东\s*21\s*市\s*\+\s*北京\s*\/\s*上海(?!.*四川)/, '城市清单未包含四川21市州'],
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
   以 test-calc.js 的实际输出为准，文档写错这里会拦下。 */
console.log('\nD. 文档断言数');
let actualCount = null, testOk = true;
try {
  const out = execSync('node tools/test-calc.js', { cwd: ROOT, encoding: 'utf8' });
  const m2 = out.match(/全部通过：(\d+) 项断言/);
  if (m2) actualCount = Number(m2[1]);
} catch (e) { testOk = false; }
if (!testOk) {
  console.log('  ✗ test-calc.js 运行失败，无法核对断言数（先修复测试）');
  fail++;
} else if (actualCount === null) {
  console.log('  ✗ 无法从 test-calc.js 输出解析"全部通过：N 项断言"');
  fail++;
} else {
  const COUNT_FILES = MD_FILES.concat(['skills/city-salary/SKILL.md']);
  let countHits = 0;
  for (const f of COUNT_FILES) {
    let content;
    try { content = read(f); } catch (e) { continue; }
    const re = /(\d+) 项断言/g;
    let cm;
    while ((cm = re.exec(content))) {
      if (Number(cm[1]) !== actualCount) {
        const line = content.slice(0, cm.index).split('\n').length;
        console.log(`  ✗ ${f}:${line} 写着"${cm[1]} 项断言"，实际 ${actualCount} 项`);
        countHits++; fail++;
      }
    }
  }
  if (!countHits) console.log(`  ✓ 文档断言数均为实际值 ${actualCount}`);
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
