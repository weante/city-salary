# 安装到 WorkBuddy

WorkBuddy 支持基于 **AGENTS.md** 的项目指令与 Agent Skills 导入机制。

## 方式一：clone 项目直接使用

```bash
git clone https://github.com/weante/city-salary.git
```

将仓库目录挂载/导入 WorkBuddy 后，在会话中直接询问工资计算，WorkBuddy 会读取 `AGENTS.md` 中的完整规则。

## 方式二：合并到现有项目

```bash
cp city-salary/AGENTS.md <你的项目>/
cp -r city-salary/skills <你的项目>/
```

## 方式三：Skills 导入（如版本支持）

把 `skills/city-salary/`（含 SKILL.md 与 assets/calculator.html）按 WorkBuddy 的 Skills 导入流程安装，可获得完整的交互式计算器界面。

## 验证

会话中询问：“我月薪 8000，中山，公积金 5%，到手多少？”确认按中山参数（医保 4250~21250、5.8%）计算。

> 说明：WorkBuddy 具体版本的 Skills 导入路径以官方文档为准；AGENTS.md 方式在所有版本通用。
