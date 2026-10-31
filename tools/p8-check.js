/*
 * p8-check.js —— P8 巡检：珠海 / 东莞「2027 年度职工基本医疗保险缴费基数」件监测
 *
 * 用法：
 *   node tools/p8-check.js                 巡检两城关键栏目（默认）
 *   node tools/p8-check.js --wide          追加省级医保局与全省检索
 *   node tools/p8-check.js --out <file>    把报告写到文件（默认同时打印）
 *
 * 退出码（供定时提醒判断）：
 *   0 = 未命中（发文窗口未到，属正常）
 *   2 = 命中（出现 2027 年度职工医保基数件，需人工处理）
 *   1 = 取网失败（网络或接口异常，不等于「没有」）
 *
 * 命中判据（与第九十三批一致）：
 *   标题或正文同时含「2027」与「职工基本医疗保险缴费基数」/「职工医保缴费基数」/
 *   「医保缴费基数」，或命中文号「珠医保〔2026〕」「东医保〔2026〕」且执行期为 2027 年。
 *
 * 已知渠道（第九十三批逐一实查确认）：
 *   珠海市医疗保障局  https://zhsi.zhuhai.gov.cn/postmeta/i/<CAT>.json
 *        9090 政策法规 / 9088 政策解读 / 9082 通知公告
 *   珠海市人社局      https://zhrsj.zhuhai.gov.cn/postmeta/i/<CAT>.json
 *        6555 政策文件 / 6556 政策解读 / 6583 通知公告   ← 注意域名是 zhrsj 不是 zhsi
 *   东莞市医疗保障局  https://www.dg.gov.cn/ylbzj/postmeta/g/<classifyId>_<page>.json
 *        3321 政策 / 3322 政策法规 / 3334 其他 / 3335 通知公告
 *   东莞市人社局      http://dghrss.dg.gov.cn/gkmlpt/api/all/<cat>?page=1&sid=769035
 *        453 通知公告 / 432 规范性文件 / 446 统计信息
 *   广东省医保局      https://hsa.gd.gov.cn/zwgk/zcfg/index.html（15 页）
 *   广东省统一搜索    https://search.gd.gov.cn/jsonp/...
 *
 * 本脚本只用 Node 内置模块，符合 tools/ci-selfcheck.js 第 3 条（不得 require 第三方包）。
 */
'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const zlib = require('zlib');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const out = [];
function log(s) { out.push(String(s)); }

/* ---------- HTTP ---------- */
function get(url, redirects) {
  redirects = redirects || 0;
  return new Promise(function (resolve) {
    if (redirects > 5) { resolve({ status: 0, body: '' }); return; }
    const mod = url.indexOf('https:') === 0 ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Encoding': 'gzip, deflate' },
      rejectUnauthorized: false,
      timeout: 60000
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        get(res.headers.location, redirects + 1).then(resolve);
        return;
      }
      const chunks = [];
      let stream = res;
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      stream.on('data', function (c) { chunks.push(c); });
      stream.on('end', function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
      stream.on('error', function () { resolve({ status: res.statusCode || 0, body: '' }); });
    });
    req.on('timeout', function () { req.destroy(); resolve({ status: 0, body: '' }); });
    req.on('error', function () { resolve({ status: 0, body: '' }); });
  });
}

/* ---------- 命中判据 ---------- */
const RE_YEAR = /2027/;
const RE_SUBJ = /职工基本医疗保险缴费基数|职工医保缴费基数|职工基本医疗保险.{0,8}缴费基数|医保缴费基数/;
const RE_DOCNO = /(珠医保|东医保)〔2026〕/;
const RE_PERIOD = /2027[-年]0?1[-月]0?1|2027\s*年\s*1\s*月\s*1\s*日/;
/* 居民医保个人筹资标准 ≠ 职工医保缴费基数上下限（第九十二批记录的易误判点）：
   珠医保〔2026〕35号「2027 年珠海市城乡居民基本医疗保险个人缴费标准」即属此类。 */
const RE_RESIDENT = /城乡居民|个人缴费标准|个人筹资标准|学生和未成年人|非从业居民/;

