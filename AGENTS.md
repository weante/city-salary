# AGENTS.md — 城市工资计算规则（city-salary）

本文件为通用 Agent 指令，支持读取 AGENTS.md 的 Agent 工具（Codex、opencode、TRAE、WorkBuddy 等）可直接使用本仓库；需要交互式计算器时使用 `skills/city-salary/assets/calculator.html`（单文件 HTML，打开先选城市）。

本文件只保留**每次必读**的仓库约定、计算口径、交互要求与数据状态指针；337 城参数、分省费率与历年批次取证日志已移到 `skills/city-salary/references/`，按需查阅。

## 计算口径要点

38. **个税累计预扣预缴**：已就业月数 = 当前月 − 就业起始月 + 1；累计应纳税所得额 = 月薪×月数 − (五险一金+5000+专项附加+补充扣除)×月数 → 七级税率表（3%~45%）→ 当月个税 = 累计税额 − 上月累计税额。
39. **专项附加扣除**（勾选启用，自动填默认值：子女教育/婴幼儿照护2000、赡养老人1500、住房租金按城市标准；范围0~上限）：子女教育/婴幼儿照护二选一（2000/月/子女）、房贷利息(1000)与住房租金二选一（**租金按城市：北京/上海/广州/深圳1500/月，佛莞中珠惠汕湛茂揭清江肇潮梅阳韶1100/月，汕尾河源云浮800/月**）、继续教育400、赡养老人（独生3000/非独生≤1500）、**大病医疗年度80000（只在汇算清缴时扣，不进月度预扣；年度金额按全年12个月计并封顶80000，不随就业月数折算）**。
40. **年终奖单独计税**：奖金÷12找月均税率（3%~45%月表）→ 全额×税率−速算扣除；**临界值陷阱**：36000/144000/300000/420000/660000/960000，多1元少拿2309~88000元，命中必须警告。
41. **补充扣除**：税优健康险≤200/月、个人养老金≤1000/月、企业年金≤本人缴费工资计税基数的4%（模板以养老缴费基数计）。**这三项既减税、也是个人真实现金支出，算"到手现金"时必须扣出去**。

## 交互要求

- 用户给工资查询时：先确认城市，再追问缺失参数（月薪、基数是否等于工资、公积金比例、专项附加、年终奖、当前月份、深圳的户籍/医疗档次）
- 计算后主动提示：公积金比例提升收益、年终奖陷阱、未用扣除项、基数低于工资的影响

## 仓库约定与红线

- 数值唯一真源是 `skills/city-salary/assets/calculator.html` 的 `CITIES`；文档参数只维护 `skills/city-salary/references/city-parameters.md`，`AGENTS.md` 不再复制参数表。
- 改数值必须同步跑 `node tools/sync.js`、`node tools/test-calc.js`、`node tools/check-golden.js`、`node tools/check-dom.js`、`node tools/check-sync.js`、`node tools/test-export.js`；黄金快照禁止用 `--update` 造绿。
- 新增或修改城市参数：改 `CITIES` → 补 references 参数行/小节 → 跑 `check-sync` 的 B 项（按城市名逐格锚定）。
- 文档里的断言数、机制规模数字由 `check-sync` 的 C/D 项守卫，不要手写旧数字。
- 维护流程见 `CONTRIBUTING.md`，年度节奏见 `docs/maintenance-calendar.md`，安装说明见 `docs/INSTALL-*.md`。

## 数据状态摘要（指针）

- 各省数据年度（`dataYear`/`dataNext`）：`docs/baseline-year-map.md` §三 基线表，代码侧基线 `tools/province-year.js`。
- 限期费率与到期日：`skills/city-salary/references/city-parameters.md`，缺口清单 `docs/warn-backlog.md`。
- 一手件与复核记录：`docs/policy-*.md`、`docs/sources/README.md`。

## 按需查阅的 references

- [skills/city-salary/references/city-parameters.md](skills/city-salary/references/city-parameters.md)：337 城参数表、分省费率与口径、`CI()` / `CIU()` 扩展方法（安装到 skill 目录后，相对本文件为 `references/city-parameters.md`）。
- [skills/city-salary/references/agents-history.md](skills/city-salary/references/agents-history.md)：各批次核查日志、取证路径、反例与历史结论（安装到 skill 目录后，相对本文件为 `references/agents-history.md`）。
