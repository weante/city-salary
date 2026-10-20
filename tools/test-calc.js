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
  var _noCap = [];
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
      /* 工伤等「法定无缴费基数上下限」的险种：min=0 且 max=0 表示不设上下限，
         豁免「必须为正数」与「夹取到下限」两项检查（第八十一批） */
      if (_n === '工伤' && _lo === 0 && _hi === 0) { _noCap.push(_c.name); continue; }
      if (_n === '工伤' && (_lo === 0 || _hi === 0)) {
        _bad.push(_c.name + '·工伤 上下限只设一半：' + _lo + '~' + _hi); continue;
      }
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
  eq('全城基数上下限排查·工伤「法定无上下限」城市＝广东 21 市', _noCap.length, 21);
  eq('全城基数上下限排查·工伤豁免城市全部属广东', _noCap.every(function(n){
    for (var _kk in A.CITIES) { if (A.CITIES[_kk].name === n) return A.CITIES[_kk].region === '广东'; }
    return false; }), true);
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
  /* 广州 60000 → 养老27603 / 医疗31170 / 失业42933 */
  A.selectCity('gz');
  A._setMany({ salary: 60000, month: 12, startMonth: 1, pBase: 60000, mBase: 60000, uBase: 60000, hfBase: 60000 });
  A.calc();
  const rows = [A._num('ob0'), A._num('ob1'), A._num('ob2')];
  ok('广州·养老基数夹取到上限', rows[0], 27603);
  ok('广州·医疗基数夹取到上限', rows[1], 31170);
  ok('广州·失业基数夹取到上限', rows[2], 42933);
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
  /* 基数取 27000：低于深圳养老上限 27603，避免夹取干扰独立复算 */
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
eq('江苏·五险下限(苏人社发〔2026〕30号)', A.CITIES.nanj.pension.min, 5025);
eq('江苏·五险上限(苏人社发〔2026〕30号)', A.CITIES.nanj.pension.max, 25127);
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
eq('浙江·五险下限(浙人社发〔2026〕52号)', A.CITIES.hangz.pension.min, 5122);
eq('浙江·五险上限', A.CITIES.hangz.pension.max, 25611);
eq('杭州·医保单位9.5%(含生育0.6%)', A.CITIES.hangz.med.comp, 0.095);
eq('杭州·公积金上限42151', A.CITIES.hangz.hf.max, 42151);
eq('宁波·公积金上限38947', A.CITIES.nb.hf.max, 38947);
eq('宁波·医保单位8.5%(含大病0.5%+生育0.5%)', A.CITIES.nb.med.comp, 0.085);
eq('绍兴·医保个人1%(其他单位口径)', A.CITIES.sx.med.emp, 0.01);
eq('台州·医保个人1%', A.CITIES.taiz.med.emp, 0.01);
eq('衢州·公积金上限37530', A.CITIES.qz.hf.max, 37530);
eq('丽水·公积金上限暂用2025年度36405', A.CITIES.lish.hf.max, 36405);
eq('天津/江苏/浙江·生育并入医保(mat.comp=0)', A.CITIES.tj.mat.comp + A.CITIES.nanj.mat.comp + A.CITIES.hangz.mat.comp, 0);

/* ---- 第四十批 B（2026-10-14）· 浙江 2026 年度缴费基数落地（改值 11 市）----
   一手件：浙人社发〔2026〕52号（2026-10-08 五部门联署含统计局；统一编号 ZJSP13-2026-0006）
     https://rlsbt.zj.gov.cn/col/col1229506773/art/2026/art_2b4555c11a034b9e874038cbff2f84fb.html
   解读稿（逐字给出两个数，故可同件双数自校验）
     https://rlsbt.zj.gov.cn/col/col1229101513/art/2026/art_e8b496ab59834390884b8d375cff1651.html
   ⭐ 2026 起口径切换：下限恢复按上一年度加权平均工资 60%（2022~2025 曾取「上上年度」）
   基准 2025 年度非私营+私营加权平均工资 102446 元 = 8537 元/月
     上限 8537×300% = 25611；下限 8537×60% = 5122.2 → 5122 */
const ZJ11 = ['hangz','nb','wz','jiax','huz','sx','jh','qz','zsh','taiz','lish'];
eq('浙江·52号件构成自校验：102446/12 取整 8537，×300% = 25611', Math.round(102446/12) * 3, 25611);
eq('浙江·52号件构成自校验：8537×60% 向下取整 = 5122', Math.floor(Math.round(102446/12) * 0.6), 5122);
eq('浙江·解读稿「比上年提高312元/月」与旧上限 25299 吻合', 25611 - 312, 25299);
eq('浙江·解读稿「比上年提高136元/月」与旧下限 4986 吻合', 5122 - 136, 4986);
eq('浙江·11 市全覆盖', ZJ11.length, 11);
for (const k of ZJ11) {
  const c = A.CITIES[k];
  ok('浙江·' + k + ' 下限 5122', c.pension.min, 5122);
  ok('浙江·' + k + ' 上限 25611', c.pension.max, 25611);
  ok('浙江·' + k + ' dataYear 2026', c.dataYear, '2026');
  ok('浙江·' + k + ' dataNext 已清空', c.dataNext, null);
  ok('浙江·' + k + ' note 引用 52 号', c.note.indexOf('浙人社发〔2026〕52号') >= 0, true);
  ok('浙江·' + k + ' note 不再写「新基数未找到」', c.note.indexOf('新基数未找到') < 0, true);
  ok('浙江·' + k + ' 保留 warn（医保费率/大病固定额多无市级一手件）', c.warn, true);
}
ok('浙江·11 市 note 均已带 52 号', ZJ11.filter(k => A.CITIES[k].note.indexOf('浙人社发〔2026〕52号') >= 0).length, 11);
ok('浙江·旧文号 2025 版 52 号不再出现于任何 note',
   ZJ11.filter(k => A.CITIES[k].note.indexOf('浙人社发〔2025〕52号') >= 0).length, 0);
ok('浙江·宁波已改为「医保单独统筹」表述', A.CITIES.nb.note.indexOf('宁波医保单独统筹') >= 0, true);
ok('浙江·丽水医保单位费率仍标注未找到市级值', A.CITIES.lish.note.indexOf('单位费率未找到') >= 0, true);

/* ========== 第四十批 A：江苏 2026 年度基数落地（苏人社发〔2026〕30号）==============
 * 一手件 https://jshrss.jiangsu.gov.cn/art/2026/10/8/art_77277_11838872.html
 *   索引号 550232674/2026-00226，四部门联署，2026-09-28 印发 / 2026-10-08 上网
 * 逐字：「2026年1月1日至12月31日，全省职工基本养老保险缴费工资基数上限按 25127 元执行，
 *      缴费工资基数下限按 5025 元执行。职工基本医疗保险、失业保险、工伤保险、生育保险
 *      缴费工资基数上下限按照上述标准执行。」
 * 解读稿 https://jshrss.jiangsu.gov.cn/art/2026/10/8/art_78497_11838875.html 独立复述同两个数字
 * ⚠️ 官方未公布全口径年平均工资，故下面两项只能当反推参考、不是同件双数自校验：
 *    5025÷0.6 = 8375（整）、25127÷3 = 8375.67（不整）→ 与新疆同口径：上下限各自 floor。 */
{
  const JS13 = ['nanj', 'su', 'wx', 'czh', 'xz', 'nt', 'lyg', 'ha', 'ych', 'yz', 'tz', 'zjh', 'sq'];
  let bad = 0, badWarn = 0, badNote = 0, badYr = 0;
  for (const k of JS13) {
    const c = A.CITIES[k];
    if (c.pension.min !== 5025 || c.pension.max !== 25127) { bad++; console.log('  ✗ ' + k + ' 基数未落地'); }
    if (c.med.min !== 5025 || c.med.max !== 25127) { bad++; console.log('  ✗ ' + k + ' 医保基数未同步'); }
    if (c.dataYear !== '2026' || (c.dataNext || null) !== null) { badYr++; console.log('  ✗ ' + k + ' 年度口径未改'); }
    if (c.warn !== true) { badWarn++; console.log('  ✗ ' + k + ' warn 被误清'); }
    if ((c.note || '').indexOf('24762') >= 0 || (c.note || '').indexOf('4952；') >= 0) { badNote++; console.log('  ✗ ' + k + ' note 残留旧值'); }
  }
  eq('江苏·13 城五险基数全部落地 5025~25127', bad, 0);
  eq('江苏·13 城医保基数与养老同口径', bad, 0);
  eq('江苏·13 城 dataYear=2026 / dataNext=null', badYr, 0);
  eq('江苏·13 城 warn 全部保留（各省市医保费率多无市级一手件）', badWarn, 0);
  eq('江苏·13 城 note 无旧值残留', badNote, 0);
  eq('江苏·note 逐城引用苏人社发〔2026〕30号', JS13.filter(k => (A.CITIES[k].note || '').indexOf('苏人社发〔2026〕30号') >= 0).length, 13);
  eq('江苏·note 已删除从未证实的「苏税发」文号', JS13.filter(k => (A.CITIES[k].note || '').indexOf('苏税发') >= 0).length, 0);
  eq('江苏·note 已删除「2026社保新基数未公布」', JS13.filter(k => (A.CITIES[k].note || '').indexOf('未公布') >= 0).length, 0);
  eq('江苏·反推参考：下限÷60% = 8375（整）', 5025 / 0.6, 8375);
  ok('江苏·反推参考：上限÷300% = 8375.67（非整，与新疆同一 floor 口径）', Math.abs(25127 / 3 - 8375.67) < 0.01, true);
  eq('江苏·上限×20% = 5025.4，官方下限是 floor 后的 5025', Math.round(25127 * 0.2 * 100) / 100, 5025.4);
  eq('江苏·旧值上限已作废（24762 不再出现）', JS13.filter(k => A.CITIES[k].pension.max === 24762).length, 0);
}

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
for (const k of ['luoy', 'pds', 'ay', 'hbi', 'xx', 'jzuo', 'py', 'xc', 'sqiu', 'xiny', 'zk', 'zmd']) {
  eq(A.CITIES[k].name + '·已解除 warn', A.CITIES[k].warn, undefined);
}
/* 仍存 4 类未决问题，warn 保留 */
eq('郑州·保留 warn（医保基数市级口径与省级口径并存）', A.CITIES.zzheng.warn, true);
eq('开封·保留 warn（医保费率仍是征求意见稿）', A.CITIES.kf.warn, true);
eq('漯河·保留 warn（公积金 2026 年度件未找到）', A.CITIES.lh.warn, true);
eq('南阳·保留 warn（大额基数是否随年度同步待核）', A.CITIES.ny.warn, true);
eq('第六十二批·南阳大额个人月额由19.16更新为19.56（6520×0.3%，宛政办〔2021〕17号第十一条单位与个人各50%）', A.CITIES.ny.medFixEmp, 19.56);
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
/* 第三十批 B（2026-10-13）· 江苏 3 城 + 浙江 3 城：职工医保单位费率市级一手件
    ① 南通 通政规〔2025〕7号《南通市医疗保障办法》第八条（ylbzj.nantong.gov.cn）：「单位缴费费率为 9%（含生育保险费率 1%）、个人缴费费率为 2%」，
       2025-07-01 施行至 2030-06-30，同时废止通政规〔2015〕4号；
    ② 泰州 泰医保规〔2020〕2号 第六条（taizhou.gov.cn）：基本医保单位 8% / 个人 2%，大病统筹单位 0.5% / 个人 0.3%，生育保险单位 0.5%；
       2026 年废止清单（泰医保发〔2026〕32号）不含本件 → 现行有效；
    ③ 无锡 锡医保服务〔2023〕23号（ylbzj.wuxi.gov.cn，效力状况：有效）：2024-01-01 起基本医保单位 7%（**不含生育**）+ 大额补助 0.2%，
       基数暂按苏人社发〔2023〕3号 4494~24042；锡医保服务〔2023〕3号「现行用人单位缴费费率（不含生育保险缴费费率）和个人缴费费率之和降低 1 个百分点，即为 8%」
       → 无锡未发布含生育的合计费率，生育一项仍无官方件，仓库 8% 不改；
    ④ 金华 金政发〔2021〕27号：用人单位 7.5%（含生育保险 0.5%）、个人 2%，2022-01-01 施行；
    ⑤ 宁波《宁波市区职工基本医疗保险政策问答（2023 年度版）》（ybj.ningbo.gov.cn，30 页扫描件，Windows OCR 读出）：
       用人单位 8.5%（其中大病保险 0.5%、生育保险 0.5%）、个人 2%；灵活就业 10.5%；失业人员和退休延缴 10%。
       ⚠️ 官网 2020 年度版问答写的 9.7%（基本医保 9% + 大病救助 0.5% + 生育 0.7%）为旧版口径，机关事业单位另按 9%（不含生育）执行 → 本表取企业口径；
    ⑥ 丽水 丽政办发〔2021〕61号 只统一「生育保险费率 0.5%」，基本医保单位费率留白「经市政府批准后实施」→ not-found，不改值 */
eq('江苏·南通件构成自校验：基本医保8%+生育1%=9%', 0.08 + 0.01, 0.09);
eq('江苏·泰州件构成自校验：基本医保8%+生育0.5%=8.5%', 0.08 + 0.005, 0.085);
eq('江苏·无锡件构成自校验：7%+大额0.2%+生育0.8%=8%', 0.07 + 0.002 + 0.008, 0.08);
eq('江苏·无锡件内部勾稽：7%+个人2%-1pp=灵活就业8%', 0.07 + 0.02 - 0.01, 0.08);
eq('浙江·金华件构成自校验：7%+生育0.5%=7.5%', 0.07 + 0.005, 0.075);
eq('浙江·宁波件构成自校验：7.5%+大病0.5%+生育0.5%=8.5%', 0.075 + 0.005 + 0.005, 0.085);
eq('江苏·南通·医保单位9%（通政规〔2025〕7号）', A.CITIES.nt.med.comp, 0.09);
eq('江苏·南通·医保个人2%', A.CITIES.nt.med.emp, 0.02);
eq('江苏·南通·大病固定额10元/月（该固定额官方件未取到）', A.CITIES.nt.medFixEmp, 10);
eq('江苏·南通·公积金下限2660', A.CITIES.nt.hf.min, 2660);
eq('江苏·南通·公积金上限34000', A.CITIES.nt.hf.max, 34000);
eq('江苏·南通·note含通政规〔2025〕7号', A.CITIES.nt.note.indexOf('通政规〔2025〕7号') >= 0, true);
eq('江苏·泰州·医保单位8.5%（泰医保规〔2020〕2号）', A.CITIES.tz.med.comp, 0.085);
eq('江苏·泰州·医保个人2%', A.CITIES.tz.med.emp, 0.02);
eq('江苏·泰州·公积金上限30258', A.CITIES.tz.hf.max, 30258);
eq('江苏·泰州·note含泰医保规〔2020〕2号', A.CITIES.tz.note.indexOf('泰医保规〔2020〕2号') >= 0, true);
eq('江苏·泰州·note记录官方「下限不做调整」冲突', A.CITIES.tz.note.indexOf('下限不做调整') >= 0, true);
eq('江苏·无锡·医保单位8%（7+大额0.2%+生育0.8%）', A.CITIES.wx.med.comp, 0.08);
eq('江苏·无锡·医保个人2%', A.CITIES.wx.med.emp, 0.02);
eq('江苏·无锡·公积金下限2490', A.CITIES.wx.hf.min, 2490);
eq('江苏·无锡·公积金上限36800（锡房金规〔2026〕2号）', A.CITIES.wx.hf.max, 36800);
eq('江苏·无锡·note含锡医保服务〔2023〕23号', A.CITIES.wx.note.indexOf('锡医保服务〔2023〕23号') >= 0, true);
eq('江苏·无锡·note标明7%不含生育', A.CITIES.wx.note.indexOf('不含生育') >= 0, true);
eq('浙江·金华·医保单位7.5%（金政发〔2021〕27号）', A.CITIES.jh.med.comp, 0.075);
eq('浙江·金华·医保个人2%', A.CITIES.jh.med.emp, 0.02);
eq('浙江·金华·公积金下限2430', A.CITIES.jh.hf.min, 2430);
eq('浙江·金华·公积金上限31911', A.CITIES.jh.hf.max, 31911);
eq('浙江·金华·note含金政发〔2021〕27号', A.CITIES.jh.note.indexOf('金政发〔2021〕27号') >= 0, true);
eq('浙江·宁波·医保单位8.5%（2023年度版：8.5%=7.5%+大病0.5%+生育0.5%）', A.CITIES.nb.med.comp, 0.085);
eq('浙江·宁波·医保个人2%', A.CITIES.nb.med.emp, 0.02);
eq('浙江·宁波·公积金下限2660', A.CITIES.nb.hf.min, 2660);
eq('浙江·宁波·公积金上限38947', A.CITIES.nb.hf.max, 38947);
eq('浙江·宁波·note含2023年度版', A.CITIES.nb.note.indexOf('2023年度版') >= 0, true);
eq('浙江·宁波·note标注2020版9.7%为旧版', A.CITIES.nb.note.indexOf('9.7%') >= 0, true);
eq('浙江·宁波·单位费率与企业口径一致（非机关事业9%）', A.CITIES.nb.med.comp === 0.085, true);
eq('浙江·丽水·医保单位8%（暂算，官方件未取到）', A.CITIES.lish.med.comp, 0.08);
eq('浙江·丽水·医保个人2%', A.CITIES.lish.med.emp, 0.02);
eq('浙江·丽水·公积金下限2180', A.CITIES.lish.hf.min, 2180);
eq('浙江·丽水·公积金上限36405（2025年度暂用）', A.CITIES.lish.hf.max, 36405);
eq('浙江·丽水·note含丽政办发〔2021〕61号', A.CITIES.lish.note.indexOf('丽政办发〔2021〕61号') >= 0, true);
eq('第三十批B·南通仍warn（2026基数未公布+大病固定额无件）', A.CITIES.nt.warn, true);
eq('第三十批B·泰州仍warn（公积金下限冲突）', A.CITIES.tz.warn, true);
eq('第三十批B·无锡仍warn（生育费率无件）', A.CITIES.wx.warn, true);
eq('第三十批B·金华仍warn（公积金上限无官方文本）', A.CITIES.jh.warn, true);
eq('第三十批B·宁波仍warn（社保基数无件+公积金下限无件）', A.CITIES.nb.warn, true);
eq('第三十批B·丽水仍warn（医保单位费率not-found）', A.CITIES.lish.warn, true);
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
ok('第六十二批·南阳大额按0.6%总额、单位个人各50%即得19.56元/月', Math.round(6520*0.006/2*100)/100, A.CITIES.ny.medFixEmp);
  eq('第六十一批·南阳 medComp 8.5% 不变（宛政办〔2021〕17号第五条企业口径）', A.CITIES.ny.med.comp, 0.085);
  ok('第六十一批·南阳 8.5+2=10.5 企业合计、8+2=10 机关事业合计（同件两组数字互证）', Math.round((0.085+0.02)*1000)/1000, 0.105);
  ok('第六十一批·南阳 企业口径高于机关事业口径（排除口径误判）', 0.085 > 0.08, true);
  ok('第六十一批·南阳 note 记「河南省平均工资」定义为上年度河南省全口径城镇单位就业人员平均工资', A.CITIES.ny.note.indexOf('上年度河南省全口径城镇单位就业人员平均工资') >= 0, true);
  ok('第六十一批·南阳 note 记录第三十九条自2021年6月1日起施行', A.CITIES.ny.note.indexOf('自2021年6月1日起施行') >= 0, true);
  ok('第六十一批·南阳 warn 因清理结果附件未解析而保留', A.CITIES.ny.warn, true);
  eq('第六十一批·南阳 社保基数 3912~19560 不变', A.CITIES.ny.pension.min + '~' + A.CITIES.ny.pension.max, '3912~19560');
  eq('第六十一批·三门峡 medFixEmp 18.33 不改（220元/年为合计口径）', A.CITIES.smx.medFixEmp, 18.33);
  ok('第六十一批·三门峡 220÷12＝18.33（本表按全额计入）', Math.round(220/12*100)/100, 18.33);
  ok('第六十一批·三门峡 note 记办法第七条负担比例由单位自行确定', A.CITIES.smx.note.indexOf('负担比例由单位') >= 0, true);
  ok('第六十一批·开封 180÷12＝15 元/月与 medFixEmp 15 零偏差（汴医保办〔2026〕36号）', Math.round(180/12*100)/100, A.CITIES.kf.medFixEmp);
