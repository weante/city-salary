#!/usr/bin/env node
/*
 * 最小离线 E2E（e2e-smoke）：直接加载**交付物** site/index.html 里的脚本，在最小 DOM 桩上
 * 跑一遍用户主路径，不联网、不下载浏览器、不引入依赖。
 *
 * 覆盖的三步（对应需求）：
 *   1) 初始城市遮罩出现：静态标记存在 + CSS 显示 + 选城前 JS 未把它隐藏、主卡为空；
 *   2) 选城后主卡数值出现：selectCity → calc → 遮罩 display=none、resNet > 0；
 *   3) window.print 降级路径可用：exportPDF 在 CDN 库缺失时排 20s 兜底计时，
 *      触发计时后确实调用 window.print（用假 setTimeout 截获，不真的等 20 秒）。
 *
 * 这不是浏览器级 E2E：没有 CSS 布局、动画、真实打印对话框，也不验证 CDN 真正可达。
 * 它验证的是"交付文件里的脚本 + 真实交互顺序"能在最小桩上走通；渲染细节由
 * check-golden（16×4 逐字节）与 check-dom（结构契约）兜底。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadCalculator } = require('./calc-harness.js');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site', 'index.html');
const SRC = path.join(ROOT, 'skills', 'city-salary', 'assets', 'calculator.html');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗ ' + name + (detail ? '：' + detail : '')); }
}

console.log('E2E 冒烟（离线，直接跑 site/index.html 的脚本）');

/* ---------- 0. 交付物与源文件一致 ---------- */
const siteHtml = fs.readFileSync(SITE, 'utf8');
const srcHtml = fs.readFileSync(SRC, 'utf8');
ok('site/index.html 与 skills 内 calculator.html 逐字节一致', siteHtml === srcHtml,
  '两份文件内容不同，先跑 node tools/sync.js');

const scriptMatch = siteHtml.match(/<script>([\s\S]*)<\/script>/);
ok('site/index.html 含 <script> 块', !!scriptMatch);
if (!scriptMatch) {
  console.log('\nE2E 冒烟失败：' + fail + ' 项');
  process.exit(1);
}

/* ---------- 1. 初始遮罩 ---------- */
ok('存在城市选择遮罩 id=cityOverlay', /id="cityOverlay"/.test(siteHtml));
ok('遮罩内是城市选择弹层（含「选择工作城市」）', /城市选择弹层/.test(siteHtml) && /选择工作城市/.test(siteHtml));
ok('.overlay 样式默认 display:flex（不选城就挡在前面）', /\.overlay\{[^}]*display:flex/.test(siteHtml));
ok('遮罩没有内联 display:none（初始即显示）',
  !/<div class="overlay" id="cityOverlay"[^>]*style="[^"]*display\s*:\s*none/.test(siteHtml));

/* ---------- 运行时：加载 site/index.html 自己的脚本 ---------- */
const timers = [];
let printCalls = 0;
const A = loadCalculator({
  sourceText: scriptMatch[1],
  window: { print() { printCalls++; } },
  setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
});

ok('选城前主卡 res 为空（遮罩阶段不给结果）', A._html('res') === '', JSON.stringify(A._html('res').slice(0, 60)));
ok('选城前遮罩未被 JS 隐藏（display 未设为 none）', A._style('cityOverlay') !== 'none', 'display=' + A._style('cityOverlay'));

/* ---------- 2. 选城 → 主卡数值 ---------- */
A.selectCity('sz');
A._setMany({
  salary: 15000, month: 7, startMonth: 1, bonus: 0,
  pBase: 10000, mBase: 10000, uBase: 10000, mtBase: 10000, ijBase: 10000, hfBase: 10000,
  hfRate: 5, healthIns: 0, persPen: 0, annuity: 0,
  childAmt: 0, eduAmt: 0, houseAmt: 0, elderlyAmt: 0,
});
A.calc();

ok('选城后遮罩关闭（display=none）', A._style('cityOverlay') === 'none', 'display=' + A._style('cityOverlay'));
ok('选城后主卡渲染出 res 面板', A._html('res') !== '');
ok('主卡「税后实发」resNet 为有效正数', Number.isFinite(A._num('resNet')) && A._num('resNet') > 0,
  'resNet=' + A._num('resNet'));
ok('主卡社保个人合计 resSI 出现在结果里', A._has('resSI'));

/* ---------- 3. print 降级 ---------- */
A.exportPDF(A.CITIES.sz);
const appendedSrc = A._appended().filter(Boolean);
ok('CDN 库缺失时去加载 html2canvas', appendedSrc.some(u => /html2canvas/.test(u)));
const fb = timers.find(t => t.delay === 20000);
ok('exportPDF 排了 20s 兜底打印计时', !!fb, 'timers=' + timers.map(t => t.delay).join(','));
if (fb) {
  fb.fn();
  ok('兜底计时触发后调用 window.print', printCalls === 1, 'printCalls=' + printCalls);
}

console.log('\n' + '='.repeat(50));
if (fail) {
  console.log(`E2E 冒烟未通过：${pass} 通过 / ${fail} 失败`);
  process.exit(1);
}
console.log(`E2E 冒烟通过：${pass} 项`);
process.exit(0);
