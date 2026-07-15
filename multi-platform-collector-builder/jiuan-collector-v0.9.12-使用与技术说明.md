# 九安智能采集 V0.9.12 使用与技术说明

> 适用版本：V0.9.12 角色打包母包版  
> 插件名称：九安智能采集  
> 当前定位：多角色、多平台电商经营数据采集插件。现阶段真实采集链路主要接入“客服-数据报表”角色；“财务-提现账单”“财务-涉税账单”已预留独立角色、独立计划和同步结构，具体业务接口后续接入。

---

## 1. 角色编号与角色说明

| 角色编号 | 角色名称 | 当前状态 | 说明 |
|---:|---|---|---|
| 1 | 客服-数据报表 | 已接入真实采集 | 采集微信小店、抖店、拼多多的客服、体验分、售后质量等经营数据。 |
| 2 | 财务-提现账单 | 角色框架已接入，接口待接入 | 已支持独立角色按钮、独立自动计划、独立同步字段；提现账单接口后续接入。 |
| 3 | 财务-涉税账单 | 角色框架已接入，接口待接入 | 已支持独立角色按钮、独立自动计划、独立同步字段；涉税账单接口后续接入。 |

角色配置文件由打包脚本自动生成，正式插件包内路径：

```text
config/collector-role.config.json
```

默认全角色包配置示例：

```json
{
  "enabledRoles": [1, 2, 3]
}
```

只启用客服 + 提现的配置示例：

```json
{
  "enabledRoles": [1, 2]
}
```

未启用角色默认隐藏。如果打包时指定 `disabled`，则未启用角色显示但置灰。

---

## 2. 角色打包命令参数

### 2.1 最简单方式：双击一键打包文件

解压母包后，在母包根目录可以直接双击：

```text
一键打包-1-客服.cmd
一键打包-12-客服+提现.cmd
一键打包-13-客服+涉税.cmd
一键打包-123-全部角色.cmd
一键打包-12-客服+提现-未启用置灰.cmd
```

打包完成后，到 `dist/` 目录拿正式插件 ZIP。

### 2.2 PowerShell 中执行命令

在 PowerShell 里执行根目录脚本时，需要加 `./` 或 `.\`：

```powershell
# 只启用客服-数据报表
.\build-role-package.cmd 1

# 启用客服-数据报表 + 财务-提现账单
.\build-role-package.cmd 12

# 启用客服-数据报表 + 财务-涉税账单
.\build-role-package.cmd 13

# 启用全部角色
.\build-role-package.cmd 123

# 启用全部角色，也可以写 all
.\build-role-package.cmd all

# 启用客服 + 提现，未启用角色置灰显示
.\build-role-package.cmd 12 disabled
```

也可以使用 `scripts` 目录下的脚本：

```powershell
scripts\build-role-package.cmd 1 2
scripts\build-role-package.cmd 1,2
scripts\build-role-package.cmd 12
scripts\build-role-package.cmd 12 disabled
```

### 2.3 CMD 中执行命令

在 Windows CMD 中可以直接执行：

```cmd
build-role-package.cmd 1
build-role-package.cmd 12
build-role-package.cmd 13
build-role-package.cmd 123
build-role-package.cmd all
build-role-package.cmd 12 disabled
```

### 2.4 支持的角色参数格式

| 写法 | 含义 |
|---|---|
| `1` | 只启用客服-数据报表 |
| `2` | 只启用财务-提现账单 |
| `3` | 只启用财务-涉税账单 |
| `12` | 启用客服-数据报表 + 财务-提现账单 |
| `13` | 启用客服-数据报表 + 财务-涉税账单 |
| `123` | 启用全部角色 |
| `1 2` | 启用客服-数据报表 + 财务-提现账单 |
| `1,2` | 启用客服-数据报表 + 财务-提现账单 |
| `all` | 启用全部角色 |

### 2.5 未启用角色显示参数

| 参数 | 效果 |
|---|---|
| 不传，默认 `hidden` | 未启用角色隐藏。 |
| `disabled` | 未启用角色显示，但按钮置灰，点击提示当前包未启用。 |

示例：

```cmd
build-role-package.cmd 12 disabled
```

表示只启用角色 1、2，角色 3 显示但置灰。

### 2.6 指定版本号

CMD 脚本支持 `version=` 参数：

```cmd
build-role-package.cmd 12 version=0.9.12
```

PowerShell 脚本支持 `-Version` 参数：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\build-role-package.ps1" -Roles "1,2" -Version "0.9.12"
```

