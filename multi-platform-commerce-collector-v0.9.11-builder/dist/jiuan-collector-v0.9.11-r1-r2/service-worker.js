'use strict';

importScripts('shared.js');

const Shared = self.MultiCollectorShared;
const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');

const WEIXIN_ORIGIN = 'https://store.weixin.qq.com';
const WEIXIN_HOME = `${WEIXIN_ORIGIN}/shop/kf/data`;
const DOUDIAN_ORIGIN = 'https://fxg.jinritemai.com';
const DOUDIAN_IM_ORIGIN = 'https://im.jinritemai.com';
const DOUDIAN_PIGEON_ORIGIN = 'https://pigeon.jinritemai.com';
const DOUDIAN_HOME = `${DOUDIAN_ORIGIN}/ffa/mshop/homepage/index`;
const DOUDIAN_CUSTOMER_SERVICE_HOME = `${DOUDIAN_IM_ORIGIN}/pc_seller_v2/main/data/customerService/index`;
const DOUDIAN_SUBJECT_SELECT_URL = `${DOUDIAN_ORIGIN}/login/common?&hitted_check_type=2`;
const PDD_ORIGIN = 'https://mms.pinduoduo.com';
const PDD_ALT_ORIGIN = 'https://mms.pdd.com';
const PDD_HOME = `${PDD_ORIGIN}/home/`;
const PDD_CHECK_LOGIN_URL = `${PDD_ORIGIN}/janus/api/checkLogin`;
const PDD_USER_INFO_URL = `${PDD_ORIGIN}/janus/api/new/userinfo`;
const PDD_MALL_SERVE_SCORE_URL = `${PDD_ORIGIN}/sydney/api/mallService/getMallServeScoreV2`;
const PDD_SALE_QUALITY_URL = `${PDD_ORIGIN}/sydney/api/saleQuality/querySaleQualityDetailInfo`;
const PDD_CS_REPORT_URL = `${PDD_ORIGIN}/chats/csReportDetail`;
const PDD_COMMON_MALL_INFO_URL = `${PDD_ORIGIN}/earth/api/mallInfo/commonMallInfo`;

const REQUEST_TIMEOUT_MS = 15000;
// V0.3.2: 登录状态展示仍沿用 V0.3.1 的稳定策略：抖店标签页 + sessionid Cookie。
// 采集阶段修复 Blocked：请求支持 MAIN/ISOLATED 双环境 + fetch/XHR 兜底；
// V0.3.5：根据真实页面链路补充 check_login -> select_sso 预热，避免直接 ticket 切店。
// V0.3.7：主体列表接口 Blocked 时回退到抖店原生主体选择页，抓取页面店铺列表，避免缺少 __token/_lid 时直接失败。
// V0.3.9：通过 webRequest 捕获抖店页面真实请求中的 __token/_lid/_bid，并新增 shop/info 当前店铺校验。
// V0.4.6：基于 V0.4.6 成功链路精简：主体列表只取一次；业务接口直接走当前标签页 JSON；减少无效 Blocked 兜底日志和页面往返。
// V0.4.9：Blocked 兜底改为“预热后台临时标签页”：先打开抖店首页完成页面上下文初始化，再跳转接口 JSON。
// 避免直接打开接口 URL 被抖店/浏览器拦截，同时不污染用户当前正在看的抖店标签页。
// V0.5.9：客服数据不再打开 im.jinritemai.com 前端页，直接跳转 pigeon JSON 接口读取，避免 IM 静态 CSS chunk 加载失败影响页面。
// V0.6.0：新增拼多多模块，接入 checkLogin、getMallServeScoreV2、querySaleQualityDetailInfo、csReportDetail 三类采集。
// V0.6.1：修复环境检测未真正探测拼多多登录态；新增 new/userinfo 作为当前店铺/账号信息来源。
// V0.6.2：拼多多 new/userinfo 改为可选补充信息，GET 返回 METHOD_NOT_ALLOWED 时不再中断采集。
// V0.6.3：拼多多采集主链路不再访问 new/userinfo；checkLogin 后强制顺序采集三个业务接口，并增加 step 日志。
// V0.6.4：修正拼多多接口方法：getMallServeScoreV2、querySaleQualityDetailInfo 使用页面上下文 CDP POST；csReportDetail 继续 GET 导航。
// V0.6.6：拼多多客服绩效改为 T-3 单日查询；兼容 csReportDetail 返回 success=true 但不带 errorCode 的结构。
// V0.6.5：补齐拼多多 saleQuality POST body(queryDate) 与 referrer；客服绩效按近7天区间构造；增强 POST 失败日志。
// V0.6.8：拼多多采集结束后恢复到首页；微信小店恢复后台 Cookie + biz_magic 直连接口采集，避免页面注入失败。
// V0.7.2：微信小店改为店铺卡片汇总 + 展开客服明细；修复抖店客服日期为 YYYYMMDD。
// V0.7.3：各平台采集结果新增接口请求日期/出参日期元数据，并在看板高亮展示。
const SWITCH_DELAY_MS = 1500;
const AFTER_SWITCH_DELAY_MS = 700;
const DOUDIAN_SWITCH_DELAY_MS = [500, 1000];
const DOUDIAN_API_DELAY_MS = [800, 1500];
const PREPARE_TAB_RELOAD_TIMEOUT_MS = 30000;
const ABORT_REGISTRY_KEY = '__MULTI_COLLECTOR_ABORT_CONTROLLERS__';
const activeRuns = new Map();
let debugEnabled = false;
let debugLogs = [];
const MAX_DEBUG_LOGS = 600;
const DEBUG_STORAGE_KEY = 'multiPlatformCollectorDebugLogs.v0.4.2';
const REMINDER_STORAGE_KEY = 'jiuanCollectorReminders.v0.8.11';
const REMINDER_ALARM_PREFIX = 'jiuan-reminder-';
const AUTO_COLLECT_SETTINGS_KEY = 'jiuanCollectorAutoSettings.v0.9.11';
const LEGACY_AUTO_COLLECT_SETTINGS_KEYS = ['jiuanCollectorAutoSettings.v0.9.6', 'jiuanCollectorAutoSettings.v0.9.3', 'jiuanCollectorAutoSettings.v0.9.2', 'jiuanCollectorAutoSettings.v0.9.1', 'jiuanCollectorAutoSettings.v0.9.0'];
const AUTO_COLLECT_TRIGGER_KEY = 'jiuanCollectorAutoTrigger.v0.9.11';
const AUTO_COLLECT_ALARM_NAME = 'jiuan-auto-collect-daily';
const ROLE_AUTO_SETTINGS_KEY = 'jiuanCollectorRoleSettings.v0.9.11';
const AUTO_COLLECT_ROLE_ALARM_PREFIX = 'jiuan-auto-collect-role-';
const AUTO_KEEP_ALIVE_ALARM_NAME = 'jiuan-platform-keepalive-random';
const AUTO_PREHEAT_ALARM_NAME = 'jiuan-platform-preheat';
const COLLECTING_LOCK_KEY = 'jiuanCollectorCollectingLock.v0.9.11';
const LEGACY_COLLECTING_LOCK_KEYS = ['jiuanCollectorCollectingLock.v0.9.6', 'jiuanCollectorCollectingLock.v0.9.3', 'jiuanCollectorCollectingLock.v0.9.1'];
const COLLECTING_LOCK_TIMEOUT_MS = 60 * 60 * 1000;

const COLLECT_ROLES = [
  { id: 'customer_report', code: 1, name: '客服-数据报表', supported: true },
  { id: 'finance_withdraw', code: 2, name: '财务-提现账单', supported: false },
  { id: 'finance_tax', code: 3, name: '财务-涉税账单', supported: false }
];
const ROLE_BY_ID = Object.fromEntries(COLLECT_ROLES.map(role => [role.id, role]));
const ROLE_BY_CODE = Object.fromEntries(COLLECT_ROLES.map(role => [String(role.code), role]));
const DEFAULT_ROLE_ID = 'customer_report';
const DOUDIAN_CAPTURE_MAX = 80;
const doudianCapturedUrlsByTab = new Map();
let weixinStoreOperationQueue = Promise.resolve();

function enqueueWeixinStoreOperation(operation) {
  const current = weixinStoreOperationQueue.then(operation, operation);
  weixinStoreOperationQueue = current.catch(() => {});
  return current;
}



// V0.3.9：抖店的 __token / _lid 通常只出现在页面自己发起的真实请求里。
// 使用 webRequest 只记录 URL 元数据，不读取 Cookie / Response，避免在 service worker 中跨域伪造请求。
try {
  if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
    chrome.webRequest.onBeforeRequest.addListener(details => {
      if (!details || details.tabId === undefined || details.tabId < 0 || !details.url) return;
      if (!/^https:\/\/(fxg\.jinritemai\.com|doudian-sso\.jinritemai\.com|pigeon\.jinritemai\.com)\//i.test(details.url)) return;
      const list = doudianCapturedUrlsByTab.get(details.tabId) || [];
      list.push({ url: details.url, timeStamp: details.timeStamp || Date.now(), type: details.type || '' });
      while (list.length > DOUDIAN_CAPTURE_MAX) list.shift();
      doudianCapturedUrlsByTab.set(details.tabId, list);
    }, { urls: ['https://fxg.jinritemai.com/*', 'https://doudian-sso.jinritemai.com/*', 'https://pigeon.jinritemai.com/*'] });
  }
} catch (error) {
  console.warn('初始化抖店请求捕获失败', error);
}

chrome.action.onClicked.addListener(() => {
  void openDashboard();
});

async function openDashboard() {
  try {
    const existing = await chrome.tabs.query({ url: `${DASHBOARD_URL}*` });
    if (existing.length > 0) {
      const tab = existing[0];
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
      return;
    }
    await chrome.tabs.create({ url: DASHBOARD_URL });
  } catch (error) {
    console.error('打开多平台采集看板失败', error);
  }
}

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'dashboard-lifetime') return;
  const dashboardTabId = port.sender?.tab?.id;
  if (dashboardTabId === undefined) return;
  port.onDisconnect.addListener(() => {
    void cancelRunsByDashboardTab(dashboardTabId, '数据看板已关闭或刷新');
  });
});

chrome.tabs.onRemoved.addListener(tabId => {
  void cancelRunsByDashboardTab(tabId, '数据看板已关闭');
});

chrome.alarms?.onAlarm?.addListener(alarm => {
  if (alarm?.name === AUTO_COLLECT_ALARM_NAME) {
    void handleAutoCollectAlarm();
    return;
  }
  if (alarm?.name?.startsWith(AUTO_COLLECT_ROLE_ALARM_PREFIX)) {
    void handleAutoCollectAlarm(alarm.name.slice(AUTO_COLLECT_ROLE_ALARM_PREFIX.length));
    return;
  }
  if (alarm?.name === AUTO_KEEP_ALIVE_ALARM_NAME) {
    void handlePlatformKeepAliveAlarm('random-alarm');
    return;
  }
  if (alarm?.name === AUTO_PREHEAT_ALARM_NAME) {
    try { chrome.alarms.clear(AUTO_PREHEAT_ALARM_NAME); } catch {}
    return;
  }
  if (!alarm?.name?.startsWith(REMINDER_ALARM_PREFIX)) return;
  const id = alarm.name.slice(REMINDER_ALARM_PREFIX.length);
  void handleReminderAlarm(id);
});

chrome.runtime.onStartup?.addListener(() => {
  void restoreReminderAlarms();
  void restoreAutoCollectAlarm();
});

chrome.runtime.onInstalled?.addListener(() => {
  void restoreReminderAlarms();
  void restoreAutoCollectAlarm();
});

chrome.notifications?.onClicked?.addListener(() => {
  void openDashboard();
});

void restoreReminderAlarms();
void restoreAutoCollectAlarm();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error('扩展任务失败', error);
      sendResponse({
        ok: false,
        code: error.code || 'EXTENSION_ERROR',
        message: error.message || String(error)
      });
    });
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case 'PING':
      return getCapabilities();
    case 'GET_ENVIRONMENT':
      return getEnvironment(sender);
    case 'SET_DEBUG_ENABLED':
      debugEnabled = Boolean(message.enabled);
      addDebugLog('debug.toggle', { enabled: debugEnabled });
      return { debugEnabled };
    case 'GET_DEBUG_LOGS':
      return { debugEnabled, logs: debugLogs.slice(-MAX_DEBUG_LOGS) };
    case 'CLEAR_DEBUG_LOGS':
      debugLogs = [];
      try { await chrome.storage.local.remove(DEBUG_STORAGE_KEY); } catch {}
      return { cleared: true };
    case 'OPEN_PLATFORM':
      return openPlatform(String(message.platform || ''));
    case 'START_RUN':
      return startRun(String(message.runId || ''), sender, String(message.platform || ''));
    case 'STOP_RUN':
      return stopRun(String(message.runId || ''), String(message.reason || '用户手动停止'));
    case 'GET_WEIXIN_SHOPS':
      return getWeixinShops(String(message.runId || ''), sender);
    case 'COLLECT_WEIXIN_STORE':
      return collectWeixinStore(String(message.appid || ''), String(message.runId || ''), sender);
    case 'GET_DOUDIAN_SUBJECTS':
      return getDoudianSubjects(String(message.runId || ''), sender);
    case 'COLLECT_DOUDIAN_SUBJECT':
      return collectDoudianSubject(message.subject || {}, String(message.runId || ''), sender);
    case 'COLLECT_PDD_CURRENT':
      return collectPddCurrent(String(message.runId || ''), sender);
    case 'LIST_REMINDERS':
      return listReminders();
    case 'SAVE_REMINDER':
      return saveReminder(message.reminder || {});
    case 'DELETE_REMINDER':
      return deleteReminder(String(message.id || ''));
    case 'TOGGLE_REMINDER':
      return toggleReminder(String(message.id || ''));
    case 'TEST_REMINDER_NOTIFICATION':
      await showReminderNotification({ title: String(message.title || '九安智能采集提醒'), note: String(message.note || '') });
      return { sent: true };
    case 'RESCHEDULE_AUTO_COLLECT':
      return rescheduleAutoCollect(message.settings || null);
    case 'RESCHEDULE_ROLE_AUTO_COLLECT':
      return rescheduleRoleAutoCollect(message.roleSettings || null);
    case 'GET_AUTO_COLLECT_STATUS':
      return getAutoCollectStatus();
    case 'GET_ROLE_AUTO_COLLECT_STATUS':
      return getRoleAutoCollectStatus();
    case 'SHOW_AUTO_COLLECT_NOTIFICATION':
      await showAutoCollectNotification(String(message.title || '九安智能采集'), String(message.message || ''));
      return { sent: true };
    case 'RUN_PLATFORM_KEEPALIVE':
      return runPlatformKeepAlive(message.settings || message.roleSettings || null, String(message.source || 'manual'));
    default:
      throw makeError(`不支持的消息类型：${message?.type || ''}`, 'UNSUPPORTED_MESSAGE');
  }
}



function normalizeRoleId(value) {
  const key = String(value || '').trim();
  if (ROLE_BY_ID[key]) return key;
  if (ROLE_BY_CODE[key]) return ROLE_BY_CODE[key].id;
  return DEFAULT_ROLE_ID;
}

function defaultAutoCollectSettings(roleId = DEFAULT_ROLE_ID) {
  return {
    roleId: normalizeRoleId(roleId),
    enabled: true,
    time: '09:30',
    scheduleType: 'day',
    dayMode: 'daily',
    weekdays: [1, 2, 3, 4, 5],
    monthDay: 1,
    platforms: { weixin_shop: true, doudian: true, pdd: true },
    afterCollect: 'sync',
    keepAlive: {
      enabled: true,
      intervalMode: '8_10',
      nextRunAt: '',
      lastRunAt: '',
      lastResult: ''
    },
    nextRunAt: '',
    lastRunAt: '',
    lastResult: ''
  };
}

function normalizeWeekdays(value) {
  const list = Array.isArray(value) ? value : [];
  const result = Array.from(new Set(list.map(Number).filter(day => day >= 1 && day <= 7))).sort((a, b) => a - b);
  return result.length ? result : [1, 2, 3, 4, 5];
}

function normalizeMonthDay(value) {
  const num = Number(value || 1);
  if (!Number.isFinite(num)) return 1;
  return Math.min(31, Math.max(1, Math.floor(num)));
}

function normalizeKeepAliveSettings(raw = {}) {
  const base = defaultAutoCollectSettings().keepAlive;
  let intervalMode = ['8_10', '10_15', 'off'].includes(String(raw.intervalMode || ''))
    ? String(raw.intervalMode)
    : base.intervalMode;
  if (String(raw.intervalMode || '') === 'preheat_only') intervalMode = 'off';
  return {
    ...base,
    enabled: raw.enabled !== false && intervalMode !== 'off',
    intervalMode,
    nextRunAt: String(raw.nextRunAt || ''),
    lastRunAt: String(raw.lastRunAt || ''),
    lastResult: String(raw.lastResult || '')
  };
}

function normalizeAutoCollectSettings(raw = {}, roleId = raw?.roleId || DEFAULT_ROLE_ID) {
  const rid = normalizeRoleId(roleId || raw.roleId || DEFAULT_ROLE_ID);
  const base = defaultAutoCollectSettings(rid);
  const platforms = raw.platforms && typeof raw.platforms === 'object' ? raw.platforms : {};
  const time = /^\d{2}:\d{2}$/.test(String(raw.time || '')) ? String(raw.time) : base.time;
  const scheduleType = raw.scheduleType === 'month' ? 'month' : 'day';
  const dayMode = ['daily', 'workdays', 'weekdays'].includes(raw.dayMode) ? raw.dayMode : base.dayMode;
  return {
    ...base,
    roleId: rid,
    enabled: Boolean(raw.enabled),
    time,
    scheduleType,
    dayMode,
    weekdays: normalizeWeekdays(raw.weekdays || base.weekdays),
    monthDay: normalizeMonthDay(raw.monthDay || base.monthDay),
    platforms: {
      weixin_shop: platforms.weixin_shop !== false,
      doudian: platforms.doudian !== false,
      pdd: platforms.pdd !== false
    },
    afterCollect: raw.afterCollect === 'none' ? 'none' : 'sync',
    keepAlive: normalizeKeepAliveSettings(raw.keepAlive || {}),
    nextRunAt: String(raw.nextRunAt || ''),
    lastRunAt: String(raw.lastRunAt || ''),
    lastResult: String(raw.lastResult || '')
  };
}

function normalizeRoleSettingsStore(raw = {}) {
  const roles = {};
  COLLECT_ROLES.forEach(role => {
    roles[role.id] = normalizeAutoCollectSettings(raw.roles?.[role.id] || (role.id === DEFAULT_ROLE_ID ? raw : { roleId: role.id }), role.id);
  });
  return { activeRole: normalizeRoleId(raw.activeRole || DEFAULT_ROLE_ID), roles };
}

function selectedAutoPlatforms(cfg = {}) {
  const platforms = normalizeAutoCollectSettings(cfg).platforms || {};
  return ['weixin_shop', 'doudian', 'pdd'].filter(platform => platforms[platform] !== false);
}

async function getStoredAutoCollectSettings() {
  const keys = [ROLE_AUTO_SETTINGS_KEY, AUTO_COLLECT_SETTINGS_KEY, ...(typeof LEGACY_AUTO_COLLECT_SETTINGS_KEYS !== 'undefined' ? LEGACY_AUTO_COLLECT_SETTINGS_KEYS : [])];
  const stored = await chrome.storage.local.get(keys);
  if (stored[ROLE_AUTO_SETTINGS_KEY]) return normalizeRoleSettingsStore(stored[ROLE_AUTO_SETTINGS_KEY]);
  const legacy = stored[AUTO_COLLECT_SETTINGS_KEY] || (typeof LEGACY_AUTO_COLLECT_SETTINGS_KEYS !== 'undefined' ? LEGACY_AUTO_COLLECT_SETTINGS_KEYS : [])
    .map(key => stored[key])
    .find(value => value && typeof value === 'object') || {};
  return normalizeRoleSettingsStore({ activeRole: DEFAULT_ROLE_ID, roles: { [DEFAULT_ROLE_ID]: legacy } });
}

async function setStoredAutoCollectSettings(settings) {
  const normalized = settings?.roles ? normalizeRoleSettingsStore(settings) : normalizeRoleSettingsStore({ activeRole: DEFAULT_ROLE_ID, roles: { [DEFAULT_ROLE_ID]: settings || {} } });
  await chrome.storage.local.set({ [ROLE_AUTO_SETTINGS_KEY]: normalized });
  return normalized;
}

