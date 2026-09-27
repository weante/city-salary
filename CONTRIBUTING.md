# 维护手册（CONTRIBUTING）

本文档面向要改这个仓库的人（包括几个月后的你自己）。它回答三个问题：**改了东西要跑什么**、**守卫各自在守什么**、**两类最常见的改动怎么做才不会被拦下**。

---

## 一、先记住一件事：源文件只有两份

| 角色 | 路径 |
|------|------|
| ★ **源** | `skills/city-salary/assets/calculator.html` |
| ★ **源** | `skills/city-salary/SKILL.md` |
| 镜像 | `site/index.html` |
| 镜像 | `SKILL.md`（仓库根，便于 GitHub 直接阅读） |

镜像**一律由脚本生成**，不要手改：

```bash
node tools/sync.js        # 源 → 镜像
```

改了源却没同步，`check-sync` 的 A 检查会逐字节比对并报错。**CI 里刻意不跑 `sync.js`** —— 它会把镜像"修好"，反而掩盖"改了源忘了同步"的漂移。

---

## 二、改完要跑什么

```bash
npm test                  # 一次跑完下面四项（零依赖，无需 npm install）
node tools/test-calc.js   # 6600+ 项计算断言
node tools/check-dom.js   # 单文件 HTML 的静态结构
node tools/check-sync.js  # 漂移检查 A–F
node tools/test-export.js # 导出 PDF 降级链
node tools/ci-selfcheck.js # 零依赖红线自检
node tools/sync.js        # 同步镜像（改完 skills/ 之后）
```

典型顺序：`改源文件` → `sync.js` → `test-calc.js` → `check-dom.js` → `check-sync.js` → `test-export.js`。

---

## 三、守卫在守什么

### `check-sync.js`：漂移检查（六项）

| 检查 | 断言 | 什么时候会红 |
|------|------|-------------|
| **A** 镜像一致性 | 源与镜像**逐字节**相同 | 改了源忘了跑 `sync.js` |
| **B** 城市参数锚定 | 337 城的医保/公积金基数**挂在对的城市名下** | 数值写错、抄到相邻城市、新增城市忘了写文档 |
| **C** 陈旧表述 | 17+ 份文档里没有已被取代的措辞 | 城市数、时效机制等改版后漏改某份文档 |
| **D** 文档断言数 | 文档里写的断言数 = `test-calc.js` 实际输出 | 加了断言没改文档 |
| **E** 省份年度口径 | 每城 `dataYear`/`dataNext` 与 `tools/province-year.js` 基线表一致 | 新增省份只覆盖 `region` 没覆盖 `dataYear`；年度滚动漏更新 |
| **F** 数据状态表年度 | `SKILL.md`「数据状态」表的年度列与基线表一致 | 改了 `CITIES.dataYear` 但漏改这张表 |

#### B 的两档判据（值得单独理解）

历史上 B 只做 `content.indexOf(数值)` —— 只问"这个数字有没有在文档里出现过"，不问它挂在哪座城市名下。**某市数值被错抄到相邻城市段落，检查照样通过。**

现在按城市名锚定，分两档：

1. **表格逐格比对**（最强）：`SKILL.md` 里那张 `| 城市 | 医保费率 | 医保基数下限 | 医保基数上限 | 公积金下限 | 公积金上限 |` 表，若某城在其中，就逐格与代码比对。数值被写到相邻行会立刻暴露。
2. **散文锚定**：其余城市走散文。
   - **公积金**值必须在「**该城市名之后、下一个城市名之前**」的片段内（公积金基数一律城市专属）；
   - **医保**值放宽到「含该城市名的**任一行**内」——因为很多省是省级统一基数，值写在省名附近而不是市名后面。

数值比较用的是 **token 集合**而非子串：文档写 `5901.40` 而代码是 `5901.4` 时子串匹配会漏；反过来 `2330` 也不会再被 `12330` 误伤。

> 新增省份时，如果能顺手把该省城市补进上面那张表，B 的判据就从"散文锚定"升级为"逐格比对"——这是最划算的加固方式。

### `test-calc.js`：计算回归

