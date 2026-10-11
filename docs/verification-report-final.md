# city-salary 全国 337 城政策来源核查报告

> 生成日期：2026-10-01（2026-10-10 补录第六轮，2026-10-12 补录第十二轮）　｜　数据来源：`docs/sources/` 下 47 个分组文件（G/P/Q/R/S/T/U/V/W/X/Z/D/H/J/L 共十二轮）
> 判定标准：`.gov.cn` 或**经确认的政府/事业单位官方网站**（含 `.com/.cn`）；
> 排除商业聚合站、媒体、博客、**微信公众号**、征求意见稿、已失效的阶段性降费。

## 总览

| 指标 | 数值 |
|------|-----:|
| 全国城市数 | 337 |
| **已核查城市**（有记录） | **337** |
| **其中：已取得官方来源** | **332** |
| 其中：已核查但未取得来源 | 5 |
| 未取得来源 | 0 |
| ✅ 已核实（来源 + 数值一致） | 197 |
| 🟡 部分核实 | 124 |
| ⚠️ 有来源但未覆盖该项 | 16 |
| 收录链接 | 607 条 |

### 逐省汇总

| 省级单位 | 城市数 | 已核实 | 部分 | 未找到 | 零链接 | 链接数 |
|---|---|---|---|---|---|---|
| **云南** | 16 | 5 | 11 | 0 | 0 | 28 |
| **内蒙古** | 12 | 5 | 7 | 0 | 0 | 22 |
| **吉林** | 9 | 3 | 6 | 0 | 0 | 25 |
| **四川** | 21 | 15 | 6 | 0 | 0 | 41 |
| **安徽** | 16 | 14 | 2 | 0 | 0 | 27 |
| **宁夏** | 5 | 5 | 0 | 0 | 0 | 5 |
| **山东** | 16 | 13 | 1 | 2 | 1 | 19 |
| **江西** | 11 | 9 | 0 | 2 | 2 | 16 |
| **浙江** | 11 | 7 | 3 | 1 | 0 | 13 |
| **甘肃** | 14 | 7 | 7 | 0 | 0 | 28 |
| **直辖市** | 4 | 4 | 0 | 0 | 0 | 12 |
| **福建** | 9 | 7 | 2 | 0 | 0 | 18 |
| **西藏** | 7 | 3 | 4 | 0 | 0 | 13 |
| **辽宁** | 14 | 7 | 7 | 0 | 0 | 33 |
| **陕西** | 10 | 6 | 3 | 1 | 1 | 12 |
| **贵州** | 9 | 5 | 4 | 0 | 0 | 16 |
| **青海** | 8 | 1 | 7 | 0 | 0 | 22 |
| **湖南** | 14 | 7 | 4 | 3 | 0 | 30 |
| **黑龙江** | 13 | 8 | 1 | 4 | 0 | 15 |
| **湖北** | 13 | 7 | 5 | 1 | 0 | 17 |
| **广东** | 21 | 16 | 4 | 1 | 0 | 45 |
| **海南** | 4 | 0 | 4 | 0 | 0 | 5 |
| **河南** | 17 | 2 | 15 | 0 | 0 | 23 |
| **广西** | 14 | 11 | 3 | 0 | 0 | 35 |
| **新疆** | 14 | 2 | 12 | 0 | 0 | 20 |
| **江苏** | 13 | 10 | 3 | 0 | 0 | 22 |
| **河北** | 11 | 8 | 3 | 0 | 0 | 24 |
| **山西** | 11 | 10 | 0 | 1 | 1 | 21 |

> **本表「链接数」口径（2026-10-12 起两处已统一为 607）**：逐省「链接数」= 该省各城在 `docs/sources/*.json` 记录库中**胜出记录**（`best`）的 URL 条数；总览的「收录链接 607 条」= 同一口径的 337 城合计。两者现在由 `tools/source-records.js` 的 `readRecords()` 一次算出，故必然相等。
> ⚠️ 明细表（下方各省小节）的「来源链接」列**只展示代表性链接**，不是该城全部链接；要看全量请读 `docs/sources/*.json`。早前版本曾存在「明细口径 393 / 记录库口径 457」的差异，是因为明细表人工维护滞后，现已改为脚本生成，不再手改。

---

### 零官方链接城市（5 城）
| 省级单位 | 城市 |
|---|---|
| **山东** | 枣庄 |
| **江西** | 景德镇、萍乡 |
| **陕西** | 铜川 |
| **山西** | 朔州 |

> 本表只作下一轮检索的起点，不作结论。

### 第十二轮第三批进展（2026-10-12）：38 城 → 33 城（四川清零）

本批 5 城此前全部 `urls.length === 0`。其中 **德阳、资阳两城拿到 2026 年度缴存基数一手件，
且与仓库值逐字一致**；甘孜、凉山两城官网可达但确实没发基数件；广安至今没有独立中心官网。

| 城市 | 拿到了什么 | 状态 | 值是否改动 |
|---|---|---|---|
| 德阳 | **2026 年度一手件**：德公积金管发〔2026〕11号，比例 5%~12%，下限 2200 / 上限 27571，缴存额 220~6618，自 2026-01-01 执行 | ✅ 已核实 | 不改（逐字一致） |
| 资阳 | **2026 年度一手件**：上限 23864（单方 2864）/ 下限 2200（单方 110），自 2026-01-01 执行 | ✅ 已核实 | 不改（逐字一致） |
| 甘孜 | 官网渲染成功，「甘孜州相关文件」最新基数件仍是 2023 年度，2024~2026 未发布 | 🟡 部分 | 不改，保留 warn |
| 凉山 | 官网通知公告 16 条逐条枚举，全为暂停办理/提取/利率类，无基数件 | 🟡 部分 | 不改，保留 warn |
| 广安 | 无独立官网；广安市门户机构条目 + 川政务服务网广安市公积金中心专页 | 🟡 部分 | 不改，保留 warn |

**算式自校验**：德阳 `27571 ÷ 3 = 9190.33`（2025 年全市城镇单位就业人员月平均工资），
`2200×5%×2 = 220`，`27571×12% = 3309`（进位）×2 = 6618；资阳 `23864×12% = 2863.68 → 2864`、
`23864 ÷ 3 = 7954.67`、`2200×5% = 110`。两组全部自洽，四关全过，故只补文号与链接、不动数值。

**广安为什么难找**：广安市人民政府门户真实域名是**带连字符**的 `https://www.guang-an.gov.cn/`
（网站标识码 5116000002、蜀ICP备18036616号-1）。此前 `www.guang'an.gov.cn`、`www.guangan.gov.cn`、
`www.ga.gov.cn` 全部无效，DoH 实测 `scgagjj.cn` / `gagjj.guang'an.gov.cn` 均 NXDOMAIN ——
「域名猜错」而不是「文件不存在」，长期找不到属于误判。

**搜索引擎实测排序**：本轮 360（`so.com/s?q=`）是唯一能命中 `www.dyzfgjj.com.cn`、`www.sczygjj.cn`、
`gzzzfgjj.cn` 的引擎；Bing 不支持 `site:` 运算符且噪声极大，基于它的 site: 搜索脚本已作废。

详见 `docs/sources/README.md` 第十二轮第三批小节与 `docs/sources/S2.json`。

### 第十二轮第二批进展（2026-10-12）：42 城 → 38 城（内蒙古清零）

用同一招「**上级中心官网页脚反查下级域名**」定位内蒙古全部 4 个缺口城：
`http://www.nmgzfgjj.com.cn/`（内蒙古自治区住房资金管理中心）页脚「省市公积金」区块
一次性列出全区 12 个盟市公积金真实域名，据此拿到 **兴安盟 `www.xamzfgjj.cn`、
锡林郭勒盟 `www.xlglgjj.org.cn`、阿拉善 `www.alszfgjj.com.cn`、包头 `www.btgjj.cn`**。
这是该方法第二次奏效（第一次是宁德中心页脚列出福建 9 市）。

四城均记 **official-partial**，仓库值**一律不改**，理由分三种：

| 城市 | 拿到了什么 | 为什么仍不改值 |
|---|---|---|
| 兴安盟 | **2025 年度缴存基数通知全文**：上限 22685（2024 年城镇非私营月均×3）、下限 乌兰浩特 2200 / 其他旗县市 2140 | 站内通知公告最新一条为 2025-08，**未见 2026 年度通知**；仓库 2140~22685 与 2025 年度官方值逐字一致 |
| 锡林郭勒盟 | 官网 + 存贷款利率（首套 2.35%/2.85%，二套 2.78%/3.33%）+ 备案号 | 通知公告与存贷款利率两栏**均无缴存基数**；仓库 30498 仍属估算，无可证实件 |
| 阿拉善盟 | 官网 + 归集/提取/贷款实施细则等制度文件 | 政策法规栏最新为 2026-04「优化住房公积金使用惠民措施」，属**使用**政策非**基数**政策 |
| 包头 | 官网归属三重官方印证（市政府门户、住建局门户、自治区中心页脚） | 站点是 RuoYi 单页应用，内容不在 HTML 里；headless Chrome 渲染后「政策法规」栏仅 10 篇国标/自治区文件，**无本市基数通知**；搜索引擎零索引 |

⚠️ **须分开的两件事**：「落地官方链接」≠「证实数值」。本批前者全部达成、后者全部未达成，
记录里 `urls` 与 `mismatch` 必须分开写，不能因为有了站点 URL 就把状态标成 confirmed。

详见 `docs/sources/README.md` 第十二轮第二批小节与 `docs/sources/Z2.json`。

### 第十二轮进展（2026-10-12）：48 城 → 42 城

用「**门户页脚反查真实域名**」一次性定位福建 9 市公积金域名（宁德中心页脚「市级公积金系统网站」），
配合 Windows OCR 流程打通（`cs-img.py` → `powershell.exe` 跑 `cs-ocr.ps1`），
补齐 **南平（南房金委〔2026〕5号/〔2025〕2号）、龙岩（龙住公〔2026〕14号）、莆田（莆房金委〔2026〕6号）、
宁德（宁房金管〔2026〕4号）、白山（白山金管发〔2023〕6号，仅上限 → official-partial）、南充（南公积金〔2026〕32号）**。
六城仓库值与官方原文**零偏差，全部不改值**；其中宁德 note 文号由存疑的「宁公积金〔2026〕10号」更正为实证的 4 号。

**同时确认**：不存在 `gjj.<省>.gov.cn` 这种域名模式（DoH 实测 NXDOMAIN），省级公积金站点必须另行查找。
详见 `docs/sources/README.md` 第十二节与 `docs/sources/Z1.json`。
## 云南（16 城：已核实 6 / 部分 10 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 临沧 | 🟡 部分 | 临医保联发〔2019〕35号 | <https://www.lincang.gov.cn/file/lcoldData/_local/2/7A/5B/D45EB3F60657FF7E7CE658CAF60_007A7CDD_578760.pdf> |
| 丽江 | 🟡 部分 | — | <https://lijiang.gov.cn/ljsrmzf/c102219/202212/fbb61beb66ea4c099e6390733dc721bb.shtml> |
| 保山 | 🟡 部分 | — | <https://baoshan.gov.cn/info/28876/10311604.htm> |
| 大理 | 🟡 部分 | 云人社发〔2026〕9号（引用）；大公积金发〔2024〕4号（上限规则） | <https://www.dali.gov.cn/dlzrmzf/jcyw/pc/content/2095411813258674176/content_2095411813258674176.html><br><https://www.dali.gov.cn/dlzrmzf/zfgbml/pc/content/1968882573928140800/content_1968882573928140800.html> |
| 德宏 | 🟡 部分 | — | <http://www.dh.gov.cn/ylbzj/Attach/2207/28D00DG2L62207181450251ED54ABA.pdf> |
| 怒江 | 🟡 部分 | — | <https://www.nujiang.gov.cn/xxgk/015279139/info/2010-161327.html> |
| 文山 | ✅ 已核实 | 文政规〔2023〕4号 | <https://www.ynws.gov.cn/wszzf/xzgfx/1855137429650239488/oyok7cCT.pdf> |
| 昆明 | 🟡 部分 | 昆公积金〔2026〕69号 | <https://ybj.km.gov.cn/c/2024-07-25/4882692.shtml><br><https://zfgjj.km.gov.cn/c/2026-09-04/5109614.shtml> |
| 昭通 | ✅ 已核实 | — | <http://www.cnyl.gov.cn/yiliang/upload/files/2023/8/92ec27e009a427ca.pdf> |
| 普洱 | 🟡 部分 | — | <https://www.puershi.gov.cn/__local/D/65/BD/C56C8FA1A6CB5BFD1B1B2775CF8_4BA38C78_41C9F.pdf> |
| 曲靖 | ✅ 已核实 | 曲靖市公积金中心 2026-07-02 / 2026-01-01 两件（无文号） | <https://www.qjzfgjj.com/cms/gzdt/5410.jhtml><br><https://www.qjzfgjj.com/cms/gzdt/5243.jhtml> |
| 楚雄 | ✅ 已核实 | — | <https://ynlf.gov.cn/info/3876/90596.htm> |
| 玉溪 | 🟡 部分 | 玉医保规〔2019〕1号；玉市金发〔2026〕20号 | <http://www.huaning.gov.cn/u/cms/yxszfxxgk/202112/17200927fqf8.pdf><br><https://www.yuxi.gov.cn/yxszfxxgk/szbmgfxwj/20211217/1314669.html> |
| 红河 | 🟡 部分 | — | <https://www.hh.gov.cn/info/1241/591962.htm> |
| 西双版纳 | ✅ 已核实 | — | <https://www.xsbn.gov.cn/zybj/media/2023/09/51bdc882-a35c-4c1e-a6d3-73b5cc48008c1694511567025892895909.pdf><br><https://www.xsbn.gov.cn/media/2023/08/27a1138c-23ad-4997-b47f-389454c467871691650901310-646105851.pdf> |
| 迪庆 | 🟡 部分 | — | <http://diqing.gov.cn/file/diqing/dqzzf_zfbgs/file/20220628/1656406677753052102.pdf><br><https://hrss.yn.gov.cn/jyj/Print.aspx?ClassID=756&newsid=27319> |


## 内蒙古（12 城：已核实 5 / 部分 7 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 乌兰察布 | ✅ 已核实 | 乌政办发〔2024〕10号 | <https://www.wulanchabu.gov.cn/rmt/userfiles/ueditor/upload/file/20240322/1711099430852080496.docx> |
| 乌海 | ✅ 已核实 | — | <https://www.whsgjj.com/zxdt/2042.jhtml> |
| 兴安盟 | 🟡 部分 | 兴安盟住房公积金中心《关于确定2025年度职工住房公积金月缴存基数上限、下限的通知》（2025-07-17，无文号）；依据 内政办发〔2022〕92号、内政办发〔2024〕46号 | <http://www.xamzfgjj.cn/tzgg/3080.jhtml><br><http://www.xamzfgjj.cn/tzgg/index.jhtml> |
| 包头 | 🟡 部分 | —（站点归属三重官方印证，内容为 SPA 不可抓取） | <https://www.btgjj.cn/><br><http://zfhcxjsj.baotou.gov.cn/> |
| 呼伦贝尔 | ✅ 已核实 | 呼政办发〔2024〕66号 | <https://www.hlbe.gov.cn/OpennessGazette/show/8914.html> |
| 呼和浩特 | 🟡 部分 | — | <https://www.nmg.gov.cn/zwgk/gzk/msgz/hhht/202112/P020211229531096842917.docx> |
| 巴彦淖尔 | 🟡 部分 | — | <http://zjj.bynr.gov.cn/zjwtzgg/202607/t20260701_296643.html> |
| 赤峰 | ✅ 已核实 | — | <https://ybj.chifeng.gov.cn/zzllms/zzYbyw/202603/t20260305_2738432.html> |
| 通辽 | 🟡 部分 | — | <https://ylbzj.tongliao.gov.cn/xwzx/tzgg/202607/t20260706_1058433.html> |
| 鄂尔多斯 | ✅ 已核实 | — | <http://ordos.gov.cn/zzms/slh_zcjd/202401/t20240111_3554347.html> |
| 锡林郭勒盟 | 🟡 部分 | —（官网 + 存贷款利率，无缴存基数通知） | <http://www.xlglgjj.org.cn/xlglgjj/zwgk/ldj/index.html><br><http://www.xlglgjj.org.cn/xlglgjj/flbz/fg/index.html> |
| 阿拉善盟 | 🟡 部分 | —（官网 + 归集/提取/贷款实施细则，无缴存基数通知） | <http://www.alszfgjj.com.cn/col/col4016/index.html><br><http://www.alszfgjj.com.cn/col/col4015/index.html> |