function primaryKeepAliveSettings(store) {
  const role = Object.values(normalizeRoleSettingsStore(store).roles).find(cfg => cfg.keepAlive?.enabled) || normalizeRoleSettingsStore(store).roles[DEFAULT_ROLE_ID];
  return role || defaultAutoCollectSettings(DEFAULT_ROLE_ID);
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

async function getStoredCollectingLock() {
  const keys = [COLLECTING_LOCK_KEY, ...LEGACY_COLLECTING_LOCK_KEYS];
  const stored = await chrome.storage.local.get(keys);
  let lock = stored[COLLECTING_LOCK_KEY] || LEGACY_COLLECTING_LOCK_KEYS.map(key => stored[key]).find(value => value && typeof value === 'object');
  if (!lock || typeof lock !== 'object' || !lock.running) return null;
  const startedAt = Number(lock.startedAt || 0);
  if (startedAt && Date.now() - startedAt > COLLECTING_LOCK_TIMEOUT_MS) {
    try { await chrome.storage.local.remove(keys); } catch {}
    return null;
  }
  return lock;
}

async function isCollectingLocked() {
  return Boolean(await getStoredCollectingLock());
}

function nextAutoCollectTime(settings, fromTime = Date.now()) {
  const cfg = normalizeAutoCollectSettings(settings || {});
  if (!cfg.enabled) return null;
  const [hour, minute] = String(cfg.time || '09:30').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const fromDate = new Date(fromTime);
  if (cfg.scheduleType === 'month') {
    for (let offset = 0; offset < 15; offset += 1) {
      const date = new Date(fromDate.getFullYear(), fromDate.getMonth() + offset, 1, hour, minute, 0, 0);
      const targetDay = Math.min(cfg.monthDay, lastDayOfMonth(date.getFullYear(), date.getMonth()));
      date.setDate(targetDay);
      if (date.getTime() > fromTime) return date.getTime();
    }
    return null;
  }
  const allowedDays = cfg.dayMode === 'workdays'
    ? [1, 2, 3, 4, 5]
    : cfg.dayMode === 'weekdays'
      ? normalizeWeekdays(cfg.weekdays)
      : [1, 2, 3, 4, 5, 6, 7];
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(fromDate);
    date.setDate(fromDate.getDate() + offset);
    date.setHours(hour, minute, 0, 0);
    const day = date.getDay() || 7;
    if (allowedDays.includes(day) && date.getTime() > fromTime) return date.getTime();
  }
  return null;
}

function keepAliveDelayMinutes(cfg) {
  const mode = normalizeAutoCollectSettings(cfg).keepAlive?.intervalMode || '8_10';
  const ranges = {
    '8_10': [8, 10],
    '10_15': [10, 15]
  };
  const range = ranges[mode];
  if (!range) return null;
  const [min, max] = range;
  return min + Math.random() * (max - min);
}

async function clearRoleAutoAlarms() {
  try {
    const alarms = await chrome.alarms.getAll();
    await Promise.all((alarms || [])
      .filter(alarm => alarm.name === AUTO_COLLECT_ALARM_NAME || alarm.name?.startsWith(AUTO_COLLECT_ROLE_ALARM_PREFIX) || alarm.name === AUTO_PREHEAT_ALARM_NAME)
      .map(alarm => chrome.alarms.clear(alarm.name)));
  } catch {}
}

async function rescheduleKeepAlive(settings = null, options = {}) {
  const store = settings?.roles ? normalizeRoleSettingsStore(settings) : await getStoredAutoCollectSettings();
  const cfg = primaryKeepAliveSettings(store);
  try { await chrome.alarms.clear(AUTO_KEEP_ALIVE_ALARM_NAME); } catch {}
  const delayMinutes = cfg.keepAlive?.enabled ? keepAliveDelayMinutes(cfg) : null;
  let when = null;
  if (delayMinutes) {
    when = Date.now() + delayMinutes * 60 * 1000;
    await chrome.alarms.create(AUTO_KEEP_ALIVE_ALARM_NAME, { when });
  }
  Object.keys(store.roles).forEach(roleId => {
    store.roles[roleId] = normalizeAutoCollectSettings({
      ...(store.roles[roleId] || {}),
      keepAlive: { ...(store.roles[roleId]?.keepAlive || {}), nextRunAt: when ? new Date(when).toISOString() : '' }
    }, roleId);
  });
  if (options.persist !== false) await setStoredAutoCollectSettings(store);
  return { keepAliveNextRunAt: when ? new Date(when).toISOString() : '' };
}

async function rescheduleRoleAutoCollect(settings = null) {
  const store = normalizeRoleSettingsStore(settings || await getStoredAutoCollectSettings());
  await clearRoleAutoAlarms();
  const rolesStatus = {};
  for (const role of COLLECT_ROLES) {
    const cfg = normalizeAutoCollectSettings(store.roles[role.id] || {}, role.id);
    const when = nextAutoCollectTime(cfg, Date.now());
    store.roles[role.id] = normalizeAutoCollectSettings({ ...cfg, nextRunAt: when ? new Date(when).toISOString() : '' }, role.id);
    rolesStatus[role.id] = { enabled: cfg.enabled, nextRunAt: store.roles[role.id].nextRunAt };
    if (when) await chrome.alarms.create(`${AUTO_COLLECT_ROLE_ALARM_PREFIX}${role.id}`, { when });
  }
  const keepAliveSchedule = await rescheduleKeepAlive(store, { persist: false });
  Object.keys(store.roles).forEach(roleId => {
    store.roles[roleId] = normalizeAutoCollectSettings({
      ...(store.roles[roleId] || {}),
      keepAlive: { ...(store.roles[roleId]?.keepAlive || {}), nextRunAt: keepAliveSchedule.keepAliveNextRunAt || '' }
    }, roleId);
    rolesStatus[roleId].keepAliveNextRunAt = keepAliveSchedule.keepAliveNextRunAt || '';
  });
  await setStoredAutoCollectSettings(store);
  return { roles: rolesStatus, keepAliveNextRunAt: keepAliveSchedule.keepAliveNextRunAt || '' };
}

async function rescheduleAutoCollect(settings = null) {
  const store = settings?.roles ? normalizeRoleSettingsStore(settings) : normalizeRoleSettingsStore({ activeRole: DEFAULT_ROLE_ID, roles: { [DEFAULT_ROLE_ID]: settings || {} } });
  return rescheduleRoleAutoCollect(store);
}

async function getRoleAutoCollectStatus() {
  const store = await getStoredAutoCollectSettings();
  const rolesStatus = {};
  let keepAliveAlarm = null;
  try { keepAliveAlarm = await chrome.alarms.get(AUTO_KEEP_ALIVE_ALARM_NAME); } catch {}
  for (const role of COLLECT_ROLES) {
    const cfg = normalizeAutoCollectSettings(store.roles[role.id] || {}, role.id);
    let alarm = null;
    try { alarm = await chrome.alarms.get(`${AUTO_COLLECT_ROLE_ALARM_PREFIX}${role.id}`); } catch {}
    rolesStatus[role.id] = {
      enabled: cfg.enabled,
      nextRunAt: alarm?.scheduledTime ? new Date(alarm.scheduledTime).toISOString() : cfg.nextRunAt,
      keepAliveNextRunAt: keepAliveAlarm?.scheduledTime ? new Date(keepAliveAlarm.scheduledTime).toISOString() : cfg.keepAlive?.nextRunAt || ''
    };
  }
  return { roles: rolesStatus, keepAliveNextRunAt: keepAliveAlarm?.scheduledTime ? new Date(keepAliveAlarm.scheduledTime).toISOString() : '' };
}

async function getAutoCollectStatus() {
  const status = await getRoleAutoCollectStatus();
  const item = status.roles?.[DEFAULT_ROLE_ID] || {};
  return { enabled: item.enabled, nextRunAt: item.nextRunAt || '', keepAliveNextRunAt: status.keepAliveNextRunAt || item.keepAliveNextRunAt || '' };
}

async function restoreAutoCollectAlarm() {
  try {
    const store = await getStoredAutoCollectSettings();
    await rescheduleRoleAutoCollect(store);
  } catch (error) {
    console.warn('恢复自动采集/探活闹钟失败', error);
  }
}

async function handleAutoCollectAlarm(roleId = DEFAULT_ROLE_ID) {
  const store = await getStoredAutoCollectSettings();
  await rescheduleRoleAutoCollect(store);
  const rid = normalizeRoleId(roleId);
  const cfg = normalizeAutoCollectSettings(store.roles?.[rid] || {}, rid);
  if (!cfg.enabled) return;
  if (await isCollectingLocked()) {
    await recordKeepAliveResult(store, `${ROLE_BY_ID[rid]?.name || '当前角色'}自动采集到点时已有采集任务执行，本次自动采集跳过。`);
    await showAutoCollectNotification('九安智能采集：自动采集跳过', '当前已有采集任务正在执行，本次自动采集已跳过。');
    return;
  }
  const trigger = {
    id: `auto-${rid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    roleId: rid,
    source: 'chrome-alarm',
    firedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ [AUTO_COLLECT_TRIGGER_KEY]: trigger });
  await showAutoCollectNotification('九安智能采集：自动采集到点', `${ROLE_BY_ID[rid]?.name || '当前角色'}正在打开插件看板。锁屏状态可以继续执行；如登录失效请人工重新登录。`);
  await openDashboard();
}

async function handlePlatformKeepAliveAlarm(source = 'random-alarm') {
  const store = await getStoredAutoCollectSettings();
  const cfg = primaryKeepAliveSettings(store);
  if (!cfg.keepAlive?.enabled) return;
  if (await isCollectingLocked()) {
    await recordKeepAliveResult(store, '采集中，已跳过本轮平台探活。');
    await rescheduleKeepAlive(await getStoredAutoCollectSettings());
    return;
  }
  try {
    await runPlatformKeepAlive(store, source);
  } catch (error) {
    console.warn('平台探活失败', error);
    await recordKeepAliveResult(store, `平台探活失败：${error.message || error}`);
  } finally {
    await rescheduleKeepAlive(await getStoredAutoCollectSettings());
  }
}

async function recordKeepAliveResult(settings, message) {
  const store = settings?.roles ? normalizeRoleSettingsStore(settings) : await getStoredAutoCollectSettings();
  const now = new Date().toISOString();
  Object.keys(store.roles).forEach(roleId => {
    const cfg = store.roles[roleId] || defaultAutoCollectSettings(roleId);
    store.roles[roleId] = normalizeAutoCollectSettings({
      ...cfg,
      keepAlive: {
        ...(cfg.keepAlive || {}),
        lastRunAt: now,
        lastResult: message || '探活完成'
      }
    }, roleId);
  });
  await setStoredAutoCollectSettings(store);
  return store;
}

function platformHomeUrl(platform) {
  if (platform === 'weixin_shop') return WEIXIN_HOME;
  if (platform === 'doudian') return DOUDIAN_HOME;
  if (platform === 'pdd') return PDD_HOME;
  return '';
}

async function findOrCreatePlatformHomeTab(platform) {
  let tab = null;
  if (platform === 'weixin_shop') tab = await findTab(WEIXIN_ORIGIN, false);
  else if (platform === 'doudian') tab = await findTab(DOUDIAN_ORIGIN, false);
  else if (platform === 'pdd') tab = await findPddTab(false);
  const url = platformHomeUrl(platform);
  if (tab?.id !== undefined) return tab;
  if (!url) throw makeError(`不支持的平台探活：${platform}`, 'UNSUPPORTED_PLATFORM');
  return await chrome.tabs.create({ url, active: false });
}

function shuffleArray(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function looksLoginUrl(url) {
  return /login|passport|sso|扫码|signin/i.test(String(url || ''));
}

async function keepAlivePlatformHome(platform) {
  const tab = await findOrCreatePlatformHomeTab(platform);
  const home = platformHomeUrl(platform);
  addDebugLog('platform.keepalive.start', { platform, tabId: tab.id, home });
  const finalUrl = await navigateTabAndWaitNoRun(tab.id, home, 30000);
  await sleep(3000 + Math.floor(Math.random() * 3000));
  const refreshed = await chrome.tabs.get(tab.id);
  const currentUrl = refreshed.url || finalUrl || '';
  const currentTitle = refreshed.title || '';
  const loginLike = looksLoginUrl(currentUrl) || /登录|扫码|passport|login/i.test(currentTitle);
  addDebugLog('platform.keepalive.done', { platform, tabId: tab.id, url: currentUrl, title: currentTitle, loginLike });
  return { platform, ok: !loginLike, url: currentUrl, title: currentTitle, loginLike };
}

async function runPlatformKeepAlive(settings = null, source = 'manual') {
  const store = settings?.roles ? normalizeRoleSettingsStore(settings) : await getStoredAutoCollectSettings();
  const cfg = primaryKeepAliveSettings(store);
  if (await isCollectingLocked()) {
    const stored = await recordKeepAliveResult(store, '采集中，已跳过本轮平台探活。');
    const next = await rescheduleKeepAlive(stored);
    const primary = primaryKeepAliveSettings(stored);
    return { ok: true, skipped: true, message: '采集中，已跳过本轮平台探活。', lastRunAt: primary.keepAlive.lastRunAt, keepAliveNextRunAt: next.keepAliveNextRunAt };
  }
  const platformSet = new Set();
  Object.values(store.roles || {}).forEach(roleCfg => selectedAutoPlatforms(roleCfg).forEach(platform => platformSet.add(platform)));
  const platforms = shuffleArray(Array.from(platformSet));
  if (!platforms.length) {
    const stored = await recordKeepAliveResult(store, '未选择探活平台。');
    const primary = primaryKeepAliveSettings(stored);
    return { ok: false, message: '未选择探活平台。', lastRunAt: primary.keepAlive.lastRunAt, keepAliveNextRunAt: primary.keepAlive.nextRunAt };
  }
  const results = [];
  for (let i = 0; i < platforms.length; i += 1) {
    const platform = platforms[i];
    try {
      results.push(await keepAlivePlatformHome(platform));
    } catch (error) {
      results.push({ platform, ok: false, error: error.message || String(error) });
    }
    if (i < platforms.length - 1) await sleep(20000 + Math.floor(Math.random() * 40000));
  }
  const failed = results.filter(item => !item.ok);
  const message = failed.length
    ? `平台探活完成，异常：${failed.map(item => platformDisplayName(item.platform)).join('、')}。`
    : `平台探活完成：首页已刷新 ${results.map(item => platformDisplayName(item.platform)).join('、')}。`;
  const stored = await recordKeepAliveResult(store, message);
  if (failed.length) {
    await showAutoCollectNotification('九安智能采集：平台探活异常', `${message} 如跳到登录页，请人工重新登录。`);
  }
  const next = await rescheduleKeepAlive(stored);
  const primary = primaryKeepAliveSettings(stored);
  return { ok: failed.length === 0, message, results, lastRunAt: primary.keepAlive.lastRunAt, keepAliveNextRunAt: next.keepAliveNextRunAt };
}

function platformDisplayName(platform) {
  if (platform === 'weixin_shop') return '微信小店';
  if (platform === 'doudian') return '抖店';
  if (platform === 'pdd') return '拼多多';
  return String(platform || '未知平台');
}

async function showAutoCollectNotification(title, message) {
  if (!chrome.notifications?.create) return;
  await chrome.notifications.create(`jiuan-auto-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: title || '九安智能采集',
    message: message || '',
    priority: 2
  });
}

async function getStoredReminders() {
  try {
    const stored = await chrome.storage.local.get(REMINDER_STORAGE_KEY);
    const list = stored[REMINDER_STORAGE_KEY];
    return Array.isArray(list) ? list.map(normalizeReminder).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function setStoredReminders(reminders) {
  const list = Array.isArray(reminders) ? reminders.map(normalizeReminder).filter(Boolean) : [];
  await chrome.storage.local.set({ [REMINDER_STORAGE_KEY]: list });
  return list;
}

function normalizeReminder(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || crypto.randomUUID?.() || `reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const title = String(raw.title || '').trim();
  if (!title) return null;
  const remindAt = String(raw.remindAt || '').trim();
  const frequency = ['once', 'daily', 'weekly', 'monthly'].includes(raw.frequency) ? raw.frequency : 'once';
  return {
    id,
    title,
    note: String(raw.note || '').trim(),
    remindAt,
    frequency,
    enabled: raw.enabled !== false,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    lastTriggeredAt: raw.lastTriggeredAt || ''
  };
}

async function listReminders() {
  const reminders = await getStoredReminders();
  await scheduleAllReminders(reminders);
  return { reminders };
}

async function saveReminder(raw) {
  const reminders = await getStoredReminders();
  const now = new Date().toISOString();
  const reminder = normalizeReminder({ ...raw, updatedAt: now, createdAt: raw.createdAt || now });
  if (!reminder) throw makeError('提醒事项不能为空。', 'REMINDER_INVALID');
  const index = reminders.findIndex(item => item.id === reminder.id);
  if (index >= 0) reminders[index] = reminder;
  else reminders.push(reminder);
  const saved = await setStoredReminders(reminders);
  await scheduleAllReminders(saved);
  return { reminders: saved };
}

async function deleteReminder(id) {
  const reminders = (await getStoredReminders()).filter(item => item.id !== id);
  try { await chrome.alarms.clear(REMINDER_ALARM_PREFIX + id); } catch {}
  const saved = await setStoredReminders(reminders);
  return { reminders: saved };
}

async function toggleReminder(id) {
  const reminders = await getStoredReminders();
  const item = reminders.find(x => x.id === id);
  if (!item) throw makeError('提醒不存在。', 'REMINDER_NOT_FOUND');
  item.enabled = !item.enabled;
  item.updatedAt = new Date().toISOString();
  const saved = await setStoredReminders(reminders);
  await scheduleAllReminders(saved);
  return { reminders: saved };
}

async function scheduleAllReminders(reminders) {
  const list = Array.isArray(reminders) ? reminders : await getStoredReminders();
  for (const item of list) await scheduleReminder(item);
}

async function restoreReminderAlarms() {
  try {
    const reminders = await getStoredReminders();
    await scheduleAllReminders(reminders);
  } catch (error) {
    console.warn('恢复提醒闹钟失败', error);
  }
}

async function scheduleReminder(reminder) {
  if (!reminder?.id) return;
  const alarmName = REMINDER_ALARM_PREFIX + reminder.id;
  try { await chrome.alarms.clear(alarmName); } catch {}
  if (reminder.enabled === false) return;
  const when = nextReminderTime(reminder, Date.now());
  if (!when) return;
  await chrome.alarms.create(alarmName, { when });
}

function nextReminderTime(reminder, fromTime = Date.now()) {
  const base = new Date(reminder.remindAt || '').getTime();
  if (!Number.isFinite(base)) return null;
  const frequency = reminder.frequency || 'once';
  if (frequency === 'once') return base > fromTime ? base : null;
  const date = new Date(base);
  let guard = 0;
  while (date.getTime() <= fromTime && guard < 500) {
    if (frequency === 'daily') date.setDate(date.getDate() + 1);
    else if (frequency === 'weekly') date.setDate(date.getDate() + 7);
    else if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
    else return null;
    guard += 1;
  }
  return date.getTime();
}

function nextReminderIso(reminder, fromTime = Date.now()) {
  const next = nextReminderTime(reminder, fromTime);
  return next ? new Date(next).toISOString() : reminder.remindAt;
}

async function handleReminderAlarm(id) {
  const reminders = await getStoredReminders();
  const item = reminders.find(x => x.id === id);
  if (!item || item.enabled === false) return;
  await showReminderNotification(item);
  item.lastTriggeredAt = new Date().toISOString();
  if (item.frequency === 'once') {
    item.enabled = false;
  } else {
    item.remindAt = nextReminderIso(item, Date.now() + 1000);
  }
  item.updatedAt = new Date().toISOString();
  const saved = await setStoredReminders(reminders);
  await scheduleAllReminders(saved);
}

async function showReminderNotification(reminder) {
  const title = reminder?.title || '九安智能采集提醒';
  const note = reminder?.note || '提醒时间到了。';
  if (!chrome.notifications?.create) {
    throw makeError('当前浏览器不支持通知能力。', 'NOTIFICATION_UNAVAILABLE');
  }
  await chrome.notifications.create(`jiuan-reminder-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: '九安智能采集提醒',
    message: note ? `${title}\n${note}` : title,
    priority: 2
  });
}

function addDebugLog(event, detail = {}) {
  if (!debugEnabled && event !== 'debug.toggle') return;
  const item = {
    ts: new Date().toISOString(),
    event,
    detail: sanitizeDebugValue(detail)
  };
  debugLogs.push(item);
  if (debugLogs.length > MAX_DEBUG_LOGS) debugLogs = debugLogs.slice(-MAX_DEBUG_LOGS);
  try { chrome.storage.local.set({ [DEBUG_STORAGE_KEY]: debugLogs }); } catch {}
}