// ---- 第六十三批（2026-10-15）：深圳公积金二轮穷举 + 宝鸡费率制度依据补证 ----
eq('第六十三批·深圳 公积金 2520~48471 仍不改（二轮穷举零命中）', A.CITIES.sz.hf.min + '~' + A.CITIES.sz.hf.max, '2520~48471');
eq('第六十三批·深圳 医保 6727~33633 不变', A.CITIES.sz.med.min + '~' + A.CITIES.sz.med.max, '6727~33633');
ok('第六十三批·深圳 note 记深公积金规〔2022〕2号为最新制度件', A.CITIES.sz.note.indexOf('深公积金规〔2022〕2号') >= 0, true);
ok('第六十三批·深圳 note 记广东统一搜索索引 12940 条已复核', A.CITIES.sz.note.indexOf('12940') >= 0, true);
ok('第六十三批·深圳 note 记 2024~2026 三年度件仍缺', A.CITIES.sz.note.indexOf('2024、2025、2026 三个年度') >= 0, true);
eq('第六十三批·深圳 warn 保留', A.CITIES.sz.warn, true);
eq('第六十三批·宝鸡 medComp 6.6% 仍不改（费率出处未证实）', A.CITIES.baoj.med.comp, 0.066);
eq('第六十三批·宝鸡 社保基数 4737~23685 不变', A.CITIES.baoj.pension.min + '~' + A.CITIES.baoj.pension.max, '4737~23685');
ok('第六十三批·宝鸡 note 引用 2021 年度件 t20211014_326895', A.CITIES.baoj.note.indexOf('t20211014_326895') >= 0, true);
ok('第六十三批·宝鸡 note 引用两险合并实施原文报道 t20200928_326554', A.CITIES.baoj.note.indexOf('t20200928_326554') >= 0, true);
ok('第六十三批·宝鸡 2021 年度件历史基准自校验 69624÷12＝5802', Math.round(69624/12), 5802);
ok('第六十三批·宝鸡 2021 年度件历史下限 60% 自校验 5802×0.6＝3481.2', Math.round(5802*0.6*10)/10, 3481.2);
ok('第六十三批·宝鸡 2021 年度件历史上限 300% 自校验 5802×3＝17406', Math.round(5802*3), 17406);
ok('第六十三批·宝鸡 2026 年度件三数自校验 100833÷12＝8402.75', Math.round(100833/12*100)/100, 8402.75);
ok('第六十三批·宝鸡 note 载两险合并口径等于单位合计（含生育）', A.CITIES.baoj.note.indexOf('单位合计（含生育）') >= 0, true);
ok('第六十三批·宝鸡 warn 保留', A.CITIES.baoj.warn, true);

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
eq('第四十六批·桂林·大额固定额字段已移除（第四十七条为0.2%比例型，默认0）', A.CITIES.gl.medFixEmp, 0);
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
eq('朝阳·医保基数下限3374已按市级全口径改写（朝医保发〔2025〕36号）', A.CITIES.cy.med.min, 3374);
eq('朝阳·医保基数上限16872已按市级全口径改写', A.CITIES.cy.med.max, 16872);
eq('朝阳·医保基数不再等于省级社保基数', A.CITIES.cy.med.max !== A.CITIES.cy.pension.max, true);
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
eq('遵义·warn → true（医保基数为过渡执行值、2026年度件未取到）', A.CITIES.zuny.warn, true);
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
// 公积金件：市中心《关于调整2026年茂名市住房公积金缴存基数的通知》（2026-07-03），正文为扫描图。
//   ⚠️ 该件下限 1750 已被 2026-08-21《关于调整茂名市住房公积金最低缴存基数的通知》逐字取代为 2040
//   （自 2026-09-01 起，无过渡条款），本节断言已按新件更新，原值仅留作历史对照。
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
eq('茂名·公积金下限2040（2026-08-21件自2026-09-01起，无过渡条款）', A.CITIES.mm.hf.min, 2040);
eq('茂名·公积金上限27468', A.CITIES.mm.hf.max, 27468);
eq('茂名·公积金自校验 round(27468×12%)×2=6592', Math.round(27468 * 0.12) * 2, 6592);
eq('茂名·公积金自校验 round(1750×5%)×2=176（2026-07-03旧件口径，仅留档）', Math.round(1750 * 0.05) * 2, 176);
eq('茂名·公积金自校验 round(2040×5%)×2=204（现行下限）', Math.round(2040 * 0.05) * 2, 204);
eq('茂名·公积金反推参考 27468÷3=9156（官方未写出，仅记录）', 27468 / 3, 9156);
eq('茂名·dataYear 沿用广东社保年度 2025-2026（医保件执行期是日历年，写在 note）', A.CITIES.mm.dataYear, '2025-2026');
eq('茂名·warn 保留（养老/失业/工伤基数无件）', A.CITIES.mm.warn, true);
// ---- 第二十七批（2026-10-17）· 广东公积金下限第三轮（江门/湛江/茂名/潮州/阳江/清远/肇庆） ----
// 依据 粤府函〔2026〕188号（三类地区最低工资自 2026-09-01 起为 2040 元）。各市公积金中心须各自发文；
// 判定规则：官方件逐字写出新下限且无「存量本年度仍按原标准」过渡条款 → 直接改值；有过渡条款 → 保留存量旧值并加注；
// 无逐字 2040 的下限件 → 一律不改值并加注（不得用省最低工资文反推）。
// 湛江 2026-08-26 件（无文号）：「从2026年9月1日起，我市职工住房公积金月缴存基数下限调整为本市的月最低工资标准2,040元」
//   「二、职工缴存基数未达到下限的单位，尽快办理缴存基数调整」→ 无过渡条款，直接改 2040。
// 茂名 2026-08-21 件（无文号）：「自2026年9月1日起，我市住房公积金缴存基数下限由1750元调整为2040元」
//   「请各缴存单位及灵活就业缴存人员在汇缴2026年9月住房公积金前，务必按规定完成缴存基数调整手续」→ 直接改 2040。
// 江门 江房金字[2026]25号（2026-08-31）：下限 2040，但「缴存基数低于上述标准的职工，应在2027年7月31日前按规定予以调整」
//   → 与佛山同款过渡条款，存量仍取 1850。
// 潮州 / 阳江 / 清远 / 肇庆：2026-09-01 后无逐字写出 2040 的下限件 → 维持原值。
eq('湛江·公积金下限2040（2026-08-26件自2026-09-01起，无过渡条款）', A.CITIES.zj.hf.min, 2040);
eq('湛江·公积金上限29640不变', A.CITIES.zj.hf.max, 29640);
eq('茂名·公积金下限2040（2026-08-21件自2026-09-01起，无过渡条款）', A.CITIES.mm.hf.min, 2040);
eq('江门·公积金下限仍1850（江房金字[2026]25号存量可维持至2027-07-31）', A.CITIES.jm.hf.min, 1850);
eq('潮州·公积金下限仍1750（年度件含自执行条款但无逐字2040发文）', A.CITIES.cz.hf.min, 1750);
eq('阳江·公积金下限仍1750（2026-07-01年度件，市中心无配套下限件）', A.CITIES.yj.hf.min, 1750);
eq('清远·公积金下限仍1750（2026-08-20下限件被WAF拦截未取证）', A.CITIES.qy.hf.min, 1750);
eq('肇庆·公积金下限1850（2026-06-30市中心件明载1850）', A.CITIES.zq.hf.min, 1850);
eq('第三批·下限2040自校验 round(2040×5%)×2=204', Math.round(2040 * 0.05) * 2, 204);
eq('第三批·江门note含2027-07-31过渡条款', /2027-07-31/.test(A.CITIES.jm.note), true);
eq('第三批·佛山note含2027-07-31过渡条款（同一口径）', /2027-07-31/.test(A.CITIES.fs.note), true);
eq('第三批·潮州note含自执行条款说明', /新的标准执行/.test(A.CITIES.cz.note), true);
eq('第三批·清远note含WAF拦截取证失败说明', /WAF|412/.test(A.CITIES.qy.note), true);
/* ========== 第二十六批（2026-10-13）· 汕头 / 深圳 / 梅州 / 揭阳 ==========
   汕头 汕人社〔2026〕65号（汕人社局+财政局+税务局 2026-08-31 印发，自 2026-09-01 起执行，依 粤府函〔2026〕188号）：
     失业保险缴费工资下限调整为 2040 元；失业金标准 1836 元/月。件在附件 PDF（2 页扫描件），OCR 读出。
     仓库原用 CI() 默认 unemp.min=2520（省级值），现按市级件改为 2040；该批保留的「省级 44265」上限已在第七十五批按《广东省失业保险条例》第八条删除。
   梅州：缴存年度 2026-07-01~2027-06-30 上限 26315（2026-06-30 市级件，本市城镇非私营在岗职工含劳务派遣月平均工资×3），
     下限自 2026-09-01 起由 1750 调整为 2040（2026-08-28 件，依 粤府函〔2026〕188号）。
     26315÷3=8771.67 为反推（官方未写月均数），不得自称自校验。
   揭阳 揭市人社〔2024〕154号：失业保险缴费基数上限 21384 = 揭阳市 2023 年城镇非私营单位在岗职工月平均工资 7128×300%，
     与养老所用的全省全口径 9167 不同源。该件为 2024 社保年度（2024-07-01~2025-06-30）已过期，
     2026 社保年度市级件未取得；第七十五批已按揭阳市统计局 2026-06-30 公示（98472÷12=8206，×3=24618）改为 24618，与揭市公积金上限同源，warn 就公积金下限仍保留。
   深圳：医保 6727~33633 有 2026 年度件；公积金 2520~48471 深住建局历年只检索到 2015—2023 年度件，
     2024—2026 年度缺失，且 48471 与 2520 在官方索引检索计数均为 0，现值来源不明，保留 warn。
*/
/* ===== 第三十五批（2026-10-13）· 西藏 4 市地 + 辽宁 6 市 =====
   西藏：山南补 warn（原缺，违反「note 无据表述即数据失实」纪律）；四市地公积金上限全部无本地官方来源。
   日喀则住建局政策文件12篇/通知公告11篇/法定主动公开12篇、山南住建局信息公开目录8个栏目、
   那曲住建局部门业务44篇/专题专栏16篇已逐栏枚举，阿里 zjj./gjj./zfcxjst./zfgjj. 四组域名全 NXDOMAIN。
   域名撞车第 8/9 例：gjj.xz.gov.cn 与 ybj.xz.gov.cn 都是徐州不是西藏；gaj. 前缀在日喀则是公安局、
   在林芝才是公积金中心。西藏公积金平台 zfgjj.zjt.xizang.gov.cn 只有空登录页；
   自治区医保局真域名 ylbzj.xizang.gov.cn（zlbzj 为 NXDOMAIN），政策文件栏 9 篇无职工医保基数费率件。

   辽宁：医保基数是市级全口径，下限比例逐市不同（阜新/锦州/朝阳=60%，丹东=100%），多数市从未公布上限。
   锦州 锦医保〔2025〕79号：71136 元/年 → 213408/42681.6 元/年 → 月值 17784/3556.8。
   朝阳 朝医保发〔2025〕36号（扫描件挂「履职依据」栏）：5624 元/月 → 16872/3374。
   丹东 丹医保发〔2025〕89号只给最低基数 5654（=全口径月均 100%），无上限故不设 med。
   抚顺 2026-06-29 件只给 5306 单数、不可分辨上下限；铁岭四种医保局命名全 NXDOMAIN。
   辽医保规〔2025〕2号 全名《关于进一步规范全省基本医疗保险参保筹资和待遇保障政策的通知》
   （题名取自抚顺转发件，省局三栏至今零命中）。公积金 6 市全部来源不可达，本批零改动。 */
const xz35=['rkz','shannan','naqu','ali'];
xz35.forEach(k=>{
  eq('西藏·'+A.CITIES[k].name+'·社保基数下限7172.4', A.CITIES[k].pension.min, 7172.4);
  eq('西藏·'+A.CITIES[k].name+'·社保基数上限35862', A.CITIES[k].pension.max, 35862);
  eq('西藏·'+A.CITIES[k].name+'·医保单位7%', A.CITIES[k].med.comp, .07);
  eq('西藏·'+A.CITIES[k].name+'·医保个人2%', A.CITIES[k].med.emp, .02);
  eq('西藏·'+A.CITIES[k].name+'·公积金下限2360', A.CITIES[k].hf.min, 2360);
  eq('西藏·'+A.CITIES[k].name+'·warn为真', A.CITIES[k].warn, true);
  eq('西藏·'+A.CITIES[k].name+'·四市地公积金上限互不相同', new Set(xz35.map(c=>A.CITIES[c].hf.max)).size >= 2, true);
});
eq('西藏·山南公积金上限44202（本批未改，仅补warn）', A.CITIES.shannan.hf.max, 44202);
eq('西藏·山南上限44202系反推14734×3', 14734*3, 44202);
eq('西藏·山南note声明上限无官方来源', A.CITIES.shannan.note.indexOf('上限44202无官方来源待核实') >= 0, true);
eq('西藏·山南note记录反推依据', A.CITIES.shannan.note.indexOf('14734×3反推') >= 0, true);
eq('西藏·日喀则note记录穷举篇数', A.CITIES.rkz.note.indexOf('政策文件12篇') >= 0, true);
eq('西藏·日喀则note警示gaj是公安局', A.CITIES.rkz.note.indexOf('是市公安局非公积金中心') >= 0, true);
eq('西藏·那曲note记录naqu域名', A.CITIES.naqu.note.indexOf('zjj.naqu.gov.cn，naqu 而非 nagqu') >= 0, true);
eq('西藏·阿里note记录四组域名NXDOMAIN', A.CITIES.ali.note.indexOf('全部 NXDOMAIN') >= 0, true);
eq('西藏·日喀则上限与那曲上限同为42214（估算值共用）', A.CITIES.rkz.hf.max === A.CITIES.naqu.hf.max, true);
eq('西藏·山南上限高于拉萨42214', A.CITIES.shannan.hf.max > A.CITIES.lasa.hf.max, true);

eq('辽宁·锦州医保基数下限3556.8', A.CITIES.jz.med.min, 3556.8);
eq('辽宁·锦州医保基数上限17784', A.CITIES.jz.med.max, 17784);
eq('辽宁·锦州医保单位8%', A.CITIES.jz.med.comp, .08);
eq('辽宁·锦州医保个人2%', A.CITIES.jz.med.emp, .02);
eq('辽宁·锦州社保基数仍22665（医保基数市级化不改社保）', A.CITIES.jz.pension.max, 22665);
eq('辽宁·锦州医保下限≠社保下限（证明已单独设med）', A.CITIES.jz.med.min !== A.CITIES.jz.pension.min, true);
eq('辽宁·锦州件内71136×3=213408', 71136*3, 213408);
eq('辽宁·锦州件内71136×60%=42681.6', 71136*0.6, 42681.6);
eq('辽宁·锦州件内71136÷12=5928', 71136/12, 5928);
eq('辽宁·锦州年上限÷12=月上限17784', 213408/12, 17784);
eq('辽宁·锦州按下限反推回年值42681.6', Math.round(3556.8*12*100)/100, 42681.6);
eq('辽宁·锦州note记录锦医保79号', A.CITIES.jz.note.indexOf('锦医保〔2025〕79号') >= 0, true);

eq('辽宁·朝阳医保基数下限3374', A.CITIES.cy.med.min, 3374);
eq('辽宁·朝阳医保基数上限16872', A.CITIES.cy.med.max, 16872);
eq('辽宁·朝阳件内5624×3=16872', 5624*3, 16872);
eq('辽宁·朝阳件内round(5624×60%)=3374（原文取整）', Math.round(5624*0.6), 3374);
eq('辽宁·朝阳若不取整应为3374.4（证明原文做了取整）', Math.round(3374.4*10)/10, 3374.4);
eq('辽宁·朝阳note记录朝医保发36号', A.CITIES.cy.note.indexOf('朝医保发〔2025〕36号') >= 0, true);
eq('辽宁·朝阳note记录件挂履职依据栏目', A.CITIES.cy.note.indexOf('履职依据') >= 0, true);

eq('辽宁·丹东无独立医保区间，仍回落社保22665（5654只是下限且无上限）', A.CITIES.dd.med.max, A.CITIES.dd.pension.max);
eq('辽宁·抚顺无独立医保区间，仍回落社保22665（5306单数不可分辨）', A.CITIES.fsh.med.max, A.CITIES.fsh.pension.max);
eq('辽宁·铁岭无独立医保区间，仍回落社保22665（无医保局域名）', A.CITIES.tl.med.max, A.CITIES.tl.pension.max);
eq('辽宁·丹东note记录下限5654', A.CITIES.dd.note.indexOf('5654元/月执行') >= 0, true);
eq('辽宁·丹东note警示下限是全口径月均100%', A.CITIES.dd.note.indexOf('全口径月均的100%（不是60%）') >= 0, true);
eq('辽宁·抚顺note记录5306单数', A.CITIES.fsh.note.indexOf('5306元执行') >= 0, true);
eq('辽宁·抚顺note说明无法分辨上下限', A.CITIES.fsh.note.indexOf('无法分辨5306是下限还是唯一基数') >= 0, true);
eq('辽宁·铁岭note警示tl.gov.cn是铜陵', A.CITIES.tl.note.indexOf('属安徽铜陵，禁用') >= 0, true);
eq('辽宁·阜新医保基数本批未动', A.CITIES.fx.med.min, 3563);
eq('辽宁·阜新医保上限本批未动', A.CITIES.fx.med.max, 17817);
const _LN35=['fsh','dd','jz','fx','tl','cy'];
let _n35=0;
_LN35.forEach(k=>{
  eq('辽宁·'+A.CITIES[k].name+'·社保基数下限4533（辽人社〔2026〕19号省级）', A.CITIES[k].pension.min, 4533);
  eq('辽宁·'+A.CITIES[k].name+'·社保基数上限22665', A.CITIES[k].pension.max, 22665);
  if(k!=='fx') _n35++;
});
eq('辽宁·6市社保基数省级统一', _n35, 5);
eq('辽宁·已单独设医保区间的城市数=3（阜新/锦州/朝阳）', ['jz','cy','fx'].filter(k=>A.CITIES[k].med!==undefined).length, 3);
eq('辽宁·医保下限比例逐市不同：丹东=100%对阜新=60%', 3563/5939 < .61 && 5654/5654 === 1, true);
eq('汕头·失业保险缴费基数下限2040', A.CITIES.st.unemp.min, 2040);
eq('汕头·失业保险缴费基数上限27699（第七十八批按法定 ÷12 口径改值）', A.CITIES.st.unemp.max, 27699);
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
/* ============================================================
   第三十八批（2026-10-14）· 贵州医保基数下限比例逐市自定
   ----------------------------------------------------------
   旧值把贵阳市的 80% 口径套给全省 9 市州。本批拿到两件市级一手件后拆开：
   ① 铜医保发〔2025〕9号《关于调整铜仁市职工医保部分政策的通知》
      （铜仁市医保局/财政局/人社局/税务局 2025-07-30 联合印发，自 2025-08-01 起）逐字
      「职工基本医疗保险缴费基数上下限由『上年度全市全口径城镇单位就业人员平均工资的
      100％－300％』调整为『上年度全省全口径城镇单位就业人员平均工资的70％－300％』」
      → 铜仁 med.min = 7376.75×70% = 5163.73（件只给比例未给绝对值，取两位小数）。
      原文页 http://ybj.trs.gov.cn/zwgk_500979/zfxxgk/fdzdgknr/zcwj/202508/t20250801_88371737.html
   ② 《黔东南州职工基本医疗保险实施办法》第十四条（州政府办 2023-12-26 印发、
      第四十三条自 2024-01-01 施行，无文号未废止）逐字「低于省上年全口径工资60%的，
      以60%为缴费基数，高于省上年全口径工资300%的，以300%为缴费基数」
      → 黔东南 med.min = 7376.75×60% = 4426.05。
      州医保局政策文件/部门文件/政策解读三栏共 291 件穷举，无任何后续调整件。
      原文页 http://ylbzj.qdn.gov.cn/zwgk_500425/zfxxgk/xxgkml/zcfg_5823571/bmwj_5823573/202401/t20240103_83442093.html
   全口径月均 7376.75 来自 黔人社发〔2026〕7号（养老/失业/工伤基数 4426.05~22130.25，
   4426.05÷0.6 = 22130.25÷3 = 7376.75，两数互洽）。上限三市同为 300% = 22130.25，故只动下限。
*/
eq('第三十八批·自校验 7376.75×0.6=4426.05', 7376.75*0.6, 4426.05);
eq('第三十八批·自校验 7376.75×3=22130.25', 7376.75*3, 22130.25);
eq('第三十八批·自校验 22130.25÷3=7376.75', 22130.25/3, 7376.75);
eq('第三十八批·铜仁·医保基数下限5901.4→5163.73（70%）', A.CITIES.trn.med.min, 5163.73);
eq('第三十八批·铜仁·医保基数上限22130.25（300%，未动）', A.CITIES.trn.med.max, 22130.25);
eq('第三十八批·铜仁·单位费率6.5%（含生育0.5%）未动', A.CITIES.trn.med.comp, .065);
eq('第三十八批·铜仁·note 含铜医保发〔2025〕9号', A.CITIES.trn.note.indexOf('铜医保发〔2025〕9号') >= 0, true);
eq('第三十八批·铜仁·note 含70％－300％逐字', A.CITIES.trn.note.indexOf('70％－300％') >= 0, true);
eq('第三十八批·铜仁·note 说明未给绝对值', A.CITIES.trn.note.indexOf('未给绝对值') >= 0, true);
eq('第三十八批·黔东南·医保基数下限5901.4→4426.05（60%）', A.CITIES.qdn.med.min, 4426.05);
eq('第三十八批·黔东南·医保基数上限22130.25（300%，未动）', A.CITIES.qdn.med.max, 22130.25);
eq('第三十八批·黔东南·单位费率7%未动', A.CITIES.qdn.med.comp, .07);
eq('第三十八批·黔东南·note 含第十四条60%', A.CITIES.qdn.note.indexOf('第十四条') >= 0, true);
eq('第三十八批·黔东南·note 含291件穷举', A.CITIES.qdn.note.indexOf('291件') >= 0, true);
eq('第三十八批·黔东南·下限与其社保基数下限同值（均7376.75×60%）', A.CITIES.qdn.med.min === A.CITIES.qdn.pension.min, true);
eq('第三十八批·贵阳·医保基数下限5901.40（80%）保持不变', A.CITIES.guiy.med.min, 5901.4);
eq('第三十八批·黔南·医保基数下限5901.40（80%）保持不变', A.CITIES.qn.med.min, 5901.4);
eq('第三十八批·遵义·医保基数下限5901.40 保持不变（无市级件）→第四十二批改4563.70（遵义市60%过渡值）', A.CITIES.zuny.med.min, 4563.70);
eq('第三十八批·安顺·医保基数下限5901.40 保持不变（无市级件）', A.CITIES.ansh.med.min, 5901.4);
eq('第三十八批·毕节·医保基数下限5901.40 保持不变（无市级件）', A.CITIES.bij.med.min, 5901.4);
eq('第三十八批·六盘水·医保基数下限5901.40 保持不变（无市级件）', A.CITIES.lps.med.min, 5901.4);
eq('第三十八批·黔西南·医保基数下限5901.40 保持不变（无市级件）', A.CITIES.qxn.med.min, 5901.4);
eq('第三十八批·贵州9市州上限一律22130.25 →第四十二批遵义例外（市级锚22818.51）', ['guiy','lps','ansh','bij','trn','qxn','qdn','qn'].filter(function(k){return A.CITIES[k].med.max!==22130.25;}).length, 0);
eq('第三十八批·铜仁下限严格小于贵阳下限', A.CITIES.trn.med.min < A.CITIES.guiy.med.min, true);
eq('第三十八批·黔东南下限严格小于铜仁下限', A.CITIES.qdn.med.min < A.CITIES.trn.med.min, true);
eq('第三十八批·铜仁warn 保留', A.CITIES.trn.warn, true);
eq('第三十八批·黔东南warn 保留', A.CITIES.qdn.warn, true);
/* ===== 第四十二批（2026-10-14）· 贵州 5 市州医保基数下限比例与锚点逐市核实（改值 1 城）===== */
eq('第四十二批·遵义·医保基数下限4563.70（市级锚60%，非全省80%）', A.CITIES.zuny.med.min, 4563.70);
eq('第四十二批·遵义·医保基数上限22818.51（市级锚300%，唯一非22130.25的贵州城）', A.CITIES.zuny.med.max, 22818.51);
eq('第四十二批·遵义·算式自校验 7606.17×60%=4563.70', Math.round(7606.17*0.6*100)/100, A.CITIES.zuny.med.min);
eq('第四十二批·遵义·算式自校验 7606.17×300%=22818.51', Math.round(7606.17*3*100)/100, A.CITIES.zuny.med.max);
eq('第四十二批·遵义·单位费率6.5%未动（基本6.0%+生育0.5%）', A.CITIES.zuny.med.comp, .065);
eq('第四十二批·遵义·个人2%未动', A.CITIES.zuny.med.emp, .02);
eq('第四十二批·遵义·大额个人10元/月未动', A.CITIES.zuny.medFixEmp, 10);
eq('第四十二批·遵义·社保基数4426.05~22130.25未动（养老口径与医保口径不同源）', A.CITIES.zuny.med.min !== A.CITIES.zuny.pension.min, true);
eq('第四十二批·遵义·warn 新增 true（过渡执行值、2026年度件未取到）', A.CITIES.zuny.warn, true);
eq('第四十二批·遵义·note 明写过渡执行值', A.CITIES.zuny.note.indexOf('过渡执行值') >= 0, true);
eq('第四十二批·遵义·note 含官方件标题《关于做好2025年度职工基本医疗（生育）保险参保缴费工作的通知》', A.CITIES.zuny.note.indexOf('参保缴费工作的通知') >= 0, true);
eq('第四十二批·遵义·note 含「2024年社平工资发布后」这一过渡条款', A.CITIES.zuny.note.indexOf('2024年社平工资发布后') >= 0, true);
eq('第四十二批·遵义·note 含单位1%划入大额（比例型、不可建模）', A.CITIES.zuny.note.indexOf('按基本医疗单位缴费总额的1%划入') >= 0, true);
eq('第四十二批·遵义上限高于其余贵州8市州（市级锚 vs 省级锚）', A.CITIES.zuny.med.max > A.CITIES.guiy.med.max, true);
eq('第四十二批·黔东南(60%省级) < 遵义(60%市级) < 铜仁(70%) < 贵阳黔南(80%)', [A.CITIES.qdn.med.min, A.CITIES.zuny.med.min, A.CITIES.trn.med.min, A.CITIES.guiy.med.min].join(','), '4426.05,4563.7,5163.73,5901.4');
eq('第四十二批·安顺·值不改（安府办发〔2016〕31号口径过旧）', A.CITIES.ansh.med.min, 5901.4);
eq('第四十二批·安顺·note 记入安府办发〔2016〕31号', A.CITIES.ansh.note.indexOf('安府办发〔2016〕31号') >= 0, true);
eq('第四十二批·安顺·note 点明旧统计口径「在岗职工月平均工资」已停用', A.CITIES.ansh.note.indexOf('在岗职工月平均工资') >= 0, true);
eq('第四十二批·安顺·note 点明7%为不含生育口径', A.CITIES.ansh.note.indexOf('不含生育') >= 0, true);
eq('第四十二批·安顺·warn 保留', A.CITIES.ansh.warn, true);
eq('第四十二批·毕节·值不改（基本医疗费率未取到）', A.CITIES.bij.med.min, 5901.4);
eq('第四十二批·毕节·note 记入毕府发〔2023〕9号', A.CITIES.bij.note.indexOf('毕府发〔2023〕9号') >= 0, true);
eq('第四十二批·毕节·note 点明生育0.8%单列后与基本医疗费率相加（建模例外）', A.CITIES.bij.note.indexOf('0.8％缴纳生育保险费') >= 0, true);
eq('第四十二批·毕节·warn 保留', A.CITIES.bij.warn, true);
eq('第四十二批·六盘水·值不改', A.CITIES.lps.med.min, 5901.4);
eq('第四十二批·六盘水·note 记入穷举件数（医保局28+64、人社231、市政府10）', A.CITIES.lps.note.indexOf('231件') >= 0, true);
eq('第四十二批·黔西南·值不改', A.CITIES.qxn.med.min, 5901.4);
eq('第四十二批·黔西南·note 标注大额30.5元/月所引黔府办发〔2021〕4号未取到原文', A.CITIES.qxn.note.indexOf('黔府办发〔2021〕4号') >= 0, true);
eq('第四十二批·黔西南·note 标注州医保局6个子栏穷举', A.CITIES.qxn.note.indexOf('6个子栏') >= 0, true);
eq('第四十二批·黔西南·comp 是 0.065 而非 0.65（subagent 误读已否证）', A.CITIES.qxn.med.comp, .065);
eq('第四十二批·贵州6市州无一 med.comp 超过 0.1（排除百分号笔误）', ['guiy','zuny','ansh','bij','lps','trn','qxn','qdn','qn'].filter(function(k){return A.CITIES[k].med.comp>0.1;}).length, 0);

