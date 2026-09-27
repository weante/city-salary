#!/usr/bin/env node
/*
 * CI 自检：守住仓库的"零依赖 + Node 版本"红线。
 *
 * 存在的意义：本仓库的立身之本是**单文件 HTML + 零依赖 Node 脚本**（README 与
 * AGENTS.md 都把"无需 npm install"当作核心优势）。CI 里只要出现一次 npm install，
 * 就等于默认允许引入依赖，这条红线会在不知不觉中失守。所以把它做成可执行的守卫，
 * 而不是写在文档里的约定。
 *
 * 检查项：
 *   1. package.json 不得声明任何 dependencies / devDependencies / peerDependencies
 *   2. package.json 的 scripts 不得出现 npm install / npx / yarn / pnpm
 *   3. tools/ 下不得 require 第三方包（非相对路径、非 node: 内建模块）
 *   4. 当前 Node 版本需满足 engines.node
 *
 * 运行：node tools/ci-selfcheck.js
 * 退出码：0 = 通过，1 = 违反红线
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
let fail = 0;

/* ---------- 1 & 2. package.json 依赖与脚本 ---------- */
console.log('1. package.json 零依赖');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
let depCount = 0;
for (const f of DEP_FIELDS) {
  const keys = Object.keys(pkg[f] || {});
  if (keys.length) { console.log(`  ✗ ${f} 非空：${keys.join(', ')}`); depCount += keys.length; fail++; }
}
if (!depCount) console.log('  ✓ 未声明任何依赖（无需 npm install）');

console.log('\n2. scripts 不得引入包管理器调用');
const BANNED = /\b(npm\s+(install|i|ci)|npx|yarn|pnpm)\b/;
const scripts = pkg.scripts || {};
let scriptHits = 0;
for (const name of Object.keys(scripts)) {
  if (BANNED.test(scripts[name])) { console.log(`  ✗ scripts.${name}：${scripts[name]}`); scriptHits++; fail++; }
}
if (!scriptHits) console.log(`  ✓ ${Object.keys(scripts).length} 条 scripts 均为纯 node 调用`);

/* ---------- 3. tools/ 下不得 require 第三方包 ---------- */
console.log('\n3. tools/ 脚本仅依赖内建模块与实际文件');
const BUILTIN = new Set(Module.builtinModules.concat(Module.builtinModules.map(m => 'node:' + m)));
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js'));
let extHits = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    if (spec.startsWith('.') || spec.startsWith('/') || BUILTIN.has(spec) || BUILTIN.has('node:' + spec)) continue;
    console.log(`  ✗ ${f} require 了第三方包：${spec}`);
    extHits++; fail++;
  }
}
if (!extHits) console.log(`  ✓ ${files.length} 个脚本无第三方 require`);

/* ---------- 4. Node 版本 ---------- */
console.log('\n4. Node 版本');
const want = (pkg.engines && pkg.engines.node) || '';
const major = Number(process.versions.node.split('.')[0]);
const min = (want.match(/(\d+)/) || [])[1];
if (min && major < Number(min)) {
  console.log(`  ✗ 当前 Node ${process.versions.node}，engines 要求 ${want}`);
  fail++;
} else {
  console.log(`  ✓ 当前 Node ${process.versions.node} 满足 engines ${want || '(未声明)'}`);
}

/* ---------- 5. test-calc 被 require 时必须静默 ----------
   check-sync 的 D 检查直接 require test-calc.js 取断言计数。若测试里残留裸
   console.log（而没走 emit），它的输出就会混进 check-sync 的 stdout，破坏
   "被 require 时静默"的契约——2026-09-27 新增第 13 节时就踩过一次。 */
console.log('\n5. test-calc 的输出必须全部走 emit（被 require 时静默）');
const calcSrc = fs.readFileSync(path.join(__dirname, 'test-calc.js'), 'utf8');
const rawLogs = calcSrc.split('console.log(').length - 1;
if (rawLogs > 0) {
  console.log(`  ✗ test-calc.js 中有 ${rawLogs} 处裸 console.log，应改用 emit（被 require 时会污染调用方输出）`);
  fail++;
} else {
  console.log('  ✓ 无裸 console.log，输出统一走 emit');
}

console.log('\n' + '='.repeat(58));
if (fail) { console.log(`零依赖自检未通过：${fail} 项`); process.exit(1); }
console.log('零依赖自检通过');
process.exit(0);
