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
/* 同步睡眠：Atomics.wait 是 Node 里不引依赖的标准做法（本工具多处是同步流程） */
function sleepSync(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function curl(args, timeoutSec) {
  try {
    return execFileSync('curl.exe', ['-s', '--max-time', String(timeoutSec || 45)].concat(args),
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) { return (e.stdout || '') + ''; }
}
/* 搜索引擎要带浏览器 UA；**Jina 恰恰相反**——带浏览器 UA 会被判为爬虫并返回
   Cloudflare 挑战页（实测 5856 字符垃圾 vs 不带 UA 的 2044 字符正文），
   带 `agent-reach/1.0` 这类自定义 UA 则直接返回 0。
   这是排查了很久才定位的坑，所以两个 UA 分开。 */
const UA_BROWSER = UA;
function curlSearch(args, timeoutSec) { return curl(['-A', UA_BROWSER].concat(args), timeoutSec); }

/* ---------- 搜索 ---------- */
function brave(query) {
  const html = curlSearch(['-G', '--data-urlencode', 'q=' + query, 'https://search.brave.com/search']);
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
  const html = curlSearch(['-G', '--data-urlencode', 'q=' + query, 'https://lite.duckduckgo.com/lite/']);
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

/* ---------- 抓页 ----------
   先试 Jina Reader；**内容不可用**时自动兜底到本地 Chrome 无头。

   "不可用"有两种，都必须识别，否则会拿垃圾当正文：
     ① 返回空或过短（站点不被 Jina 支持）
     ② 返回反爬挑战页（Jina 被限流时会出现 Cloudflare 的 "Just a moment..."）
   实测教训：南京市公积金中心 Jina 返回 0 字符而 Chrome 能拿到全文；
   连续请求后 Jina 开始返回 5.8KB 的挑战页——只按长度判断会把它当正文，
   抽取结果全为空却不报错。 */
const BLOCK_PAGE = /Just a moment|Attention Required|Enable JavaScript and cookies|cf-browser-verification|安全验证|访问验证|请稍候|正在验证|人机验证/i;
function isUsablePage(text) {
  if (!text || text.length < 400) return false;
  return !BLOCK_PAGE.test(text.slice(0, 4000));
}
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
function fetchPage(url, timeoutSec) {
  /* Jina 连续请求会被限流并返回挑战页，所以每次调用前留间隔；
     被挑战时等更久重试一次，再不行才走 Chrome。 */
  const viaJina = (() => {
    for (const wait of [0, 9000]) {
      sleepSync(wait);
      const r = curl(['https://r.jina.ai/' + url], timeoutSec || 60);
      if (isUsablePage(r)) return r;
    }
    return '';
  })();
  if (viaJina) return viaJina;
  /* 兜底：本地 Chrome 无头。虚拟时间给足，否则拿到的是半渲染骨架。 */
  for (const budget of [15000, 25000]) {
    const dom = chromeDom(url, budget);
    if (dom && dom.length > 1000) {
      const text = htmlToText(dom);
      if (isUsablePage(text)) return '[via chrome-headless]\n' + text;
    }
  }
  /* 两条路都不通时如实说明，不要把挑战页当正文返回 */
  return '[FETCH-FAILED] ' + url + '\n（Jina 与本地 Chrome 均未取到可用内容，请换来源或稍后重试）';
}

/* ---------- 事实抽取（只做候选提示，不做判断） ---------- */
/* 数值候选：取 ≥1000 的数字，排除"2025年"这类年份——
   政策原文常写"不超过市统计局公布的2025年在岗职工月人均工资的3倍（42400元）"，
   按位置硬匹配会把年份当上限。改为"在同一句里取最大/最小"更稳。 */
function numbersIn(sentence) {
  const out = [];
  for (const m of sentence.matchAll(/([\d][\d,]{3,})(?!\s*年)/g)) {
    const v = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(v) && v >= 1000 && v <= 200000) out.push(v);
  }
  return out;
}
function extractFacts(text) {
  const clean = (s) => s.replace(/[,\s]/g, '');
  const num = (re) => { const m = text.match(re); return m ? clean(m[1]) : null; };
  const sentences = text.split(/[。；;\n]/);
  /* 优先选"同时含数字"的句子：政策文件里常有定义性表述
     （如"缴费工资高于上限的，以上限为缴费工资基数"）先出现且不含数值，
     只按关键词取第一句会拿到定义而不是标准。 */
  const pick = (kw) => sentences.find(s => kw.test(s) && numbersIn(s).length)
    || sentences.find(s => kw.test(s)) || '';
  const upper = pick(/上限|最高/), lower = pick(/下限|最低/);
  const uNums = numbersIn(upper), lNums = numbersIn(lower);
  return {
    下限: lNums.length ? String(Math.min.apply(null, lNums)) : null,
    上限: uNums.length ? String(Math.max.apply(null, uNums)) : null,
    上下限句: (upper || lower || '').trim().slice(0, 200),
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

module.exports = { brave, ddgLite, fetchPage, extractFacts, chromeDom, htmlToText, curl, sleep };
