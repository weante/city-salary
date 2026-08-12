# 安装到 OpenAI Codex

Codex（CLI 与云端）通过项目根目录的 **AGENTS.md** 加载规则，本仓库已内置。

## 方式一：clone 后直接使用（推荐）

```bash
git clone https://github.com/weante/city-salary.git
cd city-salary
codex "我月薪 12000，广州，社保公积金按最低基数，公积金 5%，到手多少？"
```

Codex 会自动读取仓库根的 `AGENTS.md`，获得全部计算规则与参数表。

## 方式二：合并到现有项目

将本仓库的 `AGENTS.md` 内容合并进你的项目根 `AGENTS.md`（或整体复制覆盖），再把 `skills/` 目录一并放进项目：

```bash
cp -r city-salary/AGENTS.md city-salary/skills <你的项目目录>/
```

## 验证

在项目目录运行 `codex`，询问任一内置城市的工资计算（如广州月薪 12000 最低基数），确认回复中按 AGENTS.md 的参数计算。

> 提示：Codex 不支持交互式 HTML 渲染，本 skill 在 Codex 中以"规则计算 + 自然语言明细"方式工作；如需可视化，用浏览器直接打开 `skills/city-salary/assets/calculator.html`。
