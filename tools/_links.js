#!/usr/bin/env node
/* 临时辅助：列出页面上的链接（标题 + href）。核查结束后可删除。
 * 用法: node tools/_links.js <url> [budgetMs] [过滤正则] */
'use strict';
const { chromeDom } = require('./research.js');

const url = process.argv[2];
const budget = Number(process.argv[3] || 15000);
const filter = process.argv[4] ? new RegExp(process.argv[4]) : null;

const dom = chromeDom(url, budget);
console.log('HTML_LEN=' + dom.length);
const seen = new Set();
for (const m of dom.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
  const href = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) continue;
  if (filter && !filter.test(text) && !filter.test(href)) continue;
  const key = href + '|' + text;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`${text}  ->  ${href}`);
}