function judge(title, content) {
  const t = title || '', c = content || '';
  if (RE_RESIDENT.test(t) || RE_RESIDENT.test(c.slice(0, 300))) return '';
  if (RE_YEAR.test(t) && RE_SUBJ.test(t)) return 'TITLE';
  if (RE_YEAR.test(c) && RE_SUBJ.test(c)) return 'CONTENT';
  if (RE_DOCNO.test(t) && RE_YEAR.test(t + ' ' + c)) return 'DOCNO';
  if (RE_SUBJ.test(t) && RE_PERIOD.test(c)) return 'PERIOD';
  return '';
}

/* ---------- 通用字段清洗 ---------- */
function fmtDate(v) {
  if (!v) return '';
  if (typeof v === 'number' || /^\d{9,}$/.test(String(v))) {
    const d = new Date(Number(v) * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}
function cleanText(s) {
  return String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
}
function pick(a) {
  return {
    title: cleanText(a.title || a.name || ''),
    content: cleanText(a.content || a.abstract || a.description || a.digest || ''),
    url: a.url || a.link || '',
    date: fmtDate(a.publish_time || a.pub_time || a.publishTime || a.date || '')
  };
}

/* ---------- 各渠道抽取 ---------- */
function fromZhPostmeta(cat) {
  return get('https://zhsi.zhuhai.gov.cn/postmeta/i/' + cat + '.json').then(function (r) {
    if (!r.status || !r.body) return { cat: cat, items: [], err: 'HTTP ' + r.status };
    let j;
    try { j = JSON.parse(r.body); } catch (e) { return { cat: cat, items: [], err: 'JSON parse fail' }; }
    const arr = j.articles || j.data || j.list || (Array.isArray(j) ? j : []);
    return { cat: cat, items: arr.map(pick) };
  });
}
function fromZhrsjPostmeta(cat) {
  return get('https://zhrsj.zhuhai.gov.cn/postmeta/i/' + cat + '.json').then(function (r) {
    if (!r.status || !r.body) return { cat: cat, items: [], err: 'HTTP ' + r.status };
    let j;
    try { j = JSON.parse(r.body); } catch (e) { return { cat: cat, items: [], err: 'JSON parse fail' }; }
    const arr = j.articles || j.data || j.list || (Array.isArray(j) ? j : []);
    return { cat: cat, items: arr.map(pick) };
  });
}
function fromDgPostmeta(cat) {
  return get('https://www.dg.gov.cn/ylbzj/postmeta/g/' + cat + '_1.json').then(function (r) {
    if (!r.status || !r.body) return { cat: cat, items: [], err: 'HTTP ' + r.status };
    let j;
    try { j = JSON.parse(r.body); } catch (e) { return { cat: cat, items: [], err: 'JSON parse fail' }; }
    const arr = j.articles || j.data || j.list || (Array.isArray(j) ? j : []);
    return { cat: cat, items: arr.map(pick) };
  });
}
function fromDgHrss(cat) {
  return get('http://dghrss.dg.gov.cn/gkmlpt/api/all/' + cat + '?page=1&sid=769035').then(function (r) {
    if (!r.status || !r.body) return { cat: cat, items: [], err: 'HTTP ' + r.status };
    let j;
    try { j = JSON.parse(r.body); } catch (e) { return { cat: cat, items: [], err: 'JSON parse fail' }; }
    const arr = j.data || j.articles || j.list || (Array.isArray(j) ? j : []);
    return { cat: cat, items: arr.map(pick) };
  });
}
/* 广东省统一搜索：全省端点返回纯 JSON，content 是 URL 回显（只能定位 URL） */
function gdAll(kw) {
  const url = 'https://search.gd.gov.cn/jsonp/search/all?callback=cb&site_id=553612&keywords=' +
    encodeURIComponent(kw) + '&range=province&pagesize=30&sort=time&position=all&page=1';
  return get(url).then(function (r) {
    if (!r.status || !r.body) return { kw: kw, items: [], err: 'HTTP ' + r.status };
    let body = r.body.trim();
    if (body.indexOf('cb(') === 0) body = body.slice(body.indexOf('(') + 1, body.lastIndexOf(')'));
    let j;
    try { j = JSON.parse(body); } catch (e) { return { kw: kw, items: [], err: 'JSON parse fail' }; }
    const list = (j.data && j.data.news && j.data.news.list) || [];
    return { kw: kw, items: list.map(pick) };
  });
}
/* 省医保局政策文件栏目（15 页）—— 注意必须把各页结果合并成单个 {items} */
function hsaZcfg() {
  const pages = [];
  for (let i = 1; i <= 15; i++) {
    pages.push(i === 1 ? 'https://hsa.gd.gov.cn/zwgk/zcfg/index.html' : 'https://hsa.gd.gov.cn/zwgk/zcfg/index_' + i + '.html');
  }
  return Promise.all(pages.map(function (u) {
    return get(u).then(function (r) {
      const items = [];
      if (r.status && r.body) {
        const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(r.body)) !== null) {
          const t = cleanText(m[2]);
          if (t.length > 4) items.push({ title: t, content: '', url: m[1], date: '' });
        }
      }
      return { u: u, status: r.status, items: items };
    });
  })).then(function (pagesRes) {
    const all = [];
    let bad = 0;
    pagesRes.forEach(function (p) {
      if (!p.status) bad++;
      p.items.forEach(function (i) { all.push(i); });
    });
    return { cat: 'zcfg', items: all, err: bad ? (bad + ' 页取网失败') : '' };
  });
}

