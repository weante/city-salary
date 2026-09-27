#!/usr/bin/env node
/*
 * 限期费率清单 —— 「有明确有效期、到期即可能变化」的阶段性政策。
 *
 * 为什么单独建这个模块：SKILL.md 把数据时效分成三个检查点（1 月医保 / 7 月养老公积金 /
 * 限期费率按到期日）。前两类是**固定日历**，到期自然会被想起来；第三类没有固定日期，
 * 靠人记——而它恰恰是最容易"标记为已核查、实际已过期"的一类：上海医保 9% 的到期日
 * 2027-02-28 落在两个年度检查点之间，2027-01-01 的年度核查看到"仍是 9%"就标新鲜，
 * 此后 10 个月都会用过期费率。
 *
 * 所以把清单变成数据，由 check-sync 的**检查 G** 守着：
 *   1. 每条必须有合法 ISO 日期（或显式 null 表示到期日未知 → 要求人工确认）
 *   2. trigger 必须等于 until 的次日（防止手算错）
 *   3. today >= trigger 且未记录处置 → **检查失败**，强制联网核查
 *      已记录处置（acknowledged）→ 只提示，不失败；但处置理由要写在下面，可审计
 *   4. trigger 在 60 天内 → 提前提醒（不失败）
 *   5. SKILL.md 的「限期费率」表必须与本模块条目一致（防双源漂移）
 *
 * 字段：
 *   id            唯一标识（英文短名，check G 报错时用它定位）
 *   scope         政策主体（省份/城市 + 险种）
 *   current       现行费率
 *   until         文件有效期至（YYYY-MM-DD；null = 到期日未知，需人工确认）
 *   basis         依据文号
 *   acknowledged  已到期的处置记录 { date, reason }；未到期时为 null
 *
 * 维护：新增阶段性政策时先加到这里，再同步 SKILL.md 的表；
 *       到期后联网确认结果，把 current 改成新值并清空 acknowledged（或改 until）。
 */
'use strict';

