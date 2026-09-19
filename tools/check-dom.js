#!/usr/bin/env node
/*
 * 静态结构检查：单文件 HTML 最容易藏的一类 bug 是"引用了不存在的 DOM 节点"。
 *
 * 检查项：
 *   1. HTML 中是否有重复 id
 *   2. JS 里 $("x") 引用的 id 是否都在 HTML 中存在（含动态拼接的行 id）
 *   3. 内联 onclick/onchange/oninput 调用的函数是否都有定义
 *   4. 绑定 input 事件的字段 id 是否存在
 *
 * 运行：node tools/check-dom.js
 * 退出码：0 = 无问题，1 = 有问题
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CALC = path.join(__dirname, '..', 'skills', 'city-salary', 'assets', 'calculator.html');
const html = fs.readFileSync(CALC, 'utf8');
const scriptStart = html.indexOf('<script>');
const markup = html.slice(0, scriptStart);
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = 0;

/* 1. 重复 id */
const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
console.log(`1. HTML id 共 ${ids.length} 个，重复 ${dup.length} 个`);
if (dup.length) { console.log('   ✗ 重复：' + dup.join(', ')); fail++; }
else console.log('   ✓ 无重复');

/* 2. JS 引用的静态 id（动态生成的 id 形如 csi0/chf0/hrow0，靠 render 时创建，不在此列） */
const refs = [...new Set([...js.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]))];
const dynamic = refs.filter(r => /^(csi|chf|ctx|cnet|hrow|md)\d?$/.test(r));
const staticRefs = refs.filter(r => dynamic.indexOf(r) < 0);
const missing = staticRefs.filter(r => ids.indexOf(r) < 0);
console.log(`\n2. JS 中 $() 静态引用 ${staticRefs.length} 个（另有 ${dynamic.length} 个动态 id）`);
if (missing.length) { console.log('   ✗ HTML 中不存在：' + missing.join(', ')); fail++; }
else console.log('   ✓ 全部存在');

/* 3. 内联事件处理器引用的函数 */
const handlers = [...new Set([...html.matchAll(/on(?:click|change|input)="([a-zA-Z_$][\w$]*)\(/g)].map(m => m[1]))];
const defined = new Set([...js.matchAll(/function\s+([a-zA-Z_$][\w$]*)\s*\(/g)].map(m => m[1]));
[...js.matchAll(/(?:var|let|const)\s+([a-zA-Z_$][\w$]*)\s*=\s*function/g)].forEach(m => defined.add(m[1]));
const undef = handlers.filter(h => !defined.has(h));
console.log(`\n3. 内联事件处理器 ${handlers.length} 个`);
if (undef.length) { console.log('   ✗ 未定义：' + undef.join(', ')); fail++; }
else console.log('   ✓ 全部有定义');

/* 4. addEventListener("input", calc) 批量绑定的字段 */
const listMatch = js.match(/\[([^\]]*)\]\.forEach\(function\(id\)\{\$\(id\)\.addEventListener/);
if (listMatch) {
  const arr = listMatch[1].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  const bad = arr.filter(i => ids.indexOf(i) < 0);
  console.log(`\n4. 绑定 input 监听的字段 ${arr.length} 个`);
  if (bad.length) { console.log('   ✗ HTML 中不存在：' + bad.join(', ')); fail++; }
  else console.log('   ✓ 全部存在');
}

/* 汇总 */
const lines = html.split('\n').length;
const fns = [...js.matchAll(/function\s+([\w$]+)\s*\(/g)].map(m => m[1]);
console.log(`\n规模：总 ${lines} 行 · JS ${js.split('\n').length} 行 · 函数 ${fns.length} 个 · 城市参数见 CITIES`);
console.log('='.repeat(58));
if (fail) { console.log(`发现 ${fail} 类问题`); process.exit(1); }
console.log('静态结构检查通过');
process.exit(0);