### 2.7 正式插件包不包含的内容

正式打出来给运营安装的 ZIP 不包含：

```text
scripts/
打包说明.txt
build-role-package.cmd
build-role-package.ps1
一键打包-*.cmd
extension-src/
母包源码目录
```

正式插件包只保留插件运行所需文件，例如：

```text
manifest.json
dashboard.html
dashboard.js
dashboard.css
service-worker.js
shared.js
config/collector-role.config.json
icons/
```

---

## 3. 自动采集计划

### 3.1 默认值

V0.9.12 新安装或新角色初始化时，默认值为：

| 配置项 | 默认值 |
|---|---|
| 是否开启自动采集 | 开启 |
| 采集时间 | 09:30 |
| 计划类型 | 按天 / 按周 |
| 执行日期 | 每天 |
| 指定周几默认值 | 周一到周五 |
| 按月默认日期 | 每月 1 号 |
| 采集完成后 | 自动同步运营系统 |
| 平台探活 | 开启 |
| 探活频率 | 8～10 分钟随机 |
| 自动采集平台 | 微信小店、抖店、拼多多全部勾选 |

### 3.2 支持的计划频率

| 计划类型 | 可选项 | 说明 |
|---|---|---|
| 按天 / 按周 | 每天 | 每天到点执行。 |
| 按天 / 按周 | 工作日 | 周一到周五执行。 |
| 按天 / 按周 | 指定周几 | 自定义周一到周日中的任意组合。 |
| 按月 | 每月第几号 | 每月指定日期执行，例如每月 1 号、15 号。 |

### 3.3 每个角色独立保存

每个角色都有自己的自动采集计划，例如：

```text
客服-数据报表：每天 09:30 自动采集。
财务-提现账单：每月 1 号 10:00 自动采集。
财务-涉税账单：指定周几或按月采集。
```

当前 V0.9.12 中，角色 2 和角色 3 的真实接口尚未接入，因此即使开启自动计划，也会提示该角色采集接口尚未接入，不会执行真实采集。

---

## 4. Debug 调试模式

### 4.1 进入方式

在插件看板 URL 后追加：

```text
?debug=日期+星期
```

计算规则：

```text
debugCode = 当月日期 + 星期数字
```

星期数字规则：

```text
周一 = 1
周二 = 2
周三 = 3
周四 = 4
周五 = 5
周六 = 6
周日 = 7
```

示例：

```text
如果今天是 15 号周三，debug 参数就是 153。
如果今天是 6 号周日，debug 参数就是 67。
```

最终地址示例：

```text
chrome-extension://<扩展ID>/dashboard.html?debug=153
```

Edge 浏览器同理：

```text
extension://<扩展ID>/dashboard.html?debug=153
```

实际复制插件页面地址后，在 `dashboard.html` 后追加 `?debug=xxx` 即可。

### 4.2 Debug 模式显示的功能

进入 Debug 模式后，会额外显示：

```text
复制接口统计
清空本地缓存
调试日志开关
复制调试日志
导出调试日志
清空调试日志
原始 JSON Tab
调试日志 Tab
```

### 4.3 调试日志记录内容

开启“调试日志”后，会记录：

```text
请求方法
请求 URL
Header 名称
Body 摘要
响应状态
响应类型
请求 transport
错误信息
平台切换过程
接口解析结果
```

