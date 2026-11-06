# 安全政策

## 这个项目处理什么数据

city-salary 的**交付物**是一个纯本地、零依赖的单文件 HTML 计算器：

- **单文件 HTML**（`skills/city-salary/assets/calculator.html`），打开即用
- 计算器本身**不联网、不上传、不收集任何数据**
- 计算全部在浏览器本地完成
- 输入内容（月薪、专项附加扣除等）**不落盘、不外发**

但仓库里的 `tools/` 脚本**并非全部离线**，必须按脚本分类看待。

### 纯离线脚本（只读仓库内文件）

| 脚本 | 用途 |
|------|------|
| `test-calc.js` / `check-golden.js` / `check-dom.js` / `test-export.js` / `e2e-smoke.js` / `check-jsdoc.js` | 计算回归、黄金快照、DOM 结构、导出降级链、最小离线 E2E（DOM 桩，无浏览器）、JSDoc 结构检查 |
| `check-sync.js` | 镜像 / 生成物 / 陈旧表述 / 年度口径等漂移检查 |
| `gen-city-params.js` | 由 `CITIES` 重建 `data/cities.json`、生成参数表 |
| `data-quality.js` / `source-records.js` | 离线统计 `docs/sources/*.json` 快照并做基线门禁 |
| `sync.js` / `ci-selfcheck.js` / `calc-harness.js` | 镜像同步、零依赖自检、计算器加载 |
| `gen-params.js` / `gen-warn-backlog.js` / `policy-expiry.js` / `province-year.js` | 文档生成与年度/限期清单核对 |

这些脚本只 `require` Node 内置模块并读取仓库内文件，**不发起网络请求**。

### 会联网的脚本（不进 CI）

| 脚本 | 网络行为 | 边界 |
|------|----------|------|
| `research.js` | 通过 `curl` 调用 Brave Search / Jina Reader（可选 Chrome headless），**会把检索关键词发给第三方服务** | 仅供人工核查取素材；输出不入库、不参与构建 |
| `p8-check.js` | 直接 `http/https` 抓珠海、东莞、广东省医保局栏目与全省检索 | 只读公开页面、不带凭证；**默认开启 TLS 证书校验**；证书异常时显式失败并打印 Node 错误码与站点，不静默降级；`--insecure` 是显式开关（默认关闭），启用时日志首行警告，结果只能用于定位证书问题，不得作为权威数据结论或据此改动 `CITIES` |

### CI 是否需要网络

**不需要。** `.github/workflows/ci.yml` 的 `guards` job 在 Node 20/22/24 矩阵里只跑离线脚本。
新增的 `node tools/data-quality.js` 只读已提交的 `docs/sources/*.json` 快照与
`docs/sources/_quality-baseline.json` 基线，零网络请求，不会因外部站点超时导致 flaky。
两个联网脚本不在 CI 中，只能由维护者在本机手动执行或放进独立的定时任务。

### 可复现性边界

- **离线脚本**：同一提交、同一 Node 版本，结果确定；黄金快照逐字节比对。
- **联网脚本**：受目标站点可用性、证书配置、反爬与限流影响，**不可复现**；
  其输出只用于人工核查，不得直接写回 `CITIES`。任何数据改动都必须附带已提交的
  来源快照（`docs/sources/*.json`）与核查记录，再由离线门禁校验。

## 数据准确性不是安全问题

本项目的核心风险是**政策数据过期或错误**，导致用户算错工资或个税。
**这属于正确性问题，不属于安全漏洞**，请按下面的「数据问题」渠道报告。

## 报告漏洞

如果你发现安全问题，请**通过 GitHub 私有渠道报告**：

1. 打开 <https://github.com/weante/city-salary/security/advisories/new>
   （GitHub Security Advisory，仅维护者可见）
2. 或发邮件给仓库维护者（见 GitHub 个人主页）

**请勿在公开 Issue 中披露未修复的安全问题。**

报告时请尽量包含：

- 问题类型与影响范围
- 复现步骤（最小可复现示例）
- 受影响的文件与版本/提交号
- 你建议的修复方向（如有）

**我们会在 7 天内确认收到，并在评估后告知处理计划。**

## 报告数据问题（更常见）

政策数据错误、基数过期、费率有误等，请走**普通 Issue**，
并附上**官方来源链接**（`.gov.cn` 或经确认的政府/事业单位官网）。

本项目对数据来源的判定标准与核查方法见
[`docs/sources/README.md`](docs/sources/README.md)，其中记录了：

- **四关复核流程**：① 口径对不对（企业 vs 机关事业）→ ② 生效了没有 →
  ③ 数字有没有歧义 → ④ 来源是不是官方
- **五种常见误判**：口径误判 / 推测当结论 / 时效性误判 /
  来源不可达却给数 / 用转述的基数做算式

## 支持的版本

本项目为持续更新的数据型项目，**只维护 `main` 分支的最新版本**。
历史提交的数据可能已过期（政策每年调整），**请勿基于旧版本做决策**。

## 数据时效

- 每年 **1 月**：核查医保/生育费率与基数
- 每年 **7 月**：核查养老/失业/工伤/公积金基数
- **限期费率文件按各自到期日单独触发**（如上海医保 9%，有效期至 2027-02-28）

完整检查点见 [`docs/maintenance-calendar.md`](docs/maintenance-calendar.md)。
