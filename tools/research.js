#!/usr/bin/env node
/*
 * 联网核查工具 —— 城市社保/公积金数据的年度复核。
 *
 * 为什么需要它：`docs/maintenance-calendar.md` 的核查 SOP 第 1~2 步是"联网调研省级/市级参数"，
 * 但此前没有任何可复用的取数手段，每次都靠临时手搓。本工具把已验证可用的链路固化下来。
 *
 * 链路（2026-09 实测）：
 *   搜索 → Brave Search（curl 直取；DDG Lite 作补充）
 *   抓页 → Jina Reader（r.jina.ai，政府页面正文完整）
 *   兜底 → 本地 Chrome 无头（Jina 抓不到时）
 *
 * 已知不可用，不要浪费时间重试：
 *   · DSH 原生 web_search：无 API key
 *   · DSH 原生 web_fetch：沙箱拒绝（hostname resolves to a non-public IP）
 *   · agent-reach 的 Exa 搜索：mcporter 未安装
 *   · 百度：弹安全验证；Bing：RSS 查询被截断、无头结果错乱；搜狗：返回多为图片/新闻
 *
 * 用法：
 *   node tools/research.js search "江苏省 2026年度 社会保险 缴费基数 上下限"
 *   node tools/research.js fetch  <url>            # 抓正文（Jina）
 *   node tools/research.js facts  <url>            # 抓正文并抽取基数/文号
 *   node tools/research.js gov    "查询词"          # 只列政府域名结果
 *
 * 注意：本工具只做**取数与摘录**，不自动改数据。数值是否采纳由人判断——
 * 政策文件常有"暂按""待发布""不含生育"等限定语，机器识别不了。
 */
'use strict';
const { execFileSync } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function curl(args, timeoutSec) {
  try {
    return execFileSync('curl.exe', ['-s', '--max-time', String(timeoutSec || 45), '-A', UA].concat(args),
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) { return (e.stdout || '') + ''; }
}

/* ---------- 搜索 ---------- */
function brave(query) {
  const html = curl(['-G', '--data-urlencode', 'q=' + query, 'https://search.brave.com/search']);
  const out = [];
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const url = m[1];
    if (/brave\.com|w3\.org|schema\.org|gstatic|google\.|search\.brave/.test(url)) continue;
    if (out.some(o => o.url === url)) continue;
    out.push({ url });
  }
  return out;
}
function ddgLite(query) {
  const html = curl(['-G', '--data-urlencode', 'q=' + query, 'https://lite.duckduckgo.com/lite/']);
  const out = [];
  for (const m of html.matchAll(/uddg=([^&"]+)/g)) {
    try { const u = decodeURIComponent(m[1]); if (!out.some(o => o.url === u)) out.push({ url: u }); } catch (e) { }
  }
  return out;
}
/* 本地 Chrome 无头：Jina 抓不到时用。返回渲染后的 DOM。 */
function chromeDom(url, budgetMs) {
  try {
    return execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
      '--lang=zh-CN', '--virtual-time-budget=' + (budgetMs || 10000), '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return (e.stdout || '') + ''; }
}

/* ---------- 抓页 ---------- */
function fetchPage(url, timeoutSec) {
  return curl(['https://r.jina.ai/' + url], timeoutSec || 60);
}

/* ---------- 事实抽取（只做候选提示，不做判断） ---------- */
function extractFacts(text) {
  const clean = (s) => s.replace(/[,\s]/g, '');
  const num = (re) => { const m = text.match(re); return m ? clean(m[1]) : null; };
  return {
    下限: num(/(?:缴费基数|社保基数|公积金基数)?\s*下限[^\d]{0,12}([\d,]{4,})/),
    上限: num(/(?:缴费基数|社保基数|公积金基数)?\s*上限[^\d]{0,12}([\d,]{4,})/),
    区间: (text.match(/[\d,]{4,}(?:\.\d+)?\s*[~～至\-—]\s*[\d,]{4,}(?:\.\d+)?/g) || []).slice(0, 6),
    文号: (text.match(/[\u4e00-\u9fa5]{0,8}[〔\[]\s*20\d{2}\s*[〕\]]\s*\d+\s*号/g) || []).slice(0, 6),
    费率: (text.match(/(?:单位|个人)[^\d%]{0,8}(\d+(?:\.\d+)?)\s*%/g) || []).slice(0, 8),
    关键词: {
      缴费基数: /缴费基数/.test(text), 上下限: /上下限/.test(text),
      暂按: /暂按|暂执行|暂不调整/.test(text), 待发布: /待.{0,10}(发布|确定|公布)/.test(text),
      公积金: /公积金/.test(text), 医保: /医保|医疗保险/.test(text),
    },
  };
}

/* ---------- CLI ---------- */
const [, , cmd, ...rest] = process.argv;
const arg = rest.join(' ');

(async () => {
  if (cmd === 'search' || cmd === 'gov') {
    if (!arg) { console.log('用法: node tools/research.js search "查询词"'); process.exit(1); }
    let res = brave(arg);
    console.log(`Brave 结果 ${res.length} 条：`);
    res.slice(0, 12).forEach((r, i) => console.log(`  ${i + 1}. ${r.url}`));
    let gov = res.filter(r => /\.gov\.cn/.test(r.url));
    if (!gov.length) {
      await sleep(1500);
      const d = ddgLite(arg);
      console.log(`\nBrave 无政府域名，DDG Lite 补充 ${d.length} 条`);
      gov = d.filter(r => /\.gov\.cn/.test(r.url));
    }
    console.log(`\n政府域名 ${gov.length} 条：`);
    gov.slice(0, 10).forEach(r => console.log('  ' + r.url));
    if (cmd === 'gov') return;
    if (gov.length) {
      console.log('\n抓取第一个政府页面：');
      const body = fetchPage(gov[0].url);
      console.log(JSON.stringify(extractFacts(body), null, 2));
    }
  } else if (cmd === 'fetch' || cmd === 'facts') {
    if (!arg) { console.log('用法: node tools/research.js fetch <url>'); process.exit(1); }
    const body = fetchPage(arg);
    if (cmd === 'fetch') { console.log(body); return; }
    console.log(JSON.stringify(extractFacts(body), null, 2));
    const i = body.search(/缴费基数|公积金基数|单位费率/);
    if (i >= 0) console.log('\n上下文：\n' + body.slice(Math.max(0, i - 200), i + 600).replace(/\s+/g, ' '));
  } else {
    console.log('用法:');
    console.log('  node tools/research.js search "查询词"   # 搜索并抓第一个政府页面');
    console.log('  node tools/research.js gov    "查询词"   # 只列政府域名结果');
    console.log('  node tools/research.js fetch  <url>      # 抓正文');
    console.log('  node tools/research.js facts  <url>      # 抓正文并抽取基数/文号/费率');
  }
})();

module.exports = { brave, ddgLite, fetchPage, extractFacts, chromeDom, curl };