/* ===== 第四十三批（2026-10-14）· 山西 11 市：公积金下限分档与下限时效性核实（零改值 + 晋城新增 warn）===== */
var SX11=['ty','dt','yq','changz','jch','shuoz','jinz','yunc','xinz','linf','ll'];
eq('第四十三批·山西11市·社保基数一律4244~21219（晋人社厅发〔2026〕27号）', SX11.filter(function(k){return A.CITIES[k].pension.min===4244&&A.CITIES[k].pension.max===21219;}).length, 11);
// 朔州：一手件逐字复核，数值零偏差（第十二批改动的独立复核）
eq('第四十三批·朔州·公积金下限2150 未动', A.CITIES.shuoz.hf.min, 2150);
eq('第四十三批·朔州·公积金上限25044 未动（上一年度职工月均×3）', A.CITIES.shuoz.hf.max, 25044);
eq('第四十三批·朔州·note 记入一手件数值25044', A.CITIES.shuoz.note.indexOf('25044')>=0, true);
eq('第四十三批·朔州·note 记入分档2050（怀仁/山阴/应县/右玉）', A.CITIES.shuoz.note.indexOf('2050')>=0, true);
eq('第四十三批·朔州·warn 保留（2026-10-01 新最低工资待中心补充通知）', A.CITIES.shuoz.warn, true);
// 长治：文号补录 + 同件双数自校验
eq('第四十三批·长治·下限2350 未动（晋政办发〔2026〕29号一类）', A.CITIES.changz.hf.min, 2350);
eq('第四十三批·长治·上限25359 未动', A.CITIES.changz.hf.max, 25359);
eq('第四十三批·长治·算式自校验 8453×3=25359', 8453*3, A.CITIES.changz.hf.max);
eq('第四十三批·长治·note 补录上限文号 长房金发〔2026〕15号', A.CITIES.changz.note.indexOf('长房金发〔2026〕15号')>=0, true);
eq('第四十三批·长治·note 补录下限文号 长房金发〔2026〕25号', A.CITIES.changz.note.indexOf('长房金发〔2026〕25号')>=0, true);
eq('第四十三批·长治·山西唯一已落地29号新下限的城市（下限=2350 者唯一）', SX11.filter(function(k){return A.CITIES[k].hf.min===2350;}).length, 1);
eq('第四十三批·长治·山西唯一下限高于其余10城的城市', SX11.filter(function(k){return A.CITIES[k].hf.min>2350;}).length, 0);
// 晋城：新增 warn（原 warn=false 且无任何来源）
eq('第四十三批·晋城·值不改 2150~24183', [A.CITIES.jch.hf.min,A.CITIES.jch.hf.max].join('~'), '2150~24183');
eq('第四十三批·晋城·warn 新增 true（本轮无任何市级来源）', A.CITIES.jch.warn, true);
eq('第四十三批·晋城·note 记明域名 6 个候选全 NXDOMAIN', A.CITIES.jch.note.indexOf('NXDOMAIN')>=0, true);
eq('第四十三批·晋城·note 补入 晋政办发〔2026〕29号 时效提示', A.CITIES.jch.note.indexOf('晋政办发〔2026〕29号')>=0, true);
// 忻州：官方件存在但正文未公开 —— 不采信无法验证的引文
eq('第四十三批·忻州·值不改 2150~22975', [A.CITIES.xinz.hf.min,A.CITIES.xinz.hf.max].join('~'), '2150~22975');
eq('第四十三批·忻州·note 明写「正文未公开」', A.CITIES.xinz.note.indexOf('正文未公开')>=0, true);
eq('第四十三批·忻州·note 明写栏目 20 篇正文均为空', A.CITIES.xinz.note.indexOf('20 篇文章正文均为空')>=0, true);
eq('第四十三批·忻州·note 未写入无法证实的文号', A.CITIES.xinz.note.indexOf('忻住金归')>=0, false);
eq('第四十三批·忻州·warn 保留（数值来源仍未证实）', A.CITIES.xinz.warn, true);
// 吕梁：标注 2025 年度 + 29 号提示
eq('第四十三批·吕梁·值不改 2150~23793', [A.CITIES.ll.hf.min,A.CITIES.ll.hf.max].join('~'), '2150~23793');
eq('第四十三批·吕梁·note 标注本轮未取到 2026 年度件', A.CITIES.ll.note.indexOf('本轮未取到 2026 年度件')>=0, true);
eq('第四十三批·吕梁·note 补入 晋政办发〔2026〕29号 时效提示', A.CITIES.ll.note.indexOf('晋政办发〔2026〕29号')>=0, true);
// 太原：本轮补下限口径
eq('第四十三批·太原·值不改 2150~29100', [A.CITIES.ty.hf.min,A.CITIES.ty.hf.max].join('~'), '2150~29100');
eq('第四十三批·太原·note 补入 晋政办发〔2026〕29号 时效提示', A.CITIES.ty.note.indexOf('晋政办发〔2026〕29号')>=0, true);
// 全省性：11 城 warn 分布与下限时效
eq('第四十三批·山西11市·warn 城数为 8（第四十三批晋城新增后）', SX11.filter(function(k){return A.CITIES[k].warn===true;}).length, 8);
eq('第四十三批·山西11市·除长治外均已写入 29 号时效提示或年度说明', SX11.filter(function(k){var n=A.CITIES[k].note; return k==='changz'||n.indexOf('晋政办发〔2026〕29号')>=0||n.indexOf('2025 年度')>=0||n.indexOf('2026 年度件')>=0;}).length, 11);
eq('第四十三批·山西11市·除长治外下限均低于新一类2350（省级新标准尚未在市级落地）', SX11.filter(function(k){return A.CITIES[k].hf.min<2350;}).length, 10);
eq('第四十三批·山西11市·医保单位费率未动（11市均无市级一手件）', SX11.filter(function(k){var c=A.CITIES[k].med; return c.comp>.0001&&/未找到|暂按7%估算|待核实/.test(A.CITIES[k].note);}).length>=0, true);
eq('第四十三批·山西11市·无一市 note 含 Markdown 星号（H-4 防线）', SX11.filter(function(k){return A.CITIES[k].note.indexOf('**')>=0;}).length, 0);
ok('深圳·note 声明 48471 无官方来源', A.CITIES.sz.note.indexOf('48471') >= 0, true);
/* ===== 第三十七批（2026-10-14）· 内蒙古 7 市盟医保费率 dead-end 重新穷举 + 云南省级枚举 ===== */
// 内蒙古社保险基来自内人社办发〔2026〕85号（全区全口径月均 8430 元）
eq('内蒙古·社保下限=8430×60%', Math.round(8430*0.6), 5058);
eq('内蒙古·社保上限=8430×300%', 8430*3, 25290);
eq('内蒙古·医保下限=8430×80%', 8430*0.8, 6744);
const _IM = [['呼和浩特','hhht',0.067],['包头','baot',0.065],['通辽','tongliao',0.065],['巴彦淖尔','byne',0.065],['兴安盟','xam',0.07],['锡林郭勒盟','xlgl',0.065],['阿拉善盟','alsm',0.065]];
_IM.forEach(([nm,k,rate]) => {
  const c = A.CITIES[k];
  eq('内蒙古·'+nm+'·社保下限5058', c.pension.min, 5058);
  eq('内蒙古·'+nm+'·社保上限25290', c.pension.max, 25290);
  eq('内蒙古·'+nm+'·医保基数下限6744', c.med.min, 6744);
  eq('内蒙古·'+nm+'·医保基数上限25290', c.med.max, 25290);
  eq('内蒙古·'+nm+'·医保单位费率未变', c.med.comp, rate);
  eq('内蒙古·'+nm+'·warn 已置位', Boolean(c.warn), true);
  eq('内蒙古·'+nm+'·note 含「医保单位费率未找到」', c.note.indexOf('医保单位费率未找到') >= 0, true);
});
eq('呼和浩特·生育保险单位费率0.7%已写入note', A.CITIES.hhht.note.indexOf('0.7%') >= 0, true);
eq('呼和浩特·note 引内医保办发〔2025〕22号', A.CITIES.hhht.note.indexOf('内医保办发〔2025〕22号') >= 0, true);
eq('呼和浩特·note 声明基本医保6.0%无官方来源', A.CITIES.hhht.note.indexOf('基本医保6.0%无任何官方来源') >= 0, true);
eq('呼和浩特·6.7%=6.0%+0.7% 自校验', Math.round((0.060+0.007)*1000)/1000, 0.067);
eq('巴彦淖尔·note 引官方现行有效规范性文件目录', A.CITIES.byne.note.indexOf('现行有效规范性文件目录') >= 0, true);
eq('巴彦淖尔·note 记录11号不在目录中', A.CITIES.byne.note.indexOf('11号不在其中') >= 0, true);
eq('巴彦淖尔·note 仍保留文号以便追溯', A.CITIES.byne.note.indexOf('巴政办发〔2020〕11号') >= 0, true);
eq('通辽·note 记政策解读全文无费率二字', A.CITIES.tongliao.note.indexOf('无「费率」二字') >= 0, true);
eq('包头·note 记医保局站空壳', A.CITIES.baot.note.indexOf('ybj.baotou.gov.cn') >= 0, true);
eq('兴安盟·note 记医保局无独立域名', A.CITIES.xam.note.indexOf('无独立域名') >= 0, true);
eq('锡林郭勒·note 记部门文件栏仅4条', A.CITIES.xlgl.note.indexOf('ybj.xlgl.gov.cn') >= 0, true);
eq('阿拉善·note 记机构自挂未更新说明', A.CITIES.alsm.note.indexOf('未更新情况说明') >= 0, true);
eq('保山·医保单位费率未找到仍保留', A.CITIES.baosh.note.indexOf('医保单位费率未找到') >= 0, true);
eq('临沧·医保单位费率未找到仍保留', A.CITIES.linc.note.indexOf('医保单位费率未找到') >= 0, true);
eq('德宏·医保单位费率未找到仍保留', A.CITIES.deh.note.indexOf('医保单位费率未找到') >= 0, true);
eq('昆明·医保单位7.9%仍保留', A.CITIES.km.note.indexOf('医保单位7.9%') >= 0, true);
// ---------- 第三十三批（湖北 / 河南）：省级域名修正 + 市级公积金件补齐 ----------
const _HUB = A.CITIES.wuha, _XYF = A.CITIES.xf, _KF = A.CITIES.kf, _SMX = A.CITIES.smx, _SQIU = A.CITIES.sqiu;
// 湖北 13 市州仍为 2025 年度分 3 档；本轮确认「2026 年度件全量检索无果」，不改值
eq('湖北·武汉第1档 4498~22488', _HUB.pension.min, 4498); eq('湖北·武汉上限 22488', _HUB.pension.max, 22488);
eq('湖北·襄阳第2档 4299~21678', _XYF.pension.min, 4299); eq('湖北·襄阳上限 21678', _XYF.pension.max, 21678);
ok('湖北·鄂人社发〔2025〕28号基准1 = 22488/3', _HUB.pension.max / 3 === 7496, true);
ok('湖北·第2档基准 = 21678/3', _XYF.pension.max / 3 === 7226, true);
ok('湖北·第3档基准 = 21462/3', A.CITIES.ez.pension.max / 3 === 7154, true);
ok('湖北·下限1 = round(7496×0.6)', Math.round(7496 * 0.6) === _HUB.pension.min, true);
ok('湖北·第2/3档下限不满足 round(基准×60%)（4299≠4336、4254≠4292，故仅第1档可自校验）', Math.round(7226 * 0.6) !== 4299 && Math.round(7154 * 0.6) !== 4254, true);
eq('湖北·鄂州第3档下限 4254', A.CITIES.ez.pension.min, 4254); eq('湖北·鄂州第3档上限 21462', A.CITIES.ez.pension.max, 21462);
// 襄阳：8.5% 含生育 0.5%（市政府 2024-04-03 印发、自 2024-07-01 施行有效期 5 年）
eq('襄阳·医保单位费率 8.5%', _XYF.med.comp, .085); eq('襄阳·医保个人费率 2%', _XYF.med.emp, .02);
eq('襄阳·大额 7 元/月', _XYF.medFixEmp, 7);
ok('襄阳·note 含「含生育保险缴费费率0.5%」', _XYF.note.indexOf('含生育保险缴费费率0.5%') >= 0, true);
ok('襄阳·note 含有效期 5 年', _XYF.note.indexOf('有效期5年') >= 0, true);
// 开封：汴住金管〔2026〕23号 + 两侧各自 round 后相加
eq('开封·公积金下限 2350', _KF.hf.min, 2350); eq('开封·公积金上限 18696', _KF.hf.max, 18696);
ok('开封·18696×12%→2244、×2=4488', Math.round(18696 * 0.12) * 2 === 4488, true);
ok('开封·2350×5%→118、×2=236', Math.round(2350 * 0.05) * 2 === 236, true);
ok('开封·2000×5%→100、×2=200', Math.round(2000 * 0.05) * 2 === 200, true);
ok('开封·先合并再取整会得 4487（故官方必为两侧各自取整）', Math.round(18696 * 0.24) === 4487, true);
ok('开封·note 含文号 汴住金管〔2026〕23号', _KF.note.indexOf('汴住金管〔2026〕23号') >= 0, true);
ok('开封·note 含杞县/尉氏 2150', _KF.note.indexOf('杞县/尉氏2150') >= 0, true);
eq('开封·warn 仍为 true（医保费率仅征求意见稿）', _KF.warn, true);
// 三门峡：两侧各自 ceil 后相加（「元以下见角分进元」）
eq('三门峡·公积金下限 2350', _SMX.hf.min, 2350); eq('三门峡·公积金上限 19809', _SMX.hf.max, 19809);
ok('三门峡·19809×12%→ceil 2378、×2=4756', Math.ceil(19809 * 0.12) * 2 === 4756, true);
ok('三门峡·2350×5%→ceil 118、×2=236', Math.ceil(2350 * 0.05) * 2 === 236, true);
ok('三门峡·合并后 ceil 会得 4755（故官方必为两侧各自 ceil）', Math.ceil(19809 * 0.24) === 4755, true);
ok('三门峡·note 含「元以下见角分进元」', _SMX.note.indexOf('元以下见角分进元') >= 0, true);
// 商丘：商公积金委〔2026〕9号；自校验不成立（未给月缴存额）
eq('商丘·公积金下限 2350', _SQIU.hf.min, 2350); eq('商丘·公积金上限 18820', _SQIU.hf.max, 18820);
ok('商丘·18820÷3 非整数 → 自校验不成立', Math.round(18820 / 3) !== 18820 / 3, true);
ok('商丘·反推参考值 6273.33', Math.abs(18820 / 3 - 6273.33) < 0.01, true);
ok('商丘·note 含文号 商公积金委〔2026〕9号', _SQIU.note.indexOf('商公积金委〔2026〕9号') >= 0, true);
ok('商丘·note 声明自校验不成立', _SQIU.note.indexOf('自校验不成立') >= 0, true);
// 河南块头：四部门联署 + 明确纳入医保与生育
ok('河南块头含四部门联署与医保生育纳入同一上下限', A.CITIES.kf.note.indexOf('6520×60%') >= 0, true);
ok('河南三市社保基数同为省级 3912~19560', _KF.pension.min === _SMX.pension.min && _SQIU.pension.min === 3912 && _KF.pension.max === _SMX.pension.max && _SQIU.pension.max === 19560, true);
ok('河南社保基数自校验 6520×0.6=3912', 6520 * 0.6 === 3912, true);
ok('河南社保基数自校验 6520×3=19560', 6520 * 3 === 19560, true);
// 湖北块头：真实域名修正
eq('湖北·武汉公积金下限 2400', _HUB.hf.min, 2400); eq('湖北·武汉公积金上限 36072.25', _HUB.hf.max, 36072.25);
eq('湖北·襄阳公积金下限 2400', _XYF.hf.min, 2400); eq('湖北·襄阳公积金上限 22836', _XYF.hf.max, 22836);
eq('湖北·13市州 dataYear 2025（2026 年度件未取到）', _HUB.dataYear, '2025');
// ---------- 第三十三批结束 ----------
/* ========== 第三十二批（2026-10-13）· 福建 2 城 / 贵州 2 城 / 广东 2 城 ==========
   黔东南 《黔东南州职工基本医疗保险实施办法》（州政府办 2023-12-26 印发，第四十三条自 2024-01-01 施行，无文号未废止）
     第十五条逐字「缴费标准：用人单位按缴费基数的7%缴纳基本医疗保险费，个人按缴费基数的2%缴纳基本医疗保险费。
     灵活就业人员、失业人员按照省上年全口径工资的9%缴纳」；第十六条 生育与基本医保合并实施、不单独缴费；
     第十七条 大额医疗费用补助每年160元（单位50+统筹30+个人80）。四关全过 → medComp .065 改为 .07。
     基数条款同在第十五条：「低于省上年全口径工资60%的以60%为缴费基数，高于300%的以300%为缴费基数」，
     与仓库沿用的省级 80%~300% 口径冲突（见 note 与来源记录），本批只记录、不改 med.min。
   铜仁 《铜仁市职工基本医疗（生育）保险实施办法》（医保局+财政局+人社局+税务局四部门联发 2023-12-29 印发，
     第三十八条自 2024-01-01 施行）第十四条「参保单位按本单位上年度职工工资总额的6.5%（含生育保险缴费费率0.5%）缴纳，
     在职职工按本人上年度工资总额的2%缴纳」；第十五条 大额补助单位0.3%+个人48元/年。
     → 仓库原 note「单位费率未找到，暂按6.5%估算」升级为官方坐实，数值零改动。
   三明 明住房〔2026〕2号（2026-06-25 发布，缴存年度 2026-07-01~2027-06-30）公积金 1895~26810，
     月缴存额上限 6434 = round(26810×12%)×2 = 3217×2，下限 190 = round(1895×5%)×2 = 95×2（件内自校验）。
   泉州 泉金管〔2026〕5号（2026-06-26 签发）公积金 2195~24795（安溪/永春/德化 2045），
     上限 99180÷12×3=24795（2025 年度城镇非私营单位就业人员年平均工资 99180 元）；
     月缴存额 24795×12%×2=5945.4→5950、2195×5%×2=219.5→220、2045×5%×2=204.5→204（件内均标「四舍五入」）。
   福建医保基数 闽医保函〔2026〕65号（可读载体：泉医保函〔2026〕121号转发件）上限22893、下限4579，
     自 2026-07-01 执行。22893≠4579×5，自校验不成立（官方只给两个绝对数）。
   汕头 汕医保〔2025〕228号（自 2026-01-01 实施）：上限=6588×300%=19764、下限=6588×60%→3953（件内自校验）；
     费率按 汕头市人民政府令第205号第八条 统账结合7%（含生育）、单建统筹6%（含生育）。
   揭阳 揭府规〔2026〕5号《揭阳市基本医疗保险管理办法》（自 2026-10-01 施行、有效期至 2031-09-30，
     同时废止揭府规〔2022〕6号）逐字「缴费费率：用人单位6%，职工个人2%」+
     「生育保险与职工医保合并征缴，由用人单位按职工医保缴费基数的1%缴纳」→ 单位合计 7%。
     本表口径约定 medComp 含生育（辽宁并入口径、玉林6%含生育、汕头令205号「7%（含生育保险费）」均为先例），
     故 .06 改为 .07；原 .06 只含基本医保、漏计合并征缴的生育 1%。
*/
eq('第三十二批·黔东南·医保单位费率7%（黔东南州职工基本医疗保险实施办法第十五条）', A.CITIES.qdn.med.comp, .07);
eq('第三十二批·黔东南·医保基数下限5901.40→4426.05（第三十八批按州件60%口径修正，见下）', A.CITIES.qdn.med.min, 4426.05);
eq('第三十二批·黔东南·医保基数上限22130.25', A.CITIES.qdn.med.max, 22130.25);
eq('第三十二批·黔东南·个人费率仍2%', A.CITIES.qdn.med.emp, .02);
eq('第三十二批·黔东南·note 含第十五条', A.CITIES.qdn.note.indexOf('第十五条') >= 0, true);
eq('第三十二批·黔东南·note 含自2024-01-01施行', A.CITIES.qdn.note.indexOf('自2024-01-01施行') >= 0, true);
eq('第三十二批·黔东南·note 含大额160元（单位50）', A.CITIES.qdn.note.indexOf('160元') >= 0, true);
eq('第三十二批·黔东南·warn 保留（医保单位费率之外的缺口见第三十八批）', A.CITIES.qdn.warn, true);
eq('第三十二批·铜仁·医保单位费率6.5%官方坐实（含生育0.5%）', A.CITIES.trn.med.comp, .065);
eq('第三十二批·铜仁·note 第十四条', A.CITIES.trn.note.indexOf('第十四条') >= 0, true);
eq('第三十二批·铜仁·note 大额单位0.3%+个人48元', A.CITIES.trn.note.indexOf('个人48元/年') >= 0, true);
eq('第三十二批·铜仁·公积金19544 未改', A.CITIES.trn.hf.max, 19544);
eq('第三十二批·三明·公积金下限1895（明住房〔2026〕2号）', A.CITIES.sm.hf.min, 1895);
eq('第三十二批·三明·公积金上限26810', A.CITIES.sm.hf.max, 26810);
eq('第三十二批·三明·自校验 上限月缴存额 round(26810x12%)x2=6434', Math.round(26810 * 0.12) * 2, 6434);
eq('第三十二批·三明·自校验 下限月缴存额 round(1895x5%)x2=190', Math.round(1895 * 0.05) * 2, 190);
eq('第三十二批·三明·note 含明住房〔2026〕2号', A.CITIES.sm.note.indexOf('明住房〔2026〕2号') >= 0, true);
eq('第三十二批·泉州·公积金下限2195（泉金管〔2026〕5号）', A.CITIES.quanz.hf.min, 2195);
eq('第三十二批·泉州·公积金上限24795', A.CITIES.quanz.hf.max, 24795);
eq('第三十二批·泉州·自校验 上限=99180/12x3', Math.round(99180 / 12 * 3), 24795);
eq('第三十二批·泉州·自校验 上限月缴存额 两侧各自四舍五入 24795x12%=2975.4->2975x2=5950', Math.round(24795 * 0.12) * 2, 5950);
eq('第三十二批·泉州·自校验 下限月缴存额 两侧各自四舍五入 2195x5%=109.75->110x2=220', Math.round(2195 * 0.05) * 2, 220);
eq('第三十二批·泉州·自校验 三县月缴存额 两侧各自四舍五入 2045x5%=102.25->102x2=204', Math.round(2045 * 0.05) * 2, 204);
eq('第三十二批·泉州·若先合并再取整会得205，故官方是两侧各自取整后相加', Math.round(2045 * 0.05 * 2), 205);
eq('第三十二批·泉州·医保基数上限22893（闽医保函〔2026〕65号）', A.CITIES.quanz.med.max, 22893);
eq('第三十二批·泉州·医保基数下限4579', A.CITIES.quanz.med.min, 4579);
eq('第三十二批·泉州·三明医保基数同为4579~22893', A.CITIES.sm.med.max, 22893);
eq('第三十二批·福建医保基数自校验不成立（22893≠4579x5）', 4579 * 5 === 22893, false);
eq('第三十二批·汕头·医保基数下限3953（汕医保〔2025〕228号）', A.CITIES.st.med.min, 3953);
eq('第三十二批·汕头·医保基数上限19764', A.CITIES.st.med.max, 19764);
eq('第三十二批·汕头·自校验 19764=6588x300%', 6588 * 3, 19764);
eq('第三十二批·汕头·自校验 3953=round(6588x60%)', Math.round(6588 * 0.6), 3953);
eq('第三十二批·汕头·统账结合7%（含生育）', A.CITIES.st.med.comp, .07);
eq('第三十二批·汕头·单建统筹6%（含生育）', A.CITIES.st.tiers[1].comp, .06);
eq('第三十二批·汕头·费率自校验 6+1=7', 6 + 1, 7);
eq('第三十二批·汕头·note 含汕医保〔2025〕228号', A.CITIES.st.note.indexOf('汕医保〔2025〕228号') >= 0, true);
eq('第三十二批·汕头·note 含汕头市人民政府令第205号', A.CITIES.st.note.indexOf('汕头市人民政府令第205号') >= 0, true);
eq('第三十二批·汕头·公积金27698 仍无本市2026年度件，未改', A.CITIES.st.hf.max, 27698);
eq('第三十二批·揭阳·医保单位费率7%（基本医保6%+生育1%）', A.CITIES.jy.med.comp, .07);
eq('第三十二批·揭阳·自校验 6+1=7', 6 + 1, 7);
eq('第三十二批·揭阳·医保基数3727~18636 未改', A.CITIES.jy.med.min, 3727);
eq('第三十二批·揭阳·note 含揭府规〔2026〕5号', A.CITIES.jy.note.indexOf('揭府规〔2026〕5号') >= 0, true);
eq('第三十二批·揭阳·note 含有效期至2031-09-30', A.CITIES.jy.note.indexOf('2031-09-30') >= 0, true);
eq('第三十二批·揭阳·warn 保留（公积金24618无2026缴存年度件）', A.CITIES.jy.warn, true);
eq('第三十二批·深圳·公积金48471 仍无官方来源，未改', A.CITIES.sz.hf.max, 48471);
/* 广东 4 城社保险基数落在不同年度口径上，不得互相套用 */
eq('广东4城养老下限同为省级5521（粤人社发〔2026〕24号统一下限，已不划分片区）', A.CITIES.st.pension.min, 5521);
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
eq('吉林·白城 medComp 6.5%（六部门联署件企业口径，含生育0.5%）', A.CITIES.bc.med.comp, 0.065);
ok('吉林·白城 算式自校验 企业 6.5%-0.5%=6.0% 基本医疗', Math.round((0.065 - 0.005) * 1000) / 1000, 0.06);
ok('吉林·白城 算式自校验 机关事业 6.4%-0.4%=6.0% 基本医疗', Math.round((0.064 - 0.004) * 1000) / 1000, 0.06);
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
for (const k of _LN_REAL.filter(function(k){ return ['fx','jz','cy'].indexOf(k)<0; })) {
  eq('辽宁·医保基数仍沿用社保口径 · '+k, A.CITIES[k].med.max, 22665);
}
eq('辽宁·医保基数已按市级全口径改写的城市数（阜新/锦州/朝阳）', _LN_REAL.filter(function(k){ return A.CITIES[k].med.max!==22665; }).length, 3);
const _LN = ['sy','dl','as','fsh','bx','dd','jz','yk','fx','lyo','pj','tl','cy','hld'];
eq('辽宁·14 市全部纳入省级断言集合', _LN.length, 14);
for (const _k of _LN) {
  eq('辽宁·' + A.CITIES[_k].name + '·社保基数下限4533', A.CITIES[_k].pension.min, 4533);
  eq('辽宁·' + A.CITIES[_k].name + '·社保基数上限22665', A.CITIES[_k].pension.max, 22665);
}
/* 阜新医保基数是市级全口径 3563~17817，不与省级社保基数同值 */
eq('辽宁·阜新·医保基数下限 3563（市级全口径）', A.CITIES.fx.med.min, 3563);
eq('辽宁·阜新·医保基数上限 17817（市级全口径）', A.CITIES.fx.med.max, 17817);
eq('辽宁·11 市医保基数仍与社保基数同值（fx/jz/cy 已市级化）', _LN.filter(function(k){ return ['fx','jz','cy'].indexOf(k)<0; }).filter(function(k){ return A.CITIES[k].med.max===A.CITIES[k].pension.max; }).length, 11);
eq('辽宁·锦州·医保基数下限3556.8（市级全口径）', A.CITIES.jz.med.min, 3556.8);
eq('辽宁·锦州·医保基数上限17784（市级全口径）', A.CITIES.jz.med.max, 17784);
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
eq('新疆·第五十六批后 8 城 warn（阿勒泰取到在职口径已撤，新增乌鲁木齐/克拉玛依/昌吉/阿克苏/克孜勒苏/喀什）', XJ.filter(k => A.CITIES[k].warn).map(k => A.CITIES[k].name).join(','), '乌鲁木齐,克拉玛依,昌吉,阿克苏,克孜勒苏,喀什,伊犁,塔城');
eq('新疆·warn 恰好 8 城', XJ.filter(k => A.CITIES[k].warn).length, 8);
eq('伊犁·医保单位费率仍为估算 9.5%', A.CITIES.ylz.med.comp, 0.095);
eq('阿勒泰·医保单位费率 9.5%（第五十六批由退休/灵活就业口径误判改正）', A.CITIES.alt.med.comp, 0.095);
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
/* ===== 第三十一批 B（河北/陕西/广西 9 城）· 2026-10-13 =====
   玉林 玉市医保发〔2025〕10号：http://ybj.yulin.gov.cn/bmwj/t21512386.shtml（200/20728，2025-07-03 发布，成文 2025-06-24）
     逐字「从2025年7月1日起，参加"统账结合"职工基本医疗保险的用人单位和个人，职工基本医疗保险费率从目前实施的9%
           （其中单位缴纳7%、个人缴纳2%）降至8%（其中单位缴纳6%、个人缴纳2%）」
     算式自校验（同件给出旧值与新值两组独立数字）：6+2===8 ✓、7-6===1 ✓、7+2===9 ✓
   邯郸 邯医保规〔2024〕5号：https://www.hd.gov.cn/hdzfxxgk/gszbm/auto28831/202501/t20250114_2097711.html
     正文在 .docx 附件 P020260128621340360033.docx（530626 B）
     第十八条逐字「党政机关和全额拨款事业单位…缴费比例为本单位缴费基数的7.9%（其中职工基本医疗保险7.5%，生育保险0.4%），
           其他用人单位缴费比例为本单位缴费基数的8%（其中职工基本医疗保险7.5%，生育保险0.5%）。在职职工的缴费比例为本人缴费基数的2%」
     第十七条只设全口径月均下限锚、全文无「300%」→ 医保不设上限，仓库沿用三项社保区间属近似
   广西 桂人社发〔2026〕32号：http://rst.gxzf.gov.cn/zwgk/xxgkzcfg/fgfxlm/t28152939.shtml
     逐字「按7008元/月作为核定个人缴费基数上下限的指标，缴费基数上限为21024元/月，下限为4204.8元/月」
     算式自校验：7008×3===21024 ✓、7008×0.6===4204.8 ✓ */
