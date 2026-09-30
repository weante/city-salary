#!/usr/bin/env node
/*
 * 生成 docs/warn-backlog.md —— warn 城市的缺口清单。
 *
 * 为什么用生成而不是手写：清单必须与 CITIES 的 warn 集合**严格一致**，
 * 手写清单必然漂移（这正是本项目一路在治的病）。生成 + check-sync 的检查 H
 * 校验集合相等，才能做到"新增 warn 城市忘了登记 → CI 红"。
 *
 * 分类依据是**缺哪个参数**（可操作），而不是"哪个省"：
 *   A 社保基数未公布   → 影响五险全部基数，对到手现金影响最大
 *   B 医保单位费率未找到 → 影响单位侧；部分城市个人侧大额也随之待定
 *   C 公积金基数未公布  → 只影响公积金
 *   D 其他待核实       → 医保基数/多缺口混合等，需人工确认
 *
 * 运行：
 *   node tools/gen-warn-backlog.js --update   # 重新生成 docs/warn-backlog.md
 *   node tools/gen-warn-backlog.js            # 只打印统计，不写文件
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadCalculator } = require('./calc-harness.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'warn-backlog.md');
const UPDATE = process.argv.indexOf('--update') >= 0;

/* 下次核查时间：按缺口类型挂到对应的固定检查点上 */
const NEXT = {
  A: '2027-07-15（社保年度检查点）',
  B: '2027-01-01（自然年检查点）',
  C: '2027-07-15（社保年度检查点）',
  D: '2027-01-01（自然年检查点）',
};
const CAT_NAME = {
  A: '社保基数未公布',
  B: '医保单位费率未找到',
  C: '公积金基数未公布',
  D: '其他待核实',
};
const CAT_ACTION = {
  A: '联网找省级人社厅新年度缴费基数上下限文件；找到即更新 CITIES 与文档，清掉 warn',
  B: '联网找该市医保局费率文件；找不到则确认省级区间口径，并在 note 写明估算依据',
  C: '联网找该市公积金中心年度通知；找不到则沿用旧年度并在 note 写明',
  D: '人工确认 note 里列出的缺口项，逐项联网核实',
};

/* 判定顺序即优先级，按**对"到手现金"的影响**排：
   A 社保基数 → 五险全部基数，影响最大
   C 公积金   → 直接进公积金缴存额，影响到手现金
   B 医保单位费率 → 只进"单位合计"展示，不影响个人实发，故排在 C 之后
   D 其他     → 多为租金档位争议、多个缺口混合

   两个容易漏的信号：
   · 海南写成「2026年度基数未公布，暂用2025年度」，不带"社保"二字 → A 要单独认这一形态
   · 公积金停在 2025 年度（如「公积金2025年度 2150~22736」「公积金上限24932（2025年度…）」）
     没有"未公布"字样，但年份本身就是陈旧信号 → C 认 2024/2025 年度 */
function classify(note) {
  const n = note || '';
  if (/社保(新)?基数(未公布|未找到)|养老基数未找到|2026年度基数未公布|2026基数未找到|社保基数官方口径未找到/.test(n)) return 'A';
  if (/公积金[^；]*(未公布|未找到|未发布|未披露|未见|暂用|暂按|暂沿用|待核实|原文为图片|反推)|公积金\s*20(2[0-5])\s*年度|公积金[^；]*（20(2[0-5])\s*年度/.test(n)) return 'C';
  if (/单位费率未找到|单位费率未单列|医保费率待核实|医保单位费率未找到|医保单位含生育明确值未找到|医保单位现行明确值未找到/.test(n)) return 'B';
  return 'D';
}
/* 从 note 里摘出缺口摘要（分号分段里含"未找到/未公布/待核实"的那些段） */
function gapSummary(note) {
  const parts = String(note || '').split(/[；;]/).filter(s => /未找到|未公布|未发布|未见|待核实|暂用|暂按/.test(s));
  const s = parts.slice(0, 2).join('；') || String(note || '').slice(0, 60);
  return s.replace(/\|/g, '/').slice(0, 92);
}

const CITIES = loadCalculator().CITIES;
const warn = Object.keys(CITIES).filter(k => CITIES[k].warn)
  .map(k => ({ key: k, name: CITIES[k].name, region: CITIES[k].region, cat: classify(CITIES[k].note), gap: gapSummary(CITIES[k].note) }))
  .sort((a, b) => (a.cat === b.cat ? (a.region.localeCompare(b.region, 'zh') || a.name.localeCompare(b.name, 'zh')) : a.cat.localeCompare(b.cat)));

const total = Object.keys(CITIES).length;
const byCat = { A: [], B: [], C: [], D: [] };
for (const w of warn) byCat[w.cat].push(w);