## 吉林（9 城：已核实 3 / 部分 5 / 未找到 1 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 吉林市 | 🟡 部分 | — | <http://xxgk.jlcity.gov.cn/qtdw/gjjglzx_1/xbgkml/202608/t20260814_1332244.html><br><http://xxgk.jlcity.gov.cn/qtdw/gjjglzx_1/xbgkml/202608/t20260814_1332245.html> |
| 四平 | ✅ 已核实 | — | <http://gjj.siping.gov.cn/tzgg/202607/t20260717_771109.html> |
| 延边 | 🟡 部分 | — | <http://zfxxgk.yanbian.gov.cn/cyqzf/xxgkml/202201/t20220107_371243.html><br><http://zfxxgk.yanbian.gov.cn/cyqzf/zcjd/202201/t20220107_371283.html> |
| 松原 | ✅ 已核实 | 上限件（松原市住房公积金管理中心，2026-08-31 落款，无文号，2026-09-01 发布）；下限件（2025-11-28 落款，依据 吉政函〔2025〕59号，自 2025-12-01 起） | <https://www.syszfgjj.cn/tzgg/1270.jhtml><br><https://www.syszfgjj.cn/tzgg/950.jhtml> |
| 白城 | 🟡 部分 | 下限坐实：中心在市政府门户「市长信箱」的具名答复（2025-08-04）＋ 吉政函〔2025〕59号 白城档位 1870；上限 20676 反推与 89778/87865 均不符，存疑待核实（中心无独立官网，www.bcgjj.com 已 NXDOMAIN） | <http://www.jlbc.gov.cn/hdjl_3211/xszxx/xszxx_1/202508/t20250803_1018642.html><br><http://www.jlbc.gov.cn/qzqd/szfgjj/index.html> |
| 白山 | ✅ 已核实 | 白山市住房公积金管理中心《2026年度缴存单位年审、职工住房公积金缴存基数及比例调整工作的通知》（2026-01-13）；制度依据白山金管发〔2023〕6号 | http://bsgjj.cbs.gov.cn/zcfg/zxzc/202601/t20260113_865179.html |
| 辽源 | 🟡 部分 | 辽公积金管发〔2026〕4号《归集管理办法》第八条只给公式（下限＝本市统计部门上年度职工最低月工资标准，上限＝本市统计部门上年度职工月平均工资×3、具体限额参照社保缴费基数），无数值件；辽公积金管发〔2026〕2号为使用政策不含基数；中心官网 www.lygjj.cn 为 tarpitting 型 WAF 取不到正文 | <http://zwgk.liaoyuan.gov.cn/zsjg/fgw_97992/xxgkml/202601/t20260115_730085.html><br><http://zwgk.liaoyuan.gov.cn/zsjg/fgw_97992/gkzn/> |
| 通化 | ✅ 已核实 | 通市政办发〔2022〕25号 | <https://gjj.tonghua.gov.cn/views/CNewsDetail?id=a591a100773b44b1bac5e3305e7f26f4><br><http://www.jlrd.gov.cn/jlsjk/202311/P020231102773790005143.pdf> |
| 长春 | 🟡 部分 | — | <http://zwgk.changchun.gov.cn/zcbm/szfgjj/gjjxxgkml/202607/t20260729_3503280.html> |


## 四川（21 城：已核实 15 / 部分 6 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 乐山 | ✅ 已核实 | — | <https://www.leshan.gov.cn/lsswszf/zzzqgsgg/827244580835397.html><br><https://www.leshan.gov.cn/lsswszf/shbzssqk/92337841/f1377a4cad7644128c0302de3.html> |

| 内江 | 🟡 部分 | （内江市医保局/财政局/税务局关于2026年度灵活就业人员参加职工医保缴费标准等有关情况的通知，2025-12-19，页面未显示文号） | <https://www.neijiang.gov.cn/njs/xgzc2/202601/0cce51fac6fe4a79baf175ac4115c736.shtml> |
| 凉山 | 🟡 部分 | 官网备案 蜀ICP备18030263号-4 / 川公网安备 51340102000255；通知公告 2024-11~2026-09 共 16 条逐条枚举**无缴存基数件** | <https://www.lsgjj.cn/xxgk/fdzdgknr/tzgg1/> |
| 南充 | ✅ 已核实 | 南公积金〔2026〕32号（2026缴存年度，上限=上年城镇非私营月均8919×3=26757，下限2200；灵活就业10%~24%） | http://www.nanchong.gov.cn/zfgjjglzx/zwxx/zcwj/dfzc/t_2346126.html |
| 宜宾 | ✅ 已核实 | 宜住金管发〔2026〕5号 | <http://gjj.yibin.gov.cn/wjk/bmgfxwj/202607/t20260716_2242583.html><br><http://ybsgx.sczwfw.gov.cn/art/2026/9/24/art_41609_325306.html> |
| 巴中 | ✅ 已核实 | 巴府办规〔2024〕1号（PDF 正文首页，本次因 PDF 文本层编码不可靠未能逐字复核文号；文件名与市政网附件路径一致） | <https://gjjzx.cnbz.gov.cn/content/article/24021183><br><https://www.cnbz.gov.cn/group1/M00/05/7B/rBUtIGfdOqOAE_3QAAtNvTwScew204.pdf> |
| 广元 | ✅ 已核实 | 广医保办发〔2026〕20号 | <https://zwzx.cngy.gov.cn/News/Detail/b1a558a1e4234f0a8f176b3f474191af.html><br><https://ybj.cngy.gov.cn/new/show/f6f97eeb64cd464792ac0f54e5c4e6bd.html> |
| 广安 | 🟡 部分 | 无独立中心官网；落广安市门户机构条目（索引号 154004610/2020-000030）+ 川政务服务网广安市公积金中心专页（deptCode=876543234567898765） | <https://www.guang-an.gov.cn/gasrmzfw/c105078/pc/content/content_1717474851667677184.html><br><https://www.sczwfw.gov.cn/jiq/front/item/bmft_index?deptCode=876543234567898765&areaCode=511600000000> |
| 德阳 | ✅ 已核实 | **德公积金管发〔2026〕11号**（索引号 sgjjzx-2026-000026，2026-07-31）：比例 5%~12%，基数下限 2200 / 上限 27571，缴存额下限 220 / 上限 6618，自 2026-01-01 执行；依据 德府规〔2025〕3号、机关事业口径 德公积金发〔2022〕22号 | <http://www.dyzfgjj.com.cn/gk/zcfg/dfzc/1963612.htm> |
| 成都 | 🟡 部分 | — | <https://cdzfgjj.chengdu.gov.cn/gkml/qtwj/1534506168435605504.shtml> |
| 攀枝花 | ✅ 已核实 | （攀枝花市住房公积金管理中心通知，2026-07-10） | <http://pzhsrhq.sczwfw.gov.cn/art/2026/7/30/art_25555_321292.html?areaCode=510411000000> |
| 泸州 | 🟡 部分 | — | <https://luzhou.gov.cn/xw/rdgz/content_1094287> |
| 甘孜 | 🟡 部分 | 官网可渲染（Vue SPA，headless Chrome），但「甘孜州相关文件」栏最新缴存基数件仍为 **2023 年度**（2023-06-08），2024~2026 三年未发布 | <https://gzzzfgjj.cn/> |
| 眉山 | ✅ 已核实 | 眉医保办发〔2025〕24号 | <http://mssdpq.sczwfw.gov.cn/art/2026/7/22/art_20142_320627.html> |
| 绵阳 | ✅ 已核实 | 绵办规〔2026〕3号 | <https://www.my.gov.cn/mysrmzf/c100061/202607/a871bed3caa84cd5a54989392a09d0ce.shtml><br><https://www.beichuan.gov.cn/beichuan/c125502/202609/11f89913af114903af7de8c4046d5963.shtml> |
| 自贡 | ✅ 已核实 | 自住金管委发〔2026〕8号 | <https://www.zg.gov.cn/zgsrmzf/szfbmwj/pc/content/content_2076575001769623552.html> |
| 资阳 | ✅ 已核实 | 《关于确定2026年度住房公积金缴存基数上、下限标准的通知》（2026-07-10，无文号）：上限 23864（单方 2864）、下限 2200（单方 110），自 2026-01-01 执行；依据 资市住金委发〔2023〕1号、机关事业口径 资住金发〔2022〕5号 | <http://sczygjj.cn/content/2075394349876666370.html> |
| 达州 | ✅ 已核实 | （达州市住房公积金管理中心通知，2026-07-08 发布；市政府网转载自达州晚报，页面未显示文号） | <http://www.dazhou.gov.cn/news-show-271102.html> |
| 遂宁 | ✅ 已核实 | （遂宁市医疗保障局《关于确定2026年度城镇职工基本医疗保险与生育保险有关缴费基数的通知》，2025-12-05，页面未显示文号；公积金件亦未显示文号） | <https://sylbzj.suining.gov.cn/zwgk/show/dff8be26a5e2b12de2e609646cfe9709.html><br><https://sgjj.suining.gov.cn/xinwen/show/70224b5c59e4ef96d59a19cce7c9e680.html> |
| 阿坝 | 🟡 部分 | （阿坝州人民政府关于印发《阿坝州职工基本医疗保险实施办法（修订）》的通知，2022-10 州政府公报栏目） | <http://abazhou.gov.cn/abazhou/zfgbml/202210/dc9e38fea02e4895b6ccabcfd022ab3d.shtml> |
| 雅安 | ✅ 已核实 | （雅安市人民政府《关于印发雅安市职工医疗保险办法的通知》，2021-12-19 成文，2021-12-22 发布；页面未显示文号，仓库记为雅府发〔2021〕12号） | <https://www.yaan.gov.cn/zhangzhe/zfxxgk/8cc517ae9a6046364192dfaa32f291e9.html><br><https://www.yaan.gov.cn/gongkai/show/1395a130a752ef91155dc6e1be7fd105.html> |

## 宁夏（5 城：已核实 5 / 部分 0 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 中卫 | ✅ 已核实 | 《中卫市2026年度住房公积金缴存基数调整！上下限标准全部明确》（中卫市住房公积金管理中心，2026-07-01） | <https://www.nxzfgjj.com/zwgjj/info/1003/19819.htm> |
| 吴忠 | ✅ 已核实 | 《关于调整吴忠市住房公积金2026年度最高月缴存额的通知》（吴忠市住房公积金管理中心，2026-07-06印发、2026-07-09发布，未标注文号） | <https://www.nxzfgjj.com/wzgjj/info/1003/5165.htm> |
| 固原 | ✅ 已核实 | 《固原市住房公积金管理中心关于开展2026年度住房公积金缴存基数调整工作的通知》（2026-06-26印发、2026-06-29发布，未标注文号）；宁政规发〔2025〕2号（最低工 | <http://nxzfgjj.com/gygjj/info/1021/12509.htm> |
| 石嘴山 | ✅ 已核实 | 《石嘴山市住房公积金管理中心关于调整2026年度住房公积金缴存基数上限的通知》（2026-06-30，未标注文号） | <https://www.nxzfgjj.com/szsgjj//info/1304/20709.htm> |
| 银川 | ✅ 已核实 | — | <https://www.yinchuan.gov.cn/xxgk/bmxxgkml/zfgjjglzx/xxgkml_2829/bmqtwj_2837/202608/t20260810_5309448.html> |

## 安徽（16 城：已核实 14 / 部分 2 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 亳州 | ✅ 已核实 | 公积金委〔2026〕3号（亳州市住房公积金管理委员会《关于开展2026年度住房公积金缴存基数调整工作的通知》，发文 2026-08-02、发布 2026-08-04） | <https://gjj.bozhou.gov.cn/XxgkContent/show/2998090.html> |
| 六安 | ✅ 已核实 | 六市金管〔2025〕26号（六安市住房公积金中心，成文/发布 2025-11-28） | <https://zfgjj.luan.gov.cn/public/6608511/10733324.html> |
| 合肥 | 🟡 部分 | — | <https://wjw.ah.gov.cn/group4/M00/05/76/wKg862SmeDWAAmxCAALovolVxFA926.pdf> |
| 安庆 | ✅ 已核实 | 宜公积金〔2026〕6号（安庆市住房公积金管理中心，2026-06-25） | <https://gjj.anqing.gov.cn/xxfb/tzgg/2004206789.html><br><https://gjj.anqing.gov.cn/group4/M00/05/BF/FBUWFGo88m-ADoLTAAOjTLs6YsY847.pdf> |
| 宣城 | ✅ 已核实 | 正文未列文号（宣城市住房公积金管理中心，2025-12-08） | <https://gjj.xuancheng.gov.cn/News/show/1689694.html><br><https://www.xuancheng.gov.cn/Livelihood/show/8572.html> |
| 宿州 | ✅ 已核实 | 正文未列文号（宿州市住房公积金管理中心，成文 2026-06-30、发布 2026-07-01） | <https://gjj.ahsz.gov.cn/xwzx/tzgg/196451821.html><br><https://gjj.ahsz.gov.cn/public/2655681/196446321.html> |
| 池州 | ✅ 已核实 | 池房金管〔2026〕7号（另引 池房金委〔2026〕6号） | <https://gjjzx.chizhou.gov.cn/Content/show/779929.html> |
| 淮北 | ✅ 已核实 | — | <https://ybj.huaibei.gov.cn/group1/M00/09/71/CqET9GZebMCABLyKAAFQ-W_w_3A408.pdf><br><https://hbzfgjj.huaibei.gov.cn/group1/M00/15/60/CqET9GpNuX2ANS7vAALhsva4lhQ621.pdf> |
| 淮南 | ✅ 已核实 | — | <https://ybj.huainan.gov.cn/gzdt/sjdt/551502155.html><br><https://gjj.huainan.gov.cn/tzgg/tzgg/551864391.html> |
| 滁州 | ✅ 已核实 | 滁金管〔2026〕9号 | <https://zfgjj.chuzhou.gov.cn/xwdt/tzgg/1104474821.html><br><https://www.mingguang.gov.cn/group3/M00/0C/1D/CpYIYGkpGfqAcVvVAHqwKPs3Mjg416.pdf> |
| 芜湖 | ✅ 已核实 | 房金中心〔2026〕6号（芜湖市住房公积金管理中心） | <https://gjj.wuhu.gov.cn/openness/public/6596901/41216179.html><br><https://www.wuhu.gov.cn/openness/public/6596211/41307223.html> |
| 蚌埠 | ✅ 已核实 | — | <https://ybj.bengbu.gov.cn/zfxxgk/public/22281/51972724.html><br><https://www.bengbu.gov.cn/zfxxgk/public/21981/53295112.html> |
| 铜陵 | ✅ 已核实 | 正文未列文号（铜陵市住房公积金管理中心，2026-07-06 发布） | <https://gjj.tl.gov.cn/tlszfgjjglzx/c00045/pc/content/content_2073963361562583040.html><br><https://www.tl.gov.cn/openness/OpennessContent/show/1157729.html> |
| 阜阳 | ✅ 已核实 | 阜公积金〔2026〕40号 | <https://gjj.fy.gov.cn/OpennessContent/show/2782627.html><br><https://ylbz.fy.gov.cn/OpennessContent/download/2278184.html?type=pdf> |
| 马鞍山 | ✅ 已核实 | 马医保发〔2019〕30号 | <https://ylbzj.mas.gov.cn/xxgk/openness/detail/content/5dd3b3d3c632a3dd28ac68f1.html><br><https://masgjj.mas.gov.cn/xxgk/openness/detail/content/6953eda18866886e328b4d62.html> |
| 黄山 | 🟡 部分 | — | <https://ylbz.huangshan.gov.cn/zwgk/public/6615779/8912127.html> |

## 山东（16 城：已核实 13 / 部分 1 / 未找到 2 / 未取得 1）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 东营 | ✅ 已核实 | — | <http://www.dongying.gov.cn/art/2026/7/10/art_38799_10470442.html> |
| 临沂 | ✅ 已核实 | 临住字〔2026〕15号 | <https://gjj.linyi.gov.cn/info/1141/9231.htm> |
| 威海 | ✅ 已核实 | — | <https://zfgjj.weihai.cn/art/2026/8/3/art_46303_6522888.html> |
| 德州 | 🟡 部分 | — | <http://wap.dezhou.gov.cn/n43517148/n43517516/c100940842/content.html><br><http://dzgjj.dezhou.gov.cn/n4690142/c100732772/content.html> |
| 日照 | ✅ 已核实 | — | <https://www.rizhaozfgjj.cn/art/2026/7/29/art_31321_10283616.html> |
| 枣庄 | ⚠️ 未找到 | — | — |
| 泰安 | ✅ 已核实 | 泰公积金〔2026〕31号 | <http://gjjzx.taian.gov.cn/art/2026/6/30/art_48042_10296832.html> |
| 济南 | ✅ 已核实 | 济南住房公积金中心《关于调整2026年度住房公积金缴存基数的通知》（gjj.jinan.gov.cn 2026年发布，未在正文抓到文号） | <https://gjj.jinan.gov.cn/col/col111465/art/2026/art_1df4b8a8b2604fd185a8e9130c55a5ba.html><br><https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/front/info/detail?iid=1df4b8a8b2604fd185a8e9130c55a5ba> |
| 济宁 | ✅ 已核实 | — | <https://www.jining.gov.cn/art/2026/7/28/art_109078_2937853.html> |
| 淄博 | ✅ 已核实 | 淄博市住房公积金管理中心《关于做好2026年度住房公积金缴存基数和缴存比例调整工作的通知》（zfgjj.zibo.gov.cn） | <https://zfgjj.zibo.gov.cn/gongkai/channel_c_5f9fa491ab327f36e4c13083_n_1605682382.0377/doc_6a4ca154535041655ab7955e.html><br><https://zfgjj.zibo.gov.cn/gongkai/channel_c_5f9fa491ab327f36e4c13083_n_1607419649.5632/doc_6a4da56c61d4c4a7318b9488.html> |
| 滨州 | ✅ 已核实 | — | <http://gjj1.binzhou.gov.cn/art/2026/7/3/art_121655_10272317.html> |
| 潍坊 | ✅ 已核实 | — | <http://gjj.weifang.gov.cn/55379/2072204601515446272.html> |
| 烟台 | ⚠️ 未找到 | — | <https://gjj.yantai.gov.cn/> |
| 聊城 | ✅ 已核实 | — | <http://gjj.liaocheng.gov.cn/channel_t_179_13005/doc_6a5585f0bc187f6c2cb04e85.html> |
| 菏泽 | ✅ 已核实 | 菏住金〔2026〕9号 | <http://www.heze.gov.cn/0530/2c908088819842f701819a1a32d10004/2073960359257063424.html> |
| 青岛 | ✅ 已核实 | — | <http://www.qdgjj.com/zcfg_108/zcjd_108/202607/t20260706_10652853.shtml><br><http://www.qingdao.gov.cn/zwgk/xxgk/gjjgl/gkml/gwfg/202607/t20260706_10652620.shtml> |