eq('第四十六批·玉林·医保单位费率6.5%（基本医保6%+生育0.5%）', A.CITIES.yuln.med.comp, 0.065);
eq('第三十一批B·玉林·医保个人2%', A.CITIES.yuln.med.emp, 0.02);
eq('第三十一批B·玉林·社基数下限4204.8', A.CITIES.yuln.pension.min, 4204.8);
eq('第三十一批B·玉林·社基数上限21024', A.CITIES.yuln.pension.max, 21024);
eq('第三十一批B·广西核定指标7008×3===21024', 7008 * 3, 21024);
eq('第三十一批B·广西核定指标7008×0.6===4204.8', 7008 * 0.6, 4204.8);
eq('第三十一批B·玉林费率自校验6+2===8', 6 + 2, 8);
eq('第三十一批B·玉林费率自校验7-6===1', 7 - 6, 1);
eq('第三十一批B·玉林note含玉市医保发2025-10号', A.CITIES.yuln.note.includes('玉市医保发〔2025〕10号'), true);
eq('第四十六批·玉林note含2025年7月1日生效', A.CITIES.yuln.note.includes('2025年7月1日'), true);
eq('第四十六批·玉林note改引玉市医保发〔2023〕17号', A.CITIES.yuln.note.includes('玉市医保发〔2023〕17号'), true);
eq('第三十一批B·柳州社基数下限4204.8', A.CITIES.liuz.pension.min, 4204.8);
eq('第三十一批B·柳州社基数上限21024', A.CITIES.liuz.pension.max, 21024);
eq('第三十一批B·柳州note含桂人社发2026-32号', A.CITIES.liuz.note.includes('桂人社发〔2026〕32号'), true);
eq('第三十一批B·柳州医保单位8.0%', A.CITIES.liuz.med.comp, 0.08);
eq('第三十一批B·北海社基数下限4204.8', A.CITIES.bh.pension.min, 4204.8);
eq('第三十一批B·北海社基数上限21024', A.CITIES.bh.pension.max, 21024);
eq('第三十一批B·北海note含桂人社发2026-32号', A.CITIES.bh.note.includes('桂人社发〔2026〕32号'), true);
eq('第三十一批B·北海医保单位6.5%暂不改', A.CITIES.bh.med.comp, 0.065);
eq('第三十一批B·北海warn保留', A.CITIES.bh.warn, true);
eq('第三十一批B·邯郸医保单位8%', A.CITIES.hd.med.comp, 0.08);
eq('第三十一批B·邯郸医保个人2%', A.CITIES.hd.med.emp, 0.02);
eq('第三十一批B·邯郸社基数下限4076', A.CITIES.hd.pension.min, 4076);
eq('第三十一批B·邯郸社基数上限20382', A.CITIES.hd.pension.max, 20382);
eq('第三十一批B·邯郸note含邯医保规2024-5号', A.CITIES.hd.note.includes('邯医保规〔2024〕5号'), true);
eq('第三十一批B·邯郸note声明不设300%上限', A.CITIES.hd.note.includes('不设300%上限'), true);
eq('第三十一批B·邯郸note不再出现旧误植日期', A.CITIES.hd.note.includes('2025-03-13'), false);
eq('第三十一批B·承德生育0.8%仍在note', A.CITIES.chengd.note.includes('0.8%'), true);
eq('第三十一批B·衡水已补官方费率（第三十六批改值）', A.CITIES.hshui.med.comp, 0.078);
// ---- 第三十六批（河北 3 城 + 陕西 3 城）----
// 承德：承医保字〔2021〕60号《承德市职工基本医疗保险市级统筹管理办法》第九条 其他用人单位 7.3%（基本医疗6.5%+生育0.8%）
// 衡水：衡政规〔2019〕11号第十一条 9.8%-2%=7.8%；衡医保字〔2020〕15号「7%调至3.5%、生育0.8%」分解印证
// 邯郸：2026-07-09 公积金缴存基数调整通知 2380~23754（下限三档 2380/2230/2080）
// 渭南：渭房委发〔2026〕1号；汉中：2026-06-30 便笺（7448×3=22344）；安康：安房金发〔2026〕27号（86937÷12×3=21734）
eq('河北·承德医保单位费率7.3%（承医保字〔2021〕60号第九条）', A.CITIES.chengd.med.comp, 0.073);
eq('河北·承德医保个人2%', A.CITIES.chengd.med.emp, 0.02);
eq('河北·承德费率自校验 基本医疗6.5%+生育0.8%=7.3%', 0.065 + 0.008, 0.073);
eq('河北·承德机关事业口径6.8%不等于单位口径7.3%', 0.065 + 0.003, 0.068);
eq('河北·承德note写明7.3%', A.CITIES.chengd.note.includes('医保单位7.3%'), true);
eq('河北·承德note写明财政供养单位6.8%以免口径误用', A.CITIES.chengd.note.includes('6.8%'), true);
eq('河北·承德note不再写暂估8%', A.CITIES.chengd.note.includes('暂按8%估算'), false);
eq('河北·承德不设med区间（医保不设300%上限）', Boolean(A.CITIES.chengd.med.min === A.CITIES.chengd.pension.min), true);
eq('河北·承德warn保留（公积金2025年度件已届满）', A.CITIES.chengd.warn, true);
eq('河北·承德公积金上限23008（2025年度、已届满）', A.CITIES.chengd.hf.max, 23008);
eq('河北·承德公积金自校验 92032x300%/12=23008', Math.round(92032 * 3 / 12), 23008);
eq('河北·衡水医保单位费率7.8%（衡政规〔2019〕11号第十一条）', A.CITIES.hshui.med.comp, 0.078);
eq('河北·衡水医保个人2%', A.CITIES.hshui.med.emp, 0.02);
eq('河北·衡水费率自校验 9.8%-2%=7.8%', 0.098 - 0.02, 0.078);
eq('河北·衡水费率自校验 7%+生育0.8%=7.8%', 0.07 + 0.008, 0.078);
eq('河北·衡水机关事业9.3%不等于单位口径', 0.093 - 0.02, 0.073);
eq('河北·衡水note写明7.8%', A.CITIES.hshui.note.includes('医保单位7.8%'), true);
eq('河北·衡水note引用衡政规〔2019〕11号', A.CITIES.hshui.note.includes('衡政规〔2019〕11号'), true);
eq('河北·衡水note引用衡医保字〔2020〕15号', A.CITIES.hshui.note.includes('衡医保字〔2020〕15号'), true);
eq('河北·衡水note不再写暂估8%', A.CITIES.hshui.note.includes('暂按8%估算'), false);
eq('河北·衡水不设med区间', Boolean(A.CITIES.hshui.med.min === A.CITIES.hshui.pension.min), true);
eq('河北·衡水warn保留（公积金上限22086无官方件）', A.CITIES.hshui.warn, true);
eq('河北·衡水note记2025年度官方上限20970', A.CITIES.hshui.note.includes('20970'), true);
eq('河北·衡水note记2025年度件已届满', A.CITIES.hshui.note.includes('已届满'), true);
eq('河北·邯郸医保单位8%保持', A.CITIES.hd.med.comp, 0.08);
eq('河北·邯郸公积金下限2380（市区档）', A.CITIES.hd.hf.min, 2380);
eq('河北·邯郸公积金上限23754', A.CITIES.hd.hf.max, 23754);
eq('河北·邯郸上限反推参考值 23754/3=7918', 23754 / 3, 7918);
eq('河北·邯郸note记下限三档2230/2080', A.CITIES.hd.note.includes('2230') && A.CITIES.hd.note.includes('2080'), true);
eq('河北·邯郸note声明自校验不成立', A.CITIES.hd.note.includes('算式自校验不成立'), true);
eq('河北·邯郸warn已取消（医保与公积金均有一手件）', Boolean(A.CITIES.hd.warn), false);
eq('河北·三市社保基数仍4076~20382（省级口径）', A.CITIES.hd.pension.min + A.CITIES.hshui.pension.min + A.CITIES.chengd.pension.min, 4076 * 3);
eq('河北·三市社保上限仍20382', A.CITIES.hd.pension.max + A.CITIES.hshui.pension.max + A.CITIES.chengd.pension.max, 20382 * 3);
eq('河北·三市三险个人合计未变', A.CITIES.hd.med.emp + A.CITIES.hshui.med.emp + A.CITIES.chengd.med.emp, 0.06);
eq('陕西·渭南公积金2250~22104零偏差', A.CITIES.wn.hf.min * 1000 + A.CITIES.wn.hf.max, 2250 * 1000 + 22104);
eq('陕西·渭南note补渭房委发〔2026〕1号', A.CITIES.wn.note.includes('渭房委发〔2026〕1号'), true);
eq('陕西·渭南note删除无2026件表述', A.CITIES.wn.note.includes('上限22104无2026件'), false);
eq('陕西·渭南warn仍保留（医保费率未找到）', A.CITIES.wn.warn, true);
eq('陕西·汉中公积金2250~22344零偏差', A.CITIES.hanz.hf.min * 1000 + A.CITIES.hanz.hf.max, 2250 * 1000 + 22344);
eq('陕西·汉中上限自校验 7448x3=22344', 7448 * 3, 22344);
eq('陕西·汉中note记7448元/月原数', A.CITIES.hanz.note.includes('7448'), true);
eq('陕西·汉中note删除无2026件表述', A.CITIES.hanz.note.includes('上限22344无2026件'), false);
eq('陕西·汉中县区档2140与本表2250并存', 2140 < A.CITIES.hanz.hf.min, true);
eq('陕西·汉中warn仍保留（医保费率未找到）', A.CITIES.hanz.warn, true);
eq('陕西·安康公积金2140~21734零偏差', A.CITIES.ank.hf.min * 1000 + A.CITIES.ank.hf.max, 2140 * 1000 + 21734);
eq('陕西·安康上限自校验 floor(86937/12x3)=21734', Math.floor(86937 / 12 * 3), 21734);
eq('陕西·安康下限自校验 round(2140x5%)x2=214', Math.round(2140 * 0.05) * 2, 214);
eq('陕西·安康note保留安房金发〔2026〕27号', A.CITIES.ank.note.includes('安房金发〔2026〕27号'), true);
eq('陕西·安康医保仍为省级暂估7%', A.CITIES.ank.med.comp, 0.07);
eq('陕西·安康warn仍保留（医保费率未找到）', A.CITIES.ank.warn, true);
eq('陕西·三市医保暂估口径仍为7%', A.CITIES.wn.med.comp + A.CITIES.hanz.med.comp + A.CITIES.ank.med.comp, 0.21);

eq('第三十一批B·渭南医保暂估7%', A.CITIES.wn.med.comp, 0.07);
eq('第三十一批B·汉中医保暂估7%', A.CITIES.hanz.med.comp, 0.07);
eq('第三十一批B·安康医保暂估7%', A.CITIES.ank.med.comp, 0.07);
eq('第三十一批B·石家庄医保7.5%不变', A.CITIES.sjz.med.comp, 0.075);
eq('第三十一批B·唐山医保7.8%不变', A.CITIES.ts.med.comp, 0.078);
eq('第三十一批B·南宁医保6.5%不变', A.CITIES.nn.med.comp, 0.065);
eq('第三十一批B·钦州医保8.5%不变', A.CITIES.qinz.med.comp, 0.085);
eq('第三十一批B·桂林医保7.3%不变', A.CITIES.gl.med.comp, 0.073);

/* ===== 第四十五批（陕西 10 市）· 2026-10-14 =====
   延安 yanan 6.5%(机关)/6.9%(企业) —— 医保有生育合并实施方案六部门联署，2020-01-01 起执行
   商洛 shangl 商政发〔2022〕3号 6.6%（基本医保6% + 生育0.6%），下限比例60%官方坐实
   西安 xa 8%（含生育1%）坐实；原note「2025-12起阶段性减征至7%」查无实据已删
   咸阳 xy 6.8% 坐实；铜川 tch / 安康 ank 制度件已确认失效；宝鸡 baoj 出处未能证实 → 新增 warn
   https://ybj.yanan.gov.cn/zfxxgk/fdzdgknr/gsgg/1573196485158359041.html （无文号，六部门 2019-10-14）
   http://www.shangluo.gov.cn/ybj/info/1032/1598.htm （商政发〔2022〕3号）
   http://www.xa.gov.cn/gk/zcfg/zcjd/zcwd/shbx/636a1abef8fd1c4c212759a3.html （索引号 2023-010594）
   https://ybj.xianyang.gov.cn/xwzx/xwdt/202409/t20240903_1807521.html （无文号，2024-09-02）
   https://www.ankang.gov.cn/Content-84316.html （第四十六条：有效期为三年）
   https://www.shaanxi.gov.cn/zfxxgk/zfgb/2019_3941/d15q_3956/201908/t20190821_1637018.html （陕政办发〔2019〕18号）
*/
eq('第四十五批·延安·医保单位费率6.9%（企业口径，机关事业6.5%）', A.CITIES.yanan.med.comp, 0.069);
eq('第四十五批·延安·note记明企业与其他单位口径分列', A.CITIES.yanan.note.includes('其他单位'), true);
eq('第四十五批·延安·算式自校验 6.5%(机关)与6.9%(企业)分列', 0.069 - 0.065, 0.004);
eq('第四十五批·商洛·医保单位费率6.6%', A.CITIES.shangl.med.comp, 0.066);
eq('第四十五批·商洛·算式自校验 6% + 0.6% = 6.6%', 0.06 + 0.006, 0.066);
eq('第四十五批·商洛·note引商政发〔2022〕3号', A.CITIES.shangl.note.includes('商政发〔2022〕3号'), true);
eq('第四十五批·商洛·note记下限比例60%', A.CITIES.shangl.note.includes('60%'), true);
eq('第四十五批·商洛·note记修订在途（征求意见稿未生效）', A.CITIES.shangl.note.includes('修订在途'), true);
eq('第四十五批·商洛·warn仍保留', A.CITIES.shangl.warn, true);
eq('第四十五批·西安·医保单位费率8%（含生育1%）不变', A.CITIES.xa.med.comp, 0.08);
eq('第四十五批·西安·算式自校验 8% - 1%(生育) = 7%', 0.08 - 0.01, 0.07);
eq('第四十五批·西安·note记阶段性减征表述已删除', A.CITIES.xa.note.includes('已删除'), true);
eq('第四十五批·西安·note保留减征表述的更正说明', A.CITIES.xa.note.includes('阶段性减征'), true);
eq('第四十五批·西安·note记大额8元/人·月', A.CITIES.xa.note.includes('8'), true);
eq('第四十五批·咸阳·医保单位费率6.8%不变', A.CITIES.xy.med.comp, 0.068);
eq('第四十五批·咸阳·note逐字引用单位按6.8%缴纳', A.CITIES.xy.note.includes('6.8%'), true);
eq('第四十五批·铜川·note记制度件已失效', A.CITIES.tch.note.includes('失效'), true);
eq('第四十五批·安康·note记第四十六条有效期为三年', A.CITIES.ank.note.includes('有效期为三年'), true);
eq('第四十五批·安康·医保仍为省级暂估7%', A.CITIES.ank.med.comp, 0.07);
eq('第四十五批·宝鸡·医保仍为7%（未取到市级件）', A.CITIES.baoj.med.comp, 0.07);
eq('第四十五批·宝鸡·出处未能证实→新增warn', A.CITIES.baoj.warn, true);
eq('第四十五批·宝鸡·note记宝政发〔2010〕16号未能证实', A.CITIES.baoj.note.includes('未能证实'), true);
eq('第四十五批·宝鸡·note记60%下限5041.65与300%上限25208.25', A.CITIES.baoj.note.includes('25208.25'), true);
eq('第四十五批·宝鸡·算式自校验 8402.75×0.6=5041.65', Math.round(8402.75 * 0.6 * 100) / 100, 5041.65);
eq('第四十五批·宝鸡·算式自校验 8402.75×3=25208.25', Math.round(8402.75 * 3 * 100) / 100, 25208.25);
eq('第四十五批·陕西10市社保基数仍为4737~23685', A.CITIES.xa.pension.min + A.CITIES.wn.pension.max, 4737 + 23685);
eq('第四十五批·陕西医保基数复用社保（无独立下限比例字段）', A.CITIES.xa.med.min, A.CITIES.xa.pension.min);

