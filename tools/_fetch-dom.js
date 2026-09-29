#!/usr/bin/env node
/* 临时辅助：用本地 Chrome 无头抓取 Jina 被 Cloudflare 拦截的政府页面。
 * 用法: node tools/_fetch-dom.js <url> [budgetMs]
 * 仅输出纯文本正文（去标签）。核查结束后可删除。 */
'use strict';
const { chromeDom } = require('./research.js');

const url = process.argv[2];
const budget = Number(process.argv[3] || 15000);

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|tr|li|h\d|br|td)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const dom = chromeDom(url, budget);
console.log('HTML_LEN=' + dom.length);
console.log(toText(dom));
