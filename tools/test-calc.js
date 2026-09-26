#!/usr/bin/env node
/*
 * city-salary 计算回归测试
 *
 * 直接从 skills/city-salary/assets/calculator.html 抽取真实 <script> 执行，
 * 在最小 DOM 桩上跑断言——测的是真正会跑到用户浏览器里的那份代码，
 * 而不是测试里重写一遍的副本。
 *
 * 运行：node tools/test-calc.js
 * 退出码：0 = 全部通过，1 = 有失败（可直接接 CI）
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CALC = path.join(__dirname, '..', 'skills', 'city-salary', 'assets', 'calculator.html');
const html = fs.readFileSync(CALC, 'utf8');

/* ---------- 最小 DOM 桩 ---------- */
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

function loadCalculator() {
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('calculator.html 中找不到 <script> 块');
  const els = new Map();
  const document = {
    getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    createElement: () => makeEl('_new'),
    head: { appendChild() {} },
    querySelectorAll: () => [],
  };
  const window = { print() {} };
  const api = new Function('document', 'window', 'console', 'setTimeout',
    m[1] + '\n;return {tx,btx,TRAPS,BR,BBR,CITIES,CLAMP:cl,normHF,calc,selectCity,setHk,setMed,' +
    'buildHistory,calcHist,switchTab,histRows:function(){return histRows},els:function(){return null}};'
  )(document, window, console, setTimeout);
  api._doc = document;
  api._set = (k, v) => { document.getElementById(k).value = v; };
  api._setMany = (o) => { for (const k in o) document.getElementById(k).value = o[k]; };
  api._check = (k, v) => { document.getElementById(k).checked = v; };
  api._text = (k) => document.getElementById(k).textContent;
  api._html = (k) => document.getElementById(k).innerHTML;
  /* 按 id 从渲染结果里取数字。只依赖 id（稳定契约），不依赖内联样式；
     桩不做 DOM 解析，所以从 HTML 字符串里定位——找不到就抛出带 id 的明确错误，
     而不是像过去那样返回 null 让断言以"实际=null"的形式含糊失败。 */
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

/* ---------- 断言 ---------- */
let pass = 0, fail = 0;
const failures = [];
function ok(name, actual, expected, tol) {
  tol = tol === undefined ? 0.005 : tol;
  const good = (typeof expected === 'number')
    ? Math.abs(actual - expected) <= tol
    : actual === expected;
  if (good) { pass++; }
  else { fail++; failures.push(`${name}\n      实际=${actual}  期望=${expected}`); }
}
function eq(name, actual, expected) { ok(name, actual, expected); }
function section(t) { console.log('\n' + t); }

const A = loadCalculator();
const fmt = n => Number(n).toFixed(2);

/* =========================================================
   1. 个税累计预扣预缴税率表 —— 对照官方七级预扣率表
   ========================================================= */
section('1. 个税累计预扣预缴税率表');
const OFFICIAL_CUM = [
  [36000, 0.03, 0], [144000, 0.10, 2520], [300000, 0.20, 16920],
  [420000, 0.25, 31920], [660000, 0.30, 52920], [960000, 0.35, 85920],
  [Infinity, 0.45, 181920],
];
const officialTx = (t) => {
  if (t <= 0) return 0;
  for (const [cap, r, d] of OFFICIAL_CUM) if (t <= cap) return t * r - d;
  return t * 0.45 - 181920;
};
[0, 1, 35999, 36000, 36001, 143999, 144000, 144001, 299999, 300000, 419999,
 420000, 420001, 659999, 660000, 660001, 959999, 960000, 960001, 1e6, 5e6]
  .forEach(t => ok(`应纳税所得额 ${t} 的税额`, A.tx(t).t, Math.max(0, officialTx(t))));

/* =========================================================
   2. 年终奖单独计税 + 六个临界值陷阱
   ========================================================= */
section('2. 年终奖单独计税与临界值陷阱');
const OFFICIAL_BONUS = [
  [3000, 0.03, 0], [12000, 0.10, 210], [25000, 0.20, 1410],
  [35000, 0.25, 2660], [55000, 0.30, 4410], [80000, 0.35, 7160],
  [Infinity, 0.45, 15160],
];
const officialBonusTax = (b) => {
  if (b <= 0) return 0;
  const mo = b / 12;
  for (const [cap, r, d] of OFFICIAL_BONUS) if (mo <= cap) return b * r - d;
  return b * 0.45 - 15160;
};
[0, 1, 35999, 36000, 36001, 144000, 144001, 300000, 300001, 420000, 420001,
 660000, 660001, 960000, 960001, 2e6]
  .forEach(b => ok(`年终奖 ${b} 的税额`, A.btx(b).t, Math.max(0, officialBonusTax(b))));

/* 六个临界点"多1元少拿"金额必须精确 */
const TRAP_EXPECT = [
  [36000, 2309.10], [144000, 13199.20], [300000, 13749.25],
  [420000, 19249.30], [660000, 30249.35], [960000, 87999.45],
];
TRAP_EXPECT.forEach(([pt, loss], i) => {
  ok(`临界点 ${pt} 的少拿金额`, A.TRAPS[i][1], loss, 0.005);
  const real = (pt - officialBonusTax(pt)) - ((pt + 1) - officialBonusTax(pt + 1));
  ok(`临界点 ${pt} 独立复算`, A.TRAPS[i][1], real, 0.005);
});

/* =========================================================
   3. 端到端算例（每个城市都用独立手算的结果比对）
   ========================================================= */
section('3. 端到端算例');

function runCase(city, opt) {
  A.selectCity(city);
  A._check('childOn', false); A._check('eduOn', false); A._check('houseOn', false);
  A._check('elderlyOn', false); A._check('medicalOn', false); A._check('ltcOn', false);
  A._setMany(Object.assign({
    salary: 20000, month: 7, startMonth: 1, bonus: 0,
    pBase: 10000, mBase: 10000, uBase: 10000, mtBase: 10000, ijBase: 10000, hfBase: 10000,
    hfRate: 5, healthIns: 0, persPen: 0, annuity: 0,
    childAmt: 0, eduAmt: 0, houseAmt: 0, elderlyAmt: 0, medicalAmt: 0,
  }, opt || {}));
  A.calc();
  return {
    si: A._num('resSI'),
    tax: A._num('resTax'),
    net: A._num('resNet'),
    hf: A._num('resHF'),
  };
}

/* 3.1 深圳：README 示例（月薪7500、基数6750、公积金5%、非独生赡养老人1500） */
(function szCase() {
  const r = runCase('sz', { salary: 7500, pBase: 6750, mBase: 6750, uBase: 6750, mtBase: 6750, ijBase: 6750, hfBase: 6750, hfRate: 5 });
  A._check('elderlyOn', true); A._set('elderlyAmt', 1500); A.calc();
  const si = 6750 * (0.08 + 0.02 + 0.002);
  const hf = 6750 * 0.05;
  const mDed = si + hf + 5000 + 1500;
  const mW = 7;
  const cumTx = Math.max(0, 7500 * mW - mDed * mW);
  const tax = Math.max(0, Math.max(0, officialTx(cumTx)) - Math.max(0, officialTx(Math.max(0, 7500 * (mW - 1) - mDed * (mW - 1)))));
  const net = 7500 - si - hf - tax;
  const got = { si: A._num('resSI'), tax: A._num('resTax'), net: A._num('resNet') };
  console.log(`  深圳 7500/基数6750/公积金5%/赡养老人1500`);
  console.log(`    个人社保 ${fmt(got.si)}  (手算 ${fmt(si)})`);
  console.log(`    当月个税 ${fmt(got.tax)}  (手算 ${fmt(tax)})`);
  console.log(`    税后实发 ${fmt(got.net)}  (手算 ${fmt(net)})`);
  ok('深圳·个人社保', got.si, si);
  ok('深圳·当月个税', got.tax, tax);
  ok('深圳·税后实发', got.net, net);
})();

/* 3.2 北京：2026年度，月薪20000、基数20000、公积金12%、赡养老人1500 */
(function bjCase() {
  runCase('bj', { salary: 20000, pBase: 20000, mBase: 20000, uBase: 20000, mtBase: 20000, ijBase: 20000, hfBase: 20000, hfRate: 12 });
  A._check('elderlyOn', true); A._set('elderlyAmt', 1500); A.calc();
  const pE = 20000 * 0.08, mE = 20000 * 0.02 + 3, uE = 20000 * 0.005;
  const si = pE + mE + uE, hf = 20000 * 0.12;
  const mDed = si + hf + 5000 + 1500, mW = 7;
  const cum = (n) => Math.max(0, Math.max(0, officialTx(Math.max(0, 20000 * n - mDed * n))));
  const tax = cum(mW) - cum(mW - 1), net = 20000 - si - hf - tax;
  const got = { si: A._num('resSI'), tax: A._num('resTax'), net: A._num('resNet') };
  console.log(`  北京 20000/基数20000/公积金12%/赡养老人1500（医保个人含大额互助3元）`);
  console.log(`    个人社保 ${fmt(got.si)}  (手算 ${fmt(si)}，其中医保 ${fmt(mE)}=400+3)`);
  console.log(`    当月个税 ${fmt(got.tax)}  (手算 ${fmt(tax)})`);
  console.log(`    税后实发 ${fmt(got.net)}  (手算 ${fmt(net)})`);
  ok('北京·个人社保(含3元大额互助)', got.si, si);
  ok('北京·当月个税', got.tax, tax);
  ok('北京·税后实发', got.net, net);
})();

/* 3.3 上海：2026年度，月薪30000、基数30000、公积金7% */
(function shCase() {
  runCase('sh', { salary: 30000, pBase: 30000, mBase: 30000, uBase: 30000, mtBase: 30000, ijBase: 30000, hfBase: 30000, hfRate: 7 });
  const si = 30000 * (0.08 + 0.02 + 0.005), hf = 30000 * 0.07;
  const mDed = si + hf + 5000, mW = 7;
  const cum = (n) => Math.max(0, Math.max(0, officialTx(Math.max(0, 30000 * n - mDed * n))));
  const tax = cum(mW) - cum(mW - 1), net = 30000 - si - hf - tax;
  const got = { si: A._num('resSI'), tax: A._num('resTax'), net: A._num('resNet') };
  console.log(`  上海 30000/基数30000/公积金7%（无专项附加）`);
  console.log(`    个人社保 ${fmt(got.si)}  (手算 ${fmt(si)})`);
  console.log(`    当月个税 ${fmt(got.tax)}  (手算 ${fmt(tax)})`);
  console.log(`    税后实发 ${fmt(got.net)}  (手算 ${fmt(net)})`);
  ok('上海·个人社保', got.si, si);
  ok('上海·当月个税', got.tax, tax);
  ok('上海·税后实发', got.net, net);
})();

/* 3.4 成都：2026年度，月薪20000、基数20000、公积金12%、赡养老人1500 */
(function cdCase() {
  runCase('cd', { salary: 20000, pBase: 20000, mBase: 20000, uBase: 20000, mtBase: 20000, ijBase: 20000, hfBase: 20000, hfRate: 12 });
  A._check('elderlyOn', true); A._set('elderlyAmt', 1500); A.calc();
  const pE = 20000 * 0.08, mE = 20000 * 0.02, uE = 20000 * 0.004;
  const si = pE + mE + uE, hf = 20000 * 0.12;
  const mDed = si + hf + 5000 + 1500, mW = 7;
  const cum = (n) => Math.max(0, Math.max(0, officialTx(Math.max(0, 20000 * n - mDed * n))));
  const tax = cum(mW) - cum(mW - 1), net = 20000 - si - hf - tax;
  const got = { si: A._num('resSI'), tax: A._num('resTax'), net: A._num('resNet') };
  console.log(`  成都 20000/基数20000/公积金12%/赡养老人1500（四川失业个人0.4%）`);
  console.log(`    个人社保 ${fmt(got.si)}  (手算 ${fmt(si)}，其中失业 ${fmt(uE)})`);
  console.log(`    当月个税 ${fmt(got.tax)}  (手算 ${fmt(tax)})`);
  console.log(`    税后实发 ${fmt(got.net)}  (手算 ${fmt(net)})`);
  ok('成都·个人社保', got.si, si);
  ok('成都·当月个税', got.tax, tax);
  ok('成都·税后实发', got.net, net);
})();

/* =========================================================
   4. 基数夹取：各险种用各自的上下限
   ========================================================= */
section('4. 基数上下限夹取');
(function clampCase() {
  /* 广州 60000 → 养老27549 / 医疗31170 / 失业44265 */
  A.selectCity('gz');
  A._setMany({ salary: 60000, month: 12, startMonth: 1, pBase: 60000, mBase: 60000, uBase: 60000, hfBase: 60000 });
  A.calc();
  const rows = [A._num('ob0'), A._num('ob1'), A._num('ob2')];
  ok('广州·养老基数夹取到上限', rows[0], 27549);
  ok('广州·医疗基数夹取到上限', rows[1], 31170);
  ok('广州·失业基数夹取到上限', rows[2], 44265);
  console.log(`  广州 输入60000 → 养老${rows[0]} / 医疗${rows[1]} / 失业${rows[2]}`);

  /* 北京 输入低于下限 → 夹取到 7270；高于上限 → 36348 */
  A.selectCity('bj');
  A._setMany({ salary: 100000, pBase: 1000, mBase: 1000, uBase: 1000, hfBase: 100000, month: 12, startMonth: 1 });
  A.calc();
  const bjRows = [A._num('ob0'), A._num('ob1')];
  ok('北京·养老基数夹取到下限', bjRows[0], 7270);
  ok('北京·医疗基数夹取到下限', bjRows[1], 7270);
  console.log(`  北京 输入1000 → 养老${bjRows[0]} / 医疗${bjRows[1]}（下限7270）`);

  /* F4：北京医保个人含 3 元大额互助，明细行须标注，否则"2%×基数≠金额"看起来像算错 */
  const medRowLabel = A._html('res').match(/grid4r"><span style="color:#6b7280">([^<]+)<\/span><span id="ob1"/);
  ok('北京·医疗行标注"含3元互助"', medRowLabel ? medRowLabel[1] : null, '医疗保险(含3元互助)');
  console.log(`  北京·医疗行险种名：「${medRowLabel ? medRowLabel[1] : '未找到'}」`);

  /* F5：生育并入医保的城市应隐藏生育基数输入行 */
  ok('北京·生育基数行已隐藏', A._style('mtRow'), 'none');
  A.selectCity('sz');  /* 深圳单独缴生育险，应显示 */
  ok('深圳·生育基数行可见', A._style('mtRow'), '');
  A.selectCity('bj');

  /* 上海 输入低于下限 → 7546 */
  A.selectCity('sh');
  A._setMany({ salary: 100000, pBase: 100, mBase: 100, uBase: 100, hfBase: 100, month: 12, startMonth: 1 });
  A.calc();
  const shRows = [A._num('ob0')];
  ok('上海·养老基数夹取到下限', shRows[0], 7546);
  console.log(`  上海 输入100 → 养老${shRows[0]}（下限7546）`);

  /* 公积金基数用另一套区间：北京 2540~36348、上海 2740~37731 */
  A.selectCity('bj'); A._setMany({ hfBase: 100, salary: 20000 }); A.calc();
  ok('北京·公积金基数夹取到下限', A.CLAMP(100, A.CITIES.bj.hf.min, A.CITIES.bj.hf.max), 2540);
  A.selectCity('sh'); A._setMany({ hfBase: 999999, salary: 20000 }); A.calc();
  ok('上海·公积金基数夹取到上限', A.CLAMP(999999, A.CITIES.sh.hf.min, A.CITIES.sh.hf.max), 37731);
})();

/* =========================================================
   5. 公积金比例区间：广东 5-12%，上海 5-7%
   ========================================================= */
section('5. 公积金比例区间');
ok('广东·normHF(12) = 12', A.normHF(12, 12), 12);
ok('上海·normHF(12,7) = 7', A.normHF(12, 7), 7);
ok('上海·normHF(5,7) = 5', A.normHF(5, 7), 5);
ok('上海·normHF(3,7) = 0（1-4非法归0）', A.normHF(3, 7), 0);
ok('上海·normHF(0,7) = 0', A.normHF(0, 7), 0);
eq('上海·hfRateMax = 7', A.CITIES.sh.hfRateMax, 7);
eq('深圳·hfRateMax = 12', A.CITIES.sz.hfRateMax, 12);
ok('上海·输入12%被归一到7%',
  (function () { A.selectCity('sh'); A._setMany({ hfRate: 12, salary: 20000, hfBase: 20000 }); A.calc(); return parseFloat(A._doc.getElementById('hfRate').value); })(), 7);

/* =========================================================
   6. D1 回归：大病医疗必须只进年度汇算，不进月度预扣
   ========================================================= */
section('6. D1 大病医疗只进年度汇算');
(function medicalCase() {
  A.selectCity('sz');
  /* 基数取 27000：低于深圳养老上限 27549，避免夹取干扰独立复算 */
  A._setMany({ salary: 40000, month: 7, startMonth: 1, pBase: 27000, mBase: 27000, uBase: 27000, mtBase: 27000, ijBase: 27000, hfBase: 27000, hfRate: 5, bonus: 0, healthIns: 0, persPen: 0, annuity: 0 });
  A._check('medicalOn', false); A._check('childOn', false); A._check('eduOn', false);
  A._check('houseOn', false); A._check('elderlyOn', false);
  A.calc();
  const taxBefore = A._num('resTax');
  const annualBefore = A._num('resATax');

  A._check('medicalOn', true); A._set('medicalAmt', 6667); A.calc();
  const taxAfter = A._num('resTax');
  const annualAfter = A._num('resATax');
  const spTotText = A._text('spTot');

  ok('填入大病医疗后当月个税不变', taxAfter, taxBefore);
  ok('大病医疗未计入月度专项附加合计', /^0\.00 元\/月/.test(spTotText) || spTotText.indexOf('0.00 元/月') === 0, true);
  ok('提示文案说明仅年度汇算扣除', spTotText.indexOf('仅年度汇算扣除') > -1, true);
  ok('年度税因大病医疗而下降', annualAfter < annualBefore, true);
  ok('年度预估段带口径说明', /口径说明/.test(A._html('res')), true);
  console.log(`  大病医疗 6667 填入前后当月个税：${fmt(taxBefore)} → ${fmt(taxAfter)}（应相等）`);
  console.log(`  年度预估税：${fmt(annualBefore)} → ${fmt(annualAfter)}（降 ${fmt(annualBefore - annualAfter)}）`);

  /* F8 回归：年度大病医疗 = min(月均×12, 80000)，不随就业月数折算。
     1月入职时 aM=12，"×12"与"×aM"结果相同（仅差封顶4元），所以真正的判别用例是年中入职。 */
  const siE0 = 27000 * (0.08 + 0.02 + 0.002), hfE0 = 27000 * 0.05;
  const mDed0 = siE0 + hfE0 + 5000;
  const medAnnual = Math.min(6667 * 12, 80000);
  ok('年度大病医疗封顶 80000（6667×12=80004）', medAnnual, 80000);
  ok('1月入职：年度税 = 独立复算（扣全年80000）',
    annualAfter, Math.max(0, officialTx(Math.max(0, 40000 * 12 - mDed0 * 12 - medAnnual))), 0.02);

  /* 7月入职（就业6个月）：若错误地按就业月数折算，扣除只有40002，年度税会偏高 */
  A._setMany({ startMonth: 7, month: 12 });
  A.calc();
  const aM6 = 6;
  const expect6 = Math.max(0, officialTx(Math.max(0, 40000 * aM6 - mDed0 * aM6 - medAnnual)));
  const wrong6 = Math.max(0, officialTx(Math.max(0, 40000 * aM6 - mDed0 * aM6 - 6667 * aM6)));
  ok('7月入职：大病医疗仍按全年80000扣（不随就业月数折算）', A._num('resATax'), expect6, 0.02);
  ok('7月入职：与"按就业月数折算"的错误结果确有差异', Math.abs(expect6 - wrong6) > 1, true);
  console.log(`  7月入职：正确年度税=${fmt(expect6)}，若按就业月数折算会得到=${fmt(wrong6)}（差 ${fmt(wrong6 - expect6)}）`);
})();

/* =========================================================
   7. D2 回归：补充扣除既减税、也从实发中扣出现金
   ========================================================= */
section('7. D2 补充扣除的现金流');
(function suppCase() {
  A.selectCity('bj');
  A._setMany({ salary: 30000, month: 7, startMonth: 1, pBase: 30000, mBase: 30000, uBase: 30000, mtBase: 30000, ijBase: 30000, hfBase: 30000, hfRate: 12, healthIns: 0, persPen: 0, annuity: 0 });
  A._check('medicalOn', false); A.calc();
  const net0 = A._num('resNet');
  const tax0 = A._num('resTax');

  /* 个人养老金 1000 + 税优健康险 200 + 企业年金 4%（按养老缴费基数30000 → 1200） */
  A._setMany({ persPen: 1000, healthIns: 200, annuity: 4 });
  A.calc();
  const net1 = A._num('resNet');
  const tax1 = A._num('resTax');

  /* 企业年金按"缴费工资基数"（此处取养老缴费基数30000）而非月薪 */
  const anAmt = 30000 * 0.04, cash = 1000 + 200 + anAmt;
  console.log(`  实发：${fmt(net0)} → ${fmt(net1)}（少了 ${fmt(net0 - net1)}）`);
  console.log(`  当月个税：${fmt(tax0)} → ${fmt(tax1)}（省了 ${fmt(tax0 - tax1)}）`);
  console.log(`  现金流出 个人养老金1000 + 税优险200 + 年金${fmt(anAmt)} = ${fmt(cash)}`);
  /* 恒等式：实发减少额 = 现金流出 − 少缴的税 */
  ok('实发减少额 = 现金流出 − 少缴的税', net0 - net1, cash - (tax0 - tax1));
  ok('补充扣除确实减少了应纳税额（税率>0）', tax0 - tax1 > 0, true);
  ok('实发确实下降了', net0 > net1, true);

  /* 企业年金基数：月薪30000但养老基数设6000时，年金应按6000计 */
  A.selectCity('bj');
  A._setMany({ salary: 30000, pBase: 7270, mBase: 30000, uBase: 30000, mtBase: 30000, ijBase: 30000, hfBase: 30000, hfRate: 12, persPen: 0, healthIns: 0, annuity: 4 });
  A.calc();
  const hasAnnuityLine = A._html('res').indexOf('企业年金(个人4%)') > -1;
  ok('企业年金按缴费工资基数(7270×4%=290.8)而非月薪', hasAnnuityLine, true);
  const anLine = A._html('res').match(/企业年金\(个人4%\)<\/label><span class="v" style="color:#0d9488">([\d,.]+)/);
  /* 年度预估按 12-startMonth+1 = 12 个月计 */
  ok('企业年金年度金额 = 7270×4%×12个月', anLine ? parseFloat(anLine[1].replace(/,/g, '')) : null, (7270 * 0.04) * 12, 0.02);
})();

/* =========================================================
   8. 新增城市数据结构完整性
   ========================================================= */
section('8. 城市数据结构');
const REQUIRED = ['name', 'region', 'dataYear', 'pension', 'med', 'unemp', 'mat', 'inj', 'hf', 'rent', 'hfRateMax', 'medFixEmp'];
Object.keys(A.CITIES).forEach(k => {
  const c = A.CITIES[k];
  REQUIRED.forEach(f => ok(`${c.name||k}.${f} 存在`, c[f] !== undefined, true));
  const keys = ['pension', 'med', 'unemp', 'inj'];
  keys.forEach(kk => {
    ok(`${c.name}.${kk}.min<=max`, c[kk].min <= c[kk].max, true);
  });
  ok(`${c.name}.hf.min<=max`, c.hf.min <= c.hf.max, true);
  ok(`${c.name}.hfRateMax 在 5~12`, c.hfRateMax >= 5 && c.hfRateMax <= 12, true);
});
eq('城市总数', Object.keys(A.CITIES).length, 273);
eq('北京存在', !!A.CITIES.bj, true);
eq('上海存在', !!A.CITIES.sh, true);
eq('成都存在', !!A.CITIES.cd, true);
eq('重庆存在', !!A.CITIES.cq, true);
eq('济南存在', !!A.CITIES.jn, true);
eq('沈阳存在', !!A.CITIES.sy, true);
eq('长春存在', !!A.CITIES.cc, true);
eq('哈尔滨存在', !!A.CITIES.heb, true);
eq('天津存在', !!A.CITIES.tj, true);
eq('南京存在', !!A.CITIES.nanj, true);
eq('杭州存在', !!A.CITIES.hangz, true);
eq('郑州存在', !!A.CITIES.zzheng, true);
eq('武汉存在', !!A.CITIES.wuha, true);
eq('长沙存在', !!A.CITIES.chsh, true);
eq('合肥存在', !!A.CITIES.hef, true);
eq('福州存在', !!A.CITIES.fz, true);
eq('南昌存在', !!A.CITIES.nanch, true);
eq('石家庄存在', !!A.CITIES.sjz, true);
eq('太原存在', !!A.CITIES.ty, true);
eq('西安存在', !!A.CITIES.xa, true);
eq('南宁存在', !!A.CITIES.nn, true);
eq('昆明存在', !!A.CITIES.km, true);
eq('贵阳存在', !!A.CITIES.guiy, true);
eq('山东菏泽未被覆盖', A.CITIES.hez.name, '菏泽');
eq('吉林白山未被覆盖', A.CITIES.bs.name, '白山');

/* 京沪参数关键值抽查（对照官方文件） */
eq('北京·养老下限(京人社发〔2026〕7号)', A.CITIES.bj.pension.min, 7270);
eq('北京·养老上限', A.CITIES.bj.pension.max, 36348);
eq('北京·医保单位费率9.8%', A.CITIES.bj.med.comp, 0.098);
eq('北京·医保个人费率2%', A.CITIES.bj.med.emp, 0.02);
eq('北京·大额医疗互助3元/月', A.CITIES.bj.medFixEmp, 3);
eq('北京·失业单位0.5%', A.CITIES.bj.unemp.comp, 0.005);
eq('北京·失业个人0.5%', A.CITIES.bj.unemp.emp, 0.005);
eq('北京·公积金下限2540', A.CITIES.bj.hf.min, 2540);
eq('北京·公积金上限36348', A.CITIES.bj.hf.max, 36348);
eq('北京·房租扣除1500', A.CITIES.bj.rent, 1500);
eq('上海·养老下限(2026-08-18公示)', A.CITIES.sh.pension.min, 7546);
eq('上海·养老上限', A.CITIES.sh.pension.max, 37731);
eq('上海·医保单位费率9%', A.CITIES.sh.med.comp, 0.09);
eq('上海·医保个人费率2%', A.CITIES.sh.med.emp, 0.02);
eq('上海·失业单位0.5%', A.CITIES.sh.unemp.comp, 0.005);
eq('上海·工伤0.2%起', A.CITIES.sh.inj.comp, 0.002);
eq('上海·公积金下限2740', A.CITIES.sh.hf.min, 2740);
eq('上海·公积金上限37731', A.CITIES.sh.hf.max, 37731);
eq('上海·公积金比例上限7%', A.CITIES.sh.hfRateMax, 7);
eq('上海·医保无固定附加', A.CITIES.sh.medFixEmp, 0);
eq('上海·房租扣除1500', A.CITIES.sh.rent, 1500);

/* 四川参数关键值抽查（对照官方文件） */
eq('成都·养老下限(川人社办发〔2026〕50号)', A.CITIES.cd.pension.min, 4699);
eq('成都·养老上限', A.CITIES.cd.pension.max, 23493);
eq('成都·医保单位费率8.3%', A.CITIES.cd.med.comp, 0.083);
eq('成都·医保个人费率2%', A.CITIES.cd.med.emp, 0.02);
eq('成都·医保基数下限4699', A.CITIES.cd.med.min, 4699);
eq('成都·公积金下限2330', A.CITIES.cd.hf.min, 2330);
eq('成都·公积金上限(成公积金委〔2026〕5号)', A.CITIES.cd.hf.max, 32969);
eq('成都·房租扣除1500', A.CITIES.cd.rent, 1500);
eq('四川·失业单位0.6%', A.CITIES.cd.unemp.comp, 0.006);
eq('四川·失业个人0.4%', A.CITIES.cd.unemp.emp, 0.004);
eq('四川·工伤一类0.24%', A.CITIES.cd.inj.comp, 0.0024);
eq('四川·公积金比例上限12%', A.CITIES.cd.hfRateMax, 12);

/* 生育并入医保的城市 mat.comp 应为 0，且医保单位费率含生育 */
eq('北京·生育并入医保(mat.comp=0)', A.CITIES.bj.mat.comp, 0);
eq('上海·生育并入医保(mat.comp=0)', A.CITIES.sh.mat.comp, 0);
eq('成都·生育并入医保(mat.comp=0)', A.CITIES.cd.mat.comp, 0);

/* 重庆 / 山东 / 辽宁 / 吉林 / 黑龙江 参数抽查（对照官方文件） */
eq('重庆·五险下限(全口径年平91059)', A.CITIES.cq.pension.min, 4553);
eq('重庆·五险上限', A.CITIES.cq.pension.max, 22765);
eq('重庆·医保单位8.5%(含生育0.5%)', A.CITIES.cq.med.comp, 0.085);
eq('重庆·医保个人2%', A.CITIES.cq.med.emp, 0.02);
eq('重庆·大额医疗互助5元/月', A.CITIES.cq.medFixEmp, 5);
eq('重庆·公积金下限2330', A.CITIES.cq.hf.min, 2330);
eq('重庆·公积金上限(渝公积金发〔2026〕51号)', A.CITIES.cq.hf.max, 31393);
eq('重庆·房租扣除1500', A.CITIES.cq.rent, 1500);
eq('山东·五险下限(鲁人社字〔2026〕75号)', A.CITIES.jn.pension.min, 4573);
eq('山东·五险上限', A.CITIES.jn.pension.max, 22863);
eq('山东·医保单位8%', A.CITIES.jn.med.comp, 0.08);
eq('山东·医保个人2%', A.CITIES.jn.med.emp, 0.02);
eq('山东·失业单位0.7%', A.CITIES.jn.unemp.comp, 0.007);
eq('山东·失业个人0.3%', A.CITIES.jn.unemp.emp, 0.003);
eq('山东·工伤现执行0.16%', A.CITIES.jn.inj.comp, 0.0016);
eq('济南·公积金下限2400', A.CITIES.jn.hf.min, 2400);
eq('济南·公积金上限(济住中字〔2026〕9号)', A.CITIES.jn.hf.max, 33902);
eq('济南·大额医疗10元/月', A.CITIES.jn.medFixEmp, 10);
eq('青岛·公积金上限(青住金发〔2026〕5号)', A.CITIES.qd.hf.max, 34342.75);
eq('青岛·大额医疗5元/月', A.CITIES.qd.medFixEmp, 5);
eq('菏泽·公积金上限(菏住金〔2026〕9号)', A.CITIES.hez.hf.max, 22671);
eq('辽宁·五险下限(辽人社〔2026〕19号)', A.CITIES.sy.pension.min, 4533);
eq('辽宁·五险上限', A.CITIES.sy.pension.max, 22665);
eq('辽宁·失业单位0.5%', A.CITIES.sy.unemp.comp, 0.005);
eq('辽宁·工伤一类0.2%', A.CITIES.sy.inj.comp, 0.002);
eq('沈阳·医保单位8.6%(含生育0.6%)', A.CITIES.sy.med.comp, 0.086);
eq('沈阳·公积金下限2230', A.CITIES.sy.hf.min, 2230);
eq('沈阳·公积金上限30657', A.CITIES.sy.hf.max, 30657);
eq('大连·医保单位9%(含生育)', A.CITIES.dl.med.comp, 0.09);
eq('大连·公积金上限(大房金发〔2026〕12号)', A.CITIES.dl.hf.max, 31929);
eq('本溪·公积金下限2100(中心专门文件)', A.CITIES.bx.hf.min, 2100);
eq('盘锦·公积金上限27591', A.CITIES.pj.hf.max, 27591);
eq('吉林·五险下限(吉人社联〔2025〕97号)', A.CITIES.cc.pension.min, 4393.2);
eq('吉林·五险上限', A.CITIES.cc.pension.max, 21966);
eq('吉林·失业单位0.7%', A.CITIES.cc.unemp.comp, 0.007);
eq('吉林·失业个人0.3%', A.CITIES.cc.unemp.emp, 0.003);
eq('长春·医保单位7.7%(含生育)', A.CITIES.cc.med.comp, 0.077);
eq('长春·公积金下限2230', A.CITIES.cc.hf.min, 2230);
eq('长春·公积金上限30505', A.CITIES.cc.hf.max, 30505);
eq('吉林市·公积金上限22734.75', A.CITIES.jl.hf.max, 22734.75);
eq('黑龙江·五险下限(黑人社函〔2024〕548号)', A.CITIES.heb.pension.min, 4542);
eq('黑龙江·五险上限', A.CITIES.heb.pension.max, 22710);
eq('黑龙江·失业单位0.5%', A.CITIES.heb.unemp.comp, 0.005);
eq('黑龙江·工伤一类0.2%', A.CITIES.heb.inj.comp, 0.002);
eq('哈尔滨·医保单位8.1%(含生育0.6%)', A.CITIES.heb.med.comp, 0.081);
eq('哈尔滨·公积金下限2270', A.CITIES.heb.hf.min, 2270);
eq('哈尔滨·公积金上限28430', A.CITIES.heb.hf.max, 28430);
eq('大庆·公积金上限32701', A.CITIES.dq.hf.max, 32701);
eq('重庆/山东/辽宁/吉林/黑龙江·生育并入医保(mat.comp=0)', A.CITIES.cq.mat.comp + A.CITIES.jn.mat.comp + A.CITIES.sy.mat.comp + A.CITIES.cc.mat.comp + A.CITIES.heb.mat.comp, 0);

/* 天津 / 江苏 / 浙江 参数抽查（对照官方文件） */
eq('天津·五险下限(津人社局发〔2026〕5号)', A.CITIES.tj.pension.min, 5180);
eq('天津·五险上限', A.CITIES.tj.pension.max, 25902);
eq('天津·医保单位10.5%(含生育)', A.CITIES.tj.med.comp, 0.105);
eq('天津·医保个人2%', A.CITIES.tj.med.emp, 0.02);
eq('天津·大额医疗救助260元/年≈21.67元/月', A.CITIES.tj.medFixEmp, 21.67);
eq('天津·公积金下限2510', A.CITIES.tj.hf.min, 2510);
eq('天津·公积金上限(津公积金委〔2026〕3号)', A.CITIES.tj.hf.max, 28917);
eq('天津·房租扣除1500', A.CITIES.tj.rent, 1500);
eq('江苏·五险下限(苏人社发〔2025〕33号)', A.CITIES.nanj.pension.min, 4952);
eq('江苏·五险上限', A.CITIES.nanj.pension.max, 24762);
eq('江苏·失业单位0.5%', A.CITIES.nanj.unemp.comp, 0.005);
eq('江苏·工伤一类0.2%', A.CITIES.nanj.inj.comp, 0.002);
eq('南京·医保单位7.8%(含生育)', A.CITIES.nanj.med.comp, 0.078);
eq('南京·大病救助10元/月(个人)', A.CITIES.nanj.medFixEmp, 10);
eq('南京·公积金下限2660', A.CITIES.nanj.hf.min, 2660);
eq('南京·公积金上限42400', A.CITIES.nanj.hf.max, 42400);
eq('苏州·公积金上限40600', A.CITIES.su.hf.max, 40600);
eq('徐州·个人固定额=大病6元+长护险70元/年≈11.83', A.CITIES.xz.medFixEmp, 11.83);
eq('宿迁·公积金下限2010', A.CITIES.sq.hf.min, 2010);
eq('浙江·五险下限(浙人社发〔2025〕52号)', A.CITIES.hangz.pension.min, 4986);
eq('浙江·五险上限', A.CITIES.hangz.pension.max, 25299);
eq('杭州·医保单位9.5%(含生育0.6%)', A.CITIES.hangz.med.comp, 0.095);
eq('杭州·公积金上限42151', A.CITIES.hangz.hf.max, 42151);
eq('宁波·公积金上限38947', A.CITIES.nb.hf.max, 38947);
eq('宁波·医保单位8.5%(含大病0.5%+生育0.5%)', A.CITIES.nb.med.comp, 0.085);
eq('绍兴·医保个人1%(其他单位口径)', A.CITIES.sx.med.emp, 0.01);
eq('台州·医保个人1%', A.CITIES.taiz.med.emp, 0.01);
eq('衢州·公积金上限37530', A.CITIES.qz.hf.max, 37530);
eq('丽水·公积金上限暂用2025年度36405', A.CITIES.lish.hf.max, 36405);
eq('天津/江苏/浙江·生育并入医保(mat.comp=0)', A.CITIES.tj.mat.comp + A.CITIES.nanj.mat.comp + A.CITIES.hangz.mat.comp, 0);

/* 河南 / 湖北 / 湖南 / 安徽 / 福建 / 江西 参数抽查（对照官方文件） */
eq('河南·基数下限(豫人社办〔2025〕67号)', A.CITIES.zzheng.pension.min, 3831);
eq('河南·基数上限', A.CITIES.zzheng.pension.max, 19155);
eq('河南·失业单位0.7%', A.CITIES.zzheng.unemp.comp, 0.007);
eq('河南·工伤一类0.2%', A.CITIES.zzheng.inj.comp, 0.002);
eq('郑州·医保单位8%', A.CITIES.zzheng.med.comp, 0.08);
eq('郑州·大额补助130元/年≈10.83元/月', A.CITIES.zzheng.medFixEmp, 10.83);
eq('郑州·公积金下限2350', A.CITIES.zzheng.hf.min, 2350);
eq('郑州·公积金上限(郑公积金〔2026〕18号)', A.CITIES.zzheng.hf.max, 28849);
eq('郑州·房租扣除1500', A.CITIES.zzheng.rent, 1500);
eq('洛阳·医保单位7.5%(含生育)', A.CITIES.luoy.med.comp, 0.075);
eq('商丘·医保单位6%', A.CITIES.sqiu.med.comp, 0.06);
eq('南阳·公积金上限18553.5', A.CITIES.ny.hf.max, 18553.5);
eq('湖北·第1档武汉下限(鄂人社发〔2025〕28号)', A.CITIES.wuha.pension.min, 4498);
eq('湖北·第1档武汉上限', A.CITIES.wuha.pension.max, 22488);
eq('湖北·第2档十堰下限', A.CITIES.shiy.pension.min, 4299);
eq('湖北·第2档十堰上限', A.CITIES.shiy.pension.max, 21678);
eq('湖北·第3档荆州下限', A.CITIES.jzh.pension.min, 4254);
eq('湖北·第3档荆州上限', A.CITIES.jzh.pension.max, 21462);
eq('武汉·医保单位8.7%(含生育0.7%)', A.CITIES.wuha.med.comp, 0.087);
eq('武汉·大额7元/月', A.CITIES.wuha.medFixEmp, 7);
eq('武汉·公积金上限36072.25', A.CITIES.wuha.hf.max, 36072.25);
eq('鄂州·医保单位9.3%(含生育0.8%)', A.CITIES.ez.med.comp, 0.093);
eq('荆门·个人固定额=大额15+长护3=18', A.CITIES.jmen.medFixEmp, 18);
eq('湖南·基数下限(湘人社规〔2026〕14号)', A.CITIES.chsh.pension.min, 4106);
eq('湖南·基数上限', A.CITIES.chsh.pension.max, 20529);
eq('湖南·工伤一类0.6%', A.CITIES.chsh.inj.comp, 0.006);
eq('湖南·医保单位8.7%(含生育0.7%)', A.CITIES.chsh.med.comp, 0.087);
eq('湖南·大病15元/月', A.CITIES.chsh.medFixEmp, 15);
eq('长沙·公积金下限2200', A.CITIES.chsh.hf.min, 2200);
eq('长沙·公积金上限32744', A.CITIES.chsh.hf.max, 32744);
eq('怀化·公积金上限22317', A.CITIES.huaih.hf.max, 22317);
eq('安徽·基数下限(皖人社秘〔2026〕113号)', A.CITIES.hef.pension.min, 4354);
eq('安徽·基数上限', A.CITIES.hef.pension.max, 21772);
eq('安徽·失业单位0.5%', A.CITIES.hef.unemp.comp, 0.005);
eq('合肥·医保单位6.4%', A.CITIES.hef.med.comp, 0.064);
eq('合肥·医疗救助个人不缴', A.CITIES.hef.medFixEmp, 0);
eq('合肥·公积金下限2320', A.CITIES.hef.hf.min, 2320);
eq('合肥·公积金上限30540', A.CITIES.hef.hf.max, 30540);
eq('芜湖·医疗救助40元/月', A.CITIES.wuhu.medFixEmp, 40);
eq('黄山·房租扣除800', A.CITIES.huangs.rent, 800);
eq('宿州·公积金下限1930', A.CITIES.suzh.hf.min, 1930);
eq('福建·养老基数下限(闽人社文〔2025〕45号)', A.CITIES.fz.pension.min, 4043);
eq('福建·养老基数上限', A.CITIES.fz.pension.max, 22607);
eq('福建·医保基数下限(闽医保函〔2026〕65号)', A.CITIES.fz.med.min, 4579);
eq('福建·医保基数上限', A.CITIES.fz.med.max, 22893);
eq('福建·失业基数上限22164', A.CITIES.fz.unemp.max, 22164);
eq('福州·医保单位8%', A.CITIES.fz.med.comp, 0.08);
eq('福州·公积金上限(榕公积金管委〔2026〕2号)', A.CITIES.fz.hf.max, 32430);
eq('厦门·大病7元/月', A.CITIES.xm.medFixEmp, 7);
eq('厦门·房租扣除1500', A.CITIES.xm.rent, 1500);
eq('龙岩·医保单位8.7%(含生育0.7%)', A.CITIES.longy.med.comp, 0.087);
eq('江西·基数下限(赣人社字〔2025〕150号)', A.CITIES.nanch.pension.min, 3915);
eq('江西·基数上限', A.CITIES.nanch.pension.max, 19575);
eq('江西·失业单位0.5%', A.CITIES.nanch.unemp.comp, 0.005);
eq('南昌·医保单位6.8%(含生育0.8%)', A.CITIES.nanch.med.comp, 0.068);
eq('南昌·公积金上限30165', A.CITIES.nanch.hf.max, 30165);
eq('九江·医保基数上限19590', A.CITIES.jj.med.max, 19590);
eq('上饶·医保基数上限18684', A.CITIES.sr.med.max, 18684);
eq('新余·公积金下限3920', A.CITIES.xinyu.hf.min, 3920);
eq('河南/湖北/湖南/安徽/福建/江西·生育并入医保(mat.comp=0)', A.CITIES.zzheng.mat.comp + A.CITIES.wuha.mat.comp + A.CITIES.chsh.mat.comp + A.CITIES.hef.mat.comp + A.CITIES.fz.mat.comp + A.CITIES.nanch.mat.comp, 0);

/* 住房租金专项附加扣除档位抽查（国发〔2018〕41号第十七条；总局指引名单 + 统计年鉴市辖区户籍人口） */
eq('郑州·租金1500（省会）', A.CITIES.zzheng.rent, 1500);
eq('洛阳·租金1100（市区户籍202.97万）', A.CITIES.luoy.rent, 1100);
eq('鹤壁·租金800（总局名单）', A.CITIES.hbi.rent, 800);
eq('武汉·租金1500（省会）', A.CITIES.wuha.rent, 1500);
eq('荆州·租金1100（城区户籍112.18万）', A.CITIES.jzh.rent, 1100);
eq('黄石·租金800（总局名单）', A.CITIES.hs.rent, 800);
eq('长沙·租金1500（省会）', A.CITIES.chsh.rent, 1500);
eq('株洲·租金800（总局名单）', A.CITIES.zhuz.rent, 800);
eq('合肥·租金1500（省会）', A.CITIES.hef.rent, 1500);
eq('马鞍山·租金800（市辖区户籍82.52万）', A.CITIES.mas.rent, 800);
eq('阜阳·租金1100（市辖区户籍226.38万）', A.CITIES.fuy.rent, 1100);
eq('阜阳·公积金上限23817（阜公积金〔2026〕40号）', A.CITIES.fuy.hf.max, 23817);
eq('福州·租金1500（省会）', A.CITIES.fz.rent, 1500);
eq('泉州·租金1100（市辖区户籍112.45万）', A.CITIES.quanz.rent, 1100);
eq('三明·租金800（市辖区户籍28.10万）', A.CITIES.sm.rent, 800);
eq('南昌·租金1500（省会）', A.CITIES.nanch.rent, 1500);
eq('赣州·租金1100（总局名单）', A.CITIES.ganzh.rent, 1100);
eq('景德镇·租金800（总局名单）', A.CITIES.jdz.rent, 800);
eq('三门峡·大额220元/年≈18.33元/月', A.CITIES.smx.medFixEmp, 18.33);
eq('商丘·大额150元/年=12.5元/月', A.CITIES.sqiu.medFixEmp, 12.5);
eq('南阳·大额按0.6%口径≈19.16元/月', A.CITIES.ny.medFixEmp, 19.16);

/* 河北 / 山西 / 陕西 / 广西 / 云南 / 贵州 参数抽查（对照官方文件） */
eq('河北·基数下限(冀人社字〔2026〕57号)', A.CITIES.sjz.pension.min, 4076);
eq('河北·基数上限', A.CITIES.sjz.pension.max, 20382);
eq('河北·失业单位0.7%', A.CITIES.sjz.unemp.comp, 0.007);
eq('河北·工伤一类0.2%', A.CITIES.sjz.inj.comp, 0.002);
eq('石家庄·医保单位7.5%', A.CITIES.sjz.med.comp, 0.075);
eq('石家庄·公积金下限2380', A.CITIES.sjz.hf.min, 2380);
eq('石家庄·公积金上限(石公积金〔2026〕10号)', A.CITIES.sjz.hf.max, 27938);
eq('石家庄·租金1500', A.CITIES.sjz.rent, 1500);
eq('唐山·公积金上限25635', A.CITIES.ts.hf.max, 25635);
eq('廊坊·公积金上限30261', A.CITIES.lf.hf.max, 30261);
eq('承德·租金800（市辖区73.59万）', A.CITIES.chengd.rent, 800);
eq('沧州·租金800', A.CITIES.cangz.rent, 800);
eq('山西·基数下限(晋人社厅发〔2026〕27号)', A.CITIES.ty.pension.min, 4244);
eq('山西·基数上限', A.CITIES.ty.pension.max, 21219);
eq('山西·工伤一类0.23%', A.CITIES.ty.inj.comp, 0.0023);
eq('太原·医保单位8%', A.CITIES.ty.med.comp, 0.08);
eq('太原·大额6元/月', A.CITIES.ty.medFixEmp, 6);
eq('太原·公积金上限(并公积金〔2026〕14号)', A.CITIES.ty.hf.max, 29100);
eq('太原·租金1500', A.CITIES.ty.rent, 1500);
eq('大同·租金1100（市辖区约170万）', A.CITIES.dt.rent, 1100);
eq('阳泉·租金800', A.CITIES.yq.rent, 800);
eq('陕西·基数下限(陕人社函〔2026〕326号)', A.CITIES.xa.pension.min, 4737);
eq('陕西·基数上限', A.CITIES.xa.pension.max, 23685);
eq('西安·医保单位8%', A.CITIES.xa.med.comp, 0.08);
eq('西安·大额个人1.6元/月（8元×20%）', A.CITIES.xa.medFixEmp, 1.6);
eq('西安·公积金上限(西房金管发〔2026〕1号)', A.CITIES.xa.hf.max, 32726);
eq('西安·租金1500', A.CITIES.xa.rent, 1500);
eq('宝鸡·医保单位6.6%', A.CITIES.baoj.med.comp, 0.066);
eq('咸阳·租金800（争议已标注）', A.CITIES.xy.rent, 800);
eq('广西·基数下限(桂人社发〔2026〕32号)', A.CITIES.nn.pension.min, 4204.8);
eq('广西·基数上限', A.CITIES.nn.pension.max, 21024);
eq('广西·失业单位0.5%', A.CITIES.nn.unemp.comp, 0.005);
eq('南宁·医保单位6.5%', A.CITIES.nn.med.comp, 0.065);
eq('南宁·公积金上限(南金规〔2025〕3号)', A.CITIES.nn.hf.max, 28020);
eq('南宁·租金1500', A.CITIES.nn.rent, 1500);
eq('柳州·医保单位8%', A.CITIES.liuz.med.comp, 0.08);
eq('柳州·租金1100（税务局12366）', A.CITIES.liuz.rent, 1100);
eq('梧州·租金800（税务局12366）', A.CITIES.wuz.rent, 800);
eq('桂林·大额个人3元/月', A.CITIES.gl.medFixEmp, 3);
eq('云南·基数下限(云人社发〔2026〕8号)', A.CITIES.km.pension.min, 4403);
eq('云南·基数上限', A.CITIES.km.pension.max, 22017);
eq('昆明·医保单位7.9%（含生育0.9%）', A.CITIES.km.med.comp, 0.079);
eq('昆明·大额1元/月', A.CITIES.km.medFixEmp, 1);
eq('昆明·公积金上限32470', A.CITIES.km.hf.max, 32470);
eq('昆明·租金1500', A.CITIES.km.rent, 1500);
eq('曲靖·租金1100（市辖区约140万）', A.CITIES.quj.rent, 1100);
eq('西双版纳·医保单位10%', A.CITIES.xsbn.med.comp, 0.1);
eq('迪庆·公积金上限40503', A.CITIES.diq.hf.max, 40503);
eq('贵州·基数下限(黔人社发〔2026〕7号)', A.CITIES.guiy.pension.min, 4426.05);
eq('贵州·基数上限', A.CITIES.guiy.pension.max, 22130.25);
eq('贵州·医保基数下限5901.4（80%口径）', A.CITIES.guiy.med.min, 5901.4);
eq('贵州·医保基数上限22130.25', A.CITIES.guiy.med.max, 22130.25);
eq('贵州·工伤一类0.4%', A.CITIES.guiy.inj.comp, 0.004);
eq('贵阳·医保单位8.5%', A.CITIES.guiy.med.comp, 0.085);
eq('贵阳·大额8元/月', A.CITIES.guiy.medFixEmp, 8);
eq('贵阳·公积金上限(2026年度)', A.CITIES.guiy.hf.max, 25980);
eq('贵阳·租金1500', A.CITIES.guiy.rent, 1500);
eq('遵义·租金1100（三区户籍约196.8万）', A.CITIES.zuny.rent, 1100);
eq('毕节·公积金上限21678.72', A.CITIES.bij.hf.max, 21678.72);
eq('铜仁·租金800', A.CITIES.trn.rent, 800);
eq('黔西南·大额30.5元/月', A.CITIES.qxn.medFixEmp, 30.5);

/* =========================================================
   9. 历史明细页：补充扣除同样扣现金
   ========================================================= */
section('9. 历史明细页');
(function histCase() {
  A.selectCity('bj');
  A._setMany({ salary: 20000, month: 6, startMonth: 1, pBase: 20000, mBase: 20000, uBase: 20000, mtBase: 20000, ijBase: 20000, hfBase: 20000, hfRate: 12, persPen: 0, healthIns: 0, annuity: 0 });
  A.calc();
  A.buildHistory();
  const rows = A.histRows();
  eq('历史行数 = 12（6实际+6预测）', rows.length, 12);
  const netNoSupp = rows[0].net;

  A._set('persPen', 1000); A.calc(); A.buildHistory();
  const rows2 = A.histRows();
  /* 实发下降 1000 − 省下的税；低档税率下接近 1000 但不等于 1000 */
  const drop = netNoSupp - rows2[0].net;
  ok('历史页实发确实下降了', drop > 900 && drop <= 1000, true);
  console.log(`  历史页首月实发：${fmt(netNoSupp)} → ${fmt(rows2[0].net)}（少 ${fmt(drop)}，个人养老金1000 − 省税）`);

  /* F6：补充扣除>0 时应出现第 5 个汇总框，且渲染出来的数字四则运算闭合 */
  const sumHtml = A._html('histSum');
  eq('汇总框数量 = 5（含补充扣除）', (sumHtml.match(/class="sum-box"/g) || []).length, 5);
  eq('汇总区 grid 用 c5 类（而非内联样式，避免盖掉移动端媒体查询）', A._class('histSum'), 'sum-grid c5');
  const sSal = A._num('sumSal'), sSI = A._num('sumSI'), sTax = A._num('sumTax'),
        sSupp = A._num('sumSupp'), sNet = A._num('sumNet');
  ok('汇总框闭合：税前−五险一金−个税−补充扣除 = 实发', sSal - sSI - sTax - sSupp, sNet, 0.02);
  console.log(`  汇总框：${fmt(sSal)} − ${fmt(sSI)} − ${fmt(sTax)} − ${fmt(sSupp)} = ${fmt(sNet)} ✓`);

  /* 补充扣除为 0 时回到 4 框，且同样闭合 */
  A._set('persPen', 0); A.calc(); A.buildHistory();
  const sumHtml0 = A._html('histSum');
  eq('无补充扣除时汇总框数量 = 4', (sumHtml0.match(/class="sum-box"/g) || []).length, 4);
  eq('无补充扣除时 grid 类不含 c5', A._class('histSum'), 'sum-grid');
  ok('无补充扣除时也闭合', A._num('sumSal') - A._num('sumSI') - A._num('sumTax'), A._num('sumNet'), 0.02);

  /* F5：北京生育并入医保，历史表不应出现"生育基数"列；深圳单独缴生育险，应有该列 */
  ok('北京·历史表无生育基数列', /生育基数/.test(A._html('histTable')), false);
  A.selectCity('sz'); A.calc(); A.buildHistory();
  ok('深圳·历史表有生育基数列', /生育基数/.test(A._html('histTable')), true);
  console.log('  历史表生育基数列：北京无 / 深圳有 ✓');

  /* 生育/工伤基数仅影响单位侧，个人实发不应随之变化 */
  A.selectCity('sz');  /* 深圳单独缴生育险，有 mtb 列 */
  A._setMany({ salary: 20000, month: 6, startMonth: 1, pBase: 20000, mBase: 20000, uBase: 20000, mtBase: 20000, ijBase: 20000, hfBase: 20000, hfRate: 5 });
  A.calc(); A.buildHistory();
  const netBefore = A.histRows()[0].net;
  A.histRows()[0].mtb = 99999; A.histRows()[0].ijb = 99999;
  A.calcHist();
  eq('历史页·生育/工伤基数变化不影响个人实发', A.histRows()[0].net, netBefore);
})();

/* =========================================================
   10. 年终奖陷阱状态标记
   ========================================================= */
section('10. 年终奖陷阱命中');
(function bonusCase() {
  A.selectCity('sz');
  A._setMany({ salary: 20000, month: 7, startMonth: 1, bonus: 36001 });
  A.calc();
  ok('36001 命中陷阱警告', /临界值陷阱警告/.test(A._html('bonusResult')), true);
  A._set('bonus', 36000); A.calc();
  ok('36000 未命中陷阱', /当前奖金未处于临界值陷阱区间/.test(A._html('bonusResult')), true);
  A._set('bonus', 38000); A.calc();
  ok('38000 仍在陷阱区间内(36000~38567)', /临界值陷阱警告/.test(A._html('bonusResult')), true);
  A._set('bonus', 39000); A.calc();
  ok('39000 已脱离陷阱(超过38567)', /当前奖金未处于临界值陷阱区间/.test(A._html('bonusResult')), true);
  A._set('bonus', 50000); A.calc();
  ok('50000 已脱离陷阱', /当前奖金未处于临界值陷阱区间/.test(A._html('bonusResult')), true);
})();

/* =========================================================
   11. 历史页编辑保留 + 统计区间年份 + 专项扣除口径明示
   ========================================================= */
section('11. 历史页编辑保留与文案口径');
(function histEditCase() {
  A.selectCity('bj');
  A._setMany({ salary: 20000, month: 6, startMonth: 1, pBase: 20000, mBase: 20000, uBase: 20000, mtBase: 20000, ijBase: 20000, hfBase: 20000, hfRate: 12, persPen: 0, healthIns: 0, annuity: 0 });
  A.calc();
  A.buildHistory();

  A.histRows()[0].sal = 12345;
  A.histRows()[2].on = false;
  A.switchTab(0); A.switchTab(1);
  eq('切页后已编辑月份保留(sal=12345)', A.histRows()[0].sal, 12345);
  eq('切页后未编辑月份仍继承默认值', A.histRows()[1].sal, 20000);
  eq('切页后排除月份状态保留(on=false)', A.histRows()[2].on, false);

  A._set('salary', 22000); A.calc(); A.buildHistory();
  eq('改默认值后已编辑月份仍保留', A.histRows()[0].sal, 12345);
  eq('改默认值后未编辑月份跟随新默认值', A.histRows()[1].sal, 22000);

  A.histRows()[5].sal = 33333;
  A._set('startMonth', 3); A.calc(); A.buildHistory();
  eq('收缩区间后行数 = 10（3月~12月）', A.histRows().length, 10);
  eq('收缩区间后按月份保留编辑(6月)', A.histRows()[3].sal, 33333);

  A.selectCity('sz'); A.calc(); A.buildHistory();
  eq('换城市后历史整体重置(6月旧编辑不残留)', A.histRows()[3].sal, 22000);

  ok('统计区间显示当前年份', A._text('rangeLabel').indexOf('统计区间：' + new Date().getFullYear() + '年 ') === 0, true);
  ok('源码未硬编码统计区间年份', /统计区间：\d{4}年/.test(html), false);
  ok('历史页明示专项附加扣除取自第1页', /专项附加扣除取自第 1 页、各月相同/.test(html), true);
  console.log('  逐月编辑在切页/改默认值/缩区间后保留，换城市重置 ✓');
})();

/* =========================================================
   汇总
   ========================================================= */
console.log('\n' + '='.repeat(58));
if (fail) {
  console.log(`失败 ${fail} 项 / 共 ${pass + fail} 项\n`);
  failures.forEach(f => console.log('  ✗ ' + f + '\n'));
  console.log('='.repeat(58));
  process.exit(1);
} else {
  console.log(`全部通过：${pass} 项断言`);
  console.log('='.repeat(58));
  process.exit(0);
}
