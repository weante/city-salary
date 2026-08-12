# 安装到 Claude Code

city-salary 采用 **Anthropic Agent Skills 标准格式**（目录 + SKILL.md），Claude Code 原生支持。

## 方式一：克隆后软链接（推荐）

```bash
git clone https://github.com/weante/city-salary.git
mkdir -p ~/.claude/skills
ln -sf "$(pwd)/city-salary/skills/city-salary" ~/.claude/skills/city-salary
```

Windows（PowerShell，管理员或开发模式）:

```powershell
git clone https://github.com/weante/city-salary.git
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\skills\city-salary" -Target "$pwd\city-salary\skills\city-salary"
```

## 方式二：直接复制（跨平台通用）

```bash
git clone https://github.com/weante/city-salary.git
mkdir -p ~/.claude/skills
cp -r city-salary/skills/city-salary ~/.claude/skills/
```

## 方式三：仅单个项目使用

把仓库 `skills/city-salary/` 目录复制到你的项目下 `.claude/skills/city-salary/`，或直接把根目录 `SKILL.md` + `AGENTS.md` 放到项目根（Claude Code 也会读取 AGENTS.md）。

## 验证

```bash
ls ~/.claude/skills/city-salary/
# 应看到 SKILL.md 和 assets/
```

然后在 Claude Code 中直接说：“我月薪 7500，深圳，社保公积金基数 6750，公积金 5%，非独生赡养老人，到手多少？”

> 数据时效：skill 内置每年 7 月 15 日后联网核查机制，首次运行会自动检查。
