#!/usr/bin/env node
/*
 * 黄金用例：把「一组输入 → 全部渲染输出」冻结成快照，重构时用来证明行为没变。
 *
 * 与 test-calc.js 的关系：test-calc 断言的是**具体数值**（6647 项），覆盖已知关注点；
 * 黄金用例捕获的是**整块渲染结果**，覆盖所有没被单独断言到的字段。两者互补——
 * 前者告诉你"哪个数错了"，后者告诉你"有什么变了"。
 *
 * 这是 M5 重构（calc() 拆分）的安全网：拆分前后必须逐字节一致。
 *
 * 运行：
 *   node tools/check-golden.js            # 比对，不一致则退出码 1
 *   node tools/check-golden.js --update   # 重新冻结快照（确认改动是有意的之后再用）
 *
 * 快照里会把日期归一化（{{DATE}} / {{Y}}），避免跨年后无谓失败。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadCalculator } = require('./calc-harness.js');

const OUT = path.join(__dirname, 'golden-cases.json');
const UPDATE = process.argv.indexOf('--update') >= 0;

/* ---------- 用例：覆盖结构差异，而不是覆盖城市数量 ----------
   选城市看的是"计算分支"，不是"名气"：
     bj      直辖市 + 医保个人固定额(大额互助 3 元)
     sh      公积金比例上限 7%（全国唯一非 12%）
     sz      广东型 CI() + 户籍区分 + 两档医保 + 长护险
     dg      三档医保 + 长护险
     cd      省级统一基数 + 市级医保基数覆盖(opt.med)
     heb     2025 年度 + dataNext（页脚"待公布"分支）
     zzheng  warn 城市 + 大额医疗固定额 10.83
     wuha    湖北分 3 档 + 固定额 7
     cq      直辖市 + 固定额 5
     lasa    西藏极高基数（上限 35862）
     sanya   海南 2025 年度 + 租金 800 档
   输入变体覆盖：触底夹取 / 封顶夹取 / 公积金不缴 / 起始月晚于当前月 /
   全部专项附加扣除 / 补充扣除 / 年终奖临界值陷阱命中。 */
const STD = { salary: 20000, month: 7, startMonth: 1, pBase: 20000, mBase: 20000, uBase: 20000, mtBase: 20000, ijBase: 20000, hfBase: 20000, hfRate: 12 };
const LOW = { salary: 4000, month: 3, startMonth: 3, pBase: 1000, mBase: 1000, uBase: 1000, mtBase: 1000, ijBase: 1000, hfBase: 1000, hfRate: 5 };
const MAXED = {
  salary: 100000, month: 12, startMonth: 1, pBase: 999999, mBase: 999999, uBase: 999999,
  mtBase: 999999, ijBase: 999999, hfBase: 999999, hfRate: 12, bonus: 36001,
  persPen: 1000, healthIns: 200, annuity: 4,
};
const ALL_DED = { childOn: 1, eduOn: 1, houseOn: 1, elderlyOn: 1, medicalOn: 1 };
const NO_HF = { salary: 15000, month: 3, startMonth: 12, pBase: 15000, mBase: 15000, uBase: 15000, mtBase: 15000, ijBase: 15000, hfBase: 15000, hfRate: 0 };

const CASES = [
  { name: '北京 · 标准', city: 'bj', set: STD },
  { name: '北京 · 封顶+全扣除+年终奖陷阱', city: 'bj', set: MAXED, check: ALL_DED },
  { name: '上海 · 标准（公积金上限 7%）', city: 'sh', set: STD },
  { name: '上海 · 触底夹取', city: 'sh', set: LOW },
  { name: '深圳 · 深户一档', city: 'sz', set: STD, hk: 1 },
  { name: '深圳 · 非深户二档+长护险', city: 'sz', set: STD, hk: 0, med: 2, check: { ltcOn: 1 } },
  { name: '深圳 · 公积金不缴+起始月晚于当前月', city: 'sz', set: NO_HF },
  { name: '东莞 · 三档医保', city: 'dg', set: STD, med: 3 },
  { name: '成都 · 市级医保基数覆盖', city: 'cd', set: STD },
  { name: '成都 · 封顶+全扣除', city: 'cd', set: MAXED, check: ALL_DED },
  { name: '哈尔滨 · 2025 年度待公布', city: 'heb', set: STD },
  { name: '郑州 · warn 城市+大额 10.83', city: 'zzheng', set: STD },
  { name: '武汉 · 湖北分档+固定额 7', city: 'wuha', set: STD },
  { name: '重庆 · 直辖市+固定额 5', city: 'cq', set: STD },
  { name: '拉萨 · 极高基数', city: 'lasa', set: STD },
  { name: '三亚 · 海南 2025 年度+租金 800', city: 'sanya', set: STD },
];