function sanitizeDebugValue(value, depth = 0) {
  if (depth > 5) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeDebugString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 60).map(item => sanitizeDebugValue(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      const lower = String(key).toLowerCase();
      if (['cookie', 'authorization'].includes(lower)) {
        out[key] = '[redacted]';
      } else if (/token|csrf|ticket|session|sid|passport|msToken|a_bogus|fp|verifyfp|odin|ttwid|uid/i.test(key)) {
        out[key] = maskValue(raw);
      } else if (key === 'text' && typeof raw === 'string') {
        out[key] = sanitizeDebugString(raw.slice(0, 4000));
      } else {
        out[key] = sanitizeDebugValue(raw, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

function sanitizeDebugString(text) {
  let out = String(text || '');
  out = out.replace(/((?:__token|x-secsdk-csrf-token|x-tt-passport-csrf-token|passport_csrf_token|msToken|a_bogus|verifyFp|fp|ticket|sessionid|sessionid_ss|sid_guard|sid_tt|uid_tt|uid_tt_ss|odin_tt|ttwid|d_ticket|PHPSESSID)=)([^&;\s\"']+)/gi, '$1[redacted]');
  out = out.replace(/([A-Za-z0-9_%-]{12})[A-Za-z0-9_%-]{12,}([A-Za-z0-9_%-]{6})/g, '$1...[redacted]...$2');
  return out;
}

function maskValue(value) {
  if (value === null || value === undefined || value === '') return value;
  const text = String(value);
  if (text.length <= 8) return '[redacted]';
  return `${text.slice(0, 4)}...[redacted]...${text.slice(-4)}`;
}

function summarizeResponseForDebug(response) {
  if (!response) return null;
  const json = response.json;
  let jsonSummary = null;
  if (json && typeof json === 'object') {
    jsonSummary = {
      code: json.code,
      st: json.st,
      errno: json.errno,
      error_code: json.error_code,
      msg: json.msg || json.message || json.description || '',
      dataKeys: json.data && typeof json.data === 'object' ? Object.keys(json.data).slice(0, 30) : [],
      subjects: Array.isArray(json.data?.login_subject_list)
        ? json.data.login_subject_list.slice(0, 10).map(x => ({ account_id: x.account_id, account_name: x.account_name, subject_id: x.subject_id, member_id: x.member_id, can_login: x.can_login }))
        : undefined
    };
  }
  return {
    status: response.status,
    ok: response.ok,
    redirected: response.redirected,
    url: response.url,
    contentType: response.contentType,
    transport: response.transport,
    error: response.error,
    fetchError: response.fetchError,
    jsonSummary,
    textPreview: response.text ? String(response.text).slice(0, 800) : ''
  };
}

function endpointLabel(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.split('/').filter(Boolean).slice(-2).join('/');
    return `${u.hostname}/${path}`;
  } catch {
    return String(url || '').slice(0, 120);
  }
}

function getCapabilities() {
  return {
    installed: true,
    pluginVersion: chrome.runtime.getManifest().version,
    protocolVersion: 1,
    capabilities: [
      { platform: 'weixin_shop', collectTypes: ['shop_score', 'kf_reception', 'kf_sales'], enabled: true },
      { platform: 'doudian', collectTypes: ['experience_overview', 'service_preview', 'comment_statistics', 'customer_service_staff'], enabled: true, switchVerification: true },
      { platform: 'pdd', collectTypes: ['mall_serve_score', 'sale_quality', 'customer_service_performance'], enabled: true }
    ]
  };
}

async function getEnvironment(sender) {
  const [weixinTab, doudianTab, pddTab] = await Promise.all([
    findTab(WEIXIN_ORIGIN, false),
    findTab(DOUDIAN_ORIGIN, false),
    findPddTab(false)
  ]);

  const [bizMagic, doudianSession] = await Promise.all([
    getCookieValue(WEIXIN_ORIGIN, 'biz_magic'),
    getCookieValue(DOUDIAN_ORIGIN, 'sessionid')
  ]);

  const doudianProbe = await probeDoudianLoginForEnvironment(doudianTab, doudianSession, sender)
    .catch(error => ({
      loggedIn: false,
      reason: error?.message || String(error),
      code: error?.code || 'DETECT_FAILED',
      subjectCount: 0
    }));

  const pddProbe = await probePddLoginForEnvironment(pddTab)
    .catch(error => ({
      loggedIn: false,
      reason: error?.message || String(error),
      code: error?.code || 'DETECT_FAILED'
    }));

  return {
    plugin: getCapabilities(),
    weixin_shop: {
      tabFound: Boolean(weixinTab),
      loggedIn: Boolean(bizMagic),
      tabTitle: weixinTab?.title || '',
      tabUrl: weixinTab?.url || ''
    },
    doudian: {
      tabFound: Boolean(doudianTab),
      loggedIn: Boolean(doudianProbe.loggedIn),
      reason: doudianProbe.reason || '',
      code: doudianProbe.code || '',
      subjectCount: doudianProbe.subjectCount || 0,
      tabTitle: doudianTab?.title || '',
      tabUrl: doudianTab?.url || ''
    },
    pdd: {
      tabFound: Boolean(pddTab),
      loggedIn: Boolean(pddProbe.loggedIn),
      enabled: true,
      reason: pddProbe.reason || '',
      code: pddProbe.code || '',
      mallId: pddProbe.mallId || '',
      username: pddProbe.username || '',
      nickname: pddProbe.nickname || '',
      tabTitle: pddTab?.title || '',
      tabUrl: pddTab?.url || ''
    }
  };
}

async function probeDoudianLoginForEnvironment(doudianTab, sessionId, sender) {
  if (!doudianTab) return { loggedIn: false, reason: '未打开抖店后台标签页', code: 'TAB_NOT_FOUND' };

  // V0.9.2：抖店登录检测沿用“先刷新首页恢复 SSO/上下文，再导航主体接口校验”。
  // 这样避免只看 Cookie 的误判，也避免在页面冷态时直接裸调 get_login_subject 导致误判失效。
  const tabUrl = String(doudianTab.url || '');
  const beforeUrl = tabUrl && tabUrl.startsWith(DOUDIAN_ORIGIN) ? tabUrl : DOUDIAN_HOME;
  const selected = { tabId: doudianTab.id, beforeUrl, hasSessionidCookie: Boolean(sessionId), title: doudianTab.title || '', mode: 'home-refresh-then-subject' };
  addDebugLog('doudian.login-probe.home-refresh.selected', selected);

  const subjectUrl = `${DOUDIAN_ORIGIN}/ecomauth/loginv1/get_login_subject?bus_type=1&login_source=doudian_pc_web&entry_source=0&bus_child_type=0&appid=1`;
  try {
    addDebugLog('doudian.login-probe.home-refresh.start', { tabId: doudianTab.id, home: DOUDIAN_HOME });
    await navigateTabAndWaitNoRun(doudianTab.id, DOUDIAN_HOME, 30000);
    await sleep(3000);
    const homeTab = await chrome.tabs.get(doudianTab.id);
    const homeUrl = String(homeTab.url || '');
    const homeTitle = String(homeTab.title || '');
    const homeLooksLogin = looksLoginUrl(homeUrl) || /登录|扫码|passport|login/i.test(homeTitle);
    addDebugLog('doudian.login-probe.home-refresh.done', { tabId: doudianTab.id, url: homeUrl, title: homeTitle, homeLooksLogin });
    if (homeLooksLogin) {
      return { loggedIn: false, reason: '抖店首页刷新后进入登录页，请重新登录。', code: 'LOGIN_PAGE', subjectCount: 0 };
    }

    addDebugLog('doudian.login-probe.subject.navigation.start', { tabId: doudianTab.id, url: subjectUrl, beforeUrl });
    await navigateTabAndWaitNoRun(doudianTab.id, subjectUrl, 25000);
    await sleep(500);
    const payload = await readJsonDocumentFromTabNoRun(doudianTab.id);
    const text = String(payload.text || '').trim();
    addDebugLog('doudian.login-probe.subject.navigation.response', {
      tabId: doudianTab.id,
      href: payload.href || '',
      title: payload.title || '',
      contentType: payload.contentType || '',
      via: payload.via || '',
      textPreview: text.slice(0, 240)
    });

    let json;
    try { json = JSON.parse(text); }
    catch {
      addDebugLog('doudian.login-probe.invalid-response', { tabId: doudianTab.id, href: payload.href || '', title: payload.title || '', contentType: payload.contentType || '', textPreview: text.slice(0, 500) });
      const looksLogin = /登录|扫码|passport|login/i.test(`${payload.title || ''}\n${text.slice(0, 800)}`);
      return {
        loggedIn: false,
        reason: looksLogin ? '主体接口返回登录页，请重新登录抖店。' : `主体列表接口未返回 JSON：${String(payload.title || payload.href || '').slice(0, 80)}`,
        code: looksLogin ? 'LOGIN_PAGE' : 'INVALID_RESPONSE',
        subjectCount: 0
      };
    }

    const ok = Number(json?.code ?? json?.st ?? 0) === 0;
    const list = Array.isArray(json?.data?.login_subject_list) ? json.data.login_subject_list : [];
    if (ok && list.length) return { loggedIn: true, reason: '首页刷新后主体列表接口读取成功', code: 'OK', subjectCount: list.length };
    return { loggedIn: false, reason: String(json?.msg || json?.message || '主体列表接口未返回可登录店铺'), code: String(json?.code ?? json?.st ?? 'LOGIN_CHECK_FAILED'), subjectCount: list.length };
  } catch (error) {
    addDebugLog('doudian.login-probe.subject.navigation.failed', { tabId: doudianTab.id, code: error?.code || '', message: error?.message || String(error) });
    return { loggedIn: false, reason: error?.message || '抖店首页刷新或主体列表接口读取失败', code: error?.code || 'SUBJECT_NAVIGATION_FAILED', subjectCount: 0 };
  } finally {
    if (beforeUrl && beforeUrl.startsWith(DOUDIAN_ORIGIN) && beforeUrl !== subjectUrl) {
      try { await navigateTabAndWaitNoRun(doudianTab.id, beforeUrl, 12000); } catch {}
    } else {
      try { await navigateTabAndWaitNoRun(doudianTab.id, DOUDIAN_HOME, 12000); } catch {}
    }
  }
}


async function probePddLoginForEnvironment(pddTab) {
  if (!pddTab) return { loggedIn: false, reason: '未打开拼多多商家后台标签页', code: 'TAB_NOT_FOUND' };
  const tabUrl = String(pddTab.url || '');
  const beforeUrl = /^https:\/\/mms\.(pinduoduo|pdd)\.com\//i.test(tabUrl) ? tabUrl : PDD_HOME;
  addDebugLog('pdd.login-probe.current-tab.selected', { tabId: pddTab.id, beforeUrl, title: pddTab.title || '', mode: 'current-tab-navigation-scripting' });
  try {
    const raw = await fetchJsonByCurrentTabNavigationNoRun(pddTab.id, PDD_CHECK_LOGIN_URL, '拼多多登录检测 checkLogin', beforeUrl);
    addDebugLog('pdd.login-probe.check-login.response', {
      tabId: pddTab.id,
      success: raw?.success,
      errorCode: raw?.errorCode,
      login: raw?.result?.login,
      errorMsg: raw?.errorMsg || ''
    });
    if (!(raw?.success === true && Number(raw?.errorCode) === 1000000 && raw?.result?.login === true)) {
      return { loggedIn: false, reason: raw?.errorMsg || '拼多多登录状态无效', code: 'NOT_LOGGED_IN' };
    }

    // new/userinfo 需要 POST/特殊页面请求，当前标签页 GET 会返回 METHOD_NOT_ALLOWED。
    // 环境检测只使用 checkLogin，避免无意义跳转到 userinfo JSON 地址。
    return { loggedIn: true, reason: '拼多多商家后台已登录', code: 'OK' };
  } catch (error) {
    addDebugLog('pdd.login-probe.failed', { tabId: pddTab.id, code: error?.code || '', message: error?.message || String(error) });
    return { loggedIn: false, reason: error?.message || String(error), code: error?.code || 'CHECK_FAILED' };
  }
}

async function readDoudianPageStateNoRun(tabId) {
  // V0.9.6：登录检测/探活不再优先使用 chrome.debugger，避免浏览器顶部出现“已开始调试此浏览器”横条和窗口晃动。
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: () => {
        const href = location.href || '';
        const title = document.title || '';
        const bodyText = String((document.body && (document.body.innerText || document.body.textContent)) || '');
        const text = `${title}\n${bodyText}`;
        const loginLike = /(扫码登录|手机登录|账号登录|密码登录|请登录|登录抖店|抖店登录|login|passport)/i.test(text) || /\/index\/login|passport.*login/i.test(href);
        const backendLike = /\/ffa\//i.test(href) || /(首页|工作台|店铺|订单|商品|经营|数据|体验分|评价|客服|售后|抖店后台)/.test(text);
        const selectorLike = /\/login\/common/i.test(href) && /(请选择|选择店铺|切换店铺|当前登录|主体|店铺)/.test(text);
        return {
          href,
          title,
          loginLike,
          backendLike,
          selectorLike,
          textPreview: bodyText.replace(/\s+/g, ' ').slice(0, 240),
          via: 'scripting-isolated'
        };
      }
    });
    return results?.[0]?.result || {};
  } catch (scriptError) {
    addDebugLog('doudian.login-probe.page-state.scripting.failed', { tabId, message: scriptError?.message || String(scriptError) });
    return { href: '', title: '', loginLike: false, backendLike: false, selectorLike: false, textPreview: '', via: 'scripting-failed' };
  }
}

async function ensureTabReadyNoRun(tabId, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete' && tab.url && !/^chrome-error:/i.test(tab.url)) return tab;
    await sleep(250);
  }
  throw makeError('临时标签页加载超时。', 'REQUEST_TIMEOUT');
}

async function navigateTabAndWaitNoRun(tabId, url, timeoutMs = 20000) {
  await chrome.tabs.update(tabId, { url });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete' && tab.url && !/^chrome-error:/i.test(tab.url)) return tab.url;
    await sleep(250);
  }
  throw makeError('临时标签页接口加载超时。', 'REQUEST_TIMEOUT');
}

async function readJsonDocumentFromTabNoRun(tabId) {
  // V0.9.6：检测/探活读取 JSON 文档改用 scripting，不再 attach debugger。
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: () => ({
        href: location.href,
        title: document.title || '',
        contentType: document.contentType || '',
        text: String((document.body && (document.body.innerText || document.body.textContent)) || '').slice(0, 2000000),
        via: 'scripting-isolated'
      })
    });
    return results?.[0]?.result || {};
  } catch (scriptError) {
    addDebugLog('current-tab-json.no-run.scripting.failed', { tabId, message: scriptError?.message || String(scriptError) });
    throw makeError(`登录检测读取页面失败：${scriptError?.message || String(scriptError)}`, 'SCRIPTING_READ_FAILED');
  }
}

async function fetchJsonByCurrentTabNavigationNoRun(tabId, url, label, restoreUrl) {
  const debugLabel = label || endpointLabel(url);
  addDebugLog('current-tab-json.no-run.start', { label: debugLabel, tabId, url, restoreUrl: restoreUrl || false });
  try {
    await navigateTabAndWaitNoRun(tabId, url, 25000);
    await sleep(300);
    const payload = await readJsonDocumentFromTabNoRun(tabId);
    const rawText = String(payload.text || '').trim();
    let json = null;
    try { json = JSON.parse(rawText); }
    catch {
      addDebugLog('current-tab-json.no-run.parse.failed', { label: debugLabel, href: payload.href || '', contentType: payload.contentType || '', title: payload.title || '', textHead: rawText.slice(0, 500) });
      throw makeError(`${debugLabel}失败：当前标签页没有返回 JSON。`, 'INVALID_RESPONSE');
    }
    addDebugLog('current-tab-json.no-run.success', { label: debugLabel, href: payload.href || '', success: json?.success, errorCode: json?.errorCode, code: json?.code, st: json?.st, msg: json?.msg || json?.message || json?.errorMsg || '' });
    return json;
  } finally {
    if (restoreUrl) {
      try {
        addDebugLog('current-tab-json.no-run.restore.start', { label: debugLabel, tabId, restoreUrl });
        await navigateTabAndWaitNoRun(tabId, restoreUrl, 12000);
        addDebugLog('current-tab-json.no-run.restore.ok', { label: debugLabel, tabId });
      } catch (restoreError) {
        addDebugLog('current-tab-json.no-run.restore.failed', { label: debugLabel, tabId, message: restoreError?.message || String(restoreError) });
      }
    }
  }
}



async function openPlatform(platform) {
  const config = {
    weixin_shop: { origin: WEIXIN_ORIGIN, url: WEIXIN_HOME },
    doudian: { origin: DOUDIAN_ORIGIN, url: DOUDIAN_HOME },
    pdd: { origin: PDD_ORIGIN, url: PDD_HOME }
  }[platform];
  if (!config) throw makeError('未知平台', 'INVALID_PLATFORM');
  const tab = await findTab(config.origin, false);
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
    return { tabId: tab.id, reused: true };
  }
  const created = await chrome.tabs.create({ url: config.url, active: true });
  return { tabId: created.id, reused: false };
}

function requireDashboardTabId(sender) {
  const tabId = sender?.tab?.id;
  if (tabId === undefined) throw makeError('无法识别数据看板标签页。', 'DASHBOARD_NOT_FOUND');
  return tabId;
}

async function startRun(runId, sender, platform = '') {
  if (!runId) throw makeError('缺少采集任务标识。', 'INVALID_RUN_ID');
  const dashboardTabId = requireDashboardTabId(sender);
  const platformKey = String(platform || '').trim();
  if (platformKey) {
    const samePlatformRuns = [];
    for (const [existingRunId, run] of activeRuns.entries()) {
      if (run.dashboardTabId === dashboardTabId && run.platform === platformKey) samePlatformRuns.push(existingRunId);
    }
    await Promise.all(samePlatformRuns.map(existingRunId => cancelRun(existingRunId, '同一平台新的采集任务已启动')));
  }
  activeRuns.set(runId, { dashboardTabId, platform: platformKey, cancelled: false, cancelReason: '', activeRequests: new Map(), startedAt: Date.now() });
  addDebugLog('run.start', { runId, dashboardTabId, platform: platformKey });
  return { runId };
}

async function stopRun(runId, reason) {
  if (!runId) return { stopped: true };
  await cancelRun(runId, reason || '用户手动停止');
  return { stopped: true };
}

async function cancelRunsByDashboardTab(dashboardTabId, reason) {
  const runIds = [];
  for (const [runId, run] of activeRuns.entries()) {
    if (run.dashboardTabId === dashboardTabId) runIds.push(runId);
  }
  await Promise.all(runIds.map(runId => cancelRun(runId, reason)));
}

async function cancelRun(runId, reason) {
  const run = activeRuns.get(runId);
  if (!run) return;
  run.cancelled = true;
  run.cancelReason = reason || '采集已停止';
  addDebugLog('run.cancel', { runId, reason: run.cancelReason });

  const requestsByTab = new Map();
  for (const [requestId, tabId] of run.activeRequests.entries()) {
    if (!requestsByTab.has(tabId)) requestsByTab.set(tabId, []);
    requestsByTab.get(tabId).push(requestId);
  }
  await Promise.all(Array.from(requestsByTab.entries()).map(async ([tabId, requestIds]) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [ABORT_REGISTRY_KEY, requestIds],
        func: (registryKey, ids) => {
          const registry = window[registryKey];
          if (!(registry instanceof Map)) return;
          for (const id of ids) {
            try { registry.get(id)?.abort(); } catch {}
          }
        }
      });
    } catch {}
  }));
  if (run.activeRequests.size === 0) {
    await cleanupRunResources(runId);
    activeRuns.delete(runId);
  }
}

async function cleanupRunResources(runId) {
  const run = activeRuns.get(runId);
  if (!run) return;
  const tabId = run.doudianWorkTabId;
  if (run.doudianCollectorTabCreated && tabId !== undefined) {
    try {
      addDebugLog('doudian.work-tab.cleanup.start', { runId, tabId });
      await chrome.tabs.remove(tabId);
      addDebugLog('doudian.work-tab.cleanup.ok', { runId, tabId });
    } catch (error) {
      addDebugLog('doudian.work-tab.cleanup.failed', { runId, tabId, message: error?.message || String(error) });
    }
  } else if (tabId !== undefined) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = String(tab?.url || '');
      if (/^https:\/\/(pigeon|im)\.jinritemai\.com\//i.test(url) || /\/backstage\/queryStaffData|\/product\/tcomment\/statistics|\/governance\/shop\/experiencescore\//i.test(url)) {
        addDebugLog('doudian.current-tab.restore-home.start', { runId, tabId, url });
        await navigateTabAndWaitNoRun(tabId, DOUDIAN_HOME, 12000);
        addDebugLog('doudian.current-tab.restore-home.ok', { runId, tabId });
      }
    } catch (error) {
      addDebugLog('doudian.current-tab.restore-home.failed', { runId, tabId, message: error?.message || String(error) });
    }
  }
}

function getRun(runId, sender) {
  const run = activeRuns.get(runId);
  if (!run) throw makeError('采集任务已不存在或已经停止。', 'COLLECTION_CANCELLED');
  const dashboardTabId = requireDashboardTabId(sender);
  if (run.dashboardTabId !== dashboardTabId) throw makeError('采集任务与当前数据看板不匹配。', 'COLLECTION_CANCELLED');
  assertRunActive(runId);
  return run;
}

function assertRunActive(runId) {
  const run = activeRuns.get(runId);
  if (!run || run.cancelled) throw makeError(run?.cancelReason || '采集任务已停止。', 'COLLECTION_CANCELLED');
}

function finishRunIfIdle(runId) {
  const run = activeRuns.get(runId);
  if (!run) return;
  if (run.cancelled && run.activeRequests.size === 0) {
    cleanupRunResources(runId).finally(() => activeRuns.delete(runId));
  }
}

async function getWeixinShops(runId, sender) {
  getRun(runId, sender);
  const response = await backgroundWeixinRequest({
    debugLabel: '微信小店获取店铺列表 getShopSwitchList',
    url: `${WEIXIN_ORIGIN}/shop-faas/mmecnodelogin/session/getShopSwitchList?token=&lang=zh_CN`,
    method: 'GET',
    referrer: WEIXIN_HOME,
    headers: { Accept: 'application/json, text/plain, */*' }
  }, runId);
  const raw = requireSuccessfulApi(response, '微信小店获取店铺列表');
  const shops = Shared.extractWeixinShops(raw);
  if (!shops.length) throw makeError('微信小店接口已返回，但没有解析到店铺。', 'NO_SHOPS');
  return { shops };
}

