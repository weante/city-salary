#!/usr/bin/env node
/*
 * 导出 PDF 的降级链测试。
 *
 * 背景 1：exportPDF() 里有一个"PDF 生成失败就退回到浏览器打印"的兜底。
 * 曾经的写法是 canvas 一拿到就把 done=true，导致后续 toDataURL/组装 PDF 抛错时，
 * catch 和 6 秒兜底都变成空操作 —— 用户点了"导出 PDF"什么都不会发生。
 * 这个测试用桩模拟"html2canvas 成功但 toDataURL 抛错"（画布被跨域图污染），
 * 断言 window.print() 最终确实被调用。
 *
 * 背景 2：兜底超时原先是无条件 6 秒起算，CDN 慢时打印框会先弹出来、而 PDF 随后
 * 又保存成功，用户看到一个多余的打印框。现在拆成"加载段 20 秒 / 渲染段 6 秒"
 * 两段计时，下面的第 4 个用例守卫这个行为。
 *
 * 运行：node tools/test-export.js
 * 退出码：0 = 降级链完好，1 = 有回归
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CALC = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'skills', 'city-salary', 'assets', 'calculator.html');
const html = fs.readFileSync(CALC, 'utf8');
console.log('被测文件：' + CALC);
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

function makeEl(id) {
  return { id, value: '', textContent: '', innerHTML: '', max: '', disabled: false, checked: false,
    className: '', style: {}, dataset: {}, scrollWidth: 800,
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; },
    setAttribute() {}, getAttribute() { return null; },
    classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} };
}
const els = new Map();
/* 记录被 append 的 <script>，用于验证 loadScript 的同名去重缓存 */
const appended = [];
const document = {
  getElementById: (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement: () => makeEl('_new'),
  head: { appendChild(el) { appended.push(el && el.src); } },
  querySelectorAll: () => [],
};

const CASES = [
  {
    name: 'html2canvas 成功，但 toDataURL 抛错（画布污染）',
    html2canvas: () => Promise.resolve({ width: 800, height: 3000, toDataURL() { throw new Error('tainted canvas'); } }),
    jspdf: { jsPDF: function () { return { addImage() {}, addPage() {}, save() {} }; } },
    expectPrint: true,
  },
  {
    name: 'jsPDF 组装阶段抛错',
    html2canvas: () => Promise.resolve({ width: 800, height: 3000, toDataURL() { return 'data:image/png;base64,x'; } }),
    jspdf: { jsPDF: function () { throw new Error('jspdf boom'); } },
    expectPrint: true,
  },
  {
    name: '全链路成功（不应触发打印兜底）',
    html2canvas: () => Promise.resolve({ width: 800, height: 3000, toDataURL() { return 'data:image/png;base64,x'; } }),
    jspdf: { jsPDF: function () { return { addImage() {}, addPage() {}, save() {} }; } },
    expectPrint: false,
  },
  {
    /* 回归自代码审查问题 6：CDN 慢加载时，兜底超时从 6 秒起算会导致打印框先弹出来、
       PDF 随后又保存成功，用户看到一个多余的打印框。现在把兜底拆成"加载段 20 秒 /
       渲染段 6 秒"两段计时，本用例把两个库都拿掉且让脚本永远不 onload，
       断言 6.8 秒内**不应**弹打印框——修复前这里会在 6 秒时被调用。 */
    name: 'CDN 未就绪（脚本仍在加载）：6.8 秒内不应弹打印框',
    html2canvas: undefined,
    jspdf: undefined,
    expectPrint: false,
  },
];

let fail = 0;
let idx = 0;

/* ---- 附加检查：loadScript 的同名去重缓存（代码审查问题 6）----
   连点两次"导出 PDF"不应重复注入同名 CDN <script>。这是同步检查，不需要等兜底。 */
function cacheCase() {
  appended.length = 0;
  const window = { print() {}, html2canvas: undefined, jspdf: undefined };
  const api = new Function('document', 'window', 'console', 'setTimeout', 'Promise', 'html2canvas', 'jspdf',
    src + '\n;return {selectCity,calc,exportPDF};')(document, window, console, setTimeout, Promise, undefined, undefined);
  api.selectCity('sz');
  api.calc();
  api.exportPDF();
  api.exportPDF();
  const uniq = [...new Set(appended)];
  const good = appended.length === 2 && uniq.length === 2;
  console.log(`  ${good ? '✓' : '✗'} 连续两次导出只注入 2 个 CDN script（实际注入 ${appended.length} 个，去重后 ${uniq.length} 个）`);
  if (!good) fail++;
}

function runNext() {
  if (idx >= CASES.length) {
    console.log('\n' + '='.repeat(58));
    if (fail) { console.log(`失败 ${fail} 项`); process.exit(1); }
    console.log('导出降级链检查通过');
    process.exit(0);
  }
  const c = CASES[idx++];
  let printed = false;
  /* 注意：exportPDF 先探测 window.html2canvas / window.jspdf，缺失就走 CDN 加载分支。
     必须把桩同时挂到 window 上，否则测的是"CDN 下载失败"路径而不是目标路径。 */
  const window = { print() { printed = true; }, html2canvas: c.html2canvas, jspdf: c.jspdf };
  const api = new Function('document', 'window', 'console', 'setTimeout', 'Promise', 'html2canvas', 'jspdf',
    src + '\n;return {selectCity,calc,exportPDF};')(document, window, console, setTimeout, Promise,
    c.html2canvas, c.jspdf);
  api.selectCity('sz');
  api.calc();
  api.exportPDF();
  /* 6 秒兜底 + 一点余量 */
  setTimeout(() => {
    const good = printed === c.expectPrint;
    console.log(`  ${good ? '✓' : '✗'} ${c.name}：window.print() ${printed ? '被调用' : '未调用'}（期望${c.expectPrint ? '调用' : '不调用'}）`);
    if (!good) fail++;
    runNext();
  }, 6800);
}

console.log('导出 PDF 降级链（每项含兜底等待）');
cacheCase();
runNext();