## 山西（11 城：已核实 4 / 部分 3 / 未找到 4 / 未取得 3）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 临汾 | ⚠️ 未找到 | 页面未显示文号（省级《关于进一步完善职工基本医疗保险缴费相关问题的通知》，山西省医保局办公室等，2023-12-27） | <http://ylbzj.linfen.gov.cn/contents/16103/798.html> |
| 吕梁 | ✅ 已核实 | 吕政办发〔2019〕59号（《吕梁市生育保险和职工基本医疗保险合并实施方案》，市医保局解读，2019-12-17） | <http://www.lvliang.gov.cn/llxxgk/zfxxgk/xxgkml/zcjd_21560/201912/t20191217_1348410.html> |
| 大同 | 🟡 部分 | 页面未显示文号（《关于调整完善生育保险政策的通知》，市医保局、市财政局、市卫健委、市税务局联合印发；市政府门户 2026-07-04 发布，来源：大同日报） | <http://www.dt.gov.cn/dtszf/bmdt/202607/236cf3595a0c46358a6994dfe858cca8.shtml> |
| 太原 | 🟡 部分 | 并医保发〔2026〕14号（《太原市职工大额医疗费用补助办法》） | <https://ybzx.taiyuan.gov.cn/tzgg2/20260803/30312470.html><br><https://ybzx.taiyuan.gov.cn/> |
| 忻州 | ⚠️ 未找到 | — | — |
| 晋中 | 🟡 部分 | 页面未显示文号（晋中市《关于生育保险和职工基本医疗保险合并实施有关事宜的通知》，2017-06-22 发布） | <https://rsj.sxjz.gov.cn/ztzl/syylhbsszt/content_202299> |
| 晋城 | ⚠️ 未找到 | — | — |
| 朔州 | ⚠️ 未找到 | — | — |
| 运城 | ✅ 已核实 | 运政办发〔2019〕24号（《关于做好运城市生育保险和职工基本医疗保险合并实施工作的通知》政策解读，运城市医疗保障局，2019-08-26） | <https://www.yuncheng.gov.cn/doc/2019/10/30/23541.shtml> |
| 长治 | ✅ 已核实 | 页面未显示文号（长治市医疗保障局政府文件，2026-07-16 发布，长期护理保险实施相关） | <https://changzhi.gov.cn/xxgkml/zfxxgkml/szfgzbm/czsylbzj/czsrmzf/zfwj_3465/202607/t20260716_3186735.shtml> |
| 阳泉 | ✅ 已核实 | 阳政办发〔2019〕68号（《阳泉市生育保险和职工基本医疗保险合并实施方案》，页面标注「是否有效：有效」） | <http://xxgk.yq.gov.cn/yqsrmzf1/fdzdgknr_45346/lzyj/szfbgswj/202009/t20200929_1071480.shtml> |

**山西公积金专项（2026-10-10 补录）**——上表「状态」列是**整城口径**，此处的公积金官方件另行补入，其中 3 市的通知正文是**扫描件**，经 Windows.Media.Ocr（zh-Hans-CN）读出：

| 城市 | 文号 | 缴存年度 | 上限 | 下限 | 来源 |
|---|---|---|---|---|---|
| 大同 | 页面未标文号 | 2026-07-01~2027-06-30 | 23543（94171÷12×3=23542.75 取 23543） | 平城/云冈 2150、新荣/云州/左云 2050、其余 5 县 1950 | <https://dt.gov.cn/dt12345/rxdt1/202607/1e040e92e896438bbf72c965fab2eaf3.shtml> |
| 阳泉 | 阳住管发〔2026〕37号 | 同上 | 23643（月缴存额上限 5674 元 = 23643×12%×2） | 平定/盂县 2050、城区/矿区/郊区 2150 | <https://yqgjj.yq.gov.cn/zwgk/202607/t20260707_2217733.html> |
| 长治 | 页面未标文号 | 同上 | 25359（8453×3） | 2350/2250/2150 三档，**2026-10-01 起实行**（晋政办发〔2026〕29号） | <https://zfgjj.changzhi.gov.cn/zcfg/zxwj/202609/t20260929_3209979.html> |
| 晋城 | — | 同上 | 24183（8061.08×3=24183.24 取 24183） | 城区等 2150、陵川 1950 | <https://www.jcgov.gov.cn/zwgk/hygq_23386/zctb/202606/t20260630_2365786.shtml> |
| 运城 | — | 同上 | 21324（85298÷12×3=21324.5 **截尾**） | 2150（运人社局函〔2025〕3号） | <https://www.yuncheng.gov.cn/doc/2026/07/03/617495.shtml> |
| 忻州 | — | 同上 | 22975（91901÷12×3=22975.25 取 22975） | 市直/忻府区/原平 2150 | <https://xzgjj.sxxz.gov.cn/hdjl/zxts1/zxts/202607/t20260701_4191094.html> |
| 晋中 | 市房金管发〔2026〕12号 | 同上 | 23855（95423÷12×3=23855.75 **截尾**） | 榆次/介休 2150、昔阳等 6 县 2050、左权/和顺/榆社 1950 | <https://www.sxjz.gov.cn/zwgk/bmxxgk/66gjjzx/xxgkmlgjj/zcwj66gjjzx/content_208073> |
| 临汾 | 临市房金〔2026〕27号 | 同上 | 24789（8263×3，精确整除） | 1950（省人社厅最低工资） | <http://gjj.linfen.gov.cn/contents/16305/439.html> |

> **下限为何只有长治上调**：晋政办发〔2026〕29号把山西最低工资上调为 2350/2250/2150（一/二/三类）并自 2026-10-01 起实施，11 市均有对应一类城区；但**省级最低工资 ≠ 市级公积金缴存下限**，市中心须各自发文（汕尾实证：市级件带过渡条款，只对新开户/新调入职工生效）。只有长治自己发了下限通知且无过渡条款，故 `长治 hf.min 2150→2350`；其余 10 市维持原值，待各自中心另发通知。阳泉、晋中的下限通知仍引**旧文晋政办发〔2024〕58号**（2150/2050/1950），进一步佐证下限不随省级件自动变更。

## 广东（21 城：已核实 16 / 部分 4 / 未找到 1 / 未取得 0）

> **省级基准文件（2026-10-10 新增）**：**粤府函〔2026〕188号**《广东省人民政府关于调整我省最低工资标准的通知》（成文 2026-08-12、发布 2026-08-13）——自 **2026-09-01** 起调整全省最低工资：一类 广州 **2680**、深圳 **2700**（非全日制 25.4 元/时）；二类 **2300**（珠海、佛山、东莞、中山）；三类 **2040**（汕头、韶关、河源、梅州、惠州、汕尾、江门、阳江、湛江、茂名、肇庆、清远、潮州、揭阳、云浮）。原件附件《广东省最低工资标准表》以图片发布、本环境取不到，数值经深圳市政府门户同题报道逐项核出，并与汕尾市公积金中心已下发的 2040 元下限相互印证。⚠️**该文件不构成各市公积金缴存下限的改值依据**——省级最低工资标准 ≠ 市级公积金缴存基数下限，各市中心须各自发文且常设「现有单位本年度仍按原标准执行」的过渡条款（汕尾 2026-08-31 通知第二条即明文如此）。故本轮只记录事实，**不批量改 20 市 hf.min**。
> 来源：<http://www.gd.gov.cn/gkmlpt/content/4/4942/post_4942177.html><br><https://www.sz.gov.cn/cn/xxgk/zfxxgj/zwdt/content/post_12936470.html>

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 东莞 | ✅ 已核实 | 《关于2026年度住房公积金缴存基数上下限调整的温馨提示》（东莞市住房公积金管理中心，2025-12-06，未标注文号）；《2026年度医疗保险缴费基数和费率表（下半年）》（东莞市 | <https://dggjj.dg.gov.cn/zwgk/zfxxgkml/qt/tzgg/content/post_4472090.html><br><https://www.dg.gov.cn/zwgk/zfxxgkml/sylbzj/content/post_4553460.html> |
| 中山 | ✅ 已核实 | 《关于做好2026年度我市住房公积金缴存基数和缴存额调整工作的通知》（中山市住房公积金管理中心，2026-07-04，文号栏未标注）；中山医保发〔2025〕54号《关于公布2026 | <https://zszfgjj.zs.gov.cn/gkmlpt/content/2/2630/post_2630600.html><br><http://hsa.zs.gov.cn/gkmlpt/content/2/2566/post_2566024.html> |
| 云浮 | ✅ 已核实 | 云房金〔2026〕32号《云浮市住房公积金管理中心关于做好2026年度住房公积金缴存调整工作的通知》；《关于调整云浮市住房公积金缴存基数下限的通知》（2026-09-11，未标注文 | <https://www.yunfu.gov.cn/gjj/zwgk/gggs/content/post_2030363.html><br><https://www.yunfu.gov.cn/gjj/zwgk/gggs/content/post_2040011.html> |
| 佛山 | ✅ 已核实 | 《佛山市住房公积金管理中心关于2026年度住房公积金缴存调整有关事项的通告》（2026-06-23，文号栏未标注） | <https://fsgjj.foshan.gov.cn/gkmlpt/content/7/7180/post_7180001.html> |
| 广州 | ✅ 已核实 | 《广州住房公积金管理中心关于2026年度住房公积金缴存调整有关问题的通知》（页面未标注文号）；《广州住房公积金管理中心关于调整住房公积金最低缴存基数的通知》（依据粤府函〔2026〕 | <https://gjj.gz.gov.cn/gg/tzgg/content/post_10879601.html><br><https://gjj.gz.gov.cn/gkmlpt/content/10/10983/post_10983424.html> |
| 惠州 | ✅ 已核实 | **惠市公积金〔2026〕28号**《惠州市住房公积金管理中心关于做好2026年度住房公积金缴存基数和缴存限额调整工作的通知》（索引号 124413183073H/2026-00160，成文 2026-06-24、发布 2026-06-29）——上限 34290（34290÷3=11430 为 2025 年在岗职工月平均工资）、月缴存额上限单方 4115/合计 8230（4115×2=8230 ✓）、比例 5%~12%、下限沿用 1850 | <http://hzgjj.huizhou.gov.cn/gkmlpt/content/5/5798/mpost_5798098.html> |
| 揭阳 | 🟡 部分 | 揭医保〔2025〕67号《关于公布2026年度基本医疗保险和生育保险缴费工资上限和下限有关问题的通知》（2025-11-11） | <http://www.jieyang.gov.cn/jyybj/gkmlpt/content/0/982/mpost_982242.html> |
| 梅州 | ⚠️ 未找到 | 梅市医保函〔2025〕156号（标题见于梅江区人民政府网通知公告） | <http://www.meijiang.gov.cn/zzzs/tzgg/content/post_2847360.html> |
| 汕头 | 🟡 部分 | 汕医保〔2025〕228号《关于明确我市职工基本医疗保险（生育保险）缴费基数及缴费费率有关问题的通知》（2025-12-08，2026-01-01 起实施） | <https://www.shantou.gov.cn/ylbzj/zwgk/zcfg/content/post_2497258.html> |
| 汕尾 | ✅ 已核实（2026-10-10 补录公积金下限件：汕尾市公积金中心 2026-08-31 成文、2026-09-12 发布，索引号 11441502007243996E/2026-00080，依 粤府函〔2026〕188号 自 2026-09-01 起新下限 2040 元、比例 5%~12%、月缴存额下限 204；但同件第二条明文「已完成 2026 缴存年度基数调整及尚未开展调整的缴存单位、缴存职工仍按原缴存基数标准执行，不执行本次 2040 元新下限，待 2027 年度再统一调整」→ 仓库 hf.min 维持 1750 不改；上限 27849 本次未取得发文原件） | 《汕尾市2026年度职工基本医疗保险（含生育保险）缴费基数公布》（汕尾市医疗保障局，2025-12-10）；《汕尾市住房公积金管理中心关于调整我市住房公积金缴存基数下限的通知》（2 | <http://www.luhe.gov.cn/swlhybj/gkmlpt/content/1/1208/post_1208577.html><br><http://www.swchengqu.gov.cn/swcqzfjj/gkmlpt/content/1/1272/post_1272441.html><br><https://www.shanwei.gov.cn/swzfjs/zwgk/0200/0201/content/post_1056388.html> |
| 江门 | ✅ 已核实 | 江房金字〔2026〕19号《关于江门市2026年度住房公积金缴存调整的通知》（2026-07-21）；《关于公布2026年度江门市职工基本医疗保险（含生育保险）缴费标准的通知》（江 | <https://www.jiangmen.gov.cn/bmpd/jmszfhcxjsj/zfgl/gjjzc/gjzc/content/post_3522838.html><br><https://www.jiangmen.gov.cn/bmpd/jmsylbzj/zwgk/zcfg/bjwj/content/post_3413909.html> |
| 河源 | ✅ 已核实 | 《关于开展河源市2026年度住房公积金缴存基数调整的通知》（2026-06-29，未标注文号）；河医保发〔2025〕67号《关于公布2026年度城镇职工基本医疗保险缴费基数有关事项 | <http://www.heyuan.gov.cn/bmjy/hyszfgjjglzx/gjjxx/content/post_707561.html><br><http://www.heyuan.gov.cn/hysylbzj/gkmlpt/content/0/678/post_678017.html> |
| 深圳 | 🟡 部分 | 深圳市医疗保障局《温馨提示》（2025-12-29，未标注文号）；深圳市医疗保障局《职工基本医保缴费标准有哪些规定？》（2023-11-20）；深圳市住房和建设局业务知识库答复（2 | <https://hsa.sz.gov.cn/xwzx/tzgg/content/post_12567884.html><br><https://hsa.sz.gov.cn/szsylbzjwzgkml/szsylbzjwzgkml/ywzsk/ylbzdy/content/post_10981681.html> |
| 清远 | ✅ 已核实 | 清公积〔2026〕6号《清远市住房公积金管理中心关于开展2026-2027年度住房公积金缴存基数调整工作的通知》（2026-06-29；佛冈县政府转发文号 佛公积〔2026〕1号） | <http://www.fogang.gov.cn/ywdt/gggs/tzgg/content/post_2161973.html><br><http://www.fogang.gov.cn/attachment/0/210/210040/2161973.pdf> |
| 湛江 | ✅ 已核实 | 湛公积金〔2026〕13号《关于开展住房公积金2026缴存年度基数调整工作的通知》（2026-06-30）；湛医保〔2025〕97号《关于公布湛江市2026年职工医保缴费基数上下限 | <https://www.zhanjiang.gov.cn/zjsfw/bmdh/zfgjj/zwgk/tzgg/content/post_2196483.html><br><https://www.zhanjiang.gov.cn/zjsfw/bmdh/ybj/zfxxgk/bmwj/qtwj/content/post_2122988.html> |
| 潮州 | ✅ 已核实 | 《关于调整2026-2027年度住房公积金缴存基数和比例的通知》（潮州市住房公积金管理中心，2026-06-30，未标注文号）；潮州市医保局/财政局/税务局 2026 年度缴费及待 | <https://www.chaozhou.gov.cn/zwgk/szsydw/szfgjj/tzgg/content/post_3996716.html><br><https://www.chaozhou.gov.cn/ywdt/czyw/content/post_3974281.html> |
| 珠海 | ✅ 已核实 | 《珠海市住房公积金管理委员会关于调整2026年度住房公积金缴存限额标准事项的通知》（2026-06-30 成文、2026-07-02 发布，未标注文号）；珠房金委字〔2026〕5号 | <https://gjj.zhuhai.gov.cn/gkmlpt/content/3/3921/post_3921024.html><br><https://www.zhuhai.gov.cn/zw/fggw/qtwj/qtbmzcwj/content/post_3934481.html> |
| 肇庆 | ✅ 已核实 | 《关于做好2026年度住房公积金缴存基数调整有关工作的通知》（肇庆市住房公积金管理中心，成文 2026-06-30，索引号 12441200708158794C/2026-00191，依据 肇房委〔2022〕8号、肇房委〔2025〕8号）——上限 **28220**（2025 年城镇非私营单位在岗职工月平均工资×3）、月缴存额上限 6772.8（28220×12%×2=6772.8 ✓）、下限 1850、灵活就业 10%~24%；另 肇医保发〔2025〕48号及税务局《肇庆市社保费费率费基一览表》4520~22599 | <https://www.zhaoqing.gov.cn/zqgjj/gkmlpt/content/3/3253/mpost_3253131.html><br><https://www.zhaoqing.gov.cn/zqgjj/gkmlpt/content/3/3253/mpost_3253152.html><br><https://guangdong.chinatax.gov.cn/gdsw/zqsw_sbfblzn/2026-01/07/content_13da7973a3b643a5adcaa43a0cf74864.shtml> |
| 茂名 | 🟡 部分 | 茂医保〔2025〕36号《关于公布2026年度职工基本医疗保险（含生育保险）缴费基数上限和下限的通知》（2025-11-27）；《关于调整2026年茂名市住房公积金缴存基数的通知》 | <http://www.maoming.gov.cn/xxgkml/ylbzj/content/post_1551237.html><br><http://www.maoming.gov.cn/xxgkml/zfgjjzx/content/post_1624848.html> |
| 阳江 | ✅ 已核实 | 《关于2026年度住房公积金月缴存基数调整有关事项的通知》（阳江市住房公积金管理中心，2026-07-01，未标注文号）；阳医保通〔2025〕35号《关于公布2026年度职工医保与 | <http://www.yjgjj.cn/xxgk/tzgg/2072147726774239234.html><br><http://www.yangjiang.gov.cn/yjylbzj/gkmlpt/content/0/902/post_902675.html> |
| 韶关 | ✅ 已核实 | 《关于2026年度住房公积金缴存调整工作的通知》（韶关市住房公积金管理委员会，2026-06-30，未标注文号） | <http://gjj.sg.gov.cn/xwzx/tzgg/content/post_2860060.html> |