const POLICIES = [
  /* ---------- 未到期 ---------- */
  {
    id: 'sh-med',
    scope: '上海 · 职工医保（含生育）单位费率',
    current: '9%',
    until: '2027-02-28',
    basis: '沪医保规〔2026〕',
    acknowledged: null,
    note: '到期即可能恢复原费率（如 10%）。到期日不在 1 月/7 月检查点上，只靠年度核查会漏检。',
  },
  {
    id: 'sh-inj',
    scope: '上海 · 工伤一类行业基准费率',
    current: '0.2% 起',
    until: '2029-12-31',
    basis: '沪人社规〔2024〕25号',
    acknowledged: null,
    note: '个人不缴，仅影响单位侧展示。',
  },
  {
    id: 'sh-unemp',
    scope: '上海 · 失业保险合计费率',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2029-12-31',
    basis: '沪人社规〔2024〕25号',
    acknowledged: null,
    note: '个人侧影响到手现金。',
  },
  {
    id: 'sc-unemp',
    scope: '四川 · 失业保险合计费率',
    current: '1%（单位 0.6% + 个人 0.4%）',
    until: '2026-12-31',
    basis: '川人社规〔2024〕7号',
    acknowledged: null,
    note: '到期日与 1 月检查点重合，但必须单独确认是延续还是恢复，不可默认继续。',
  },
  {
    id: 'hi-med',
    scope: '海南 · 职工医保（含生育）单位费率',
    current: '6.5%（含生育 0.5%，全省统筹统一）',
    until: '2026-12-31',
    basis: '琼医保〔2024〕48号',
    acknowledged: null,
    note: '原表遗漏的一条：此前只在省份小节与 CITIES note 里写了到期日，未进限期费率清单。',
  },
  {
    id: 'qh-med',
    scope: '青海 · 西宁/海东 医保单位费率过渡',
    current: '已并入省级统筹 8%（企业含生育 8.9%）',
    until: '2027-01-01',
    basis: '青政办〔2025〕28号',
    acknowledged: null,
    note: '西宁/海东原 6% 过渡至 2027-01-01，到期后全省完全统一。',
  },

  /* ---------- 到期日未知（需人工确认，检查 G 会持续提示） ---------- */
  {
    id: 'xa-med',
    scope: '陕西 · 西安 医保单位费率阶段性减征',
    current: '7%（减征前 8%，含生育 1%）',
    until: null,
    basis: '市医保发〔2019〕68号（减征自 2025-12 起）',
    acknowledged: null,
    note: '文档只写了"2025-12 起阶段性减征至 7%"，未找到明确的届满日。需联网确认有效期，否则无法排期核查。',
  },

  /* ---------- 已到期：已记录处置 ---------- */
  {
    id: 'yl-med',
    scope: '新疆 · 伊犁 医保单位费率降费期',
    current: '9.5%（含生育 0.5%，估算值）',
    until: '2025-02-28',
    basis: '降费期文件（降费前 9% 不含生育）',
    acknowledged: { date: '2026-09-27', reason: '降费期已届满，官方未公布降费后费率；暂按 9.5% 估算并在计算器标 warn，已列入 docs/warn-backlog.md 补齐待办' },
    note: '本轮复核发现的最严重一条：到期日已过 19 个月，此前未进限期费率清单。',
  },
  {
    id: 'bj-unemp',
    scope: '北京 · 失业保险合计费率（原 1% 文件）',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2025-12-31',
    basis: '原阶段性降费文件',
    acknowledged: { date: '2026-09-27', reason: '2026 延续文件未找到，暂按 1% 沿用；SKILL.md 已注明"延续文件未找到"' },
    note: '失业降费"延续文件未找到"这一类在 8 个省份都存在，统一按本模式登记。',
  },
  {
    id: 'tj-unemp',
    scope: '天津 · 失业保险合计费率（原 1% 文件）',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2025-12-31',
    basis: '原阶段性降费文件',
    acknowledged: { date: '2026-09-27', reason: '1% 延续文件未找到，暂按 1% 沿用' },
    note: '',
  },
  {
    id: 'cq-unemp',
    scope: '重庆 · 失业保险合计费率',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2025-12-31',
    basis: '渝人社规〔2025〕10号',
    acknowledged: { date: '2026-09-27', reason: '2026 延续文件未找到，暂按 1% 沿用' },
    note: '',
  },
  {
    id: 'ln-unemp',
    scope: '辽宁 · 失业保险合计费率',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2025-12-31',
    basis: '辽人社发〔2024〕5号',
    acknowledged: { date: '2026-09-27', reason: '2026 延续文件未找到，暂按 1% 沿用' },
    note: '',
  },
  {
    id: 'hlj-unemp',
    scope: '黑龙江 · 失业保险合计费率',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2025-12-31',
    basis: '黑政办规〔2023〕2号 等',
    acknowledged: { date: '2026-09-27', reason: '2026 延续文件未找到，暂按 1% 沿用' },
    note: '',
  },
  {
    id: 'zj-unemp',
    scope: '浙江 · 失业保险合计费率',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2025-12-31',
    basis: '原阶段性降费文件',
    acknowledged: { date: '2026-09-27', reason: '2026 延续文件未找到，暂按 1% 沿用' },
    note: '',
  },
  {
    id: 'nmg-unemp',
    scope: '内蒙古 · 失业保险合计费率',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2025-12-31',
    basis: '原阶段性降费文件',
    acknowledged: { date: '2026-09-27', reason: '2026 延续未找到，暂按 1% 沿用' },
    note: '',
  },
  {
    id: 'xj-unemp',
    scope: '新疆 · 失业保险合计费率',
    current: '1%（单位 0.5% + 个人 0.5%）',
    until: '2025-12-31',
    basis: '原阶段性降费文件',
    acknowledged: { date: '2026-09-27', reason: '2026 延续未找到，暂按 1% 沿用' },
    note: '',
  },
];

/* 三个固定检查点（1 月医保 / 7 月养老公积金 / 限期费率按到期日）——供日历文档与检查 G 共用 */
const CHECKPOINTS = [
  { id: 'jan', label: '医保 / 生育（含并入医保的部分）', cycle: '自然年（1 月 1 日起执行新年度）', trigger: '每年 01-01' },
  { id: 'jul', label: '养老 / 失业 / 工伤 / 住房公积金', cycle: '社保年度 / 公积金年度（7 月 1 日起执行）', trigger: '每年 07-15' },
  { id: 'expiry', label: '限期费率文件', cycle: '文件到期即可能恢复原费率', trigger: '各文件有效期届满次日' },
];

/* 到期次日。until 为 null 时返回 null。 */
function triggerOf(until) {
  if (!until) return null;
  const d = new Date(until + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

module.exports = { POLICIES, CHECKPOINTS, triggerOf, ISO };