async function collectWeixinStore(appid, runId, sender) {
  return enqueueWeixinStoreOperation(async () => {
    getRun(runId, sender);
    if (!appid || !appid.startsWith('wx')) throw makeError('微信小店 appid 无效。', 'INVALID_APPID');
    await sleepWithCancellation(SWITCH_DELAY_MS, runId);

    const switchResponse = await backgroundWeixinRequest({
      debugLabel: '微信小店切换店铺 switchShop',
      url: `${WEIXIN_ORIGIN}/shop-faas/mmecnodelogin/session/switchShop?token=&lang=zh_CN`,
      method: 'POST',
      referrer: `${WEIXIN_ORIGIN}/shop/setting/rate2`,
      headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ appid })
    }, runId);
    const switchRaw = requireSuccessfulApi(switchResponse, `微信小店切换店铺 ${appid}`);
    await sleepWithCancellation(AFTER_SWITCH_DELAY_MS, runId);

    const noInputDateMeta = requestDateNoInputMeta();
    const kfRange = Shared.yesterdayRangeSeconds();
    const kfDateMeta = requestDateRangeMeta(unixSecondToLocalYmd(kfRange.beginDate), unixSecondToLocalYmd(kfRange.endDate));

    const [diagnosis, shopScore, kfReception, kfSales] = await Promise.all([
      optionalBackgroundWeixinRequest(runId, '诊断中心', {
        url: `${WEIXIN_ORIGIN}/shop-faas/mmecnodeviolationsec/prewarn/cgi/getChartData?lang=zh_CN`,
        method: 'POST',
        referrer: `${WEIXIN_ORIGIN}/shop/shopdiagnosis/home`,
        headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json' },
        body: '{}'
      }),
      optionalBackgroundWeixinRequest(runId, '店铺体验分', {
        url: `${WEIXIN_ORIGIN}/shop-faas/statistic/cgi/search?lang=zh_CN`,
        method: 'POST',
        referrer: `${WEIXIN_ORIGIN}/shop/setting/rate2`,
        headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'potter-scene': 'weixinShop' },
        body: JSON.stringify({ days: 14, scoreTypeList: [11, 12, 13, 14, 1000] })
      }),
      optionalBackgroundWeixinRequest(runId, '客服考核-接待数据表', {
        url: `${WEIXIN_ORIGIN}/shop/kf/cgi/data/getOfflineTableV2?beginDate=${kfRange.beginDate}&endDate=${kfRange.endDate}&offset=0&limit=100`,
        method: 'GET',
        referrer: `${WEIXIN_ORIGIN}/shop/kf/data`,
        headers: { Accept: 'application/json, text/plain, */*' },
        query: kfRange
      }),
      optionalBackgroundWeixinRequest(runId, '客服考核-销售数据', {
        url: `${WEIXIN_ORIGIN}/shop/kf/cgi/data/getSalesDetail?beginDate=${kfRange.beginDate}&endDate=${kfRange.endDate}&offset=0&limit=20`,
        method: 'GET',
        referrer: `${WEIXIN_ORIGIN}/shop/kf/data`,
        headers: { Accept: 'application/json, text/plain, */*' },
        query: kfRange
      })
    ]);

    const switchStore = {
      name: Shared.firstNonEmpty(switchRaw?.shopName, switchRaw?.shop_name, switchRaw?.storeName, switchRaw?.store_name, switchRaw?.name, switchRaw?.nickname, switchRaw?.nickName, ''),
      logo: Shared.normalizeLogo(Shared.pickLogo(switchRaw))
    };

    return {
      platform: 'weixin_shop',
      shop: { appid, shopId: appid, name: switchStore.name || '', logo: switchStore.logo },
      diagnosis: {
        ok: !diagnosis.error,
        error: diagnosis.error || '',
        dateMeta: noInputDateMeta,
        summary: diagnosis.error ? {} : Shared.extractWeixinDiagnosisSummary(diagnosis.raw),
        raw: diagnosis.raw || null
      },
      shopScore: {
        ok: !shopScore.error,
        error: shopScore.error || '',
        dateMeta: noInputDateMeta,
        summary: shopScore.error ? {} : Shared.extractWeixinShopScoreSummary(shopScore.raw),
        raw: shopScore.raw || null
      },
      kfReception: {
        ok: !kfReception.error,
        error: kfReception.error || '',
        dateMeta: kfDateMeta,
        list: kfReception.error ? [] : Shared.normalizeKfReceptionList(kfReception.raw),
        raw: kfReception.raw || null
      },
      kfSales: {
        ok: !kfSales.error,
        error: kfSales.error || '',
        dateMeta: kfDateMeta,
        list: kfSales.error ? [] : Shared.normalizeKfSalesList(kfSales.raw),
        raw: kfSales.raw || null
      },
      collectedAt: new Date().toISOString()
    };
  });
}