## 广西（14 城：已核实 10 / 部分 4 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 北海 | 🟡 部分 | 市公积金中心《关于2026年度住房公积金缴存基数调整核定的通知》（2025-12-30，未标注文号）——载明基数口径但**未载上下限金额**；`gjj.beihai.gov.cn` 经 DoH 证实 NXDOMAIN | <http://www.beihai.gov.cn/xxgkbm/bhszfgjjglzx/tzgg_46/t27067336.shtml> |
| 南宁 | 🟡 部分 | 南府规〔2023〕23号 | <http://www.nanning.gov.cn/zwgk/fdzdgknr/zcwj/zfwj/t5816458.html> |
| 崇左 | ✅ 已核实 | — | <http://gjj.chongzuo.gov.cn/gzdt/tzgg/t23359884.shtml> |
| 来宾 | ✅ 已核实 | 来公积金〔2026〕1号 | <http://zfgjj.laibin.gov.cn/tzgg/t23361438.shtml><br><http://zfgjj.laibin.gov.cn/tzgg/t21251858.shtml> |
| 柳州 | 🟡 部分 | — | <http://www.rongshui.gov.cn/wsbs/ggfw/bzxzf_60616/zfgjj/gjjwyb/202602/t20260202_3720106.shtml> |
| 桂林 | ✅ 已核实 | 市政规〔2025〕19号 | <https://www.guilin.gov.cn/hdjl/zsk_3/sb_2/t27211726.shtml><br><http://www.lipu.gov.cn/zfxxgk/fdzdgknr/jcxxgk/shbx/P020260116414794103917.pdf> |
| 梧州 | ✅ 已核实 | — | <http://gxwzgjj.gov.cn/xwzx/tzgg/5233.htm> |
| 河池 | ✅ 已核实 | 河金管[2025]33号 | <http://zfgjj.hechi.gov.cn/zfxxgk/fdzdgknr/gfxwj_01/t27042187.shtml> |
| 玉林 | 🟡 部分 | — | <http://zfgjj.yulin.gov.cn/gzdt/gzdt_50088/t21581486.shtml> |
| 百色 | ✅ 已核实 | 百金管委〔2025〕4号 | <http://zfgjj.baise.gov.cn/zfgg/zcfg/s/t25892499.shtml><br><http://zfgjj.baise.gov.cn/zxdt/tzgg/zxgg/t28112952.shtml> |
| 贵港 | ✅ 已核实 | — | <http://zfgjj.gxgg.gov.cn/xxgk/fdzdgknr/zcfg/zxwj/t26122887.shtml> |
| 贺州 | ✅ 已核实 | — | <http://zfgjj.gxhz.gov.cn/xxgk/zcpf/zcwj/t23365646.shtml> |
| 钦州 | ✅ 已核实 | 钦市金管字〔2025〕34号 | <http://zfgjj.qinzhou.gov.cn/zcfg/dfwj/t23357215.shtml><br><http://zfgjj.qinzhou.gov.cn/zcfg/dfwj/t27074187.shtml> |
| 防城港 | ✅ 已核实 | — | <http://zfgjj.fcgs.gov.cn/zfxxgk/zcwj/t23389594.shtml> |

## 新疆（14 城：已核实 2 / 部分 12 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 乌鲁木齐 | ✅ 已核实 | 乌鲁木齐住房公积金中心 2026 年度缴存基数调整通知（2026-06-26）——上限 35071、月缴存额上限 8418；下限 2070、下限 208 | <https://xjgjj.xjjs.gov.cn/info/1179/26007.htm><br><http://www.wlmq.gov.cn/wlmqs/c119055/202607/f44e534b85c048eea20eca66dd43b01d.shtml> |
| 伊犁 | 🟡 部分 | — | <https://www.xjyl.gov.cn/xjylz/c112799/202607/88f83a6e6da74b2684e5c5343f637aa5.shtml> |
| 克孜勒苏 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/kez/info/1003/5542.htm><br><https://www.xjkz.gov.cn/xjkz/c101718/201911/b99df7eaf00242398417308015cfff44/files/%e5%85%b3%e4%ba%8e%e5%8d%b0%e5%8f%91%e3%80%8a%e8%87%aa%e6%b2%bb%e5%b7%9e%e5%85%a8%e9%9d%a2%e6%8e%a8%e8%bf%9b%e7%94%9f%e8%82%b2%e4%bf%9d%e9%99%a9%e5%92%8c%e8%81%8c%e5%b7%a5%e5%9f%ba%e6%9c%ac%e5%8c%bb%e7%96%97%e4%bf%9d%e9%99%a9%e5%90%88%e5%b9%b6%e5%ae%9e%e6%96%bd%e6%96%b9%e6%a1%88%e3%80%8b%e7%9a%84%e9%80%9a%e7%9f%a5.docx> |
| 克拉玛依 | 🟡 部分 | 克医保规〔2025〕3号 | <https://xjgjj.xjjs.gov.cn/info/1181/25990.htm><br><https://www.klmy.gov.cn/klmys/szfbmxzgfxwj/202604/93cb0b7d614b471f9c9b8db39c030ed9/files/%e5%85%b3%e4%ba%8e%e6%98%8e%e7%a1%ae%e5%85%8b%e6%8b%89%e7%8e%9b%e4%be%9d%e5%b8%82%e8%81%8c%e5%b7%a5%e5%9f%ba%e6%9c%ac%e5%8c%bb%e7%96%97%e4%bf%9d%e9%99%a9%e4%b8%aa%e4%ba%ba%e7%bc%b4%e8%b4%b9%e7%9a%84%e9%80%9a%e7%9f%a5.pdf> |
| 博尔塔拉 | 🟡 部分 | — | <https://www.xjboz.gov.cn/xjboz/c126080/202607/f5979923ddb743a4b8e056f2ce2888cb.shtml><br><https://www.xjboz.gov.cn/xjboz/uploads/20260709151739jmjykcgrk3m.pdf> |
| 吐鲁番 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/tlfdq/info/1066/6506.htm> |
| 和田 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/htdq/info/1119/7309.htm> |
| 哈密 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/hm/info/1037/4354.htm> |
| 喀什 | ✅ 已核实 | — | <https://xjgjj.xjjs.gov.cn/ksdq/info/1066/5166.htm><br><https://www.kashi.gov.cn/ksdqxzgs/c112194/202301/6db7ec967ad54c979c840408f6c89a80.shtml> |
| 塔城 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/tcdq/info/1134/11295.htm> |
| 巴音郭楞 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/baz/info/1066/7290.htm> |
| 昌吉 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/cj/info/1062/8577.htm> |
| 阿克苏 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/aksdq/info/1066/7120.htm> |
| 阿勒泰 | 🟡 部分 | — | <https://xjgjj.xjjs.gov.cn/altdq/info/1066/4377.htm> |

## 江苏（13 城：已核实 10 / 部分 3 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 南京 | ✅ 已核实 | — | <http://www.nanjing.gov.cn/zzb/ywdt/msxx/202607/t20260719_5879428.html> |
| 南通 | 🟡 部分 | 上限 通金管〔2025〕50号（2025-11-21）；下限引用源 通人社发〔2026〕1号（成文 2026-01-06，市区/启东 2660、海安/如皋/如东 2430）；2026 年度公积金件待发布故保留 warn | <https://www.ntgjj.com/NewsDetail.aspx?DetailId=23266828&UrlTowClass=40&UrlOneClass=33><br><https://rsj.nantong.gov.cn/ntsrsj/ldgxgzfl/content/f8f7a735-e179-41ff-bc9e-eea99823adfd.html> |
| 宿迁 | ✅ 已核实 | — | <https://suqian.gov.cn/cnsq/xxgkshbz/202609/0095013013c648e39d1dc312a2f411a6.shtml><br><http://www.suqian.gov.cn/zcwjk/xqbmjd/202609/3e852f20c0d64a02b876ac87a5108597.shtml> |
| 常州 | ✅ 已核实 | 常公积金〔2026〕13号 | <https://www.changzhou.gov.cn/gi_news/787178269536789><br><https://gjj.changzhou.gov.cn/html/gjj/2026/ODOFKMDN_0706/13968.html> |
| 徐州 | ✅ 已核实 | 徐公积金委〔2026〕1号（索引号 466543007/2026-00019，成文 2026-07-15、发布 2026-07-20） | <http://gjj.xz.gov.cn/govxxgk/466543007/2026-07-20/dd03b909-e1a0-475b-be73-030f06dad9a1.html> |
| 扬州 | ✅ 已核实 | 扬金管委〔2026〕3号 | <http://gjjzx.yangzhou.gov.cn/zfxxgk/fdzdgk/bmwj/ybxwj/art/2026/art_f66f9bb4f9ca43f7b7ee63910f0dd9f3.html> |
| 无锡 | 🟡 部分 | 锡房金规〔2026〕2号 | <https://www.wuxi.gov.cn/gjj/doc/2026/08/05/4814421.shtml> |
| 泰州 | 🟡 部分 | — | <http://gjj.taizhou.gov.cn/xwzx/tzgg/art/2025/art_cff5ffd72d4441e49031016a50eeb7cd.html> |
| 淮安 | ✅ 已核实 | 淮房委〔2026〕3号（索引号 HFW-2026-3，发文 2026-03-31、发布 2026-04-03；真实域名 hagjj.com，hagjj.cn 为 502） | <http://www.hagjj.com/website/regulation-detail.html?seqno=2124> |
| 盐城 | ✅ 已核实 | 盐房金管〔2026〕2号 | <http://ycgjj.yancheng.gov.cn/art/2026/7/24/art_6592_4441692.html> |
| 苏州 | ✅ 已核实 | — | <https://www.suzhou.gov.cn/szsrmzf/zwgg/202607/501539493f89439aa33768e34a069914.shtml> |
| 连云港 | ✅ 已核实 | — | <http://www.lyg.gov.cn/zglygzfmhwz/gcyw/content/50608415-38c6-41e1-8b38-b0f41d8f2548.html> |
| 镇江 | ✅ 已核实 | — | <https://gjj.zhenjiang.gov.cn/zxxx/xwdt/202607/d57b38dd605c4dceae86409fa39b914d.html> |

## 江西（11 城：已核实 9 / 部分 0 / 未找到 2 / 未取得 2）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 上饶 | ✅ 已核实 | 饶房金管委〔2026〕3号（上饶市住房公积金管理委员会，成文 2026-07-06，文件有效期「有效」） | <https://gjj.zgsr.gov.cn/gjj/qtygwj/202607/d6380d5556a345369627e1f6c62227eb.shtml> |
| 九江 | ✅ 已核实 | 九医保字〔2026〕22号（九江市医疗保障局 九江市财政局 国家税务总局九江市税务局，2026-07-27） | <http://ybj.jiujiang.gov.cn/zwgk_209/zcfg/zcwj/202607/t20260727_7281168.html><br><http://ybj.jiujiang.gov.cn/zwgk_209/zcfg/zcjd/202607/t20260729_7282872.html> |
| 南昌 | ✅ 已核实 | 《关于调整2026年度住房公积金缴存基数的通知》（南昌住房公积金管理中心，2026-06-26 发布） | <https://www.nc.gov.cn/ncszf/jrnca/202606/126cdce0ef1d47a8932976f0c9f9901a.shtml><br><https://www.jxzfgjj.cn/jxszfbzhgjjglzx/tzgg/pc/content/content_2071479115830697984.html> |
| 吉安 | ✅ 已核实 | 《吉安市住房公积金中心关于调整2026年度住房公积金缴存基数和月缴额上限的通知》（2026-07-02，正文未列文号） | <http://zfgjj.jian.gov.cn/news-show-1589.html> |
| 宜春 | ✅ 已核实 | 宜金发〔2026〕16号（宜春市住房公积金管理中心） | <https://gjj.yichun.gov.cn/gzdt/tzgg/1792.htm><br><https://gjj.yichun.gov.cn/upload/CMSycgjj/202607/20260729c17263am9y.png> |
| 抚州 | ✅ 已核实 | 抚公金字〔2026〕42号（抚州市住房公积金管理中心，2026-06-30） | <https://gjj.jxfz.gov.cn/zcfg/2639.htm><br><https://gjj.jxfz.gov.cn/upload/CMSfzgjj/202606/20260630wtb6qq0q8s.png> |
| 新余 | ✅ 已核实 | 《新余市住房公积金管理委员会关于调整我市2026年度住房公积金月缴存额上下限的通知》（2026-07-01 发布，正文未列文号） | <https://gjj.xinyu.gov.cn/gjj/bstjd/2026-07/01/content_6818baa79afe492691a0054a1596bfff.shtml> |
| 景德镇 | ⚠️ 未找到 | — | — |
| 萍乡 | ⚠️ 未找到 | — | — |
| 赣州 | ✅ 已核实 | 赣市公管委字〔2026〕4号（赣州市住房公积金管理委员会，2026-07-16） | <https://zfgjj.ganzhou.gov.cn/gzszfjj/c103430/202607/616e6f447b994708997219f5e2e1748f.shtml> |
| 鹰潭 | ✅ 已核实 | 鹰医保字〔2026〕27号（市医保局、市财政局、市税务局联合印发；鹰潭市政府网 2026-07-31 发布，索引号 Y00035/2026-04490） | <http://www.yingtan.gov.cn/art/2026/7/31/art_13034_1609845.html> |

## 河北（11 城：已核实 6 / 部分 3 / 未找到 2 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 保定 | ✅ 已核实 | 页面未显示文号（《保定市职工基本医疗保险参保缴费七问七答》，2025-03-12 发布，徐水区政府信息公开转载保定市政策） | <https://xushui.gov.cn/zfxxgk/fdzdgknr/zdly/yb/666154467123269.html> |
| 唐山 | ✅ 已核实 | 费率页未显示文号（唐山市医疗保障局《医保问答Ⅰ 关于城镇职工医保基金征缴》）；基数文件为唐医保函〔2025〕56号 | <https://tsyb.tangshan.gov.cn/tssylbzj/zhengxundiancha/20230606/1529752.html><br><https://tsyb.tangshan.gov.cn/tssylbzj/tzgg/20250707/1633896.html> |
| 廊坊 | 🟡 部分 | 页面未显示文号（《廊坊市职工基本医疗保险实施办法》等四个办法政策解读，发布机构：市医疗保障局） | <https://zfxxgk.lf.gov.cn/GKNR/Detail?infoId=1BCA51D4-8758-4806-B16C-651837B6FFD0> |
| 张家口 | ✅ 已核实 | 页面未显示文号（《张家口市医疗保障局岗位工作细则百问百答》，市医保局编、市政府网发布，PDF 共 36 页） | <https://www.zjk.gov.cn/content/clientDf.do?id=7389885> |
| 承德 | 🟡 部分 | 附件未显示文号（承德市医疗保障局官网附件 1《承德市职工生育保险待遇网厅申报流程》） | <https://ylbzj.chengde.gov.cn/module/download/downfile.jsp?classid=0&filename=432f5e50bac34974ab56a88ea8436935.docx> |
| 沧州 | ✅ 已核实 | 页面未显示文号（《沧州市2026年城镇职工基本医疗保险政策问答》；运河区医保局职工基本医疗保险政策解读） | <https://www.renqiu.gov.cn/renqiu/yibao10001/202605/9d59f5a051de4251adf7d67db0a1331d.shtml><br><http://www.czyh.gov.cn/czyh/c116058/202402/87836ab822004218bbd874611018aeeb.shtml> |
| 石家庄 | 🟡 部分 | 石医保规〔2025〕1号；石公积金〔2026〕10号 | <http://www.gc.gov.cn/attachments/1/202501/08/%E3%80%8A%E7%9F%B3%E5%AE%B6%E5%BA%84%E5%B8%82%E7%94%9F%E8%82%B2%E4%BF%9D%E9%99%A9%E5%92%8C%E8%81%8C%E5%B7%A5%E5%9F%BA%E6%9C%AC%E5%8C%BB%E7%96%97%E4%BF%9D%E9%99%A9%E5%90%88%E5%B9%B6%E5%AE%9E%E6%96%BD%E7%BB%86%E5%88%99%E7%9A%84%E9%80%9A%E7%9F%A5%E3%80%8B%E7%9F%B3%E5%8C%BB%E4%BF%9D%E8%A7%84%E3%80%942025%E3%80%951%E5%8F%B720250108141747807.pdf><br><https://ylbzj.sjz.gov.cn/columns/7f27cdcc-b3a2-4b3b-8c5b-0f64ef7304a1/202501/09/66804da3-d432-4379-984c-da4a7bba7c52.html> |
| 秦皇岛 | ✅ 已核实 | 页面未显示文号（秦皇岛市职工基本医疗保险政策问答（一）） | <https://qhd.gov.cn/index/zwgk/article_detail.html?id=134431> |
| 衡水 | ⚠️ 未找到 | 衡医保承〔2025〕10号（关于政协衡水市第七届委员会第五次会议第62号提案的答复） | <http://xxgk.hengshui.gov.cn/eportal/fileDir/hssxxgk/resource/cms/article/2421183/3119022/2025071009470884488.docx> |
| 邢台 | ✅ 已核实 | 页面未显示文号（《邢台市职工基本医疗保险和生育保险实施办法》，邢台市政府信息公开「关于印发…的通知」） | <http://info.xingtai.gov.cn/single/100/384318.html> |
| 邯郸 | ⚠️ 未找到 | 两份市政府公报/部门文件 PDF 均未显示可读文号（费率数字亦不可读） | <https://www.hd.gov.cn/hdzfxxgk/zfgb/gb2017/202003/P020230414521948056863.pdf><br><https://www.hd.gov.cn/hdzfxxgk/gszbm/auto28831/202101/P020210111347687609781.pdf> |