console.log(`warn 城市 ${warn.length} / ${total}`);
for (const c of ['A', 'B', 'C', 'D']) console.log(`  ${c} ${CAT_NAME[c].padEnd(14)} ${byCat[c].length}`);
const perRegion = {};
for (const w of warn) perRegion[w.region] = (perRegion[w.region] || 0) + 1;

const lines = [];
/* 标题里的城市数**必须计算**，不能写死 —— 原先硬编码「172 城」，
   warn 数变成 186 后重新生成，标题仍显示 172（生成器与产物不一致）。
   检查 H 只校验城市**集合**相等，不校验标题里的数字，所以这个错会静默存在。 */
lines.push(`# warn 缺口清单（${warn.length} 城）`);
lines.push('');
lines.push('> **本文件由 `node tools/gen-warn-backlog.js --update` 生成，请勿手改表格部分。**');
lines.push('> `check-sync` 的**检查 H** 会校验此处的城市集合与 `calculator.html` 里 `warn:true` 的城市**严格一致**——');
lines.push('> 新增或移除 warn 城市后不重新生成，CI 会红。');
lines.push('');
lines.push('## 一、这份清单解决什么问题');
lines.push('');
lines.push('计算器里带 `warn:true` 的城市会在页面显示橙框「数据待确认」。但"待确认"本身不是可执行的——');
lines.push('**待确认什么、什么时候确认、确认到哪一步算完**，原先只散落在各城 `note` 里。这份清单把它结构化：');
lines.push('按**缺哪个参数**分层，每层给出补齐动作与下一次核查时间。');
lines.push('');
lines.push(`当前状态：全国 ${total} 城中 **${warn.length} 城**带 warn（占 ${(warn.length / total * 100).toFixed(1)}%），`);
lines.push('分布见下表。**缺口不代表数据错误**——项目原则是"查不到就标注、绝不编造"，');
lines.push('这些城市用的都是已公开的最近一期数值或明确的省级区间，只是尚未取到本年度官方文件。');
lines.push('');
lines.push('## 二、分类汇总');
lines.push('');
lines.push('| 类别 | 缺口 | 城市数 | 影响 | 补齐动作 | 下一次核查 |');
lines.push('|:----:|------|:------:|------|---------|-----------|');
const IMPACT = {
  A: '五险全部基数 —— **对到手现金影响最大**',
  B: '仅单位侧"单位合计"展示；**不影响个人实发**',
  C: '公积金缴存额 —— **直接影响到手现金**',
  D: '视具体缺口而定（多为租金档位争议、多缺口混合）',
};
for (const c of ['A', 'B', 'C', 'D']) {
  lines.push(`| **${c}** | ${CAT_NAME[c]} | ${byCat[c].length} | ${IMPACT[c]} | ${CAT_ACTION[c]} | ${NEXT[c]} |`);
}
lines.push(`| | **合计** | **${warn.length}** | | | |`);
lines.push('');
lines.push('## 三、按省份分布');
lines.push('');
lines.push('| 省份分组 | warn 城市数 | 该省城市总数 | 占比 |');
lines.push('|---------|:-----------:|:-----------:|:----:|');
const regionTotal = {};
for (const k in CITIES) regionTotal[CITIES[k].region] = (regionTotal[CITIES[k].region] || 0) + 1;
for (const r of Object.keys(perRegion).sort((a, b) => perRegion[b] - perRegion[a])) {
  lines.push(`| ${r} | ${perRegion[r]} | ${regionTotal[r]} | ${(perRegion[r] / regionTotal[r] * 100).toFixed(0)}% |`);
}
lines.push('');
lines.push('## 四、逐城明细');
lines.push('');
lines.push('| 城市 | 省份 | 类别 | 主要缺口（摘自 note） | 下一次核查 |');
lines.push('|------|------|:----:|---------------------|-----------|');
for (const w of warn) {
  lines.push(`| ${w.name} | ${w.region} | ${w.cat} | ${w.gap} | ${NEXT[w.cat]} |`);
}
lines.push('');
lines.push('## 五、维护方式');
lines.push('');
lines.push('1. 取到官方文件后：更新 `calculator.html` 的 `CITIES` 条目（数值 + `note`），**去掉 `warn:true`**；');
lines.push('2. 同步 `AGENTS.md` / `SKILL.md` / `README.md` 的对应参数行；');
lines.push('3. 跑 `node tools/gen-warn-backlog.js --update` 重新生成本清单；');
lines.push('4. 跑 `npm test` 全套确认。');
lines.push('');
lines.push('> 反过来：**新增 warn 城市时也必须重新生成**，否则检查 H 会因集合不一致而失败。');
lines.push('> 这条约束是有意的——缺口只有被登记才算被追踪。');
lines.push('');

if (UPDATE) {
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`\n已生成 docs/warn-backlog.md（${(fs.statSync(OUT).size / 1024).toFixed(1)} KB，${warn.length} 城）`);
} else {
  console.log('\n（未加 --update，仅统计，未写文件）');
}
