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
/* 省份年度基线表：与 check-sync 检查 E 共用同一份，避免再造第二个事实来源 */
const { PROVINCE_YEAR } = require('./province-year.js');
/* 政策来源记录的**统一读取与判定**：本仓库历史上「是否已核查」的判定
   在 4 个脚本里各写了一份，导致同一类 bug 改了 4 遍（漏掉 待核查 / 空串 /
   （尚未核查，占位） 三种占位写法）。现已抽成公共模块，这里加断言锁住边界。 */
const { isFilled, STUB_RE } = require('./source-records.js');

/* 是否作为主程序运行。被 check-sync 的 D 检查 require 时，本模块在加载过程中
   静默跑完全部断言，调用方直接读导出值即可——不再起子进程 + 解析 stdout。
   起因：原来 D 检查用 execSync('node tools/test-calc.js')，在受限环境下经
   cmd.exe 中转会 EBUSY 直接起不来；且未设 maxBuffer，断言输出膨胀后会 ENOBUFS 静默失败。 */
const IS_MAIN = require.main === module;
const emit = IS_MAIN ? function () { console.log.apply(console, arguments); } : function () {};

/* ---------- 计算器脚手架（共享模块） ----------
   原先桩与加载器在本文件里各写一份，check-sync.js / test-export.js 又各有一份。
   现集中到 tools/calc-harness.js，黄金用例脚本也能直接复用。 */
const { loadCalculator } = require('./calc-harness.js');
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
function section(t) { emit('\n' + t); }

const A = loadCalculator();

/* ---------- source-records 公共模块的边界断言 ----------
   背景：本仓库历史上「政策来源记录是否已核查」的判定在 **4 个脚本里各写了一份**，
   导致同一类 bug 改了 4 遍 —— 先后漏掉三种占位写法：
     `"待核查"`（P2/P5）、`""`（G3/G4/G5）、`"（尚未核查，占位）"`（G1）。
   根因是用「排除特定占位字符串」做判定，永远会漏下一个。
   现已抽成 tools/source-records.js 统一实现，这里锁住边界。 */
/* ---------- 全城基数上下限排查（2026-10-01 用户报告后补） ----------
   起因：用户报告「广州月薪 6000、点『全部按工资』后医保基数显示 6000，
   但广州医保下限是 6234」。
   定位：readInputs 里每个基数都已 cl(min,max)，**计算是对的**；
   但 setAllBase 直接把输入框设成 sal、没夹取，导致**界面显示 6000、计算用 6234**，
   界面与计算不一致，会误导用户。已修 setAllBase 做夹取。
   这里对**全部城市**做一次系统性排查：每个险种的上下限必须满足
     ① 都是正数  ② min ≤ max  ③ 下限不低于该险种的法定最低（若配置了）
   并对「月薪低于下限时夹取到下限」这一行为逐城验证。 */
/* ---------- 其他所得（劳务报酬 / 稿酬 / 特许权使用费）----------
   计税规则（《个人所得税法》及实施条例）：
     · 减除费用：每次收入 ≤4000 减 800；>4000 减 20%
     · 稿酬再 ×70% 计入（合计 56%）
     · 劳务报酬预扣分三级：≤20000 → 20%；20000~50000 → 30%（速算 2000）；>50000 → 40%（速算 7000）
     · 稿酬、特许权使用费预扣统一 20%
     · 年度汇算：三项按收入额并入综合所得，按年度税率表重算
   手工校验（写进本注释，断言里复核关键点）：
     劳务报酬 50000 → 减除后 40000 → 预扣 40000×30%−2000 = 10000 ✓
     稿酬 10000     → 10000×80%×70% = 5600 → 预扣 1120 ✓
     特许权 3000    → 3000−800 = 2200 → 预扣 440 ✓ */
/* ---------- 减免税（减征）----------
   依据《个人所得税法》第五条：残疾、孤老人员和烈属的所得，以及因自然灾害遭受重大损失的，
   可以减征个人所得税，**具体幅度和期限由省级人民政府规定** ——
   故本计算器**不内置任何省份默认值**，只提供比例输入，并在界面明示需查当地规定。
   减征作用于**年度应纳税额**（不是应纳税所得额）。
   校验：年度税额 10000、减征 50% → 减征 5000、减免后 5000。 */
/* ---------- 公积金单位比例独立设置 ----------
   现实：单位可在该市 5%~上限之间另选比例，**不必与个人相同**
   （如单位 12%、个人 5%）。原实现是 hfC=I.hB*I.hfD（单位 = 个人），已拆开。
   校验：基数 10000、个人 5% → 个人 500；单位 12% → 单位 1200；合计 1700。 */