## 河南（17 城：已核实 1 / 部分 16 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 三门峡 | 🟡 部分 | — | <http://gjj.smx.gov.cn/139708/2026/8/2300022.html> |
| 信阳 | 🟡 部分 | — | <https://www.xygjj.cn/c201/3588.html> |
| 南阳 | 🟡 部分 | — | <https://zfgjj.nanyang.gov.cn/2026/08-14/1426656.html> |
| 周口 | 🟡 部分 | — | <http://lyxzfgjj.cn/Article/Details?id=496> |
| 商丘 | 🟡 部分 | 商公积金委〔2026〕9号 | <https://www.shangqiu.gov.cn/xw/gsgg/content_309516> |
| 安阳 | 🟡 部分 | — | <https://ybj.anyang.gov.cn/2024/09-08/2448262.html> |
| 平顶山 | 🟡 部分 | — | <http://gjj.pds.gov.cn/contents/31802/469116.html> |
| 开封 | 🟡 部分 | 汴住金管〔2026〕23号（公积金）；汴政办〔2023〕38号（职工大额医疗费用补助暂行办法） | <http://gjj.kaifeng.gov.cn/kfsgjjglzxwz/gjjctzgg/pc/content/content_2079479374577971200.html><br><https://www.kaifeng.gov.cn/kfsrmzfwz/szfbx/pc/content/content_1750799455527022592.html> |
| 新乡 | 🟡 部分 | — | <https://cx.xxzfgjj.com/zcjds/2049.html> |
| 洛阳 | 🟡 部分 | — | <https://www.henan.gov.cn/2023/01-06/2667985.html> |
| 漯河 | 🟡 部分 | — | <https://gjj.luohe.gov.cn/zxdt/content_1037477> |
| 濮阳 | 🟡 部分 | — | <http://pygjj.puyang.gov.cn/wzdt/4192.jhtml> |
| 焦作 | 🟡 部分 | — | <https://m.henan.gov.cn/2026/08-11/3397778.html> |
| 许昌 | 🟡 部分 | — | <https://xuchang.gov.cn/ywdt/001005/20260721/a5d026c4-5dd0-42e1-965d-c108d9c2d7a5.html> |
| 郑州 | 🟡 部分 | — | <https://zzgjj.zhengzhou.gov.cn/zxindt/10197372.jhtml><br><https://public.zhengzhou.gov.cn/D3602Y/10200403.jhtml> |
| 驻马店 | ✅ 已核实 | — | <https://gjj.zhumadian.gov.cn/tzggwj/20305.jhtml><br><https://www.zhumadian.gov.cn/zwgk/zfwj_zwgk/zzb/2026n_zzb/202604/t20260420_697440.html> |
| 鹤壁 | 🟡 部分 | 鹤公积金〔2026〕8号 | <https://www.hbsgjj.cn/tzgg/2228.jhtml> |

## 浙江（11 城：已核实 7 / 部分 3 / 未找到 1 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 丽水 | 🟡 部分 | 《丽水市住房公积金管理中心关于调整2026年度市区企业单位住房公积金缴存基数的通知》（2026-06-23，未标注文号） | <http://gjj.lishui.gov.cn/col/col1229253586/art/2026/art_78c41305da1a4ba595cc0145e327465a.html> |
| 台州 | ✅ 已核实 | 台房金函〔2023〕9号（上位依据）；《关于开展2026年度住房公积金缴存基数调整和年度验审工作的通知》（台州市住房公积金管理中心，2026-07-13） | <https://gjj.zjtz.gov.cn/col/col1229045868/art/2026/art_858a3e9024c04ea6b4d1f9864de0abaf.html> |
| 嘉兴 | ✅ 已核实 | 无文号（嘉兴市住房公积金管理服务中心《关于开展2026年度住房公积金缴存基数调整工作的通知》，2026-07-31） | <https://gjj.jiaxing.gov.cn/col/col1229354688/art/2026/art_4cd733d0bd0b45f1a3fd3865cefefcf6.html> |
| 宁波 | 🟡 部分 | 无文号（宁波市住房和城乡建设局「2026住房公积金基数调整专栏」常见问题解答，2026-06-12） | <http://zjw.ningbo.gov.cn/col/col1229126193/art/2026/art_df1215891b544394b3d8c3cab8338338.html> |
| 杭州 | ✅ 已核实 | 无文号（杭州住房公积金管理中心《杭州市2026年度住房公积金调整工作问题解答》，2026-07-28，索引路径 col1229810545） | <https://gjj.hangzhou.gov.cn/col/col1229810545/art/2026/art_a66f73ccb67f4176ab91a1af60b05c1a.html> |
| 温州 | ✅ 已核实 | 无文号（温州市住房公积金管理中心《关于开展2026年度住房公积金月缴存额调整的通知》，2026-09-02发布页） | <https://zfgjj.wenzhou.gov.cn/col/col1229322000/art/2026/art_fd85adf3b33f40d1b71719996c87c4d0.html> |
| 湖州 | ✅ 已核实 | 无文号（湖州市政府网《2026年度住房公积金缴存基数调整开启》，2026-08-25，信息来源：湖州日报；配套：湖州市住房公积金管理中心官网《2026年度住房公积金缴存基数调整和年 | <http://www.huzhou.gov.cn/col/col1229213482/art/2026/art_4064054536634078ae0cd08dea60bc26.html><br><http://hzgjj.huzhou.gov.cn/col/col1229208757/art/2026/art_84367e5716e34f599ad3ef863e23f5fa.html> |
| 绍兴 | ✅ 已核实 | 无文号（新昌县人民政府官网《2026年度住房公积金缴存基数调整申报中》，转述绍兴市住房公积金管理中心统一部署，2026-08） | <http://www.zjxc.gov.cn/col/col1229003749/art/2026/art_c8aa12ac0349444c939753cdaea5e6e5.html> |
| 舟山 | ⚠️ 未找到 | — | <http://zsgjj.zhoushan.gov.cn/> |
| 衢州 | ✅ 已核实 | 《衢州市住房公积金中心关于开展2026年度住房公积金缴存基数调整和年度验审工作的通知》（2026-07-10成文，2026-07-13发布，索引号12330800471863945 | <https://www.qz.gov.cn/col/col1229040189/art/2026/art_1a36ea785890401db76b983c92741cd2.html> |
| 金华 | 🟡 部分 | 金政发〔2026〕9号（最低工资依据）；《关于调整住房公积金缴存基数下限的通知》（金华市住房公积金管理中心，2026-04-01）；《关于调整2026年度住房公积金缴存基数的公告》 | <http://zfgjj.jinhua.gov.cn/col/col1229318752/art/2026/art_de29b13743184167b754e4fc60dd9572.html><br><http://zfgjj.jinhua.gov.cn/col/col1229318752/art/2026/art_7c281c0165b945cd91dcea04c780b5c0.html> |

## 海南（4 城：已核实 0 / 部分 4 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 三亚 | 🟡 部分 | 《海南省住房公积金管理局关于2026年度住房公积金缴存基数范围的通告》（2026-06-26） | <http://gjj.hainan.gov.cn/hngjj/0400/202606/6c0e853d7a0e4df1a06eb2e66534de94.shtml><br><https://www.sanya.gov.cn/sanyasite/zwdt/202512/c1870e6eb5334156897b42c194feb34a.shtml> |
| 三沙 | 🟡 部分 | 《海南省住房公积金管理局关于2026年度住房公积金缴存基数范围的通告》（2026-06-26） | <http://gjj.hainan.gov.cn/hngjj/0400/202606/6c0e853d7a0e4df1a06eb2e66534de94.shtml> |
| 儋州 | 🟡 部分 | 《海南省住房公积金管理局关于2026年度住房公积金缴存基数范围的通告》（2026-06-26） | <http://gjj.hainan.gov.cn/hngjj/0400/202606/6c0e853d7a0e4df1a06eb2e66534de94.shtml> |
| 海口 | 🟡 部分 | 《海南省住房公积金管理局关于2026年度住房公积金缴存基数范围的通告》（2026-06-26，未标注文号） | <http://gjj.hainan.gov.cn/hngjj/0400/202606/6c0e853d7a0e4df1a06eb2e66534de94.shtml> |

## 湖北（13 城：已核实 6 / 部分 6 / 未找到 1 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 十堰 | ✅ 已核实 | 十堰住房公积金中心《关于调整2026年度住房公积金缴存基数、比例的通知》（2026-06-23，未标注文号） | <http://gjj.shiyan.gov.cn/fwzn/gjyw/202606/t20260623_4949939.shtml><br><https://www.shiyan.gov.cn/fw/ztfw/zfly/ggj/wjtz/202607/t20260723_4973178.shtml> |
| 咸宁 | ✅ 已核实 | 《关于调整2026年度住房公积金缴存基数的通知》（咸宁市住房公积金中心，2026-06-29，未标注文号） | <http://www.xianning.gov.cn/wsbs/zf/gjj/zcwj/202606/t20260629_4970773.shtml> |
| 孝感 | 🟡 部分 | 无文号（孝感市住房公积金管理委员会关于调整2026年度住房公积金缴存基数的通知）；孝医保发〔2021〕5号（孝感市职工基本医疗保险实施细则） | <http://xggjj.xiaogan.gov.cn/gsgg/2134817.jhtml><br><http://xggjj.xiaogan.gov.cn/gsgg/2115115.jhtml> |
| 宜昌 | ✅ 已核实 | 《宜昌住房公积金中心关于调整2026年度住房公积金缴存基数的通知》（2026-08-25，未标注文号） | <http://gjj.yichang.gov.cn/content-55762-6534-1.html> |
| 恩施 | 🟡 部分 | — | <http://ybj.enshi.gov.cn/zfxxgk/zc/zcjd/202506/t20250617_1709958.shtml> |
| 武汉 | 🟡 部分 | — | <https://www.dxh.gov.cn/ZWGK/QZFXXGKML/GGFWXX_devsavepath/SHBZ_devsavepath/ylbz/202509/t20250925_2652461.shtml> |
| 荆州 | ⚠️ 未找到 | — | <https://zw.jingzhou.gov.cn/upload/default/bigfile/2026/06/26/20260626_361a649f9a8daaa41bbe0222b922fdc3.pdf> |
| 荆门 | ✅ 已核实 | 荆门住房公积金中心《关于做好2026年度住房公积金缴存基数核定工作的通知》（2026-06-20，未标注文号） | <http://zfgjj.jingmen.gov.cn/art/2026/6/20/art_5015_1224922.html> |
| 襄阳 | ✅ 已核实 | 襄公积金发〔2026〕5号 | <http://gjj.xiangyang.gov.cn/bsfw/gjjjc/202607/t20260706_4027041.shtml> |
| 鄂州 | 🟡 部分 | — | <https://gjj.ezhou.gov.cn/xwdt/tzgg/202606/t20260629_769638.html> |
| 随州 | 🟡 部分 | 随政发〔2023〕21号 | <http://www.suizhou.gov.cn/zwgk/zfwj/szbf/szf/shbz/202312/P020231222333267269694.docx> |
| 黄冈 | ✅ 已核实 | 黄房金函〔2026〕8号 | <https://gjj.hg.gov.cn/zwgk/public/6636168/1741290.html> |
| 黄石 | 🟡 部分 | 《【缴存类】关于黄石市2026年住房公积金缴存基数调整工作的通知》（黄石市住房公积金中心，2026-06-23） | <http://gjj.huangshi.gov.cn/zwgk/zc/qtzdgkwj/202606/t20260623_1336986.html> |

## 湖南（14 城：已核实 7 / 部分 4 / 未找到 3 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 娄底 | ⚠️ 未找到 | — | <https://www.ldgjj.com/> |
| 岳阳 | ✅ 已核实 | （岳阳市住房公积金管理委员会办公室《关于发布2026年度住房公积金缴存标准的通知》，正文未列文号；依据岳统发〔2026〕2号） | <https://gjj.yueyang.gov.cn/43061/43063/index.htm><br><https://mp.weixin.qq.com/s/IEr6teNsbsRGNc9bGjhyLw> |
| 常德 | ⚠️ 未找到 | — | <https://www.cdsgjj.com.cn/> |
| 张家界 | 🟡 部分 | 未取得缴存基数件（中心仅有网上服务大厅，无内容站） | <https://www.zjjzfgjj.com/wt-web/login><br><https://www.zjjzfgjj.com/wt-web-gr/grlogin> |
| 怀化 | ✅ 已核实 | （依据《怀化市住房公积金管理委员会关于对〈怀化市住房公积金管理中心关于调整2026年度怀化市住房公积金月缴存限额的请示〉的批复》；新闻页未列批复文号） | <http://www.huaihua.gov.cn/gjj/c108768/202608/196e2ab51a1b4ff4b4c8f7cf73a5f6a6.shtml> |
| 株洲 | ✅ 已核实 | — | <http://gjj.zhuzhou.gov.cn/c5375/20260901/i2524327.html><br><http://gjj.zhuzhou.gov.cn/zzcms/DFS//file/2026/09/01/20260901163938357r75xp4.png> |
| 永州 | ✅ 已核实 | （永州市住房公积金管理中心《关于调整2026年度住房公积金月缴存额的通知》，正文未列文号） | <http://admin.yzcity.gov.cn:8888/gjj/0201/202607/17312a972f12484eb90d0aafa85dc649.shtml> |
| 湘潭 | ✅ 已核实 | 潭金管办〔2026〕1号 | <http://www.xiangtan.gov.cn/109/181/content_1444877.html><br><http://wz.xtzfgjj.org.cn/15651/15657/15670/content_1448032.html> |
| 湘西 | ✅ 已核实 | （湘西自治州住房公积金管理中心《关于2026年住房公积金缴存核定工作的通知》，正文未列文号；依据湘金监管办〔2007〕10号） | <https://www.xxgjj.com/xxgk/zxgg/2654.htm> |
| 益阳 | ⚠️ 未找到 | — | <http://www.yygjj.cn/27391/27394/content_2151997.html> |
| 衡阳 | 🟡 部分 | 未取得缴存基数件（门户 JS 挑战 WAF 拦截，本环境不可达） | <https://www.hengyang.gov.cn/hyszfgjj/xxgk/gzdt/tzgg/> |
| 邵阳 | 🟡 部分 | 邵金管字〔2026〕2号（提取/贷款政策优化）、邵金管字〔2026〕3号（装修提取与贷款试行办法）；均不含缴存基数上下限 | <https://www.shaoyang.gov.cn/shaoyang/szbmgfxwj/202606/cae8af265d994a4a987d6bf1b104165a.shtml><br><https://www.shaoyang.gov.cn/shaoyang/szbmgfxwj/202606/a778f01f30494b3aabf146454624d8dd.shtml> |
| 郴州 | 🟡 部分 | 未取得缴存基数件（门户 JS 挑战 WAF 拦截，本环境不可达） | <https://gjj.czs.gov.cn/> |
| 长沙 | ✅ 已核实 | 湘人社规〔2026〕14号（社保基数）；公积金调整通知正文未列文号 | <http://gjjzx.changsha.gov.cn/xxgk/tzgg/202607/t20260708_12456063.html><br><https://www.hunan.gov.cn/hnszf/hnyw/sy/hnyw1/202607/t20260710_34023538.html> |

## 甘肃（14 城：已核实 7 / 部分 7 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 临夏 | 🟡 部分 | 临夏州住房公积金归集管理暂行办法（2026-03-12，只给规则无数值） | <https://www.linxia.gov.cn/lxz/zwgk/fdzdgknr/lzyj/gfxwj/art/2026/art_622d74903e784e08ab2dd2ba20c8de5e.html> |
| 兰州 | ✅ 已核实 | 兰住金〔2026〕27号（公积金）；兰州市医保局《关于兰州市基本医疗保险参保有关工作的通知》（2024-12-30） | <http://gjj.lanzhou.gov.cn/module/download/downfile.jsp?classid=0&filename=5e10c9533b424e4495b8def14c791f0f.pdf><br><http://ybj.lanzhou.gov.cn/art/2024/12/30/art_15083_1429283.html> |
| 嘉峪关 | 🟡 部分 | 嘉公积金管字〔2025〕46号（2025 年度，值为图片未取得）；2026 年度通知 2026-06-23 已发布但文章页 404 | <http://www.jyg.gov.cn/gjj/xwdt/tzgg/index.html> |
| 天水 | 🟡 部分 | 无（《天水市职工基本医疗保险和生育保险实施办法》，经秦安县人民政府网站附件发布） | <http://www.qinan.gov.cn/system/_content/download.jsp?urltype=news.DownloadAttachUrl&owner=1915696710&wbfileid=358C9439C11A9F7F0F4F89E3C8025186> |
| 定西 | 🟡 部分 | 无（《关于调整定西市2026年度住房公积金缴存基数上下限的通知》，2026-07-03） | <http://www.dingxi.gov.cn/art/2026/7/3/art_16450_1901740.html> |
| 平凉 | 🟡 部分 | 无（《平凉市城镇职工基本医疗保险市级统筹实施办法》PDF） | <https://www.pingliang.gov.cn/api-gateway/jpaas-web-server/front/document/download?fileUrl=YW5UzzlvCwcM%2FNHHX%2FtT6ACIBeK%2BsM0iTghqPyVx77WQiwLVaifMf36eUaT2IdIwLFI56sbV8VN5QsN%2FjQSq%2B%2FhjuNZ95eetEOLzWEiveGzEAvFVOioxthmZkmXxi3oRHZXkVR0jSaOS1H1DBGiVvqFBcyxmdbhjpU65tbL8R2o%3D> |
| 庆阳 | ✅ 已核实 | 甘医保发〔2025〕68号（庆阳市医疗保障局转发） | <https://ylbz.zgqingyang.gov.cn/xwzx/tzgg/content_341891> |
| 张掖 | ✅ 已核实 | 张住委办发〔2025〕4号（索引号 620700084/2025-00106） | <https://www.zhangye.gov.cn/zyszfxxgk/zfwj_5652/bmwj_5656/202511/t20251104_1473379.html> |
| 武威 | ✅ 已核实 | 无文号（武威市住房公积金管理中心，2026-06-12 落款、2026-07-02 发布）；下限依据 甘政办发〔2025〕71号 | <http://zfgjj.gswuwei.gov.cn/art/2026/7/2/art_3395_1644950.html> |
| 甘南 | ✅ 已核实 | 无文号（甘南州 2026 年度住房公积金缴存基数上下限通告，2026-07-08） | <https://zwfw.gansu.gov.cn/gannan/zxfb/art/2026/art_d99034a3ff4b47c7a1f6517f6f3a2333.html> |
| 白银 | 🟡 部分 | 无（白银市政府网站政策解读，2023-10-10，索引号 11620400013911137A/2023-139806） | <https://www.baiyin.gov.cn/zc/zcjd/szcjd9596/art/2023/art_0a0814825fc54df9a004b2388aa95659.html> |
| 酒泉 | 🟡 部分 | 无（酒泉市医疗保障政策·职工篇，2022-08，经肃北县政府网站发布） | <https://www.subei.gov.cn/suBei/c101531/202208/7cecca4409604aff8441364f1f854e9d.shtml> |
| 金昌 | 🟡 部分 | 无（政策解读栏目页，未标注文号） | <http://ylbz.jcs.gov.cn/zfxxgk/fdzdgknr/zcjd/art/2025/art_5bfda37d432642609bf94a39aa51ac05.html> |
| 陇南 | 🟡 部分 | 无（陇南市人民政府办公室文件 PDF，未解析） | <https://www.longnan.gov.cn/group2/M00/21/9F/Ch4MtWp5Ou-ALxDvAANxDOjNF28640.pdf> |

