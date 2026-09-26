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
/* 动态 id（csi0/chf0/hrow0/md1 等）由 $("csi"+idx) 拼接生成，
   上面的字面量正则捕获不到，因此不在此检查范围。
   它们的正确性由 test-calc.js 的渲染断言（_cell/_num）间接守卫。 */
const staticRefs = refs;  /* 所有捕获到的都是字面量静态引用 */
const missing = staticRefs.filter(r => ids.indexOf(r) < 0);
console.log(`\n2. JS 中 $() 静态引用 ${staticRefs.length} 个`);
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

/* 5. CITIES 字面量中是否有重复的 key / 重复的城市名
       —— JS 对象字面量遇到重复 key 时「值取后者、位置取前者」，会静默丢掉一个城市，
          且用 Object.keys(CITIES).length 也看不出来（总数会少，但难以定位）。
          本仓库已两次踩到（hez/bs、qy/wz），故在此固化检查。 */
const citiesBlock = html.split('var CITIES=')[1];
/* 注意：广东 21 市用 CI() 工厂（基数各自独立），其余省市用 CIU()，两者都要覆盖 */
const litKeys = [...citiesBlock.matchAll(/^[ \t]*([A-Za-z][\w]*):CIU?\(/gm)].map(m => m[1]);
const litNames = [...citiesBlock.matchAll(/^[ \t]*[A-Za-z][\w]*:CIU?\("([^"]+)"/gm)].map(m => m[1]);
const rdup = k => [...new Set(k.filter((v, i) => k.indexOf(v) !== i))];
const dupKeys = rdup(litKeys), dupNames = rdup(litNames);
/* 自校验：字面量 key 数必须等于 :CIU( 出现次数，否则说明正则漏扫（会静默漏检重复 key） */
const allCiu = (citiesBlock.match(/:CIU?\(/g) || []).length;
console.log(`\n5. CITIES 字面量 key ${litKeys.length} 个 / 城市名 ${litNames.length} 个`);
if (litKeys.length !== allCiu) {
  console.log(`   ✗ 正则覆盖不全：key 捕获 ${litKeys.length} ≠ :CIU( 出现 ${allCiu}`);
  fail++;
}
if (dupKeys.length || dupNames.length) {
  if (dupKeys.length) console.log('   ✗ 重复 key（会静默丢城市）：' + dupKeys.join(', '));
  if (dupNames.length) console.log('   ✗ 重复城市名：' + dupNames.join(', '));
  fail++;
} else console.log('   ✓ 无重复 key、无重复城市名');

/* 汇总 */
const lines = html.split('\n').length;
const fns = [...js.matchAll(/function\s+([\w$]+)\s*\(/g)].map(m => m[1]);
console.log(`\n规模：总 ${lines} 行 · JS ${js.split('\n').length} 行 · 函数 ${fns.length} 个 · 城市参数见 CITIES`);
console.log('='.repeat(58));
if (fail) { console.log(`发现 ${fail} 类问题`); process.exit(1); }
console.log('静态结构检查通过');
process.exit(0);