敏感信息会自动脱敏，例如：

```text
Cookie
token
csrf
ticket
session
```

---

## 5. 采集按钮互斥机制

### 5.1 互斥范围

V0.9.12 使用全局采集锁，同一个浏览器 Profile 内，同一时间只允许一个采集任务执行。

互斥入口包括：

```text
一键采集已登录平台
单独采集微信小店
单独采集抖店
单独采集拼多多
立即采集当前角色一次
自动采集计划触发
```

### 5.2 锁定后的表现

当任意采集任务正在执行时：

```text
其他采集按钮会被禁用。
按钮文案会变为“采集锁定中”。
自动采集到点时会跳过本次任务，不排队。
平台探活会跳过，避免刷新首页打断采集。
同步、导出等按钮根据当前状态自动控制。
```

### 5.3 异常解锁

采集锁有 60 分钟超时兜底。

如果浏览器异常关闭、页面异常刷新、采集任务没有正常释放锁，超过 60 分钟后会被视为过期锁，后续采集可重新启动。

### 5.4 多 Profile 说明

Edge / Chrome 的不同 Profile 之间插件存储隔离，因此采集锁只在当前 Profile 内生效。两个不同 Profile 如果都安装了插件，它们的锁不会互相影响。

---

## 6. 每个平台的采集方式差异

### 6.1 微信小店

微信小店采用后台请求方式采集。

核心特点：

```text
使用当前浏览器微信小店登录态。
依赖 store.weixin.qq.com 的 Cookie，尤其是 biz_magic。
先通过接口获取店铺列表。
每家店通过 switchShop 接口切换店铺。
切换后并行请求店铺体验分、诊断中心、客服接待、客服销售等接口。
店铺采集操作排队执行，避免多个店铺同时切换造成上下文混乱。
```

适合原因：

```text
微信小店接口对后台 fetch 支持较好。
直接请求稳定，不需要频繁操作前台页面。
```

### 6.2 抖店

抖店采用当前可见标签页 + JSON 页面导航 + CDP 辅助切店方式。

核心特点：

```text
使用当前浏览器已登录的抖店标签页。
主体列表通过 get_login_subject 获取。
切换主体时使用抖店页面里的主体选择器。
部分切店动作使用 CDP 模拟页面环境执行，保证和人工页面切店上下文一致。
业务接口通过当前抖店标签页导航到 JSON 接口读取。
每家店采集前后有随机等待，避免连续切店过快。
采集完成后会尽量恢复抖店首页。
```

注意：

```text
检测和探活链路已尽量不使用 chrome.debugger，减少 Edge 顶部“已开始调试此浏览器”提示。
正式采集链路中，抖店切店仍可能使用 CDP，因此正式采集时仍可能出现浏览器调试提示条。
```

### 6.3 拼多多

拼多多采用当前商家后台标签页采集当前店铺。

核心特点：

```text
先通过 checkLogin 判断是否登录。
店铺信息从 Cookie 和 commonMallInfo 接口补充。
GET 接口通过当前标签页导航读取 JSON。
POST 接口通过页面上下文 fetch 发起。
当前版本采集当前拼多多店铺，不做多店铺切换。
客服绩效按 T-3 单日查询。
采集结束后会恢复到拼多多首页。
```

注意：

```text
拼多多的 sydney 接口真实页面使用 POST，不能直接用 tabs.update 跳 URL，否则会变成 GET。
因此部分 POST 接口通过页面上下文执行 fetch。
```

---

## 7. 当前“客服-数据报表”调用接口与入参

本节只说明角色 1：客服-数据报表。

### 7.1 微信小店接口

基础域名：

```text
https://store.weixin.qq.com
```