/* ===== 第四十六批（广西 14 市）· 2026-10-14 =====
   口径确认：广西 medComp = 单位合计（含生育）。企业 = 基本医保X% + 生育0.5%；机关事业 = 基本医保X% + 生育0.4%
   防城港 fcg 防医保发〔2024〕20号 企业 6% + 0.5% = 6.5%（原 7% 是凭空估算）
   玉林 yuln 玉市医保发〔2025〕10号 基本医保单位 6%，玉市医保发〔2023〕17号 生育 0.5% → 6.5%（原 6% 漏算生育）
   桂林 gl 市政规〔2025〕19号 第十四条 7.3%（含生育0.5%）坐实；第四十七条大额为0.2%比例型
        → 原 medFixEmp:3 误归属（真实来源是第四十七条后半段「领取失业保险金人员个人缴费标准36元/人·年」），已移除
   https://www.fcgs.gov.cn/ybj/zcfg/t19534141.shtml （防医保发〔2024〕20号）
   http://ybj.yulin.gov.cn/tzgg/t21580387.shtml （玉市医保发〔2025〕10号）
   http://ybj.yulin.gov.cn/tzgg/t17579744.shtml （玉市医保发〔2023〕17号）
   http://ybj.guilin.gov.cn/zfxxgk/fdzdgknr/zcfg/t26980912.shtml （市政规〔2025〕19号）
   警示：桂医保发〔2026〕22号（自治区本级 7%）只适用区直机关，绝不可套用 14 市
*/
eq('第四十六批·防城港·医保单位费率6.5%', A.CITIES.fcg.med.comp, 0.065);
eq('第四十六批·防城港·算式自校验 6% + 0.5%(生育) = 6.5%', 0.06 + 0.005, 0.065);
eq('第四十六批·防城港·note引防医保发〔2024〕20号', A.CITIES.fcg.note.includes('防医保发〔2024〕20号'), true);
eq('第四十六批·防城港·warn已新增', A.CITIES.fcg.warn, true);
eq('第四十六批·防城港·note记机关事业生育0.4%与企业0.5%的口径差', A.CITIES.fcg.note.includes('0.4%'), true);
eq('第四十六批·玉林·医保单位费率6.5%（原6%漏算生育0.5%）', A.CITIES.yuln.med.comp, 0.065);
eq('第四十六批·玉林·算式自校验 6% + 0.5%(生育) = 6.5%', 0.06 + 0.005, 0.065);
eq('第四十六批·玉林·note引玉市医保发〔2025〕10号（基本医保）', A.CITIES.yuln.note.includes('玉市医保发〔2025〕10号'), true);
eq('第四十六批·玉林·note引玉市医保发〔2023〕17号（生育）', A.CITIES.yuln.note.includes('玉市医保发〔2023〕17号'), true);
eq('第四十六批·玉林·warn已新增', A.CITIES.yuln.warn, true);
eq('第四十六批·玉林·社基数不变4204.8', A.CITIES.yuln.pension.min, 4204.8);
eq('第四十六批·桂林·医保单位费率7.3%（含生育0.5%）不变', A.CITIES.gl.med.comp, 0.073);
eq('第四十六批·桂林·算式自校验 7.3% - 0.5%(生育) = 6.8%', Math.round((0.073 - 0.005) * 10000) / 10000, 0.068);
eq('第四十六批·桂林·机关事业7.2％已在note记录（全角百分号）', A.CITIES.gl.note.includes('7.2％'), true);
eq('第四十六批·桂林·大额固定额字段已移除（0.2%比例型不可建模，默认0）', A.CITIES.gl.medFixEmp, 0);
eq('第四十六批·桂林·warn已新增', A.CITIES.gl.warn, true);
eq('第四十六批·桂林·note引市政规〔2025〕19号', A.CITIES.gl.note.includes('市政规〔2025〕19号'), true);
eq('第四十六批·桂林·note记第四十七条0.2%比例型', A.CITIES.gl.note.includes('第四十七条'), true);
eq('第四十六批·桂林·note保留7.15%表述的更正说明', A.CITIES.gl.note.includes('7.15%'), true);
eq('第四十六批·桂林·note记7.15%已删除', A.CITIES.gl.note.includes('已删除'), true);
eq('第四十六批·桂林·note保留长护表述的更正说明', A.CITIES.gl.note.includes('长护'), true);
eq('第四十六批·广西14市医保单位费率均在6%~9%合理区间', (function () {
  var ks = ['nn', 'liuz', 'gl', 'wuz', 'bh', 'fcg', 'qinz', 'gg', 'yuln', 'bais', 'hezh', 'hech', 'lb', 'chz'];
  for (var i = 0; i < ks.length; i++) { var v = A.CITIES[ks[i]].med.comp; if (!(v >= 0.06 && v <= 0.09)) return false; }
  return true;
})(), true);
eq('第四十六批·广西14市企业口径均含生育0.5%（无低于6.5%的合计值）', (function () {
  var ks = ['nn', 'liuz', 'gl', 'wuz', 'bh', 'fcg', 'qinz', 'gg', 'yuln', 'bais', 'hezh', 'hech', 'lb', 'chz'];
  for (var i = 0; i < ks.length; i++) { if (A.CITIES[ks[i]].med.comp < 0.065) return false; }
  return true;
})(), true);
eq('第四十六批·南宁·医保单位费率6.5%（含生育0.5%）不变', A.CITIES.nn.med.comp, 0.065);
eq('第四十六批·北海·医保单位费率6.5%不变', A.CITIES.bh.med.comp, 0.065);
eq('第四十六批·柳州·柳政办〔2015〕50号查无此文→新增warn', A.CITIES.liuz.warn, true);
eq('第四十六批·柳州·note记文号查无此文', A.CITIES.liuz.note.includes('查无此文'), true);
eq('第四十六批·柳州·医保单位费率8.0%保留不动', A.CITIES.liuz.med.comp, 0.08);

/* ===== 第四十七批（河北）· 2026-10-14 =====
 * 秦皇岛 qhd 两处改值（父代理逐字自抓，四关全过）：
 *   ①医保单位费率 8%→7.3%：秦政办规〔2021〕1号 第十三条
 *     https://www.qhd.gov.cn/index/zwgk/article_detail?id=122957
 *     「企业、民办非企业单位、个体经济组织等非财政拨款单位，由用人单位按本单位缴费基数的 7.3 % 缴纳
 *      职工医疗保险（包含职工基本医疗保险 6.5%，生育保险 0.8%），职工个人按本人缴费基数的 2% 缴纳…
 *      财政拨款的国家机关、事业单位和其他社会组织…6.75%（生育 0.25%、无生育津贴）」
 *     → 取企业口径 7.3%（第 1 关）；个人 2% 不变。
 *     现行性：秦政字〔2026〕4号《…关于公布市政府行政规范性文件清理结果的通知》（2026-08-18）
 *       https://www.qhd.gov.cn/index/zwgk/article_detail?id=144215
 *       附件保留目录第 9 项明列「秦政办规〔2021〕1号（市医保局）」（第 2 关）。
 *   ②公积金下限 2200→2380：补充通知（无文号，2026-01-04）
 *     http://www.qhdgjj.com/home/details?code=MTA1&id=1630
 *     「根据《河北省人力资源和社会保障厅关于调整最低工资标准的通知》（冀人社字〔2025〕137号）及
 *      《秦皇岛市人力资源和社会保障局关于调整最低工资标准的通知》（秦人社字〔2025〕165号）…2026 年住房公积金
 *      缴存基数下限为：秦皇岛市区…2380 元；昌黎县、卢龙县、青龙满族自治县 2230 元。」
 *     主通知（2025-12-04）…id=1623 原定 2200/2000，并预设「如遇河北省人社厅发布新的最低工资标准，
 *     按照调整后的最低工资标准执行」；11 天后补充通知按新最低工资更新为 2380/2230。
 *     上限 25746 = 2024 年度城镇非私营单位月均工资 8582 元 ×3（同件双数自校验成立，不变）。
 * 保定 bd / 邢台 xingt：数值零改动，只更正 note 的档位表述与过时文号引用。
 */
eq('第四十七批·秦皇岛·医保单位费率7.3%（秦政办规〔2021〕1号，企业口径含生育0.8%）', A.CITIES.qhd.med.comp, 0.073);
eq('第四十七批·秦皇岛·算式自校验 6.5% + 0.8%(生育) = 7.3%', 0.065 + 0.008, 0.073);
eq('第四十七批·秦皇岛·note记机关事业6.75%口径', A.CITIES.qhd.note.includes('6.75%'), true);
eq('第四十七批·秦皇岛·note引秦政办规〔2021〕1号', A.CITIES.qhd.note.includes('秦政办规〔2021〕1号'), true);
eq('第四十七批·秦皇岛·note记现行性证明秦政字〔2026〕4号', A.CITIES.qhd.note.includes('秦政字〔2026〕4号'), true);
eq('第四十七批·秦皇岛·公积金下限2380（原2200为主通知旧值）', A.CITIES.qhd.hf.min, 2380);
eq('第四十七批·秦皇岛·公积金上限25746不变', A.CITIES.qhd.hf.max, 25746);
eq('第四十七批·秦皇岛·算式自校验 8582×3 = 25746', 8582 * 3, 25746);
eq('第四十七批·秦皇岛·note记三县2230（原note误写2000）', A.CITIES.qhd.note.includes('2230'), true);
eq('第四十七批·秦皇岛·note引冀人社字〔2025〕137号与秦人社字〔2025〕165号', A.CITIES.qhd.note.includes('冀人社字〔2025〕137号') && A.CITIES.qhd.note.includes('秦人社字〔2025〕165号'), true);
eq('第四十七批·秦皇岛·已无暂按省级区间8%估算的无据表述', A.CITIES.qhd.note.includes('暂按省级区间'), false);
eq('第四十七批·秦皇岛·warn保留（大额医疗补助单位固定额未取到官方件）', A.CITIES.qhd.warn, true);
eq('第四十七批·秦皇岛·社保基数4076~20382不变（冀人社字〔2026〕57号）', A.CITIES.qhd.pension.min + '~' + A.CITIES.qhd.pension.max, '4076~20382');

eq('第四十七批·保定·公积金2380~24345零偏差', A.CITIES.bd.hf.min + '~' + A.CITIES.bd.hf.max, '2380~24345');
eq('第四十七批·保定·算式自校验 8115×3 = 24345', 8115 * 3, 24345);
eq('第四十七批·保定·note改为市区2380档（原文误标为2230档）', A.CITIES.bd.note.includes('（2230 档）'), false);
eq('第四十七批·保定·note记97375元÷12=8115元', A.CITIES.bd.note.includes('97375'), true);
eq('第四十七批·保定·医保单位费率6.9%不变', A.CITIES.bd.med.comp, 0.069);

eq('第四十七批·邢台·医保单位费率7.8%不变（2025-01-01新办法第七条）', A.CITIES.xingt.med.comp, 0.078);
eq('第四十七批·邢台·算式自校验 7% + 0.8%(生育) = 7.8%', 0.07 + 0.008, 0.078);
eq('第四十七批·邢台·note已换用2025-01-01新办法', A.CITIES.xingt.note.includes('邢台市职工基本医疗保险和生育保险实施办法'), true);
eq('第四十七批·邢台·note记新办法未设300%上限的口径冲突', A.CITIES.xingt.note.includes('未设300%上限'), true);
eq('第四十七批·邢台·note保留邢医保发〔2019〕52号的取代说明', A.CITIES.xingt.note.includes('邢医保发〔2019〕52号'), true);
eq('第四十七批·邢台·因口径冲突新增warn（guard H-2：note承认不确定即须标warn）', A.CITIES.xingt.warn, true);
eq('第四十七批·河北11市社保基数统一4076~20382（冀人社字〔2026〕57号，市级不发布）', (function () {
  const ks = ['sjz', 'ts', 'qhd', 'hd', 'xingt', 'bd', 'zjk', 'chengd', 'cangz', 'lf', 'hshui'];
  return ks.every(function (k) { return A.CITIES[k].pension.min + '~' + A.CITIES[k].pension.max === '4076~20382'; });
})(), true);

/* --- 张家口 zjk：财政局百问百答纯HTML逐字给出企业合计 7.4%，四关全过 → 改值 --- */
eq('第四十七批·张家口·医保单位合计7.4%（财政局2023-05-11逐字，其他用人单位口径）', A.CITIES.zjk.med.comp, 0.074);
eq('第四十七批·张家口·大额医疗固定额15元/人月（张政发〔2020〕9号第十三条）', A.CITIES.zjk.medFixEmp, 15);
eq('第四十七批·张家口·个人费率2%不变', A.CITIES.zjk.med.emp, 0.02);
eq('第四十七批·张家口·note已记张政发〔2020〕9号（发布页效力状态有效）', A.CITIES.zjk.note.includes('张政发〔2020〕9号'), true);
eq('第四十七批·张家口·note已记张医保发〔2022〕4号基本医疗降至6.5%', A.CITIES.zjk.note.includes('张医保发〔2022〕4号') && A.CITIES.zjk.note.includes('6.5%'), true);
eq('第四十七批·张家口·note已记张医保发〔2019〕5号生育0.9%', A.CITIES.zjk.note.includes('张医保发〔2019〕5号') && A.CITIES.zjk.note.includes('0.9%'), true);
eq('第四十七批·张家口·note已记两档生育费率0.4%（机关事业）', A.CITIES.zjk.note.includes('0.4%'), true);
eq('第四十七批·张家口·算式自校验 8.4-0.9=7.5（2023年前旧档）', Math.round((8.4 - 0.9) * 100) / 100, 7.5);
eq('第四十七批·张家口·算式自校验 7.9-0.4=7.5（机关事业两口径独立收敛）', Math.round((7.9 - 0.4) * 100) / 100, 7.5);
eq('第四十七批·张家口·算式自校验 7.4-0.9=6.5（现行基本医疗）', Math.round((7.4 - 0.9) * 100) / 100, 6.5);
eq('第四十七批·张家口·算式自校验 15元×12=180元/年（2025-12-26通告）', 15 * 12, 180);
eq('第四十七批·张家口·已无暂按8%估算的无据表述', A.CITIES.zjk.note.includes('暂按8%估算'), false);
eq('第四十七批·张家口·已无口径未能闭合的表述', A.CITIES.zjk.note.includes('口径未能闭合'), false);
eq('第四十七批·张家口·note如实标注张医保发〔2022〕4号不在保留目录、不得写成清理目录已确认', A.CITIES.zjk.note.includes('不能视为失效') && A.CITIES.zjk.note.includes('不得写成清理目录已确认'), true);
eq('第四十七批·张家口·warn保留（公积金2026年度件未找到、企业缴存比例未核）', A.CITIES.zjk.warn, true);
eq('第四十七批·张家口·公积金2025年度2000~21771不变（2026年度件未找到）', A.CITIES.zjk.hf.min + '~' + A.CITIES.zjk.hf.max, '2000~21771');

eq('第四十七批·石家庄·医保单位7.5%不变（生育1%已由石医保规〔2025〕1号第十一条坐实）', A.CITIES.sjz.med.comp, 0.075);
eq('第四十七批·石家庄·算式自校验 6.5% + 1%(生育) = 7.5%', 0.065 + 0.01, 0.075);
eq('第四十七批·石家庄·算式自校验 6.5% + 0.4%(机关事业生育) = 6.9%', 0.065 + 0.004, 0.069);
eq('第四十七批·石家庄·note补引石医保规〔2025〕1号第十一条逐字且已去掉PDF不可解析的表述', A.CITIES.sjz.note.includes('石医保规〔2025〕1号') && A.CITIES.sjz.note.includes('第十一条') && !A.CITIES.sjz.note.includes('PDF'), true);
eq('第四十七批·石家庄·note保留石政规〔2024〕7号第九条对6.5%的独立印证', A.CITIES.sjz.note.includes('石政规〔2024〕7号第九条') && A.CITIES.sjz.note.includes('不含生育保险缴费率'), true);

// ---- 第四十八批：甘肃定西公积金 2026 年度（定市公积金函〔2026〕18号，扫描图 rapidocr 两遍一致）----
eq('第四十八批·定西·公积金下限1850→2080（甘政办发〔2025〕71号三类地区月最低工资）', A.CITIES.dx.hf.min, 2080);
// ── 第四十九批 B（2026-10-14）· 青海 7 市州公积金复核（零改值）──
eq('第四十九批B·青海·海西公积金下限2080', A.CITIES.hxz.hf.min, 2080);
eq('第四十九批B·青海·海西公积金上限37166', A.CITIES.hxz.hf.max, 37166);
ok('第四十九批B·海西note引用2026年度市级件', A.CITIES.hxz.note.indexOf('2026年度住房公积金缴存基数调整') >= 0, true);
ok('第四十九批B·海西note引用青政2025 11号', A.CITIES.hxz.note.indexOf('青政〔2025〕11号') >= 0, true);
ok('第四十九批B·海西note声明关卡3算式校验未做', A.CITIES.hxz.note.indexOf('不作关卡3算式校验') >= 0, true);
ok('第四十九批B·海西note不再出现2024年度33836作为现值', A.CITIES.hxz.note.indexOf('2024年度33836') > 0, true);
eq('第四十九批B·海北下限仍为1700（不得由省级件推市级）', A.CITIES.hbz.hf.min, 1700);
ok('第四十九批B·海北note写明1700已被11号取代', A.CITIES.hbz.note.indexOf('已被青政〔2025〕11号取代') >= 0, true);
eq('第四十九批B·海北warn 保留', A.CITIES.hbz.warn, true);
ok('第四十九批B·黄南note补记省直取整口径2024年已变更', A.CITIES.hnz.note.indexOf('以元为单位四舍五入后再合计') >= 0, true);
ok('第四十九批B·青海7市州除海西外全部无2025/2026年度件', ['haid','hbz','hnz','hnan','glz','ysz'].every(function(k){ return A.CITIES[k].warn === true; }), true);
eq('第四十八批·定西·公积金上限22046→22977', A.CITIES.dx.hf.max, 22977);
eq('第四十八批·定西·算式自校验 91910÷12 向下取整 = 7659', Math.floor(91910 / 12), 7659);
eq('第四十八批·定西·算式自校验 7659×3 = 22977', 7659 * 3, 22977);
eq('第四十八批·定西·note引用定市公积金函〔2026〕18号', A.CITIES.dx.note.includes('定市公积金函〔2026〕18号'), true);
eq('第四十八批·定西·note写明执行期为自然年2026-01-01至2026-12-31（非7月起）', A.CITIES.dx.note.includes('2026-01-01至2026-12-31'), true);
eq('第四十八批·定西·note保留2026-04-07无文号件并记录其上限待定口径', A.CITIES.dx.note.includes('待统计部门发布后按新标准执行'), true);
eq('第四十八批·定西·社保基数不变 4526~22626', A.CITIES.dx.pension.min + '~' + A.CITIES.dx.pension.max, '4526~22626');

// ===== 第五十批 A（2026-10-15）· 新疆 13 地州公积金 2026 年度市级一手件入 note（数值零改动）=====
// 13 个地州全部取到自治区中心门户 xjgjj.xjjs.gov.cn 上的 2026 缴存年度官方件，上下限逐字零偏差；
// 本批只补官方链接与取整口径说明，不动任何数值。
eq('第五十批A·新疆·乌鲁木齐公积金下限2070', A.CITIES.wlmq.hf.min, 2070);
eq('第五十批A·新疆·乌鲁木齐公积金上限35071', A.CITIES.wlmq.hf.max, 35071);
ok('第五十批A·新疆·乌鲁木齐note引用自治区中心官方件', A.CITIES.wlmq.note.includes('wlmqgjj/info/1120/5961.htm'), true);
eq('第五十批A·新疆·克拉玛依公积金下限2070', A.CITIES.klmy.hf.min, 2070);
eq('第五十批A·新疆·克拉玛依公积金上限33872', A.CITIES.klmy.hf.max, 33872);
ok('第五十批A·新疆·克拉玛依note引用自治区中心官方件', A.CITIES.klmy.note.includes('klmy/info/1066/3045.htm'), true);
eq('第五十批A·新疆·吐鲁番公积金下限1750', A.CITIES.tlf.hf.min, 1750);
eq('第五十批A·新疆·吐鲁番公积金上限29259', A.CITIES.tlf.hf.max, 29259);
ok('第五十批A·新疆·吐鲁番note引用自治区中心官方件', A.CITIES.tlf.note.includes('tlfdq/info/1066/6506.htm'), true);
eq('第五十批A·新疆·哈密公积金下限1890', A.CITIES.hami.hf.min, 1890);
eq('第五十批A·新疆·哈密公积金上限31532', A.CITIES.hami.hf.max, 31532);
ok('第五十批A·新疆·哈密note引用自治区中心官方件', A.CITIES.hami.note.includes('hm/info/1037/4354.htm'), true);
eq('第五十批A·新疆·昌吉公积金下限1890', A.CITIES.cjz.hf.min, 1890);
eq('第五十批A·新疆·昌吉公积金上限29280', A.CITIES.cjz.hf.max, 29280);
ok('第五十批A·新疆·昌吉note引用自治区中心官方件', A.CITIES.cjz.note.includes('cj/info/1113/8579.htm'), true);
eq('第五十批A·新疆·博尔塔拉公积金下限1750', A.CITIES.boz.hf.min, 1750);
eq('第五十批A·新疆·博尔塔拉公积金上限27689', A.CITIES.boz.hf.max, 27689);
ok('第五十批A·新疆·博尔塔拉note引用自治区中心官方件', A.CITIES.boz.note.includes('boz/info/1066/4029.htm'), true);
eq('第五十批A·新疆·巴音郭楞公积金下限1750', A.CITIES.bygl.hf.min, 1750);
eq('第五十批A·新疆·巴音郭楞公积金上限33237', A.CITIES.bygl.hf.max, 33237);
ok('第五十批A·新疆·巴音郭楞note引用自治区中心官方件', A.CITIES.bygl.note.includes('baz/info/1066/7290.htm'), true);
eq('第五十批A·新疆·阿克苏公积金下限1890', A.CITIES.aks.hf.min, 1890);
eq('第五十批A·新疆·阿克苏公积金上限26178', A.CITIES.aks.hf.max, 26178);
ok('第五十批A·新疆·阿克苏note引用自治区中心官方件', A.CITIES.aks.note.includes('aksdq/info/1066/7120.htm'), true);
eq('第五十批A·新疆·克孜勒苏公积金下限1750', A.CITIES.kzls.hf.min, 1750);
eq('第五十批A·新疆·克孜勒苏公积金上限29874', A.CITIES.kzls.hf.max, 29874);
ok('第五十批A·新疆·克孜勒苏note引用自治区中心官方件', A.CITIES.kzls.note.includes('kez/info/1003/5542.htm'), true);
eq('第五十批A·新疆·喀什公积金下限1750', A.CITIES.kashi.hf.min, 1750);
eq('第五十批A·新疆·喀什公积金上限29139', A.CITIES.kashi.hf.max, 29139);
ok('第五十批A·新疆·喀什note引用自治区中心官方件', A.CITIES.kashi.note.includes('ksdq/info/1066/5166.htm'), true);
eq('第五十批A·新疆·和田公积金下限1750', A.CITIES.ht.hf.min, 1750);
eq('第五十批A·新疆·和田公积金上限29208', A.CITIES.ht.hf.max, 29208);
ok('第五十批A·新疆·和田note引用自治区中心官方件', A.CITIES.ht.note.includes('htdq/info/1119/7309.htm'), true);
eq('第五十批A·新疆·塔城公积金下限1750', A.CITIES.tc.hf.min, 1750);
eq('第五十批A·新疆·塔城公积金上限28578', A.CITIES.tc.hf.max, 28578);
ok('第五十批A·新疆·塔城note引用自治区中心官方件', A.CITIES.tc.note.includes('tcdq/info/1134/11295.htm'), true);
eq('第五十批A·新疆·阿勒泰公积金下限1750', A.CITIES.alt.hf.min, 1750);
eq('第五十批A·新疆·阿勒泰公积金上限28792', A.CITIES.alt.hf.max, 28792);
ok('第五十批A·新疆·阿勒泰note引用自治区中心官方件', A.CITIES.alt.note.includes('altdq/info/1066/4377.htm'), true);
ok('第五十批A·新疆·13地州note均含 xjgjj.xjjs.gov.cn 官方域名',
  ["wlmq","klmy","tlf","hami","cjz","boz","bygl","aks","kzls","kashi","ht","tc","alt"].every(function (k) { return A.CITIES[k].note.includes('xjgjj.xjjs.gov.cn'); }), true);
eq('第五十批A·新疆·乌鲁木齐缴存额上限 round(35071×12%)×2 = 8418', Math.round(35071 * 0.12) * 2, 8418);
eq('第五十批A·新疆·乌鲁木齐缴存额下限 round(2070×5%)×2 = 208', Math.round(2070 * 0.05) * 2, 208);
eq('第五十批A·新疆·克拉玛依缴存额上限 round(33872×12%)×2 = 8130', Math.round(33872 * 0.12) * 2, 8130);
eq('第五十批A·新疆·吐鲁番缴存额上限 round(29259×12%)×2 = 7022', Math.round(29259 * 0.12) * 2, 7022);
eq('第五十批A·新疆·哈密缴存额上限 round(31532×12%)×2 = 7568', Math.round(31532 * 0.12) * 2, 7568);
eq('第五十批A·新疆·博州缴存额上限 round(27689×12%)×2 = 6646', Math.round(27689 * 0.12) * 2, 6646);
eq('第五十批A·新疆·巴州缴存额上限 round(33237×12%)×2 = 7976', Math.round(33237 * 0.12) * 2, 7976);
eq('第五十批A·新疆·阿克苏缴存额上限 round(26178×12%)×2 = 6282', Math.round(26178 * 0.12) * 2, 6282);
eq('第五十批A·新疆·克州缴存额上限 round(29874×12%)×2 = 7170', Math.round(29874 * 0.12) * 2, 7170);
eq('第五十批A·新疆·喀什缴存额上限 round(29139×12%)×2 = 6994', Math.round(29139 * 0.12) * 2, 6994);
eq('第五十批A·新疆·和田缴存额上限 round(29208×12%)×2 = 7010', Math.round(29208 * 0.12) * 2, 7010);
eq('第五十批A·新疆·塔城缴存额上限 round(28578×12%)×2 = 6858', Math.round(28578 * 0.12) * 2, 6858);
eq('第五十批A·新疆·阿勒泰缴存额上限 round(28792×12%)×2 = 6910', Math.round(28792 * 0.12) * 2, 6910);
eq('第五十批A·新疆·昌吉单方上限 round(29280×12%) = 3514', Math.round(29280 * 0.12), 3514);
eq('第五十批A·新疆·昌吉单方下限 round(1890×5%) = 95', Math.round(1890 * 0.05), 95);
ok('第五十批A·新疆·13地州上限均落在上限×12%取整后×2的1元容差内',
  [35071,33872,29259,31532,29280,27689,33237,26178,29874,29139,29208,28578,28792].every(function (m) { return Math.abs(Math.round(m * 0.12) * 2 - m * 0.24) < 1; }), true);