/* ---------- 捕获 ----------
   快照里剥掉 `style="..."` 内联样式：它们绝大多数是重复的静态呈现常量
   （对齐方式、配色），占了快照 80% 以上的体积，却是计算重构最不可能动到的部分。
   保留 class 与全部文本/数字/标签结构/id —— 那些才是计算的产物。
   （唯一由数据驱动的样式 startWarn 的 display，已由 test-calc 第 13 节直接断言。） */
const norm = (s) => String(s)
  .replace(/\sstyle="[^"]*"/g, '')
  .replace(/\d{4}-\d{2}-\d{2}/g, '{{DATE}}')
  .replace(/\d{4}年/g, '{{Y}}年');

function capture(c) {
  const api = loadCalculator();
  api.selectCity(c.city);
  api._setMany(Object.assign({
    bonus: 0, persPen: 0, healthIns: 0, annuity: 0,
    childAmt: 0, eduAmt: 0, houseAmt: 0, elderlyAmt: 0, medicalAmt: 0,
  }, c.set));
  for (const k of ['childOn', 'eduOn', 'houseOn', 'elderlyOn', 'medicalOn', 'ltcOn']) api._check(k, false);
  if (c.check) for (const k in c.check) api._check(k, !!c.check[k]);
  if (c.hk !== undefined) api.setHk(c.hk);
  if (c.med !== undefined) api.setMed(c.med);

  api.calc();
  const out = { res: norm(api._html('res')), bonus: norm(api._html('bonusResult')) };
  api.switchTab(1);
  out.hist = norm(api._html('histTable'));
  out.sum = norm(api._html('histSum'));
  api.switchTab(0);
  return out;
}

/* ---------- 比对 ---------- */
function firstDiff(a, b) {
  if (a === b) return null;
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  const from = Math.max(0, i - 40);
  return {
    at: i,
    expected: a.slice(from, i + 60).replace(/\s+/g, ' '),
    actual: b.slice(from, i + 60).replace(/\s+/g, ' '),
  };
}

const fresh = {};
for (const c of CASES) fresh[c.name] = capture(c);

if (UPDATE) {
  fs.writeFileSync(OUT, JSON.stringify({
    _comment: '黄金用例快照：由 tools/check-golden.js --update 生成。改动渲染输出后需重新冻结；比对失败会指出首个差异位置。',
    _panels: 'res=单月结果面板 bonus=年终奖面板 hist=历史明细表 sum=历史汇总',
    cases: fresh,
  }, null, 2) + '\n', 'utf8');
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`已冻结 ${CASES.length} 个用例 → tools/golden-cases.json（${kb} KB）`);
  process.exit(0);
}

if (!fs.existsSync(OUT)) {
  console.log('✗ 找不到 tools/golden-cases.json，请先运行：node tools/check-golden.js --update');
  process.exit(1);
}
const golden = JSON.parse(fs.readFileSync(OUT, 'utf8')).cases;
let bad = 0, missing = 0;

for (const c of CASES) {
  const want = golden[c.name];
  if (!want) { console.log(`  ✗ 快照里没有用例「${c.name}」（新增用例后请 --update）`); missing++; continue; }
  for (const panel of ['res', 'bonus', 'hist', 'sum']) {
    const d = firstDiff(want[panel] || '', fresh[c.name][panel] || '');
    if (d) {
      console.log(`  ✗ ${c.name} · ${panel} 第 ${d.at} 字符起不同`);
      console.log(`      快照: …${d.expected}…`);
      console.log(`      当前: …${d.actual}…`);
      bad++;
    }
  }
}
/* 快照里有、用例列表里没有的（防删了用例忘了更新快照） */
for (const n in golden) {
  if (!CASES.some(c => c.name === n)) { console.log(`  ! 快照里的用例「${n}」已不在用例列表中（请 --update）`); missing++; }
}

console.log('\n' + '='.repeat(58));
if (bad || missing) {
  console.log(`黄金用例未通过：${bad} 处渲染差异${missing ? `，${missing} 处用例集不同步` : ''}`);
  console.log('若差异是有意为之（如新增 UI 字段），确认后运行 node tools/check-golden.js --update 重新冻结');
  process.exit(1);
}
console.log(`黄金用例通过：${CASES.length} 个用例 × 4 个面板逐字节一致`);