## 直辖市（4 城：已核实 3 / 部分 1 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 上海 | ✅ 已核实 | 沪医保规〔2026〕2号（医保费率）；基数上下限为上海市人社局 2026-08-18 公示 | <https://rsj.sh.gov.cn/tgsgg_17341/20260818/t0035_1443203.html><br><https://ybj.sh.gov.cn/gfxwj/20260313/921e047144694b61b6df8ca0c5ef2cfc.html> |
| 北京 | ✅ 已核实 | 京人社发〔2026〕7号（社保基数）；京房公积金管委会办〔2026〕6号（公积金） | <https://ybj.beijing.gov.cn/zwgk/2024zcwj/202608/t20260824_4834004.html><br><https://www.beijing.gov.cn/zhengce/zhengcefagui/202608/t20260821_4831679.html> |
| 天津 | ✅ 已核实 | 津人社局发〔2026〕5号（工资福利待遇标准）；津医保规字〔2026〕1号（医保费率）；公积金为《关于调整2026年住房公积金缴存额的通知》 | <https://tianjin.chinatax.gov.cn/11200000000/0300/030004/03000419/p20260824171546537.shtml><br><https://www.tj.gov.cn/zwgk/szfgb/xqk/2026/12/bmgfxwj/202607/t20260703_7329233.html> |
| 重庆 | 🟡 部分 | 重庆市人社局/财政局/医保局/税务局《关于做好2026年度社会保险缴费基数上下限核定有关工作的通知》（2026-09-20，重庆市税务局发布，文号未取到） | <https://chongqing.chinatax.gov.cn//cqtax/xxgk/tzgg/202609/t20260920_386257.html><br><https://ylbzj.cq.gov.cn/igixmj/xjgk/202601/tGovMsgBox_1100403.html> |

## 福建（9 城：已核实 3 / 部分 2 / 未找到 4 / 未取得 4）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 三明 | 🟡 部分 | 无（三明市住房公积金管理委员会《关于公布2026年度住房公积金缴存标准的通知》，2026-06-25） | <http://www.sanming.gov.cn/zw/ztzl/smszfgjjzt/zcfg_21865/dfxzcfg/202606/t20260625_2231863.htm> |
| 南平 | ✅ 已核实 | 南房金委〔2026〕5号（上限23617=年平94466÷12×3）、南房金委〔2025〕2号（下限2045/1895分档） | http://www.npgjj.com/cms/html/npszfgjjglzx/2026-06-29/1640348984.html |
| 厦门 | ✅ 已核实 | 无（厦门市住房公积金中心通知，未标注文号） | <http://gjj.xm.gov.cn/zcfg/zfgjjgwhwj/2026n/202606/t20260629_3003625.htm><br><http://gjj.xm.gov.cn/zwgk/zwdt/202606/t20260629_3003570.htm> |
| 宁德 | ✅ 已核实 | 宁房金管〔2026〕4号（上限27166，最高月缴存额6520；下限蕉城/福安/福鼎2045、其余6县1895） | https://gjj.ningde.gov.cn/zcfg/tzgg/202606/t20260618_2465316.htm |
| 泉州 | 🟡 部分 | 无（《泉州市基本医保管理规定》，2023-01 发布，DOCX/PDF 双版本） | <http://www.quanzhou.gov.cn/zfb/xxgk/zfxxgkzl/zfxxgkml/srmzfxxgkml/fpjyylshzc/202301/P020230110396996704216.docx><br><http://www.quanzhou.gov.cn/zfb/xxgk/zfxxgkzl/zfxxgkml/srmzfxxgkml/fpjyylshzc/202301/P020230110396997210505.pdf> |
| 漳州 | ✅ 已核实 | 闽医保函〔2026〕65号（漳州市医疗保障局转发） | <http://ybj.zhangzhou.gov.cn/cms/html/zzsylbzj/2026-06-30/168065898.html> |
| 福州 | ✅ 已核实 | 榕公积金管委〔2026〕2号（公积金）；医保基数依据闽医保函〔2026〕65号 | <https://ybj.fuzhou.gov.cn/zwgk/tzgg/202607/t20260701_5341143.htm><br><http://zfgjj.fuzhou.gov.cn/zwgk/gzdt/tzgg/202606/t20260630_5341026.htm> |
| 莆田 | ✅ 已核实 | 莆房金委〔2026〕6号（上限=2025年莆田城镇非私营月均7995×3=23985，下限2045） | http://www.putian.gov.cn/ptgjj/xxgk/zfgjjywzc/202606/t20260626_2222648.htm |
| 龙岩 | ✅ 已核实 | 龙住公〔2026〕14号（上限28559=年平114234÷12×3；下限市区2195、漳平/永定/上杭2045、武平/长汀/连城1895） | http://www.longyan.gov.cn/zt/rdzt/zfgjjzx/gjjzcfg/202606/t20260626_2299060.htm |

## 西藏（7 城：已核实 3 / 部分 4 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 山南 | 🟡 部分 | 无（山南市住房和城乡建设局为官方归集主管机关，站内四栏未见缴存基数件） | <http://zjj.shannan.gov.cn/> |
| 拉萨 | ✅ 已核实 | 无（拉萨市住房资金管理中心 2026 年度缴存基数调整，经西藏自治区人民政府网站发布） | <https://www.xizang.gov.cn/xwzx_406/dsdt/202607/t20260701_547790.html><br><https://lasa.xzdw.gov.cn/xwzx_359/lsyw/202606/t20260629_680860.html> |
| 日喀则 | 🟡 部分 | 无（日喀则市住房和城乡建设局住房资金管理中心 关于住房公积金若干政策的公告） | <http://zjj.rikaze.gov.cn/news-detail.thtml?cid=393525> |
| 昌都 | ✅ 已核实 | 无（昌都市住房公积金管理中心 2026-06-30 缴存基数调整通知；下限依据 藏政办函〔2025〕25号，上限 43049、月缴存额上限 10332） | <https://zjj.changdu.gov.cn/cdszfycxjsj/c102727/202606/75be93ee83de4998b6f7885c88610c5d.shtml> |
| 林芝 | ✅ 已核实 | 无（林芝市住房资金管理中心通知；下限依据 藏政办函〔2025〕25号） | <https://gaj.linzhi.gov.cn/lzsgaj/c106581/202607/0fc3bd101943444fafb75ed21b08edd8.shtml> |
| 那曲 | 🟡 部分 | 无（那曲市住房和城乡建设局站内法定主动公开各栏目最新止于 2022 年，未见缴存基数件） | <http://zjj.naqu.gov.cn/> |
| 阿里 | 🟡 部分 | 无（阿里地区门户域名未定位，归集主管机关为地区住房和城乡建设局；仅见灵活就业办法征求意见稿，按纪律不予采信） | <http://zjt.xizang.gov.cn/> |

## 贵州（9 城：已核实 5 / 部分 4 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 六盘水 | ✅ 已核实 | 六盘水市住房公积金管理中心《关于调整六盘水市2026年度住房公积金缴存基数上下限标准的通知》（2026-07-14） | <http://gjj.gzlps.gov.cn/yqgg/202607/t20260714_90618839.html> |
| 安顺 | ✅ 已核实 | 安顺市住房公积金管理中心《关于做好2026年度住房公积金缴存基数和缴存比例调整工作的通知》（2026-06-22） | <https://gjj.anshun.gov.cn/tzgg_73070/202606/t20260622_90544472.html> |
| 毕节 | ✅ 已核实 | 毕节市住房公积金管理中心《关于明确2025年度住房公积金缴存基数上限及做好2026年度缴存基数调整的通知》（2026-07-10） | <https://www.bijie.gov.cn/bm/bjszfgjjglzx/dt/tzgg/202607/t20260713_90616062.html> |
| 贵阳 | ✅ 已核实 | 贵阳市医疗保险费用结算中心《关于调整贵阳贵安2026年度城镇职工基本医疗保险缴费基数的通知》（2026-07-29，正文未见文号）；贵阳市住房公积金管理中心《贵阳市2026年住房公 | <https://ybj.guiyang.gov.cn/zfxxgk/fdzdgknr/flfg/202607/t20260729_90673091.html><br><https://www.guizhou.gov.cn/home/rdgz/202607/t20260731_90679553.html> |
| 遵义 | 🟡 部分 | 遵义市住房公积金管理中心《关于发布2026-2027年度遵义市住房公积金缴存基数和月缴存额上下限的通知》（2026-07-27） | <http://zfgjj.zunyi.gov.cn/zxdt/tzgg/202607/t20260727_90663568.html><br><https://www.zunyi.gov.cn/ztzl/cxzt/zffw/gjjxgfw/jcyw/202603/t20260311_89647465.html> |
| 铜仁 | 🟡 部分 | 《2025-2026年度铜仁市住房公积金缴存比例及缴存基数执行标准的通知》（2025-08-26） | <https://www.trs.gov.cn/zwgk/zdlyxxgk/cxjs/zfgjjjg/202508/t20250826_88520596.html><br><https://www.trs.gov.cn/zwgk/zdlyxxgk/cxjs/zfgjjjg/> |
| 黔东南 | 🟡 部分 | 黔东南州住房公积金管理中心《关于做好2026年度住房公积金缴存基数调整工作的通知》（2026-06-29） | <https://www.qdnzgjj.cn/xwzx_5823889/tzgg/202606/t20260629_90563644.html><br><https://www.qdnzgjj.cn/zwgk_5823900/xxgkml/zcfg/zcjd/202606/t20260629_90565982.html> |
| 黔南 | ✅ 已核实 | 黔南州住房公积金管理中心《关于调整2026年住房公积金缴存基数及缴存额上下限标准的通知》（2026-07-08）；《黔南州职工基本医疗（生育）保险实施办法》（2026-02-13印 | <http://gjj.qiannan.gov.cn/xwzx/tzgg/202607/t20260708_90596775.html><br><https://www.qiannan.gov.cn/ztzl/gzhgfxwjsjk_0263/gfxwjsjk/zrmzfbgs_5816214/202602/t20260213_89515255.html> |
| 黔西南 | 🟡 部分 | 黔西南州住房公积金管理中心《关于做好2026年度缴存基数调整工作的通知》（2026-07-01） | <https://qxnzfgjj.gz.cn/tzgg/202607/t20260701_90576056.html> |

## 辽宁（14 城：已核实 7 / 部分 7 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 丹东 | 🟡 部分 | 未取到（丹东市住房公积金管理中心工作动态栏目页） | <https://www.ddzfgjj.com/gzdt/38255.jhtml> |
| 大连 | 🟡 部分 | 国家税务总局大连市税务局《关于调整职工基本医疗保险和生育保险征缴方式的通知》（2025-09-30） | <https://dalian.chinatax.gov.cn/art/2025/9/30/art_1715_672090.html> |
| 抚顺 | 🟡 部分 | 抚政办规〔2026〕3号 | <https://fsyb.fushun.gov.cn/001/001001/20260319/58559cdd-dd82-4c31-82ea-9299094567da.html><br><https://www.fushun.gov.cn/zwgk/002011/002011011/002011011001/002011011001002/20260330/a2aeb970-b095-4245-b28f-0cb929b592be.html> |
| 朝阳 | 🟡 部分 | 朝阳市住房公积金管理中心《关于调整朝阳市2026年度住房公积金缴存基数及缴存额最高限额的通知》（2026-07-13） | <https://www.cygjj.com.cn/tzgg2/1398.jhtml> |
| 本溪 | ✅ 已核实 | 本溪市住房公积金管理中心《关于调整本溪市2026年度住房公积金缴存基数上限的通知》；本医保〔2025〕29号 | <http://www.bxgjj.com/tzgg/644.jhtml><br><https://www.benxi.gov.cn/Upload/main/InfoPublicity/PublicInformation/File/2025/12/24/%e6%9c%ac%e5%8c%bb%e4%bf%9d%e3%80%942025%e3%80%9529%e5%8f%b7%e5%85%b3%e4%ba%8e%e5%85%ac%e5%b8%83%e6%9c%ac%e6%ba%aa%e5%b8%822026%e5%b9%b4%e5%9f%8e%e9%95%87%e8%81%8c%e5%b7%a5%e5%9f%ba%e6%9c%ac%e5%8c%bb%e7%96%97%e4%bf%9d%e9%99%a9%ef%bc%88%e7%94%9f%e8%82%b2%e4%bf%9d%e9%99%a9%ef%bc%89%e7%bc%b4%e8%b4%b9%e5%9f%ba%e6%95%b0%e4%b8%8a%e4%b8%8b%e9%99%90%e7%ad%89%e6%9c%89%e5%85%b3%e9%97%ae%e9%a2%98%e7%9a%84%e9%80%9a%e7%9f%a5.pdf> |
| 沈阳 | ✅ 已核实 | 沈阳住房公积金管理中心《关于调整2026年度住房公积金缴存基数上限的通知》（2026-07-17，未标注文号）；沈人社发〔2017〕63号（医保费率依据） | <https://sygjj.shenyang.gov.cn/zcfg/202607/t20260721_5060324.html><br><https://ybj.shenyang.gov.cn/cjwtjd/202111/t20211122_1124676.html> |
| 盘锦 | ✅ 已核实 | 盘锦市住房公积金管理中心《关于调整2026年度住房公积金缴存基数上限和下限的通知》（2026-06-30） | <https://www.pjzfgjj.cn/2026_06/30_16/content-567117.html><br><http://www.panjin.gov.cn/html/2669/2026-07-05/content-152180.html> |
| 营口 | ✅ 已核实 | 营公积金发〔2026〕7号 | <http://gjj.yingkou.gov.cn/zcfg/5886.jhtml> |
| 葫芦岛 | ✅ 已核实 | 葫公积金发〔2026〕10号 | <https://www.hldgjj.com.cn/zccx/3564.jhtml> |
| 辽阳 | ✅ 已核实 | 辽阳市住房公积金管理中心《关于调整2026年度住房公积金缴存基数上限的通知》（未标注文号） | <https://www.lyszfgjj.com/tzgg/2082.jhtml> |
| 铁岭 | 🟡 部分 | 未取到（铁公积金函〔2026〕40号 原文链接未落盘；中心官网域名未找到） | <http://sxzspzx.tieling.gov.cn/tlzwdt/epointzwmhwz/pages/eventdetail/personaleventdetail?taskguid=d2b3b081-729c-44de-a050-d2f322aeef03><br><http://www.tieling.gov.cn/tieling/ywdt/bmdt/index.html> |
| 锦州 | 🟡 部分 | 未取到（市级政策栏最新基数件为《关于调整2023年度住房公积金缴存基数的通知》，2024—2026 年度未发布） | <http://jzsgjj.cn/newslistnew.jsp?navid=4&listid=25><br><http://jzsgjj.cn/newsDetailsnew.jsp?newsid=31939&navid=4><br><http://zjj.jz.gov.cn/> |
| 阜新 | 🟡 部分 | 未取到（中心为独立事业单位，公安备案号 21091102000041；官网域名未找到） | <https://www.fuxin.gov.cn/channel/10911/index.html><br><https://www.fuxin.gov.cn/content/2025/1027978.html><br><http://zjj.fuxin.gov.cn/zwgkjgjj.thtml?id=15675> |
| 鞍山 | ✅ 已核实 | 鞍山市住房公积金管理中心《关于调整2026年度住房公积金缴存基数及缴存额的通知》；鞍医保发〔2025〕6号 | <http://asgjj.anshan.gov.cn/tzgg/1358.jhtml><br><http://ybj.anshan.gov.cn/html/ASYBJ/202512/0176577701951043.html> |

## 陕西（10 城：已核实 6 / 部分 3 / 未找到 1 / 未取得 1）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 咸阳 | ✅ 已核实 | 咸阳市住房公积金管理中心《关于调整2026年度住房公积金缴存基数的通知》（2026-07-02，2026-07-03发布） | <https://zfgjj.xianyang.gov.cn/xwdt/zxgg/202607/t20260703_2098080.html> |
| 商洛 | ✅ 已核实 | 商人社发〔2026〕20号（最低工资标准依据）；商洛市住房公积金管理中心《关于调整住房公积金缴存基数下限标准的公告》（2026-01-14） | <https://shangluo.gov.cn/gjj/info/1063/3615.htm><br><https://shangluo.gov.cn/info/1076/165812.htm> |
| 安康 | 🟡 部分 | 安康市住房公积金经办中心《关于调整2026年住房公积金缴存基数的通知》 | <https://gjj.ankang.gov.cn/Content-2927224.html><br><https://www.ningshan.gov.cn/Content-2937272.html> |
| 宝鸡 | ✅ 已核实 | 宝鸡市住房公积金管理中心《关于调整2026年度住房公积金缴存基数的通告》（2026-06-29，另有政策解读 t20260629_1280651.html） | <https://zfgjj.baoji.gov.cn/zzzb/tzgg/202606/t20260629_1280645.html> |
| 延安 | ✅ 已核实 | 延安市住房公积金管理中心《关于调整2026年度缴存基数的通知》 | <https://gjj.yanan.gov.cn/cjfw/fwcn/2072945927563304961.html> |
| 榆林 | ✅ 已核实 | 榆林市住房公积金管理中心《关于做好2026年度住房公积金缴存基数调整工作的通知》（2026-06-26） | <http://zfgjj.yl.gov.cn/zfxxgk/fdzdgknr/zcfg/zxwj/202606/t20260626_2110239.html> |
| 汉中 | 🟡 部分 | 汉中市住房公积金管理中心《关于调整住房公积金缴存基数下限标准的公告》（2026-01-09） | <http://zfgjj.hanzhong.gov.cn/hzgjj/tzgg/202601/1a47a465fd6946ebb76ee25634225650.shtml> |
| 渭南 | 🟡 部分 | — | <https://gjj.weinan.gov.cn/xwdt/zdxx/2011271140661723137.html><br><https://gjj.weinan.gov.cn/zzzq/zcfg/1.html> |
| 西安 | ✅ 已核实 | 西房金管发〔2026〕1号 | <http://zfgjj.xa.gov.cn/gzdt/tzgg/2070405479618592769.html> |
| 铜川 | ⚠️ 未找到 | — | — |