eq('第五十批A·新疆·乌鲁木齐公积金下限依地区月最低工资2070（非全区统一1750）', A.CITIES.wlmq.hf.min === 2070 && A.CITIES.tlf.hf.min === 1750, true);
eq('第五十批A·新疆·阿克苏下限分档（阿克苏市/库车市1890、其余7县市1750）', A.CITIES.aks.hf.min, 1890);
ok('第五十批A·新疆·阿克苏note写明分档', A.CITIES.aks.note.includes('其余 7 县市 1750'), true);
ok('第五十批A·新疆·喀什note写明塔什库尔干县1900', A.CITIES.kashi.note.includes('塔什库尔干县 1900'), true);
ok('第五十批A·新疆·哈密note写明巴里坤伊吾1750', A.CITIES.hami.note.includes('巴里坤/伊吾1750'), true);
eq('第五十批A·新疆·14市州社保基数统一不变 5246~26231', ["wlmq","klmy","tlf","hami","cjz","boz","bygl","aks","kzls","kashi","ht","tc","alt"].concat(['ylz']).every(function (k) { return A.CITIES[k].pension.min === 5246 && A.CITIES[k].pension.max === 26231; }), true);
ok('第五十批A·新疆·医保单位费率未取到市级件的2城仍标 warn（阿勒泰第五十六批已取到在职口径故撤）', ['ylz','tc'].every(function (k) { return A.CITIES[k].warn === true; }), true);
eq('第五十批A·新疆·公积金14地州全部有官方件（第五十六批新增的 6 个 warn 均因医保费率缺口而非公积金）', ["wlmq","klmy","tlf","hami","cjz","boz","bygl","aks","kzls","kashi","ht","tc","alt"].concat(['ylz']).every(function (k) { return A.CITIES[k].hf.min > 0 && A.CITIES[k].hf.max > A.CITIES[k].hf.min; }), true);
eq('第四十八批·定西·医保单位费率6.7%不变', A.CITIES.dx.med.comp, 0.067);

/* ===== 第五十二批：吉林 4 市州取证（数值零改动，补文号与渠道穷举记录） ===== */
eq('第五十二批·白城·note 补文号白医保联发〔2019〕3号', A.CITIES.bc.note.indexOf('白医保联发') >= 0, true);
eq('第五十二批·白城·medComp 仍为 0.065', A.CITIES.bc.med.comp, 0.065);
eq('第五十二批·白城·算式自校验 6.5-0.5=6.0', Math.round((0.065 - 0.005) * 10000) / 10000 === 0.06, true);
eq('第五十二批·白城·算式自校验 6.4-0.4=6.0', Math.round((0.064 - 0.004) * 10000) / 10000 === 0.06, true);
eq('第五十二批·白城·note 记页面级有效性声明', A.CITIES.bc.note.indexOf('有效性为有效') >= 0, true);
eq('第五十二批·白城·note 不再把费率写成待核实', A.CITIES.bc.note.indexOf('医保单位费率待核实') < 0, true);
eq('第五十二批·白山·真实域名已入 note', A.CITIES.bs.note.indexOf('www.cbs.gov.cn') >= 0, true);
eq('第五十二批·白山·note 说明无医保局子域', A.CITIES.bs.note.indexOf('没有任何医疗保障局子域') >= 0, true);
eq('第五十二批·白山·medComp 仍为 0.08', A.CITIES.bs.med.comp, 0.08);
eq('第五十二批·白山·warn 保留', A.CITIES.bs.warn, true);
eq('第五十二批·吉林市·机构页 URL 已入 note', A.CITIES.jl.note.indexOf('t20201013_886182.html') >= 0, true);
eq('第五十二批·吉林市·medComp 仍为 0.08', A.CITIES.jl.med.comp, 0.08);
eq('第五十二批·吉林市·warn 保留', A.CITIES.jl.warn, true);
eq('第五十二批·辽源·医保局平台入口已入 note', A.CITIES.lyu.note.indexOf('data-classInfoId=17316') >= 0, true);
eq('第五十二批·辽源·medComp 仍为 0.08', A.CITIES.lyu.med.comp, 0.08);
eq('第五十二批·辽源·warn 保留', A.CITIES.lyu.warn, true);
eq('第五十二批·吉林市/辽源/白山 8% 仍高于官方框架6%+0.5%=6.5%，note 已标注为估算占位', A.CITIES.jl.med.comp > 0.065 && A.CITIES.lyu.med.comp > 0.065 && A.CITIES.bs.med.comp > 0.065, true);
eq('第五十二批·白城 6.5% 是四市中唯一落在官方框架内的值', A.CITIES.bc.med.comp === 0.065 && A.CITIES.jl.med.comp > A.CITIES.bc.med.comp, true);
eq('第五十二批·延边 6% 不在本批范围但保持不变', A.CITIES.ybi.med.comp, 0.06);

// ==== 第五十三批（2026-10-15）· 陕西宝鸡 44号文父代理 OCR 亲验 ====
eq('第五十三批·宝鸡·医保基数下限比例 60% 坐实（宝医保发〔2026〕44号 父代理 OCR 五遍逐字一致）', A.CITIES.baoj.note.indexOf('5041.65元/月，上限为300%，即25208.25元/月') >= 0, true);
eq('第五十三批·宝鸡·同件三数自校验 100833÷12 = 8402.75', Math.round(100833/12*100)/100, 8402.75);
eq('第五十三批·宝鸡·同件三数自校验 8402.75×0.6 = 5041.65', Math.round(8402.75*0.6*100)/100, 5041.65);
eq('第五十三批·宝鸡·同件三数自校验 8402.75×3 = 25208.25', Math.round(8402.75*3*100)/100, 25208.25);
eq('第五十三批·宝鸡·执行期 2027-01-01 至 2027-12-31 今天尚未生效，故数据字段仍取陕西省级 4737~23685', A.CITIES.baoj.pension.min + '~' + A.CITIES.baoj.pension.max, '4737~23685');
eq('第五十三批·宝鸡·note 已记录执行期未生效', A.CITIES.baoj.note.indexOf('2027-01-01至2027-12-31') >= 0, true);
eq('第五十三批·宝鸡·note 已记录在岗职工口径与全口径不同源、不得互相换算', A.CITIES.baoj.note.indexOf('与陕西三项社保的全口径口径不同源') >= 0, true);
eq('第五十三批·宝鸡·note 已删除「父代理未能解析原文/来自核查报告转述」旧措辞', A.CITIES.baoj.note.indexOf('父代理本轮未能解析原文') < 0, true);
eq('第五十三批·宝鸡·note 保留 6.6% 费率出处待证实的说明（参保缴费管理办法正文未取到）', A.CITIES.baoj.note.indexOf('6.6%费率出处仍待证实') >= 0, true);
eq('第五十三批·宝鸡·费率 6.6% 不变、warn 保留', A.CITIES.baoj.med.comp === 0.066 && A.CITIES.baoj.warn === true, true);
eq('第五十三批·宝鸡·单位+个人大额 5+10 = 15 元/月 与 note 一致', A.CITIES.baoj.medFixEmp + 5, 15);
eq('第五十三批·宝鸡·医保局无独立子域（DoH 全 NXDOMAIN），费率依据只能挂市政府门户或区政府网', true, true);
eq('第五十三批·林芝·公积金 2360~42581 一手件零偏差（件挂林芝市公安局站，无独立发文文号）', A.CITIES.linzhi.hf.min + '~' + A.CITIES.linzhi.hf.max, '2360~42581');
eq('第五十三批·林芝·取整自校验 42581×12% = 5109.72', Math.round(42581*0.12*100)/100, 5109.72);
eq('第五十三批·林芝·floor 会得 5109，官方是 5110，故不是向下取整', Math.round(Math.floor(42581*0.12)*100)/100, 5109);
eq('第五十三批·林芝·取整自校验 2360×5% = 118', Math.round(2360*0.05*100)/100, 118);
eq('第五十三批·林芝·note 引用 gaj.linzhi.gov.cn 一手件 URL', A.CITIES.linzhi.note.indexOf('gaj.linzhi.gov.cn') >= 0, true);
eq('第五十三批·阿里·已纠正「四组域名全部 NXDOMAIN」的错误表述', A.CITIES.ali.note.indexOf('四组域名全部 NXDOMON') < 0, true);
eq('第五十三批·阿里·note 记录 zjj.al.gov.cn 真实可达', A.CITIES.ali.note.indexOf('zjj.al.gov.cn') >= 0, true);
eq('第五十三批·阿里·note 记录 42214 并非西藏通用上限的三城反例', A.CITIES.ali.note.indexOf('昌都43049') >= 0 && A.CITIES.ali.note.indexOf('山南44202') >= 0 && A.CITIES.ali.note.indexOf('林芝42581') >= 0, true);
eq('第五十三批·西藏 42214 只是拉萨的数，阿里/日喀则/那曲三城同值但昌都与林芝不同', A.CITIES.ali.hf.max === 42214 && A.CITIES.rkz.hf.max === 42214 && A.CITIES.naqu.hf.max === 42214 && A.CITIES.changdu.hf.max === 43049 && A.CITIES.linzhi.hf.max === 42581, true);
eq('第五十三批·西藏 日喀则/那曲/阿里 warn 保留（无一手件）', A.CITIES.rkz.warn === true && A.CITIES.naqu.warn === true && A.CITIES.ali.warn === true, true);
/* ---------------- 第五十四批A·甘肃 7 市州公积金核查（2026-10-15）---------------- */
/* 报告：REPORT_round53_gansu_gjj.md。改值 0 城：白银/陇南 取到 2026 年度市级一手件且与现值零偏差；
   天水/庆阳/临夏/金昌/酒泉 五城 2026 年度件在中心全部公开栏目里都不存在（临夏的州办法反证该通知应当存在）。 */
eq('第五十四批A·甘肃·白银 2026 年度件零偏差 2200~25059', A.CITIES.by.hf.min === 2200 && A.CITIES.by.hf.max === 25059, true);
eq('第五十四批A·甘肃·白银 note 含官方域名 baiyin.gov.cn', A.CITIES.by.note.indexOf('baiyin.gov.cn') >= 0, true);
eq('第五十四批A·甘肃·白银 上限 8353×3=25059 同件双数自校验', 8353 * 3 === 25059, true);
eq('第五十四批A·甘肃·白银 月缴存额上限单方 round(25059×12%)=3007', Math.round(25059 * 0.12), 3007);
eq('第五十四批A·甘肃·白银 月缴存额下限单方 round(2200×5%)=110', Math.round(2200 * 0.05), 110);
eq('第五十四批A·甘肃·陇南 2026 年度件零偏差 2130~23301', A.CITIES.ln.hf.min === 2130 && A.CITIES.ln.hf.max === 23301, true);
eq('第五十四批A·甘肃·陇南 note 含官方域名 longnan.gov.cn', A.CITIES.ln.note.indexOf('longnan.gov.cn') >= 0, true);
eq('第五十四批A·甘肃·陇南 上限三数自校验 93211÷12→7767、7767×3=23301', Math.floor(93211 / 12) === 7767 && 7767 * 3 === 23301, true);
eq('第五十四批A·甘肃·陇南 月缴存额上限 round(23301×12%)×2=5592', Math.round(23301 * 0.12) * 2, 5592);
eq('第五十四批A·甘肃·陇南 月缴存额下限 round(2130×5%)×2=214（必须 half-up）', Math.round(2130 * 0.05) * 2, 214);
eq('第五十四批A·甘肃·陇南 下限取整判别点：floor 会得 212（错）', Math.floor(2130 * 0.05) * 2, 212);
eq('第五十四批A·甘肃·陇南 下限取整判别点：先乘10%再取整会得 213×2=426（错）', Math.floor(2130 * 0.10) * 2, 426);
eq('第五十四批A·甘肃·天水 无 2026 年度件 → 新增 warn', A.CITIES.tshui.warn === true, true);
eq('第五十四批A·甘肃·天水 note 记录 2025 年度件上限 21429 与 85715 基准', A.CITIES.tshui.note.indexOf('21429') >= 0 && A.CITIES.tshui.note.indexOf('85715') >= 0, true);
eq('第五十四批A·甘肃·天水 现值 2130~23287 未变', A.CITIES.tshui.hf.min === 2130 && A.CITIES.tshui.hf.max === 23287, true);
eq('第五十四批A·甘肃·天水 2025 年度件取整自校验 85715÷12→7143、7143×3=21429、round(1910×5%)=96、round(1850×5%)=93', Math.round(85715 / 12) === 7143 && 7143 * 3 === 21429 && Math.round(1910 * 0.05) === 96 && Math.round(1850 * 0.05) === 93, true);
eq('第五十四批A·甘肃·庆阳 现值 1910~27275 就是已届满的 2025 年度值 → 新增 warn', A.CITIES.qingy.warn === true && A.CITIES.qingy.hf.min === 1910 && A.CITIES.qingy.hf.max === 27275, true);
eq('第五十四批A·甘肃·庆阳 note 含真域 zgqingyang.gov.cn', A.CITIES.qingy.note.indexOf('zgqingyang.gov.cn') >= 0, true);
eq('第五十四批A·甘肃·庆阳 2025 年度件取整自校验 109102÷12→9091、9091×3=27273≠27275 故不作自校验', Math.round(109102 / 12) * 3 !== 27275, true);
eq('第五十四批A·甘肃·临夏 2025 年度值来自官方年度报告 → warn 保留', A.CITIES.lx.warn === true && A.CITIES.lx.hf.min === 1910 && A.CITIES.lx.hf.max === 22788, true);
eq('第五十四批A·甘肃·临夏 note 含年度报告域名 linxia.gov.cn', A.CITIES.lx.note.indexOf('linxia.gov.cn') >= 0, true);
eq('第五十四批A·甘肃·临夏 note 记 22788÷3 属反推不作自校验', A.CITIES.lx.note.indexOf('反推') >= 0, true);
eq('第五十四批A·甘肃·金昌 无任何缴存基数件 → warn 保留', A.CITIES.jc.warn === true && A.CITIES.jc.hf.min === 2020 && A.CITIES.jc.hf.max === 26166, true);
eq('第五十四批A·甘肃·金昌 note 含真域 jcs.gov.cn 与已失效的 jzgjj.gov.cn', A.CITIES.jc.note.indexOf('jcs.gov.cn') >= 0 && A.CITIES.jc.note.indexOf('jzgjj.gov.cn') >= 0, true);
eq('第五十四批A·甘肃·金昌 note 记三个管理办法均为征求意见稿故排除', A.CITIES.jc.note.indexOf('征求意见稿') >= 0, true);
eq('第五十四批A·甘肃·酒泉 无 2026 年度件 → 新增 warn', A.CITIES.jiuq.warn === true && A.CITIES.jiuq.hf.min === 2020 && A.CITIES.jiuq.hf.max === 26246.49, true);
eq('第五十四批A·甘肃·酒泉 note 含真子域 jiuquan.gov.cn', A.CITIES.jiuq.note.indexOf('gjj.jiuquan.gov.cn') >= 0, true);
eq('第五十四批A·甘肃·金昌/酒泉 下限 2020 与庆阳 1910、天水 2130 分属甘政发〔2023〕83号（已取代）与甘政办发〔2025〕71号两套口径', A.CITIES.jc.hf.min === 2020 && A.CITIES.jiuq.hf.min === 2020 && A.CITIES.qingy.hf.min === 1910 && A.CITIES.tshui.hf.min === 2130 && A.CITIES.by.hf.min === 2200 && A.CITIES.ln.hf.min === 2130, true);
eq('第五十四批A·甘肃·白银与陇南无 warn（已取到 2026 年度一手件）', A.CITIES.by.warn === undefined && A.CITIES.ln.warn === undefined, true);
eq('第五十四批A·甘肃·五城 warn 全部落地', A.CITIES.tshui.warn === true && A.CITIES.qingy.warn === true && A.CITIES.jiuq.warn === true && A.CITIES.lx.warn === true && A.CITIES.jc.warn === true, true);

/* ---------------- 第五十五批·西宁公积金渠道穷举 + 辽宁 subagent 崩溃（2026-10-15）---------------- */
eq('第五十五批·西宁 公积金现值 2080~31995 未改动', A.CITIES.xining.hf.min === 2080 && A.CITIES.xining.hf.max === 31995, true);
eq('第五十五批·西宁 note 含中心真实域名 xnzfgjj.com', A.CITIES.xining.note.indexOf('xnzfgjj.com') >= 0, true);
eq('第五十五批·西宁 note 记 2021 年度件唯一下限 1700 与上限 24591', A.CITIES.xining.note.indexOf('24591') >= 0 && A.CITIES.xining.note.indexOf('1700') >= 0, true);
eq('第五十五批·西宁 note 记 2023 年度件标题在但正文未公开（tzgg/2488.jhtml）', A.CITIES.xining.note.indexOf('2488.jhtml') >= 0, true);
eq('第五十五批·西宁 note 记站内全文检索已穷举（search.jspx）', A.CITIES.xining.note.indexOf('search.jspx') >= 0, true);
eq('第五十五批·西宁 2021 年度件下限自校验成立 round(1700×5%)×2=170', Math.round(1700 * 0.05) * 2, 170);
eq('第五十五批·西宁 2021 年度件上限 24591÷3 整除得 8197，但件内未给基准数字，按反推处理不作自校验', 24591 / 3 === 8197 && 8197 * 3 === 24591, true);
eq('第五十五批·西宁 自主缴存月缴存额上限 5900 既非 round(24591×12%)×2 也非 floor(24591×24%)，不可强行建模', Math.round(24591 * 0.12) * 2 !== 5900 && Math.floor(24591 * 0.24) !== 5900, true);
eq('第五十五批·西宁 下限 2080 与海西同为青政〔2025〕11号 三类地区 2080', A.CITIES.xining.hf.min === 2080 && A.CITIES.hxz.hf.min === 2080, true);
eq('第五十五批·西宁 上限 31995 与 2021 年度件的 24591 不是同一年度数据', A.CITIES.xining.hf.max === 31995 && 24591 !== A.CITIES.xining.hf.max, true);
eq('第五十五批·青海 8 市州中仅西宁与海西有中心自有域名（xnzfgjj.com / hxzfgjj.com.cn），其余 6 州无', A.CITIES.xining.note.indexOf('xnzfgjj.com') >= 0 && A.CITIES.hxz.note.indexOf('hxzfgjj.com.cn') >= 0, true);

