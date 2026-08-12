# 安装到 opencode

opencode 支持项目根目录的 **AGENTS.md** 规则文件（新版本还支持 `AGENTS.md` 分层加载与 skills 扩展）。

## 方式一：clone 后直接使用

```bash
git clone https://github.com/weante/city-salary.git
cd city-salary
opencode
```

启动后在会话中询问：“我月薪 9000，东莞，公积金 8%，有房贷利息扣除，到手多少？”

## 方式二：合并到现有项目

```bash
cp city-salary/AGENTS.md <你的项目>/
cp -r city-salary/skills <你的项目>/
```

## 方式三：全局规则（可选）

将 `AGENTS.md` 内容追加到 opencode 全局规则文件（`~/.config/opencode/AGENTS.md`），使所有项目都可用。

## 验证

`opencode` 会话中询问任一内置城市，确认回复使用 AGENTS.md 中的参数表计算；需要可视化时让 agent 打开 `skills/city-salary/assets/calculator.html`。