## 青海（8 城：已核实 1 / 部分 7 / 未找到 0 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 果洛 | 🟡 部分 | 未取得缴存基数件（果洛州中心 2020 年度报告原文见省中心站；无独立中心官网） | <https://www.qhgjj.com/shownews.doo?newsid=6603><br><https://www.guoluo.gov.cn/> |
| 海东 | 🟡 部分 | 青人社厅发〔2026〕54号；海东市人民政府令 HDFS01—2026—0003（2026-05-19，海东市住房公积金归集/提取/贷款管理办法） | <http://qinghai.chinatax.gov.cn/hbz/sjtzgg/202609/a75a3e1426ff47609e20a49c859ac000.shtml><br><https://www.haidong.gov.cn/Detailed-document/images/2026062310435086061.pdf> |
| 海北 | 🟡 部分 | 青人社厅发〔2026〕54号 | <https://rsj.haibei.gov.cn/xwzx/gzdt/9394221.html><br><http://qinghai.chinatax.gov.cn/hbz/sjtzgg/202609/a75a3e1426ff47609e20a49c859ac000.shtml> |
| 海南州 | 🟡 部分 | 未取得缴存基数件（海南州中心 2020 年度报告原文见省中心站；无独立中心官网） | <https://www.qhgjj.com/shownews.doo?newsid=6606><br><https://www.hainanzhou.gov.cn/> |
| 海西 | ✅ 已核实 | 海西州住房公积金管理中心《关于2026年度住房公积金缴存基数调整的通知》（2026-07-06）；青政〔2025〕11号 | <https://www.hxzfgjj.com.cn/info/1017/4853.htm><br><http://qinghai.chinatax.gov.cn/hbz/sjtzgg/202609/a75a3e1426ff47609e20a49c859ac000.shtml> |
| 玉树 | 🟡 部分 | 青房资管〔2021〕9号（省直/西宁口径，不可外推）；玉树州中心 2020 年度报告 | <https://www.qhgjj.com/shownews.doo?newsid=6813><br><https://www.qhgjj.com/shownews.doo?newsid=6602><br><https://www.yushuzhou.gov.cn/> |
| 西宁 | 🟡 部分 | 青人社厅发〔2026〕54号；青政办〔2025〕28号 | <http://qinghai.chinatax.gov.cn/hbz/sjtzgg/202609/a75a3e1426ff47609e20a49c859ac000.shtml><br><http://www.qinghai.gov.cn/xxgk/xxgk/xzgfxwj/202512/t20251230_389755.html> |
| 黄南 | 🟡 部分 | 未取得缴存基数件（黄南州中心 2020 年度报告原文见省中心站；州门户被 JS 挑战 WAF 拦截） | <https://www.qhgjj.com/shownews.doo?newsid=6604><br><http://www.huangnan.gov.cn/> |

## 黑龙江（13 城：已核实 8 / 部分 1 / 未找到 4 / 未取得 0）

| 城市 | 状态 | 数据来源文号 | 来源链接 |
|------|------|-------------|---------|
| 七台河 | ⚠️ 未找到 | — | <https://www.qthgjj.org.cn/qthsgjj/c101102/202507/a6392e6a26ce4416804ae7fb5f21bef5.shtml> |
| 伊春 | ⚠️ 未找到 | — | <https://ycgjj.org.cn/> |
| 佳木斯 | 🟡 部分 | （佳木斯市住房公积金管理中心《关于调整住房公积金缴存基数下限的通知》，正文未列文号） | <https://www.jmsgjj.org.cn/bzbwz/zxdt/1425267.jhtml> |
| 双鸭山 | ✅ 已核实 | （双鸭山市住房公积金管理中心《关于调整缴存基数上限的通知》，正文未列文号） | <https://sysgjj.org.cn/tzgg/2677354.jhtml> |
| 哈尔滨 | ✅ 已核实 | （哈尔滨住房公积金管理中心《关于调整2026年度职工住房公积金缴存基数上限的通知》，转载页未列文号） | <https://www.hlj.gov.cn/hlj/c107858/202607/c00_31959013.shtml> |
| 大兴安岭 | ⚠️ 未找到 | — | <https://www.dxalzfgjj.org.cn/> |
| 大庆 | ⚠️ 未找到 | — | <https://www.dqgjj.cn/> |
| 牡丹江 | ✅ 已核实 | （牡丹江市住房公积金管理委员会《关于调整2026年度牡丹江市住房公积金缴存基数上下限的通知》，正文未列文号；依据黑政规〔2025〕1号） | <https://www.mdjzfgjj.cn/tzgg/973.jhtml> |
| 绥化 | ✅ 已核实 | （绥化市住房公积金管理中心《关于调整2026年绥化市住房公积金缴存基数及月缴存额上下限等有关事项的通知》，正文未列文号） | <https://www.shzfgjj.org.cn/zxdt/1587.jhtml><br><https://www.shzfgjj.org.cn/u/cms/www/202607/221556258bmf.png> |
| 鸡西 | ✅ 已核实 | 鸡房金管〔2026〕17号 | <http://jxgjj.org.cn/tzgg/1433126.jhtml> |
| 鹤岗 | ✅ 已核实 | 鹤住金政发〔2026〕5号 | <https://www.hggjj.org.cn/tzgg/1936934.jhtml> |
| 黑河 | ✅ 已核实 | 黑市房金管办发〔2026〕5号 | <https://www.hhgjj.org.cn/newsDetailsnew.jsp?newsid=2662&navid=4> |
| 齐齐哈尔 | ✅ 已核实 | （齐齐哈尔市住房公积金管理中心《关于调整2026年度职工住房公积金缴存基数上限的通知》，正文未列文号；依据齐管规〔2018〕2号） | <https://www.qqhrzfgjj.org.cn/tzgg/1621.jhtml><br><https://qqhr.zwfw.hlj.gov.cn/tsfwzq/gjjfwzq/bmzc/dk/art/2026/art_3cc86a4eeb6642b2a55e3ffcd766369a.html> |

### 第十二轮第四批进展（2026-10-12）：33 城 → 28 城（甘肃清零）

本批 5 城此前全部 urls 数组长度为 0。**3 城拿到 2026 年度缴存基数一手件并改了值，2 城取得官方入口但确未公布数值**。

| 城市 | 拿到了什么 | 状态 | 值是否改动 |
|---|---|---|---|
| 武威 | 2026-07-02 发布（无文号）：上限 = 2025 年城镇非私营在岗月均 **8683.33×3 = 26050**；下限按 甘政办发〔2025〕71号，凉州区 2200 / 天祝·民勤·古浪 2080；自 2026-01-01 执行 | ✅ 已核实 | **改** 1910~23991.75 → **2200~26050** |
| 张掖 | **张住委办发〔2025〕4号**（正文为 4 张 JPEG，OCR 读出）：上限 = 2025 在岗年均 101088÷12 = 8424×3 = **25272**；下限甘州区 1910 / 5 县 1850；自 2026-01-01 执行 | ✅ 已核实 | **改** 1850~24964 → **1910~25272** |
| 甘南 | 州通告 2026-07-08（刊于甘肃政务服务网）：上限 = 2025 在岗年均 124499÷12 = 10375×3 = **31125**；下限合作市 2130 与 71号二类互证；最高双 12%、最低双 8%；自 2026-07-01 执行 | ✅ 已核实 | **改** 1960~29856 → **2130~31125** |
| 嘉峪关 | headless Chrome 渲染确认 2026 年度通知 2026-06-23 已发布，但文章页服务器真实 404（curl / web_fetch / Chrome 三路均 ERR_HTTP_RESPONSE_CODE_FAILURE） | 🟡 部分 | 不改，保留 warn |
| 临夏 | 州政府规范性文件栏目 4 份 2026 年办法只给规则（比例 5%~12%、下限不得低于当地最低工资、上限 = 上年职工月均工资 ×3），不给数值；中心无独立内容站 | 🟡 部分 | 不改，**新增 warn** |

**省级共同依据 —— 甘政办发〔2025〕71号**：地区类别由 4 类改为 3 类，一类 15 个 **2200**（含嘉峪关市、肃州区、凉州区）、二类 19 个 **2130**（含甘州区、合作市、临夏市）、三类 54 个 **2080**（含山丹/临泽/高台/民乐/肃南、天祝/民勤/古浪、临夏县/永靖/和政/积石山/广河/东乡），**自 2025-12-01 起执行**。原版 www.gansu.gov.cn 返回 HTTP 412，全文改由张掖市政府门户「省政府文件」栏目转载页取得（索引号 620700112/2025-00338，发布 2025-12-09 17:50）。

**⚠️ 遗留时序冲突（张掖）**：张住委办发〔2025〕4号 成文 2025-10-24，所引下限依据《甘政发〔2023〕83号》已被 71号取代；而 71号自 2025-12-01 起执行，早于 2026 缴存年度起点，理论上甘州区下限应已升至 **2130**。因张掖市公积金中心尚未重发 2026 年度通知，按四关第 3 关「数字有歧义」**只记录不改值**，待其重发后复核。

**⚠️ 官方件自身的算术噪声（甘南）**：缴存额上限 7468 对应按未取整基数 31124.75×12% 截尾（3734×2），按取整后 31125×12%×2 应为 7470；缴存额下限 342 与 2130×8%×2 = 340.8 对不上。只影响缴存额、不影响基数上下限。

**本批口径决策**：省级最低工资文件是各市公积金下限的**共同上游**，拿到全文可一次性校验多市下限，但**不能替代市级公积金通知** —— 汕尾官方件已实证「省级已调、市级只对新户生效」的过渡条款。故本批三城的下限一律以市级/州级公积金件原文为准，省级文件只用作互证与冲突标记。

**另一条口径**：甘肃省住房资金管理中心 2026 年度通知（上限 30090.75、下限 2200）**仅适用「各省属、中央在兰缴存单位」**，不可外推到各市州。
### 第十二轮第五批进展（2026-10-12）：28 城 → 24 城（湖南清零）

湖南 4 城本轮全部收口为 🟡 部分核实，**数值一律不改**。四城结论差异很大，逐条说明为什么没有改值：

| 城市 | 仓库现值 | 本轮取证 | 处置 |
|------|---------|---------|------|
| 邵阳 | 1800~22333 | 取到**两件一手官方件**：邵金管字〔2026〕2号《关于进一步优化住房公积金政策 保障住房消费需求的通知》（索引号 4305000001/2026-32552）与邵金管字〔2026〕3号《邵阳市住房公积金个人住房装修提取与贷款试行办法》（索引号 4305000001/2026-32549），所属机构均为邵阳市住房公积金管理委员会，落款 2026-05-28、自 2026-06-01 执行 | 件内不含缴存基数上下限 → 值不改，**补标 warn:true**（原先无 warn，与同批三城口径不一致） |
| 张家界 | 2000~24932 | 中心站点 `www.zjjzfgjj.com` 根路径只返回 612 字节 Welcome 页，只有网厅（/wt-web/login、/wt-web-gr/grlogin 均 200），无内容站；门户 19 个栏目无公积金专栏 | 值不改，保留 warn |
| 衡阳 | 1700~21142 | 门户整体被 JS 挑战 WAF 拦截：curl 对任意路径一律 HTTP 412（响应体是挑战脚本 `ZYbKRgIknL7izCT.js`），补齐全部浏览器头仍 412，web_fetch 同样 412，headless Chrome（virtual-time-budget 60000）只得 4111 字节、TITLE 为「510」 | 值不改，保留 warn |
| 郴州 | 1550~23205 | 同型 WAF（gjj / zjj / www 三主机均 412，Chrome 得 4072 字节、TITLE「510」）；但 DoH 证实 `gjj.czs.gov.cn`、`zjj.czs.gov.cn` 与门户同属 115.231.24.0/24，可判定为真实政府子域 | 值不改，保留 warn |

本轮工具层面有两点值得记：

1. **湖南省统一检索接口可用**：`https://searching.hunan.gov.cn/hunan/<站点码>/<file\|news>?q=<URL编码关键词>`，参数名是 `q` 而不是 `keyword`。但它只索引省级文件，检索「住房公积金缴存基数」「住房公积金缴存比例」都只返回中央/省文件，**不含各市州公积金缴存基数通知**，所以无法用它做城市级数值取证。
2. **门户页脚/直属单位清单是反查下级域名最省力的路径**（本项目第三次验证）：邵阳市门户「市直单位政府网站」清单 `/shaoyang/shizhidanwei/end_link.shtml` 一次列出全部市直单位子域，是判断某市是否设有独立公积金中心网站的快速依据。

### 第十二轮第六批进展（2026-10-12）：24 城 → 20 城（青海清零）

青海 4 州本轮全部收口为 🟡 部分核实，**数值一律不改**。四州都没有独立公积金中心官网，官方入口统一收敛到省住房资金管理中心站：

| 城市 | 仓库现值 | 本轮取证 | 处置 |
|------|---------|---------|------|
| 黄南 | 2080~28652 | 州中心 2020 年度报告原文（省中心站 newsid=6604）：管委会有 23 名委员；中心为黄南州人民政府管理的公益一类正县级全额拨款事业单位，内设综合部（挂稽核部牌子）、业务部（挂信息技术部牌子）、财务部，从业人员 15 人；实缴单位 638 家、职工 1.46 万人；个人住房贷款最高 70 万元。黄南州政府门户被 JS 挑战型 WAF 拦截（本环境完全不可读） | 值不改，**新增 warn:true**（原无 warn，与同批三州口径不一致） |
| 海南州 | 2080~28976 | 州中心 2020 年度报告原文（newsid=6606）：管委会有 22 名委员；中心为州政府管理的公益一类正县级事业单位，设 6 个科、4 个管理部，从业人员 23 人；单缴存职工贷款最高 40 万、双缴存 50 万 | 值不改，**新增 warn:true** |
| 果洛 | 2080~35935 | 州中心 2020 年度报告原文（newsid=6603）：中心为果洛州人民政府不以营利为目的的财政全额拨款事业单位，现隶属果洛州住建局下属事业单位，从业人员 7 人；管委会有 15 名委员、2020 年召开 4 次会议（含印发《果洛州住房公积金管理办法（试行）》）；贷款最高 60 万。果洛州政府门户 curl 200，州政府规范性文件栏目可枚举但无本市基数件 | 值不改，**新增 warn:true** |
| 玉树 | 2080~24402 | 州中心 2020 年度报告原文（newsid=6602）：中心为玉树州人民政府直属的正县级全额拨款公益一类事业单位，设 4 个科、5 个管理部，从业人员 41 人（在职 17 人）；实缴单位 662 家、职工 1.84 万人；贷款最高 50 万。另取到省级一手件 **青房资管〔2021〕9号**（newsid=6813）：上限 24591（西宁地区城镇非私营单位就业人员 2020 年度月平均工资×3）、下限 1700（全省最低工资标准）、比例 5%~12%、自主缴存 10%~24% | 该件属省直/西宁口径，四关第 1 关不通过 → **值不改，保留 warn:true** |

本轮有两点方法论收获：

1. **省级中心站是下辖州年度报告的法定披露平台**。四州中心均无官网，但其 2020 年年度报告按建金〔2015〕26号应报送上级中心，因此原文都在 `https://www.qhgjj.com/`（.doo 系 CMS）上。虽然年报不含缴存基数，但能证实机构性质与隶属关系，是判断「该州究竟有没有独立中心」的权威依据（省中心站《青海住房公积金基本情况》newsid=3505 明列全省 12 家机构）。
2. **DNS 存在不等于官方 —— 新增第 6 类误判「域名抢注」**。按海西州 `hxzfgjj.com.cn` 的命名规律推测四州域名时，`www.hngjj.cn` 实际是「德甲直播」、`www.glgjj.cn` 是「日韩小电影」色情站、`www.ysgjj.cn` 是成都市益善阁藏式家具公司、`www.glzfgjj.cn` DNS 存在但页面落盘 0 字节。凡是猜测出来的域名，必须抓正文核对 `<title>` 与 `meta keywords`，核对不过一律不写入记录。

另记：青房资管〔2021〕9号 内明定「缴存基数达到上限 24591 元的，月缴存额直接取整，不能进位」，这是本项目**首次取得青海省的缴存额取整口径原文**（24591×12%=2950.92 → 取整 2950 → ×2=5900，与原文「最高月缴存额为 5900 元」一致；1700×5%=85 → ×2=170，与「最低月缴存额为 170 元」一致）。

### 第十二轮第七批进展（2026-10-12）：20 城 → 16 城（西藏清零）

本批攻西藏 4 市地（昌都/山南/那曲/阿里），零官方链接缺口 20 → **16 城**。

**核心突破：西藏市级住房公积金文件一律挂在各市地住房和城乡建设局网站上。** 西藏市级不单设公积金中心门户，入口路径统一为「政府门户 → 住房和城乡建设局 → 公示公告 / 法定主动公开」。这一路径是本次取证的起点。

