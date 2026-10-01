'use strict';
/**
 * source-records.js —— `docs/sources/*.json` 的**统一读取与判定**
 *
 * ## 为什么要抽这个模块
 *
 * 本仓库历史上「判断一个城市条目是否已核查」的逻辑，
 * 在**四个脚本里各写了一份**（汇总脚本、补链接脚本、报告脚本、_summary 同步脚本），
 * 结果同一类 bug 改了四遍：
 *
 * | 次序 | 漏掉的占位符写法 | 出现在哪个文件 |
 * |:----:|-----------------|---------------|
 * | ① | `"待核查"` | P2/P5 |
 * | ② | `""`（空字符串） | G3/G4/G5 |
 * | ③ | `"（尚未核查，占位）"` | G1 |
 *
 * 根因：**用「排除特定占位字符串」做判定，永远会漏下一个写法**。
 * 正确做法是**正向判定**：有 url，或 confirms 有实质内容。
 *
 * 现在这份逻辑只此一处，其他脚本一律引用本模块。
 *
 * ## 用法
 *
 *   const { readRecords, isFilled, STUB_RE } = require('./source-records.js');
 *   const { best, mismatches, stats, missingCities, files } = readRecords();
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'docs', 'sources');

/** 数据文件名：G1.json / G1b.json / P2.json / Q5.json / R1.json（排除 _ 开头的辅助文件） */
const DATA_FILE_RE = /^[A-Z]\d+[a-z]?\.json$/;

/** 占位特征词 —— 只要 confirms 命中其一，就视为**未填** */
const STUB_RE = /尚未核查|占位|待核查|待查|待补充|^$|^无$|^-$/;

/** 无 url 时，confirms 至少要有这么长才算「有实质内容」 */
const MIN_SUBSTANTIVE_LEN = 25;

/**
 * 判断一个城市条目是否**已核查**（正向判定，不依赖特定占位字符串）
 * @param {object} c 城市条目
 * @returns {boolean}
 */
function isFilled(c) {
  const s = String((c && c.confirms) || '').trim();
  if (STUB_RE.test(s)) return false;
  if (((c && c.urls) || []).length > 0) return true;
  return s.length >= MIN_SUBSTANTIVE_LEN;
}

/** 条目的「可信度」排序分：状态权重 > 链接数 > confirms 长度 */
function scoreOf(c) {
  const st = c.status === 'official-confirmed' ? 2 : c.status === 'official-partial' ? 1 : 0;
  return st * 1000 + ((c.urls || []).length) * 10 + Math.min(String(c.confirms || '').length, 500) / 100;
}

/**
 * 读取全部核查记录，每个城市取**最佳**一条
 * @param {object} [opts]
 * @param {string[]} [opts.files] 只读指定文件
 * @returns {{best: object, mismatches: object[], files: string[], stats: object, missingCities: string[]}}
 */
function readRecords(opts) {
  const o = opts || {};
  let files = fs.readdirSync(DIR).filter(n => DATA_FILE_RE.test(n) && n[0] !== '_').sort();
  if (o.files) files = files.filter(f => o.files.includes(f));

  const best = {};
  const mismatches = [];
  for (const f of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
    for (const p of (j.provinces || [])) {
      for (const c of (p.cities || [])) {
        if (c.mismatch && String(c.mismatch).trim()) {
          mismatches.push({ file: f, province: p.province, city: c.city, mismatch: String(c.mismatch).trim() });
        }
        if (!isFilled(c)) continue;
        const s = scoreOf(c);
        if (!best[c.city] || s > best[c.city].score) {
          best[c.city] = {
            city: c.city, province: p.province, file: f, score: s,
            status: c.status, urls: c.urls || [], officialDomain: c.officialDomain,
            docNumber: c.docNumber || '', confirms: String(c.confirms || ''),
          };
        }
      }
    }
  }

  const stats = { checked: 0, confirmed: 0, partial: 0, notFound: 0, urls: 0 };
  for (const n of Object.keys(best)) {
    const b = best[n];
    stats.checked++;
    if (b.status === 'official-confirmed') stats.confirmed++;
    else if (b.status === 'official-partial') stats.partial++;
    else stats.notFound++;
    stats.urls += b.urls.length;
  }

  /* 与内置 CITIES 比对，找出完全没记录的城 */
  let missingCities = [];
  try {
    const { loadCalculator } = require(path.join(ROOT, 'tools', 'calc-harness.js'));
    const A = loadCalculator();
    const all = Object.keys(A.CITIES).map(k => A.CITIES[k].name);
    stats.totalCities = all.length;
    missingCities = all.filter(n => !best[n]);
  } catch (e) { /* 无 CITIES 时跳过 */ }

  stats.mismatchCount = mismatches.length;
  return { best, mismatches, files, stats, missingCities };
}

module.exports = { readRecords, isFilled, scoreOf, STUB_RE, DATA_FILE_RE, MIN_SUBSTANTIVE_LEN, DIR, ROOT };
