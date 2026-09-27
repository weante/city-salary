#!/usr/bin/env node
/*
 * 省份年度基线表 —— check-sync 检查 E 的唯一事实来源。
 *
 * 存在的原因（真实事故）：CIU() 工厂默认 dataYear:"2026"，而新增省份城市时
 * 只覆盖了 region 没覆盖 dataYear，导致吉林/黑龙江/江苏/浙江/河南/湖北/福建/江西/海南
 * 共 100 城的页脚显示「数据依据：哈尔滨 2026年度」，而这些省的 2026 年度基数
 * 其实尚未公布 —— 用户会误以为基数已更新。对工资工具而言这是信任级问题。
 *
 * 检查 E 的断言：每个城市的 CITIES[x].dataYear / dataNext 必须与本表一致。
 * 这样「新增城市忘写年度」和「年度滚动忘更新」都会在 CI 红，而不是静默漂移。
 *
 * 字段语义：
 *   dataYear —— 该城市当前生效参数所属的年度，页脚渲染为「数据依据：<城市> <dataYear>年度」。
 *               '2025'      自然年 2025（黑龙江自 2025-01-01 起；苏/浙/豫/鄂/赣/琼 同形）
 *               '2026'      2026 年度基数已公布并写入
 *               '2025-2026' 跨年，用于两种情形：
 *                           ① 社保年度 2025.7–2026.6（广东、吉林）
 *                           ② 同一城市内险种分属不同年度（福建：养老/失业 2025 年度、
 *                              医保/工伤 2026 年度）
 *   dataNext —— 下一个「尚未公布」的年度；null 表示无待公布项。
 *               页脚渲染为「（<dataNext>年度待公布）」。
 *               dataYear 已经跨到该年度时（如 '2025-2026'）不再重复提示，故为 null。
 *
 * 依据（各省现行文件，详见 docs/baseline-year-map.md）：
 *   吉林   吉人社联〔2025〕97号，社保年度 2025.7-2026.6；新上下限待落地
 *   黑龙江 黑人社函〔2024〕548号，自 2025-01-01 起；2026 年度基数未公布
 *   江苏   苏人社发〔2025〕33号；2026 年度新基数未公布，苏税发〔2026〕3号暂按 2025 年度预处理
 *   浙江   浙人社发〔2025〕52号；2026 年度新基数未找到
 *   河南   豫人社办〔2025〕67号；2026 年度正式上下限未找到
 *   湖北   鄂人社发〔2025〕28号；鄂医保函〔2024〕91号 2026-07-01 起继续执行至新标准出台
 *   福建   闽人社文〔2025〕45号（养老 2025 年度）/ 闽医保函〔2026〕65号（医保·工伤 2026 年度）
 *   江西   赣人社字〔2025〕150号；2026 年度未找到
 *   海南   琼人社发〔2025〕67号；2026 年度上下限未找到
 *   广东   2025-2026 年度，核查于 2026-08-12（结论：2026 年 7 月广东基数未调整）
 *
 * 维护方式：年度基数更新时，先改本表，再改 calculator.html 的 opt 覆盖，
 * 最后跑 node tools/check-sync.js 确认 E 检查通过。
 */
'use strict';

const PROVINCE_YEAR = {
  /* 直辖市：京/沪/津/渝 2026 年度已公布 */
  '直辖市':  { dataYear: '2026',      dataNext: null },
  /* 广东：社保年度 2025.7-2026.6，2026 年 7 月核查未调整，故仍标跨年 */
  '广东':    { dataYear: '2025-2026', dataNext: null },
  '四川':    { dataYear: '2026',      dataNext: null },
  '山东':    { dataYear: '2026',      dataNext: null },
  '辽宁':    { dataYear: '2026',      dataNext: null },
  /* 吉林：社保年度 2025.7-2026.6，新上下限待落地（与广东同形，故同标跨年） */
  '吉林':    { dataYear: '2025-2026', dataNext: null },
  /* 以下六省为自然年 2025 年度基数，2026 年度均未公布 */
  '黑龙江':  { dataYear: '2025',      dataNext: '2026' },
  '江苏':    { dataYear: '2025',      dataNext: '2026' },
  '浙江':    { dataYear: '2025',      dataNext: '2026' },
  '河南':    { dataYear: '2025',      dataNext: '2026' },
  /* 湖北：省级分 3 档，基数源自 2025 年度文件并延续执行至新标准出台 */
  '湖北':    { dataYear: '2025',      dataNext: '2026' },
  '湖南':    { dataYear: '2026',      dataNext: null },
  '安徽':    { dataYear: '2026',      dataNext: null },
  /* 福建：养老/失业 2025 年度、医保/工伤 2026 年度，同一城市跨两个年度 */
  '福建':    { dataYear: '2025-2026', dataNext: null },
  '江西':    { dataYear: '2025',      dataNext: '2026' },
  '河北':    { dataYear: '2026',      dataNext: null },
  '山西':    { dataYear: '2026',      dataNext: null },
  '陕西':    { dataYear: '2026',      dataNext: null },
  '广西':    { dataYear: '2026',      dataNext: null },
  '云南':    { dataYear: '2026',      dataNext: null },
  '贵州':    { dataYear: '2026',      dataNext: null },
  '甘肃':    { dataYear: '2026',      dataNext: null },
  '宁夏':    { dataYear: '2026',      dataNext: null },
  '内蒙古':  { dataYear: '2026',      dataNext: null },
  '新疆':    { dataYear: '2026',      dataNext: null },
  '青海':    { dataYear: '2026',      dataNext: null },
  /* 海南：2025 年度基数，2026 年度上下限未找到 */
  '海南':    { dataYear: '2025',      dataNext: '2026' },
  '西藏':    { dataYear: '2026',      dataNext: null },
};

/* 省份分组名清单（供 check-dom / check-sync 交叉核对，防止新增省份漏登记） */
const REGIONS = Object.keys(PROVINCE_YEAR);

/* 期望值：region 未登记时返回 null，由调用方报错（而不是静默放过） */
function expectedFor(region) {
  return Object.prototype.hasOwnProperty.call(PROVINCE_YEAR, region) ? PROVINCE_YEAR[region] : null;
}

module.exports = { PROVINCE_YEAR, REGIONS, expectedFor };
