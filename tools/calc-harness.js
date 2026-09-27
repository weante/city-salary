#!/usr/bin/env node
/*
 * 计算器测试脚手架：最小 DOM 桩 + 加载器。
 *
 * 为什么要有这个模块：本项目测的是**真正会跑在用户浏览器里的那份代码**——
 * 从 calculator.html 里抽出真实 <script>，在最小 DOM 桩上执行，而不是在测试里
 * 重写一份逻辑副本。这个"抽脚本 + 搭桩"的动作原先在 test-calc.js、
 * check-sync.js、test-export.js 里各写了一遍（即将再加第四遍给黄金用例），
 * 于是集中到这里。
 *
 * 各脚本对桩的要求略有差异，用 opts 表达：
 *   opts.window   —— 覆盖/扩展 window（如 test-export 注入 html2canvas 桩）
 *   opts.onAppend —— 追加 <script> 时的回调（test-export 用它验证去重缓存）
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CALC_PATH = path.join(__dirname, '..', 'skills', 'city-salary', 'assets', 'calculator.html');

function readCalculatorSource() {
  const html = fs.readFileSync(CALC_PATH, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('calculator.html 中找不到 <script> 块');
  return m[1];
}

function makeEl(id) {
  return {
    id, value: '', textContent: '', innerHTML: '', max: '', disabled: false, checked: false,
    className: '', style: {}, dataset: {}, scrollWidth: 800,
    addEventListener() {}, removeEventListener() {},
    querySelectorAll() { return []; }, querySelector() { return null; },
    setAttribute() {}, getAttribute() { return null; },
    classList: { add() {}, remove() {}, toggle() {} }, appendChild() {},
  };
}

/* 暴露给测试的 API 是**超集**：各脚本按需取用，避免每加一个测试就改一次导出清单。 */
const API_NAMES = 'tx,btx,TRAPS,BR,BBR,CITIES,CLAMP:cl,normHF,effStart,calc,selectCity,' +
  'setHk,setMed,setChild,setHouse,switchTab,buildHistory,calcHist,exportPDF,' +
  'histRows:function(){return histRows}';

function loadCalculator(opts) {
  opts = opts || {};
  const els = new Map();
  const appended = [];
  const document = {
    getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    createElement: () => makeEl('_new'),
    head: {
      appendChild(el) {
        appended.push(el && el.src);
        if (opts.onAppend) opts.onAppend(el);
      },
    },
    querySelectorAll: () => [],
  };
  const window = Object.assign({ print() {} }, opts.window || {});
  const api = new Function('document', 'window', 'console', 'setTimeout',
    readCalculatorSource() + '\n;return {' + API_NAMES + '};'
  )(document, window, console, setTimeout);

  api._doc = document;
  api._window = window;
  api._appended = () => appended.slice();
  api._set = (k, v) => { document.getElementById(k).value = v; };
  api._setMany = (o) => { for (const k in o) document.getElementById(k).value = o[k]; };
  api._check = (k, v) => { document.getElementById(k).checked = v; };
  api._text = (k) => document.getElementById(k).textContent;
  api._html = (k) => document.getElementById(k).innerHTML;

  /* 按 id 从渲染结果里取数字。只依赖 id（稳定契约），不依赖内联样式；
     桩不做 DOM 解析，所以从 HTML 字符串里定位——找不到就抛出带 id 的明确错误，
     而不是返回 null 让断言以"实际=null"的形式含糊失败。 */
  const renderRoots = () => api._html('res') + api._html('bonusResult') + api._html('histSum') + api._html('histTable');
  api._cell = (id) => {
    const m = renderRoots().match(new RegExp('id="' + id + '"[^>]*>([^<]*)<'));
    if (!m) throw new Error(`渲染结果中找不到 id=${id} 的输出节点`);
    return m[1];
  };
  api._num = (id) => parseFloat(api._cell(id).replace(/[^\d.\-]/g, ''));
  api._has = (id) => new RegExp('id="' + id + '"').test(renderRoots());
  /* 桩元素属性（可见性/类名等），用于断言交互状态而非文本 */
  api._style = (id) => document.getElementById(id).style.display;
  api._class = (id) => document.getElementById(id).className;
  api._checked = (id) => document.getElementById(id).checked;
  return api;
}

module.exports = { loadCalculator, makeEl, readCalculatorSource, CALC_PATH, API_NAMES };
