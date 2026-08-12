# 安装到 TRAE

TRAE（字节跳动 AI IDE）支持 **AGENTS.md** 项目规则与 Skills/Commands 机制，两种方式任选。

## 方式一：clone 项目直接打开

```bash
git clone https://github.com/weante/city-salary.git
```

用 TRAE 打开该目录，TRAE 自动加载 `AGENTS.md`，对话中即可询问工资计算。

## 方式二：合并到现有项目

将 `AGENTS.md` 复制到项目根目录（或按 TRAE 的规则管理功能导入）：

```bash
cp city-salary/AGENTS.md <你的项目>/
```

若 TRAE 版本支持 Skills 导入，把 `skills/city-salary/` 目录导入 TRAE 的 skills 目录即可获得完整交互式计算器（含 `calculator.html`）。

## 验证

在 TRAE 对话中询问：“我月薪 10000，佛山，公积金 10%，到手多少？”确认按佛山参数（医保 4669~9660、4.5%+生育1%）计算。
