# city-salary · 城市工资计算器（Agent Skill）

一个开箱即用的**按城市计算工资**的 Agent Skill：社保、公积金、个人所得税、年终奖、历史明细与趋势图，打开先选城市，按当地政策实时计算。已内置 **广东省 21 个地级市**参数，可扩展全国地市。

同时兼容多种 Agent 工具（Claude Code / Codex / opencode / TRAE / WorkBuddy 等），既可作为 **Agent Skills（SKILL.md）** 安装，也可作为项目指令（**AGENTS.md**）使用。

## 功能

- **城市选择**：打开计算器强制选择城市（深圳/广州/东莞/佛山/珠海/惠州/江门/中山/汕头/韶关/湛江/肇庆/茂名/梅州/汕尾/河源/阳江/清远/潮州/揭阳/云浮），各市参数独立，切换即生效
- **单月计算**：税前工资 → 五险（养老/医疗/失业/生育/工伤，基数各自独立可调）→ 公积金（0 或 5%~12%）→ 个税（累计预扣预缴）→ 税后实发；支持七项专项附加扣除（勾选启用、强制上限、互斥二选一）、税优健康险/个人养老金/企业年金年度抵扣
- **年终奖**：单独计税 + 六个临界值陷阱速查（36000/144000/300000/420000/660000/960000），命中自动警告
- **历史明细**：逐月可调工资与基数，按累计预扣计算每月个税；当前月后自动生成预测月份（虚线显示）；累计汇总 + 可筛选系列的趋势图（SVG 折线、双侧坐标轴、悬停高亮）；一键导出 PDF
- **数据时效**：内置核查机制，每年 7 月 15 日后自动提示联网核对各地基数

## 安装到各 Agent 工具

| 工具 | 安装方式 | 文档 |
|------|---------|------|
| Claude Code | Skills 目录：`~/.claude/skills/city-salary/` | [INSTALL-claude.md](docs/INSTALL-claude.md) |
| OpenAI Codex | 项目根放 `AGENTS.md`（已提供） | [INSTALL-codex.md](docs/INSTALL-codex.md) |
| opencode | 项目根放 `AGENTS.md` | [INSTALL-opencode.md](docs/INSTALL-opencode.md) |
| TRAE | 项目根放 `AGENTS.md` 或规则导入 | [INSTALL-trae.md](docs/INSTALL-trae.md) |
| WorkBuddy | 项目根放 `AGENTS.md` + Skills 导入 | [INSTALL-workbuddy.md](docs/INSTALL-workbuddy.md) |

## 仓库结构

```
city-salary/
├── SKILL.md                 # Anthropic Agent Skills 标准格式（根级）
├── AGENTS.md                # 通用 Agent 项目指令（Codex/opencode/TRAE 等读取）
├── skills/
│   └── city-salary/
│       ├── SKILL.md         # 标准 skill 布局，Claude Code 可直接使用
│       └── assets/
│           └── calculator.html  # 完整交互式计算器（单文件 HTML）
└── docs/                    # 各工具安装文档
```

## 使用示例

对话中直接说：

- “我月薪 7500，深圳，社保公积金基数 6750，公积金 5%，非独生赡养老人，到手多少？”
- “年终奖 15 万要交多少税？”
- “打开工资计算器，选广州”

Agent 会自动提取参数、追问缺失项、按所选城市政策计算并主动提示优化空间（公积金比例提升、年终奖陷阱、未用扣除项等）。

## 扩展全国地市

在 `skills/city-salary/assets/calculator.html` 的 `CITIES` 对象中按 `CI()` 工厂格式新增一行参数，并在 `SKILL.md` 参数表补一行即可：

```js
CITIES.城市key = CI("城市名",
  {min:医保下限, max:医保上限, comp:单位费率, emp:个人费率},
  生育参数(null 表示并入医保), {min:公积金下限, max:公积金上限},
  养老下限(默认4775), {note:"数据说明"});
```

## 数据说明

- 数据年度：2025-2026 年度，2026-08-12 联网核查（广东 2026 年 7 月基数未调整）
- 每年 7 月 15 日后需重新联网核查各地基数
- 湛江/肇庆/河源医保单位费率为第三方参考值，揭阳为官方文件（揭医保〔2025〕67号 / 揭府规〔2022〕6号），模板内均已标注

## License

MIT
