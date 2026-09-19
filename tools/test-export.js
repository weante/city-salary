#!/usr/bin/env node
/*
 * 导出 PDF 的降级链测试。
 *
 * 背景：exportPDF() 里有一个"PDF 生成失败就退回到浏览器打印"的兜底。
 * 曾经的写法是 canvas 一拿到就把 done=true，导致后续 toDataURL/组装 PDF 抛错时，
 * catch 和 6 秒兜底都变成空操作 —— 用户点了"导出 PDF"什么都不会发生。
 * 这个测试用桩模拟"html2canvas 成功但 toDataURL 抛错"（画布被跨域图污染），
 * 断言 window.print() 最终确实被调用。
 *
 * 运行：node tools/test-export.js
 * 退出码：0 = 兜底可用，1 = 兜底失效
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
const document = {
  getElementById: (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement: () => makeEl('_new'), head: { appendChild() {} }, querySelectorAll: () => [],
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
];

let fail = 0;
let idx = 0;
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

console.log('导出 PDF 降级链（每项含 6 秒兜底等待）');
runNext();
