'use strict';
/**
 * data-quality.js —— `docs/sources/*.json` 的**离线数据质量门禁 + 汇总物同步校验**
 *
 * ## 为什么需要它
 *
 * `tools/source-records.js` 早就能算出「覆盖多少城 / 已确认 / 部分 / 未找到 /
 * 收录多少链接 / 记录了多少不一致」，但这些指标一直没有进 CI——最该被守的
 * 数据质量反而没有门禁，只靠人记得跑。
 *
 * ## 能不能在 CI 里算
 *
 * 能，而且是**纯离线**：`docs/sources/*.json` 是已提交的快照，本脚本只读仓库内
 * 文件，不联网、不跑 npm install，Node 20/22/24 行为一致。因此可以进阻塞步骤，
 * 不会因外部站点超时导致 flaky。
 *
 * ## 阈值为什么不是 0
 *
 * 这些指标是**存量**而不是"错误数"：415 条 mismatch 是历史核查中"仓库原值与
 * 官方口径不一致、已记录并已更正"的日志，本身不是待修缺陷；337 城已全部有记录，
 * 其中 241 城 official-confirmed、93 城 official-partial、3 城官方未公开（历史结论）。
 * 直接设 0 会让所有正常的核查记录都变成红灯，门禁会立刻被绕过或被删。
 *
 * 所以采用**基线 + 防回归**：阈值 = 当前实测值，只拦变差的方向。
 * - 变大失败：partial / notFound / mismatchCount / missingCities / parseErrors
 * - 变小失败：files / checked / confirmed / urls
 * 任何一次指标变化都要在同一 PR 里改基线文件并说明原因，变更因此始终可审。
 *
 * ## 以后怎么逐步收紧
 *
 * - 每有一批 notFound 城市拿到官方件 → 下调 maxNotFound、上调 minConfirmed；
 * - 每有一批 partial 升为 confirmed → 下调 maxPartial、上调 minConfirmed；
 * - mismatchCount 只在新核查记录产生时上升，不允许无来源增长；
 * - 目标收敛顺序：missingCities 保持 0 → notFound 降到 0 → partial 逐年下降；
 *   每轮收紧都在基线文件 `tightening` 字段追加一行日期与数值，便于审计。
 *
 * ## `_summary.json` 为什么是生成物
 *
 * 历史原因：`_summary.json` 是手写收尾的汇总（覆盖率 + 不一致明细 + 各轮 note），
 * 2026-10-14 之后没有人再同步，于是顶层标量停在「79 文件 / mismatch 393」，
 * 与 `readRecords()` 实测的「106 文件 / 415」对不上——一个"没人维护的旧数字"。
 *
 * 现在改为：
 * - 顶层指标与 `mismatches` 全部由本脚本从 `docs/sources/*.json` 重新生成；
 * - 人工策展内容（`*Note`、`note`、`statsSource`、`permanentNotFound`）按 key 保留，
 *   不机械覆盖；
 * - 默认运行（即 CI 的 `node tools/data-quality.js`）同时校验磁盘 `_summary.json`
 *   是否与实际统计一致，不一致即失败 → 它不会再悄悄过期。
 *
 * ## 用法
 *
 *   node tools/data-quality.js            # 门禁 + _summary.json 同步校验（CI 用这个）
 *   node tools/data-quality.js --check    # 同上，显式写法
 *   node tools/data-quality.js --write    # 重新生成 docs/sources/_summary.json
 *
 * 退出码：0 = 全部指标在基线内且汇总物同步；1 = 越阈值 / 基线不可读 / 汇总物陈旧。
 */
const fs = require('fs');
const path = require('path');
const { readRecords, DATA_FILE_RE, DIR } = require('./source-records.js');

const ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'docs', 'sources', '_quality-baseline.json');
const SUMMARY_PATH = path.join(DIR, '_summary.json');