async function collectDoudianDynamicInfo(tabId) {
  const captured = (doudianCapturedUrlsByTab.get(tabId) || []).map(item => item.url).filter(Boolean);
  let pageInfo = {};
  try {
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const candidates = [];
        try { candidates.push(location.href); } catch {}
        try {
          for (const entry of performance.getEntriesByType('resource') || []) {
            const name = String(entry.name || '');
            if (/fxg\.jinritemai\.com|doudian-sso\.jinritemai\.com/i.test(name)) candidates.push(name);
          }
        } catch {}
        try {
          for (const entry of performance.getEntriesByType('navigation') || []) {
            const name = String(entry.name || '');
            if (name) candidates.push(name);
          }
        } catch {}
        try {
          for (const element of Array.from(document.querySelectorAll('script[src],link[href],a[href],img[src]'))) {
            const raw = element.src || element.href || '';
            if (/fxg\.jinritemai\.com|doudian-sso\.jinritemai\.com|__token|_lid|msToken|a_bogus/i.test(raw)) candidates.push(raw);
          }
        } catch {}
        try {
          const bodyText = String(document.documentElement?.innerHTML || '').slice(0, 800000);
          for (const re of [
            /https:\/\/fxg\.jinritemai\.com\/[^"'<>\\\s]+/ig,
            /https:\/\/doudian-sso\.jinritemai\.com\/[^"'<>\\\s]+/ig
          ]) {
            let m;
            while ((m = re.exec(bodyText)) && candidates.length < 400) candidates.push(m[0].replace(/&amp;/g, '&'));
          }
        } catch {}
        const storageTexts = [];
        const scanStorage = storage => {
          try {
            for (let i = 0; i < storage.length; i += 1) {
              const k = storage.key(i);
              const v = String(storage.getItem(k) || '');
              const text = `${k}=${v}`;
              storageTexts.push(text.slice(0, 200000));
              const urlMatches = text.match(/https:\/\/fxg\.jinritemai\.com\/[^"'<>\\\s]+/ig) || [];
              for (const u of urlMatches.slice(0, 30)) candidates.push(u.replace(/&amp;/g, '&'));
            }
          } catch {}
        };
        scanStorage(localStorage);
        scanStorage(sessionStorage);
        return { candidates: candidates.slice(-400), storageTexts: storageTexts.slice(-80), href: location.href, title: document.title || '' };
      }
    });
    pageInfo = injectionResults?.[0]?.result || {};
  } catch (error) {
    pageInfo = { candidates: [], storageTexts: [], error: error?.message || String(error) };
  }

  const urls = [...captured, ...((pageInfo.candidates || []).filter(Boolean))];
  const textBlocks = (pageInfo.storageTexts || []).filter(Boolean);
  const out = extractDoudianDynamicInfoFromUrls(urls, textBlocks);
  out.capturedCount = captured.length;
  out.pageCandidateCount = Array.isArray(pageInfo.candidates) ? pageInfo.candidates.length : 0;
  out.pageHref = pageInfo.href || '';
  out.pageTitle = pageInfo.title || '';
  out.pageError = pageInfo.error || '';
  addDebugLog('doudian.dynamic.params', {
    tabId,
    tokenPresent: Boolean(out.token),
    lidPresent: Boolean(out.lid),
    bidPresent: Boolean(out.bid),
    msTokenPresent: Boolean(out.msToken),
    fpPresent: Boolean(out.fp),
    verifyFpPresent: Boolean(out.verifyFp),
    subjectUrlSeen: Boolean(out.subjectSourceUrl),
    userDetailUrlSeen: Boolean(out.userDetailSourceUrl),
    shopInfoUrlSeen: Boolean(out.shopInfoSourceUrl),
    capturedCount: out.capturedCount,
    pageCandidateCount: out.pageCandidateCount,
    sourceUrl: out.sourceUrl || ''
  });
  return out;
}

function extractDoudianDynamicInfoFromUrls(urls, textBlocks = []) {
  const out = {
    token: '', lid: '', bid: '', msToken: '', aBogus: '', fp: '', verifyFp: '',
    sourceUrl: '', subjectSourceUrl: '', userDetailSourceUrl: '', shopInfoSourceUrl: ''
  };
  const setFromUrl = raw => {
    if (!raw) return;
    const decoded = String(raw).replace(/&amp;/g, '&');
    let u;
    try { u = new URL(decoded, DOUDIAN_ORIGIN); } catch { return; }
    if (!/fxg\.jinritemai\.com|doudian-sso\.jinritemai\.com/i.test(u.hostname)) return;
    const p = u.searchParams;
    if (!out.token && p.get('__token')) out.token = p.get('__token') || '';
    if (!out.lid && p.get('_lid')) out.lid = p.get('_lid') || '';
    if (!out.bid && p.get('_bid')) out.bid = p.get('_bid') || '';
    if (!out.msToken && p.get('msToken')) out.msToken = p.get('msToken') || '';
    if (!out.aBogus && p.get('a_bogus')) out.aBogus = p.get('a_bogus') || '';
    if (!out.fp && p.get('fp')) out.fp = p.get('fp') || '';
    if (!out.verifyFp && p.get('verifyFp')) out.verifyFp = p.get('verifyFp') || '';
    if (!out.sourceUrl && (out.token || out.lid)) out.sourceUrl = u.href;
    if (/\/ecomauth\/loginv1\/get_login_subject/i.test(u.pathname)) out.subjectSourceUrl = u.href;
    if (/\/ecomauth\/loginv1\/get_login_user_detail_info/i.test(u.pathname)) out.userDetailSourceUrl = u.href;
    if (/\/center\/qualification\/shop\/info/i.test(u.pathname)) out.shopInfoSourceUrl = u.href;
  };
  for (const raw of urls.slice().reverse()) setFromUrl(raw);
  for (const text of textBlocks.slice().reverse()) {
    if (!out.token) {
      const m = String(text).match(/__token["'\s:=]+([a-f0-9]{16,64})/i);
      if (m) out.token = m[1];
    }
    if (!out.lid) {
      const m = String(text).match(/_lid["'\s:=]+([0-9]{6,32})/i);
      if (m) out.lid = m[1];
    }
    if (!out.bid) {
      const m = String(text).match(/_bid["'\s:=]+([a-z0-9_\-]{2,64})/i);
      if (m) out.bid = m[1];
    }
  }
  return out;
}

async function buildDoudianLoginSubjectUrl(tabId) {
  const base = `${DOUDIAN_ORIGIN}/ecomauth/loginv1/get_login_subject`;
  const params = new URLSearchParams({
    bus_type: '1',
    login_source: 'doudian_pc_web',
    entry_source: '0',
    bus_child_type: '0',
    appid: '1'
  });
  const info = await collectDoudianDynamicInfo(tabId);
  if (info.token) params.set('__token', info.token);
  if (info.lid) params.set('_lid', info.lid);
  return `${base}?${params.toString()}`;
}

async function buildDoudianUserDetailUrl(tabId) {
  const info = await collectDoudianDynamicInfo(tabId);
  if (info.userDetailSourceUrl) return info.userDetailSourceUrl;
  const params = new URLSearchParams({ aid: '4272', login_source: 'doudian_pc_web', appid: '1' });
  if (info.token) params.set('__token', info.token);
  if (info.bid) params.set('_bid', info.bid); else params.set('_bid', 'fxg_admin');
  if (info.lid) params.set('_lid', info.lid);
  return `${DOUDIAN_ORIGIN}/ecomauth/loginv1/get_login_user_detail_info?${params.toString()}`;
}

async function buildDoudianShopInfoUrl(tabId) {
  const info = await collectDoudianDynamicInfo(tabId);
  if (info.shopInfoSourceUrl) return info.shopInfoSourceUrl;
  const params = new URLSearchParams({ version: '0', appid: '1' });
  if (info.token) params.set('__token', info.token);
  if (info.bid) params.set('_bid', info.bid); else params.set('_bid', 'fxg_admin');
  if (info.lid) params.set('_lid', info.lid);
  if (info.msToken) params.set('msToken', info.msToken);
  if (info.aBogus) params.set('a_bogus', info.aBogus);
  if (info.verifyFp) params.set('verifyFp', info.verifyFp);
  if (info.fp) params.set('fp', info.fp);
  return `${DOUDIAN_ORIGIN}/center/qualification/shop/info?${params.toString()}`;
}


async function getDoudianDynamicParams(tabId) {
  const subjectUrl = await buildDoudianLoginSubjectUrl(tabId);
  const url = new URL(subjectUrl, DOUDIAN_ORIGIN);
  return {
    token: url.searchParams.get('__token') || '',
    lid: url.searchParams.get('_lid') || '',
    fp: await getCookieValue(DOUDIAN_ORIGIN, 's_v_web_id') || '',
    csrf: await getCookieValue(DOUDIAN_ORIGIN, 'passport_csrf_token') || ''
  };
}

async function prepareDoudianSsoPreflight(tabId, runId) {
  // 抖店真实切店链路通常会先走 doudian-sso check_login，再调用 fxg select_sso，最后页面自己触发 common_login_check。
  // 这里不手动构造 common_login_check，因为它包含 msToken / a_bogus 等页面安全 SDK 动态参数。
  // 只做前两步预热，让页面已有登录态和 SSO host 处于一致状态，再交给原生主体选择页点击流程。
  const params = await getDoudianDynamicParams(tabId);
  addDebugLog('doudian.preflight.params', { tabId, tokenPresent: Boolean(params.token), lidPresent: Boolean(params.lid), fpPresent: Boolean(params.fp), csrfPresent: Boolean(params.csrf) });
  const fp = params.fp || '';
  const checkUrl = new URL('https://doudian-sso.jinritemai.com/aff/check_login/');
  checkUrl.searchParams.set('fp', fp);
  checkUrl.searchParams.set('aid', '4272');
  checkUrl.searchParams.set('language', 'zh');
  checkUrl.searchParams.set('account_sdk_source', 'sso');
  checkUrl.searchParams.set('service', '');
  checkUrl.searchParams.set('subject_aid', '4966');
  checkUrl.searchParams.set('need_ticket', 'false');

  const checkResponse = await pageRequest(tabId, {
    debugLabel: '抖店 SSO 登录检查 check_login',
    url: checkUrl.href,
    method: 'GET',
    referrer: `${DOUDIAN_ORIGIN}/`,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'x-requested-with': 'XMLHttpRequest',
      ...(params.csrf ? { 'x-tt-passport-csrf-token': params.csrf } : {})
    }
  }, runId);
  const checkRaw = requireSuccessfulApi(checkResponse, '抖店 SSO 登录检查');
  if (checkRaw.error_code !== undefined && Number(checkRaw.error_code) !== 0) {
    throw classifyApiError(`抖店 SSO 登录检查失败：error_code=${checkRaw.error_code}，${checkRaw.description || checkRaw.msg || ''}`, checkRaw.description || checkRaw.msg || '登录检查失败');
  }

  const secUserId = String(checkRaw.sec_user_id || '');
  const secSubjectUid = String(checkRaw.sec_subject_uid || '');
  if (!secUserId || !secSubjectUid) {
    throw makeError('抖店 SSO 登录检查未返回 sec_user_id / sec_subject_uid，请刷新抖店后台后重试。', 'NOT_LOGGED_IN');
  }

  const selectParams = new URLSearchParams({ appid: '1' });
  if (params.token) selectParams.set('__token', params.token);
  if (params.lid) selectParams.set('_lid', params.lid);
  const selectResponse = await pageRequest(tabId, {
    debugLabel: '抖店 SSO 主机选择 select_sso',
    url: `${DOUDIAN_ORIGIN}/ecomauth/loginv1/select_sso?${selectParams.toString()}`,
    method: 'POST',
    referrer: DOUDIAN_HOME,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8',
      ...(params.csrf ? { 'x-secsdk-csrf-token': params.csrf } : {})
    },
    body: JSON.stringify({
      login_source: 'doudian_pc_web',
      bus_type: 1,
      sso_login_info: [
        { sso_host: 'fxg-sso.jinritemai.com' },
        { sso_host: 'doudian-sso.jinritemai.com', sec_user_id: secUserId, sec_subject_uid: secSubjectUid }
      ],
      appid: 1,
      ...(params.token ? { __token: params.token } : {}),
      ...(params.lid ? { _lid: params.lid } : {})
    })
  }, runId);
  const selectRaw = requireSuccessfulApi(selectResponse, '抖店 SSO 主机选择');
  return {
    secUserId,
    secSubjectUid,
    ssoHost: selectRaw?.data?.sso_host || '',
    tokenPresent: Boolean(params.token),
    lidPresent: Boolean(params.lid)
  };
}

async function getDoudianSubjects(runId, sender) {
  getRun(runId, sender);

  // V0.5.0：主体列表恢复“浏览器导航到 JSON 接口”的高成功率方式，
  // 但只在当前可见采集当前标签页中执行，会直接使用用户当前抖店标签页跳转。
  const tab = await prepareDoudianWorkTab(runId);
  const run = activeRuns.get(runId);
  if (run) run.doudianWorkTabId = tab.id;

  const subjectUrl = `${DOUDIAN_ORIGIN}/ecomauth/loginv1/get_login_subject?bus_type=1&login_source=doudian_pc_web&entry_source=0&bus_child_type=0&appid=1`;
  addDebugLog('doudian.subject-api.work-tab-navigation.start', { tabId: tab.id, url: subjectUrl });
  const raw = requireSuccessfulRawApi(
    await fetchJsonByCurrentTabNavigation(subjectUrl, runId, tab.id, '抖店获取主体列表当前标签页', false),
    '抖店获取主体列表'
  );
  const source = 'current-visible-tab-navigation';

  const subjects = Shared.normalizeDoudianSubjects(raw);
  addDebugLog('doudian.subject-api.result', { count: subjects.length, names: subjects.slice(0, 10).map(x => x.shopName), source });
  if (!subjects.length) throw makeError('抖店接口已返回，但没有可登录店铺主体。', 'NO_SHOPS');

  const latestRun = activeRuns.get(runId);
  if (latestRun) latestRun.doudianSubjectsCache = subjects;
  return { subjects, workTabId: tab.id, source };
}


function chromeDebuggerAttach(target, requiredVersion) {
  return new Promise((resolve, reject) => {
    try {
      chrome.debugger.attach(target, requiredVersion, () => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message || String(err)));
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function chromeDebuggerDetach(target) {
  return new Promise((resolve) => {
    try {
      chrome.debugger.detach(target, () => resolve());
    } catch {
      resolve();
    }
  });
}

function chromeDebuggerSendCommand(target, method, params) {
  return new Promise((resolve, reject) => {
    try {
      chrome.debugger.sendCommand(target, method, params || {}, result => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message || String(err)));
        else resolve(result || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function withChromeDebugger(tabId, runId, label, callback) {
  assertRunActive(runId);
  const target = { tabId };
  addDebugLog('doudian.cdp.attach.start', { tabId, label });
  let attached = false;
  try {
    await chromeDebuggerAttach(target, '1.3');
    attached = true;
    addDebugLog('doudian.cdp.attach.ok', { tabId, label });
    return await callback(target);
  } catch (error) {
    addDebugLog('doudian.cdp.attach_or_eval.failed', { tabId, label, message: error?.message || String(error) });
    throw error;
  } finally {
    if (attached) {
      await chromeDebuggerDetach(target);
      addDebugLog('doudian.cdp.detach', { tabId, label });
    }
  }
}

async function cdpRuntimeEvaluate(tabId, runId, label, expression) {
  return withChromeDebugger(tabId, runId, label, async target => {
    assertRunActive(runId);
    const response = await chromeDebuggerSendCommand(target, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
      timeout: 10000
    });
    if (response.exceptionDetails) {
      const text = response.exceptionDetails.text || response.exceptionDetails.exception?.description || response.exceptionDetails.exception?.value || '未知异常';
      throw makeError(`CDP 执行异常：${text}`, 'CDP_EVALUATE_FAILED');
    }
    return response.result?.value;
  });
}

async function cdpRuntimeEvaluateNoRun(tabId, label, expression) {
  const target = { tabId };
  addDebugLog('doudian.cdp.attach.start', { tabId, label });
  let attached = false;
  try {
    await chromeDebuggerAttach(target, '1.3');
    attached = true;
    addDebugLog('doudian.cdp.attach.ok', { tabId, label });
    const response = await chromeDebuggerSendCommand(target, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
      timeout: 10000
    });
    if (response.exceptionDetails) {
      const text = response.exceptionDetails.text || response.exceptionDetails.exception?.description || response.exceptionDetails.exception?.value || '未知异常';
      throw makeError(`CDP 执行异常：${text}`, 'CDP_EVALUATE_FAILED');
    }
    return response.result?.value;
  } catch (error) {
    addDebugLog('doudian.cdp.attach_or_eval.failed', { tabId, label, message: error?.message || String(error) });
    throw error;
  } finally {
    if (attached) {
      await chromeDebuggerDetach(target);
      addDebugLog('doudian.cdp.detach', { tabId, label });
    }
  }
}

function buildDoudianSelectorScrapeExpression() {
  return `(() => {
    const normalize = value => String(value || '').replace(/\\s+/g, ' ').trim();
    const visible = element => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 2 && rect.height > 2;
    };
    const labelWords = ['抖店工作台', '子账号', '个体店', '企业店', '旗舰店', '正常营业'];
    const badNames = new Set(['请选择店铺', '抖店工作台', '子账号', '个体店', '企业店', '旗舰店', '正常营业', '进入', '登录', '切换']);
    const subjects = [];
    const seen = new Set();
    const pickNameFromText = text => {
      const lines = String(text || '').split(/\\n+/).map(normalize).filter(Boolean);
      const labelIndex = lines.findIndex(line => labelWords.some(word => line.includes(word)));
      const pool = labelIndex > 0 ? lines.slice(Math.max(0, labelIndex - 3), labelIndex) : lines.slice(0, 5);
      for (let i = pool.length - 1; i >= 0; i -= 1) {
        const line = normalize(pool[i]);
        if (!line || line.length < 2 || line.length > 80) continue;
        if (badNames.has(line)) continue;
        if (/请选择|切换|登录|账号列表|全部|返回|首页/.test(line)) continue;
        return line;
      }
      for (const line of lines) {
        if (line.length >= 2 && line.length <= 80 && !badNames.has(line) && !/请选择|切换|登录|账号列表|全部|返回|首页/.test(line)) return line;
      }
      return '';
    };
    const collectFromElement = element => {
      const text = normalize(element.innerText || element.textContent || '');
      if (!text || text.length > 1200) return;
      if (!labelWords.some(word => text.includes(word))) return;
      const name = pickNameFromText((element.innerText || element.textContent || '').slice(0, 1200));
      if (!name || seen.has(name)) return;
      seen.add(name);
      const img = element.querySelector('img');
      const attrs = {};
      for (const attr of Array.from(element.attributes || [])) {
        if (/id|account|subject|member|shop/i.test(attr.name)) attrs[attr.name] = attr.value;
      }
      subjects.push({
        platform: 'doudian',
        shopId: String(attrs['data-account-id'] || attrs['account-id'] || attrs['data-shop-id'] || ''),
        shopName: name,
        shopLogo: img?.currentSrc || img?.src || '',
        accountId: String(attrs['data-account-id'] || attrs['account-id'] || attrs['data-shop-id'] || ''),
        accountName: name,
        subjectId: String(attrs['data-subject-id'] || attrs['subject-id'] || ''),
        memberId: String(attrs['data-member-id'] || attrs['member-id'] || ''),
        busMemberId: '',
        encodeShopId: '',
        encodeMemberId: '',
        canLogin: true,
        identityTypeDesc: '',
        labels: labelWords.filter(word => text.includes(word)),
        currentScore: 0,
        current: false,
        source: 'selector-dom-cdp',
        raw: { text: text.slice(0, 500), attrs }
      });
    };
    const elements = Array.from(document.querySelectorAll('body *')).filter(visible);
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 30) continue;
      collectFromElement(element);
    }
    if (!subjects.length) {
      const text = document.body?.innerText || '';
      const lines = text.split(/\\n+/).map(normalize).filter(Boolean);
      for (let i = 0; i < lines.length; i += 1) {
        const windowText = lines.slice(i, i + 8).join(' ');
        if (!labelWords.some(word => windowText.includes(word))) continue;
        const name = pickNameFromText(lines.slice(i, i + 8).join('\\n'));
        if (name && !seen.has(name)) {
          seen.add(name);
          subjects.push({ platform: 'doudian', shopId: '', shopName: name, shopLogo: '', accountId: '', accountName: name, subjectId: '', memberId: '', canLogin: true, labels: [], currentScore: 0, current: false, source: 'selector-text-cdp', raw: { text: windowText.slice(0, 500) } });
        }
      }
    }
    return { url: location.href, title: document.title || '', count: subjects.length, subjects: subjects.slice(0, 50), pageSummary: normalize((document.body?.innerText || '').slice(0, 1000)) };
  })()`;
}

async function scrapeDoudianSubjectSelectorByCdp(tabId, runId) {
  addDebugLog('doudian.subject-selector.scrape.cdp.start', { tabId });
  const result = await cdpRuntimeEvaluate(tabId, runId, 'scrape doudian selector', buildDoudianSelectorScrapeExpression());
  addDebugLog('doudian.subject-selector.scrape.cdp.result', { tabId, url: result?.url || '', title: result?.title || '', count: result?.count || 0, subjects: (result?.subjects || []).map(item => ({ shopName: item.shopName, shopId: item.shopId, source: item.source })) });
  return result || {};
}

function buildDoudianSelectorClickExpression(names, ids) {
  return `((names, ids) => {
    const normalize = value => String(value || '').replace(/\\s+/g, ' ').trim();
    const visible = element => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 2 && rect.height > 2;
    };
    const isClickable = element => {
      if (!(element instanceof HTMLElement)) return false;
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role') || '';
      const style = getComputedStyle(element);
      return tag === 'a' || tag === 'button' || role === 'button' || element.hasAttribute('onclick') || element.tabIndex >= 0 || style.cursor === 'pointer';
    };
    const clickableAncestor = element => {
      let current = element;
      for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
        if (visible(current) && isClickable(current)) return current;
      }
      return element;
    };
    const all = Array.from(document.querySelectorAll('body *')).filter(visible);
    const candidates = [];
    for (const element of all) {
      const text = normalize(element.innerText || element.textContent || '');
      if (!text || text.length > 500) continue;
      let score = 0;
      for (const name of names) {
        const target = normalize(name);
        if (!target) continue;
        if (text === target) score = Math.max(score, 1000);
        else if (text.includes(target)) score = Math.max(score, 800 - Math.min(300, text.length - target.length));
      }
      for (const id of ids) {
        const target = normalize(id);
        if (target && text.includes(target)) score = Math.max(score, 650);
      }
      if (score > 0) {
        const clickable = clickableAncestor(element);
        const clickableText = normalize(clickable.innerText || clickable.textContent || text);
        candidates.push({ element, clickable, text, clickableText, score, area: clickable.getBoundingClientRect().width * clickable.getBoundingClientRect().height });
      }
    }
    candidates.sort((left, right) => right.score - left.score || left.area - right.area || left.clickableText.length - right.clickableText.length);
    const selected = candidates[0];
    if (!selected) return { clicked: false, url: location.href, title: document.title || '', pageSummary: normalize((document.body?.innerText || '').slice(0, 800)) };
    const target = selected.clickable;
    try { target.scrollIntoView({ block: 'center', inline: 'center' }); } catch {}
    const init = { bubbles: true, cancelable: true, composed: true, view: window };
    try {
      target.dispatchEvent(new MouseEvent('mouseover', init));
      target.dispatchEvent(new MouseEvent('mousedown', init));
      target.dispatchEvent(new MouseEvent('mouseup', init));
      target.dispatchEvent(new MouseEvent('click', init));
      if (typeof target.click === 'function') target.click();
    } catch (error) {
      return { clicked: false, url: location.href, title: document.title || '', pageSummary: '点击目标店铺失败：' + (error?.message || error) };
    }
    return { clicked: true, url: location.href, title: document.title || '', matchedText: selected.text.slice(0, 200), clickedText: selected.clickableText.slice(0, 300), tagName: target.tagName, className: String(target.className || '').slice(0, 300), via: 'cdp' };
  })(${JSON.stringify(names || [])}, ${JSON.stringify(ids || [])})`;
}

async function clickDoudianSubjectInSelectorByCdp(tabId, subject, runId) {
  const names = [subject.shopName, subject.accountName].filter(Boolean).map(value => String(value).trim()).filter(Boolean);
  const ids = [subject.shopId, subject.accountId, subject.subjectId].filter(Boolean).map(value => String(value).trim()).filter(Boolean);
  addDebugLog('doudian.switch.selector-click.cdp.start', { tabId, targetNames: names });
  const result = await cdpRuntimeEvaluate(tabId, runId, 'click doudian selector', buildDoudianSelectorClickExpression(names, ids));
  addDebugLog('doudian.switch.selector-click.cdp.result', { tabId, clicked: Boolean(result?.clicked), clickedText: result?.clickedText || '', matchedText: result?.matchedText || '', pageSummary: result?.pageSummary || '' });
  return result || { clicked: false, pageSummary: 'CDP 页面脚本没有返回结果。' };
}

async function getDoudianSubjectsFromSelector(tabId, runId) {
  assertRunActive(runId);
  addDebugLog('doudian.subject-selector.open', { tabId, url: DOUDIAN_SUBJECT_SELECT_URL, mode: 'cdp-only' });
  await navigateTabAndWait(tabId, DOUDIAN_SUBJECT_SELECT_URL, runId, '打开抖店主体选择页读取店铺列表');
  await sleepWithCancellation(2200, runId);
  const result = await scrapeDoudianSubjectSelectorByCdp(tabId, runId);
  assertRunActive(runId);
  addDebugLog('doudian.subject-selector.scrape', { tabId, url: result.url || '', title: result.title || '', count: result.count || 0, subjects: (result.subjects || []).map(item => ({ shopName: item.shopName, shopId: item.shopId, source: item.source })) });
  const subjects = Array.isArray(result.subjects) ? result.subjects : [];
  if (!subjects.length) {
    throw makeError(`抖店主体选择页没有识别到店铺。${result.pageSummary ? `页面摘要：${result.pageSummary}` : ''}`, 'NO_SHOPS');
  }
  return subjects.map((item, index) => ({ ...item, index }));
}



function randomIntBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function sleepDoudianApiInterval(runId, label) {
  const ms = randomIntBetween(DOUDIAN_API_DELAY_MS[0], DOUDIAN_API_DELAY_MS[1]);
  addDebugLog('doudian.api.interval', { label, milliseconds: ms });
  await sleepWithCancellation(ms, runId);
}

async function sleepDoudianSwitchInterval(runId, label) {
  const ms = randomIntBetween(DOUDIAN_SWITCH_DELAY_MS[0], DOUDIAN_SWITCH_DELAY_MS[1]);
  addDebugLog('doudian.switch.interval', { label, milliseconds: ms });
  await sleepWithCancellation(ms, runId);
}

async function collectDoudianSubject(subject, runId, sender) {
  getRun(runId, sender);
  const tab = await getDoudianWorkTab(runId);
  if (!subject || (!subject.subjectId && !subject.memberId && !subject.shopName && !subject.accountName)) throw makeError('抖店主体参数缺失。', 'INVALID_SUBJECT');
  if (subject.canLogin === false) throw makeError('该抖店主体不可登录，已跳过。', 'SUBJECT_CANNOT_LOGIN');

  await sleepDoudianSwitchInterval(runId, '切换店铺前等待');
  const switchVerification = await switchDoudianSubject(tab.id, subject, runId);
  await sleepWithCancellation(1200, runId);

  const overview = await optionalDoudianApiRequest(tab.id, runId, '抖店体验分总览', {
    debugLabel: '抖店体验分总览 getOverviewByVersion',
    url: `${DOUDIAN_ORIGIN}/governance/shop/experiencescore/getOverviewByVersion?exp_version=release&new_shop_version=release&source=1`,
    method: 'GET',
    referrer: `${DOUDIAN_ORIGIN}/ffa/eco/experience-score?source=fxg-menu`,
    headers: { Accept: 'application/json, text/plain, */*' },
    restoreAfter: false
  });
  await sleepDoudianApiInterval(runId, '体验分总览后等待');

  const serviceSubScore = await optionalDoudianApiRequest(tab.id, runId, '抖店新服务体验明细', {
    debugLabel: '抖店新服务体验明细 getSubScoreNew',
    url: `${DOUDIAN_ORIGIN}/governance/shop/experiencescore/getSubScoreNew?filter_by_industry=true&new_dimension=true&exp_version=release&new_shop_version=release&experience_node=3`,
    method: 'GET',
    referrer: `${DOUDIAN_ORIGIN}/ffa/eco/experience-score/detail?nodeId=316&preview=true`,
    headers: { Accept: 'application/json, text/plain, */*' },
    restoreAfter: false
  });
  await sleepDoudianApiInterval(runId, '新服务体验明细后等待');

  const noInputDateMeta = requestDateNoInputMeta();

  const commentStatistics = await optionalDoudianApiRequest(tab.id, runId, '抖店评价数据概览', {
    debugLabel: '抖店评价数据概览 comment/statistics',
    url: await buildDoudianCommentStatisticsUrl(),
    method: 'GET',
    referrer: `${DOUDIAN_ORIGIN}/ffa/maftersale/comment`,
    headers: { Accept: 'application/json, text/plain, */*' },
    restoreAfter: false
  });
  await sleepDoudianApiInterval(runId, '评价数据概览后等待');

  await prepareDoudianCustomerServicePage(tab.id, runId);
  const customerServiceRequest = buildDoudianCustomerServiceRequest();
  const customerServiceStaff = await optionalDoudianApiRequest(tab.id, runId, '抖店客服数据', {
    debugLabel: '抖店客服数据 queryStaffData',
    url: customerServiceRequest.url,
    method: 'GET',
    referrer: DOUDIAN_CUSTOMER_SERVICE_HOME,
    headers: { Accept: 'application/json, text/plain, */*' },
    restoreAfter: false
  });

  addDebugLog('doudian.api.batch.current-tab', { tabId: tab.id, mode: 'current-visible-navigation-no-restore' });

  const overviewData = overview.error ? null : Shared.normalizeDoudianExperienceOverview(overview.raw);
  const serviceData = serviceSubScore.error ? null : Shared.normalizeDoudianServiceSubScore(serviceSubScore.raw);
  const commentData = commentStatistics.error ? null : Shared.normalizeDoudianCommentStatistics(commentStatistics.raw);
  const customerServiceData = customerServiceStaff.error ? null : Shared.normalizeDoudianCustomerServiceStaff(customerServiceStaff.raw);
  validateDoudianCollectedOwnership(subject, { overviewData, serviceData });

  return {
    platform: 'doudian',
    shop: {
      shopId: subject.shopId || subject.accountId || subject.subjectId,
      shopName: subject.shopName || subject.accountName || subject.subjectId,
      shopLogo: subject.shopLogo || '',
      subjectId: subject.subjectId,
      memberId: subject.memberId,
      encodeShopId: subject.encodeShopId || '',
      encodeMemberId: subject.encodeMemberId || '',
      identityTypeDesc: subject.identityTypeDesc || '',
      labels: subject.labels || []
    },
    switchVerification,
    experienceOverview: {
      ok: !overview.error,
      error: overview.error || '',
      dateMeta: noInputDateMeta,
      data: overviewData,
      raw: overview.raw || null
    },
    serviceSubScore: {
      ok: !serviceSubScore.error,
      error: serviceSubScore.error || '',
      dateMeta: noInputDateMeta,
      data: serviceData,
      raw: serviceSubScore.raw || null
    },
    commentStatistics: {
      ok: !commentStatistics.error,
      error: commentStatistics.error || '',
      dateMeta: noInputDateMeta,
      data: commentData,
      raw: commentStatistics.raw || null
    },
    customerServiceStaff: {
      ok: !customerServiceStaff.error,
      error: customerServiceStaff.error || '',
      dateMeta: customerServiceRequest.dateMeta,
      data: customerServiceData,
      raw: customerServiceStaff.raw || null
    },
    collectedAt: new Date().toISOString()
  };
}

async function getDoudianWorkTab(runId) {
  const run = activeRuns.get(runId);
  if (!run) throw makeError('采集任务已不存在或已经停止。', 'COLLECTION_CANCELLED');
  assertRunActive(runId);
  if (run.doudianWorkTabId !== undefined) {
    try {
      const tab = await chrome.tabs.get(run.doudianWorkTabId);
      if (tab && tab.id !== undefined) {
        await ensureDoudianTabAtHome(tab.id, runId, false);
        return tab;
      }
    } catch {}
  }
  const tab = await prepareDoudianWorkTab(runId);
  run.doudianWorkTabId = tab.id;
  return tab;
}

async function ensureDoudianTabAtHome(tabId, runId, force) {
  assertRunActive(runId);
  const tab = await chrome.tabs.get(tabId);
  const url = String(tab.url || '');
  if (!force && url.startsWith(DOUDIAN_ORIGIN) && !/\/index\/login|ticket=|passport.*login/i.test(url)) return;
  await navigateTabAndWait(tabId, DOUDIAN_HOME, runId, '打开抖店首页');
  await sleepWithCancellation(1000, runId);
}


async function switchDoudianSubjectByCookie(tabId, subject, runId) {
  assertRunActive(runId);
  const targetShopId = String(subject?.accountId || subject?.shopId || '').trim();
  if (!targetShopId) throw makeError('目标抖店主体缺少 account_id，无法用 ecom_gray_shop_id 切换。', 'INVALID_SUBJECT');

  const before = await getCookieValue(DOUDIAN_ORIGIN, 'ecom_gray_shop_id');
  addDebugLog('doudian.switch.cookie.set.start', { tabId, targetShopId, before, mode: 'silent-no-navigation' });
  await setDoudianGrayShopCookie(targetShopId);
  await sleepWithCancellation(500, runId);

  const after = await getCookieValue(DOUDIAN_ORIGIN, 'ecom_gray_shop_id');
  if (String(after || '') !== targetShopId) {
    throw makeError(`ecom_gray_shop_id 写入后仍为 ${after || '空'}，目标为 ${targetShopId}。`, 'COOKIE_SWITCH_FAILED');
  }

  // V0.4.7：不再刷新或跳转抖店标签页。后续业务接口会用最新 Cookie 静默请求，
  // 并通过接口返回的 shop_id / 店铺字段做二次归属校验，防止串店。
  return { status: 'verified', message: `已静默写入 ecom_gray_shop_id 并校验当前抖店主体：${subject.shopName || targetShopId}` };
}

async function setDoudianGrayShopCookie(shopId) {
  const value = String(shopId || '').trim();
  if (!value) throw makeError('ecom_gray_shop_id 为空，无法切换。', 'INVALID_SUBJECT');
  const existing = await chrome.cookies.getAll({ name: 'ecom_gray_shop_id' }).catch(() => []);
  const targets = existing.filter(cookie => /jinritemai\.com$/i.test(cookie.domain || '') || /fxg\.jinritemai\.com$/i.test(cookie.domain || ''));
  if (!targets.length) targets.push({ domain: 'fxg.jinritemai.com', path: '/' });
  for (const cookie of targets) {
    const domain = String(cookie.domain || 'fxg.jinritemai.com');
    const cleanDomain = domain.replace(/^\./, '') || 'fxg.jinritemai.com';
    const url = `https://${cleanDomain}/`;
    await chrome.cookies.set({
      url,
      name: 'ecom_gray_shop_id',
      value,
      path: cookie.path || '/',
      secure: true,
      sameSite: 'no_restriction'
    }).catch(async () => {
      await chrome.cookies.set({ url: `${DOUDIAN_ORIGIN}/`, name: 'ecom_gray_shop_id', value, path: '/', secure: true });
    });
  }
  await chrome.cookies.set({ url: `${DOUDIAN_ORIGIN}/`, name: 'ecom_gray_shop_id', value, path: '/', secure: true }).catch(() => {});
}

async function switchDoudianSubject(tabId, subject, runId) {
  assertRunActive(runId);

  const initial = await readDoudianCurrentSubjectFromList(tabId, subject, runId)
    .catch(error => ({ status: 'unknown', message: error.message || String(error) }));
  addDebugLog('doudian.switch.initial-check', { subject: { shopName: subject.shopName, shopId: subject.shopId, accountId: subject.accountId, subjectId: subject.subjectId, memberId: subject.memberId }, initial });
  if (initial.status === 'verified') {
    addDebugLog('doudian.switch.force-selector-even-current', {
      tabId,
      subject: { shopName: subject.shopName, shopId: subject.shopId, accountId: subject.accountId },
      reason: 'V0.5.4：即使 Cookie 显示当前店铺，也强制走一次抖店原生主体选择链路，刷新服务端主体上下文。'
    });
  }

  // V0.5.4：不再信任 cookie-only 或 already-current 判断。即使当前就是目标店铺，
  // 也通过抖店原生主体选择页重新点击一次，解决隔夜会话 / 多主体账号的半切换问题。
  // V0.5.0：不再信任 cookie-only 切店。跨店铺时走抖店原生主体选择页，
  // 但整个过程在后台非激活当前标签页完成，当前抖店页面会按真实链路跳转。
  addDebugLog('doudian.switch.selector-current.start', {
    tabId,
    subject: { shopName: subject.shopName, shopId: subject.shopId, accountId: subject.accountId, subjectId: subject.subjectId },
    reason: initial.message || ''
  });

  await navigateTabAndWait(tabId, DOUDIAN_SUBJECT_SELECT_URL, runId, '当前抖店标签页打开抖店主体选择页');
  await sleepWithCancellation(1800, runId);

  const clickResult = await clickDoudianSubjectInSelector(tabId, subject, runId);
  addDebugLog('doudian.switch.selector-current.click', { tabId, clicked: Boolean(clickResult?.clicked), result: clickResult });
  if (!clickResult?.clicked) {
    throw makeError(
      `抖店切换到“${subject.shopName || subject.accountName || subject.shopId || subject.subjectId}”失败：${clickResult?.pageSummary || clickResult?.message || '没有点击到目标店铺'}。`,
      'SWITCH_CLICK_FAILED'
    );
  }

  const verification = await waitForDoudianSubjectSwitch(tabId, subject, runId);
  addDebugLog('doudian.switch.selector-current.verification', { subject: { shopName: subject.shopName, shopId: subject.shopId, accountId: subject.accountId, subjectId: subject.subjectId }, verification });
  let finalTab = await chrome.tabs.get(tabId);
  if (/\/login\/common/i.test(finalTab.url || '')) {
    await navigateTabAndWait(tabId, DOUDIAN_HOME, runId, '当前抖店标签页返回抖店首页');
    await sleepWithCancellation(1000, runId);
    finalTab = await chrome.tabs.get(tabId);
  }

  return {
    status: verification.status || 'verified',
    message: verification.message || `已通过抖店原生主体选择页切换到：${subject.shopName || subject.shopId}`,
    finalUrl: finalTab.url || DOUDIAN_HOME,
    method: 'current-visible-tab-subject-selector',
    clickedText: clickResult.matchedText || '',
    verifiedAt: new Date().toISOString()
  };
}

async function clickDoudianSubjectInSelector(tabId, subject, runId) {
  assertRunActive(runId);
  addDebugLog('doudian.switch.selector-click.cdp-only', { tabId, targetNames: [subject.shopName, subject.accountName].filter(Boolean) });
  return await clickDoudianSubjectInSelectorByCdp(tabId, subject, runId);
}



async function waitForDoudianSubjectSwitch(tabId, subject, runId) {
  const deadline = Date.now() + 45000;
  let lastMessage = '';
  while (Date.now() < deadline) {
    assertRunActive(runId);
    await sleepWithCancellation(800, runId);
    let tab;
    try { tab = await chrome.tabs.get(tabId); } catch { throw makeError('抖店当前标签页已被关闭。', 'PLATFORM_TAB_NOT_FOUND'); }
    const url = String(tab.url || '');
    if (/\/index\/login|ticket=|passport.*login/i.test(url)) {
      await assertDoudianSwitchLandingOk(tabId, url, subject, runId);
    }
    const listResult = await readDoudianCurrentSubjectFromList(tabId, subject, runId)
      .catch(error => ({ status: 'unknown', message: error.message || String(error), code: error.code || '' }));
    lastMessage = listResult.message || lastMessage;
    if (listResult.status === 'verified') return listResult;
    const pageResult = await readDoudianVisibleContext(tabId, subject, runId)
      .catch(error => ({ status: 'unknown', message: error.message || String(error) }));
    if (pageResult.status === 'verified') return pageResult;
    lastMessage = pageResult.message || lastMessage;
  }
  throw makeError(`抖店切换到“${subject.shopName || subject.accountName || subject.shopId || subject.subjectId}”后，45 秒内未能确认当前主体。${lastMessage ? ` ${lastMessage}` : ''}`, 'SWITCH_NOT_VERIFIED');
}

async function assertDoudianSwitchLandingOk(tabId, finalUrl, subject, runId) {
  assertRunActive(runId);
  const url = String(finalUrl || '');
  if (!/\/index\/login|ticket=|passport.*login|login\?/i.test(url)) return;
  const expression = `(() => ({ url: location.href, title: document.title || '', text: (document.body?.innerText || '').slice(0, 2000) }))()`;
  const result = await cdpRuntimeEvaluate(tabId, runId, 'doudian switch landing check', expression).catch(error => ({ url, title: '', text: error?.message || String(error) })) || {};
  const text = `${result.title || ''}\n${result.text || ''}`;
  if (/10005|系统繁忙/i.test(text)) {
    throw makeError(`抖店切换到 ${subject.shopName || subject.subjectId} 失败：ticket 登录返回系统繁忙。请刷新抖店后台或重新登录后再采集。`, 'PLATFORM_BUSY');
  }
  throw makeError(`抖店切换到 ${subject.shopName || subject.subjectId} 后仍停留在登录页，请重新登录抖店后再采集。`, 'NOT_LOGGED_IN');
}



async function verifyDoudianCurrentSubject(tabId, subject, runId) {
  // 优先使用官方主体列表中的当前/选中标记；如果接口没有当前标记，则用页面可见店铺名做弱校验。
  const listResult = await readDoudianCurrentSubjectFromList(tabId, subject, runId).catch(error => ({ status: 'unknown', message: error.message || String(error) }));
  if (listResult.status === 'verified') return listResult;
  if (listResult.status === 'mismatch') {
    throw makeError(listResult.message, 'DATA_MISMATCH');
  }

  const pageResult = await readDoudianVisibleContext(tabId, subject, runId).catch(error => ({ status: 'unknown', message: error.message || String(error) }));
  if (pageResult.status === 'verified') return pageResult;
  if (pageResult.status === 'mismatch') throw makeError(pageResult.message, 'DATA_MISMATCH');

  return {
    status: 'weak',
    message: listResult.message || pageResult.message || '抖店切换已完成，但当前页面未提供明确店铺标记，后续会用业务接口返回的 shop_id 再校验。'
  };
}

async function readDoudianCurrentShopInfo(tabId, subject, runId) {
  const names = [subject?.shopName, subject?.accountName].filter(Boolean).map(value => String(value).trim()).filter(Boolean);
  const url = await buildDoudianShopInfoUrl(tabId);
  addDebugLog('doudian.shop-info.silent.start', { tabId, tokenPresent: /[?&]__token=/.test(url), lidPresent: /[?&]_lid=/.test(url), hasABogus: /[?&]a_bogus=/.test(url), hasMsToken: /[?&]msToken=/.test(url), url });
  const response = await pageRequest(tabId, {
    debugLabel: '抖店当前店铺信息 shop/info 静默请求',
    url,
    method: 'GET',
    referrer: DOUDIAN_HOME,
    headers: { Accept: 'application/json, text/plain, */*' }
  }, runId);
  const raw = requireSuccessfulApi(response, '抖店当前店铺信息');
  const data = raw?.data || {};
  const shopName = String(data.shop_name || data.shopName || '').trim();
  const logo = data.shop_logo?.url || data.shopLogo?.url || data.logo || '';
  addDebugLog('doudian.shop-info.result', { shopName, logoPresent: Boolean(logo), operateStatus: data.operate_status_str || data.operateStatusStr || '' });
  if (!shopName) return { status: 'unknown', message: 'shop/info 未返回当前店铺名称。', raw };
  if (names.length && names.some(name => shopName === name || shopName.includes(name) || name.includes(shopName))) {
    return { status: 'verified', message: `已通过 shop/info 校验当前抖店主体：${shopName}`, shopName, logo, raw };
  }
  if (names.length) return { status: 'mismatch', message: `抖店切换未生效：目标是 ${names.join(' / ')}，shop/info 当前返回 ${shopName}。`, shopName, logo, raw };
  return { status: 'unknown', message: `shop/info 当前店铺：${shopName}，但目标没有店铺名称可比对。`, shopName, logo, raw };
}


async function readDoudianCurrentSubjectFromList(tabId, subject, runId) {
  // V0.5.7：抖店校验不再调用 shop/info 静默 fetch。这里只读 Cookie；最终准确性由业务接口 shop_id 强校验保证。
  const grayShopId = await getCookieValue(DOUDIAN_ORIGIN, 'ecom_gray_shop_id');
  const strongIds = doudianSubjectIds(subject).filter(Boolean);
  if (grayShopId && strongIds.length) {
    if (matchesDoudianSubjectId(grayShopId, subject)) {
      return { status: 'verified', message: `已通过 ecom_gray_shop_id 校验当前抖店主体：${subject.shopName || subject.shopId || grayShopId}` };
    }
    return { status: 'mismatch', message: `抖店切换未生效：目标是 ${subject.shopName || subject.shopId}，当前 ecom_gray_shop_id=${grayShopId}。` };
  }
  return { status: 'unknown', message: '当前 Cookie 未能确认主体；后续会用页面店铺名和业务接口 shop_id 校验。' };
}



async function readDoudianVisibleContext(tabId, subject, runId) {
  assertRunActive(runId);
  const names = [subject.shopName, subject.accountName].filter(Boolean).map(String);
  if (!names.length) return { status: 'unknown', message: '没有店铺名称，无法进行页面可见弱校验。' };
  const expression = `((names) => {
    const text = (document.body?.innerText || '').slice(0, 60000);
    const title = document.title || '';
    const visible = title + '\\n' + text;
    return {
      url: location.href,
      title,
      matchedNames: names.filter(name => name && visible.includes(name)),
      via: 'cdp-only'
    };
  })(${JSON.stringify(names)})`;
  const result = await cdpRuntimeEvaluate(tabId, runId, 'read doudian visible context', expression).catch(error => ({ matchedNames: [], message: error?.message || String(error) })) || {};
  assertRunActive(runId);
  if (result.matchedNames?.length) {
    return { status: 'verified', message: `页面已显示目标店铺：${result.matchedNames[0]}` };
  }
  return { status: 'unknown', message: result.message || '页面暂未显示目标店铺名称，将继续用业务接口 shop_id 校验。' };
}



function validateDoudianCollectedOwnership(subject, { overviewData, serviceData }) {
  const strongIds = doudianSubjectIds(subject).filter(Boolean);
  if (!strongIds.length) {
    addDebugLog('doudian.ownership.skip', { reason: '主体来自页面 DOM，缺少 account_id/subject_id，跳过强 ID 校验。', shopName: subject?.shopName || subject?.accountName || '' });
    return;
  }
  const checks = [];
  if (overviewData?.shopId) checks.push({ label: '体验分总览', shopId: overviewData.shopId, shopName: overviewData.shopName });
  if (serviceData?.shopId) checks.push({ label: '新服务体验明细', shopId: serviceData.shopId, shopName: serviceData.shopName });
  for (const check of checks) {
    if (!matchesDoudianSubjectId(check.shopId, subject)) {
      throw makeError(`疑似串店，已停止保存：${check.label} 返回 shop_id=${check.shopId}，目标店铺是 ${subject.shopName || subject.shopId || subject.subjectId}。`, 'DATA_MISMATCH');
    }
  }
}

function matchesDoudianSubjectId(value, subject) {
  const actual = normalizeId(value);
  if (!actual) return false;
  return doudianSubjectIds(subject).some(id => normalizeId(id) === actual);
}

function isSameDoudianSubject(left, right) {
  const leftIds = doudianSubjectIds(left).map(normalizeId).filter(Boolean);
  const rightIds = doudianSubjectIds(right).map(normalizeId).filter(Boolean);
  if (leftIds.length && rightIds.length && leftIds.some(id => rightIds.includes(id))) return true;
  const leftName = normalizeId(left?.shopName || left?.accountName);
  const rightName = normalizeId(right?.shopName || right?.accountName);
  return Boolean(leftName && rightName && leftName === rightName);
}

function doudianSubjectIds(subject) {
  return [subject?.shopId, subject?.accountId, subject?.subjectId, subject?.memberId, subject?.encodeShopId, subject?.encodeMemberId].filter(Boolean).map(String);
}

function normalizeId(value) {
  return String(value ?? '').trim();
}

function normalizeAbsoluteUrl(value, base) {
  const text = String(value || '').trim();
  if (!text) return text;
  try { return new URL(text, base).href; } catch { return text; }
}

async function navigateTabAndWait(tabId, url, runId, label) {
  assertRunActive(runId);
  await chrome.tabs.update(tabId, { url });
  const start = Date.now();
  const timeoutMs = 25000;
  while (Date.now() - start < timeoutMs) {
    assertRunActive(runId);
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete' && tab.url && !/^chrome-error:/i.test(tab.url)) return tab.url;
    await sleepWithCancellation(250, runId);
  }
  throw makeError(`${label} 页面加载超时，请手动刷新抖店后台后重试。`, 'REQUEST_TIMEOUT');
}

async function buildDoudianCommentStatisticsUrl() {
  const fp = await getCookieValue(DOUDIAN_ORIGIN, 's_v_web_id') || '';
  const params = new URLSearchParams({
    appid: '1',
    _bid: 'ffa_aftersale',
    aid: '4272',
    aftersale_platform_source: 'fxg'
  });
  if (fp) {
    params.set('verifyFp', fp);
    params.set('fp', fp);
  }
  return `${DOUDIAN_ORIGIN}/product/tcomment/statistics?${params.toString()}`;
}

function doudianCustomerServiceYmd() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function buildDoudianCustomerServiceRequest(dateYmd = doudianCustomerServiceYmd()) {
  const compact = String(dateYmd || '').replace(/-/g, '');
  const displayDate = ymdCompactToLocalYmd(compact) || yesterdayYmd();
  const params = new URLSearchParams({
    _pms: '1',
    page: '1',
    size: '20',
    startTime: compact,
    endTime: compact,
    queryType: '1'
  });
  return {
    url: `${DOUDIAN_PIGEON_ORIGIN}/backstage/queryStaffData?${params.toString()}`,
    dateMeta: requestDateRangeMeta(displayDate, displayDate)
  };
}

function buildDoudianCustomerServiceUrl(dateYmd = doudianCustomerServiceYmd()) {
  return buildDoudianCustomerServiceRequest(dateYmd).url;
}

async function prepareDoudianCustomerServicePage(tabId, runId) {
  assertRunActive(runId);
  // V0.5.9：不再打开 im.jinritemai.com 的客服前端页。
  // 该页面依赖 ecombdstatic.com 的 CSS/JS chunk，网络波动或缓存失配时会出现
  // “Loading CSS chunk failed”，影响用户后续正常访问客服工作台。
  // queryStaffData 接口可以直接通过当前标签页跳转 pigeon JSON 读取，
  // 因此这里仅记录日志，不做页面预热跳转。
  addDebugLog('doudian.customer-service.home.skip', {
    tabId,
    reason: 'direct-pigeon-json-navigation',
    skippedUrl: DOUDIAN_CUSTOMER_SERVICE_HOME
  });
}

async function getWeixinBackgroundSession() {
  const bizMagic = await getCookieValue(WEIXIN_ORIGIN, 'biz_magic');
  if (!bizMagic) throw makeError('没有检测到微信小店登录状态，请先登录微信小店后台。', 'NOT_LOGGED_IN');
  let cookieNames = [];
  try {
    const cookies = await chrome.cookies.getAll({ url: `${WEIXIN_ORIGIN}/` });
    cookieNames = cookies.map(item => item.name).filter(Boolean).slice(0, 80);
  } catch {}
  return { bizMagic, cookieNames };
}

async function backgroundWeixinRequest(request, runId) {
  assertRunActive(runId);
  const session = await getWeixinBackgroundSession();
  const label = request.debugLabel || endpointLabel(request.url);
  const headers = { Accept: 'application/json, text/plain, */*', ...(request.headers || {}), biz_magic: session.bizMagic };
  delete headers.Cookie;
  delete headers.cookie;
  delete headers.Host;
  delete headers.host;
  delete headers.Connection;
  delete headers.connection;
  delete headers['User-Agent'];
  delete headers['user-agent'];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS);
  addDebugLog('weixin.background-request.start', {
    label,
    method: request.method || 'GET',
    url: request.url,
    referrer: request.referrer || '',
    headers,
    cookieNames: session.cookieNames,
    body: request.body || null
  });

  try {
    const response = await fetch(request.url, {
      method: request.method || 'GET',
      headers,
      body: request.body || undefined,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'follow',
      referrer: request.referrer || undefined,
      referrerPolicy: 'strict-origin-when-cross-origin',
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const result = {
      status: response.status,
      ok: response.ok,
      redirected: response.redirected,
      url: response.url,
      contentType: response.headers.get('content-type') || '',
      text: text.slice(0, 2000000),
      json,
      transport: 'background-fetch-cookie-biz_magic'
    };
    addDebugLog('weixin.background-request.result', { label, result: summarizeResponseForDebug(result) });
    assertRunActive(runId);
    return result;
  } catch (error) {
    const aborted = controller.signal.aborted;
    const message = aborted ? '请求已停止或超时' : (error?.message || String(error));
    addDebugLog('weixin.background-request.exception', { label, message, aborted });
    return { status: 0, ok: false, contentType: '', text: '', json: null, aborted, error: message, transport: 'background-fetch-exception' };
  } finally {
    clearTimeout(timer);
  }
}

async function optionalBackgroundWeixinRequest(runId, label, request) {
  try {
    const response = await backgroundWeixinRequest({ ...request, debugLabel: label }, runId);
    const raw = requireSuccessfulApi(response, label);
    return { raw, response };
  } catch (error) {
    return { error: error.message || String(error), code: error.code || 'REQUEST_FAILED', raw: null };
  }
}

async function optionalPageRequest(tabId, runId, label, request) {
  try {
    const response = await pageRequest(tabId, request, runId);
    const raw = requireSuccessfulApi(response, label);
    return { raw, response };
  } catch (error) {
    return { error: error.message || String(error), code: error.code || 'REQUEST_FAILED', raw: null };
  }
}

function isBlockedLikeError(error) {
  const text = `${error?.message || ''} ${error?.code || ''}`;
  return /Blocked|Failed to fetch|NetworkError|Load failed|REQUEST_FAILED|XHR_NETWORK_ERROR/i.test(text);
}

function requireSuccessfulRawApi(raw, label) {
  if (!raw || typeof raw !== 'object') throw makeError(`${label}没有返回有效 JSON。`, 'INVALID_RESPONSE');
  if (raw.code !== undefined && Number(raw.code) !== 0) {
    const message = String(raw.msg || raw.message || '接口返回失败');
    throw classifyApiError(`${label}失败：code=${raw.code}，${message}`, message);
  }
  if (raw.st !== undefined && Number(raw.st) !== 0) {
    const message = String(raw.msg || raw.message || '接口返回失败');
    throw classifyApiError(`${label}失败：st=${raw.st}，${message}`, message);
  }
  return raw;
}

async function optionalDoudianApiRequest(tabId, runId, label, request) {
  // V0.5.0：业务接口恢复“浏览器导航到 JSON 接口”的方式，直接在当前抖店标签页中执行。
  // 这样保留最高成功率，代价是当前抖店页面会短暂跳转到 JSON 接口。
  try {
    if (request.method && String(request.method).toUpperCase() !== 'GET') {
      throw makeError(`${label} 暂不支持非 GET 导航采集。`, 'UNSUPPORTED_METHOD');
    }
    addDebugLog('doudian.api.work-tab-navigation.start', { label, tabId, url: request.url });
    const raw = await fetchJsonByCurrentTabNavigation(request.url, runId, tabId, `${label}当前标签页`, false);
    requireSuccessfulRawApi(raw, label);
    addDebugLog('doudian.api.work-tab-navigation.ok', { label, code: raw?.code, st: raw?.st, msg: raw?.msg || raw?.message || '' });
    return { raw, response: { json: raw, status: 200, ok: true, transport: 'current-visible-tab-navigation' }, via: 'current-visible-tab-navigation' };
  } catch (error) {
    addDebugLog('doudian.api.work-tab-navigation.failed', { label, code: error?.code || '', message: error?.message || String(error) });
    return { error: error?.message || String(error), code: error?.code || 'REQUEST_FAILED', raw: null, via: 'current-visible-tab-navigation' };
  }
}

function yesterdayStartUnixSeconds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  return Math.floor(start.getTime() / 1000);
}

function formatLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function yesterdayYmd() {
  const now = new Date();
  return formatLocalYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0));
}

function localDateDaysAgo(daysAgo) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(daysAgo || 0), 0, 0, 0, 0);
}

function requestDateNoInputMeta() {
  const y = yesterdayYmd();
  return requestDateSingleMeta(y);
}

function requestDateSingleMeta(dateText) {
  const date = String(dateText || yesterdayYmd());
  return { mode: 'single', startDate: date, endDate: date, display: `请求时间=${date}` };
}

function requestDateRangeMeta(startDate, endDate) {
  const start = String(startDate || yesterdayYmd());
  const end = String(endDate || start);
  const display = start === end ? `请求时间=${start}` : `请求时间=${start}-${end}`;
  return { mode: 'range', startDate: start, endDate: end, display };
}

function unixSecondToLocalYmd(seconds) {
  const num = Number(seconds);
  if (!Number.isFinite(num)) return '';
  return formatLocalYmd(new Date(num * 1000));
}

function ymdCompactToLocalYmd(value) {
  const text = String(value || '').replace(/\D/g, '');
  if (text.length !== 8) return '';
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function localStartUnixSecondsDaysAgo(daysAgo) {
  return Math.floor(localDateDaysAgo(daysAgo).getTime() / 1000);
}

function requireSuccessfulPddRawApi(raw, label) {
  if (!raw || typeof raw !== 'object') throw makeError(`${label}没有返回有效 JSON。`, 'INVALID_RESPONSE');

  // 拼多多不同子系统返回结构不完全一致：
  // janus/sydney 常见：success=true + errorCode=1000000；
  // chats/csReportDetail 常见：success=true，但可能不返回 errorCode。
  // 因此这里把“success=true 且 errorCode 为空”也视为成功，避免客服绩效 JSON 已成功返回后被误判失败。
  const hasErrorCode = raw.errorCode !== undefined && raw.errorCode !== null && raw.errorCode !== '';
  const errorCodeOk = !hasErrorCode || Number(raw.errorCode) === 1000000;
  if (raw.success !== true || !errorCodeOk) {
    const message = String(raw.errorMsg || raw.errorMessage || raw.msg || raw.message || '接口返回失败');
    addDebugLog('pdd.api.rejected', {
      label,
      success: raw?.success,
      errorCode: raw?.errorCode,
      errorMsg: raw?.errorMsg || raw?.errorMessage || raw?.msg || raw?.message || '',
      resultType: Array.isArray(raw?.result) ? 'array' : typeof raw?.result
    });
    throw classifyApiError(`${label}失败：errorCode=${raw.errorCode}，${message}`, message);
  }
  return raw;
}

function scoreOneDecimalFloor(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return (Math.floor(num * 10) / 10).toFixed(1);
}

function percentTwo(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `${(num * 100).toFixed(2)}%`;
}

function pddRawPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `${(num * 100).toFixed(2)}%`;
}

function pddSeconds(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return value === 0 ? '0秒' : '';
  if (num <= 0) return '0秒';
  if (num < 60) return `${Math.round(num * 10) / 10}秒`;
  const min = Math.floor(num / 60);
  const sec = Math.round(num % 60);
  return `${min}分${sec}秒`;
}


function normalizePddCommonMallInfo(raw) {
  const r = raw?.result || {};
  return {
    mallId: Shared.firstNonEmpty(r.mall_id, r.mallId, ''),
    shopName: String(Shared.firstNonEmpty(r.mall_name, r.mallName, r.shopName, '')),
    logo: String(Shared.firstNonEmpty(r.logo, r.logoUrl, r.mallLogo, '')),
    mallDesc: String(Shared.firstNonEmpty(r.mall_desc, r.mallDesc, '')),
    merchantType: r.merchant_type ?? r.merchantType ?? '',
    mallType: r.mall_type ?? r.mallType ?? '',
    status: r.status ?? '',
    isOpen: r.is_open ?? r.isOpen ?? '',
    staple: Array.isArray(r.staple) ? r.staple : []
  };
}

function normalizePddUserInfo(raw) {
  const r = raw?.result || {};
  return {
    userId: r.id || '',
    username: String(r.username || ''),
    nickname: String(r.nickname || ''),
    mallId: r.mall_id || r.mallId || '',
    mallOwner: Boolean(r.mallOwner),
    roleId: r.roleId ?? '',
    serverTime: r.server_time || '',
    mobile: r.mobile || ''
  };
}

function normalizePddMallServeScore(raw) {
  const r = raw?.result || {};
  return {
    readyDate: r.readyDate || '',
    consumerServiceScore: scoreOneDecimalFloor(r.cstmrServScore),
    consumerServiceScoreRaw: r.cstmrServScore,
    customerServiceRank: r.cstmrServRank,
    serviceAttitudeScore: scoreOneDecimalFloor(r.attiLmScore),
    serviceAttitudeScoreRaw: r.attiLmScore,
    baseServiceScore: scoreOneDecimalFloor(r.jcfwLmScore),
    baseServiceScoreRaw: r.jcfwLmScore,
    goodsServiceScore: scoreOneDecimalFloor(r.spLmScore),
    goodsServiceScoreRaw: r.spLmScore,
    shippingServiceScore: scoreOneDecimalFloor(r.fhLmScore),
    shippingServiceScoreRaw: r.fhLmScore,
    logisticsServiceScore: scoreOneDecimalFloor(r.wlLmScore),
    logisticsServiceScoreRaw: r.wlLmScore,
    platformHelpRate30d: percentTwo(r.ptHelpRate1m),
    hotProblems: Array.isArray(r.hotProblems) ? r.hotProblems.map(item => ({
      title: item.title || item.probDetail || '',
      problemName: item.probName || '',
      problemDetail: item.probDetail || '',
      orderCount: item.clfyOrdrCnt,
      orderRate: percentTwo(item.clfyOrdrCntRate)
    })) : []
  };
}

function normalizePddSaleQuality(raw) {
  const r = raw?.result || {};
  return {
    statDate: r.statDate || '',
    disputeRefundCount: r.dsptRfSucOrdrCnt1m,
    disputeRefundRate: percentTwo(r.dsptRfSucRto1m),
    platformInterventionOrderCount: r.pltInvlOrdrCnt1m,
    platformInterventionRate: percentTwo(r.pltInvlOrdrRto1m),
    qualityRefundCount: r.qurfOrdCnt1m,
    qualityRefundRate: percentTwo(r.qurfOrdRto1m),
    avgSuccessRefundProcessTime30d: r.avgSucRfProcTime1m,
    successRefundOrderAmount1d: r.sucRfOrdrAmt1d,
    successRefundOrderCount1d: r.sucRfOrdrCnt1d,
    refundSuccessRate30d: percentTwo(r.rfSucRto1m)
  };
}

function normalizePddCustomerServicePerformance(raw) {
  const list = Array.isArray(raw?.result?.data)
    ? raw.result.data
    : (Array.isArray(raw?.result) ? raw.result : []);
  return {
    list: list
      .filter(item => item && item.cs_name !== '店铺总计' && Number(item.uid) !== 999999)
      .map(item => ({
        csAccount: String(item.cs_name || ''),
        uid: item.uid,
        mmsUid: item.mms_uid,
        customerServiceScore: item.mcht_server_score,
        consultUserCount: item.consult_user_cnt,
        inquiryUserCount: item.inquiry_user,
        finalGroupUserCount: item.final_group_user,
        afterRefundSalesAmount: item.nrfnd_ordr_amt_3d,
        needManualReplyConsultUserCount: item.need_manu_reply_consult_user_cnt,
        manualReceiveUserCount: item.receive_user_cnt,
        threeMinUnreplyUserCount: item.delay_reply,
        threeMinManualReplyRate: pddRawPercent(item.reply_rate_3_min),
        thirtySecondAnswerRate: pddRawPercent(item.reply_30s_rate),
        avgManualResponseDuration: pddSeconds(item.avg_reply_time),
        raw: item
      }))
  };
}

function buildPddCsReportRequest() {
  // 拼多多客服绩效按 T-3 单日查询。
  // 例如今天 13 号，则 starttime/endtime 都传 10 号 00:00，用于查询 10 号有效数据。
  const targetDate = localDateDaysAgo(3);
  const target = String(Math.floor(targetDate.getTime() / 1000));
  const targetYmd = formatLocalYmd(targetDate);
  const params = new URLSearchParams({ starttime: target, endtime: target });
  return {
    url: `${PDD_CS_REPORT_URL}?${params.toString()}`,
    dateMeta: requestDateRangeMeta(targetYmd, targetYmd)
  };
}

function buildPddCsReportUrl() {
  return buildPddCsReportRequest().url;
}

async function pddCurrentTabJson(tabId, runId, label, url) {
  addDebugLog('pdd.api.current-tab-navigation.start', { label, tabId, url, method: 'GET' });
  const raw = await fetchJsonByCurrentTabNavigation(url, runId, tabId, `${label}当前标签页`, false);
  requireSuccessfulPddRawApi(raw, label);
  addDebugLog('pdd.api.current-tab-navigation.ok', { label, method: 'GET', success: raw?.success, errorCode: raw?.errorCode, errorMsg: raw?.errorMsg || '' });
  return raw;
}

async function pddCurrentTabPostJson(tabId, runId, label, url, body = {}, options = {}) {
  assertRunActive(runId);
  const debugLabel = label || endpointLabel(url);
  const requestBody = body || {};
  const referrer = options.referrer || PDD_HOME;
  addDebugLog('pdd.api.current-tab-post.start', {
    label: debugLabel,
    tabId,
    url,
    method: 'POST',
    bodyKeys: Object.keys(requestBody),
    referrer
  });

  // 拼多多 sydney 接口真实页面里是 POST。
  // 不能用 tabs.update 直接跳 URL，否则会变成 GET；这里在当前拼多多标签页同源上下文里用 CDP 执行 POST。
  // 仅用于已登录后的业务数据接口，不用于登录接口 auth，也不记录/保存敏感 token。
  const expression = `((url, body, referrer) => {
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      referrer: referrer || location.href,
      referrerPolicy: 'strict-origin-when-cross-origin',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }).then(async (response) => {
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch (error) {}
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        contentType: response.headers.get('content-type') || '',
        textHead: text.slice(0, 800),
        json,
        via: 'cdp-page-fetch-post'
      };
    }).catch((error) => ({
      ok: false,
      status: 0,
      statusText: '',
      url,
      contentType: '',
      textHead: '',
      json: null,
      errorName: error && error.name ? error.name : '',
      errorMessage: error && error.message ? error.message : String(error),
      via: 'cdp-page-fetch-post'
    }));
  })(${JSON.stringify(url)}, ${JSON.stringify(requestBody)}, ${JSON.stringify(referrer)})`;

  const payload = await cdpRuntimeEvaluate(tabId, runId, `pdd post json ${debugLabel}`, expression);
  if (!payload || typeof payload !== 'object') {
    throw makeError(`${debugLabel}没有返回有效响应。`, 'INVALID_RESPONSE');
  }
  if (payload.errorName || payload.errorMessage) {
    addDebugLog('pdd.api.current-tab-post.request.failed', {
      label: debugLabel,
      errorName: payload.errorName || '',
      errorMessage: payload.errorMessage || '',
      status: payload.status || 0
    });
    throw makeError(`${debugLabel}失败：${payload.errorMessage || payload.errorName || 'POST 请求异常'}`, 'REQUEST_FAILED');
  }
  if (!payload.json) {
    addDebugLog('pdd.api.current-tab-post.parse.failed', {
      label: debugLabel,
      status: payload.status,
      statusText: payload.statusText || '',
      contentType: payload.contentType || '',
      textHead: String(payload.textHead || '').slice(0, 700)
    });
    throw makeError(`${debugLabel}失败：POST 没有返回 JSON。`, 'INVALID_RESPONSE');
  }
  const raw = payload.json;
  requireSuccessfulPddRawApi(raw, debugLabel);
  addDebugLog('pdd.api.current-tab-post.ok', {
    label: debugLabel,
    method: 'POST',
    status: payload.status,
    success: raw?.success,
    errorCode: raw?.errorCode,
    errorMsg: raw?.errorMsg || raw?.errorMessage || ''
  });
  return raw;
}

async function restorePddHomeAfterCollect(tabId, reason) {
  if (tabId === undefined || tabId === null) return;
  try {
    addDebugLog('pdd.current-tab.restore-home.start', { tabId, url: PDD_HOME, reason: reason || '' });
    await navigateTabAndWaitNoRun(tabId, PDD_HOME, 15000);
    addDebugLog('pdd.current-tab.restore-home.ok', { tabId, url: PDD_HOME });
  } catch (error) {
    addDebugLog('pdd.current-tab.restore-home.failed', { tabId, message: error?.message || String(error) });
  }
}


async function getPddCookieIdentity() {
  try {
    const cookies = await chrome.cookies.getAll({ url: `${PDD_ORIGIN}/` });
    const tokenCookie = cookies.find(cookie => /^windows_app_shop_token/i.test(cookie.name));
    const passCookie = cookies.find(cookie => cookie.name === 'PASS_ID');
    const identity = { mallId: '', userId: '', shopName: '', logo: '' };
    if (tokenCookie?.value) {
      const decoded = decodePddTokenPayload(tokenCookie.value);
      identity.mallId = Shared.firstNonEmpty(decoded?.m, decoded?.mallId, decoded?.mall_id, identity.mallId);
      identity.userId = Shared.firstNonEmpty(decoded?.u, decoded?.userId, decoded?.user_id, identity.userId);
    }
    if ((!identity.mallId || !identity.userId) && passCookie?.value) {
      const match = String(passCookie.value).match(/_(\d+)_(\d+)$/);
      if (match) {
        identity.mallId = identity.mallId || match[1];
        identity.userId = identity.userId || match[2];
      }
    }
    addDebugLog('pdd.cookie-identity.result', { mallId: identity.mallId || '', userId: identity.userId ? '[present]' : '' });
    return identity;
  } catch (error) {
    addDebugLog('pdd.cookie-identity.failed', { message: error?.message || String(error) });
    return { mallId: '', userId: '', shopName: '', logo: '' };
  }
}

function decodePddTokenPayload(value) {
  try {
    let text = String(value || '').trim();
    if (!text) return null;
    text = text.replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4) text += '=';
    const jsonText = atob(text);
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

async function collectPddCurrent(runId, sender) {
  getRun(runId, sender);
  const tab = await findPddTab(true);

  try {
    addDebugLog('pdd.collect.step.start', { step: 'check_login', tabId: tab.id });
    const loginRaw = await pddCurrentTabJson(tab.id, runId, '拼多多登录检测', PDD_CHECK_LOGIN_URL);
    if (loginRaw?.result?.login !== true) throw makeError('拼多多商家后台未登录或登录已过期。', 'NOT_LOGGED_IN');
    addDebugLog('pdd.collect.step.ok', { step: 'check_login', login: true });
    await sleepWithCancellation(500, runId);

    // new/userinfo 在当前标签页 GET 会返回 METHOD_NOT_ALLOWED，主链路不再访问。
    // 店铺 ID 优先从当前浏览器 Cookie 提取，再用 commonMallInfo 补充店铺名称和 Logo。
    const userInfo = await getPddCookieIdentity();
    let mallInfo = null;
    try {
      addDebugLog('pdd.collect.step.start', { step: 'common_mall_info' });
      const mallInfoRaw = await pddCurrentTabJson(tab.id, runId, '拼多多店铺信息', PDD_COMMON_MALL_INFO_URL);
      mallInfo = normalizePddCommonMallInfo(mallInfoRaw);
      userInfo.mallId = String(Shared.firstNonEmpty(mallInfo.mallId, userInfo.mallId, ''));
      userInfo.shopName = String(Shared.firstNonEmpty(mallInfo.shopName, userInfo.shopName, ''));
      userInfo.logo = String(Shared.firstNonEmpty(mallInfo.logo, userInfo.logo, ''));
      userInfo.mallDesc = mallInfo.mallDesc || '';
      userInfo.merchantType = mallInfo.merchantType || '';
      userInfo.mallType = mallInfo.mallType || '';
      addDebugLog('pdd.collect.step.ok', { step: 'common_mall_info', mallId: userInfo.mallId || '', shopNamePresent: Boolean(userInfo.shopName), logoPresent: Boolean(userInfo.logo) });
      await sleepWithCancellation(300, runId);
    } catch (error) {
      addDebugLog('pdd.common-mall-info.optional.failed', { code: error?.code || '', message: error?.message || String(error) });
    }
    const noInputDateMeta = requestDateNoInputMeta();

    addDebugLog('pdd.collect.step.start', { step: 'mall_serve_score' });
    const mallServeScoreRaw = await pddCurrentTabPostJson(
      tab.id,
      runId,
      '拼多多消费者服务体验分',
      PDD_MALL_SERVE_SCORE_URL,
      {},
      { referrer: `${PDD_ORIGIN}/sycm/goods_quality/help` }
    );
    addDebugLog('pdd.collect.step.ok', { step: 'mall_serve_score', readyDate: mallServeScoreRaw?.result?.readyDate || '', score: mallServeScoreRaw?.result?.cstmrServScore });
    await sleepWithCancellation(500, runId);

    addDebugLog('pdd.collect.step.start', { step: 'sale_quality' });
    const saleQualityQueryDate = yesterdayYmd();
    const saleQualityDateMeta = requestDateSingleMeta(saleQualityQueryDate);
    const saleQualityRaw = await pddCurrentTabPostJson(
      tab.id,
      runId,
      '拼多多售后质量数据',
      PDD_SALE_QUALITY_URL,
      { queryDate: saleQualityQueryDate },
      { referrer: `${PDD_ORIGIN}/sycm/goods_quality/detail` }
    );
    addDebugLog('pdd.collect.step.ok', { step: 'sale_quality', statDate: saleQualityRaw?.result?.statDate || '', disputeRefundCount: saleQualityRaw?.result?.dsptRfSucOrdrCnt1m });
    await sleepWithCancellation(500, runId);

    addDebugLog('pdd.collect.step.start', { step: 'customer_service_performance' });
    const customerServiceRequest = buildPddCsReportRequest();
    const customerServiceRaw = await pddCurrentTabJson(tab.id, runId, '拼多多客服绩效详情', customerServiceRequest.url);
    const customerServiceRawList = Array.isArray(customerServiceRaw?.result?.data)
      ? customerServiceRaw.result.data
      : (Array.isArray(customerServiceRaw?.result) ? customerServiceRaw.result : []);
    const staffCount = customerServiceRawList.filter(item => item && item.cs_name !== '店铺总计' && Number(item.uid) !== 999999).length;
    addDebugLog('pdd.collect.step.ok', {
      step: 'customer_service_performance',
      staffCount,
      success: customerServiceRaw?.success,
      errorCode: customerServiceRaw?.errorCode,
      resultType: Array.isArray(customerServiceRaw?.result) ? 'array' : typeof customerServiceRaw?.result
    });

    const mallServeScore = normalizePddMallServeScore(mallServeScoreRaw);
    const saleQuality = normalizePddSaleQuality(saleQualityRaw);
    const customerServicePerformance = normalizePddCustomerServicePerformance(customerServiceRaw);
    addDebugLog('pdd.collect.all.ok', {
      readyDate: mallServeScore.readyDate || saleQuality.statDate || '',
      staffCount: customerServicePerformance.list?.length || 0
    });

    return {
      platform: 'pdd',
      shop: {
        shopId: String(userInfo.mallId || ''),
        mallId: String(userInfo.mallId || ''),
        shopName: userInfo.shopName || (userInfo.mallId ? `拼多多店铺 ${userInfo.mallId}` : '当前拼多多店铺'),
        logo: userInfo.logo || '',
        userId: String(userInfo.userId || ''),
        nickname: userInfo.nickname || '',
        mallOwner: Boolean(userInfo.mallOwner),
        roleId: userInfo.roleId || '',
        mallDesc: userInfo.mallDesc || '',
        merchantType: userInfo.merchantType || '',
        mallType: userInfo.mallType || '',
        tabTitle: tab.title || '',
        tabUrl: PDD_HOME,
        userInfoOptional: false
      },
      mallServeScore: { ok: true, data: mallServeScore, dateMeta: { ...noInputDateMeta, responseDate: mallServeScore.readyDate || '', responseLabel: '上次评估时间' }, raw: mallServeScoreRaw },
      saleQuality: { ok: true, data: saleQuality, dateMeta: saleQualityDateMeta, raw: saleQualityRaw },
      customerServicePerformance: { ok: true, data: customerServicePerformance, dateMeta: customerServiceRequest.dateMeta, raw: customerServiceRaw },
      collectedAt: new Date().toISOString()
    };
  } finally {
    await restorePddHomeAfterCollect(tab.id, 'collect-finished');
  }
}



async function requireLoggedInWeixinTab() {
  const tab = await findTab(WEIXIN_ORIGIN, true);
  const bizMagic = await getCookieValue(WEIXIN_ORIGIN, 'biz_magic');
  if (!bizMagic) throw makeError('没有检测到微信小店登录状态，请先在当前浏览器打开微信小店后台并扫码登录。', 'NOT_LOGGED_IN');
  return tab;
}

async function requireLoggedInDoudianTab(options = {}) {
  const sessionId = await getCookieValue(DOUDIAN_ORIGIN, 'sessionid');
  if (!sessionId) throw makeError('没有检测到抖店登录状态，请先在当前浏览器打开抖店后台并登录。', 'NOT_LOGGED_IN');
  if (options.prepare) return prepareDoudianWorkTab(options.runId || '');
  return findTab(DOUDIAN_ORIGIN, true);
}

async function prepareDoudianWorkTab(runId) {
  if (runId) assertRunActive(runId);
  // V0.5.4：采集入口不再因为 sessionid Cookie 缺失直接拒绝。
  // 是否真的登录交给 get_login_subject / 业务接口返回结果判断，避免“页面已登录但插件误判未登录”。
  const run = activeRuns.get(runId);
  if (run?.doudianWorkTabId !== undefined) {
    try {
      const existing = await chrome.tabs.get(run.doudianWorkTabId);
      if (existing?.id !== undefined) return existing;
    } catch {}
  }

  const tabs = (await chrome.tabs.query({ url: `${DOUDIAN_ORIGIN}/*` }))
    .filter(tab => tab.id !== undefined);
  if (!tabs.length) throw makeError(`没有找到已打开的 ${DOUDIAN_ORIGIN} 后台标签页。`, 'PLATFORM_TAB_NOT_FOUND');

  const sourceTab = chooseWorkTab(tabs);
  const closeIds = tabs.map(item => item.id).filter(id => id !== sourceTab.id);
  if (closeIds.length) {
    try { await chrome.tabs.remove(closeIds); } catch {}
    await sleepWithCancellation(500, runId);
  }

  // V0.5.4：不再创建后台采集标签页。直接使用当前/最近访问的抖店标签页做主体列表、切店和 JSON 导航。
  // 这样与人工在抖店页面切店的上下文完全一致，减少后台标签页、临时标签页造成的登录态和主体态不一致。
  if (run) {
    run.doudianOriginalTabId = sourceTab.id;
    run.doudianWorkTabId = sourceTab.id;
    run.doudianCollectorTabCreated = false;
  }
  addDebugLog('doudian.current-tab.selected', { tabId: sourceTab.id, closedOtherTabCount: closeIds.length, url: sourceTab.url || '', title: sourceTab.title || '' });
  try { doudianCapturedUrlsByTab.set(sourceTab.id, []); } catch {}
  await ensureTabReady(sourceTab.id, '抖店当前标签页');
  return chrome.tabs.get(sourceTab.id);
}

function chooseWorkTab(tabs) {
  const sorted = [...tabs].sort((left, right) => scorePlatformTabForSelection(right, DOUDIAN_ORIGIN) - scorePlatformTabForSelection(left, DOUDIAN_ORIGIN));
  return sorted[0];
}

async function reloadTabAndWait(tabId, label, runId, timeoutMs) {
  if (runId) assertRunActive(runId);
  const timeout = timeoutMs || 30000;
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(makeError(`${label}刷新超时，请手动刷新后重试。`, 'TAB_TIMEOUT'));
    }, timeout);
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
  try {
    await chrome.tabs.reload(tabId, { bypassCache: true });
  } catch (error) {
    throw makeError(`${label}刷新失败：${error?.message || error}`, 'TAB_ERROR');
  }
  await done;
  if (runId) assertRunActive(runId);
}

async function findPddTab(required) {
  const [primary, secondary] = await Promise.all([
    chrome.tabs.query({ url: `${PDD_ORIGIN}/*` }),
    chrome.tabs.query({ url: `${PDD_ALT_ORIGIN}/*` })
  ]);
  const usable = [...primary, ...secondary]
    .filter(tab => tab.id !== undefined)
    .map(tab => ({ tab, score: scorePlatformTabForSelection(tab, PDD_ORIGIN) }))
    .filter(item => item.score > -1000000)
    .sort((left, right) => right.score - left.score);
  const tab = usable[0]?.tab || null;
  if (!tab && required) throw makeError('没有找到已打开的拼多多商家后台标签页。', 'PLATFORM_TAB_NOT_FOUND');
  if (tab) await ensureTabReady(tab.id, '拼多多商家后台');
  return tab;
}

async function findTab(origin, required) {
  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  const usable = tabs
    .filter(tab => tab.id !== undefined)
    .map(tab => ({ tab, score: scorePlatformTabForSelection(tab, origin) }))
    .filter(item => item.score > -1000000)
    .sort((left, right) => right.score - left.score);
  const tab = usable[0]?.tab || null;
  if (!tab && required) throw makeError(`没有找到已打开的 ${origin} 后台标签页。`, 'PLATFORM_TAB_NOT_FOUND');
  if (tab) await ensureTabReady(tab.id, origin);
  return tab;
}

function scorePlatformTabForSelection(tab, origin) {
  const url = String(tab.url || '');
  let score = 0;
  score += Number(tab.active) * 10000000000000;
  score += Number(tab.status === 'complete') * 100000000000;
  score += Number(!tab.discarded) * 1000000000;
  score += Number(tab.lastAccessed || 0);
  if (origin === DOUDIAN_ORIGIN) {
    // 优先选择真实后台页面；降低旧 JSON 接口页、登录中间页、ticket 页的优先级。
    if (/\/ffa\//i.test(url)) score += 900000000000;
    if (/\/ecomauth\/loginv1\/|\/governance\/shop\/experiencescore\/|\/product\/tcomment\//i.test(url)) score -= 800000000000;
    if (/\/login\/common|\/index\/login|passport.*login|ticket=|login\?/i.test(url)) score -= 900000000000;
  }
  if (origin === PDD_ORIGIN) {
    if (/^https:\/\/mms\.(pinduoduo|pdd)\.com\//i.test(url)) score += 800000000000;
    if (/\/janus\/api\/checkLogin|\/sydney\/api\/|\/chats\/csReportDetail/i.test(url)) score -= 600000000000;
    if (/login|passport/i.test(url)) score -= 700000000000;
  }
  return score;
}

async function ensureTabReady(tabId, label) {
  let tab = await chrome.tabs.get(tabId);
  if (tab.discarded) {
    await chrome.tabs.reload(tabId);
    tab = await chrome.tabs.get(tabId);
  }
  if (tab.status === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(makeError(`${label} 页面加载超时，请刷新页面后重试。`, 'TAB_TIMEOUT'));
    }, 15000);
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}




async function readJsonDocumentFromTab(tabId, runId, label) {
  assertRunActive(runId);
  const expression = `(() => {
    const text = (document.body && (document.body.innerText || document.body.textContent)) || '';
    return {
      href: location.href,
      title: document.title || '',
      contentType: document.contentType || '',
      text: String(text).slice(0, 2000000),
      via: 'cdp-only'
    };
  })()`;
  return await cdpRuntimeEvaluate(tabId, runId, `read json document ${label || ''}`, expression) || {};
}




async function fetchJsonByCurrentTabNavigation(url, runId, tabId, label, restoreUrl) {
  assertRunActive(runId);
  const debugLabel = label || endpointLabel(url);
  const beforeTab = await chrome.tabs.get(tabId).catch(() => null);
  const beforeUrl = String(beforeTab?.url || '');
  const shouldRestore = restoreUrl !== false;
  const targetRestoreUrl = shouldRestore ? (restoreUrl || (beforeUrl.startsWith(DOUDIAN_ORIGIN) ? beforeUrl : DOUDIAN_HOME)) : '';
  addDebugLog('current-tab-json.start', { label: debugLabel, tabId, url, restoreUrl: targetRestoreUrl || false });
  try {
    await navigateTabAndWait(tabId, url, runId, debugLabel);
    await sleepWithCancellation(300, runId);
    const payload = await readJsonDocumentFromTab(tabId, runId, debugLabel);
    const rawText = String(payload.text || '').trim();
    let json = null;
    try {
      json = JSON.parse(rawText);
    } catch (error) {
      addDebugLog('current-tab-json.parse.failed', {
        label: debugLabel,
        href: payload.href || '',
        contentType: payload.contentType || '',
        title: payload.title || '',
        via: payload.via || '',
        textHead: rawText.slice(0, 500)
      });
      throw makeError(`${debugLabel}失败：当前标签页没有返回 JSON。`, 'INVALID_RESPONSE');
    }
    addDebugLog('current-tab-json.success', {
      label: debugLabel,
      href: payload.href || '',
      via: payload.via || '',
      code: json?.code,
      st: json?.st,
      msg: json?.msg || json?.message || '',
      subjectCount: Array.isArray(json?.data?.login_subject_list) ? json.data.login_subject_list.length : undefined
    });
    return json;
  } catch (error) {
    addDebugLog('current-tab-json.failed', { label: debugLabel, tabId, code: error?.code || '', message: error?.message || String(error) });
    throw error;
  } finally {
    if (shouldRestore && targetRestoreUrl) {
      try {
        addDebugLog('current-tab-json.restore.start', { label: debugLabel, tabId, restoreUrl: targetRestoreUrl });
        await navigateTabAndWait(tabId, targetRestoreUrl, runId, '恢复抖店首页');
        await sleepWithCancellation(900, runId);
        addDebugLog('current-tab-json.restore.ok', { label: debugLabel, tabId });
      } catch (restoreError) {
        addDebugLog('current-tab-json.restore.failed', { label: debugLabel, tabId, message: restoreError?.message || String(restoreError) });
      }
    }
  }
}

async function fetchJsonByBackground(url, runId, label) {
  assertRunActive(runId);
  const debugLabel = label || endpointLabel(url);
  addDebugLog('background-fetch.start', { label: debugLabel, url });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      referrer: DOUDIAN_HOME,
      headers: { Accept: 'application/json, text/plain, */*' },
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); }
    catch {
      addDebugLog('background-fetch.parse.failed', { label: debugLabel, status: response.status, textHead: text.slice(0, 500) });
      throw makeError(`${debugLabel}失败：后台请求没有返回 JSON。`, 'INVALID_RESPONSE');
    }
    addDebugLog('background-fetch.success', {
      label: debugLabel,
      status: response.status,
      code: json?.code,
      st: json?.st,
      msg: json?.msg || json?.message || '',
      subjectCount: Array.isArray(json?.data?.login_subject_list) ? json.data.login_subject_list.length : undefined
    });
    return json;
  } catch (error) {
    const message = error?.name === 'AbortError' ? '请求超时' : (error?.message || String(error));
    addDebugLog('background-fetch.failed', { label: debugLabel, message });
    throw makeError(`${debugLabel}后台请求失败：${message}`, error?.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'REQUEST_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonByTemporaryTab(url, runId, openerTabId, label) {
  assertRunActive(runId);
  const debugLabel = label || endpointLabel(url);
  addDebugLog('navigation-json.start', { label: debugLabel, openerTabId, url, mode: 'warm-home-then-json' });
  let tempTab = null;
  try {
    const opener = openerTabId ? await chrome.tabs.get(openerTabId).catch(() => null) : null;

    // V0.4.9：不要直接创建到接口 JSON 地址。抖店登录主体接口直接作为新标签页 URL 时，
    // 部分环境会被浏览器/站点直接标记 Blocked。先打开抖店首页预热页面上下文，
    // 再在这个非激活临时标签页中跳转接口 URL，成功率更接近“人工打开后台后访问接口”。
    tempTab = await chrome.tabs.create({
      url: DOUDIAN_HOME,
      active: false,
      ...(opener?.windowId ? { windowId: opener.windowId } : {})
    });
    addDebugLog('navigation-json.warm-home.start', { label: debugLabel, tempTabId: tempTab.id, home: DOUDIAN_HOME });
    await ensureTabReady(tempTab.id, `${debugLabel}预热首页`);
    await sleepWithCancellation(1200, runId);
    addDebugLog('navigation-json.warm-home.ok', { label: debugLabel, tempTabId: tempTab.id });

    await navigateTabAndWait(tempTab.id, url, runId, debugLabel);
    await sleepWithCancellation(300, runId);
    assertRunActive(runId);

    const payload = await readJsonDocumentFromTab(tempTab.id, runId, debugLabel);
    const rawText = String(payload.text || '').trim();
    let json = null;
    try {
      json = JSON.parse(rawText);
    } catch (error) {
      addDebugLog('navigation-json.parse.failed', {
        label: debugLabel,
        href: payload.href || '',
        contentType: payload.contentType || '',
        title: payload.title || '',
        via: payload.via || '',
        textHead: rawText.slice(0, 500)
      });
      throw makeError(`${debugLabel}失败：临时当前标签页没有返回 JSON。`, 'INVALID_RESPONSE');
    }
    addDebugLog('navigation-json.success', {
      label: debugLabel,
      href: payload.href || '',
      via: payload.via || '',
      code: json?.code,
      st: json?.st,
      msg: json?.msg || json?.message || '',
      subjectCount: Array.isArray(json?.data?.login_subject_list) ? json.data.login_subject_list.length : undefined
    });
    return json;
  } catch (error) {
    addDebugLog('navigation-json.failed', { label: debugLabel, code: error?.code || '', message: error?.message || String(error), mode: 'warm-home-then-json' });
    throw error;
  } finally {
    if (tempTab?.id) {
      try { await chrome.tabs.remove(tempTab.id); } catch {}
    }
  }
}

async function getCookieValue(origin, name) {
  try {
    const cookie = await chrome.cookies.get({ url: `${origin}/`, name });
    return cookie?.value || '';
  } catch {
    return '';
  }
}

async function pageRequest(tabId, request, runId) {
  assertRunActive(runId);
  const requestId = `${runId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const run = activeRuns.get(runId);
  run.activeRequests.set(requestId, tabId);

  const headers = { ...(request.headers || {}) };
  if (request.weixinBizMagic) {
    const bizMagic = await getCookieValue(WEIXIN_ORIGIN, 'biz_magic');
    if (!bizMagic) throw makeError('微信小店登录状态已失效，请重新扫码登录。', 'NOT_LOGGED_IN');
    headers.biz_magic = bizMagic;
  }

  const payload = {
    requestId,
    registryKey: ABORT_REGISTRY_KEY,
    timeoutMs: REQUEST_TIMEOUT_MS,
    url: request.url,
    method: request.method || 'GET',
    body: request.body || null,
    referrer: request.referrer || '',
    headers
  };

  const label = request.debugLabel || endpointLabel(request.url);
  addDebugLog('request.start', { label, tabId, method: payload.method, url: payload.url, referrer: payload.referrer, headers, body: request.body || null });
  try {
    const first = await executeRequestInTab(tabId, payload, 'MAIN');
    addDebugLog('request.result.main', { label, result: summarizeResponseForDebug(first) });
    assertRunActive(runId);
    if (first?.aborted) {
      const runNow = activeRuns.get(runId);
      throw makeError(runNow?.cancelled ? (runNow.cancelReason || '采集已停止') : '接口请求超时。', runNow?.cancelled ? 'COLLECTION_CANCELLED' : 'REQUEST_TIMEOUT');
    }
    if (first && !(first.status === 0 && /Blocked|Failed to fetch|NetworkError|Load failed|XHR_NETWORK_ERROR/i.test(String(first.error || '')))) {
      return first;
    }

    // 抖店页面可能改写 MAIN world 的 fetch/XMLHttpRequest 并返回 Blocked。
    // 使用 ISOLATED world 再试一次，避开页面脚本 hook，但仍在同一标签页上下文执行。
    const second = await executeRequestInTab(tabId, payload, 'ISOLATED').catch(error => ({ status: 0, ok: false, error: error?.message || String(error), json: null, text: '', contentType: '', transport: 'isolated-exception' }));
    addDebugLog('request.result.isolated', { label, result: summarizeResponseForDebug(second) });
    assertRunActive(runId);
    if (second?.aborted) {
      const runNow = activeRuns.get(runId);
      throw makeError(runNow?.cancelled ? (runNow.cancelReason || '采集已停止') : '接口请求超时。', runNow?.cancelled ? 'COLLECTION_CANCELLED' : 'REQUEST_TIMEOUT');
    }
    if (second && !(second.status === 0 && !second.json && !second.text)) return second;
    return first || second;
  } catch (error) {
    addDebugLog('request.exception', { label, code: error.code || '', message: error.message || String(error) });
    throw error;
  } finally {
    const runNow = activeRuns.get(runId);
    runNow?.activeRequests.delete(requestId);
    finishRunIfIdle(runId);
  }
}

async function executeRequestInTab(tabId, payload, world) {
  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world,
    args: [payload],
    func: async payload => {
      let registry = window[payload.registryKey];
      if (!(registry instanceof Map)) {
        registry = new Map();
        try { Object.defineProperty(window, payload.registryKey, { configurable: true, enumerable: false, writable: true, value: registry }); } catch { window[payload.registryKey] = registry; }
      }
      const controller = new AbortController();
      registry.set(payload.requestId, controller);
      const timeout = setTimeout(() => controller.abort('timeout'), payload.timeoutMs);
      const cleanHeaders = { ...(payload.headers || {}) };
      delete cleanHeaders['Cache-Control'];
      delete cleanHeaders['cache-control'];
      delete cleanHeaders.Pragma;
      delete cleanHeaders.pragma;
      async function parseFetchResponse(response, transport) {
        const text = await response.text();
        let json = null;
        try { json = JSON.parse(text); } catch {}
        return {
          status: response.status,
          ok: response.ok,
          redirected: response.redirected,
          url: response.url,
          contentType: response.headers.get('content-type') || '',
          text: text.slice(0, 2000000),
          json,
          transport
        };
      }
      function createNativeWindow() {
        if (!/^https:\/\/fxg\.jinritemai\.com\//i.test(payload.url || '')) return window;
        try {
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'display:none!important;width:0;height:0;border:0;position:absolute;left:-9999px;top:-9999px;';
          iframe.setAttribute('aria-hidden', 'true');
          iframe.src = 'about:blank';
          (document.documentElement || document.body).appendChild(iframe);
          const nativeWindow = iframe.contentWindow || window;
          setTimeout(() => { try { iframe.remove(); } catch {} }, payload.timeoutMs + 1000);
          return nativeWindow;
        } catch {
          return window;
        }
      }
      async function doFetch(fetchWindow, transport) {
        const response = await fetchWindow.fetch(payload.url, {
          method: payload.method,
          headers: cleanHeaders,
          body: payload.body,
          credentials: 'include',
          cache: 'no-store',
          redirect: 'follow',
          // V0.3.4：V0.2.1 可以成功的关键之一是带 referrer。
          // V0.3.2/0.3.3 在重写请求通道时遗漏了 referrer，抖店部分接口会直接返回/抛出 Blocked。
          referrer: payload.referrer || undefined,
          signal: controller.signal
        });
        return parseFetchResponse(response, transport);
      }
      function doXhr(xhrWindow, transport, fetchError) {
        return new Promise(resolve => {
          const XhrCtor = xhrWindow.XMLHttpRequest || XMLHttpRequest;
          const xhr = new XhrCtor();
          let finished = false;
          const done = value => {
            if (finished) return;
            finished = true;
            resolve(value);
          };
          try {
            xhr.open(payload.method, payload.url, true);
            xhr.withCredentials = true;
            xhr.timeout = payload.timeoutMs;
            for (const [key, value] of Object.entries(cleanHeaders)) {
              try { xhr.setRequestHeader(key, value); } catch {}
            }
            xhr.onload = () => {
              const text = String(xhr.responseText || '');
              let json = null;
              try { json = JSON.parse(text); } catch {}
              done({
                status: xhr.status,
                ok: xhr.status >= 200 && xhr.status < 300,
                redirected: false,
                url: xhr.responseURL || payload.url,
                contentType: xhr.getResponseHeader('content-type') || '',
                text: text.slice(0, 2000000),
                json,
                transport,
                fetchError
              });
            };
            xhr.onerror = () => done({ status: 0, ok: false, contentType: '', text: '', json: null, error: `XHR_NETWORK_ERROR; fetch=${fetchError || ''}`, transport });
            xhr.ontimeout = () => done({ status: 0, ok: false, contentType: '', text: '', json: null, aborted: true, error: '请求已停止或超时', transport });
            xhr.onabort = () => done({ status: 0, ok: false, contentType: '', text: '', json: null, aborted: true, error: '请求已停止或超时', transport });
            xhr.send(payload.body || null);
          } catch (xhrError) {
            done({ status: 0, ok: false, contentType: '', text: '', json: null, error: `${xhrError?.message || xhrError}; fetch=${fetchError || ''}`, transport });
          }
        });
      }
      try {
        let lastFetchError = '';
        const nativeWindow = createNativeWindow();
        if (nativeWindow !== window) {
          try {
            return await doFetch(nativeWindow, `${world.toLowerCase()}-iframe-fetch`);
          } catch (fetchError) {
            lastFetchError = fetchError?.message || String(fetchError);
          }
          const iframeXhr = await doXhr(nativeWindow, `${world.toLowerCase()}-iframe-xhr`, lastFetchError);
          if (!(iframeXhr.status === 0 && /Blocked|XHR_NETWORK_ERROR|Failed to fetch|NetworkError/i.test(String(iframeXhr.error || '')))) {
            return iframeXhr;
          }
          lastFetchError = iframeXhr.error || lastFetchError;
        }
        try {
          return await doFetch(window, `${world.toLowerCase()}-fetch`);
        } catch (fetchError) {
          lastFetchError = fetchError?.message || String(fetchError);
        }
        return await doXhr(window, `${world.toLowerCase()}-xhr`, lastFetchError);
      } catch (error) {
        const aborted = error?.name === 'AbortError';
        return { status: 0, ok: false, contentType: '', text: '', json: null, aborted, error: aborted ? '请求已停止或超时' : (error?.message || String(error)), transport: `${world.toLowerCase()}-exception` };
      } finally {
        clearTimeout(timeout);
        try { registry.delete(payload.requestId); } catch {}
      }
    }
  });
  const result = injectionResults?.[0]?.result;
  if (!result) throw makeError('无法在平台页面执行请求，请刷新后台页面后重试。', 'INJECTION_FAILED');
  return result;
}

function requireSuccessfulApi(response, label) {
  if (response.error) {
    const detail = [response.error, response.transport ? `transport=${response.transport}` : '', response.url ? `url=${response.url}` : ''].filter(Boolean).join('；');
    throw classifyApiError(`${label}失败：${detail}`, response.error);
  }
  if (!response.ok) {
    if (response.status === 401) throw makeError(`${label}失败：HTTP 401，登录状态失效。`, 'NOT_LOGGED_IN');
    if (response.status === 403) throw makeError(`${label}失败：HTTP 403，当前账号可能没有权限。`, 'PERMISSION_DENIED');
    throw makeError(`${label}失败：HTTP ${response.status}`, 'HTTP_ERROR');
  }
  if (!response.json) {
    const looksLikeHtml = /<html|<!doctype/i.test(response.text || '') || /text\/html/i.test(response.contentType || '');
    if (looksLikeHtml) throw makeError(`${label}失败：接口返回了页面内容，登录状态可能已失效。`, 'NOT_LOGGED_IN');
    throw makeError(`${label}失败：接口未返回 JSON。`, 'INVALID_RESPONSE');
  }
  const json = response.json;
  if (json.code !== undefined && Number(json.code) !== 0) {
    const message = String(json.msg || json.message || json.description || '接口返回失败');
    throw classifyApiError(`${label}失败：code=${json.code}，${message}`, message);
  }
  if (json.errno !== undefined && Number(json.errno) !== 0) {
    const message = String(json.msg || json.message || json.description || '接口返回失败');
    throw classifyApiError(`${label}失败：errno=${json.errno}，${message}`, message);
  }
  if (json.st !== undefined && Number(json.st) !== 0) {
    const message = String(json.msg || json.message || json.description || '接口返回失败');
    throw classifyApiError(`${label}失败：st=${json.st}，${message}`, message);
  }
  return json;
}

function classifyApiError(message, raw) {
  if (/登录|login|session|auth|cookie|扫码|未登录|过期/i.test(raw)) return makeError(message, 'NOT_LOGGED_IN');
  if (/权限|无权|未授权|permission|forbidden|denied|access|拒绝/i.test(raw)) return makeError(message, 'PERMISSION_DENIED');
  if (/timeout|超时/i.test(raw)) return makeError(message, 'REQUEST_TIMEOUT');
  return makeError(message, 'API_REJECTED');
}

async function sleepWithCancellation(milliseconds, runId) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    assertRunActive(runId);
    await sleep(Math.min(100, deadline - Date.now()));
  }
  assertRunActive(runId);
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)));
}

function makeError(message, code) {
  const error = new Error(message);
  error.code = code || 'ERROR';
  return error;
}