/* ---------- 主流程 ---------- */
function main() {
  const argv = process.argv.slice(2);
  const wide = argv.indexOf('--wide') >= 0;
  const outIdx = argv.indexOf('--out');
  const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;

  log('P8 巡检 —— 珠海 / 东莞 2027 年度职工基本医疗保险缴费基数件');
  log('时间：' + new Date().toISOString());
  log('');

  const tasks = [];
  [['珠海市医保局', fromZhPostmeta, ['9090', '9088', '9082']], ['珠海市人社局', fromZhrsjPostmeta, ['6555', '6556', '6583']],
   ['东莞市医保局', fromDgPostmeta, ['3322', '3335', '3334', '3321']], ['东莞市人社局', fromDgHrss, ['453', '432', '446']]
  ].forEach(function (t) {
    t[2].forEach(function (c) { tasks.push({ label: t[0], cat: c, fn: t[1] }); });
  });
  const kws = ['2027年职工基本医疗保险缴费基数', '2027年度职工医保缴费基数'];
  if (wide) kws.forEach(function (k) { tasks.push({ label: '全省检索', kw: k, fn: gdAll }); });
  tasks.push({ label: '广东省医保局', fn: hsaZcfg });

  let errs = 0;
  const hits = [];

  return Promise.all(tasks.map(function (t) {
    return t.fn(t.cat || t.kw).then(function (res) {
      const items = res.items || [];
      const err = res.err;
      const tag = t.label + (t.cat ? '/' + t.cat : (t.kw ? '「' + t.kw + '」' : ''));
      if (err) { errs++; log('  ✗ ' + tag + ' 取网失败（' + err + '）'); return; }
      let newest = '';
      items.forEach(function (it) {
        if (it.date && (!newest || it.date > newest)) newest = it.date;
      });
      log('  · ' + tag + ' 条目 ' + items.length + (newest ? '，最新日期 ' + newest : ''));
      items.forEach(function (it) {
        const why = judge(it.title, it.content);
        if (why) {
          hits.push({ where: tag, why: why, title: it.title, url: it.url, date: it.date });
          log('      ★ 命中[' + why + '] ' + (it.date || '') + ' ' + it.title + '  ' + it.url);
        }
      });
    });
  })).then(function () {
    log('');
    if (errs) log('⚠ 有 ' + errs + ' 个渠道取网失败 —— 不等于「没有」，请重跑。');
    log(hits.length ? ('★ 共 ' + hits.length + ' 处命中，需人工处理。') : '未命中 2027 年度职工医保基数件（发文窗口未到，属正常）。');
    const text = out.join('\n');
    if (outFile) {
      try { fs.writeFileSync(outFile, text, 'utf8'); } catch (e) { log('（写文件失败：' + e.message + '）'); }
    }
    console.log(text);
    process.exit(hits.length ? 2 : (errs ? 1 : 0));
  });
}

main();