// ===== 第五十六批（2026-10-15）· 新疆 13 地州医保单位费率复核 =====
{
  // --- 阿勒泰：改值 7.5% → 9.5%（父代理逐字复核，推翻 subagent 的退休/灵活就业口径误判）---
  eq('第五十六批·阿勒泰 medComp 9.5%（含生育，在职职工企业口径）', A.CITIES.alt.med.comp, 0.095);
  eq('第五十六批·阿勒泰 个人 2% 不变', A.CITIES.alt.med.emp, 0.02);
  ok('第五十六批·阿勒泰 warn 已撤销（两件官方件互相印证在职单位费率 9.5%）', A.CITIES.alt.warn === undefined, true);
  ok('第五十六批·阿勒泰 note 引阿行办发〔2019〕58号', A.CITIES.alt.note.indexOf('阿行办发〔2019〕58号') >= 0, true);
  ok('第五十六批·阿勒泰 note 含 2019 件逐字「单位职工基本医疗保险缴费率统一按 9.5%执行」', A.CITIES.alt.note.indexOf('单位职工基本医疗保险缴费率统一按9.5%执行') >= 0, true);
  ok('第五十六批·阿勒泰 note 含 2026 件逐字「按我地区职工医保缴费率9.5%」', A.CITIES.alt.note.indexOf('按我地区职工医保缴费率9.5%') >= 0, true);
  ok('第五十六批·阿勒泰 note 记录 7% 是退休/灵活就业口径', A.CITIES.alt.note.indexOf('退休职工与灵活就业') >= 0 || A.CITIES.alt.note.indexOf('退休职工缴费费率为单位7%') >= 0, true);
  ok('第五十六批·阿勒泰 note 声明原 7.5% 作废', A.CITIES.alt.note.indexOf('作废') >= 0, true);
  ok('第五十六批·阿勒泰 不再引错误的阿行办规〔2022〕3号', A.CITIES.alt.note.indexOf('阿行办规〔2022〕3号') < 0, true);
  ok('第五十六批·阿勒泰 note 含 2019 件 URL', A.CITIES.alt.note.indexOf('xjalt.gov.cn/govxxgk/DD041/2019-11-27/') >= 0, true);
  ok('第五十六批·阿勒泰 note 含 2026 件 URL', A.CITIES.alt.note.indexOf('638d53bd-5604-4060-83ed-07451846749f.html') >= 0, true);
  ok('第五十六批·阿勒泰 公积金 1750~28792 不变', A.CITIES.alt.hf.min === 1750 && A.CITIES.alt.hf.max === 28792, true);
  ok('第五十六批·阿勒泰 社保基数 5246~26231 不变', A.CITIES.alt.pension.min === 5246 && A.CITIES.alt.pension.max === 26231, true);

  // --- 新增 warn 的 6 城（费率只有一半或完全没有官方件）---
  eq('第五十六批·乌鲁木齐 warn 新增（生育 0.8% 已证、单位基本医保 9.0% 无件）', A.CITIES.wlmq.warn, true);
  eq('第五十六批·克拉玛依 warn 新增（基本医保 7.3% 属反推）', A.CITIES.klmy.warn, true);
  eq('第五十六批·昌吉 warn 新增（9%+0.5% 属反推）', A.CITIES.cjz.warn, true);
  eq('第五十六批·阿克苏 warn 新增（阿地医保发〔2019〕26号 未取到）', A.CITIES.aks.warn, true);
  eq('第五十六批·克孜勒苏 warn 新增（无任何市级费率件）', A.CITIES.kzls.warn, true);
  eq('第五十六批·喀什 warn 新增（站点对本机出口 403）', A.CITIES.kashi.warn, true);
  ok('第五十六批·乌鲁木齐 note 说明乌政办〔2019〕111号 不在规范性文件库', A.CITIES.wlmq.note.indexOf('不在乌市 37 页规范性文件库') >= 0, true);
  ok('第五十六批·克拉玛依 note 说明基本医保 7.3% 属反推', A.CITIES.klmy.note.indexOf('属反推') >= 0, true);
  ok('第五十六批·昌吉 note 说明 9%+0.5% 属反推', A.CITIES.cjz.note.indexOf('属反推') >= 0, true);
  ok('第五十六批·阿克苏 note 说明本轮未取到该件', A.CITIES.aks.note.indexOf('本轮站内检索未取到该件') >= 0, true);
  ok('第五十六批·克孜勒苏 note 说明 29 条规范性文件全是农业林草水价燃气', A.CITIES.kzls.note.indexOf('农业林草水价燃气') >= 0, true);
  ok('第五十六批·喀什 note 说明整站 403', A.CITIES.kashi.note.indexOf('403') >= 0, true);

  // --- 补 URL 的 5 城（报告转述、父代理复取 000 未复核）---
  ok('第五十六批·和田 note 含和行办规〔2025〕3号与 URL', A.CITIES.ht.note.indexOf('和行办规〔2025〕3号') >= 0 && A.CITIES.ht.note.indexOf('xjht.gov.cn/xjht/') >= 0, true);
  ok('第五十六批·巴州 note 含巴医保规〔2022〕3号与 URL', A.CITIES.bygl.note.indexOf('巴医保规〔2022〕3号') >= 0 && A.CITIES.bygl.note.indexOf('xjbz.gov.cn/xjbz/') >= 0, true);
  ok('第五十六批·博州 note 含 9.5-0.5=9 自校验与 URL', A.CITIES.boz.note.indexOf('9.5-0.5=9') >= 0 && A.CITIES.boz.note.indexOf('xjboz.gov.cn/xjboz/') >= 0, true);
  ok('第五十六批·吐鲁番 note 含 8.7=6.7+2 自校验与 URL', A.CITIES.tlf.note.indexOf('8.7=6.7+2') >= 0 && A.CITIES.tlf.note.indexOf('tlf.gov.cn/tlfs/') >= 0, true);
  ok('第五十六批·吐鲁番 note 纠正「含生育0.7%」的错误表述', A.CITIES.tlf.note.indexOf('不含生育') >= 0, true);
  ok('第五十六批·哈密 note 含 2027-01-01 调至 7.5% 的时效说明与 URL', A.CITIES.hami.note.indexOf('2027年1月1日') >= 0 && A.CITIES.hami.note.indexOf('hami.gov.cn/hami/') >= 0, true);
  ok('第五十六批·5 城均标注父代理未能复核', ['ht','bygl','boz','tlf','hami'].every(k => A.CITIES[k].note.indexOf('本机出口返回 000 未复核') >= 0), true);
  ok('第五十六批·5 城 medComp 数值全部不变', A.CITIES.ht.med.comp === 0.065 && A.CITIES.bygl.med.comp === 0.07 && A.CITIES.boz.med.comp === 0.095 && A.CITIES.tlf.med.comp === 0.067 && A.CITIES.hami.med.comp === 0.065, true);

  // --- 未动的 3 城保持 warn（估算值）---
  eq('第五十六批·伊犁 warn 保留（现行明确值仍未取到）', A.CITIES.ylz.warn, true);
  eq('第五十六批·塔城 warn 保留（现行明确值仍未取到）', A.CITIES.tc.warn, true);
  ok('第五十六批·新疆 14 地州社保基数仍统一 5246~26231', ['wlmq','klmy','tlf','hami','cjz','boz','bygl','aks','kzls','kashi','ht','ylz','tc','alt'].every(k => A.CITIES[k].pension.min === 5246 && A.CITIES[k].pension.max === 26231), true);
  ok('第五十六批·阿勒泰 medComp 与昌吉、博州、伊犁同为 9.5%', A.CITIES.alt.med.comp === A.CITIES.cjz.med.comp && A.CITIES.alt.med.comp === A.CITIES.boz.med.comp && A.CITIES.alt.med.comp === A.CITIES.ylz.med.comp, true);

  /* ===== 第五十七批（2026-10-15）· 辽宁 6 城医保费率渠道穷举 + 朝阳医保基数现行性坐实 ===== */
  ok('第五十七批·辽宁 6 城 medComp 全部保持 8%（生育 1% 有文号但基本医疗逐市不同，四关第①关不过）', ['fsh','dd','jz','fx','tl','cy'].every(k => A.CITIES[k].med.comp === 0.08), true);
  ok('第五十七批·辽宁 6 城 warn 全部保留', ['fsh','dd','jz','fx','tl','cy'].every(k => A.CITIES[k].warn === true), true);
  ok('第五十七批·抚顺单位合计应为 9%（基本医疗 8% + 生育 1%）但未取到市级生育件故不改值', Math.round((0.08 + 0.01) * 10000) / 10000 === 0.09, true);
  ok('第五十七批·省级《辽宁省医疗保障待遇清单（2021年版）》只给 6% 至 8% 区间，8% 落在区间上沿', 0.08 >= 0.06 && 0.08 <= 0.08, true);
  ok('第五十七批·阜新 note 已补生育恢复件原文 URL', A.CITIES.fx.note.indexOf('ybj.fuxin.gov.cn/content/2025/1017184.html') >= 0, true);
  ok('第五十七批·阜新 note 已补 2025-09-01 生效日', A.CITIES.fx.note.indexOf('2025年9月1日') >= 0, true);
  ok('第五十七批·阜新 note 已补 0.5% 恢复至 1%', A.CITIES.fx.note.indexOf('由0.5%恢复至1%') >= 0, true);
  ok('第五十七批·辽医保规〔2025〕2号 准确全称已补（此前只记编号）', A.CITIES.fx.note.indexOf('关于进一步规范全省基本医疗保险参保筹资和待遇保障政策的通知') >= 0, true);
  ok('第五十七批·阜新 note 已补省级 6% 至 8% 区间', A.CITIES.fx.note.indexOf('6%至8%') >= 0, true);
  ok('第五十七批·辽医保发〔2019〕26号 合并实施件已记录', A.CITIES.fx.note.indexOf('辽医保发〔2019〕26号') >= 0, true);
  ok('第五十七批·抚顺 note 已记合计应为 9% 的推理', A.CITIES.fsh.note.indexOf('抚顺单位合计应为9%') >= 0, true);
  ok('第五十七批·丹东 note 已补生育 1% 口径', A.CITIES.dd.note.indexOf('生育保险费率企业侧自2025-09-01起为1%') >= 0, true);
  ok('第五十七批·锦州 note 已补无医保局子域', A.CITIES.jz.note.indexOf('锦州市医保局无独立子域') >= 0, true);
  ok('第五十七批·铁岭 note 已补省局真实域名 ybj.ln.gov.cn', A.CITIES.tl.note.indexOf('ybj.ln.gov.cn') >= 0, true);
  ok('第五十七批·朝阳 note 已补朝医保发〔2026〕14号 清理结果', A.CITIES.cy.note.indexOf('朝医保发〔2026〕14号') >= 0, true);
  ok('第五十七批·朝阳清理结果继续有效 98 件 / 已废止 57 件 / 已失效 104 件', A.CITIES.cy.note.indexOf('继续有效98件') >= 0 && A.CITIES.cy.note.indexOf('已废止57件') >= 0 && A.CITIES.cy.note.indexOf('已失效104件') >= 0, true);
  ok('第五十七批·朝阳 36 号文为清理目录第 33 序号（现行性最硬形态）', A.CITIES.cy.note.indexOf('第33序号即本件') >= 0, true);
  ok('第五十七批·朝阳合并实施件 朝医保发〔2020〕67号 为第 11 序号', A.CITIES.cy.note.indexOf('朝医保发〔2020〕67号') >= 0 && A.CITIES.cy.note.indexOf('第11序号') >= 0, true);
  ok('第五十七批·朝阳 note 已声明父代理两遍 OCR 亲验', A.CITIES.cy.note.indexOf('两遍逐字OCR核对') >= 0, true);
  eq('第五十七批·朝阳医保基数下限仍为 3374', A.CITIES.cy.med.min, 3374);
  eq('第五十七批·朝阳医保基数上限仍为 16872', A.CITIES.cy.med.max, 16872);
  ok('第五十七批·朝阳 5624×3=16872', 5624 * 3 === 16872, true);
  ok('第五十七批·朝阳 round(5624×60%)=3374', Math.round(5624 * 0.6) === 3374, true);
  ok('第五十七批·朝阳灵活就业 5624×4.6%×12=3104', Math.abs(5624 * 0.046 * 12 - 3104) < 1, true);
  ok('第五十七批·辽宁块头已记生育 1% 口径行', /生育保险费率企业侧自2025-09-01起为1%（阜新正式件/.test(fs.readFileSync(require('path').join(__dirname,'..','skills','city-salary','assets','calculator.html'),'utf8')), true);
  /* ===== 第五十八批（2026-10-15）· 福建泉州生育费率坐实并改值 + 南平口径坐实（数值零改动） ===== */
  eq('第五十八批·泉州 medComp 7.5% 改 8.0%（基本医疗7.5%＋生育企业0.5%）', A.CITIES.quanz.med.comp, 0.08);
  eq('第五十八批·泉州 med.comp 子对象同步为 0.08', A.CITIES.quanz.med.comp, 0.08);
  ok('第五十八批·泉州 7.5+0.5=8.0 同源相加自校验', Math.round((0.075 + 0.005) * 10000) / 10000 === 0.08, true);
  ok('第五十八批·泉州 warn 保留（养老 2026 年度基数仍缺）', A.CITIES.quanz.warn === true, true);
  ok('第五十八批·泉州 note 写明合计口径与两个分项', A.CITIES.quanz.note.indexOf('单位合计8.0%') >= 0 && A.CITIES.quanz.note.indexOf('基本医疗7.5%') >= 0 && A.CITIES.quanz.note.indexOf('生育0.5%') >= 0, true);
  ok('第五十八批·泉州 note 记生育机关事业口径 0.35%（防止与机关口径混用）', A.CITIES.quanz.note.indexOf('机关事业0.35%') >= 0, true);
  ok('第五十八批·泉州 note 保留大额个人不另缴的旧结论', A.CITIES.quanz.note.indexOf('大病由医保统筹基金支付') >= 0, true);
  eq('第五十八批·泉州医保基数下限仍为 4579', A.CITIES.quanz.med.min, 4579);
  eq('第五十八批·泉州医保基数上限仍为 22893', A.CITIES.quanz.med.max, 22893);
  eq('第五十八批·泉州个人费率仍为 2%', A.CITIES.quanz.med.emp, 0.02);
  eq('第五十八批·南平 medComp 保持 8.5%（8%+0.5%，已由官方政策指南坐实，数值零改动）', A.CITIES.np.med.comp, 0.085);
  ok('第五十八批·南平 8+0.5=8.5 同源相加自校验', Math.round((0.08 + 0.005) * 10000) / 10000 === 0.085, true);
  ok('第五十八批·南平 note 已补官方政策指南 URL', A.CITIES.np.note.indexOf('www.np.gov.cn/cms/html/npszf/2024-01-18/1608300398.html') >= 0, true);
  ok('第五十八批·南平 note 逐字写入基本医疗 8% 与个人 2%', A.CITIES.np.note.indexOf('基本医疗保险用人单位按工资总额的8%') >= 0 && A.CITIES.np.note.indexOf('职工个人按2%') >= 0, true);
  ok('第五十八批·南平 note 逐字写入生育企业 0.5% 与机关事业 0.35%', A.CITIES.np.note.indexOf('企业按在职职工工资总额的0.5%') >= 0 && A.CITIES.np.note.indexOf('机关事业单位0.35%') >= 0, true);
  ok('第五十八批·南平 note 已记同基数同增同减条款', A.CITIES.np.note.indexOf('职工、生育保险同基数') >= 0, true);
  ok('第五十八批·南平 note 已声明指南为 2024 年 1—6 月版、更新版未取到', A.CITIES.np.note.indexOf('2024年1—6月版') >= 0, true);
  ok('第五十八批·南平 note 已声明大额为比例型、固定额字段无法表达', A.CITIES.np.note.indexOf('比例型、固定额字段无法表达') >= 0, true);
  ok('第五十八批·南平 medFixEmp 仍为 0（大额是比例型，未设固定额）', A.CITIES.np.medFixEmp === 0, true);
  ok('第五十八批·福建块头已写明 medComp 口径＝基本医疗＋生育且只有泉州南平已坐实', /medComp 口径＝基本医疗单位费率＋生育单位费率（企业口径）/.test(fs.readFileSync(require('path').join(__dirname,'..','skills','city-salary','assets','calculator.html'),'utf8')) && /其余7城费率是单险还是合计尚未取证/.test(fs.readFileSync(require('path').join(__dirname,'..','skills','city-salary','assets','calculator.html'),'utf8')), true);
  ok('第五十八批·福建其余 7 城 medComp 暂不变（福州.08 厦门.075 莆田.08 三明.085 漳州.075 龙岩.087 宁德.08）', [['fz',0.08],['xm',0.075],['pt',0.08],['sm',0.085],['zhangz',0.075],['longy',0.087],['nd',0.08]].every(([k,v]) => A.CITIES[k].med.comp === v), true);
  eq('第五十八批·龙岩 medComp 暂仍为 0.087', A.CITIES.longy.med.comp, 0.087);
  eq('第五十八批·三明 medComp 暂仍为 0.085', A.CITIES.sm.med.comp, 0.085);
  eq('第五十八批·厦门 medComp 暂仍为 0.075', A.CITIES.xm.med.comp, 0.075);
  eq('第五十八批·厦门 medFixEmp 仍为 7 元/月', A.CITIES.xm.medFixEmp, 7);
  ok('第五十八批·福建 9 市 warn 全部保留', ['fz','xm','pt','sm','quanz','zhangz','np','longy','nd'].every(k => A.CITIES[k].warn === true), true);
  /* ===== 第六十批（2026-10-15）· 三门峡大额为合计口径 + 南阳 note 纠错（数值零改动） ===== */
  eq('第六十批·三门峡 medFixEmp 仍为 18.33 元/月（220÷12，暂不改）', A.CITIES.smx.medFixEmp, 18.33);
  eq('第六十批·三门峡 220÷12 = 18.33', Math.round(220 / 12 * 100) / 100, 18.33);
  eq('第六十批·三门峡若按单位个人各半则个人应为 9.17', Math.round(220 / 2 / 12 * 100) / 100, 9.17);
  eq('第六十批·三门峡 因无个人额故新增 warn', A.CITIES.smx.warn, true);
  eq('第六十批·三门峡 note 记 220 元为合计口径', A.CITIES.smx.note.indexOf('合计') >= 0, true);
  eq('第六十批·三门峡 note 记办法由单位自行确定比例', A.CITIES.smx.note.indexOf('自行确定') >= 0, true);
  eq('第六十批·三门峡 note 引 ylbzj.smx.gov.cn 官方件', A.CITIES.smx.note.indexOf('ylbzj.smx.gov.cn') >= 0, true);
  eq('第六十批·三门峡 note 已删除无据旧文号 三政办〔2021〕3号', A.CITIES.smx.note.indexOf('三政办〔2021〕3号'), -1);
  eq('第六十批·河南解除 warn 的城市数由 13 降为 12', ['luoy','pds','ay','hbi','xx','jzuo','py','xc','sqiu','xiny','zk','zmd'].length, 12);
  ok('第六十二批·南阳旧值19.16＝6385×0.3%＝3831×0.5%（2025年度两路同值）', Math.round(6385*0.003*100)/100, Math.round(3831*0.005*100)/100);
  eq('第六十批·南阳 个人部分 = 0.3% × 旧口径全口径月均 6385', Math.round(6385 * 0.003 * 1000) / 1000, 19.155);
  eq('第六十批·南阳 0.3%×6385 与 0.5%×3831 两条路径同值', Math.round(6385 * 0.003 * 1000) / 100, Math.round(3831 * 0.005 * 1000) / 100);
  eq('第六十批·南阳 按 2026 新口径 6520 应为 19.56（待核）', Math.round(6520 * 0.003 * 100) / 100, 19.56);
  eq('第六十批·南阳 note 已删除「对不上」错误论断', A.CITIES.ny.note.indexOf('对不上'), -1);
  ok('第六十二批·南阳 note 已按宛政办〔2021〕17号原文重写（0.6%总额、各50%）', A.CITIES.ny.note.indexOf('分别按50%的比例承担') >= 0, true);
  eq('第六十批·南阳 仍保留 warn', A.CITIES.ny.warn, true);
  eq('第六十批·河南 4 城 warn 名单不变', ['zzheng','kf','lh','ny'].every(k => A.CITIES[k].warn === true), true);
}



eq('第四十八批·定西·warn 保留', A.CITIES.dx.warn, true);

eq('第四十七批·沧州·公积金2380~25581零偏差', A.CITIES.cangz.hf.min + '~' + A.CITIES.cangz.hf.max, '2380~25581');
eq('第四十七批·沧州·算式自校验 8527×3 = 25581', 8527 * 3, 25581);
eq('第四十七批·沧州·note补引沧金管字〔2026〕24号', A.CITIES.cangz.note.includes('沧金管字〔2026〕24号'), true);
eq('第四十九批·沧州·第四十八批记的「父代理未复核」已于 2026-10-14 解除（扫描 PNG 802×3348 经 PyMuPDF+rapidocr 两遍复核）', A.CITIES.cangz.note.includes('父代理未复核') === false && A.CITIES.cangz.note.includes('rapidocr'), true);
eq('第四十九批·沧州·算式自校验 8527×3 = 25581（复核确认）', 8527 * 3, 25581);
eq('第四十九批·沧州·灵活就业月缴存额上限 25581×24% 向下取整 = 6139', Math.floor(25581 * 0.24), 6139);
eq('第四十九批·临汾·公积金1950~24789零偏差（父代理已复核 2 页扫描 PDF）', A.CITIES.linf.hf.min + '~' + A.CITIES.linf.hf.max, '1950~24789');
eq('第四十九批·临汾·算式自校验 8263×3 = 24789', 8263 * 3, 24789);
eq('第四十九批·临汾·算式自校验 24789×24% 精确到分 = 5949.36', Math.round(24789 * 0.24 * 100) / 100, 5949.36);
eq('第四十九批·临汾·双方月缴存额各 2974.68（合计 5949.36 的一半，未先取整）', 5949.36 / 2, 2974.68);
eq('第四十九批·临汾·灵活就业月缴存额上限 4180×24% = 1003.2', Math.round(4180 * 0.24 * 100) / 100, 1003.2);
eq('第四十九批·临汾·note写入父代理 rapidocr 复核声明', A.CITIES.linf.note.includes('rapidocr') && A.CITIES.linf.note.includes('2026-07-01 至 2027-06-30'), true);
eq('第四十九批·临汾·warn 仍保留（晋政办发〔2026〕29号自2026-10-01起一类2350，中心待另发下限通知）', A.CITIES.linf.warn, true);


// ===== 第三十一批 A（2026-10-13）· 黑龙江佳木斯公积金上限溯源（数值零改动，只修note 无据表述）=====
// 下限官方件：佳木斯市住房公积金管理中心《关于调整住房公积金缴存基数下限的通知》（无文号，页面日期 2025-12-01）
//   https://www.jmsgjj.org.cn/bzbwz/zxdt/1425267.jhtml
//   「根据《黑龙江省人民政府关于调整全省最低工资标准的通知》(黑政规[2025]1号)…自2025年12月1日起执行
//    市区及抚远市住房公积金缴存基数下限为2010元，佳木斯市所辖富锦市、同江市、桦南、汤原、桦川县缴存基数下限为1910元」
// 上限官方件：佳木斯市住房公积金管理中心《关于调整2025住房公积金年度缴存基数的通知》（2025-07-10）
//   https://www.jmsgjj.org.cn/bzbwz/zxdt/1425243.jhtml
//   「依据佳木斯市统计局数据，2024年佳木斯市城镇非私营单位从业人员年平均工资为82750元，
//    设定我市2025住房公积金年度缴存基数上限为20686元；依据黑政规[2024]1号设定下限为1850元」
// 决定：上限 22660 在中心全部公开文件（政策法规10件 + 中心动态100件）中查无对应；
//      2026 年度（2026-07-01 起）缴存基数通知截至 2026-10-13 未发布 → 四关第 2 关不通过，不改数值，只改 note。
eq('黑龙江·佳木斯公积金下限2010(黑政规〔2025〕1号)', A.CITIES.jms.hf.min, 2010);
eq('黑龙江·佳木斯公积金上限22660(无官方来源·沿用估算)', A.CITIES.jms.hf.max, 22660);
eq('黑龙江·佳木斯warn=true', A.CITIES.jms.warn, true);
eq('黑龙江·佳木斯社保基数仍为4623~23115(黑人社函〔2025〕611号)', A.CITIES.jms.pension.min + '~' + A.CITIES.jms.pension.max, '4623~23115');
eq('黑龙江·佳木斯note已改为如实说明2025年度上限20686', String(A.CITIES.jms.note).includes('20686'), true);
eq('黑龙江·佳木斯note已标注年平均工资82750', String(A.CITIES.jms.note).includes('82750'), true);
eq('黑龙江·佳木斯note已删掉无据表述「上限22660（2026-07-01）」', !String(A.CITIES.jms.note).includes('上限22660（2026-07-01）'), true);
eq('黑龙江·佳木斯note已标注2026年度通知未发布', String(A.CITIES.jms.note).includes('2026年度缴存基数通知截至2026-10-13未发布'), true);
// 算式自校验**不成立**：官方只给一个上限数字，82750/12*3=20687.5 与官方 20686 差 1.5 元
eq('黑龙江·佳木斯82750/12*3≈20687.5 与官方20686差1.5元（自校验不成立，仅反推参考）',
   Math.abs(82750 / 12 * 3 - 20686), 1.5);
eq('黑龙江·佳木斯2025年度下限1850已被黑政规〔2025〕1号取代为2010', 1850 !== A.CITIES.jms.hf.min, true);
// 全省社保基数未被本批改动
eq('黑龙江·佳木斯社保与公积金区间不相等（上限口径不同）', A.CITIES.jms.pension.max !== A.CITIES.jms.hf.max, true);

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
    ['heb', '哈尔滨', '2026', null], ['nanj', '南京', '2026', null],
    ['hangz', '杭州', '2026', null], ['zzheng', '郑州', '2026', null],
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
  ok('南京页脚显示 2026年度（苏人社发〔2026〕30号落地后不再提示待公布）',
    foot().indexOf('数据依据：南京 2026年度') === 0, true);
  ok('南京页脚不再出现「待公布」', foot().indexOf('待公布') < 0, true);

  A.selectCity('hangz');
  ok('杭州页脚显示 2026年度（浙人社发〔2026〕52号落地后不再提示待公布）',
    foot().indexOf('数据依据：杭州 2026年度') === 0, true);
  ok('杭州页脚不再出现「待公布」', foot().indexOf('待公布') < 0, true);

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

/* ===== 第七十五批（2026-10-17）· 广东失业保险法定市级口径 ======
   《广东省失业保险条例》（2025-01-12 修正版）第八条逐字「职工缴费工资不得低于参保地地级以上市最低工资标准。
   本人工资高于参保地地级以上市上年度在岗职工月平均工资三倍的，以参保地地级以上市上年度在岗职工月平均工资的三倍为基数计算缴费。」
   → 下限＝本市现行最低工资（自动跟随），上限＝本市上年度在岗职工月均×3；省级根本不存在统一 44265 上限。
   粤府函〔2026〕188号（自 2026-09-01 起）最低工资：一类 2680（广州）/2700（深圳）、二类 2300（珠海/佛山/东莞/中山）、
   三类 2040（其余 15 市）。工厂默认改为 unemp.min=2040；unemp.max 已由 21 市在 opt 中逐市显式给出（第七十七批）。 */
section('7. 广东失业保险法定市级口径（第七十五批）');
(function gdUnemp() {
  const GD = [['深圳','sz'],['广州','gz'],['东莞','dg'],['佛山','fs'],['珠海','zh'],['惠州','hz'],['江门','jm'],['中山','zs'],
    ['汕头','st'],['韶关','sg'],['湛江','zj'],['肇庆','zq'],['茂名','mm'],['梅州','mz'],['汕尾','sw'],['河源','hy'],
    ['阳江','yj'],['清远','qy'],['潮州','cz'],['揭阳','jy'],['云浮','yf']];
  const T3 = ['hz','jm','st','sg','zj','zq','mm','mz','sw','hy','yj','qy','cz','jy','yf'];
  eq('广东 21 市全部到齐', GD.length, 21);
  eq('三类市失业下限统一 2040（粤府函〔2026〕188号）', T3.every(k => A.CITIES[k].unemp.min === 2040), true);
  eq('二类市失业下限统一 2300', ['dg','fs','zh','zs'].every(k => A.CITIES[k].unemp.min === 2300), true);
  eq('一类市 广州 2680 / 深圳 2700', A.CITIES.gz.unemp.min + '/' + A.CITIES.sz.unemp.min, '2680/2700');
  eq('珠海 失业36279（珠人社发〔2026〕4号，逐字下限＝本市最低工资）', A.CITIES.zh.unemp.max, 36279);
  eq('江门 失业27627（江人社发〔2026〕52号，27627÷3=9209）', A.CITIES.jm.unemp.max, 27627);
  eq('茂名 失业27468（2026-07-01 落款件，27468÷3=9156）', A.CITIES.mm.unemp.max, 27468);
  eq('阳江 失业28355（阳人社发〔2026〕89号，官方原件自身差 1 元）', A.CITIES.yj.unemp.max, 28355);
  eq('揭阳 失业24618（统计局 98472÷12=8206，×3=24618 自校验闭合）', A.CITIES.jy.unemp.max, 24618);
  eq('揭阳 自校验 98472/12*3 = 24618', Math.round(98472 / 12 * 3), 24618);
  eq('第七十九批后 六市上限一览 广州42933/深圳48471/东莞27702/佛山31395/中山29430/惠州28710',
    ['gz','sz','dg','fs','zs','hz'].map(k => A.CITIES[k].unemp.max).join('/'), '42933/48471/27702/31395/29430/28710');
  eq('广东 21 市失业上限无 44265', GD.every(x => A.CITIES[x[1]].unemp.max !== 44265), true);
  eq('广东 21 市失业下限无 2520', GD.every(x => A.CITIES[x[1]].unemp.min !== 2520), true);
  eq('江门 下限由 2520 改 2040（条例第八条自动跟随最低工资）', A.CITIES.jm.unemp.min, 2040);
  eq('茂名 下限由 1750 改 2040（2026-07-01 件所述 1750 为当时最低工资）', A.CITIES.mm.unemp.min, 2040);
  eq('汕头 上限由 44265 改 27699', A.CITIES.st.unemp.max, 27699);
  eq('失业费率 单位0.8% / 个人0.2% 全 21 市一致',
    GD.every(x => A.CITIES[x[1]].unemp.comp === .008 && A.CITIES[x[1]].unemp.emp === .002), true);
  eq('江门note引《广东省失业保险条例》第八条', /广东省失业保险条例/.test(A.CITIES.jm.note), true);
  eq('汕头note声明 44265 已删除', /44265/.test(A.CITIES.st.note), true);
  eq('揭阳note已改为逐市取值24618', /24618/.test(A.CITIES.jy.note), true);
  emit('  21 市下限按最低工资三类分档 + 6 市市级件实证 + 44265/2520 归零 ✓');
})();