/** 汇总物里由脚本生成的字段（其余 key 视为人工内容，原样保留） */
const GENERATED_KEYS = [
  'generatedAt', 'checked', 'coverage', 'confirmed', 'partial', 'notFound', 'urls',
  'missingCities', 'mismatchCount', 'totalCities', 'files', 'mismatches',
];
/** 只参与同步校验的字段（generatedAt 是生成时间戳，必然随写入变化，不比对） */
const STAT_KEYS = GENERATED_KEYS.filter(k => k !== 'generatedAt');

function scanParseErrors() {
  const bad = [];
  for (const f of fs.readdirSync(DIR).filter(n => DATA_FILE_RE.test(n) && n[0] !== '_').sort()) {
    try { JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { bad.push(f + ': ' + e.message); }
  }
  return bad;
}

/** 从实测统计组装 `_summary.json`（人工字段从 existing 里按 key 保留） */
function buildSummary(r, existing, generatedAt) {
  const total = r.stats.totalCities || 0;
  const out = {
    generatedAt: generatedAt,
    checked: r.stats.checked,
    coverage: total ? (r.stats.checked / total * 100).toFixed(1) + '%' : '0.0%',
    confirmed: r.stats.confirmed,
    partial: r.stats.partial,
    notFound: r.stats.notFound,
    urls: r.stats.urls,
    missingCities: r.missingCities,
    mismatchCount: r.stats.mismatchCount,
    totalCities: total,
    files: r.files.length,
    /* 与历史字段名保持一致（prov，不是 province），避免已有的阅读习惯失效 */
    mismatches: r.mismatches.map(x => ({ file: x.file, prov: x.province, city: x.city, mismatch: x.mismatch })),
  };
  for (const k of Object.keys(existing || {})) {
    if (!GENERATED_KEYS.includes(k)) out[k] = existing[k];
  }
  return out;
}

/** 汇总物同步校验：逐字段比对，给出可读差异 */
function checkSummary(r) {
  if (!fs.existsSync(SUMMARY_PATH)) {
    console.log('  ✗ docs/sources/_summary.json 不存在 —— 请运行 node tools/data-quality.js --write 生成');
    return 1;
  }
  let onDisk;
  try {
    onDisk = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  } catch (e) {
    console.log('  ✗ docs/sources/_summary.json 不可解析：' + e.message);
    return 1;
  }
  const expect = buildSummary(r, onDisk, onDisk.generatedAt);
  const diffs = [];
  for (const k of STAT_KEYS) {
    const a = Array.isArray(expect[k]) ? JSON.stringify(expect[k]) : expect[k];
    const b = Array.isArray(onDisk[k]) ? JSON.stringify(onDisk[k]) : onDisk[k];
    if (a !== b) {
      const show = (v) => Array.isArray(v) ? `[${v.length} 条]` : JSON.stringify(v);
      diffs.push(`    ${k}：磁盘 ${show(onDisk[k])} vs 实测 ${show(expect[k])}`);
    }
  }
  if (!diffs.length) {
    console.log('  ✓ _summary.json 与实际统计一致（' + STAT_KEYS.length + ' 个字段）');
    return 0;
  }
  console.log('  ✗ _summary.json 与实际统计不一致（陈旧汇总物）：');
  for (const d of diffs) console.log(d);
  console.log('     请运行 node tools/data-quality.js --write 重新生成，并一并提交；不要手改这些字段。');
  return 1;
}

function writeSummary(r) {
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8')); } catch (e) { /* 无旧文件时只写生成字段 */ }
  const obj = buildSummary(r, existing, new Date().toISOString());
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log('已写入 docs/sources/_summary.json');
  console.log(`  ${obj.checked}/${obj.totalCities} 城 · confirmed ${obj.confirmed} · partial ${obj.partial} · notFound ${obj.notFound}`);
  console.log(`  文件 ${obj.files} · 链接 ${obj.urls} · 不一致 ${obj.mismatchCount}（明细 ${obj.mismatches.length} 条）`);
}

function main() {
  const args = process.argv.slice(2);
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (e) {
    console.log('✗ 基线不可读：docs/sources/_quality-baseline.json —— ' + e.message);
    process.exit(1);
    return;
  }
  const t = baseline.thresholds || {};
  const r = readRecords();
  const parseErrors = scanParseErrors();

  if (args.includes('--write')) {
    writeSummary(r);
    process.exit(0);
    return;
  }

  const m = {
    files: r.files.length,
    checked: r.stats.checked,
    totalCities: r.stats.totalCities || 0,
    confirmed: r.stats.confirmed,
    partial: r.stats.partial,
    notFound: r.stats.notFound,
    urls: r.stats.urls,
    mismatchCount: r.stats.mismatchCount,
    missingCities: r.missingCities.length,
    parseErrors: parseErrors.length,
  };

  const checks = [
    { k: 'files', dir: 'min', label: '源记录文件数' },
    { k: 'checked', dir: 'min', label: '已覆盖城市数' },
    { k: 'confirmed', dir: 'min', label: 'official-confirmed 城市数' },
    { k: 'urls', dir: 'min', label: '收录链接数' },
    { k: 'partial', dir: 'max', label: 'official-partial 城市数' },
    { k: 'notFound', dir: 'max', label: '官方未公开城市数' },
    { k: 'mismatchCount', dir: 'max', label: '已记录不一致条目数' },
    { k: 'missingCities', dir: 'max', label: '无任何记录的城市数' },
    { k: 'parseErrors', dir: 'max', label: 'JSON 解析失败文件数' },
  ];
  const LIMIT = {
    files: 'minFiles', checked: 'minChecked', confirmed: 'minConfirmed', urls: 'minUrls',
    partial: 'maxPartial', notFound: 'maxNotFound', mismatchCount: 'maxMismatch',
    missingCities: 'maxMissing', parseErrors: 'maxParseErrors',
  };

  console.log('数据质量门禁（离线，只读 docs/sources/*.json 快照）');
  console.log(`  基线：${baseline.generatedAt || '?'} · ${baseline.basis || ''}`);
  console.log(`  文件 ${m.files}（解析失败 ${m.parseErrors}） · 覆盖 ${m.checked}/${m.totalCities} 城 · 无记录 ${m.missingCities}`);
  console.log(`  confirmed ${m.confirmed} · partial ${m.partial} · notFound ${m.notFound}`);
  console.log(`  链接 ${m.urls} · 已记录不一致 ${m.mismatchCount}`);
  console.log('');

  let fail = 0;
  for (const c of checks) {
    const limit = t[LIMIT[c.k]];
    const val = m[c.k];
    if (typeof limit !== 'number') {
      console.log(`  ✗ ${c.label}：基线缺少 thresholds.${LIMIT[c.k]}（请补基线，不要在脚本里写死）`);
      fail++;
      continue;
    }
    const bad = c.dir === 'min' ? val < limit : val > limit;
    if (bad) {
      console.log(`  ✗ ${c.label}：${val} ${c.dir === 'min' ? '<' : '>'} 基线 ${limit}`);
      console.log(`     ${c.k} 越过阈值。若这是有意的数据变化，请同步更新 docs/sources/_quality-baseline.json 并在提交说明里写原因；否则先修数据。`);
      fail++;
    } else {
      const improved = c.dir === 'min' ? val > limit : val < limit;
      console.log(`  ✓ ${c.label}：${val}（基线 ${limit}）${improved ? ' — 指标改善，可收紧基线' : ''}`);
    }
  }
  if (parseErrors.length) {
    console.log('');
    for (const e of parseErrors) console.log('    解析失败：' + e);
  }

  console.log('');
  fail += checkSummary(r);

  console.log('');
  console.log('='.repeat(58));
  if (fail) {
    console.log(`数据质量门禁未通过：${fail} 项问题`);
    process.exit(1);
  }
  console.log('数据质量门禁通过');
  process.exit(0);
}

main();
