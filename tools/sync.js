#!/usr/bin/env node
/*
 * 同步镜像文件。
 *
 * 本仓库有两组"同一份内容、多处存放"的文件（历史上靠人肉复制，容易漂移）：
 *   1. skills/city-salary/assets/calculator.html  →  site/index.html
 *   2. skills/city-salary/SKILL.md                →  SKILL.md（仓库根，便于 GitHub 直接阅读）
 *
 * 以 skills/ 下那份为准（它是真正被安装到 Agent 里的产物），单向复制到镜像位置。
 * 年度更新基数的流程因此变成：改 skills/ → node tools/sync.js → node tools/test-calc.js
 *
 * 运行：node tools/sync.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAIRS = [
  ['skills/city-salary/assets/calculator.html', 'site/index.html'],
  ['skills/city-salary/SKILL.md', 'SKILL.md'],
];

let changed = 0, same = 0;
for (const [src, dst] of PAIRS) {
  const s = path.join(ROOT, src), d = path.join(ROOT, dst);
  const a = fs.readFileSync(s, 'utf8');
  let b = null;
  try { b = fs.readFileSync(d, 'utf8'); } catch (e) { /* 目标不存在则创建 */ }
  if (a === b) { same++; console.log(`  = ${dst}（已一致）`); continue; }
  fs.writeFileSync(d, a);
  changed++;
  console.log(`  → ${dst}（已更新）`);
}
console.log(`\n同步完成：更新 ${changed} 个，已一致 ${same} 个`);
console.log('提示：改完记得 node tools/test-calc.js 与 node tools/check-sync.js');