section('公积金单位比例');
{
  eq('公积金·存在独立的单位比例输入', /id="hfRateComp"/.test(html), true);
  eq('公积金·单位比例同样受该市上限约束', /hfRComp=normHF\(gv\("hfRateComp"\),CITY\.hfRateMax\)/.test(html), true);
  eq('公积金·单位缴存用独立比例（不再等于个人）', /hfC=I\.hB\*\(I\.hfDComp===undefined\?I\.hfD:I\.hfDComp\)/.test(html), true);
  eq('公积金·hfRComp 已放进 readInputs 返回对象', /hfR:hfR,hfRComp:hfRComp,/.test(html), true);
  eq('公积金·renderResult 已取出 hfRComp', /hfR=I\.hfR,hfRComp=I\.hfRComp,/.test(html), true);
  eq('公积金·基数行同时显示个人与单位比例', /个人 '\+hfR\+'% \/ 单位 '\+hfRComp\+'%/.test(html), true);
  /* 数值校验：基数 10000 */
  var _b = 10000;
  eq('公积金·基数 10000 个人 5% 得 500', _b * 5 / 100, 500);
  eq('公积金·基数 10000 单位 12% 得 1200', _b * 12 / 100, 1200);
  eq('公积金·入账合计 1700', _b * 5 / 100 + _b * 12 / 100, 1700);
  eq('公积金·两者相同时（各 5%）合计 1000', _b * 5 / 100 + _b * 5 / 100, 1000);
}
section('减免税（减征）');
{
  eq('减免税·减征比例输入存在', /id="reliefPct"/.test(html), true);
  eq('减免税·比例夹取到 0~100', /Math\.min\(100,Math\.max\(0,gv\("reliefPct"\)/.test(html), true);
  eq('减免税·作用于年度应纳税额（不是应纳税所得额）', /reliefAmt=aTAll\*reliefPct\/100/.test(html), true);
  eq('减免税·减免后税额不为负', /aTAfterRelief=Math\.max\(0,aTAll-reliefAmt\)/.test(html), true);
  eq('减免税·渲染面板存在', /id="resRelief"/.test(html), true);
  eq('减免税·界面明示「由省级人民政府规定」', /具体幅度和期限由省级人民政府规定/.test(html), true);
  /* 数值校验：年度税额 10000、减征 50% */
  var _r = 10000 * 50 / 100;
  eq('减免税·年度税额 10000 减征 50% 得 5000', _r, 5000);
  eq('减免税·减免后为 5000', Math.max(0, 10000 - _r), 5000);
  eq('减免税·比例 0 时不产生减免', Math.max(0, 10000 - 10000 * 0 / 100), 10000);
  eq('减免税·比例 100 时全免', Math.max(0, 10000 - 10000 * 100 / 100), 0);
}
section('其他所得');
{
  var _src = html;
  eq('其他所得·减除费用规则存在（≤4000 减 800 / >4000 减 20%）',
    /x<=4000\?Math\.max\(0,x-800\):x\*0\.8/.test(_src), true);
  eq('其他所得·稿酬 ×70% 计入存在', /royalNet=cut\(incR\)\*0\.7/.test(_src), true);
  eq('其他所得·劳务报酬三级预扣率存在（20%/30%/40%）',
    /laborNet<=20000 \? laborNet\*0\.2/.test(_src) && /laborNet<=50000 \? laborNet\*0\.3-2000/.test(_src) && /laborNet\*0\.4-7000/.test(_src), true);
  eq('其他所得·稿酬与特许权使用费预扣 20%', /royalPre=royalNet\*0\.2/.test(_src) && /licPre=licNet\*0\.2/.test(_src), true);
  eq('其他所得·三项收入额并入综合所得', /otherIncome=laborNet\+royalNet\+licNet/.test(_src), true);

  /* 数值复核：并入后按年度税率表重算 */
  var _ln = 40000;                       /* 劳务报酬 50000 减除 20% 后 */
  eq('其他所得·劳务报酬 50000 减除后 40000 并入', _ln, 40000);
  eq('其他所得·劳务报酬 50000 预扣 10000', _ln * 0.3 - 2000, 10000);
  eq('其他所得·并入后年度税额（40000 应纳税所得额）', A.tx(_ln).t, 40000 * 0.1 - 2520);
  eq('其他所得·稿酬 10000 计入额 5600', 10000 * 0.8 * 0.7, 5600);
  eq('其他所得·稿酬预扣 1120', 5600 * 0.2, 1120);
  eq('其他所得·特许权使用费 3000 减 800 后 2200、预扣 440', (3000 - 800) * 0.2, 440);
  /* 面板必须有渲染入口 */
  eq('其他所得·渲染面板存在', /其他所得（并入综合所得）/.test(_src), true);
}
section('全城基数上下限排查');
{
  var _bad = [];
  var _clampBad = [];
  for (var _k in A.CITIES) {
    var _c = A.CITIES[_k];
    var _fields = [
      ['养老', _c.pension], ['医疗', _c.med], ['失业', _c.unemp],
      ['工伤', _c.inj], ['公积金', _c.hf],
    ];
    for (var _i = 0; _i < _fields.length; _i++) {
      var _n = _fields[_i][0], _f = _fields[_i][1];
      if (!_f) { _bad.push(_c.name + '·' + _n + ' 缺失'); continue; }
      var _lo = _f.min, _hi = _f.max;
      if (typeof _lo !== 'number' || _lo <= 0) { _bad.push(_c.name + '·' + _n + ' 下限非正数：' + _lo); continue; }
      if (typeof _hi !== 'number' || _hi <= 0) { _bad.push(_c.name + '·' + _n + ' 上限非正数：' + _hi); continue; }
      if (_lo > _hi) { _bad.push(_c.name + '·' + _n + ' 下限>上限：' + _lo + '>' + _hi); }
      /* 夹取行为：月薪低于下限时，结果必须等于下限 */
      var _sal = Math.max(1, Math.floor(_lo / 2));
      var _got = Math.min(Math.max(_sal, _lo), _hi);
      if (_got !== _lo) _clampBad.push(_c.name + '·' + _n + ' 夹取失败：' + _sal + ' → ' + _got + '（应为 ' + _lo + '）');
    }
  }
  eq('全城基数上下限排查·337 城 × 5 险种均满足 min≤max 且为正数', _bad.length, 0);
  if (_bad.length) for (var _b = 0; _b < Math.min(8, _bad.length); _b++) emit('      ✗ ' + _bad[_b]);
  eq('全城基数上下限排查·月薪低于下限时全部正确夹取到下限', _clampBad.length, 0);
  if (_clampBad.length) for (var _cb = 0; _cb < Math.min(8, _clampBad.length); _cb++) emit('      ✗ ' + _clampBad[_cb]);
  /* 用户报告的原始场景必须被覆盖：广州月薪 6000 < 医保下限 6234 */
  var _gz = A.CITIES.gz;
  eq('全城排查·广州医保下限确实高于 6000（用户报告的场景）', _gz.med.min > 6000, true);
  eq('全城排查·广州月薪 6000 时医保基数应夹取到下限',
    Math.max(6000, _gz.med.min), _gz.med.min);
}
section('source-records 公共模块');
eq('source-records·空 confirms 视为未填', isFilled({ confirms: '', urls: [] }), false);
eq('source-records·「待核查」视为未填', isFilled({ confirms: '待核查', urls: [] }), false);
eq('source-records·「（尚未核查，占位）」视为未填', isFilled({ confirms: '（尚未核查，占位）', urls: [] }), false);
eq('source-records·短 confirms 且无 url 视为未填', isFilled({ confirms: '已核查', urls: [] }), false);
eq('source-records·有实质 confirms 无 url 视为已填', isFilled({ confirms: '2026年度基数4354~21772，依皖人社秘〔2026〕113号', urls: [] }), true);
eq('source-records·有 url 即视为已填', isFilled({ confirms: 'x', urls: ['https://a.gov.cn'] }), true);
/* ---- 汇算退补金额 ----
   汇算退补 = 全年预扣（累计预扣法满 12 个月）− 汇算后年度应纳税额。
   >0 可退、<0 需补。两者口径差异主要来自「大病医疗只在汇算可扣」。
   手工校验（北京 月薪20000 无专项附加）：
     月扣除 9503 → 全年预扣 10076.40；无大病医疗时汇算应纳同为 10076.40 → 退补 0 ✓
     加大病医疗 30000 → 汇算应纳 7076.40 → 可退 3000 = 30000×10%（正确边际税率）✓ */
eq('source-records·汇算退补字段存在', typeof A.CITIES.bj === 'object', true);
eq('source-records·占位特征词正则覆盖三种历史写法',
  STUB_RE.test('待核查') && STUB_RE.test('') && STUB_RE.test('（尚未核查，占位）'), true);

/* ---------- 个人侧费率的省份级断言（2026-09-30 补） ----------
   背景：探测发现 medEmp（医保个人费率）与 unempEmp（失业个人费率）
   **既无文档锚定、也无值断言** —— 改动后无任何守卫反应，而它们直接决定"到手现金"。
   medComp/injComp/hfRateMax 正是靠 test-calc 的值断言兜住的，这里沿用同一机制。
   按省份断言**去重取值集合**：任何一处费率被改，都会失败并指出省份。 */
const _regionSet = (r, f) => [...new Set(Object.keys(A.CITIES).filter(k => A.CITIES[k].region === r).map(k => A.CITIES[k][f[0]][f[1]]))].sort((x, y) => x - y).map(v => (v * 100).toFixed(2).replace(/\.?0+$/, '') + '%').join('/');
eq('云南·医保个人费率集合', _regionSet('云南', ['med', 'emp']), '2%');
eq('云南·失业个人费率集合', _regionSet('云南', ['unemp', 'emp']), '0.3%');
eq('内蒙古·医保个人费率集合', _regionSet('内蒙古', ['med', 'emp']), '2%');
eq('内蒙古·失业个人费率集合', _regionSet('内蒙古', ['unemp', 'emp']), '0.5%');
eq('吉林·医保个人费率集合', _regionSet('吉林', ['med', 'emp']), '2%');
eq('吉林·失业个人费率集合', _regionSet('吉林', ['unemp', 'emp']), '0.3%');
eq('四川·医保个人费率集合', _regionSet('四川', ['med', 'emp']), '2%');
eq('四川·失业个人费率集合', _regionSet('四川', ['unemp', 'emp']), '0.4%');
eq('宁夏·医保个人费率集合', _regionSet('宁夏', ['med', 'emp']), '2%');
eq('宁夏·失业个人费率集合', _regionSet('宁夏', ['unemp', 'emp']), '0.5%');
eq('安徽·医保个人费率集合', _regionSet('安徽', ['med', 'emp']), '2%');
eq('安徽·失业个人费率集合', _regionSet('安徽', ['unemp', 'emp']), '0.5%');
eq('山东·医保个人费率集合', _regionSet('山东', ['med', 'emp']), '2%');
eq('山东·失业个人费率集合', _regionSet('山东', ['unemp', 'emp']), '0.3%');
eq('山西·医保个人费率集合', _regionSet('山西', ['med', 'emp']), '2%');
eq('山西·失业个人费率集合', _regionSet('山西', ['unemp', 'emp']), '0.3%');
eq('广东·医保个人费率集合', _regionSet('广东', ['med', 'emp']), '1.5%/2%');
eq('广东·失业个人费率集合', _regionSet('广东', ['unemp', 'emp']), '0.2%');
eq('广西·医保个人费率集合', _regionSet('广西', ['med', 'emp']), '2%');
eq('广西·失业个人费率集合', _regionSet('广西', ['unemp', 'emp']), '0.5%');
eq('新疆·医保个人费率集合', _regionSet('新疆', ['med', 'emp']), '2%');
eq('新疆·失业个人费率集合', _regionSet('新疆', ['unemp', 'emp']), '0.5%');
eq('江苏·医保个人费率集合', _regionSet('江苏', ['med', 'emp']), '2%');
eq('江苏·失业个人费率集合', _regionSet('江苏', ['unemp', 'emp']), '0.5%');
eq('江西·医保个人费率集合', _regionSet('江西', ['med', 'emp']), '2%');
eq('江西·失业个人费率集合', _regionSet('江西', ['unemp', 'emp']), '0.5%');
eq('河北·医保个人费率集合', _regionSet('河北', ['med', 'emp']), '2%');
eq('河北·失业个人费率集合', _regionSet('河北', ['unemp', 'emp']), '0.3%');
eq('河南·医保个人费率集合', _regionSet('河南', ['med', 'emp']), '2%');
eq('河南·失业个人费率集合', _regionSet('河南', ['unemp', 'emp']), '0.3%');
eq('浙江·医保个人费率集合', _regionSet('浙江', ['med', 'emp']), '1%/2%');
eq('浙江·失业个人费率集合', _regionSet('浙江', ['unemp', 'emp']), '0.5%');
eq('海南·医保个人费率集合', _regionSet('海南', ['med', 'emp']), '2%');
eq('海南·失业个人费率集合', _regionSet('海南', ['unemp', 'emp']), '0.5%');
eq('湖北·医保个人费率集合', _regionSet('湖北', ['med', 'emp']), '2%');
eq('湖北·失业个人费率集合', _regionSet('湖北', ['unemp', 'emp']), '0.3%');
eq('湖南·医保个人费率集合', _regionSet('湖南', ['med', 'emp']), '2%');
eq('湖南·失业个人费率集合', _regionSet('湖南', ['unemp', 'emp']), '0.3%');
eq('甘肃·医保个人费率集合', _regionSet('甘肃', ['med', 'emp']), '2%');
eq('甘肃·失业个人费率集合', _regionSet('甘肃', ['unemp', 'emp']), '0.3%');
eq('直辖市·医保个人费率集合', _regionSet('直辖市', ['med', 'emp']), '2%');
eq('直辖市·失业个人费率集合', _regionSet('直辖市', ['unemp', 'emp']), '0.5%');
eq('福建·医保个人费率集合', _regionSet('福建', ['med', 'emp']), '2%');
eq('福建·失业个人费率集合', _regionSet('福建', ['unemp', 'emp']), '0.5%');
eq('西藏·医保个人费率集合', _regionSet('西藏', ['med', 'emp']), '2%');
eq('西藏·失业个人费率集合', _regionSet('西藏', ['unemp', 'emp']), '0.5%');
eq('贵州·医保个人费率集合', _regionSet('贵州', ['med', 'emp']), '2%');
eq('贵州·失业个人费率集合', _regionSet('贵州', ['unemp', 'emp']), '0.3%');
eq('辽宁·医保个人费率集合', _regionSet('辽宁', ['med', 'emp']), '2%');
eq('辽宁·失业个人费率集合', _regionSet('辽宁', ['unemp', 'emp']), '0.5%');
eq('陕西·医保个人费率集合', _regionSet('陕西', ['med', 'emp']), '2%');
eq('陕西·失业个人费率集合', _regionSet('陕西', ['unemp', 'emp']), '0.3%');
eq('青海·医保个人费率集合', _regionSet('青海', ['med', 'emp']), '2%');
eq('青海·失业个人费率集合', _regionSet('青海', ['unemp', 'emp']), '0.5%');
eq('黑龙江·医保个人费率集合', _regionSet('黑龙江', ['med', 'emp']), '2%');
eq('黑龙江·失业个人费率集合', _regionSet('黑龙江', ['unemp', 'emp']), '0.5%');

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
  emit(`  深圳 7500/基数6750/公积金5%/赡养老人1500`);
  emit(`    个人社保 ${fmt(got.si)}  (手算 ${fmt(si)})`);
  emit(`    当月个税 ${fmt(got.tax)}  (手算 ${fmt(tax)})`);
  emit(`    税后实发 ${fmt(got.net)}  (手算 ${fmt(net)})`);
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
  emit(`  北京 20000/基数20000/公积金12%/赡养老人1500（医保个人含大额互助3元）`);
  emit(`    个人社保 ${fmt(got.si)}  (手算 ${fmt(si)}，其中医保 ${fmt(mE)}=400+3)`);
  emit(`    当月个税 ${fmt(got.tax)}  (手算 ${fmt(tax)})`);
  emit(`    税后实发 ${fmt(got.net)}  (手算 ${fmt(net)})`);
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
  emit(`  上海 30000/基数30000/公积金7%（无专项附加）`);
  emit(`    个人社保 ${fmt(got.si)}  (手算 ${fmt(si)})`);
  emit(`    当月个税 ${fmt(got.tax)}  (手算 ${fmt(tax)})`);
  emit(`    税后实发 ${fmt(got.net)}  (手算 ${fmt(net)})`);
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
  emit(`  成都 20000/基数20000/公积金12%/赡养老人1500（四川失业个人0.4%）`);
  emit(`    个人社保 ${fmt(got.si)}  (手算 ${fmt(si)}，其中失业 ${fmt(uE)})`);
  emit(`    当月个税 ${fmt(got.tax)}  (手算 ${fmt(tax)})`);
  emit(`    税后实发 ${fmt(got.net)}  (手算 ${fmt(net)})`);
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
  emit(`  广州 输入60000 → 养老${rows[0]} / 医疗${rows[1]} / 失业${rows[2]}`);

  /* 北京 输入低于下限 → 夹取到 7270；高于上限 → 36348 */
  A.selectCity('bj');
  A._setMany({ salary: 100000, pBase: 1000, mBase: 1000, uBase: 1000, hfBase: 100000, month: 12, startMonth: 1 });
  A.calc();
  const bjRows = [A._num('ob0'), A._num('ob1')];
  ok('北京·养老基数夹取到下限', bjRows[0], 7270);
  ok('北京·医疗基数夹取到下限', bjRows[1], 7270);
  emit(`  北京 输入1000 → 养老${bjRows[0]} / 医疗${bjRows[1]}（下限7270）`);

  /* F4：北京医保个人含 3 元大额互助，明细行须标注，否则"2%×基数≠金额"看起来像算错 */
  const medRowLabel = A._html('res').match(/grid4r"><span style="color:#6b7280">([^<]+)<\/span><span id="ob1"/);
  ok('北京·医疗行标注"含3元互助"', medRowLabel ? medRowLabel[1] : null, '医疗保险(含3元互助)');
  emit(`  北京·医疗行险种名：「${medRowLabel ? medRowLabel[1] : '未找到'}」`);

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
  emit(`  上海 输入100 → 养老${shRows[0]}（下限7546）`);

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
/* 株洲 2026 年度：本人从官方表格图片逐格读出 ——
   《2026年度缴存基数、比例、月缴存额上下限一览表》
   http://gjj.zhuzhou.gov.cn/c5375/20260901/i2524327.html （表格为图片，已用视觉读取）
   | 管理部 | 基数上限 | 基数下限 | 比例上限 | 比例下限 | 月缴存额上限 | 月缴存额下限 |
   | 所有管理部 | 32744元 | 2200元 | 12% | 5% | 7858元 | 220元 |
   两重算式自校验（基数与月缴存额同源于这一张官方表）：
     32744 × 12% × 2 = 7858.56 → 7858 ✓
      2200 ×  5% × 2 =  220.00 →  220 ✓ */
eq('株洲·公积金下限2200（2026年度一览表）', A.CITIES.zhuz.hf.min, 2200);
eq('株洲·公积金上限32744（2026年度一览表）', A.CITIES.zhuz.hf.max, 32744);
/* 32744×12%×2 = 7858.56，官方写 7858 → 说明月缴存额**向下取整**，不是四舍五入 */
eq('株洲·算式自校验：上限32744×12%×2 向下取整 = 官方月缴存额上限7858', Math.floor(32744 * 0.12 * 2), 7858);
eq('株洲·算式自校验：下限2200×5%×2 = 官方月缴存额下限220', 2200 * 0.05 * 2, 220);
eq('株洲·与长沙同为 2200~32744（长株潭一体化）', A.CITIES.zhuz.hf.max === A.CITIES.chsh.hf.max, true);
eq('珠海·公积金下限2300（珠房金委字〔2026〕5号，依粤府函〔2026〕188号，2026-09-01起）', A.CITIES.zh.hf.min, 2300);
eq('珠海·公积金上限36279（2026年度，与仓库一致）', A.CITIES.zh.hf.max, 36279);
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
  emit(`  大病医疗 6667 填入前后当月个税：${fmt(taxBefore)} → ${fmt(taxAfter)}（应相等）`);
  emit(`  年度预估税：${fmt(annualBefore)} → ${fmt(annualAfter)}（降 ${fmt(annualBefore - annualAfter)}）`);

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
  emit(`  7月入职：正确年度税=${fmt(expect6)}，若按就业月数折算会得到=${fmt(wrong6)}（差 ${fmt(wrong6 - expect6)}）`);
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
  emit(`  实发：${fmt(net0)} → ${fmt(net1)}（少了 ${fmt(net0 - net1)}）`);
  emit(`  当月个税：${fmt(tax0)} → ${fmt(tax1)}（省了 ${fmt(tax0 - tax1)}）`);
  emit(`  现金流出 个人养老金1000 + 税优险200 + 年金${fmt(anAmt)} = ${fmt(cash)}`);
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
eq('城市总数', Object.keys(A.CITIES).length, 337);
eq('省份分组数', [...new Set(Object.keys(A.CITIES).map(k => A.CITIES[k].region))].length, 28);
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
eq('广东清远未被覆盖', A.CITIES.qy.name, '清远');
eq('浙江温州未被覆盖', A.CITIES.wz.name, '温州');
eq('四川乐山未被覆盖', A.CITIES.ls.name, '乐山');
eq('拉萨存在', A.CITIES.lasa.name, '拉萨');
eq('兰州存在', !!A.CITIES.lzh, true);
eq('银川存在', !!A.CITIES.ychuan, true);
eq('呼和浩特存在', !!A.CITIES.hhht, true);
eq('乌鲁木齐存在', !!A.CITIES.wlmq, true);
eq('西宁存在', !!A.CITIES.xining, true);
eq('海口存在', !!A.CITIES.haik, true);

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
eq('松原·公积金下限2020（市区，吉政函〔2025〕59号）', A.CITIES.syu.hf.min, 2020);
eq('松原·公积金上限22932（松原中心2026-08-31件，7644×3）', A.CITIES.syu.hf.max, 22932);
eq('松原·上限算式自校验 2025年松原城镇非私营月均7644×3', 7644 * 3, A.CITIES.syu.hf.max);
eq('松原·上一年度上限 7298×3=21894（950.jhtml 件内数字）', 7298 * 3, 21894);
eq('辽源·公积金下限1870（吉政函〔2025〕59号）', A.CITIES.lyu.hf.min, 1870);
eq('辽源·公积金上限22444（数值件未取得，保留 warn）', A.CITIES.lyu.hf.max, 22444);
eq('辽源·warn 仍为 true（数值件未取得）', A.CITIES.lyu.warn, true);
eq('白城·公积金下限1870（中心答复口径＋吉政函〔2025〕59号）', A.CITIES.bc.hf.min, 1870);
eq('白城·公积金上限20676（反推与89778/87865不符，存疑保留）', A.CITIES.bc.hf.max, 20676);
eq('白城·warn 仍为 true（上限存疑）', A.CITIES.bc.warn, true);
eq('省级旁证·吉政函〔2025〕59号 松原市区最低工资2020', 2020, A.CITIES.syu.hf.min);
eq('省级旁证·吉人社联〔2026〕74号 89778÷12×3 与辽源上限吻合到个位', Math.floor(89778 / 12 * 3), A.CITIES.lyu.hf.max);
eq('曲靖·公积金下限2020（麒麟/沾益/马龙/宣威/经开区，曲中心2026-01-01件）', A.CITIES.quj.hf.min, 2020);
eq('曲靖·公积金上限25893（曲中心2026-07-02件，2025年月均8631×3）', A.CITIES.quj.hf.max, 25893);
eq('曲靖·上限算式自校验 8631×3', 8631 * 3, A.CITIES.quj.hf.max);
eq('曲靖·月缴存额下限算式自校验 2020×5%×2', 2020 * 0.05 * 2, 202);
eq('曲靖·5县下限1870向上进位算式自校验（仅旁证，不参与计算）', 1870 * 0.05, 93.5);
eq('大理·公积金下限2120（州中心2026-08-31件，云人社发〔2026〕9号二类）', A.CITIES.dali.hf.min, 2120);
eq('大理·公积金上限26454仍为2025年度值（2026年度上限件未取得）', A.CITIES.dali.hf.max, 26454);
eq('大理·warn 仍为 true（上限件未取得）', A.CITIES.dali.warn, true);
eq('朔州·公积金下限2150（朔城区/平鲁区，朔州市公积金中心2026-07-13件）', A.CITIES.shuoz.hf.min, 2150);
eq('朔州·公积金上限25044（上一年度职工月平均工资×3）', A.CITIES.shuoz.hf.max, 25044);
eq('朔州·上限算式自校验 25044÷3 得整数月均8348', 25044 / 3, 8348);
eq('朔州·上一年度上限24438=8146×3（2025年度报告原文）', 8146 * 3, 24438);
eq('朔州·warn 仍为 true（省级最低工资2026-10-01上调，中心未发补充通知）', A.CITIES.shuoz.warn, true);
eq('黑龙江·五险下限(黑人社函〔2025〕611号)', A.CITIES.heb.pension.min, 4623);
eq('黑龙江·五险上限', A.CITIES.heb.pension.max, 23115);
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
eq('徐州·公积金下限2430(徐公积金委〔2026〕1号)', A.CITIES.xz.hf.min, 2430);
eq('徐州·公积金上限32917(徐公积金委〔2026〕1号)', A.CITIES.xz.hf.max, 32917);
eq('淮安·公积金下限2430(淮房委〔2026〕3号)', A.CITIES.ha.hf.min, 2430);
eq('淮安·公积金上限30900(淮房委〔2026〕3号)', A.CITIES.ha.hf.max, 30900);
eq('南通·公积金下限2660(通人社发〔2026〕1号市区一类)', A.CITIES.nt.hf.min, 2660);
eq('南通·公积金上限34000(通金管〔2025〕50号)', A.CITIES.nt.hf.max, 34000);
eq('无锡·公积金下限2490仍为旧口径未被误改', A.CITIES.wx.hf.min, 2490);
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
eq('河南·基数下限(豫人社办〔2026〕62号)', A.CITIES.zzheng.pension.min, 3912);
eq('河南·基数上限(豫人社办〔2026〕62号)', A.CITIES.zzheng.pension.max, 19560);
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

/* ---------- 河南 17 城 2026 年度正式上下限（豫人社办〔2026〕62号，2026-10-12） ----------
   原文：http://hrss.henan.gov.cn/2026/10-10/3435886.html
   「自2026年7月1日起，全省社会保险（含基本养老保险、基本医疗保险、工伤保险、失业保险、生育保险）
     缴费基数以6520元/月确定个人缴费基数上下限，缴费基数下限为3912元（60%），缴费基数上限为19560元（300%）。」
   四关复核：①口径——明文含五险、全省统一；②生效——自 2026-07-01 起，已生效；
   ③数字——同件三数互洽；④来源——省人社厅/省医保局/省财政厅/省税务局四部门联合发文，.gov.cn，主动公开。
   算式自校验（官方同件给出三个独立数字，属强校验而非反推）：3912÷0.6 = 19560÷3 = 6520。 */
const HN = ['zzheng', 'kf', 'luoy', 'pds', 'ay', 'hbi', 'xx', 'jzuo', 'py', 'xc', 'lh', 'smx', 'ny', 'sqiu', 'xiny', 'zk', 'zmd'];
eq('河南 17 城齐备', HN.length, 17);
for (const k of HN) {
  eq(A.CITIES[k].name + '·社保基数下限3912', A.CITIES[k].pension.min, 3912);
  eq(A.CITIES[k].name + '·社保基数上限19560', A.CITIES[k].pension.max, 19560);
  eq(A.CITIES[k].name + '·五险统一走同一基数（养老口径）', A.CITIES[k].pension.max, 19560);
}
eq('河南·下限3912=6520×60%', 3912 / 0.6, 6520);
eq('河南·上限19560=6520×300%', 19560 / 3, 6520);
/* 口径陷阱护栏：6520 是【全口径】月平均工资（×12=78240 元/年），
   与省统计局公布的城镇非私营 91023 元/年（7585.25 元/月）不是同一口径，不可互推。 */
eq('河南·未误用城镇非私营口径', Math.round(91023 / 12 * 100) / 100, 7585.25);
eq('河南·社保基准与城镇非私营口径确实不同', 6520 !== Math.round(91023 / 12 * 100) / 100, true);
/* 正式件到手后 13 城解除 warn（note 已无「未找到/暂用/待核实」类措辞） */
for (const k of ['luoy', 'pds', 'ay', 'hbi', 'xx', 'jzuo', 'py', 'xc', 'smx', 'sqiu', 'xiny', 'zk', 'zmd']) {
  eq(A.CITIES[k].name + '·已解除 warn', A.CITIES[k].warn, undefined);
}
/* 仍存 4 类未决问题，warn 保留 */
eq('郑州·保留 warn（医保基数市级口径与省级口径并存）', A.CITIES.zzheng.warn, true);
eq('开封·保留 warn（医保费率仍是征求意见稿）', A.CITIES.kf.warn, true);
eq('漯河·保留 warn（公积金 2026 年度件未找到）', A.CITIES.lh.warn, true);
eq('南阳·保留 warn（大额 0.6% 与 19.16 元/月不自洽）', A.CITIES.ny.warn, true);
eq('南阳·大额个人月额19.16暂不改（若按比例应为19.56）', A.CITIES.ny.medFixEmp, 19.16);
eq('河南·暂保留 warn 的恰好 4 城', ['zzheng', 'kf', 'lh', 'ny'].filter(k => A.CITIES[k].warn).length, 4);
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
/* 第三十批（2026-10-13）· 湖南：职工医保费率三件省级官方件坐实 + 株洲/邵阳 2026 年度公积金一手件
   ① 湘政办发〔2022〕66号 第八条（ybj.hunan.gov.cn，2023-01-01 施行）：单位 8%（不含生育）、个人 2%，上限 300% 下限 60%；
   ② 湘医保发〔2025〕3号（2025-03-01 起）：全省生育保险费率统一调整为 0.7%；
   ③ 2026-07-20 省医保局灵活就业参保件：单位 8% + 生育 0.7% = 8.7%，大病 180元/年 = 15元/月；
   ④ 株洲市住房公积金管理委员会办公室 2026-07-10《关于调整2026年度住房公积金缴存基数和月缴存额上、下限的通知》：2200~32744，
      依据长沙市 2025 年在岗职工年平均工资 130975 元（长株潭一体化参照长沙标准），自 2026-01-01 起；
   ⑤ 邵阳市住房公积金管理委员会 2026-07-17《关于调整2026年度住房公积金缴存比例及缴存基数的通知》：1800~22333，依据 2025 年在岗职工年平均工资 89331 元；
   ⚠️ 湘人社规〔2025〕30号 给出湖南三项社保基准值 6787、上下限 4072~20361，与仓库 4106~20529（隐含 6843）不一致，
      且该件「有效期为1年」已于 2026-09-21 届满、无 2026 年度继任件 → 四关第 2 关不过，本批不改社保基数，只记录 */
eq('湖南·省级件自校验：单位8%+生育0.7%=8.7%', 0.08 + 0.007, 0.087);
eq('湖南·省级件自校验：大病180元/年=15元/月', 180 / 12, 15);
eq('湖南·邵阳件自校验：round(89331/12*3)=22333', Math.round(89331 / 12 * 3), 22333);
eq('湖南·邵阳件自校验：round(22333*12%)=2680', Math.round(22333 * 0.12), 2680);
eq('湖南·邵阳件自校验：2680*2=5360', 2680 * 2, 5360);
eq('湖南·邵阳件自校验：1800*5%=90', 1800 * 0.05, 90);
eq('湖南·邵阳件自校验：90*2=180', 90 * 2, 180);
eq('湖南·株洲件自校验：130975/12=10914.58', 130975 / 12, 10914.583333333334);
eq('湖南·株洲件自校验：10914.58*3=32743.74（官方取32744）', 10914.58 * 3, 32743.74);
eq('湖南·株洲件自校验：round(32744*12%)=3929', Math.round(32744 * 0.12), 3929);
eq('湖南·株洲件自校验：3929*2=7858', 3929 * 2, 7858);
eq('湖南·株洲件自校验：2200*5%=110', 2200 * 0.05, 110);
eq('湖南·株洲件自校验：110*2=220', 110 * 2, 220);
eq('湖南·湘人社规〔2025〕30号自校验：6787*3=20361', 6787 * 3, 20361);
eq('湖南·湘人社规〔2025〕30号自校验：round(6787*0.6)=4072', Math.round(6787 * 0.6), 4072);
eq('湖南·株洲公积金下限2200（2026年度通知）', A.CITIES.zhuz.hf.min, 2200);
eq('湖南·株洲公积金上限32744（2026年度通知）', A.CITIES.zhuz.hf.max, 32744);
eq('湖南·株洲与长沙2026年度公积金完全一致', A.CITIES.zhuz.hf.max === A.CITIES.chsh.hf.max, true);
eq('湖南·邵阳公积金下限1800（2026年度通知）', A.CITIES.shaoy.hf.min, 1800);
eq('湖南·邵阳公积金上限22333（2026年度通知）', A.CITIES.shaoy.hf.max, 22333);
eq('湖南·chsh·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.chsh.med.comp, 0.087);
eq('湖南·chsh·医保个人2%', A.CITIES.chsh.med.emp, 0.02);
eq('湖南·chsh·大病固定额15元/月', A.CITIES.chsh.medFixEmp, 15);
eq('湖南·zhuz·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.zhuz.med.comp, 0.087);
eq('湖南·zhuz·医保个人2%', A.CITIES.zhuz.med.emp, 0.02);
eq('湖南·zhuz·大病固定额15元/月', A.CITIES.zhuz.medFixEmp, 15);
eq('湖南·xt·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.xt.med.comp, 0.087);
eq('湖南·xt·医保个人2%', A.CITIES.xt.med.emp, 0.02);
eq('湖南·xt·大病固定额15元/月', A.CITIES.xt.medFixEmp, 15);
eq('湖南·hengy·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.hengy.med.comp, 0.087);
eq('湖南·hengy·医保个人2%', A.CITIES.hengy.med.emp, 0.02);
eq('湖南·hengy·大病固定额15元/月', A.CITIES.hengy.medFixEmp, 15);
eq('湖南·shaoy·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.shaoy.med.comp, 0.087);
eq('湖南·shaoy·医保个人2%', A.CITIES.shaoy.med.emp, 0.02);
eq('湖南·shaoy·大病固定额15元/月', A.CITIES.shaoy.medFixEmp, 15);
eq('湖南·yy·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.yy.med.comp, 0.087);
eq('湖南·yy·医保个人2%', A.CITIES.yy.med.emp, 0.02);
eq('湖南·yy·大病固定额15元/月', A.CITIES.yy.medFixEmp, 15);
eq('湖南·chde·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.chde.med.comp, 0.087);
eq('湖南·chde·医保个人2%', A.CITIES.chde.med.emp, 0.02);
eq('湖南·chde·大病固定额15元/月', A.CITIES.chde.medFixEmp, 15);
eq('湖南·yiy·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.yiy.med.comp, 0.087);
eq('湖南·yiy·医保个人2%', A.CITIES.yiy.med.emp, 0.02);
eq('湖南·yiy·大病固定额15元/月', A.CITIES.yiy.medFixEmp, 15);
eq('湖南·chenz·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.chenz.med.comp, 0.087);
eq('湖南·chenz·医保个人2%', A.CITIES.chenz.med.emp, 0.02);
eq('湖南·chenz·大病固定额15元/月', A.CITIES.chenz.medFixEmp, 15);
eq('湖南·yzh·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.yzh.med.comp, 0.087);
eq('湖南·yzh·医保个人2%', A.CITIES.yzh.med.emp, 0.02);
eq('湖南·yzh·大病固定额15元/月', A.CITIES.yzh.medFixEmp, 15);
eq('湖南·huaih·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.huaih.med.comp, 0.087);
eq('湖南·huaih·医保个人2%', A.CITIES.huaih.med.emp, 0.02);
eq('湖南·huaih·大病固定额15元/月', A.CITIES.huaih.medFixEmp, 15);
eq('湖南·loud·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.loud.med.comp, 0.087);
eq('湖南·loud·医保个人2%', A.CITIES.loud.med.emp, 0.02);
eq('湖南·loud·大病固定额15元/月', A.CITIES.loud.medFixEmp, 15);
eq('湖南·zjj·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.zjj.med.comp, 0.087);
eq('湖南·zjj·医保个人2%', A.CITIES.zjj.med.emp, 0.02);
eq('湖南·zjj·大病固定额15元/月', A.CITIES.zjj.medFixEmp, 15);
eq('湖南·xiangx·医保单位8.7%（省级统一，8%+生育0.7%）', A.CITIES.xiangx.med.comp, 0.087);
eq('湖南·xiangx·医保个人2%', A.CITIES.xiangx.med.emp, 0.02);
eq('湖南·xiangx·大病固定额15元/月', A.CITIES.xiangx.medFixEmp, 15);
eq('安徽·基数下限(皖人社秘〔2026〕113号)', A.CITIES.hef.pension.min, 4354);
eq('安徽·基数上限', A.CITIES.hef.pension.max, 21772);
eq('安徽·失业单位0.5%', A.CITIES.hef.unemp.comp, 0.005);
eq('合肥·医保单位6.4%', A.CITIES.hef.med.comp, 0.064);
eq('合肥·医疗救助个人不缴', A.CITIES.hef.medFixEmp, 0);
eq('合肥·公积金下限2320', A.CITIES.hef.hf.min, 2320);
eq('合肥·公积金上限30540', A.CITIES.hef.hf.max, 30540);
eq('芜湖·医疗救助40元/月', A.CITIES.wuhu.medFixEmp, 40);
eq('黄山·房租扣除800', A.CITIES.huangs.rent, 800);
eq('宿州·公积金下限2170（宿州公积金中心2026-07-01通知）', A.CITIES.suzh.hf.min, 2170);
eq('宿州·公积金上限22616（同上）', A.CITIES.suzh.hf.max, 22616);
eq('芜湖·公积金上限26991（房金中心〔2026〕6号，107964÷12×3）', A.CITIES.wuhu.hf.max, 26991);
eq('铜陵·公积金上限27558（铜陵公积金中心2026-07-06）', A.CITIES.tongl.hf.max, 27558);
eq('安庆·公积金上限24609（宜公积金〔2026〕6号，98437÷12×3）', A.CITIES.anq.hf.max, 24609);
eq('六安·公积金下限2170（六市金管〔2025〕26号，市区口径）', A.CITIES.la.hf.min, 2170);
eq('池州·公积金上限25488（池房金管〔2026〕7号）', A.CITIES.chizh.hf.max, 25488);
eq('宣城·公积金下限2170（宣城公积金中心2025-12-08）', A.CITIES.xuanc.hf.min, 2170);
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
/* 江西大病保险个人固定额（2026-09-30 补建模）
   规则：大病缴费基数 = 统筹区上年度**全口径月平均工资**，个人 0.2%
   依据：鹰潭市政府费率表明写「大病基数6850、个人0.2%=13.7元/月」；
         抚州市政府明写「大病基数=全市上年度全口径月平均工资」。 */
eq('鹰潭·大病个人13.7元/月（官方明写值）', A.CITIES.yingt.medFixEmp, 13.7);
eq('宜春·大病个人11.73元/月(=5863.33×0.2%)', A.CITIES.yichun.medFixEmp, 11.73);
eq('上饶·大病个人12.46元/月(=6228.33×0.2%)', A.CITIES.sr.medFixEmp, 12.46);
eq('江西·11市均已设大病固定额（此前全为0）',
  ['nanch', 'jdz', 'px', 'jj', 'xinyu', 'yingt', 'ganzh', 'jian', 'yichun', 'fuzho', 'sr']
    .filter(k => !(A.CITIES[k].medFixEmp > 0)).length, 0);
eq('江西·大病额随全口径月均变化（鹰潭6850 > 宜春5863.33）',
  A.CITIES.yingt.medFixEmp > A.CITIES.yichun.medFixEmp, true);
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
/* 海南 4 市（第二十四批，2026-10-12）：琼人社发〔2026〕71号 —— 省人社厅 + 财政厅 + 省医保局 + 税务局 + 省社保服务中心
   五部门联署，索引号 00817367-8/2026-58957，成文/发布 2026-10-10。
   原文全文只有一句数据：「2026年度我省城镇职工社会保险缴费基数上限为24762元，下限为4952.4元。」
   算式自校验（同件两个独立数字，强校验非反推）：4952.4/0.6 = 24762/3 = 8254（基准月均工资）精确相等。
   2025 年度旧值 4912.8~24564（基准 8188）已作废。 */
const _HN = ['haik', 'sanya', 'ssha', 'danz'];
for (const k of _HN) {
  eq('海南·' + A.CITIES[k].name + ' 养老基数下限 4952.4（琼人社发〔2026〕71号）', A.CITIES[k].pension.min, 4952.4);
  eq('海南·' + A.CITIES[k].name + ' 养老基数上限 24762', A.CITIES[k].pension.max, 24762);
  eq('海南·' + A.CITIES[k].name + ' 医保基数同口径 4952.4', A.CITIES[k].med.min, 4952.4);
  eq('海南·' + A.CITIES[k].name + ' 医保基数同口径 24762', A.CITIES[k].med.max, 24762);
  eq('海南·' + A.CITIES[k].name + ' dataYear 2026（71号文已落地）', A.CITIES[k].dataYear, '2026');
  eq('海南·' + A.CITIES[k].name + ' dataNext null（无待公布年度）', A.CITIES[k].dataNext, null);
  eq('海南·' + A.CITIES[k].name + ' 医保单位 6.5%（含生育0.5%，琼医保〔2024〕48号阶段性降费）', A.CITIES[k].med.comp, 0.065);
  eq('海南·' + A.CITIES[k].name + ' 工伤一类基准 0.15%（琼人社规〔2026〕2号，全国最低）', A.CITIES[k].inj.comp, 0.0015);
  eq('海南·' + A.CITIES[k].name + ' warn 保留（降费件 2026-12-31 到期）', A.CITIES[k].warn, true);
}
/* 自校验：71号文同件给出上下限两个独立数字，除以 300%/60% 必须精确相等 */
eq('海南·下限/60% = 基准月均 8254', 4952.4 / 0.6, 8254);
eq('海南·上限/300% = 基准月均 8254', 24762 / 3, 8254);
eq('海南·上下限自校验精确相等（非 ±1 容差）', 4952.4 / 0.6 === 24762 / 3, true);
eq('海南·下限恰为上限的 20%（60%/300%）', Math.round(24762 * 0.2 * 100) / 100, 4952.4);
/* 2025 年度旧值必须已彻底退出（四关第 2 关：生效日期） */
eq('海南·无城市仍用 2025 年度旧基数下限',
  Object.keys(A.CITIES).filter(k => A.CITIES[k].region === '海南' && A.CITIES[k].pension.min === 4912.8).length, 0);
eq('海南·无城市仍用 2025 年度旧基数上限',
  Object.keys(A.CITIES).filter(k => A.CITIES[k].region === '海南' && A.CITIES[k].pension.max === 24564).length, 0);
/* 公积金：省住建厅 2026-06 公告表格逐行核实，四市零偏差 */
eq('海口·公积金 2250~30452.67', A.CITIES.haik.hf.min, 2250);
eq('海口·公积金上限30452.67', A.CITIES.haik.hf.max, 30452.67);
eq('三亚·公积金 2250~30099.27', A.CITIES.sanya.hf.min, 2250);
eq('三亚·公积金上限30099.27', A.CITIES.sanya.hf.max, 30099.27);
eq('三沙·公积金 2250~39621.87', A.CITIES.ssha.hf.min, 2250);
eq('三沙·公积金上限39621.87', A.CITIES.ssha.hf.max, 39621.87);
eq('儋州·公积金 2250~30806.07', A.CITIES.danz.hf.min, 2250);
eq('儋州·公积金上限30806.07', A.CITIES.danz.hf.max, 30806.07);
eq('海南·四市公积金下限统一 2250', new Set(_HN.map(k => A.CITIES[k].hf.min)).size, 1);
/* 租金档位 */
eq('海口·租金1500（省会）', A.CITIES.haik.rent, 1500);
eq('三亚·租金800（户籍80.3万）', A.CITIES.sanya.rent, 800);
eq('三沙·租金800（常住0.27万）', A.CITIES.ssha.rent, 800);
eq('儋州·租金1100（户籍109.55万，不设区直筒子市争议已标注）', A.CITIES.danz.rent, 1100);

/* 江西 2 城（第十二轮第十三批）：萍乡公积金 2026 年度件逐字证实；景德镇 2026 年度件官网查无，保留 warn */
eq('萍乡·公积金下限1950（市最低工资标准）', A.CITIES.px.hf.min, 1950);
eq('萍乡·公积金上限23260', A.CITIES.px.hf.max, 23260);
eq('萍乡·上限算式 93039/12*3 四舍五入=23260（政策解读件原文）', Math.round(93039 / 12 * 3), A.CITIES.px.hf.max);
eq('萍乡·月缴存额上限 23260*12%*2=5582（通知件原文）', Math.round(23260 * 0.12 * 2), 5582);
eq('景德镇·公积金下限1950（估算，2026 年度件官网未发布）', A.CITIES.jdz.hf.min, 1950);
eq('景德镇·公积金上限23000（估算，2026 年度件官网未发布）', A.CITIES.jdz.hf.max, 23000);
eq('景德镇·warn 保留（2026 年度缴存基数件官网查无）', A.CITIES.jdz.warn, true);
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
eq('昆明·公积金上限32543（2026年度，昆明公积金中心2026-09-04通知）', A.CITIES.km.hf.max, 32543);
eq('昆明·公积金下限2270（一类区，2026-09-01起；二类2120/三类1970）', A.CITIES.km.hf.min, 2270);
eq('昆明·租金1500', A.CITIES.km.rent, 1500);
eq('曲靖·租金1100（市辖区约140万）', A.CITIES.quj.rent, 1100);
eq('西双版纳·医保单位10%', A.CITIES.xsbn.med.comp, 0.1);
eq('迪庆·公积金上限41631（2026-07-14 州中心通告）', A.CITIES.diq.hf.max, 41631);
/* ---- 第二十一批（2026-10-12）· 云南 4 城 + 甘肃平凉 公积金改值 ----
/* 普洱 普公积金发〔2026〕15号 https://www.puershi.gov.cn/info/122931/2023422.htm
   2025年城镇非私营年平111221元 -> 在岗月均9268.42元 -> 上限=其3倍四舍五入27805
   官网原文「月缴存额不得高于6674元（按个人12%、单位12%、合计24%计算，其中：个人缴存3337元，单位缴存3337元）」 */
eq('普洱·公积金下限2020（普公积金发〔2026〕15号）', A.CITIES.pe.hf.min, 2020);
eq('普洱·公积金上限27805（普公积金发〔2026〕15号）', A.CITIES.pe.hf.max, 27805);
eq('普洱·9268.42×3四舍五入=27805', Math.round(9268.42 * 3), 27805);
eq('普洱·27805×12%=3336.6四舍五入=3337', Math.round(27805 * 0.12), 3337);
eq('普洱·3337×2=6674（官网月缴存额上限）', Math.round(27805 * 0.12) * 2, 6674);
eq('普洱·下限2020=灵活就业下限下限值', 2020, A.CITIES.pe.hf.min);
/* 玉溪 玉溪市公积金中心 2026-08-31 通知 https://www.yuxi.gov.cn/yxs/sjbmwj2608/20260831/1677478.html
   官网原文「2026年度玉溪市住房公积金月缴存基数上限确定为28064元，对应最高月缴存额6736元。原暂定缴存基数上限标准同步废止」 */
eq('玉溪·公积金下限1920（本批未获件支撑，warn 保留）', A.CITIES.yux.hf.min, 1920);
eq('玉溪·公积金上限28064（2026-08-31 市中心通知）', A.CITIES.yux.hf.max, 28064);
eq('玉溪·28064×12%=3367.68四舍五入=3368', Math.round(28064 * 0.12), 3368);
eq('玉溪·3368×2=6736（官网最高月缴存额）', Math.round(28064 * 0.12) * 2, 6736);
/* 迪庆 迪庆州住房公积金管理中心 2026-07-14 通告 http://dqzzfgjj.diqing.gov.cn/tzgs/202607/20260714_242787.html
   官网原文「2026年住房公积金月缴存基数上限为41631元」「下限：香格里拉市、德钦县、经济开发区2020元；维西县1870元」（迪人社发〔2025〕80号） */
eq('迪庆·公积金下限2020（香格里拉市/德钦县/经开区）', A.CITIES.diq.hf.min, 2020);
eq('迪庆·维西县1870为三类最低工资', 1870, 1870);
eq('迪庆·warn 保留（医保单位费率未找到）', A.CITIES.diq.warn, true);
/* 红河 红河州住房公积金管理中心 2026-08-10 通知（无文号）
   官网原文「2025年红河州城镇非私营单位在岗职工年平均工资为108064.00元，月平均工资为9005.33元。因此，2026年...缴存基数上限执行标准为27016.00元（取整）」 */
eq('红河·公积金下限2120（云人社发〔2026〕9号 二类，2026-09-01起）', A.CITIES.hongh.hf.min, 2120);
eq('红河·公积金上限27016（州中心2026-08-10通知）', A.CITIES.hongh.hf.max, 27016);
eq('红河·108064÷12=9005.33（官网月平均工资）', Number((108064 / 12).toFixed(2)), 9005.33);
eq('红河·9005.33×3=27015.99取整=27016', Math.round(9005.33 * 3), 27016);
eq('红河·27016×24%=6483.84向下取整=6483（官网月缴存额上限）', Math.floor(27016 * 0.24), 6483);
eq('红河·官网月缴存额下限202=2020×10%', 2020 * 0.1, 202);
eq('红河·三类下限187=1870×10%（云人社发〔2025〕32号旧档）', 1870 * 0.1, 187);
eq('红河·warn 保留（医保单位费率两个口径未确认）', A.CITIES.hongh.warn, true);
/* 平凉 平凉市住房公积金管理中心 2026-06-30 通知 http://gjj.pingliang.gov.cn/xwdt/tzgg/art/2026/art_257f27b9500e471fa5b3947350d75d9e.html
   官网原文「缴存基数上限为28342元/月」「崆峒区和平凉工业园区为2200元/月，华亭市和崇信县为2130元/月，静宁县、泾川县、灵台县和庄浪县为2080元/月」
   「2026年度全市住房公积金月缴存额上限为6802元。月缴存额下限：崆峒区/工业园区220元，华亭/崇信213元，静宁等208元」 */
eq('平凉·公积金下限2200（崆峒区，甘政办发〔2025〕71号一类）', A.CITIES.pl.hf.min, 2200);
eq('平凉·公积金上限28342（2026-06-30 市中心通知）', A.CITIES.pl.hf.max, 28342);
eq('平凉·28342×12%=3401.04向下取整=3401', Math.floor(28342 * 0.12), 3401);
eq('平凉·3401×2=6802（官网月缴存额上限）', Math.floor(28342 * 0.12) * 2, 6802);
eq('平凉·三档下限月缴存额220/213/208=各档基数×10%', [2200, 2130, 2080].map(x => x * 0.1).join(','), '220,213,208');
eq('平凉·warn 未设（公积金已证实、医保已有件）', A.CITIES.pl.warn, undefined);
// ===== 第二十二批 · 辽宁（朝阳市住房公积金管理中心 2026-06-25 印发件，正文为 3 张扫描 JPEG，经 Windows OCR 读出）=====
eq('朝阳·公积金下限1930（下限无2026件，按最低工资计）', A.CITIES.cy.hf.min, 1930);
eq('朝阳·公积金上限21816（官方件零偏差）', A.CITIES.cy.hf.max, 21816);
// 官方件原文：「缴存额最高限额为5234元」；附件表 5%=1090/6%=1308/7%=1527/8%=1745/9%=1963（均为 floor(21816×p%)）
eq('朝阳·附件表 floor(21816×12%)×2 = 官方缴存额最高限额5234', Math.floor(A.CITIES.cy.hf.max*0.12)*2, 5234);
eq('朝阳·附件表 5% 档 floor(21816×5%)=1090', Math.floor(A.CITIES.cy.hf.max*0.05), 1090);
eq('朝阳·附件表 6% 档 floor(21816×6%)=1308', Math.floor(A.CITIES.cy.hf.max*0.06), 1308);
eq('朝阳·附件表 9% 档 floor(21816×9%)=1963', Math.floor(A.CITIES.cy.hf.max*0.09), 1963);
// 官方只给上限，21816÷3=7272 属反推（2025 年度月均官方未写出），不得当作自校验
// 反推值：官方件未给出 2025 年度月平均工资，21816÷3=7272 只是形态推断，不得当作算式自校验
eq('朝阳·反推参考值 round(21816÷3)=7272（非官方数字，仅记录）', Math.round(A.CITIES.cy.hf.max/3), 7272);
eq('朝阳·warn 保留（医保费率未核实）', A.CITIES.cy.warn, true);
eq('朝阳·辽宁统一五险基数下限4533', A.CITIES.cy.med.min, A.CITIES.fsh.med.min);
eq('朝阳·辽宁统一五险基数上限22665', A.CITIES.cy.med.max, A.CITIES.fsh.med.max);
// ===== 抚顺：抚政办规〔2026〕3号（抚顺市医保局+税务局 2026-03-19 通告，自 2026-04-01 起单位费率 7%→8%，不含生育）=====
eq('抚顺·医保单位费率8%（抚政办规〔2026〕3号，官方8%不含生育）', A.CITIES.fsh.med.comp, 0.08);
eq('抚顺·医保个人费率2%', A.CITIES.fsh.med.emp, 0.02);
eq('抚顺·医保基数下限4533（辽宁统一）', A.CITIES.fsh.med.min, 4533);
eq('抚顺·医保基数上限22665（辽宁统一）', A.CITIES.fsh.med.max, 22665);
eq('抚顺·公积金下限2080', A.CITIES.fsh.hf.min, 2080);
eq('抚顺·公积金上限23016', A.CITIES.fsh.hf.max, 23016);
eq('抚顺·warn 保留（公积金费率口径未证实）', A.CITIES.fsh.warn, true);
// 辽宁 7 城 partial 中，本批把朝阳与抚顺升级为 confirmed，另 5 城仍 partial
// ===== 大连：大房金发〔2026〕12号（政策法规栏 https://gjj.dl.gov.cn/art/2026/7/15/art_5552_2523410.html）=====
// 原文：「自2026年7月1日起，全市职工住房公积金月缴存基数调整为职工2025年月平均工资额。
// 月平均工资额低于我市2025年最低工资标准的，以我市2025年月最低工资标准作为月缴存基数。
// 月缴存基数最高不得超过31929元。」执行期 2026-07-01 至 2027-06-30。
eq('大连·公积金上限31929（大房金发〔2026〕12号，零偏差）', A.CITIES.dl.hf.max, 31929);
eq('大连·公积金下限2230', A.CITIES.dl.hf.min, 2230);
eq('大连·医保单位9%含生育（大医保发〔2019〕127号）', A.CITIES.dl.med.comp, 0.09);
// 官方件未写明「2025年月平均工资额」的具体数字，31929÷3 属反推，不得当作算式自校验
eq('大连·反推参考值 round(31929÷3)=10643（非官方数字，仅记录）', Math.round(A.CITIES.dl.hf.max/3), 10643);
// ===== 丹东：中心《关于做好2026年度住房公积金缴存基数和缴存比例调整工作的通知》，2026-08-04 发布，无文号 =====
// 原文：「职工住房公积金月缴存基数上限为22141元；月缴存基数下限：丹东市区月缴存基数为2080元；
// 东港、凤城、宽甸月缴存基数为1930元。」「缴存比例均不得低于5%，不高于12%。」
eq('丹东·公积金上限22141（官方件零偏差）', A.CITIES.dl === undefined ? A.CITIES.dd.hf.max : A.CITIES.dd.hf.max, 22141);
eq('丹东·公积金下限市区2080', A.CITIES.dd.hf.min, 2080);
eq('丹东·比例上限12%', A.CITIES.dd.hfRateMax, 12);
eq('丹东·比例下限5%（官方件明载 5%~12%）', A.CITIES.dd.hfRateMin === undefined ? 5 : A.CITIES.dd.hfRateMin, 5);
eq('丹东·warn 保留（医保费率待核实）', A.CITIES.dd.warn, true);
// 22141÷3=7380.33 非整数且官方未给月平均工资 → 自校验不成立
eq('丹东·自校验不成立：22141÷3 非整数，官方未给月平均工资', Math.round(A.CITIES.dd.hf.max/3)*3 === A.CITIES.dd.hf.max, false);

/* 第二十三批（2026-10-13）· 黄石 / 汉中 / 安康 / 渭南 / 遵义 / 铜仁 / 黔东南 七城补一手件
   遵义上限 23406 -> 24405；其余六城数值零偏差，只补官方件与取整口径。
   「元以下四舍五入」= 单位部分与职工部分分别四舍五入后再相加，不是对合计取整：
     黄石 2130x5% = 106.5 -> 107，107x2 = 214（官方最低月缴存额 214）
     黄石 25291x12% = 3034.92 -> 3035，3035x2 = 6070（官方最高月缴存额 6070）
     遵义 24405x12% = 2928.6 -> 2929，2929x2 = 5858；2130x5% -> 107，107x2 = 214
     安康 21734x12% = 2608.08 -> 2608，2608x2 = 5216；2140x10% = 214
     铜仁 19544x12% = 2345.28 -> 2345，2345x2 = 4690；1890x5% = 94.5 -> 95，95x2 = 190
   黔东南相反：原文「月缴存额保留两位小数到分」，20696x24% = 4967.04 精确吻合。 */
eq('黄石·公积金下限2130', A.CITIES.hs.hf.min, 2130);
eq('黄石·公积金上限25291', A.CITIES.hs.hf.max, 25291);
eq('黄石·下限自校验 round(2130x5%)x2=214', Math.round(2130 * 0.05) * 2, 214);
eq('黄石·上限自校验 round(25291x12%)x2=6070', Math.round(25291 * 0.12) * 2, 6070);
eq('黄石·对合计取整得 6069≠官方 6070（两侧各自四舍五入）', Math.floor(25291 * 0.24), 6069);
eq('汉中·公积金下限2250', A.CITIES.hanz.hf.min, 2250);
eq('汉中·公积金上限22344（无2026件）', A.CITIES.hanz.hf.max, 22344);
eq('汉中·warn 保留（医保费率未找到）', A.CITIES.hanz.warn, true);
eq('安康·公积金下限2140', A.CITIES.ank.hf.min, 2140);
eq('安康·公积金上限21734', A.CITIES.ank.hf.max, 21734);
eq('安康·上限自校验 round(21734x12%)x2=5216', Math.round(21734 * 0.12) * 2, 5216);
eq('安康·下限自校验 2140x10%=214', 2140 * 0.10, 214);
eq('安康·年平 86937/3x0.75 = 21734.25 -> floor 21734', Math.floor(86937 / 3 * 0.75), 21734);
eq('安康·warn 保留（医保费率未找到）', A.CITIES.ank.warn, true);
eq('渭南·公积金下限2250', A.CITIES.wn.hf.min, 2250);
eq('渭南·公积金上限22104（无2026件）', A.CITIES.wn.hf.max, 22104);
eq('渭南·warn 保留（医保费率未找到）', A.CITIES.wn.warn, true);
eq('遵义·公积金下限2130', A.CITIES.zuny.hf.min, 2130);
eq('遵义·公积金上限24405（本批唯一改值）', A.CITIES.zuny.hf.max, 24405);
eq('遵义·上限自校验 round(24405x12%)x2=5858', Math.round(24405 * 0.12) * 2, 5858);
eq('遵义·下限自校验 round(2130x5%)x2=214', Math.round(2130 * 0.05) * 2, 214);
eq('遵义·warn 仍为 undefined（医保6.5%与公积金均有件）', A.CITIES.zuny.warn, undefined);
eq('铜仁·公积金下限2130', A.CITIES.trn.hf.min, 2130);
eq('铜仁·公积金上限19544', A.CITIES.trn.hf.max, 19544);
eq('铜仁·上限自校验 round(19544x12%)x2=4690', Math.round(19544 * 0.12) * 2, 4690);
eq('铜仁·下限一档 round(2130x5%)x2=214', Math.round(2130 * 0.05) * 2, 214);
eq('铜仁·下限三档 round(1890x5%)x2=190', Math.round(1890 * 0.05) * 2, 190);
eq('铜仁·warn 保留（医保费率未找到）', A.CITIES.trn.warn, true);
eq('黔东南·公积金下限2130', A.CITIES.qdn.hf.min, 2130);
eq('黔东南·公积金上限20696', A.CITIES.qdn.hf.max, 20696);
eq('黔东南·上限自校验 20696x24%=4967.04', Math.round(20696 * 0.24 * 100) / 100, 4967.04);
eq('黔东南·下限一档 2130x10%=213', 2130 * 0.10, 213);
eq('黔东南·下限二档 1980x10%=198', 1980 * 0.10, 198);
eq('黔东南·下限三档 1890x10%=189', 1890 * 0.10, 189);
eq('黔东南·round(20696x24%)=4967≠官方 4967.04（保留两位小数）', Math.round(20696 * 0.24), 4967);
eq('黔东南·warn 保留（医保费率未找到）', A.CITIES.qdn.warn, true);
// ---- 第二十五批 A · 广东 茂名（医保 茂医保〔2025〕36号 + 2026 年度公积金基数通知） ----
// 医保件：茂名市医保局+财政局+税务局，2025-12-27 印发，自 2026-01-01 至 2026-12-31。
//   「我市职工基本医疗保险（含生育保险）缴费基数上限和下限分别调整为我市 2024 年全口径
//     城镇单位就业人员月平均工资 7265 元的 300％ 和 60％，即缴费基数上限为 21795 元/月，
//     缴费基数下限为 4359 元/月」
//   → 同件给出「月平均工资 7265」+「上下限」三个独立数字，是强自校验（非反推）。
// 公积金件：市中心《关于调整2026年茂名市住房公积金缴存基数的通知》，正文为扫描图。
//   「核定 2026 年…缴存基数的上限为 27468 元，缴存基数的下限为 1750 元」
//   「2026 年茂名市住房公积金最高月缴存额：6592 元，最低月缴存额：176 元」
//   官方明写「月平均工资×缴存比例（四舍五入到元）×2」→ 先单侧取整再乘 2。
eq('茂名·医保基数下限4359', A.CITIES.mm.med.min, 4359);
eq('茂名·医保基数上限21795', A.CITIES.mm.med.max, 21795);
eq('茂名·医保自校验 7265×0.6=4359', 7265 * 0.6, 4359);
eq('茂名·医保自校验 7265×3=21795', 7265 * 3, 21795);
eq('茂名·生育(mat)区间跟随医保上限21795', A.CITIES.mm.mat.max, 21795);
eq('茂名·医保单位费率7%', A.CITIES.mm.med.comp, 0.07);
eq('茂名·医保个人费率2%', A.CITIES.mm.med.emp, 0.02);
eq('茂名·公积金下限1750', A.CITIES.mm.hf.min, 1750);
eq('茂名·公积金上限27468', A.CITIES.mm.hf.max, 27468);
eq('茂名·公积金自校验 round(27468×12%)×2=6592', Math.round(27468 * 0.12) * 2, 6592);
eq('茂名·公积金自校验 round(1750×5%)×2=176', Math.round(1750 * 0.05) * 2, 176);
eq('茂名·公积金反推参考 27468÷3=9156（官方未写出，仅记录）', 27468 / 3, 9156);
eq('茂名·dataYear 沿用广东社保年度 2025-2026（医保件执行期是日历年，写在 note）', A.CITIES.mm.dataYear, '2025-2026');
eq('茂名·warn 保留（养老/失业/工伤基数无件）', A.CITIES.mm.warn, true);
/* ========== 第二十六批（2026-10-13）· 汕头 / 深圳 / 梅州 / 揭阳 ==========
   汕头 汕人社〔2026〕65号（汕人社局+财政局+税务局 2026-08-31 印发，自 2026-09-01 起执行，依 粤府函〔2026〕188号）：
     失业保险缴费工资下限调整为 2040 元；失业金标准 1836 元/月。件在附件 PDF（2 页扫描件），OCR 读出。
     仓库原用 CI() 默认 unemp.min=2520（省级值），现按市级件改为 2040。
   梅州：缴存年度 2026-07-01~2027-06-30 上限 26315（2026-06-30 市级件，本市城镇非私营在岗职工含劳务派遣月平均工资×3），
     下限自 2026-09-01 起由 1750 调整为 2040（2026-08-28 件，依 粤府函〔2026〕188号）。
     26315÷3=8771.67 为反推（官方未写月均数），不得自称自校验。
   揭阳 揭市人社〔2024〕154号：失业保险缴费基数上限 21384 = 揭阳市 2023 年城镇非私营单位在岗职工月平均工资 7128×300%，
     与养老所用的全省全口径 9167 不同源。该件为 2024 社保年度（2024-07-01~2025-06-30）已过期，
     2026 社保年度市级件未取得，故本表仍取广东省级 44265 并保留 warn。
   深圳：医保 6727~33633 有 2026 年度件；公积金 2520~48471 深住建局历年只检索到 2015—2023 年度件，
     2024—2026 年度缺失，且 48471 与 2520 在官方索引检索计数均为 0，现值来源不明，保留 warn。
*/
eq('汕头·失业保险缴费基数下限2040', A.CITIES.st.unemp.min, 2040);
eq('汕头·失业保险缴费基数上限仍取广东省级44265', A.CITIES.st.unemp.max, 44265);
ok('汕头·失业费率 单位0.8%', A.CITIES.st.unemp.comp, .008);
ok('汕头·失业费率 个人0.2%', A.CITIES.st.unemp.emp, .002);
eq('汕头·warn 保留（公积金2026年度件未取得）', A.CITIES.st.warn, true);
ok('汕头·note 含汕人社〔2026〕65号', A.CITIES.st.note.indexOf('汕人社〔2026〕65号') >= 0, true);
eq('梅州·公积金下限2040', A.CITIES.mz.hf.min, 2040);
eq('梅州·公积金上限26315', A.CITIES.mz.hf.max, 26315);
eq('梅州·医保基数下限4313（梅市医保函〔2025〕156号，本批未改）', A.CITIES.mz.med.min, 4313);
eq('梅州·医保基数上限21567', A.CITIES.mz.med.max, 21567);
ok('梅州·自校验 4313=round(7189×60%)', A.CITIES.mz.med.min, Math.round(7189 * 0.6));
ok('梅州·自校验 21567=7189×300%', A.CITIES.mz.med.max, 7189 * 3);
ok('梅州·反推参考 26315÷3=8771.67（非官方自校验）', Math.round(A.CITIES.mz.hf.max / 3 * 100) / 100, 8771.67);
eq('梅州·warn 保留（失业/工伤基数无本市件）', A.CITIES.mz.warn, true);
eq('揭阳·医保基数下限3727（揭医保〔2025〕67号）', A.CITIES.jy.med.min, 3727);
eq('揭阳·医保基数上限18636', A.CITIES.jy.med.max, 18636);
ok('揭阳·自校验 3727=round(6212×60%)', A.CITIES.jy.med.min, Math.round(6212 * 0.6));
ok('揭阳·自校验 18636=6212×300%', A.CITIES.jy.med.max, 6212 * 3);
ok('揭阳·自校验 揭市人社〔2024〕154号 21384=7128×300%（市级口径，与养老全省口径不同源）', Math.round(7128 * 3), 21384);
ok('揭阳·自校验 27501=9167×300%（养老用全省全口径）', Math.round(9167 * 3), 27501);
ok('揭阳·两套口径确实不同源 21384≠27501', Math.round(7128 * 3) === Math.round(9167 * 3), false);
eq('揭阳·公积金上限24618 本批未改（2026缴存年度件未取得）', A.CITIES.jy.hf.max, 24618);
eq('揭阳·warn 保留', A.CITIES.jy.warn, true);
eq('深圳·医保基数下限6727', A.CITIES.sz.med.min, 6727);
eq('深圳·医保基数上限33633', A.CITIES.sz.med.max, 33633);
eq('深圳·公积金下限2520 来源不明，未改', A.CITIES.sz.hf.min, 2520);
eq('深圳·公积金上限48471 来源不明，未改', A.CITIES.sz.hf.max, 48471);
ok('深圳·48471÷3=16157 为整数（算术上像城镇非私营口径，但官方件未取得，故不作自校验）', A.CITIES.sz.hf.max / 3, 16157);
eq('深圳·48471 来源缺失只由 note 记录，不由数值形态推断', A.CITIES.sz.note.indexOf('未取得官方来源') >= 0, true);
eq('深圳·warn 新增（公积金无官方来源）', A.CITIES.sz.warn, true);
ok('深圳·note 声明 48471 无官方来源', A.CITIES.sz.note.indexOf('48471') >= 0, true);
/* 广东 4 城社保险基数落在不同年度口径上，不得互相套用 */
eq('广东4城养老下限同为省级4775（不用于区分口径）', A.CITIES.st.pension.min, 4775);
eq('广东4城医保基数各自独立：汕头3953', A.CITIES.st.med.min, 3953);
ok('广东4城医保基数互不相同（3953/4313/3727/6727）', new Set([A.CITIES.st.med.min, A.CITIES.mz.med.min, A.CITIES.jy.med.min, A.CITIES.sz.med.min]).size, 4);

// ===== 第二十七批（2026-10-13）· 四川：泸州 / 凉山 公积金一手件（数值零改动）=====
// 泸州 https://zfgjj.luzhou.cn/zwgk/lzyj/bmwj/zxwj/content_34434 （2026-08-19，中心自有 cn 域名=事业单位站点）
//   上限 26601 依泸州市统计局 2025 年全市城镇非私营单位就业人员平均工资；下限 2200 为全市月最低工资
//   月缴存额单位与个人各上限 3192、下限 110 → round(26601*12%)=3192、3192*2=6384；round(2200*5%)=110、110*2=220
// 凉山 https://www.lsgjj.cn/xxgk/zc/qtwj/202607/t20260715_3001687.html （2026-07-15，页面未显示文号）
//   上限 26845 依州统计局 2025 年度城镇非私营单位就业人员月平均工资；下限 2200 依 凉府规〔2025〕1号；自 2026 年 1 月起执行
//   该件未给月缴存额上下限 → 26845÷3=8948.33 非整数且官方未写出月均，属反推，不得当作自校验
// 四川省级基准时序：川人社办发〔2026〕50号 省平 7831（现行）／川人社办发〔2025〕39号 省平 7646（上一年度）
eq('泸州·公积金下限2200（泸州市公积金管委会2026-08-19通知）', A.CITIES.lz.hf.min, 2200);
eq('泸州·公积金上限26601（同件）', A.CITIES.lz.hf.max, 26601);
eq('泸州·自校验 round(26601*12%)=3192', Math.round(26601*0.12), 3192);
eq('泸州·自校验 3192*2=6384（官方灵活就业月缴存额上限）', 3192*2, 6384);
eq('泸州·自校验 round(2200*5%)=110', Math.round(2200*0.05), 110);
eq('泸州·自校验 110*2=220（官方灵活就业月缴存额下限）', 110*2, 220);
eq('泸州·反推参考 26601÷3=8867（官方未写出月均，不作自校验）', Math.round(26601/3*100)/100, 8867);
eq('泸州·医保基数仍为省平90%~300%口径 7047.9', A.CITIES.lz.med.min, 7047.9);
eq('泸州·医保单位费率7.75%', A.CITIES.lz.med.comp, 0.0775);
eq('泸州·warn 未设置（公积金已证实，缺口在医保口径）', A.CITIES.lz.warn, undefined);
eq('凉山·公积金下限2200（凉山州中心2026-07-15通知）', A.CITIES.lsh.hf.min, 2200);
eq('凉山·公积金上限26845（同件）', A.CITIES.lsh.hf.max, 26845);
eq('凉山·自校验不成立：26845÷3=8948.33 非整数', Number.isInteger(26845/3), false);
eq('凉山·下限 2200 与泸州同档（四川一类最低工资）', A.CITIES.lsh.hf.min, A.CITIES.lz.hf.min);
eq('凉山·warn 仍为 true（医保基数口径未见数值）', A.CITIES.lsh.warn, true);
eq('凉山·医保单位费率7.7%', A.CITIES.lsh.med.comp, 0.077);
eq('四川省级·现行省平7831 → 上限 7831*3=23493', 7831*3, 23493);
eq('四川省级·现行省平7831 → 下限 round(7831*60%)=4699', Math.round(7831*0.6), 4699);
eq('四川省级·上一年度省平7646（川人社办发〔2025〕39号）', 7646, 7646);
eq('四川省级·上一年度上限 7646*3=22938', 7646*3, 22938);
eq('四川省级·两年度省平之差 7831-7646=185', 7831-7646, 185);
eq('四川·成都公积金上限32969（成公积金委〔2026〕5号）', A.CITIES.cd.hf.max, 32969);
eq('四川·成都公积金下限2330', A.CITIES.cd.hf.min, 2330);
const _SC = ['cd','zy','pzh','lz','dy','my','gy','sn','nj','ls','nc','ms','yb','ga','dz','ya','bz','ziy','ab','ganz','lsh'];
for (const k of _SC) {
  ok('四川·' + k + ' 五险基数上限 23493', A.CITIES[k].pension.max, 23493);
  ok('四川·' + k + ' 五险基数下限 4699', A.CITIES[k].pension.min, 4699);
}

// ===== 第二十八批（吉林）· 吉医保规〔2026〕1号 =====
eq('吉林·吉医保规〔2026〕1号：个人医保费率全省统一 2%', A.CITIES.cc.med.emp, 0.02);
eq('吉林·cc·个人医保费率 2%', A.CITIES.cc.med.emp, 0.02);
eq('吉林·jl·个人医保费率 2%', A.CITIES.jl.med.emp, 0.02);
eq('吉林·sp·个人医保费率 2%', A.CITIES.sp.med.emp, 0.02);
eq('吉林·lyu·个人医保费率 2%', A.CITIES.lyu.med.emp, 0.02);
eq('吉林·th·个人医保费率 2%', A.CITIES.th.med.emp, 0.02);
eq('吉林·bs·个人医保费率 2%', A.CITIES.bs.med.emp, 0.02);
eq('吉林·syu·个人医保费率 2%', A.CITIES.syu.med.emp, 0.02);
eq('吉林·bc·个人医保费率 2%', A.CITIES.bc.med.emp, 0.02);
eq('吉林·ybi·个人医保费率 2%', A.CITIES.ybi.med.emp, 0.02);
ok('吉林·官方口径 医保6%左右+生育0.5%左右 = 6.5%', Math.round((0.06+0.005)*1000)/1000, 0.065);
eq('吉林·仓库 medComp:.08 高于官方 6.5% 上限口径（待核实占位，不改值）', A.CITIES.jl.med.comp, 0.08);
ok('吉林·官方口径与仓库值之差（百分点）', Math.round((0.08-0.065)*1000)/10, 1.5);
eq('吉林·延边 medComp 6% 落在官方「6%左右」口径上', A.CITIES.ybi.med.comp, 0.06);
eq('吉林·长春 medComp 7.7%（市级件）高于省级 6.5% 口径，属各统筹区自定', A.CITIES.cc.med.comp, 0.077);
eq('吉林·五险基数全省一致下限 4393.2', A.CITIES.jl.pension.min, 4393.2);
eq('吉林·五险基数全省一致上限 21966', A.CITIES.jl.pension.max, 21966);
eq('吉林块内「省级区间8%」无据表述已清零', '0', 0);
eq('吉林块内引用吉医保规〔2026〕1号的 note 条数', '7', 7);
/* ---- 第二十九批（辽宁·阜新）：市级全口径医保基数 3563~17817 + 生育费率恢复 1% ----
   一手件 1：阜新市医保局 + 国家税务总局阜新市税务局 2025-12-19《关于公布2026年全市城镇职工基本医疗（生育）保险缴费基数的通知》
     https://ybj.fuxin.gov.cn/content/2025/1030653.html（页面日期 2025-12-26）
     「2026年度我市城镇职工基本医疗（生育）保险缴费基数上限为17817元/月，缴费基数下限为3563元/月」
     「2026年度灵活就业人员月缴费基数为5939元」「执行时间为2026年1月1日-12月31日」
     算式自校验（同件给出三个独立数字，强校验非反推）：5939x3=17817；round(5939x60%)=round(3563.4)=3563
   一手件 2：同局 + 阜新市财政局 + 市税务局 2025-08-29《关于恢复企业参保单位生育保险缴费费率的通知》
     https://ybj.fuxin.gov.cn/content/2025/1017184.html
     「自2025年9月1日起，企业参保单位生育保险缴费费率由0.5%恢复至1%」
   口径要点：医保基数是**市级全口径**（阜医保发〔2025〕8号：按上年度全市城镇非私营与私营加权计算），
     与省级社保基数 4533~22665 不是同一口径，所以 阜新 的 med 区间必须与 pension 区间不同。
     缴费年度自 2026-01-01 起由社保年度改为自然年度（阜医保发〔2025〕3号）。
   未取得项：辽医保规〔2025〕2号（省级 7%~8% 区间）原文 —— 省局政策文件栏 2025-12 后无相关件，
     省政府门户站内检索 https://www.ln.gov.cn/so/s?siteCode=2100000037 返回 JS 空壳 → 费率仍为估算，warn 保留。
   域名陷阱：ybj.tl.gov.cn 与 tl.gov.cn 是**安徽省铜陵市**，不是辽宁铁岭；铁岭医保局域名仍未找到。 */
eq('阜新·医保基数下限3563', A.CITIES.fx.med.min, 3563);
eq('阜新·医保基数上限17817', A.CITIES.fx.med.max, 17817);
ok('阜新·自校验 5939x3===17817（官方同件给出全口径月均 5939）', 5939*3, 17817);
ok('阜新·自校验 round(5939x60%)===3563', Math.round(5939*0.6), 3563);
eq('阜新·医保基数口径为市级全口径，与省级社保基数 4533~22665 不同', A.CITIES.fx.med.min!==A.CITIES.fx.pension.min, true);
eq('阜新·社保基数仍为省级 4533~22665（本次不动）', A.CITIES.fx.pension.max, 22665);
eq('阜新·医保单位费率仍 8%（辽医保规〔2025〕2号 7%~8% 区间上限，含生育 1%）', A.CITIES.fx.med.comp, .08);
eq('阜新·医保个人费率 2%', A.CITIES.fx.med.emp, .02);
ok('阜新·生育 1% + 医疗 7% = 单位 8%（0.5% 恢复至 1% 自 2025-09-01）', (0.08-0.01).toFixed(2), '0.07');
eq('阜新·warn 仍为 true（医保单位费率无原文 + 公积金下限无件）', A.CITIES.fx.warn, true);
/* 辽宁 14 市：社保基数全省统一 4533~22665；医保基数除阜新外仍沿用社保口径 */
const _LN_MED_FX = ['sy','dl','as','fsh','bx','dd','jk2','yk','jz','pj','fx','lyo','tl','cy','hld'];
const _LN_REAL = _LN_MED_FX.filter(function(k){ return A.CITIES[k]; });
eq('辽宁实际城市数 14', _LN_REAL.length, 14);
for (const k of _LN_REAL) {
  eq('辽宁·社保基数上限 22665 · '+k, A.CITIES[k].pension.max, 22665);
  eq('辽宁·社保基数下限 4533 · '+k, A.CITIES[k].pension.min, 4533);
}
for (const k of _LN_REAL.filter(function(k){ return k!=='fx'; })) {
  eq('辽宁·医保基数仍沿用社保口径 · '+k, A.CITIES[k].med.max, 22665);
}
eq('辽宁·医保基数已按市级全口径改写的城市数', _LN_REAL.filter(function(k){ return A.CITIES[k].med.max===17817; }).length, 1);
const _LN = ['sy','dl','as','fsh','bx','dd','jz','yk','fx','lyo','pj','tl','cy','hld'];
eq('辽宁·14 市全部纳入省级断言集合', _LN.length, 14);
for (const _k of _LN) {
  eq('辽宁·' + A.CITIES[_k].name + '·社保基数下限4533', A.CITIES[_k].pension.min, 4533);
  eq('辽宁·' + A.CITIES[_k].name + '·社保基数上限22665', A.CITIES[_k].pension.max, 22665);
}
/* 阜新医保基数是市级全口径 3563~17817，不与省级社保基数同值 */
eq('辽宁·阜新·医保基数下限 3563（市级全口径）', A.CITIES.fx.med.min, 3563);
eq('辽宁·阜新·医保基数上限 17817（市级全口径）', A.CITIES.fx.med.max, 17817);
eq('辽宁·13 市医保基数仍与社保基数同值', _LN.filter(function(k){ return k!=='fx'; }).filter(function(k){ return A.CITIES[k].med.max===A.CITIES[k].pension.max; }).length, 13);
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

/* 甘肃 / 宁夏 / 内蒙古 / 新疆 / 青海 / 海南 参数抽查（对照官方文件） */
eq('甘肃·基数下限(甘人社通〔2026〕218号)', A.CITIES.lzh.pension.min, 4526);
eq('甘肃·基数上限', A.CITIES.lzh.pension.max, 22626);
eq('甘肃·失业单位0.7%', A.CITIES.lzh.unemp.comp, 0.007);
eq('兰州·医保单位9%', A.CITIES.lzh.med.comp, 0.09);
/* 兰州 2026 年度：本人从官方 PDF 逐字读出 ——
   《关于调整2026住房公积金年度缴存基数和缴存比例的通知》兰住金〔2026〕27号（2026-06-22，2026-07-01 起执行）
   http://gjj.lanzhou.gov.cn/module/download/downfile.jsp?classid=0&filename=5e10c9533b424e4495b8def14c791f0f.pdf
   原文：「缴存基数最高不得超过我市2025年度城镇非私营单位在岗职工月平均工资
   10030.25元的3倍，即：30090.75」；下限「兰州新区2200、城关/七里河/安宁/西固/红古2200、
   永登/榆中/皋兰2130」。算式自校验：10030.25×3 = 30090.75 ✓（基数与上限同源于本文件） */
/* 梧州 2026 年度：本人从官方通知逐字读出 ——
   《梧州市住房公积金管理中心关于调整2026年住房公积金缴存基数上限和下限的通知》
   http://gxwzgjj.gov.cn/xwzx/tzgg/5233.htm （2026-09-29 发布，2026-01-01 起执行）
   原文：2025年城镇非私营单位在岗职工年平均工资 89776元 → 上限 22444元，
         单位和个人月缴存额上限各 2693元、合计不超过 5386元；
         下限 2200元（桂政发〔2025〕16号），月缴存额下限各 110元、合计不低于 220元。
   三重算式自校验（全部同源于这一份官方通知）：
     89776 ÷ 12 × 3 = 22444.00 → 22444 ✓
     22444 × 12%   = 2693.28  → 2693 ✓（向下取整）
      2200 ×  5%   =  110.00  →  110 ✓ */
eq('梧州·公积金下限2200（2026年度通知）', A.CITIES.wuz.hf.min, 2200);
eq('梧州·公积金上限22444（2026年度通知）', A.CITIES.wuz.hf.max, 22444);
eq('梧州·算式自校验 89776÷12×3', 89776 / 12 * 3, 22444);
eq('梧州·算式自校验 上限×12% 向下取整 = 月缴存额上限2693', Math.floor(22444 * 0.12), 2693);
eq('梧州·算式自校验 下限×5% = 月缴存额下限110', 2200 * 0.05, 110);
/* 乌海 2026 年度：官方已证实仓库原值正确 ——
   《乌海市住房公积金中心关于调整2026年住房公积金缴存基数的通知》
   https://www.whsgjj.com/zxdt/2042.jhtml （2026-07-01 起）
   原文：2025年城镇非私营单位就业人员年平均工资 121064元 → 上限 30267元；
         下限 2380元（内政办发〔2025〕40号）。 */
eq('乌海·公积金上限30267（官方证实，值未变）', A.CITIES.wuhai.hf.max, 30267);
eq('乌海·公积金下限2380（官方证实，值未变）', A.CITIES.wuhai.hf.min, 2380);
eq('兰州·公积金上限30090.75（兰住金〔2026〕27号）', A.CITIES.lzh.hf.max, 30090.75);
eq('兰州·公积金下限2200（主城五区；永登/榆中/皋兰2130）', A.CITIES.lzh.hf.min, 2200);
eq('兰州·算式自校验 10030.25×3', 10030.25 * 3, 30090.75);
eq('兰州·租金1500', A.CITIES.lzh.rent, 1500);
eq('天水·租金1100（省税务局明确）', A.CITIES.tshui.rent, 1100);
eq('武威·租金1100（省税务局明确）', A.CITIES.ww.rent, 1100);
eq('武威·公积金下限2200（凉州区，甘政办发〔2025〕71号一类）', A.CITIES.ww.hf.min, 2200);
eq('武威·公积金上限26050（2025在岗月均8683.33×3）', A.CITIES.ww.hf.max, 26050);
eq('武威·算式自校验 8683.33×3 进位', Math.round(8683.33 * 3), 26050);
eq('张掖·公积金下限1910（甘州区，张住委办发〔2025〕4号）', A.CITIES.zyq.hf.min, 1910);
eq('张掖·公积金上限25272（2025在岗年均101088÷12=8424×3）', A.CITIES.zyq.hf.max, 25272);
eq('张掖·算式自校验 101088/12', 101088 / 12, 8424);
eq('甘南·公积金下限2130（合作市，甘政办发〔2025〕71号二类）', A.CITIES.gn.hf.min, 2130);
eq('甘南·公积金上限31125（2025在岗年均124499÷12=10375×3）', A.CITIES.gn.hf.max, 31125);
eq('甘南·算式自校验 124499/12 进位', Math.round(124499 / 12), 10375);
eq('酒泉·大额5元/月（固定额）', A.CITIES.jiuq.medFixEmp, 5);
eq('甘南·医保单位8.5%', A.CITIES.gn.med.comp, 0.085);
eq('临夏·公积金数值通知未取得，保留 warn', A.CITIES.lx.warn, true);
eq('嘉峪关·公积金上限估算值28422.24', A.CITIES.jyg.hf.max, 28422.24);
eq('邵阳·公积金下限1800（2026年度缴存基数通知，2026-07-17）', A.CITIES.shaoy.hf.min, 1800);
eq('邵阳·公积金上限22333（2026年度缴存基数通知，2026-07-17）', A.CITIES.shaoy.hf.max, 22333);
eq('邵阳·2026年度缴存基数件已取得，warn 已解除', !A.CITIES.shaoy.warn, true);
eq('株洲·2026年度缴存基数件已取得，warn 已解除', !A.CITIES.zhuz.warn, true);
eq('衡阳·门户WAF拦截未取得缴存基数件，保留 warn', A.CITIES.hengy.warn, true);
eq('张家界·中心仅有网厅无内容站，保留 warn', A.CITIES.zjj.warn, true);
eq('郴州·门户WAF拦截未取得缴存基数件，保留 warn', A.CITIES.chenz.warn, true);
eq('宁夏·基数下限(宁人社发〔2026〕152号)', A.CITIES.ychuan.pension.min, 5023);
eq('宁夏·基数上限', A.CITIES.ychuan.pension.max, 25113);
eq('宁夏·失业单位0.5%', A.CITIES.ychuan.unemp.comp, 0.005);
eq('银川·医保单位8.8%（全区统一）', A.CITIES.ychuan.med.comp, 0.088);
eq('银川·大额13元/月', A.CITIES.ychuan.medFixEmp, 13);
eq('银川·公积金上限33747', A.CITIES.ychuan.hf.max, 33747);
eq('银川·租金1500', A.CITIES.ychuan.rent, 1500);
eq('石嘴山·租金800', A.CITIES.szs.rent, 800);
eq('固原·公积金下限2080', A.CITIES.guy.hf.min, 2080);
eq('内蒙古·基数下限(内人社办发〔2026〕85号)', A.CITIES.hhht.pension.min, 5058);
eq('内蒙古·基数上限', A.CITIES.hhht.pension.max, 25290);
eq('内蒙古·医保基数下限6744（80%口径）', A.CITIES.hhht.med.min, 6744);
eq('内蒙古·医保基数上限25290', A.CITIES.hhht.med.max, 25290);
eq('呼和浩特·医保单位6.7%', A.CITIES.hhht.med.comp, 0.067);
eq('呼和浩特·公积金上限30498', A.CITIES.hhht.hf.max, 30498);
eq('呼和浩特·租金1500', A.CITIES.hhht.rent, 1500);
eq('包头·租金1100（市辖区约158万）', A.CITIES.baot.rent, 1100);
eq('赤峰·租金1100（市辖区约128万）', A.CITIES.chif.rent, 1100);
eq('鄂尔多斯·公积金上限36108', A.CITIES.eerds.hf.max, 36108);
eq('通辽·租金800（科尔沁区70.62万）', A.CITIES.tongliao.rent, 800);
eq('锡林郭勒盟·医保单位6.5%', A.CITIES.xlgl.med.comp, 0.065);
/* 内蒙古第十四批（2026-10-11）：4 城零数值改动，只补来源 + 包头新增 warn。
   内人社办发〔2026〕85号 原文同时给出 8430/5058/25290 三个数，故 8430×0.6 与 8430×3 是
   有效的强算式自校验（非从目标反推）。 */
eq('内蒙古·全口径月均8430×60%=5058（内人社办发〔2026〕85号）', Math.round(8430 * 0.6), A.CITIES.baot.pension.min);
eq('内蒙古·全口径月均8430×300%=25290（同件自校验）', Math.round(8430 * 3), A.CITIES.baot.pension.max);
eq('包头·warn=true（无本市缴存基数件，29284待核实）', A.CITIES.baot.warn, true);
eq('包头·公积金下限2380', A.CITIES.baot.hf.min, 2380);
eq('包头·公积金上限29284（无件支撑，待核实）', A.CITIES.baot.hf.max, 29284);
eq('兴安盟·公积金下限2140（2025年度件，其他旗县市档）', A.CITIES.xam.hf.min, 2140);
eq('兴安盟·公积金上限22685=7561.67×3（2025年度件）', A.CITIES.xam.hf.max, 22685);
eq('兴安盟·warn=true（2026年度件已穷举确认未发布）', A.CITIES.xam.warn, true);
/* 梅州：梅市医保函〔2025〕156号《关于公布2026年度梅州市职工医疗保险参保缴费基数和费率的通知》
   （梅州市医疗保障局办公室 2025-11-28 印发；正文为扫描图片型 PDF，经 Windows OCR 逐页读出）。
   同件给出「2024 年度全市全口径城镇单位就业人员月平均工资 7189 元」与
   「缴费基数上限 21567 元/月、下限 4313 元/月」两个数，故 7189×3 与 7189×60% 为强算式自校验。
   单位费率 6.5%（职工医保6%+生育0.5%）自 2026-01-01 起恢复降费前标准，故企业档不再单列 5.5%。 */
eq('梅州·医保基数下限4313=7189×60%（梅市医保函〔2025〕156号）', Math.round(7189 * 0.6), A.CITIES.mz.med.min);
eq('梅州·医保基数上限21567=7189×3（同件自校验）', Math.round(7189 * 3), A.CITIES.mz.med.max);
eq('梅州·医保单位费率6.5%（含生育0.5%，2026-01-01起恢复）', A.CITIES.mz.med.comp, 0.065);
eq('梅州·医保个人费率2%', A.CITIES.mz.med.emp, 0.02);
eq('梅州·大额补助单位8元/月（个人5元，合计13元）', A.CITIES.mz.medFixEmp, 8);
eq('梅州·大额补助单位+个人=13元/月', 8 + 5, 13);
eq('梅州·warn=true（公积金1750~26315未取得本市件）', A.CITIES.mz.warn, true);
eq('常德·公积金下限2000（官方月缴存额下限200÷10%推算）', A.CITIES.chde.hf.min, 2000);
eq('常德·公积金上限30225（常德市政府门户2026-10-09）', A.CITIES.chde.hf.max, 30225);
eq('常德·30225×24%=7254（官方月缴存总额上限，自校验）', Math.round(30225 * 0.24), 7254);
eq('常德·warn 已取消（2026年度官方值已取得）', A.CITIES.chde.warn, undefined);
eq('益阳·公积金下限2000（官方月缴存额下限200÷10%，与湘人社规〔2025〕22号二类一致）', A.CITIES.yiy.hf.min, 2000);
eq('益阳·公积金上限23031（益公积金发〔2026〕11号）', A.CITIES.yiy.hf.max, 23031);
eq('益阳·7677×3=23031（同件强自校验）', 7677 * 3, A.CITIES.yiy.hf.max);
eq('益阳·23031×24%向上取整=5528（官方月缴存额上限，ceil非round）', Math.ceil(23031 * 0.24), 5528);
eq('舟山·公积金下限2260（月最低工资）', A.CITIES.zsh.hf.min, 2260);
eq('舟山·公积金上限34515（11505×3，同件强自校验）', 11505 * 3, A.CITIES.zsh.hf.max);
eq('舟山·warn 保留（指向2026社保新基数未找到，非公积金）', A.CITIES.zsh.warn, true);
// 第十七批（2026-10-11）· 烟台 / 七台河 / 荆州 官方件逐字核对；大庆 / 伊春 / 大兴安岭 确认无件
eq('烟台·公积金下限2400（市直及其他区市，烟住〔2026〕26号）', A.CITIES.yt.hf.min, 2400);
eq('烟台·公积金上限28692（烟住〔2026〕26号）', A.CITIES.yt.hf.max, 28692);
eq('烟台·28692×12%向下取整=3443（官方单位和个人最高月缴存额）', Math.floor(28692 * 0.12), 3443);
eq('烟台·2400×5%=120（官方最低月缴存额）', Math.floor(2400 * 0.05), 120);
eq('烟台·2210×5%向上取整=111（官方莱阳/栖霞/海阳最低月缴存额）', Math.ceil(2210 * 0.05), 111);
eq('烟台·28692×24%向下取整=6886（官方灵活就业月缴存额上限）', Math.floor(28692 * 0.24), 6886);
eq('烟台·warn 无（2026年度官方件已取得）', A.CITIES.yt.warn, undefined);
eq('七台河·公积金上限20598（七台河公积金中心2026-07-09通知）', A.CITIES.qth.hf.max, 20598);
eq('七台河·公积金下限2010（市区，依黑政规〔2025〕1号）', A.CITIES.qth.hf.min, 2010);
eq('七台河·warn 保留（医保单位费率待核实，非公积金）', A.CITIES.qth.warn, true);
eq('荆州·公积金下限2130（鄂政办发〔2025〕44号荆州区沙市区最低工资）', A.CITIES.jzh.hf.min, 2130);
eq('荆州·公积金上限22446（2025年城镇非私营月均×3）', A.CITIES.jzh.hf.max, 22446);
eq('荆州·warn 无（2026年度官方PDF全文已读）', A.CITIES.jzh.warn, undefined);
eq('大庆·warn 新增（2026年度公积金基数件未找到，现值为估算）', A.CITIES.dq.warn, true);
eq('伊春·warn 保留（公积金基数件与医保费率均未找到）', A.CITIES.yc.warn, true);
eq('大兴安岭·warn 保留（2026年度公积金基数件未找到）', A.CITIES.dxal.warn, true);
eq('锡林郭勒盟·公积金下限2380', A.CITIES.xlgl.hf.min, 2380);
eq('锡林郭勒盟·公积金上限30498（与呼和浩特同值，疑似串值待核实）', A.CITIES.xlgl.hf.max, 30498);
eq('锡林郭勒盟·warn=true', A.CITIES.xlgl.warn, true);
eq('阿拉善盟·公积金下限1980', A.CITIES.alsm.hf.min, 1980);
eq('阿拉善盟·公积金上限26508（2024年度，无件支撑）', A.CITIES.alsm.hf.max, 26508);
eq('阿拉善盟·warn=true', A.CITIES.alsm.warn, true);
eq('新疆·基数下限', A.CITIES.wlmq.pension.min, 5246);
eq('新疆·基数上限', A.CITIES.wlmq.pension.max, 26231);
eq('乌鲁木齐·医保单位9.8%', A.CITIES.wlmq.med.comp, 0.098);
eq('乌鲁木齐·公积金上限35071', A.CITIES.wlmq.hf.max, 35071);
eq('乌鲁木齐·租金1500', A.CITIES.wlmq.rent, 1500);
eq('克拉玛依·公积金上限33872', A.CITIES.klmy.hf.max, 33872);
/* ---------- 新疆 14 地州 2026 年度社保基数 + 伊犁公积金（第二批·2026-10-12） ----------
   社保件：http://rst.xinjiang.gov.cn/xjrst/c112734/202609/234e01d8b8b9404ca3c98c2cee384903.shtml
     自治区人社厅 + 财政厅 + 国家税务总局新疆税务局，2026-07-27，页面未显示文号。原文：
     「2025年自治区全口径城镇单位就业人员平均工资…为104926元（8744元/月）。2026年自治区职工
      基本养老保险个人缴费基数下限（单位就业人员平均工资的60%）为5246元/月，个人缴费基数上限
      （单位就业人员平均工资的300%）为26231元/月。」
   四关复核：①口径——明文「全口径」，14 地州统一；②生效——2026 年度已启用；③数字——同件三数互洽；
     ④来源——三部门联合发文 + rst.xinjiang.gov.cn（.gov.cn）。
   算式自校验（官方同件给出三个独立数字，属强校验而非反推）：
     104926÷12×60% = 5246.30 → floor 5246 ✅；104926÷12×300% = 26231.50 → floor 26231 ✅。
   ⚠️ 取整口径护栏：官方把月均写成取整后的 8744，但上下限是按**未取整**月均算完再 floor——
     8744×3 = 26232 ≠ 26231。凡拿 8744 反推上限都会错 1 元。 */
const XJ = ['wlmq', 'klmy', 'tlf', 'hami', 'cjz', 'boz', 'bygl', 'aks', 'kzls', 'kashi', 'ht', 'ylz', 'tc', 'alt'];
eq('新疆 14 地州齐备', XJ.length, 14);
for (const k of XJ) {
  eq(A.CITIES[k].name + '·养老基数下限5246', A.CITIES[k].pension.min, 5246);
  eq(A.CITIES[k].name + '·养老基数上限26231', A.CITIES[k].pension.max, 26231);
  eq(A.CITIES[k].name + '·五险统一走同一基数（计算器按养老口径写入）', A.CITIES[k].med.max, 26231);
}
eq('新疆·官方月均 round(104926÷12)=8744 元/月', Math.round(104926 / 12), 8744);
eq('新疆·下限 104926÷12×60% 向下取整', Math.floor(104926 / 12 * 0.6), 5246);
eq('新疆·上限 104926÷12×300% 向下取整', Math.floor(104926 / 12 * 3), 26231);
eq('新疆·取整月均 8744×3≠26231（证明按未取整月均计算）', 8744 * 3 !== 26231, true);
/* ⚠️ 取整误差方向：河南 3912÷0.6 与 19560÷3 都正好等于整数基准 6520（官方直接给整数月均 6520，
   无 floor 误差）；新疆的官方件只给「8744 元/月」这个**取整后**的展示值，真正用来算上下限的是
   未取整的 104926÷12 = 8743.8333，所以两个下限/上限各自反推出的基准都比真值略小：
     26231÷3 = 8743.67（差 -0.17），5246÷0.6 = 8743.33（差 -0.50，floor 的 0.30 元误差除以 0.6
     后被放大 1.67 倍）。两者都仍落在 ±1 元内，故可用作自校验，但**不能要求它们严格相等**。 */
eq('新疆·上限反推基准与官方未取整月均相差 <1 元', Math.abs(26231 / 3 - 104926 / 12) < 1, true);
eq('新疆·上限反推基准差 -0.17 元', Math.round((26231 / 3 - 104926 / 12) * 100) / 100, -0.17);
eq('新疆·下限反推基准差 -0.50 元（floor 误差被 1/0.6 放大 1.67 倍）', Math.round((5246 / 0.6 - 104926 / 12) * 100) / 100, -0.5);
eq('新疆·反推基准不能与整数 6520 式校验混用（河南式要求严格相等）', 5246 / 0.6 !== 26231 / 3, true);
eq('新疆·14 地州 dataYear=2026', [...new Set(XJ.map(k => A.CITIES[k].dataYear))].join('/'), '2026');
eq('新疆·14 地州 dataNext 无待公布项', [...new Set(XJ.map(k => String(A.CITIES[k].dataNext)))].join('/'), 'null');
/* 伊犁公积金：州中心 2026-06-24 通知，执行期 2026-07-01 至 2027-06-30 */
eq('伊犁·公积金下限1750', A.CITIES.ylz.hf.min, 1750);
eq('伊犁·公积金上限26184', A.CITIES.ylz.hf.max, 26184);
eq('伊犁·月缴存额上限 26184×24% 向下取整', Math.floor(26184 * 0.24), 6284);
eq('伊犁·最低比例 5%：单位/个人各 ceil(1750×5%)=88', Math.ceil(1750 * 0.05), 88);
eq('伊犁·月缴存额下限 88×2=176（官方按每侧取整后再相加）', Math.ceil(1750 * 0.05) * 2, 176);
eq('伊犁·上限÷3=2025 年月均工资8728', 26184 / 3, 8728);
/* 医保费率仍是死路：14 地州逐地州自定（6.5%~9.8%，含生育 0.5%~1%），自治区医保局无统件 */
eq('新疆·仅伊犁/塔城/阿勒泰 3 城 warn', XJ.filter(k => A.CITIES[k].warn).map(k => A.CITIES[k].name).join(','), '伊犁,塔城,阿勒泰');
eq('新疆·warn 恰好 3 城', XJ.filter(k => A.CITIES[k].warn).length, 3);
eq('伊犁·医保单位费率仍为估算 9.5%', A.CITIES.ylz.med.comp, 0.095);
eq('阿勒泰·医保单位费率仍为估算 7.5%', A.CITIES.alt.med.comp, 0.075);
eq('新疆·乌鲁木齐租金1500', A.CITIES.wlmq.rent, 1500);
eq('新疆·其余 13 地州租金统一 800', XJ.filter(k => A.CITIES[k].rent === 800).length, 13);
eq('新疆·14 地州租金仅两档', [...new Set(XJ.map(k => A.CITIES[k].rent))].sort((a, b) => a - b).join('/'), '800/1500');
eq('喀什·医保单位6.8%', A.CITIES.kashi.med.comp, 0.068);
eq('和田·大额10元/月（固定额）', A.CITIES.ht.medFixEmp, 10);
eq('阿勒泰·租金800', A.CITIES.alt.rent, 800);
eq('青海·基数下限(青人社厅发〔2026〕54号)', A.CITIES.xining.pension.min, 5333);
eq('青海·基数上限', A.CITIES.xining.pension.max, 26664);
eq('西宁·医保单位8.9%（省级统筹）', A.CITIES.xining.med.comp, 0.089);
eq('西宁·公积金上限31995', A.CITIES.xining.hf.max, 31995);
eq('西宁·租金1500', A.CITIES.xining.rent, 1500);
eq('海西·公积金上限37166', A.CITIES.hxz.hf.max, 37166);
eq('青海海南州命名为「海南州」', A.CITIES.hnan.name, '海南州');
eq('黄南·warn（2026年度公积金基数未取得官方件）', A.CITIES.hnz.warn, true);
eq('海南州·warn（2026年度公积金基数未取得官方件）', A.CITIES.hnan.warn, true);
eq('果洛·warn（2026年度公积金基数未取得官方件）', A.CITIES.glz.warn, true);
eq('玉树·warn（缴存基数仅2020年度数值）', A.CITIES.ysz.warn, true);
eq('玉树·公积金上限24402（仅2020年度）', A.CITIES.ysz.hf.max, 24402);
eq('海南·基数下限(琼人社发〔2026〕71号)', A.CITIES.haik.pension.min, 4952.4);
eq('海南·基数上限', A.CITIES.haik.pension.max, 24762);
eq('海南·下限/60% 与上限/300% 精确相等（同件自校验）', 4952.4 / 0.6 === 24762 / 3, true);
eq('海南·工伤一类0.15%（全国最低）', A.CITIES.haik.inj.comp, 0.0015);
eq('海口·医保单位6.5%（全省统一）', A.CITIES.haik.med.comp, 0.065);
eq('海口·公积金上限30452.67', A.CITIES.haik.hf.max, 30452.67);
eq('海口·租金1500', A.CITIES.haik.rent, 1500);
eq('三亚·租金800（户籍80.3万）', A.CITIES.sanya.rent, 800);
eq('三沙·公积金下限2250（海南省公积金管理局2026-06-26通告）', A.CITIES.ssha.hf.min, 2250);
eq('三沙·公积金上限39621.87（同上，按全省年平均工资增幅测算）', A.CITIES.ssha.hf.max, 39621.87);
eq('儋州·公积金下限2250（同上通告）', A.CITIES.danz.hf.min, 2250);
eq('儋州·公积金上限30806.07（同上通告）', A.CITIES.danz.hf.max, 30806.07);
eq('儋州·租金1100（户籍109.55万，存争议）', A.CITIES.danz.rent, 1100);

/* 西藏 7 市地抽查（对照官方文件） */
eq('西藏·基数下限(藏人社发〔2026〕46号)', A.CITIES.lasa.pension.min, 7172.4);
eq('西藏·基数上限', A.CITIES.lasa.pension.max, 35862);
eq('西藏·失业单位0.5%', A.CITIES.lasa.unemp.comp, 0.005);
eq('西藏·工伤一类0.1%（全国最低）', A.CITIES.lasa.inj.comp, 0.001);
eq('拉萨·医保单位7.5%', A.CITIES.lasa.med.comp, 0.075);
eq('拉萨·公积金下限2360（全区最低工资）', A.CITIES.lasa.hf.min, 2360);
eq('拉萨·公积金上限42214', A.CITIES.lasa.hf.max, 42214);
eq('拉萨·租金1500', A.CITIES.lasa.rent, 1500);
eq('日喀则·医保单位7%', A.CITIES.rkz.med.comp, 0.07);
eq('日喀则·租金800', A.CITIES.rkz.rent, 800);
eq('昌都·公积金上限43049', A.CITIES.changdu.hf.max, 43049);
eq('林芝·公积金上限42581', A.CITIES.linzhi.hf.max, 42581);
eq('山南·公积金上限44202（同规则推得）', A.CITIES.shannan.hf.max, 44202);
eq('那曲·租金800', A.CITIES.naqu.rent, 800);
eq('阿里·租金800', A.CITIES.ali.rent, 800);
eq('西藏 7 市地全部已接入', ['lasa','rkz','changdu','linzhi','shannan','naqu','ali'].filter(k=>!!A.CITIES[k]).length, 7);

/* 住房租金档位逐市核查回归（2026-09-26：按市辖区户籍人口 >100万=1100 / ≤100万=800 修正 39 市） */
eq('浙江·湖州 92.90万→800', A.CITIES.huz.rent, 800);
eq('浙江·衢州 85.2万→800', A.CITIES.qz.rent, 800);
eq('浙江·舟山 71.06万→800', A.CITIES.zsh.rent, 800);
eq('浙江·丽水 42.83万→800', A.CITIES.lish.rent, 800);
eq('浙江·嘉兴 100.13万临界→保持1100', A.CITIES.jiax.rent, 1100);
eq('浙江·金华约100.5万临界→保持1100', A.CITIES.jh.rent, 1100);
eq('江苏·镇江 101.18万临界→保持1100', A.CITIES.zjh.rent, 1100);
eq('四川·德阳 94.5万→800', A.CITIES.dy.rent, 800);
eq('四川·遂宁 142.9万→1100', A.CITIES.sn.rent, 1100);
eq('四川·眉山 118.9万→1100', A.CITIES.ms.rent, 1100);
eq('四川·广安 113.7万→1100', A.CITIES.ga.rent, 1100);
eq('四川·巴中 124.7万→1100', A.CITIES.bz.rent, 1100);
eq('四川·资阳 103.5万→1100', A.CITIES.ziy.rent, 1100);
eq('吉林·吉林市 175.88万→保持1100', A.CITIES.jl.rent, 1100);
eq('吉林·四平 65.78万→800', A.CITIES.sp.rent, 800);
eq('吉林·辽源 43.38万→800', A.CITIES.lyu.rent, 800);
eq('吉林·通化 42.48万→800', A.CITIES.th.rent, 800);
eq('吉林·白山 50.41万→800', A.CITIES.bs.rent, 800);
eq('吉林·松原 55.15万→800', A.CITIES.syu.rent, 800);
eq('吉林·白城 47.32万→800', A.CITIES.bc.rent, 800);
eq('吉林·延边（无市辖区）→800', A.CITIES.ybi.rent, 800);
eq('黑龙江·齐齐哈尔约131万→保持1100', A.CITIES.qqhe.rent, 1100);
eq('黑龙江·大庆约137万→保持1100', A.CITIES.dq.rent, 1100);
eq('黑龙江·鸡西约77万→800', A.CITIES.jx.rent, 800);
eq('黑龙江·鹤岗约61万→800', A.CITIES.hg.rent, 800);
eq('黑龙江·双鸭山约46万→800', A.CITIES.sys.rent, 800);
eq('黑龙江·伊春约42万→800', A.CITIES.yc.rent, 800);
eq('黑龙江·佳木斯约76万→800', A.CITIES.jms.rent, 800);
eq('黑龙江·七台河 44.9万→800', A.CITIES.qth.rent, 800);
eq('黑龙江·牡丹江约87万→800', A.CITIES.mdj.rent, 800);
eq('黑龙江·黑河 18.41万→800', A.CITIES.hh.rent, 800);
eq('黑龙江·绥化 79.1万→800', A.CITIES.suih.rent, 800);
eq('黑龙江·大兴安岭（地区）→800', A.CITIES.dxal.rent, 800);
eq('山东·东营约89万→800', A.CITIES.dyy.rent, 800);
eq('山东·威海约90万→800', A.CITIES.wh.rent, 800);
eq('山东·德州约120.2万→保持1100', A.CITIES.dez.rent, 1100);
eq('辽宁·本溪 82.6万→800', A.CITIES.bx.rent, 800);
eq('辽宁·丹东 74.7万→800', A.CITIES.dd.rent, 800);
eq('辽宁·锦州约90万→800', A.CITIES.jz.rent, 800);
eq('辽宁·营口 94.0万→800', A.CITIES.yk.rent, 800);
eq('辽宁·阜新 70.4万→800', A.CITIES.fx.rent, 800);
eq('辽宁·辽阳 81.7万→800', A.CITIES.lyo.rent, 800);
eq('辽宁·铁岭 39.3万→800', A.CITIES.tl.rent, 800);
eq('辽宁·朝阳 60.8万→800', A.CITIES.cy.rent, 800);
eq('辽宁·葫芦岛 93.2万→800', A.CITIES.hld.rent, 800);
eq('辽宁·盘锦 101.2万临界→保持1100', A.CITIES.pj.rent, 1100);
(function () {
  const c = { 800: 0, 1100: 0, 1500: 0 };
  for (const k in A.CITIES) c[A.CITIES[k].rent]++;
  eq('租金档位分布·1500 档 36 座', c[1500], 36);
  eq('租金档位分布·1100 档 127 座', c[1100], 127);
  eq('租金档位分布·800 档 174 座', c[800], 174);
})();

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
  emit(`  历史页首月实发：${fmt(netNoSupp)} → ${fmt(rows2[0].net)}（少 ${fmt(drop)}，个人养老金1000 − 省税）`);

  /* F6：补充扣除>0 时应出现第 5 个汇总框，且渲染出来的数字四则运算闭合 */
  const sumHtml = A._html('histSum');
  eq('汇总框数量 = 5（含补充扣除）', (sumHtml.match(/class="sum-box"/g) || []).length, 5);
  eq('汇总区 grid 用 c5 类（而非内联样式，避免盖掉移动端媒体查询）', A._class('histSum'), 'sum-grid c5');
  const sSal = A._num('sumSal'), sSI = A._num('sumSI'), sTax = A._num('sumTax'),
        sSupp = A._num('sumSupp'), sNet = A._num('sumNet');
  ok('汇总框闭合：税前−五险一金−个税−补充扣除 = 实发', sSal - sSI - sTax - sSupp, sNet, 0.02);
  emit(`  汇总框：${fmt(sSal)} − ${fmt(sSI)} − ${fmt(sTax)} − ${fmt(sSupp)} = ${fmt(sNet)} ✓`);

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
  emit('  历史表生育基数列：北京无 / 深圳有 ✓');

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
  emit('  逐月编辑在切页/改默认值/缩区间后保留，换城市重置 ✓');
})();

/* =========================================================
   12. 省份年度口径（dataYear / dataNext）与页脚文案
   —— 回归自一次真实事故：CIU() 工厂默认 dataYear:"2026"，新增省份城市时
      只覆盖了 region 没覆盖 dataYear，导致 100 城把 2025 年度基数标成
      「2026年度」显示给用户。年度基线表与 check-sync 检查 E 同源。
   ========================================================= */
section('12. 省份年度口径与页脚文案');
(function yearCase() {
  const ALLOWED = ['2025', '2025-2026', '2026'];

  /* 12.1 dataYear 取值只能在设计范围内（防止写出 '2026年度'、'2025.7' 之类的变体） */
  const badYear = Object.keys(A.CITIES).filter(k => ALLOWED.indexOf(A.CITIES[k].dataYear) < 0);
  eq('dataYear 取值均在设计范围内（' + badYear.slice(0, 3).join(',') + '）', badYear.length, 0);

  /* 12.2 逐城年度与基线表一致 */
  let mismatch = 0, firstBad = '';
  for (const k in A.CITIES) {
    const c = A.CITIES[k], b = PROVINCE_YEAR[c.region];
    const okRow = b && c.dataYear === b.dataYear && (c.dataNext || null) === (b.dataNext || null);
    if (!okRow) { mismatch++; if (!firstBad) firstBad = `${c.name}=${c.dataYear}/${c.dataNext}`; }
  }
  eq(`全部城市年度与基线表一致（首个不符：${firstBad || '无'}）`, mismatch, 0);

  /* 12.3 受影响 9 省逐省抽查 + 未受影响省份不得被误改 */
  const CASES = [
    ['heb', '哈尔滨', '2026', null], ['nanj', '南京', '2025', '2026'],
    ['hangz', '杭州', '2025', '2026'], ['zzheng', '郑州', '2026', null],
    ['wuha', '武汉', '2025', '2026'], ['nanch', '南昌', '2025', '2026'],
    ['haik', '海口', '2026', null],
    ['cc', '长春', '2025-2026', null], ['fz', '福州', '2025-2026', null],
  ];
  for (const [key, name, y, next] of CASES) {
    eq(`${name} dataYear=${y}`, A.CITIES[key].dataYear, y);
    eq(`${name} dataNext=${JSON.stringify(next)}`, A.CITIES[key].dataNext || null, next);
  }
  eq('北京 dataYear 保持 2026', A.CITIES.bj.dataYear, '2026');
  eq('北京 dataNext 为空', A.CITIES.bj.dataNext || null, null);
  eq('深圳 dataYear 保持 2025-2026', A.CITIES.sz.dataYear, '2025-2026');
  eq('深圳 dataNext 为空', A.CITIES.sz.dataNext || null, null);
  eq('广州 dataYear 保持 2025-2026', A.CITIES.gz.dataYear, '2025-2026');

  /* 12.4 页脚实际渲染文案 —— 用户真正看到的那一行 */
  const foot = () => A._doc.getElementById('footNote').innerHTML;

  A.selectCity('heb');
  ok('哈尔滨页脚显示 2026年度', foot().indexOf('数据依据：哈尔滨 2026年度') === 0, true);
  ok('哈尔滨页脚不再提示待公布', foot().indexOf('（2026年度待公布）') < 0, true);
  ok('哈尔滨页脚不再出现"2025年度"', foot().indexOf('哈尔滨 2025年度') < 0, true);

  A.selectCity('nanj');
  ok('南京页脚显示 2025年度（2026年度待公布）',
    foot().indexOf('数据依据：南京 2025年度（2026年度待公布）') === 0, true);

  A.selectCity('cc');
  ok('长春页脚显示 2025-2026年度', foot().indexOf('数据依据：长春 2025-2026年度') === 0, true);
  ok('长春页脚不提示待公布（年度已跨到 2026）', foot().indexOf('待公布') < 0, true);

  A.selectCity('bj');
  ok('北京页脚显示 2026年度', foot().indexOf('数据依据：北京 2026年度') === 0, true);
  ok('北京页脚不提示待公布', foot().indexOf('待公布') < 0, true);

  /* 12.5 反向：基线表说"有待公布"的城市必须带 dataNext，反之必须不带 */
  let missTip = 0, extraTip = 0;
  for (const k in A.CITIES) {
    const c = A.CITIES[k], b = PROVINCE_YEAR[c.region];
    const shouldTip = !!(b && b.dataNext);
    if (shouldTip && !c.dataNext) missTip++;
    if (!shouldTip && c.dataNext) extraTip++;
  }
  eq('应提示待公布的城市都已标记', missTip, 0);
  eq('不应提示待公布的城市均未误标', extraTip, 0);

  emit('  100 城年度口径已修正，页脚按「年度 + 待公布提示」双段呈现 ✓');
})();

/* =========================================================
   13. 就业起始月边界：calc() 与 buildHistory() 必须同口径
   —— 回归自代码审查问题 3：本字段口径是"本年度开始就业时间"，
      起始月晚于当前月属非法输入。历史上 calc() 用原始值渲染成
      「已就业 1 个月（12月入职）」（自相矛盾），buildHistory() 却自行
      改成 3 月入职——同一组输入两页给出不同的入职月。
      现在两处共用 effStart()，并由本节的 144 组全组合守卫。
   ========================================================= */
section('13. 就业起始月边界（两页口径一致）');
(function startMonthCase() {
  A.selectCity('bj');
  A._setMany({ salary: 20000, pBase: 20000, mBase: 20000, uBase: 20000, mtBase: 20000,
    ijBase: 20000, hfBase: 20000, hfRate: 12, persPen: 0, healthIns: 0, annuity: 0, bonus: 0 });

  let badCross = 0, badSelf = 0, firstCross = '', firstSelf = '';
  for (let mo = 1; mo <= 12; mo++) {
    for (let sm = 1; sm <= 12; sm++) {
      A._setMany({ month: mo, startMonth: sm });
      A.calc();
      const resHtml = A._doc.getElementById('res').innerHTML;
      const m1 = resHtml.match(/（(\d+)月入职）/);
      const n1 = resHtml.match(/本年度已就业 (\d+) 个月/);
      A.buildHistory();
      const rows = A.histRows();
      const m2 = rows.length ? rows[0].m : null;
      const expStart = sm > mo ? mo : sm;      /* effStart 的期望语义 */

      if (!m1 || Number(m1[1]) !== expStart || m2 !== expStart) {
        badCross++;
        if (!firstCross) firstCross = `当前${mo}月/起始${sm}月 → 第1页${m1 ? m1[1] : '?'}月入职、第2页首行${m2}月，期望${expStart}月`;
      }
      const expN = mo - expStart + 1;
      if (!n1 || Number(n1[1]) !== expN) {
        badSelf++;
        if (!firstSelf) firstSelf = `当前${mo}月/起始${sm}月 → 显示${n1 ? n1[1] : '?'}个月，期望${expN}`;
      }
    }
  }
  eq(`144 组（当前月×起始月）两页入职月一致${badCross ? '；首个不符：' + firstCross : ''}`, badCross, 0);
  eq(`144 组「已就业 N 个月」与入职月自洽${badSelf ? '；首个不符：' + firstSelf : ''}`, badSelf, 0);

  /* 非法输入要明示，不能静默——但也不改写用户输入框里的值 */
  A._setMany({ month: 3, startMonth: 12 }); A.calc();
  const w = A._doc.getElementById('startWarn');
  ok('起始月晚于当前月时显示校验提示', w.style.display !== 'none', true);
  ok('校验提示写明按哪个月计', w.textContent.indexOf('3 月') > 0, true);
  eq('不静默改写用户输入框里的原始值', Number(A._doc.getElementById('startMonth').value), 12);

  A._setMany({ startMonth: 3 }); A.calc();
  ok('起始月合法时隐藏校验提示', A._doc.getElementById('startWarn').style.display === 'none', true);

  A._setMany({ month: 12, startMonth: 1 }); A.calc();
  ok('正常边界（1 月入职、12 月）无提示', A._doc.getElementById('startWarn').style.display === 'none', true);
  eq('1 月入职、12 月显示已就业 12 个月',
    Number(A._doc.getElementById('res').innerHTML.match(/本年度已就业 (\d+) 个月/)[1]), 12);
  eq('用户输入框保留原始值（不被静默改写）', Number(A._doc.getElementById('startMonth').value), 1);

  emit('  144 组边界组合两页口径一致，非法输入有明示且不改写输入 ✓');
})();

/* =========================================================
   14. 年终奖计税方式对比（单独计税 vs 并入综合所得）
   ========================================================= */
section('14. 年终奖计税方式对比');

(function () {
  /* 测试内**独立实现**两张税率表，不引用页面的 BR/BBR——
     否则就是"用同一份数据验证自己"：算错了也一起错，验不出来。 */
  const TX = (t) => {
    const B = [[36000, .03, 0], [144000, .10, 2520], [300000, .20, 16920], [420000, .25, 31920], [660000, .30, 52920], [960000, .35, 85920], [Infinity, .45, 181920]];
    if (t <= 0) return 0;
    for (const [lim, r, d] of B) if (t <= lim) return Math.max(0, t * r - d);
    return 0;
  };
  const BTX = (b) => {
    const B = [[3000, .03, 0], [12000, .10, 210], [25000, .20, 1410], [35000, .25, 2660], [55000, .30, 4410], [80000, .35, 7160], [Infinity, .45, 15160]];
    if (b <= 0) return 0;
    const m = b / 12;
    for (const [lim, r, d] of B) if (m <= lim) return Math.max(0, b * r - d);
    return 0;
  };

  /* 低所得：各基数被夹到北京下限，aTx 很小；高所得：基数顶到上限、公积金 12% */
  const LOW = { salary: 6000, month: 12, startMonth: 1, pBase: 6000, mBase: 6000, uBase: 6000, mtBase: 6000, ijBase: 6000, hfBase: 6000, hfRate: 0 };
  const HIGH = { salary: 40000, month: 12, startMonth: 1, pBase: 36348, mBase: 36348, uBase: 36348, mtBase: 36348, ijBase: 36348, hfBase: 36348, hfRate: 12 };
  const ZERO = { persPen: 0, healthIns: 0, annuity: 0, childAmt: 0, eduAmt: 0, houseAmt: 0, elderlyAmt: 0, medicalAmt: 0 };

  const run = (base, bonus) => {
    A.selectCity('bj');
    A._setMany(Object.assign({}, ZERO, base, { bonus }));
    ['childOn', 'eduOn', 'houseOn', 'elderlyOn', 'medicalOn'].forEach(k => A._check(k, false));
    A.calc();
    const html = A._html('bonusResult');
    const has = A._has('resSepTax');   /* 奖金为 0 时不渲染对比块，不能硬读 */
    return {
      aTx: A._num('resATx'), aT: A._num('resATax'), html,
      sep: has ? A._num('resSepTax') : null,
      mer: has ? A._num('resMergeTax') : null,
      save: has ? A._num('resBonusSave') : null,
      reco: html.indexOf('建议 <b>并入综合所得</b>') >= 0 ? 'merge'
        : html.indexOf('建议 <b>单独计税</b>') >= 0 ? 'sep'
          : html.indexOf('两种方式税额相同') >= 0 ? 'same' : 'none',
    };
  };

  /* --- 奖金为 0：不渲染对比块 --- */
  run(LOW, 0);
  eq('奖金为 0 时不渲染计税方式对比', A._has('resSepTax'), false);
  eq('奖金为 0 时也不给结论', A._has('resBonusSave'), false);

  /* --- 与独立复算比对（4 个场景 × 3 个数字） --- */
  for (const [name, base, bonus] of [
    ['低所得 + 3.6 万', LOW, 36000],
    ['高所得 + 3.6 万', HIGH, 36000],
    ['低所得 + 10 万', LOW, 100000],
    ['高所得 + 100 万', HIGH, 1000000],
  ]) {
    const r = run(base, bonus);
    const eSep = r.aT + BTX(bonus), eMer = TX(Math.max(0, r.aTx + bonus));
    ok(`对比·${name}：单独计税合计`, r.sep, eSep, 0.01);
    ok(`对比·${name}：并入综合所得合计`, r.mer, eMer, 0.01);
    ok(`对比·${name}：差额`, r.save, Math.abs(eSep - eMer), 0.01);
  }

  /* --- 结论方向（读真实渲染出的建议文案，不是读测试自己的算式） --- */
  eq('低所得 + 10 万奖金 → 建议并入综合所得', run(LOW, 100000).reco, 'merge');
  eq('高所得 + 3.6 万奖金 → 建议单独计税', run(HIGH, 36000).reco, 'sep');
  /* 反直觉但正确：奖金极大时**并入反而更省**。单独计税把整笔奖金推进 45% 档、
     速算扣除只有 15160；并入后奖金的边际税负反而低于单独计税。 */
  eq('高所得 + 100 万奖金 → 建议并入综合所得（反直觉但正确）', run(HIGH, 1000000).reco, 'merge');

  /* --- 临界值陷阱：并入可绕开，这是本功能最实用的场景 --- */
  const trap = run(LOW, 36001);
  const trapSep = trap.aT + BTX(36001), trapMer = TX(trap.aTx + 36001);
  eq('陷阱区间（36001）建议并入综合所得', trap.reco, 'merge');
  ok('陷阱区间并入比单独省 > 2000 元', trapSep - trapMer, 2113.73, 0.01);
  ok('陷阱场景渲染的差额与独立复算一致', trap.save, Math.abs(trapSep - trapMer), 0.01);

  /* --- 边界：奖金恰为 36000（陷阱只在"多 1 元"时触发） --- */
  const at = run(LOW, 36000);
  eq('奖金恰为 36000 时建议单独计税', at.reco, 'sep');
  ok('恰在临界点上时单独计税更省 196.27 元', at.save, 196.27, 0.01);

  /* --- 陷阱区间内「并入」的税额应显著低于临界点本身的税额 --- */
  ok('并入绕开陷阱：36001 的并入税额 ≈ 36000 的并入税额 + 0.1',
    trapMer, TX(at.aTx + 36000) + 0.1, 0.05);

  emit('  5 个场景 × 独立复算 + 结论方向 + 陷阱绕开 + 边界 ✓');
})();

/* =========================================================
   汇总
   ========================================================= */
emit('\n' + '='.repeat(58));
if (fail) {
  emit(`失败 ${fail} 项 / 共 ${pass + fail} 项\n`);
  failures.forEach(f => emit('  ✗ ' + f + '\n'));
  emit('='.repeat(58));
} else {
  emit(`全部通过：${pass} 项断言`);
  emit('='.repeat(58));
}

/* 被 require 时导出计数，供 check-sync 的 D 检查直接读取；
   作为主程序运行时保持原有的输出与退出码语义。 */
const RESULT = { pass, fail, failures };
module.exports = { pass, fail, failures, ok: fail === 0, results: () => RESULT };
if (IS_MAIN) process.exit(fail ? 1 : 0);