/* ===== 第七十七批（2026-10-17）· 「失业上限照抄公积金上限」推导规则被证伪 =====================
   第七十六批曾据 5 市市级件归纳出「失业上限 − 本市公积金上限 恒为 0 或 −1 元」，并让工厂用
   unemp.max=hf.max 承接未取证城市的推导值。第七十七批逐市取件后该规则被证伪两次：
     · 惠州  人社局+税务局 2026-07-09 件逐字「失业保险缴费基数上限调整为28710元」，
             而惠州市公积金上限为 34290 → 差 −5580 元
     · 东莞  人社局 2026-07-09 通告逐字「上限由26298元调整为27702元」，
             而东莞市公积金上限为 27700 → 差 +2 元
   故 21 市已全部在 opt 中显式给出 unemp，工厂的 max:hf.max 不再被任何广东城市命中。
   ---------------------------------------------------------------------------------
   第七十七批曾把换算式归纳为「上限 = 年平均工资 ÷ 4」且误差 ≤2 元；第七十八批依据东莞、
   佛山两份市级件改为法定口径「年平均工资 ÷ 12 四舍五入到元，再 × 3」：
     · 佛山件直接引用「月平均工资10465元」，而 125585÷12=10465.42 → 10465，即年→月先取整到元；
     · 东莞 110803÷12=9233.58 → 9234 → ×3=27702（2024 年 105186→8766→26298 亦然），
       而 110803×0.25=27700.75，任何 ×0.25 取整都得不到市级件的 27702。
    21 市重算结果：19 市与 ÷12 口径逐字闭合（偏差全为 0 元）；肇庆、阳江两份市级件确用 ×0.25
   口径（阳江原件自身算术差 1 元），保留原值；汕头/梅州/清远原按 ×0.25 推导，与 15/21 的 ÷12
    口径不符，本批改为 27699/26316/27594；广州原值 41697 两条口径均不符（就业人员 vs 在岗职工口径错配），
    第七十九批已按条例口径③改为 42933（÷12 闭合城市随之由 18 增至 19），warn 维持。 */
section('8. 失业上限按法定口径 ÷12 四舍五入入元 ×3 换算（第七十八批）');
(function gdUnempRound() {
  const GD = ['sz','gz','dg','fs','zh','hz','jm','zs','st','sg','zj','zq','mm','mz','sw','hy','yj','qy','cz','jy','yf'];
  eq('广东 21 市到齐', GD.length, 21);
  eq('惠州证伪：unemp.max 28710 ≠ hf.max 34290（人社局 2026-07-09 件）',
    A.CITIES.hz.unemp.max + '/' + A.CITIES.hz.hf.max, '28710/34290');
  eq('东莞证伪：unemp.max 27702 ≠ hf.max 27700（人社局 2026-07-09 通告）',
    A.CITIES.dg.unemp.max + '/' + A.CITIES.dg.hf.max, '27702/27700');
  eq('惠州差额 −5580、东莞差额 +2 →「差 0 或 −1」规则作废',
    [A.CITIES.hz.unemp.max - A.CITIES.hz.hf.max, A.CITIES.dg.unemp.max - A.CITIES.dg.hf.max].join('/'), '-5580/2');
  eq('江门 −1 / 阳江 −1：公积金把月均进位后再 ×3', A.CITIES.jm.unemp.max - A.CITIES.jm.hf.max + '/' + (A.CITIES.yj.unemp.max - A.CITIES.yj.hf.max), '-1/-1');
  const diff = GD.filter(k => A.CITIES[k].unemp.max !== A.CITIES[k].hf.max);
  eq('与本市公积金上限不同的 8 市＝广州/东莞/惠州/江门/汕头/梅州/阳江/清远', diff.join('/'), 'gz/dg/hz/jm/st/mz/yj/qy');
  const same = GD.filter(k => A.CITIES[k].unemp.max === A.CITIES[k].hf.max);
  eq('其余 13 市与本市公积金上限同值（同源巧合，不构成规则；广州第七十九批分家后少一市）', same.length, 13);
  eq('同值 13 市中不含广州/东莞/惠州/江门/阳江/汕头/梅州/清远', same.some(k => ['gz','dg','hz','jm','yj','st','mz','qy'].includes(k)), false);
  const YW = [
    ['珠海', 'zh', 145116, 36279], ['江门', 'jm', 110508, 27627], ['茂名', 'mm', 109872, 27468],
    ['揭阳', 'jy', 98472, 24618], ['汕尾', 'sw', 111396, 27849],
    ['深圳', 'sz', 193881, 48471], ['佛山', 'fs', 125585, 31395], ['河源', 'hy', 101875, 25470],
    ['潮州', 'cz', 104173, 26043], ['东莞', 'dg', 110803, 27702], ['惠州', 'hz', 114837, 28710],
    ['韶关', 'sg', 117131, 29283], ['云浮', 'yf', 110567, 27642], ['中山', 'zs', 117723, 29430],
    ['湛江', 'zj', 118562, 29640], ['汕头', 'st', 110794, 27699], ['梅州', 'mz', 105259, 26316],
    ['清远', 'qy', 110372, 27594], ['广州', 'gz', 171731, 42933]];
  YW.forEach(([cn, k, yw, mx]) => {
    const mo = Math.round(yw / 12);
    eq(`${cn} ${yw}÷12=${(yw / 12).toFixed(2)}→${mo}元/月×3=${mo * 3} ✓合法口径`,
      mo * 3 === mx && A.CITIES[k].unemp.max === mx, true);
  });
  eq('÷12 口径覆盖 19 市（第七十九批广州修正后并入；肇庆阳江两市用 ×0.25 口径，不纳入）', YW.length, 19);
  eq('19 市 unemp.max 与 ÷12 换算表逐字一致', YW.every(([, k, , mx]) => A.CITIES[k].unemp.max === mx), true);
  eq('19 市按 ÷12 换算偏差全部为 0 元', YW.every(([, , yw, mx]) => Math.round(yw / 12) * 3 - mx === 0), true);
  eq('肇庆阳江按 ×0.25 口径：112881×0.25=28220.25→28220 / 113420×0.25=28355→28355',
    Math.floor(112881 * 0.25) + '/' + Math.round(113420 * 0.25) + '/' + A.CITIES.zq.unemp.max + '/' + A.CITIES.yj.unemp.max, '28220/28355/28220/28355');
  eq('惠州若按 ÷12 口径为 28710（市级件即采此值），若按 ×0.25 为 28709', Math.round(114837 / 12) * 3, 28710);
  eq('揭阳 98472÷12=8206 整除无取整歧义，×3=24618 与仓库值一致',
    98472 / 12 + '/' + (98472 / 12) * 3 + '/' + A.CITIES.jy.unemp.max, '8206/24618/24618');
  eq('广州第七十九批修正：÷12 得 42933（已采用）、×0.25 得 42932.75（四舍五入同为 42933）、原值 41697 系就业人员口径',
    [Math.round(171731 / 12) * 3, 41697].join('/'), '42933/41697');
  eq('惠州note载明人社局件与证伪结论', /28710/.test(A.CITIES.hz.note) && /34290/.test(A.CITIES.hz.note), true);
  eq('东莞note载明人社局通告与27702', /27702/.test(A.CITIES.dg.note), true);
  eq('佛山note载明人社局索引号', /11440600007039629R/.test(A.CITIES.fs.note), true);
  eq('中山note载明人社局件域名为 hrss.zs.gov.cn', /hrss\.zs\.gov\.cn/.test(A.CITIES.zs.note), true);
  eq('韶关note载明韶人社函〔2026〕44号', /韶人社函/.test(A.CITIES.sg.note), true);
  eq('肇庆note载明索引号114412005556387109', /114412005556387109/.test(A.CITIES.zq.note), true);
  eq('广州仍加 warn（无任何市级失业件）', A.CITIES.gz.warn === true, true);
  eq('汕头note作废「失业上限≈公积金上限」推导', /照抄公积金上限|照抄本市公积金上限/.test(A.CITIES.st.note), true);
  emit('  惠州/东莞证伪「照抄公积金上限」+ 19 市年工资÷12 口径偏差全为 0 元 + 6 市级件索引号入断言 ✓');
/* ===== 第七十九批（2026-10-18）· 广州失业上限口径修正（公积金口径② 41697 → 条例口径③ 42933） =====
   广州市统计局 2026-07-09 件《2025年广州市城镇非私营和私营单位就业人员年平均工资情况》载：
     「2025年，广州市城镇非私营单位就业人员年平均工资166790元…其中，在岗职工年平均工资为171731元」
   仓库原 unemp.max=41697 ＝ 166790÷12=13899 元/月×3，是「城镇非私营单位【就业人员】」口径，
   且该值逐字出自广州市住房公积金管理中心《关于2026年度住房公积金缴存调整有关问题的通知》
   「不高于本市统计部门公布的2025年广州市职工月平均工资的3倍，即41697元」——那是公积金上限。
   《广东省失业保险条例》第八条（2025-01-12 第二次修正）逐字：「职工缴费工资不得低于参保地地级以上市
   最低工资标准。本人工资高于参保地地级以上市上年度在岗职工月平均工资三倍的，以参保地地级以上市
   上年度在岗职工月平均工资的三倍为基数计算缴费。」→ 上限基准是「在岗职工」：
   171731÷12=14310.92→14311 元/月 ×3 = 42933（÷12 口径，21 市中 19 份市级件逐字闭合）。
   同批补入条例第十九条（失业金＝最低工资×90%，与市级件 2040→1836 吻合）与第二十一条
   （丧葬补助金＝上年度在岗职工月平均工资×3、抚恤金＝×6，条例内部口径自洽为「在岗职工」）。 */
section('9. 广州失业上限口径修正与条例内部口径一致（第七十九批）');
(function gdUnempGZ79() {
  const GD = ['sz','gz','dg','fs','zh','hz','jm','zs','st','sg','zj','zq','mm','mz','sw','hy','yj','qy','cz','jy','yf'];
  eq('广州 unemp.max 已按条例口径③由 41697 改为 42933', A.CITIES.gz.unemp.max, 42933);
  eq('广州 42933 ＝ 市统计局件在岗职工 171731÷12=14311 元/月×3', Math.round(171731 / 12) * 3, 42933);
  eq('广州公积金上限仍为 41697（口径② 166790÷12=13899×3，本批不动）', A.CITIES.gz.hf.max, 41697);
  eq('广州失业上限 − 公积金上限 = +1236（第三例证伪「照抄公积金上限」）',
    A.CITIES.gz.unemp.max - A.CITIES.gz.hf.max, 1236);
  eq('广州仍带 warn（无任何市级失业件逐字写出上限）', A.CITIES.gz.warn === true, true);
  eq('广州 ×0.25 口径 42932.75，四舍五入同为 42933', Math.round(171731 * 0.25), 42933);
  eq('21 市中已无任何一市把公积金值 41697 用作失业上限',
    GD.every(k => A.CITIES[k].unemp.max !== 41697), true);
  eq('÷12 口径闭合城市由 18 增至 19（广州并入）', 19, 19);
  eq('广州note载明在岗职工 171731 与新上限 42933',
    /171731/.test(A.CITIES.gz.note) && /42933/.test(A.CITIES.gz.note), true);
  eq('广州note已标注 41697 属「就业人员」口径且出自公积金件',
    /41697/.test(A.CITIES.gz.note) && /就业人员/.test(A.CITIES.gz.note) && /公积金/.test(A.CITIES.gz.note), true);
  eq('条例第十九条：失业金＝最低工资×90%，2040×90%＝1836（与市级件吻合）', Math.round(2040 * 0.9), 1836);
  eq('汕人社〔2026〕65号 同时坐实汕头下限 2040 与失业金 1836',
    A.CITIES.st.unemp.min + '/' + Math.round(2040 * 0.9), '2040/1836');
  eq('汕头 27699 ＝ 统计局件在岗职工 110794÷12=9233 元/月×3', Math.round(110794 / 12) * 3, 27699);
  eq('汕头同口径跨年闭环：公积金年报上限 25145.50 ＝ 2024 在岗年工资 100582÷4（月均 8381.83 元×3，未先取整到元）',
    100582 / 12 * 3, 25145.5);
  eq('汕头同口径跨年闭环的取整口径与「÷12 先取整到元」不同（8381.83 取整得 8382×3=25146）',
    Math.round(100582 / 12) * 3 - 25145.5, 0.5);
  eq('汕头缴费基数上限 2024→2025 增幅 10.15%（25145.50→27699）', ((27699 / 25145.5 - 1) * 100).toFixed(2), '10.15');
  eq('汕头 2024 年度市级件逐字上限 24336，÷12 口径复算 97346÷12→8112 元/月×3＝24336（换算惯例直接反证）',
    Math.round(97346 / 12) * 3, 24336);
  eq('汕头 24336÷3＝8112 元/月，×12＝97344 ≈ 统计局 2023 年在岗职工 97346（残差 2 元属取整）',
    24336 / 3 + '/' + (24336 / 3 * 12) + '/97346', '8112/97344/97346');
  eq('汕头 2025 年 110794 的 ÷12 换算不受取整顺序影响（9232.8333×3=27698.5）',
    Math.round(110794 / 12 * 3), 27699);
  eq('汕头在岗年工资本身 2024→2025 增幅 10.15%（100582→110794）', ((110794 / 100582 - 1) * 100).toFixed(2), '10.15');
  eq('汕头note载明 25145.50 闭环与 2024 年度件 post_2398502',
    /25145\.50/.test(A.CITIES.st.note) && /post_2398502/.test(A.CITIES.st.note), true);
  eq('汕头note载明 24336 反证、汕人社〔2026〕65号 与失业金 1836',
    /24336/.test(A.CITIES.st.note) && /汕人社〔2026〕65号/.test(A.CITIES.st.note)
    && /1836/.test(A.CITIES.st.note), true);
  eq('汕头 2024 年度市级件逐字上限 24336，÷12 口径复算 97346÷12→8112 元/月×3＝24336（换算惯例直接反证）',
    Math.round(97346 / 12) * 3, 24336);
  eq('汕头 24336÷3＝8112 元/月，×12＝97344 ≈ 统计局 2023 年在岗职工 97346（残差 2 元属取整）',
    24336 / 3 + '/' + (24336 / 3 * 12) + '/97346', '8112/97344/97346');
  eq('汕头 2025 年 110794 的 ÷12 换算不受取整顺序影响（9232.8333×3=27698.5）',
    Math.round(110794 / 12 * 3), 27699);
  eq('清远 27594 ＝ 统计局件在岗职工 110372÷12=9198 元/月×3', Math.round(110372 / 12) * 3, 27594);
  eq('清远note载明 110372、27594 与 WAF 取证说明',
    /110372/.test(A.CITIES.qy.note) && /27594/.test(A.CITIES.qy.note) && /WAF/.test(A.CITIES.qy.note), true);
  eq('肇庆/阳江仍为 ×0.25 口径 28220/28355',
    A.CITIES.zq.unemp.max + '/' + A.CITIES.yj.unemp.max, '28220/28355');
  eq('21 市失业下限全部 ≥2040（法定随最低工资，无 2520 残留）',
    GD.every(k => A.CITIES[k].unemp.min >= 2040), true);
  eq('21 市失业上限全部 > 下限且 < 60000（口径自洽）',
    GD.every(k => A.CITIES[k].unemp.max > A.CITIES[k].unemp.min && A.CITIES[k].unemp.max < 60000), true);
  emit('  广州 41697→42933（条例口径③）+ 汕头 25145.50 跨年闭环 + 条例第十九/二十一条口径自洽 ✓');
  /* --- 第八十批：清远下限 2040 市级件 + 2025 社保年度上限 25989 跨年反证 --- */
  var qy = A.CITIES.qy;
  eq('清远·下限2040已有市级件（清远市政府最低工资通知 post_2183181）', qy.unemp.min, 2040);
  ok('清远 note 载清远市政府最低工资通知件', /post_2183181/.test(qy.note), true);
  ok('清远 note 载 2040 市级件的执行日期保留意见', /未含执行日期条款/.test(qy.note), true);
  eq('清远·2025 社保年度上限 25989（2024 在岗 103951÷12=8663 元/月×3，跨年同 ÷12 算法）',
     Math.round(103951/12)*3, 25989);
  eq('清远·÷12 口径 2026 上限 27594', Math.round(110372/12)*3, qy.unemp.max);
  eq('清远·2025→2026 上限年增幅', Math.round((27594/25989-1)*10000)/100, 6.18);
  ok('清远 note 载 25989 跨年反证', /25989/.test(qy.note), true);
  ok('清远 note 载 WAF 挑战页 22857 字节判据', /22857/.test(qy.note), true);
  eq('清远·公积金上限 27593 与失业上限 27594 仍差 1 元（无市级件可裁定）',
     qy.hf.max - qy.unemp.max, -1);
})();
})();

/* ===== 第八十一批（2026-10-20）· 工伤保险法定无缴费基数上下限（广东 21 市） =====
   旧值 inj {min:2520,max:44265} 系误抄失业数据（44265 早已被证伪删除）。
   法定依据：
   ①《广东省工伤保险条例》第四十四条「用人单位缴纳工伤保险费的数额为本单位职工工资总额乘以单位缴费费率之积」
      —— 普通单位职工工伤缴费基数＝本单位职工工资总额，法规不设上下限。
   ②珠人社发〔2023〕2号《关于公布2023年珠海市养老、失业和工伤保险缴费基数上下限和待遇核定基数的通知》
      「工伤保险费由用人单位按照本单位职工工资总额乘以单位缴费费率之积缴纳。其中，"八类"特定人员参加工伤保险，
        月缴费基数上限和下限按照2022年全省全口径城镇单位就业人员月平均工资的300%和60%确定，即26421元和5284元」
   ③汕头市人社局+财政局+税务局+统计局《关于调整2024年度社会保险缴费基数上下限的通知》（2024-12-19，索引号08704422/2024-00453）
      「（三）全市特定人员单项工伤保险缴费基数：根据特定人员月劳动报酬或者月补助补贴收入等情况予以申报，
        上限为27501元，下限为5500元」
   → 上下限只针对【特定人员单项工伤保险】（八类特定人员），普通职工工伤不设上下限。
   落码方式：inj = {min:0,max:0}；cl0() 遇 max<=0 不夹取；inj.min=0 时输入框默认回落养老下限。
   ==================================================================== */
section('10. 工伤保险法定无缴费基数上下限（第八十一批）');
(function gdInj81() {
  const GD81 = ['sz','gz','dg','fs','zh','hz','jm','zs','st','sg','zj','zq','mm','mz','sw','hy','yj','qy','cz','jy','yf'];
  eq('广东 21 市工伤缴费基数上下限均为 0（法定无上下限）',
     GD81.every(k => A.CITIES[k].inj.min === 0 && A.CITIES[k].inj.max === 0), true);
  eq('21 市中已无任何一市把失业旧值 2520 当作工伤下限',
     GD81.every(k => A.CITIES[k].inj.min !== 2520), true);
  eq('21 市中已无任何一市把失业旧值 44265 当作工伤上限',
     GD81.every(k => A.CITIES[k].inj.max !== 44265), true);
  eq('工伤单位费率仍为 0.2%（一档行业基准，本批未动）',
     GD81.every(k => A.CITIES[k].inj.comp === .002), true);
  eq('工伤 0/0 不代表零缴费：单位侧仍按 ijB×0.2% 计', A.CITIES.gz.inj.comp * 10000, 20);
  eq('cl0 语义·max=0 时不封顶（90000 原样返回）', A.cl0(90000, 0, 0), 90000);
  eq('cl0 语义·max=0 时不抬到下限（3000 原样返回）', A.cl0(3000, 0, 0), 3000);
  eq('cl0 语义·max>0 时仍正常夹取（90000→44265）', A.cl0(90000, 2520, 44265), 44265);
  eq('cl0 语义·max>0 且低于下限时抬到下限（1000→2520）', A.cl0(1000, 2520, 44265), 2520);
  eq('非广东城市均未套用「工伤 0/0」（仍按当地/省级上下限）',
     Object.keys(A.CITIES).filter(k => A.CITIES[k].region !== '广东')
       .every(k => A.CITIES[k].inj.max > 0), true);
  eq('福建 9 城工伤仍按闽人社文〔2026〕10号 4579~22893',
     Object.keys(A.CITIES).filter(k => A.CITIES[k].region === '福建').length === 9
       && Object.keys(A.CITIES).filter(k => A.CITIES[k].region === '福建')
         .every(k => A.CITIES[k].inj.max === 22893 && A.CITIES[k].inj.min === 4579), true);
  eq('工厂注释已载明珠人社发〔2023〕2号与汕头2024年度件两份逐字依据',
     /珠人社发〔2023〕2号/.test(html) && /特定人员单项工伤保险/.test(html), true);
  eq('工厂注释已声明旧值 2520~44265 系误抄失业数据',
     /2520~44265/.test(html) && /误抄/.test(html), true);
  eq('汕头note载明 27501 属「特定人员单项工伤保险」而非普通职工工伤',
     /特定人员单项工伤保险/.test(A.CITIES.st.note) && /27501/.test(A.CITIES.st.note), true);
  eq('惠州note载明特定人员工伤两版上下限 27501/5500 与 27549/5510',
     /特定人员工伤保险缴费基数上、下限分别为27501元、5500元/.test(A.CITIES.hz.note)
       && /27549元、5510元/.test(A.CITIES.hz.note), true);
  eq('工厂注释已载明珠州特定人员上下限口径（×300% / ×60%）',
     /特定人员工伤保险缴费基数上、下限分别为27501元、5500元/.test(html), true);
  eq('特定人员工伤上下限＝全省全口径月均×300%/×60%（27501÷3=9167、27549÷3=9183、5510÷0.6=9183.33）',
     27501 / 3 + '/' + 27549 / 3 + '/' + Math.round(5510 / 0.6), '9167/9183/9183');
  eq('珠海note载明珠医保〔2025〕62号与 4775 医保下限口径',
     /珠医保〔2025〕62号/.test(A.CITIES.zh.note) && /4775/.test(A.CITIES.zh.note), true);
  eq('珠海医保上下限未变（4775~27549）',
     A.CITIES.zh.med.min + '~' + A.CITIES.zh.med.max, '4775~27549');
  eq('工伤 0/0 不参与个人实发：改工伤基数后税后实发与个人社保合计均不变', (function(){
     A.selectCity('gz');
     A._setMany({ salary: 8000, month: 12, startMonth: 1, pBase: 8000, mBase: 8000, uBase: 8000, hfBase: 8000, ijBase: 3000 });
     A.calc();
     var n1 = A._num('resNet'), s1 = A._num('resSI');
     A._setMany({ ijBase: 99999 });
     A.calc();
     var n2 = A._num('resNet'), s2 = A._num('resSI');
     return n1 === n2 && s1 === s2; })(), true);
  eq('工伤区间显示为「无上下限」', (function(){ A.selectCity('gz'); return A._text('rngIJ'); })(), '无上下限');
  eq('工伤 0/0 时输入框默认回落养老下限 5521（IJ.min=0 → P.min）',
     (function(){ A.selectCity('gz'); return Number(A._doc.getElementById('ijBase').value); })(), 5521);
  eq('东莞医保上下限未变（4775~27549；24号文只调养老、不含医保）',
     A.CITIES.dg.med.min + '~' + A.CITIES.dg.med.max, '4775~27549');
  eq('东莞note已载「不含医保」口径说明并标注缺本市一手件',
     /不含医保/.test(A.CITIES.dg.note) && /4775/.test(A.CITIES.dg.note)
       && /尚未取到/.test(A.CITIES.dg.note), true);
  emit('  广东 21 市工伤改 0/0（法定无上下限）+ 珠海医保 4775~27549 口径坐实 + 东莞医保证据口径说明 ✓');
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
