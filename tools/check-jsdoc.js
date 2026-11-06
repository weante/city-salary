#!/usr/bin/env node
/*
 * check-jsdoc.js —— 零依赖的 JSDoc 结构检查（不装 typescript，也不跑 tsc）。
 *
 * 为什么不是 `tsc --checkJs`：仓库红线是"零依赖、不装包"，CI 里没有 TypeScript；
 * 即便加了 `// @ts-check`，也没有任何东西会真正执行它（它只是给编辑器语言服务的开关），
 * 且会给 calculator.html 其余 5000 行未标注代码一次性刷出大量既有诊断，噪声远大于收益。
 *
 * 所以这里守一件可验证的事：**关键计算函数必须带 JSDoc，且注释与实际参数/返回值对得上**。
 * 这样重构改了签名却忘了改注释时，门禁会失败，而不是靠人眼看。
 *
 * 覆盖：cl / cl0 / calcContrib / calcDeductions / calcTax / planSegments。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'skills', 'city-salary', 'assets', 'calculator.html');
const TARGETS = ['cl', 'cl0', 'calcContrib', 'calcDeductions', 'calcTax', 'planSegments'];

const html = fs.readFileSync(HTML, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/);
if (!script) {
  console.log('✗ 找不到内联 <script>，无法检查 JSDoc');
  process.exit(1);
}
const src = script[1];

let fail = 0;
console.log('JSDoc 结构检查（零依赖，不跑 tsc）');

for (const name of TARGETS) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(([^)]*)\\)');
  const m = re.exec(src);
  if (!m) {
    console.log(`  ✗ 找不到函数 ${name}()`);
    fail++;
    continue;
  }
  const params = m[1].split(',').map(s => s.trim()).filter(Boolean);
  const before = src.slice(0, m.index);
  /* 向上找最近的 JSDoc 块，且与函数之间只有空白（不能用惰性全局正则，
     否则会把前面所有函数的 JSDoc 一起吞进来） */
  const end = before.lastIndexOf('*/');
  if (end < 0 || before.slice(end + 2).trim() !== '') {
    console.log(`  ✗ ${name}() 上方紧邻没有 JSDoc 块`);
    fail++;
    continue;
  }
  const start = before.lastIndexOf('/**', end);
  if (start < 0) {
    console.log(`  ✗ ${name}() 上方的注释不是 JSDoc（缺少 /** 开头）`);
    fail++;
    continue;
  }
  const block = before.slice(start, end + 2);
  const declared = (block.match(/@param\s+/g) || []).length;
  const hasReturn = /@returns?\s+/.test(block);
  if (declared !== params.length) {
    console.log(`  ✗ ${name}() 有 ${params.length} 个参数，但 JSDoc 写了 ${declared} 个 @param`);
    fail++;
  } else if (!hasReturn) {
    console.log(`  ✗ ${name}() 的 JSDoc 缺 @returns`);
    fail++;
  } else {
    console.log(`  ✓ ${name}()：${params.length} 个参数 + @returns`);
  }
}

/* 明确记录设计取舍，防止后来者以为漏加了 @ts-check */
const tsCheck = (src.match(/\/\/\s*@ts-check/g) || []).length;
if (tsCheck) {
  console.log(`  ✗ 内联脚本里出现 ${tsCheck} 处 // @ts-check：本仓库没有 tsc 门禁，开了只会制造编辑器噪声`);
  fail++;
}

console.log('');
console.log('='.repeat(50));
if (fail) {
  console.log(`JSDoc 结构检查未通过：${fail} 项`);
  process.exit(1);
}
console.log('JSDoc 结构检查通过');
process.exit(0);