#### 7.1.1 获取店铺列表

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/shop-faas/mmecnodelogin/session/getShopSwitchList?token=&lang=zh_CN` |
| 入参 | `token=`、`lang=zh_CN` |
| Header | `Accept: application/json, text/plain, */*` |
| Referrer | `/shop/kf/data` |
| 用途 | 获取当前账号可切换的微信小店列表。 |

#### 7.1.2 切换店铺

| 项 | 内容 |
|---|---|
| 方法 | POST |
| 接口 | `/shop-faas/mmecnodelogin/session/switchShop?token=&lang=zh_CN` |
| Body | `{"appid":"wx..."}` |
| Header | `Accept: application/json, text/plain, */*`，`Content-Type: application/json` |
| Referrer | `/shop/setting/rate2` |
| 用途 | 切换到指定微信小店。 |

#### 7.1.3 诊断中心

| 项 | 内容 |
|---|---|
| 方法 | POST |
| 接口 | `/shop-faas/mmecnodeviolationsec/prewarn/cgi/getChartData?lang=zh_CN` |
| Body | `{}` |
| Header | `Accept: application/json, text/plain, */*`，`Content-Type: application/json` |
| Referrer | `/shop/shopdiagnosis/home` |
| 采集字段 | 近 30 天品质退货率、近 30 天差评率、近 30 天纠纷发起率等。 |

#### 7.1.4 店铺体验分

| 项 | 内容 |
|---|---|
| 方法 | POST |
| 接口 | `/shop-faas/statistic/cgi/search?lang=zh_CN` |
| Body | `{"days":14,"scoreTypeList":[11,12,13,14,1000]}` |
| Header | `Accept: application/json, text/plain, */*`，`Content-Type: application/json`，`potter-scene: weixinShop` |
| Referrer | `/shop/setting/rate2` |
| 采集字段 | 我的体验分、商品体验分、物流体验分、服务体验分等。 |

#### 7.1.5 客服考核-接待数据表

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/shop/kf/cgi/data/getOfflineTableV2` |
| Query | `beginDate=<昨天00:00:00秒级时间戳>`、`endDate=<昨天23:59:59秒级时间戳>`、`offset=0`、`limit=100` |
| Header | `Accept: application/json, text/plain, */*` |
| Referrer | `/shop/kf/data` |
| 采集字段 | 客服、咨询用户数、会话数、回复率、平均响应、未回复率、满意率等。 |