| 城市 | 状态 | 取证结果 | 值处置 |
|------|------|---------|--------|
| 昌都 | ✅ 已核实 | 一手件《关于开展2026年度住房公积金单位年审暨缴存基数调整的通知》（昌都市住建局，2026-06-30）| **值不改**：仓库 2360~43049 与官方件逐字一致 |
| 山南 | 🟡 部分 | `http://zjj.shannan.gov.cn/` 可达，站内四个新闻栏目无公积金缴存基数件 | 不改，保留原值 |
| 那曲 | 🟡 部分 | `http://zjj.naqu.gov.cn/` 可达，法定主动公开各栏目最新止于 2022 年 | 不改，保留 warn |
| 阿里 | 🟡 部分 | 地区门户域名四组候选全 NXDOMAIN，只能落地区级上级入口 | 不改，保留 warn |

**昌都算式自校验**：`43049×12% = 5165.88 → 5166`，`×2 = 10332`，与官方件原文「月缴存额不得超过 10332 元」完全吻合；`43049÷3 = 14349.67`（2025 年度城镇非私营单位月平均工资）。下限 2360 即 **藏政办函〔2025〕25号** 全区最低工资。四关全过 → 只补链接、数值不动。

**⚠️ 域名陷阱（本批第 4 例「域名抢注」）**：`www.xzgjj.cn`（IP 222.240.83.234）看似「西藏公积金」，实为**湖南省直住房资金管理中心（湘直公积金网）**——headless Chrome 渲染出的 `<title>` 与页面内容均为湖南省直公积金文件。已排除，绝不可用。此前已排除的同型域名还有 `www.hngjj.cn`（德甲直播站）、`www.glgjj.cn`（色情站）、`www.ysgjj.cn`（成都市益善阁藏式家具公司）。

**山南/那曲/阿里为何只到 partial**：那曲住建局站的法定主动公开（规范性文件 gfxwj、政策文件 zcwj、民生领域 msly、其他信息 qtxx）四个最可能承载公积金文件的栏目**全部内容停留在 2022 年**；那曲门户全站正文零次出现「公积金」与「资金中心」。阿里地区四组门户候选域名（`www.ali.gov.cn` / `www.gzali.gov.cn` / `www.ali.xizang.gov.cn` / `www.xzali.gov.cn`）经 DoH 判定全部 NXDOMAIN。

**自治区级入口**：`https://www.xizang.gov.cn/` 与 `http://zjt.xizang.gov.cn/` 均可达，《西藏住房城乡建设厅直属机构》页列 9 家直属机构（第 5 家为自治区住房资金管理中心）但**未公布其独立官网**；住建厅首页推送的「西藏公积金新政重磅发布」指向微信公众号，按项目纪律不予采信。
### 第十二轮第八批进展（2026-10-12）：16 城 → 13 城（辽宁清零）

锦州、阜新、铁岭此前**一条官方链接都没有**（数值是早前估算的，三市均标 warn）。本轮**数值一律不改**，只补来源链接，三城状态由「未找到」升为「部分」。

| 城市 | 官方入口 | 取得内容 | 为何不改值 |
|------|----------|----------|------------|
| 锦州 | `http://jzsgjj.cn/`（锦州市住房公积金管理中心，GB2312 编码）+ 市住建局 `http://zjj.jz.gov.cn/` + 锦州政务服务网 `http://zwfw.jz.gov.cn/` | 中心官网及其「市级政策」栏目全量枚举 | 市级政策栏最新基数件仍是 2023 年度《关于调整住房公积金缴存基数的通知》，2024—2026 三个缴存年度的通知未在该站发布 → 仓库 1930~20610 保留 warn |
| 阜新 | 市政府门户「政府机构」页 + 中心机构条目页 + 阜新政务服务网三条公积金事项 | 机构条目页带中心**独立公安备案号 21091102000041** 与事业单位网站备案 bszs.conac.cn id=1FD95B2D6D093107E053012819AC9BDC，确认其为独立事业单位（市住建局局属中心不含公积金中心）；事项含 serviceCombo=169 住房公积金 / 170 公积金自愿缴存 / 171 公积金账户 | 未取得当期缴存基数上下限件，官网域名亦未找到（fxgjj.cn 返回 404 空壳，其余候选全 NXDOMAIN）→ 仓库 1930~21201 保留 warn |
| 铁岭 | 市政府门户 + 铁岭政务服务网 epoint 三条公积金事项（缴存/贷款/提取） | 事项入口与发布渠道（部门动态 / 政府文件 / 公示公告） | 中心官网域名未找到；仓库 note 虽载文号「铁公积金函〔2026〕40号」，但原文链接从未落盘，搜索该文号只返回商业站、本地宝与微信公众号，按来源标准不予采信 → 仓库 1930~22056 保留 warn |

**本批方法论**：新增第 6 条反查路径 —— **从仓库已有记录反查同省命名规律**。辽宁已有 8 市公积金中心域名（沈阳 sygjj.shenyang.gov.cn、鞍山 asgjj.anshan.gov.cn、丹东 ddzfgjj.com、营口 gjj.yingkou.gov.cn、辽阳 lyszfgjj.com、盘锦 pjzfgjj.cn、朝阳 cygjj.com.cn、葫芦岛 hldgjj.com.cn），按「简称+sgjj / 简称+zfgjj」批量 DoH，命中 `jzsgjj.cn`（锦州，211.140.203.22，与市住建局同段）。这条路径比搜索引擎更稳，且不依赖被反爬的引擎。

⚠️ **域名抢注第 6 例**：`www.tlgjj.com` 是 4.cn 域名停放页（页面写「域名一口价 6497 元」）；`www.tlzfgjj.com` 是色情站（Cloudflare 隐藏 IP）。加上此前的 `www.xzgjj.cn`（湖南省直公积金）、`www.hngjj.cn`（德甲直播）、`www.glgjj.cn`（色情站）、`www.ysgjj.cn`（成都益善阁家具），**DNS 存在甚至 curl 200 都不能证明官方，必须抓正文核对 title 与 keywords**。

**省级来源**：辽宁省住房和城乡建设厅 `http://zjt.ln.gov.cn/` 页脚**未列各市公积金中心域名**，全站与公积金相关的仅 3 条（沈阳公积金新政报道 + 2021/2022 年度省公积金年报解读）；`zfcxjst.ln.gov.cn`、`gjj.ln.gov.cn`、`www.lnzfgjj.cn`、`www.lngjj.cn`、`jzgjj.ln.gov.cn` 全部 NXDOMAIN，省住房资金管理中心无独立域名。

### 第十二轮第九批进展（2026-10-12）：13 城 -> 10 城（江苏清零）

此前徐州、南通、淮安三市一条官方链接都没有。本轮 **两城完全核实、一城部分核实**：

| 城市 | 状态 | 关键文件 | 结论 |
|---|---|---|---|
| 徐州 | ✅ official-confirmed | 徐公积金委〔2026〕1号（2026-07-20 发布） | 上限 32917、下限 2430 —— **与仓库值逐字一致，零偏差，只补文号与链接** |
| 淮安 | ✅ official-confirmed | 淮房委〔2026〕3号（2026-03-31 发文） | 上限 30900、下限 2430 —— **与仓库值逐字一致，零偏差** |
| 南通 | 🟡 official-partial | 通金管〔2025〕50号 ＋ 通人社发〔2026〕1号 | 上限 34000 获证实；**下限 2490 → 2660**（唯一改值），2026 年度公积金件待发布故保留 warn |

**取证方法论（本轮新增，见 `docs/sources/README.md` 第十二轮第九批整节）**：「下限动态引用最低工资」是一条闭合在市级内部的合法取证链 —— 公积金通知写「下限不低于××市人社局公布的最低月工资标准」时，去该市人社局取最低工资文件即可，这不是此前被禁止的「省级文件推市级下限」。配套两条纪律：政府门户「有效性」字段**不可用于辨伪新旧**（通人社劳〔2024〕2号 至今仍显示「有效」却被 2026 年新件取代，要比对成文日期与文号序列）；列表页分页参数可能是假的（ntgjj.com `&PageIndex=2` 返回与第 1 页完全一致的 HTML），要证明「某类文件不存在」必须单页全量正则匹配 ＋ 交叉核对多栏目 ＋ 结合发文惯例印证时间线。


### 第十二轮第十批进展（2026-10-12）：10 城 -> 7 城（吉林清零）

本批 3 城全部拿到官方链接，**数值一个没改**，只补来源与文号（松原另修掉 note 里一处自相矛盾的旧口径）。

| 城市 | 状态 | 决定 | 理由 |
|---|---|---|---|
| 松原 | 🟢 完全核实 | 值不动 | 上下限两件一手件到手：上限件载 2025 年松原城镇非私营月均 7644.00 元、3 倍 22932.00 元；下限件载自 2025-12-01 起按 吉政函〔2025〕59号 松原市区 2020.00 元、前郭县/扶余市/长岭县/乾安县 1870.00 元。算式自校验 7644×3=22932.00 ✅、7298×3=21894.00 ✅。原 note 写「2025口径1920」是 2024 年旧口径、已被 59 号取代，属自相矛盾，已删。 |
| 辽源 | 🟡 部分 | 值不动 | 辽公积金管发〔2026〕4号 只给公式不给数值，且公式口径是「本市统计部门」而非省全口径，四关第①关不通过。仓库上限 22444 与 吉人社联〔2026〕74号 的 89778÷12×3=22444.5 吻合到个位，但这是旁证不是证据——若该值本身是从目标反推的，自校验等于没校验。 |
| 白城 | 🟡 部分 | 值不动 | 下限 official-confirmed：中心在市政府门户「市长信箱」具名答复「缴存基数下限为白城市人力资源和社会保障部门公布的上一年最低工资标准」，与 吉政函〔2025〕59号 白城档位 1870 闭合（与南通同型链条）。**上限 20676 存疑**：按其自身口径应为省全口径×3，而 20676÷3=6892 元/月（年 82704），与 89778（2025 年度）、87865（2024 年度）均不符；但中心无独立官网、全站检索只命中这一条答复，官方数值公告确实不存在 → 只记录不改值。 |

**省级三件金矿（本批新发现，三城通用）**

- `http://jst.jl.gov.cn` 吉林省住房和城乡建设厅真实域名（来源省政府部门清单 `www.jl.gov.cn/xglj/szfbm/`；此前 zfcxjst / zjt / zjj / zfcx 等所有拼音缩写猜测**全部 NXDOMAIN**）。其页脚 hidden div 一次性列出全省 9 个市州公积金机构入口 —— 本项目**第五次**验证「上级主管部门页脚反查下级机构域名」有效（前四次：宁德中心页脚列福建 9 市、内蒙古自治区中心页脚列 12 盟市、四川省厅—无、青海省厅列省中心、广东汕尾—无）。
- **吉政函〔2025〕59号**（2025-11-26 发布）全省最低工资标准：长春 2230／吉林市区·白山市区·松原市区·延吉·珲春·长白山 2020／四平·辽源·通化·白城·梅河口及其他县市 1870，执行期 2025-12-01 起 —— 仓库三城下限值全部对上。
- **吉人社联〔2026〕74号**（2026-09-03 发布）2025 年全省全口径城镇单位就业人员平均工资 **89778 元**；另 吉人社 2025-09-22 件给出 2025 年 7 月—2026 年 6 月养老保险个人缴费基数 4393.2~21966 元、计发基数 87865 元/年（自校验 21966÷3=7322 元/月≈87865÷12、4393.2÷7322=60% ✅）。

**方法论新增**

1. **省级门户「政府信息公开专栏」比搜索引擎靠谱**：`xxgk.jl.gov.cn` 栏目路径 `/szf/gkml/<YYYYMM>/t<YYYYMMDD>_<id>.html`（省政府文件）与 `/zcbm/fgw_97992/xxgkmlqy/<YYYYMM>/...`（部门文件）；单篇 curl 可通但**偶发 code=000，需重试 2~4 次**。
2. **最低工资标准是公积金下限的强旁证，但能否合并要看本市中心自己的口径表述**：白城中心指向「人社部门公布的最低工资标准」→ 可合（四关全过）；辽源中心指向「统计部门公布的最低月工资标准」→ 口径不同，不可合。同一个省、同一个档位值，能用不能用取决于引用链是否闭合在市级内部。
3. **政府门户「互动交流/市长信箱」里由业务主管部门具名答复的件，常是某中心唯一的官方口径出处** —— 白城公积金中心无官网、数值件为零，全靠这一条答复拿到了下限与上限的规则表述。
4. **Tarpitting 型 WAF 不可绕**：知道创宇/安全狗对非浏览器指纹一律挂起（TLS 握手成功、GET 永不返回）。curl 参数 tricks、r.jina.ai(403)、allorigins(520)、codetabs(522)、Wayback 正文页(429) 全部无效。遇到这种站应直接放弃正文取证，改走政府信息公开平台 / 互动答复 / 检索 API。
5. **Wayback 只能用于枚举 URL 结构，不能取证正文**（CDX API 走代理可用，正文页对本 IP 429、不走代理 000）；但用它确认站点是 JeeCMS 5 后，可直接按 `/tzgg2/<id>.jhtml` 猜 id 取文（本项目松原中心正是同款 CMS）。
6. **政府门户站内搜索通用套路**：TRS WAS 的表单 action 指向 `:8080/was5/web/search`，**必须带 channelid**，参数名常是 `searchword` 而非 `q`，而且**走代理反而失败**。
7. **DoH 三态要分清**：`Status:3` = NXDOMAIN（域名不存在）；`Status:0` 但无 A 记录 = nodata（域名注册了但没配 A，如 `www.bcgjj.com` 已死）。

### 第十二轮第十一批进展（2026-10-12）：7 城 -> 5 城（云南清零）

| 城市 | 结果 | 决定 | 依据 |
|---|---|---|---|
| 曲靖 | **official-confirmed** | 下限 1920->**2020**、上限 25737->**25893**，不标 warn | 上限件 2026-07-02「2025 年月平均工资 8631 元 -> 上限 25893 元、月缴存额上限 6214 元」；下限件 2026-01-01「麒麟/沾益/马龙/宣威/经开区 2020 元，其余 5 县 1870 元」 |
| 大理 | **official-partial** | 下限 2020->**2120**（其余 11 县 1970），**新增 warn** | 州中心 2026-08-31 件引云人社发〔2026〕9号，自 2026-09-01 起大理市二类 2120；2026 年度上限件穷举证明不存在，只取到大公积金发〔2024〕4号 的规则 |

**算式自校验（曲靖三式全过）**：`8631 x 3 = 25893`（两数同件不同段落，非从目标反推）；`2020 x 5% x 2 = 202`；`1870 x 5% = 93.5 -> 94`（**向上进位**）`x 2 = 188`，而 `25893 x 12% = 3107.16 -> 3107`（**向下取整**）`x 2 = 6214`。同一家城市两件取整方向相反，是本项目第四次遇到该情形。

**过渡条款辨析（本批关键决策）**：汕尾官方件写「**不执行本次 2040 元新下限**」属整体不执行，所以值不动；大理件只写「2026 年 9 月 1 日前按原缴存基数下限**执行的职工**到 2027 年 7 月核定时再调整」，新下限自 2026-09-01 已生效，属**分批实施**，故采纳 2120 并在计算器 note 保留过渡说明。**这两类条款不能一刀切。**

**推翻旧结论：政府门户站内检索不是不可用，是参数语法错了**。大理州门户首页 1161 万字节却只有 64 个 `<a>`（正文与列表全由 JS 注入），爬首页确实无效；但文章页引用的 `/default/libs/config.js` 暴露了稿件接口 `POST /searchManuscript`，页面内 `var websiteCode = "dlzrmzf"`。**关键在 `webSiteCode[]=dlzrmzf` 用 jQuery 方括号数组语法**，写成 `webSiteCode=dlzrmzf` 服务端静默失败，我们先误判两次「接口不可用」，直到在 `commonApi.js` 里看到 `webSiteCode: [window.websiteCode || '']` 才定位。返回体 `data.results[i].content.content` 就是**完整正文 HTML**，`.urls.pc` 是文章绝对路径。云南全省共用这套「数融」CMS，各县市 siteCode 都在 config.js 里。

**曲靖站点抓取陷阱**：`https://zfgjj.qj.gov.cn/`（等价域 `https://www.qjzfgjj.com/`）的「基数比例」栏目 `/cms/jsbl/` 把每条通知锚在 `div.base-ratio-content-left` 里，不是普通 `<a>`，通用爬链脚本抓到 0 条，须用专用正则 `href="([^"]*jhtml)"[^>]*>\s*<div class="base-ratio-content-left"`。站点必须走 https（http 404）。

**零链接不等于数值错**：曲靖 25737 与大理 2020 都是真实的 2025 年度官方值（曲靖 2024 年月均 8579 x 3 = 25737；大理云人社发〔2025〕19号自 2025-10-01 起大理市 2020），只是链接从未落盘。补链接的过程顺带发现年度滞后，这才是零链接的真实危害。

## 说明

1. **「已核实」= 找到官方来源且数值与仓库一致**；「部分」= 只核实了部分项目，或来源为事业单位官网；
   「未找到」= 有官方来源但未覆盖该项；「未取得」= 本轮未能定位到任何官方来源。
2. **「有来源」不等于「数据一定正确」** —— 本报告只记录**来源可及性**。
   与仓库不一致的条目已单列于 `docs/sources/_summary.json`；
   其中经本人逐条复核确认的 **10 条已修正**（芜湖/铜陵/安庆/宿州/六安/池州/宣城/三沙/儋州/珠海）。
3. 网络不可达（HTTP 000）与站点反爬是主要失败原因，约占失败项的四分之一；
   建议后续改用有头浏览器或更换网络环境重试。
4. **首批 9 组的返回值曾被截断**，只保住 6 个省级单位（云南/内蒙古/吉林/四川/安徽/宁夏），
   已从纯文本 `raw-2026-09-30-workflow.json.txt` **抢救出 79 城**并入 `G1b.json`。
5. **统计脚本的「已填」判定曾三次误判**（占位符有 `待核查` / 空串 / `（尚未核查，占位）` 三种写法），
   现已改为按「是否有 url 或 confirms 是否有实质内容」判定，不再依赖特定占位字符串。