做法是**从 `calculator.html` 里抽取真实的 `<script>` 放到最小 DOM 桩上执行** —— 测的是真正会跑在用户浏览器里的那份代码，而不是测试里重写一遍的副本。

它同时是 `check-sync` D 检查的数据源：被 `require` 时**静默**跑完整套断言，导出 `{ pass, fail, failures }`。因此有一条硬约定：

> **`test-calc.js` 里不允许出现裸 `console.log`**，所有输出必须走 `emit()`。否则被 require 时会把测试日志混进 `check-sync` 的 stdout。`tools/ci-selfcheck.js` 第 5 项守着这条。

---

## 四、两类最常见的改动

### A. 新增/修改一个城市

1. 在 `calculator.html` 的 `CITIES` 里按工厂格式加一行（`CI()` 广东型 / `CIU()` 直辖市型；省内差异用 `opt` 浅覆盖，如 `opt.med`）。
2. **`opt` 里必须显式写 `region` 与 `dataYear`**（省级年度见 `tools/province-year.js`）。漏写 `dataYear` 会让页脚显示错误年度——这正是 E 检查存在的原因。
3. 同步文档（缺一即被 B/C 拦下）：
   - `AGENTS.md`：省份规则行 + 第 1 条城市清单
   - `skills/city-salary/SKILL.md`：城市清单、省份小节的年度标题、参数表（若能，优先补进表格）
   - `README.md`：首段城市数、城市清单、数据说明
   - 数据来源写进 `docs/policy-<省拼音>-<年度>.md`，查不到的写"未找到"并标 `warn`
4. `test-calc.js`：更新城市总数断言 + 该省 ≥3 条参数抽查
5. 跑第二节的全套命令

### B. 年度基数更新（每年 1 月 / 7 月）

1. **先改基线表** `tools/province-year.js`（它是 E/F 的唯一事实来源），同步更新 `docs/baseline-year-map.md`
2. 改 `calculator.html` 里受影响的 `CITIES` 条目（含 `dataYear` / `dataNext`）
3. 改 `AGENTS.md` 与 `SKILL.md` 的参数行**与年度标题**，以及 `SKILL.md`「数据状态」表的年度列（F 检查）
4. 跑第二节全套命令

> **`dataNext` 语义**：下一个尚未公布的年度，页脚渲染为「（N 年度待公布）」。若 `dataYear` 已经是跨年写法（如 `2025-2026`），`dataNext` 应为 `null` —— 年度已经跨到那一年，再提示"待公布"会自相矛盾。

---

## 五、两个容易踩的坑

### 1. 不要原样引用"旧措辞"当反面例子

`check-sync` 的 C 检查会拦截若干**已被取代的字符串**（旧城市数、旧的年度分组写法等）。写文档时哪怕是为了举例，也不要把它们原样粘进去 —— 会被自己的守卫拦下。描述问题请改写措辞。

### 2. 新增守卫后要验证它**真的会红**

一个永远绿色的守卫等于没有守卫。仓库里每次加固守卫，都同时做过"故意破坏实验"：把修复还原回去，确认对应检查确实失败。新增守卫时请照做，并在提交信息里写明实验结论。

---

## 六、零依赖红线

本仓库的立身之本是**单文件 HTML + 零依赖 Node 脚本**。`tools/ci-selfcheck.js` 会把这条约定变成可执行的守卫：

- 禁止 `package.json` 声明任何依赖
- 禁止 `scripts` 里出现 `npm install` / `npx` / `yarn` / `pnpm`
- 禁止 `tools/` 下 `require` 第三方包
- 校验 Node 版本满足 `engines`

CI 里**不执行 `npm install`**。若某个改动需要引入依赖，那不只是一个技术选择，而是要把这个项目的核心优势换掉 —— 请在 PR 描述里单独论证。

---

## 七、CI

`.github/workflows/ci.yml` 在 push / PR 时按 Node 18/20/22 三个版本跑完整守卫链。本地跑通不代表 CI 会绿（少数差异来自换行符与路径），所以推送后请确认 CI 状态。

仓库用 `.gitattributes` 统一换行符为 LF（本机 `core.autocrlf=true` 会把检出改成 CRLF，与 Linux CI 不一致，会让比对类守卫的输入不可复现）。