#### 7.1.6 客服考核-销售数据

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/shop/kf/cgi/data/getSalesDetail` |
| Query | `beginDate=<昨天00:00:00秒级时间戳>`、`endDate=<昨天23:59:59秒级时间戳>`、`offset=0`、`limit=20` |
| Header | `Accept: application/json, text/plain, */*` |
| Referrer | `/shop/kf/data` |
| 采集字段 | 客服、询单人数、下单人数、成交人数、询单转化率、客服销售额等。 |

---

### 7.2 抖店接口

基础域名：

```text
https://fxg.jinritemai.com
https://pigeon.jinritemai.com
```

#### 7.2.1 获取主体列表

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `https://fxg.jinritemai.com/ecomauth/loginv1/get_login_subject` |
| Query | `bus_type=1`、`login_source=doudian_pc_web`、`entry_source=0`、`bus_child_type=0`、`appid=1` |
| 用途 | 获取当前抖店账号可登录/可切换的主体列表。 |

#### 7.2.2 体验分总览

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/governance/shop/experiencescore/getOverviewByVersion` |
| Query | `exp_version=release`、`new_shop_version=release`、`source=1` |
| Referrer | `/ffa/eco/experience-score?source=fxg-menu` |
| 采集字段 | 我的体验分、商品体验分、物流体验分、服务体验分、差行为扣分等。 |

#### 7.2.3 新服务体验明细

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/governance/shop/experiencescore/getSubScoreNew` |
| Query | `filter_by_industry=true`、`new_dimension=true`、`exp_version=release`、`new_shop_version=release`、`experience_node=3` |
| Referrer | `/ffa/eco/experience-score/detail?nodeId=316&preview=true` |
| 采集字段 | 新服务体验得分、飞鸽评价响应时长、售后平均审核时长、飞鸽会话不满意、平台求助率等。 |

#### 7.2.4 评价数据概览

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/product/tcomment/statistics` |
| Query | `appid=1`、`_bid=ffa_aftersale`、`aid=4272`、`aftersale_platform_source=fxg`、`verifyFp=<s_v_web_id Cookie>`、`fp=<s_v_web_id Cookie>` |
| Referrer | `/ffa/maftersale/comment` |
| 采集字段 | 近 30 天好评率、近 30 天中评率、近 30 天差评率等。 |

#### 7.2.5 客服数据

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `https://pigeon.jinritemai.com/backstage/queryStaffData` |
| Query | `_pms=1`、`page=1`、`size=20`、`startTime=<昨天YYYYMMDD>`、`endTime=<昨天YYYYMMDD>`、`queryType=1` |
| Referrer | 抖店/飞鸽客服相关页面上下文 |
| 采集字段 | 客服账号、已接待人数、全天首响时长、工作时间 3 分钟回复率、全天 3 分钟回复率、服务问题会话数、询单人数、下单人数、支付人数、退款后销售额、询单转化率等。 |

---

### 7.3 拼多多接口

基础域名：

```text
https://mms.pinduoduo.com
```

#### 7.3.1 登录检测

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/janus/api/checkLogin` |
| Query | 无 |
| 用途 | 检查拼多多商家后台是否已登录。 |

#### 7.3.2 店铺信息

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/earth/api/mallInfo/commonMallInfo` |
| Query | 无 |
| 用途 | 补充店铺名称、Logo、店铺类型等信息。 |

#### 7.3.3 消费者服务体验分

| 项 | 内容 |
|---|---|
| 方法 | POST |
| 接口 | `/sydney/api/mallService/getMallServeScoreV2` |
| Body | `{}` |
| Referrer | `/sycm/goods_quality/help` |
| 采集字段 | 消费者服务体验分、服务态度、基础服务、商品服务、发货服务、物流服务、平台求助率等。 |

#### 7.3.4 售后质量数据

| 项 | 内容 |
|---|---|
| 方法 | POST |
| 接口 | `/sydney/api/saleQuality/querySaleQualityDetailInfo` |
| Body | `{"queryDate":"<昨天YYYY-MM-DD>"}` |
| Referrer | `/sycm/goods_quality/detail` |
| 采集字段 | 纠纷退款数、纠纷退款率、平台介入订单数、平台介入率、品质退款数、品质退款率等。 |

#### 7.3.5 客服绩效详情

| 项 | 内容 |
|---|---|
| 方法 | GET |
| 接口 | `/chats/csReportDetail` |
| Query | `starttime=<T-3日期00:00秒级时间戳>`、`endtime=<T-3日期00:00秒级时间戳>` |
| 说明 | 拼多多客服绩效按 T-3 单日查询，例如今天 13 号，则查询 10 号。 |
| 采集字段 | 客服账号、客服服务分、咨询人数、询单人数、最终成团人数、去退销售额、需要人工回复的咨询人数、人工接待人数、3 分钟未回复人数、3 分钟人工回复率、30 秒应答率、平均人工响应时长等。 |

---

## 8. 采集数据输出结构

导出 JSON 和同步运营系统使用同一类 payload。

顶层关键字段：

```json
{
  "schemaVersion": "0.9.12",
  "exportedAt": "导出时间",
  "collectRole": "customer_report",
  "collectRoleName": "客服-数据报表",
  "collector": {
    "name": "九安智能采集",
    "version": "0.9.12",
    "roleId": "customer_report",
    "roleName": "客服-数据报表"
  },
  "fieldDefinitions": {},
  "platforms": {}
}
```

平台数据 key：

| key | 平台 |
|---|---|
| `weixin_shop` | 微信小店 |
| `doudian_shop` | 抖店 |
| `pdd_shop` | 拼多多 |

同步运营系统时，会额外增加：

```json
{
  "syncMeta": {
    "submitTime": "提交时间",
    "auth": {
      "providedInHeaders": true,
      "signatureAlg": "HMAC-SHA256",
      "signed": true,
      "validWindowSeconds": 300
    }
  }
}
```

同步请求方式：

```text
POST <运营系统接口地址>
Content-Type: application/json
Authorization: Bearer <Token>
```

同时会附带时间戳、nonce、bodyHash、签名算法、插件版本等请求头。后端当前可以先忽略，后续再启用签名校验、5 分钟有效期、nonce 防重放、Token 黑名单和 IP 审计。

---

## 9. 主面板按钮说明

### 9.1 顶部区域

| 按钮 / 元素 | 作用 |
|---|---|
| 插件状态 Badge | 显示当前三方平台登录检测状态。 |
| 调试模式 Badge | 进入 Debug 模式后显示当天调试码。 |
| 重新检测 | 重新检测微信小店、抖店、拼多多后台是否已打开、是否已登录。 |

### 9.2 角色区域

| 按钮 / 元素 | 作用 |
|---|---|
| 客服-数据报表 | 切换到角色 1。显示客服相关平台采集、自动计划和同步状态。 |
| 财务-提现账单 | 切换到角色 2。当前接口待接入，保留独立配置和计划。 |
| 财务-涉税账单 | 切换到角色 3。当前接口待接入，保留独立配置和计划。 |
| 采集当前角色 | 对当前角色执行一次手动采集。角色 1 会执行平台采集；角色 2/3 当前会提示接口未接入。 |

### 9.3 平台卡片区域

| 按钮 | 作用 |
|---|---|
| 微信小店：打开后台 | 打开微信小店后台页面。 |
| 微信小店：采集微信小店 | 采集当前账号下可切换的微信小店数据。 |
| 抖店：打开后台 | 打开抖店后台页面。 |
| 抖店：采集抖店 | 采集当前账号下可登录/可切换的抖店主体数据。 |
| 拼多多：打开后台 | 打开拼多多商家后台。 |
| 拼多多：采集拼多多 | 采集当前拼多多商家后台当前店铺数据。 |

### 9.4 全局工具栏

| 按钮 | 作用 |
|---|---|
| 一键采集已登录平台 | 对当前检测为已登录的平台并行采集。未登录的平台自动跳过。 |
| 停止采集 | 请求停止当前采集任务。多平台采集时会通知各平台停止。 |
| 导出 CSV | 将当前采集结果导出为 CSV。 |
| 导出 JSON | 将当前采集结果导出为运营系统 payload JSON。 |
| 同步运营系统 | 将当前采集结果 POST 到已配置的运营系统接口。 |
| 复制接口统计 | Debug 模式可见，复制本次采集接口统计。 |
| 清空本地缓存 | Debug 模式可见，清空本地缓存的采集结果。 |
| 调试日志 | Debug 模式可见，开启/关闭采集调试日志。 |
| 复制调试日志 | Debug 模式可见，复制当前调试日志。 |
| 导出调试日志 | Debug 模式可见，导出调试日志 JSON 文件。 |
| 清空调试日志 | Debug 模式可见，清空调试日志。 |

### 9.5 运营系统同步区域

| 按钮 / 字段 | 作用 |
|---|---|
| 展开 / 收起 | 展开或收起同步配置面板。 |
| 运营系统接口地址 | 填写后端接收采集数据的接口地址。 |
| 接口 Token | 后端分配的 Token，用于 Bearer 和签名请求头。 |
| 保存同步配置 | 保存接口地址和 Token 到当前 Profile 的本地存储。 |
| 测试配置 | 用当前接口地址和 Token 做测试请求。 |
| 同步结果弹窗 | 同步中显示进度；成功 5 秒自动关闭；失败 10 秒自动关闭；鼠标悬停或展开完整 JSON 时暂停自动关闭。 |

### 9.6 自动采集区域

| 按钮 / 字段 | 作用 |
|---|---|
| 编辑计划 / 展开配置 | 展开当前角色自动采集配置。 |
| 开启当前角色自动采集 | 控制当前角色是否自动采集。V0.9.12 新安装默认勾选。 |
| 采集时间 | 设置每天/工作日/指定周几/月度计划的执行时间。 |
| 计划类型 | 选择按天/按周或按月。 |
| 执行日期 | 选择每天、工作日、指定周几。 |
| 每月第几号 | 按月计划时设置每月几号执行。 |
| 采集完成后 | 选择自动同步运营系统，或只采集不自动同步。 |
| 开启平台探活 | 开启后按随机间隔刷新平台首页，保持登录状态。采集中自动暂停。 |
| 探活频率 | 8～10 分钟随机、10～15 分钟随机、关闭探活。 |
| 自动采集 / 探活平台 | 选择微信小店、抖店、拼多多参与自动采集和探活。仅角色 1 显示平台选择。 |
| 保存当前角色计划 | 保存当前角色的自动计划，并重新计算下次执行时间。 |
| 立即采集当前角色一次 | 手动触发当前角色采集一次。 |
| 立即探活一次 | 手动触发一次平台探活。 |
| 测试提醒 | 发送浏览器通知测试。 |

### 9.7 批量安全模式

| 元素 | 作用 |
|---|---|
| 批量安全模式 | 默认勾选。抖店批量切店时，店铺切换间隔随机 500～1000ms；每家完成后休息 1～2 秒；异常熔断保留。 |

### 9.8 采集进度浮窗

| 操作 | 作用 |
|---|---|
| 双击浮窗 | 展开或收起采集进度。 |
| 长按 250ms 后拖拽 | 移动浮窗位置。 |
| 展开/收起按钮 | 手动展开或收起进度卡片。 |
| 采集中状态 | 显示平台进度、成功数、失败数、整体百分比。 |
| 待采集 / 可重复采集 | 未采集或采集结束后的状态提示。 |

### 9.9 数据 Tab

| Tab | 作用 |
|---|---|
| 汇总看板 | 展示所有平台采集结果摘要。 |
| 微信小店数据 | 展示微信小店各店铺模块数据。 |
| 抖店数据 | 展示抖店各主体模块数据。 |
| 拼多多数据 | 展示拼多多当前店铺数据。 |
| 原始 JSON | Debug 模式可见，展示当前缓存原始 JSON。 |
| 调试日志 | Debug 模式可见，展示调试日志。 |

---

## 10. 平台探活说明

平台探活用于保持平台登录状态，但不会采集业务数据。

探活动作：

```text
微信小店：刷新/打开微信小店后台首页。
抖店：刷新/打开抖店后台首页，并尽量通过主体接口判断登录状态。
拼多多：刷新/打开拼多多商家后台首页，并通过 checkLogin 判断登录状态。
```

探活限制：

```text
采集中跳过探活。
距离自动采集过近时跳过探活。
探活不切店、不同步运营系统、不导出数据。
每个浏览器 Profile 独立调度。
```

---

## 11. 当前限制与注意事项

1. 角色 2、角色 3 当前是角色框架预留，真实财务接口尚未接入。
2. 正式采集过程中，抖店切店和拼多多 POST 采集可能使用 CDP，因此 Edge/Chrome 仍可能出现“已开始调试此浏览器”的安全提示条。
3. 检测和探活链路已尽量避免使用 `chrome.debugger`，主要用页面刷新、当前标签页 JSON 导航和 `chrome.scripting` 检测状态。
4. 不同浏览器 Profile 的插件数据、登录态、自动计划、采集锁相互隔离。
5. 给运营人员安装时，只发 `dist/` 目录里的正式插件 ZIP，不要发母包。
