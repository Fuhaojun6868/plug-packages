'use strict';

const Shared = window.MultiCollectorShared;
const CACHE_KEY = 'multiPlatformCollectorCache.v0.9.11';
const SYNC_SETTINGS_KEY = 'jiuanCollectorSyncSettings.v0.9.11';
const AUTO_SETTINGS_KEY = 'jiuanCollectorAutoSettings.v0.9.11';
const AUTO_TRIGGER_KEY = 'jiuanCollectorAutoTrigger.v0.9.11';
const COLLECTING_LOCK_KEY = 'jiuanCollectorCollectingLock.v0.9.11';
const ROLE_SETTINGS_KEY = 'jiuanCollectorRoleSettings.v0.9.11';
const ROLE_CONFIG_PATH = 'config/collector-role.config.json';
const COLLECTING_LOCK_TIMEOUT_MS = 60 * 60 * 1000;
const LEGACY_AUTO_SETTINGS_KEYS = ['jiuanCollectorAutoSettings.v0.9.6', 'jiuanCollectorAutoSettings.v0.9.3', 'jiuanCollectorAutoSettings.v0.9.2', 'jiuanCollectorAutoSettings.v0.9.1', 'jiuanCollectorAutoSettings.v0.9.0', 'jiuanCollectorAutoSettings.v0.8.13', 'jiuanCollectorAutoSettings.v0.8.12'];
const LEGACY_SYNC_SETTINGS_KEYS = ['jiuanCollectorSyncSettings.v0.9.6', 'jiuanCollectorSyncSettings.v0.9.5', 'jiuanCollectorSyncSettings.v0.9.3', 'jiuanCollectorSyncSettings.v0.9.2', 'jiuanCollectorSyncSettings.v0.9.1', 'jiuanCollectorSyncSettings.v0.9.0', 'jiuanCollectorSyncSettings.v0.8.13', 'jiuanCollectorSyncSettings.v0.8.12', 'jiuanCollectorSyncSettings.v0.8.11', 'jiuanCollectorSyncSettings.v0.8.10', 'jiuanCollectorSyncSettings.v0.8.9', 'jiuanCollectorSyncSettings.v0.8.8', 'jiuanCollectorSyncSettings.v0.8.7', 'jiuanCollectorSyncSettings.v0.8.6', 'jiuanCollectorSyncSettings.v0.8.5', 'jiuanCollectorSyncSettings.v0.8.4', 'jiuanCollectorSyncSettings.v0.8.1'];
const COLLECTOR_VERSION = '0.9.11';
const LEGACY_CACHE_KEYS = ['multiPlatformCollectorCache.v0.9.6', 'multiPlatformCollectorCache.v0.9.5', 'multiPlatformCollectorCache.v0.9.3', 'multiPlatformCollectorCache.v0.9.2', 'multiPlatformCollectorCache.v0.9.1', 'multiPlatformCollectorCache.v0.9.0', 'multiPlatformCollectorCache.v0.8.13', 'multiPlatformCollectorCache.v0.8.12', 'multiPlatformCollectorCache.v0.8.11', 'multiPlatformCollectorCache.v0.8.10', 'multiPlatformCollectorCache.v0.8.9', 'multiPlatformCollectorCache.v0.8.8', 'multiPlatformCollectorCache.v0.8.7', 'multiPlatformCollectorCache.v0.8.6', 'multiPlatformCollectorCache.v0.8.5', 'multiPlatformCollectorCache.v0.8.2', 'multiPlatformCollectorCache.v0.8.0', 'multiPlatformCollectorCache.v0.7.6', 'multiPlatformCollectorCache.v0.7.5', 'multiPlatformCollectorCache.v0.7.4', 'multiPlatformCollectorCache.v0.7.3', 'multiPlatformCollectorCache.v0.7.2', 'multiPlatformCollectorCache.v0.7.0', 'multiPlatformCollectorCache.v0.6.8', 'multiPlatformCollectorCache.v0.6.0', 'multiPlatformCollectorCache.v0.5.8', 'multiPlatformCollectorCache.v0.3.6', 'multiPlatformCollectorCache.v0.3.1', 'multiPlatformCollectorCache.v0.3.0', 'multiPlatformCollectorCache.v0.2.9', 'multiPlatformCollectorCache.v0.2.8', 'multiPlatformCollectorCache.v0.2.7', 'multiPlatformCollectorCache.v0.2.6', 'multiPlatformCollectorCache.v0.2.5', 'multiPlatformCollectorCache.v0.2.4', 'multiPlatformCollectorCache.v0.2.3', 'multiPlatformCollectorCache.v0.2.2', 'multiPlatformCollectorCache.v0.2.1', 'multiPlatformCollectorCache.v0.2.0', 'multiPlatformCollectorCache.v0.1.0'];
const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_TOTAL_FAILURES = 5;
const FATAL_ERROR_CODES = new Set(['NOT_LOGGED_IN', 'PERMISSION_DENIED', 'PLATFORM_TAB_NOT_FOUND', 'COLLECTION_CANCELLED', 'DATA_MISMATCH', 'SWITCH_NOT_CONFIRMED']);
const DOUDIAN_BATCH_SHOP_DELAY_MS = [500, 1000];
const DOUDIAN_BATCH_REST_MS = [1000, 2000];

const COLLECT_ROLES = [
  { id: 'customer_report', code: 1, name: '客服-数据报表', description: '客服数据、体验分、售后质量等经营数据报表。', enabledDefault: true, supported: true, platformLocked: false },
  { id: 'finance_withdraw', code: 2, name: '财务-提现账单', description: '财务提现、结算、资金账单采集角色。', enabledDefault: true, supported: false, platformLocked: true },
  { id: 'finance_tax', code: 3, name: '财务-涉税账单', description: '涉税账单、税期、结算金额、退款金额采集角色。', enabledDefault: true, supported: false, platformLocked: true }
];
const ROLE_BY_ID = Object.fromEntries(COLLECT_ROLES.map(role => [role.id, role]));
const ROLE_BY_CODE = Object.fromEntries(COLLECT_ROLES.map(role => [String(role.code), role]));
const DEFAULT_ROLE_ID = 'customer_report';

const state = {
  environment: null,
  collecting: false,
  stopRequested: false,
  currentRunId: '',
  activeRuns: {},
  stopRequestedByPlatform: {},
  progressByPlatform: {},
  failuresByPlatform: {},
  failures: [],
  lastCollectedAt: '',
  results: { weixin_shop: [], doudian: [], pdd: [] },
  lastRunSummary: '',
  debugEnabled: false,
  debugLogs: [],
  debugTimer: null,
  progressDock: { dragging: false, dragReady: false, pressActive: false, dragTimer: null, dx: 0, dy: 0, userExpanded: false, userPositioned: false, justDragged: false },
  debugMode: false,
  syncSettings: { apiUrl: '', token: '' },
  syncing: false,
  autoSettings: defaultAutoCollectSettings(),
  roleConfig: defaultRoleConfig(),
  roleAutoSettings: {},
  activeRole: DEFAULT_ROLE_ID,
  autoPanelExpanded: false,
  autoRunning: false,
  autoLastStatus: {},
  autoStatusRefreshTimer: null,
  collectingLock: null,
};

let syncResultAutoCloseTimer = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

init();

async function init() {
  chrome.runtime.connect({ name: 'dashboard-lifetime' });
  state.debugMode = isDebugModeFromUrl();
  applyDebugModeVisibility();
  bindEvents();
  await loadCache();
  await loadSyncSettings();
  await loadRoleConfig();
  await loadAutoCollectSettings();
  await getCollectingLock();
  await refreshEnvironment();
  await refreshDebugLogs();
  renderAll();
  renderProgressCards();
  await consumePendingAutoCollectTrigger('init');
  startAutoCollectLiveRefresh();
}



function bindEvents() {
  $('#btnRefreshEnv').addEventListener('click', refreshEnvironment);
  $('#btnOpenWeixin').addEventListener('click', () => sendMessage({ type: 'OPEN_PLATFORM', platform: 'weixin_shop' }).then(refreshEnvironment));
  $('#btnOpenDoudian').addEventListener('click', () => sendMessage({ type: 'OPEN_PLATFORM', platform: 'doudian' }).then(refreshEnvironment));
  $('#btnOpenPdd').addEventListener('click', () => sendMessage({ type: 'OPEN_PLATFORM', platform: 'pdd' }).then(refreshEnvironment));
  $('#btnCollectWeixin').addEventListener('click', () => collectPlatform('weixin_shop'));
  $('#btnCollectDoudian').addEventListener('click', () => collectPlatform('doudian'));
  $('#btnCollectPdd').addEventListener('click', () => collectPlatform('pdd'));
  $('#btnCollectAll').addEventListener('click', collectAllAvailable);
  $('#btnStop').addEventListener('click', () => requestStop('用户手动停止'));
  $('#btnExportCsv').addEventListener('click', exportCsv);
  $('#btnExportJson').addEventListener('click', exportJson);
  $('#btnSyncAll').addEventListener('click', syncAllToOperationSystem);
  const closeSyncResult = $('#btnCloseSyncResult');
  if (closeSyncResult) closeSyncResult.addEventListener('click', hideSyncResultModal);
  const syncModal = $('#syncResultModal');
  if (syncModal) {
    syncModal.addEventListener('mouseenter', clearSyncResultAutoClose);
    syncModal.addEventListener('mouseleave', () => scheduleSyncResultAutoClose(syncModal.dataset.status || ''));
    syncModal.addEventListener('toggle', event => {
      if (!event.target?.classList?.contains('sync-result-raw')) return;
      if (event.target.open) clearSyncResultAutoClose();
      else scheduleSyncResultAutoClose(syncModal.dataset.status || '');
    }, true);
  }
  $('#btnSaveSyncSettings').addEventListener('click', saveSyncSettingsFromForm);
  $('#btnTestSyncSettings').addEventListener('click', testSyncSettings);
  const syncToggle = $('#btnToggleSyncSettings');
  if (syncToggle) syncToggle.addEventListener('click', toggleSyncSettingsPanel);
  const autoToggle = $('#btnToggleAutoCollect');
  if (autoToggle) autoToggle.addEventListener('click', toggleAutoCollectPanel);
  $$('.role-button').forEach(button => button.addEventListener('click', () => setActiveRole(button.dataset.role)));
  const roleCollect = $('#btnCollectCurrentRole');
  if (roleCollect) roleCollect.addEventListener('click', runCurrentRoleManualCollect);
  const scheduleType = $('#autoScheduleType');
  if (scheduleType) scheduleType.addEventListener('change', updateScheduleVisibility);
  const dayMode = $('#autoDayMode');
  if (dayMode) dayMode.addEventListener('change', updateScheduleVisibility);
  const autoSave = $('#btnSaveAutoCollect');
  if (autoSave) autoSave.addEventListener('click', saveAutoCollectSettingsFromForm);
  const autoRunNow = $('#btnRunAutoNow');
  if (autoRunNow) autoRunNow.addEventListener('click', () => runAutoCollectNow('manual'));
  const autoNotice = $('#btnTestAutoNotice');
  if (autoNotice) autoNotice.addEventListener('click', testAutoCollectNotification);
  const autoKeepAliveNow = $('#btnRunKeepAliveNow');
  if (autoKeepAliveNow) autoKeepAliveNow.addEventListener('click', () => runPlatformKeepAliveNow('manual'));
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[ROLE_SETTINGS_KEY]?.newValue) {
      const roleStore = changes[ROLE_SETTINGS_KEY].newValue || {};
      if (roleStore.roles && typeof roleStore.roles === 'object') {
        Object.entries(roleStore.roles).forEach(([roleId, cfg]) => {
          const rid = normalizeRoleId(roleId);
          state.roleAutoSettings[rid] = normalizeAutoCollectSettings(cfg, rid);
        });
      }
      if (roleStore.activeRole) state.activeRole = normalizeRoleId(roleStore.activeRole);
      syncActiveRoleSettings();
      renderAutoCollectPanel();
    }
    if (changes[AUTO_SETTINGS_KEY]?.newValue) {
      state.roleAutoSettings[DEFAULT_ROLE_ID] = normalizeAutoCollectSettings(changes[AUTO_SETTINGS_KEY].newValue, DEFAULT_ROLE_ID);
      syncActiveRoleSettings();
      renderAutoCollectPanel();
    }
    if (changes[COLLECTING_LOCK_KEY]) {
      void getCollectingLock().then(() => renderAutoCollectPanel()).catch(() => {});
    }
    if (changes[AUTO_TRIGGER_KEY]?.newValue) {
      void consumePendingAutoCollectTrigger('storage-change');
    }
  });
  window.addEventListener('resize', () => {
    if (!$('#syncResultModal')?.classList.contains('hidden')) placeSyncResultModal();
    if (state.progressDock.userPositioned) clampProgressDockPosition();
    else positionProgressDockDefault();
  });
  $('#btnCopyApiStats').addEventListener('click', copyApiStats);
  $('#btnClearCache').addEventListener('click', clearCache);
  $('#debugEnabled').addEventListener('change', toggleDebugEnabled);
  $('#btnCopyDebug').addEventListener('click', copyDebugLogs);
  $('#btnExportDebug').addEventListener('click', exportDebugLogs);
  $('#btnClearDebug').addEventListener('click', clearDebugLogs);
  $('#btnProgressCollapse').addEventListener('click', toggleProgressCollapse);
  bindProgressDockDrag();
  $('#btnBackTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => $('#btnBackTop').classList.toggle('show', window.scrollY > 420));
  $$('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
}

function switchTab(name) {
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
  $$('.tab-panel').forEach(panel => panel.classList.add('hidden'));
  $(`#tab-${name}`).classList.remove('hidden');
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!response?.ok) {
        const error = new Error(response?.message || '扩展请求失败');
        error.code = response?.code || 'EXTENSION_ERROR';
        return reject(error);
      }
      resolve(response);
    });
  });
}


function todayDebugCode() {
  const now = new Date();
  const day = now.getDate();
  const jsWeek = now.getDay();
  const week = jsWeek === 0 ? 7 : jsWeek;
  return `${day}${week}`;
}

function isDebugModeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('debug') === todayDebugCode();
  } catch {
    return false;
  }
}

function applyDebugModeVisibility() {
  document.body.classList.toggle('debug-mode', state.debugMode);
  const badge = $('#debugModeBadge');
  if (badge) {
    badge.classList.toggle('hidden', !state.debugMode);
    badge.textContent = state.debugMode ? `调试模式 ${todayDebugCode()}` : '调试模式';
  }
  if (!state.debugMode) {
    const active = $('.tab.active');
    if (active && (active.dataset.tab === 'raw' || active.dataset.tab === 'debug')) switchTab('overview');
  }
}

function hasAnyCollectedData() {
  return (state.results.weixin_shop?.length || 0) + (state.results.doudian?.length || 0) + (state.results.pdd?.length || 0) > 0;
}


async function toggleDebugEnabled() {
  state.debugEnabled = $('#debugEnabled').checked;
  try { await sendMessage({ type: 'SET_DEBUG_ENABLED', enabled: state.debugEnabled }); } catch {}
  if (state.debugEnabled) startDebugPolling();
  else stopDebugPolling();
  await refreshDebugLogs();
}

function startDebugPolling() {
  stopDebugPolling();
  state.debugTimer = setInterval(() => { void refreshDebugLogs(); }, 1200);
}

function stopDebugPolling() {
  if (state.debugTimer) clearInterval(state.debugTimer);
  state.debugTimer = null;
}

async function refreshDebugLogs() {
  try {
    const res = await sendMessage({ type: 'GET_DEBUG_LOGS' });
    state.debugEnabled = Boolean(res.debugEnabled);
    state.debugLogs = res.logs || [];
    const cb = $('#debugEnabled');
    if (cb) cb.checked = state.debugEnabled;
    renderDebugLogs();
  } catch {}
}

function renderDebugLogs() {
  const el = $('#debugLog');
  if (!el) return;
  el.textContent = JSON.stringify(state.debugLogs || [], null, 2);
}

async function copyDebugLogs() {
  await refreshDebugLogs();
  const text = JSON.stringify(state.debugLogs || [], null, 2);
  try {
    await navigator.clipboard.writeText(text);
    setMainStatus('调试日志已复制。');
  } catch {
    setMainStatus('复制失败，可切换到“调试日志”手动复制。');
  }
}

async function exportDebugLogs() {
  await refreshDebugLogs();
  const blob = new Blob([JSON.stringify(state.debugLogs || [], null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `multi-platform-debug-${dateStamp()}.json`);
}

async function clearDebugLogs() {
  try { await sendMessage({ type: 'CLEAR_DEBUG_LOGS' }); } catch {}
  state.debugLogs = [];
  renderDebugLogs();
  setMainStatus('调试日志已清空。');
}

function createRunId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function refreshEnvironment() {
  setEnvBadge('weixin', 'checking', '检测中');
  setEnvBadge('doudian', 'checking', '检测中');
  setEnvBadge('pdd', 'checking', '检测中');
  state.environment = null;
  updateCollectButtonsByEnvironment();
  try {
    const env = await sendMessage({ type: 'GET_ENVIRONMENT' });
    state.environment = env;
    $('#pluginBadge').textContent = `插件 v${env.plugin?.pluginVersion || '-'}`;
    $('#pluginBadge').className = 'badge online';
    setEnvBadge('weixin', env.weixin_shop?.loggedIn ? 'online' : 'offline', env.weixin_shop?.loggedIn ? '已登录' : (env.weixin_shop?.tabFound ? '未登录' : '未打开'));
    setEnvBadge('doudian', env.doudian?.loggedIn ? 'online' : 'offline', env.doudian?.loggedIn ? `已登录(${env.doudian.subjectCount || 0})` : (env.doudian?.tabFound ? '未登录/已过期' : '未打开'));
    setEnvBadge('pdd', env.pdd?.loggedIn ? 'online' : 'offline', env.pdd?.loggedIn ? '已登录' : (env.pdd?.tabFound ? '未登录' : '未打开'));
    updateCollectButtonsByEnvironment();
    return env;
  } catch (error) {
    state.environment = null;
    $('#pluginBadge').textContent = '检测失败';
    $('#pluginBadge').className = 'badge offline';
    setEnvBadge('weixin', 'offline', '检测失败');
    setEnvBadge('doudian', 'offline', '检测失败');
    setEnvBadge('pdd', 'offline', '检测失败');
    updateCollectButtonsByEnvironment();
    return null;
  }
}

function setEnvBadge(platform, className, text) {
  const el = $(`#env-${platform}`);
  if (!el) return;
  el.className = `status-badge ${className}`;
  el.textContent = text;
}

function platformEnvKey(platform) {
  return platform === 'weixin' ? 'weixin_shop' : platform;
}

function isPlatformLoggedIn(env, platform) {
  const key = platformEnvKey(platform);
  return Boolean(env?.[key]?.loggedIn);
}

function isAnyCollecting() {
  return Object.keys(state.activeRuns || {}).length > 0;
}

function isPlatformCollecting(platform) {
  return Boolean(state.activeRuns?.[platform]);
}

function currentRunIdFor(platform) {
  return state.activeRuns?.[platform] || '';
}


async function getCollectingLock() {
  try {
    const stored = await chrome.storage.local.get([COLLECTING_LOCK_KEY]);
    const lock = stored[COLLECTING_LOCK_KEY];
    if (!lock || typeof lock !== 'object' || !lock.running) return null;
    const startedAt = Number(lock.startedAt || 0);
    if (startedAt && Date.now() - startedAt > COLLECTING_LOCK_TIMEOUT_MS) {
      await chrome.storage.local.remove(COLLECTING_LOCK_KEY);
      state.collectingLock = null;
      return null;
    }
    state.collectingLock = lock;
    return lock;
  } catch {
    return state.collectingLock || null;
  }
}

async function acquireCollectingLock(task = {}) {
  const current = await getCollectingLock();
  if (current || isAnyCollecting()) {
    const name = current?.platform ? platformName(current.platform) : (current?.mode === 'multi' ? '多平台采集' : '采集任务');
    return { ok: false, message: `当前已有${name}正在执行，请等待完成后再操作。`, lock: current };
  }
  const lock = {
    running: true,
    runId: task.runId || createRunId(),
    source: task.source || 'manual',
    mode: task.mode || 'single',
    platform: task.platform || '',
    startedAt: Date.now(),
    startedAtText: new Date().toISOString()
  };
  state.collectingLock = lock;
  await chrome.storage.local.set({ [COLLECTING_LOCK_KEY]: lock });
  return { ok: true, lock };
}

async function releaseCollectingLock(lock = null) {
  try {
    const current = await getCollectingLock();
    if (!current) return;
    if (lock?.runId && current.runId && current.runId !== lock.runId) return;
    await chrome.storage.local.remove(COLLECTING_LOCK_KEY);
  } catch {
    try { await chrome.storage.local.remove(COLLECTING_LOCK_KEY); } catch {}
  } finally {
    state.collectingLock = null;
  }
}

function describeCollectingTask(lock) {
  if (!lock) return '当前已有采集任务正在执行，请等待完成后再操作。';
  if (lock.platform) return `当前正在采集${platformName(lock.platform)}，请等待完成后再操作。`;
  return '当前正在执行多平台采集，请等待完成后再操作。';
}

function isPlatformStopRequested(platform) {
  return Boolean(state.stopRequestedByPlatform?.[platform]);
}

function updateCollectButtonsByEnvironment() {
  const env = state.environment || {};
  setPlatformCollectButton('weixin', '#btnCollectWeixin', env.weixin_shop, 'weixin_shop');
  setPlatformCollectButton('doudian', '#btnCollectDoudian', env.doudian, 'doudian');
  setPlatformCollectButton('pdd', '#btnCollectPdd', env.pdd, 'pdd');
  const busy = isAnyCollecting();
  const runnableLoggedIn = !busy && Boolean(
    env.weixin_shop?.loggedIn ||
    env.doudian?.loggedIn ||
    env.pdd?.loggedIn
  );
  const allButton = $('#btnCollectAll');
  if (allButton) {
    allButton.disabled = !runnableLoggedIn;
    allButton.title = runnableLoggedIn
      ? '采集当前检测到的已登录平台'
      : (busy ? '当前已有采集任务正在执行，请等待完成' : '没有检测到已登录平台，请先登录后台并重新检测');
  }
  const stop = $('#btnStop');
  if (stop) stop.classList.toggle('hidden', !isAnyCollecting());
  updateExportButtons();
}

function setPlatformCollectButton(cardKey, buttonSelector, envInfo, platform) {
  const button = $(buttonSelector);
  const card = $(`#card-${cardKey}`);
  const loggedIn = Boolean(envInfo?.loggedIn);
  const tabFound = Boolean(envInfo?.tabFound);
  const running = isPlatformCollecting(platform);
  const busy = isAnyCollecting();
  if (button) {
    button.disabled = !loggedIn || busy;
    button.classList.toggle('running', running);
    button.classList.toggle('ready', loggedIn && !busy);
    button.classList.toggle('waiting', !loggedIn);
    button.textContent = running ? `${platformName(platform)}采集中` : (busy ? '采集锁定中' : `采集${platformName(platform)}`);
    button.title = busy ? '当前已有采集任务正在执行，不能重复采集或启动其他平台采集' : (loggedIn ? '登录状态有效，可以采集' : (tabFound ? '检测到后台标签页，但未登录或登录已过期' : '未检测到后台标签页，请先打开并登录后台'));
  }
  if (card) card.classList.toggle('disabled-card', !loggedIn);
}

async function collectAllAvailable() {
  return collectSelectedPlatforms(['weixin_shop', 'doudian', 'pdd'], { source: 'manual-all' });
}

async function collectSelectedPlatforms(candidatePlatforms, options = {}) {
  let taskLock = null;
  if (!options.lockAcquired) {
    const acquired = await acquireCollectingLock({ source: options.source || (options.auto ? 'auto' : 'manual'), mode: 'multi' });
    if (!acquired.ok) {
      const msg = acquired.message || describeCollectingTask(acquired.lock);
      setMainStatus(msg);
      setAutoStatus(msg, 'warn');
      return { ok: false, platforms: [], missing: [], message: msg, locked: true };
    }
    taskLock = acquired.lock;
  }
  try {
  const env = await refreshEnvironment();
  const wanted = (Array.isArray(candidatePlatforms) ? candidatePlatforms : [])
    .filter(platform => ['weixin_shop', 'doudian', 'pdd'].includes(platform));
  const platforms = [];
  const missing = [];
  for (const platform of wanted) {
    if (isPlatformLoggedIn(env, platform) && !isPlatformCollecting(platform)) platforms.push(platform);
    else if (!isPlatformLoggedIn(env, platform)) missing.push(platform);
  }
  if (!platforms.length) {
    const msg = isAnyCollecting()
      ? '已登录平台正在采集中。'
      : `没有检测到可自动采集的平台${missing.length ? `：${missing.map(platformName).join('、')} 未登录或登录已过期` : ''}。`;
    setMainStatus(msg);
    return { ok: false, platforms: [], missing, message: msg };
  }
  state.failures = [];
  for (const p of platforms) state.failuresByPlatform[p] = [];
  const prefix = options.auto ? '自动采集' : '开始并行采集';
  setMainStatus(`${prefix} ${platforms.map(platformName).join('、')}。`);
  expandProgressDock();
  const settled = await Promise.allSettled(platforms.map(platform => collectPlatform(platform, { keepFailures: true, skipLoginCheck: true, fromCollectAll: true, auto: Boolean(options.auto), lockAcquired: true })));
  const rejected = settled.filter(item => item.status === 'rejected').length;
  return { ok: rejected === 0, platforms, missing, rejected };
  } finally {
    if (taskLock) await releaseCollectingLock(taskLock);
  }
}

async function collectPlatform(platform, options = {}) {
  let taskLock = null;
  if (!options.lockAcquired) {
    const acquired = await acquireCollectingLock({ source: options.source || (options.auto ? 'auto' : 'manual'), mode: 'single', platform });
    if (!acquired.ok) {
      const msg = acquired.message || describeCollectingTask(acquired.lock);
      setMainStatus(msg);
      return { ok: false, platform, locked: true, message: msg };
    }
    taskLock = acquired.lock;
  }
  if (isPlatformCollecting(platform)) {
    const msg = `${platformName(platform)}正在采集，请等待完成后再操作。`;
    setMainStatus(msg);
    if (taskLock) await releaseCollectingLock(taskLock);
    return { ok: false, platform, locked: true, message: msg };
  }
  if (!options.skipLoginCheck) {
    setMainStatus(`正在校验${platformName(platform)}登录状态…`);
    const env = await refreshEnvironment();
    if (!isPlatformLoggedIn(env, platform)) {
      setMainStatus(`${platformName(platform)}未登录或登录已过期，请先打开后台登录后再重新检测。`);
      updateCollectButtonsByEnvironment();
      if (taskLock) await releaseCollectingLock(taskLock);
      return { ok: false, platform, message: `${platformName(platform)}未登录或登录已过期` };
    }
  }
  expandProgressDock();
  if (!options.keepFailures) state.failures = [];
  state.failuresByPlatform[platform] = [];
  const runId = createRunId();
  state.activeRuns[platform] = runId;
  state.stopRequestedByPlatform[platform] = false;
  state.collecting = true;
  state.stopRequested = false;
  state.currentRunId = runId;
  updateCollectButtonsByEnvironment();
  if (state.debugEnabled) startDebugPolling();

  try {
    await sendMessage({ type: 'START_RUN', runId, platform });
    if (platform === 'weixin_shop') await collectWeixin(runId);
    else if (platform === 'doudian') await collectDoudian(runId);
    else if (platform === 'pdd') await collectPdd(runId);
    else throw new Error('平台未接入');
  } catch (error) {
    const msg = `${platformName(platform)}：${error.message || error}`;
    state.failures.push(msg);
    (state.failuresByPlatform[platform] ||= []).push(msg);
    updateProgress({ platform, current: 0, total: 0, success: 0, fail: 1, status: 'failed', text: error.message || String(error) });
    setMainStatus(`${platformName(platform)}采集失败：${error.message || error}`);
    await refreshDebugLogs();
  } finally {
    try { await sendMessage({ type: 'STOP_RUN', runId, reason: '任务结束' }); } catch {}
    delete state.activeRuns[platform];
    delete state.stopRequestedByPlatform[platform];
    state.collecting = isAnyCollecting();
    state.stopRequested = false;
    if (state.currentRunId === runId) state.currentRunId = '';
    updateCollectButtonsByEnvironment();
    renderAll();
    await refreshDebugLogs();
    if (!state.debugEnabled && !isAnyCollecting()) stopDebugPolling();
    await saveCache();
    if (taskLock) await releaseCollectingLock(taskLock);
  }
}

async function collectWeixin(runId) {
  const platform = 'weixin_shop';
  state.results.weixin_shop = [];
  state.lastCollectedAt = '';
  renderAll();
  await saveCache();
  updateProgress({ platform, current: 0, total: 0, success: 0, fail: 0, status: 'running', text: '已清空微信小店旧数据，正在获取店铺列表…' });
  const shopResponse = await sendMessage({ type: 'GET_WEIXIN_SHOPS', runId });
  const shops = dedupeWeixinShops(shopResponse.shops || []);

  let success = 0, fail = 0, consecutive = 0;
  for (let i = 0; i < shops.length; i++) {
    if (isPlatformStopRequested(platform)) break;
    const shop = shops[i];
    updateProgress({ platform, current: i + 1, total: shops.length, success, fail, status: 'running', text: `微信小店：${shop.name || shop.appid}` });
    try {
      const response = await sendMessage({ type: 'COLLECT_WEIXIN_STORE', runId, appid: shop.appid });
      upsertWeixinResult({ ...response, shop: mergeShop(shop, response.shop) });
      success += 1;
      consecutive = 0;
      state.lastCollectedAt = new Date().toISOString();
      setMainStatus(`微信小店已采集 ${success}/${shops.length}`);
      renderAll();
      await saveCache();
    } catch (error) {
      fail += 1;
      consecutive += 1;
      const msg = `${shop.name || shop.appid}：${error.message || error}`;
      state.failures.push(msg);
      (state.failuresByPlatform[platform] ||= []).push(msg);
      const reason = stopReasonForError(error, consecutive, fail);
      updateProgress({ platform, current: i + 1, total: shops.length, success, fail, status: reason ? 'stopped' : 'running', text: reason || msg });
      if (reason) {
        await requestStop(reason, platform);
        break;
      }
    }
  }
  const status = isPlatformStopRequested(platform) ? 'stopped' : 'completed';
  updateProgress({ platform, current: shops.length, total: shops.length, success, fail, status, text: status === 'completed' ? '微信小店采集完成' : '微信小店采集已停止' });
  setMainStatus(`微信小店采集结束：成功 ${success}，失败 ${fail}`);
}

function dedupeWeixinShops(shops = []) {
  const seen = new Set();
  const result = [];
  for (const shop of shops || []) {
    const key = String(shop?.appid || shop?.shopId || shop?.name || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(shop);
  }
  return result;
}

function weixinResultKey(item) {
  return String(item?.shop?.appid || item?.shop?.shopId || item?.shop?.name || '').trim();
}

function upsertWeixinResult(item) {
  const key = weixinResultKey(item);
  if (!key) {
    state.results.weixin_shop.push(item);
    return;
  }
  const index = (state.results.weixin_shop || []).findIndex(existing => weixinResultKey(existing) === key);
  if (index >= 0) state.results.weixin_shop[index] = item;
  else state.results.weixin_shop.push(item);
}

function isBatchSafeModeEnabled() {
  const el = $('#batchSafeMode');
  return !el || el.checked;
}

function randomIntBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function interruptibleDelay(milliseconds, label, progress = {}, platform = '') {
  const endAt = Date.now() + Math.max(0, milliseconds);
  while (!(platform ? isPlatformStopRequested(platform) : state.stopRequested) && Date.now() < endAt) {
    const left = Math.ceil((endAt - Date.now()) / 1000);
    if (label) {
      updateProgress({ ...progress, status: 'running', text: `${label}，剩余约 ${left} 秒…` });
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(1000, Math.max(120, endAt - Date.now()))));
  }
}

async function applyDoudianBatchDelay(index, total, success, fail, subject) {
  const platform = 'doudian';
  if (!isBatchSafeModeEnabled() || isPlatformStopRequested(platform)) return;
  const shopName = subject?.shopName || subject?.shopId || `第 ${index + 1} 家`;
  if (index > 0) {
    const restMs = randomIntBetween(DOUDIAN_BATCH_REST_MS[0], DOUDIAN_BATCH_REST_MS[1]);
    await interruptibleDelay(restMs, `批量安全模式：上一家已完成，自动休息后继续采集 ${shopName}`, { platform, current: index, total, success, fail }, platform);
    if (isPlatformStopRequested(platform)) return;
    const gapMs = randomIntBetween(DOUDIAN_BATCH_SHOP_DELAY_MS[0], DOUDIAN_BATCH_SHOP_DELAY_MS[1]);
    await interruptibleDelay(gapMs, `批量安全模式：店铺切换间隔，准备采集 ${shopName}`, { platform, current: index + 1, total, success, fail }, platform);
  }
}

async function collectDoudian(runId) {
  const platform = 'doudian';
  updateProgress({ platform, current: 0, total: 0, success: 0, fail: 0, status: 'running', text: '正在获取抖店主体列表…' });
  const { subjects } = await sendMessage({ type: 'GET_DOUDIAN_SUBJECTS', runId });
  const list = subjects.filter(item => item.canLogin !== false);
  state.results.doudian = [];
  await saveCache();

  let success = 0, fail = 0, consecutive = 0;
  for (let i = 0; i < list.length; i++) {
    if (isPlatformStopRequested(platform)) break;
    const subject = list[i];
    await applyDoudianBatchDelay(i, list.length, success, fail, subject);
    if (isPlatformStopRequested(platform)) break;
    updateProgress({ platform, current: i + 1, total: list.length, success, fail, status: 'running', text: `抖店：${subject.shopName || subject.shopId}` });
    try {
      const response = await sendMessage({ type: 'COLLECT_DOUDIAN_SUBJECT', runId, subject });
      const duplicate = findSuspiciousDoudianDuplicate(response);
      if (duplicate) {
        const error = new Error(`疑似切店未生效：${response.shop?.shopName || subject.shopName || subject.shopId} 返回的数据与已采集的 ${duplicate.shop?.shopName || duplicate.shop?.shopId} 完全一致。为避免串店，已停止后续请求。`);
        error.code = 'DATA_MISMATCH';
        throw error;
      }
      state.results.doudian.push(response);
      success += 1;
      consecutive = 0;
      state.lastCollectedAt = new Date().toISOString();
      setMainStatus(`抖店已采集 ${success}/${list.length}`);
      renderAll();
      await saveCache();
    } catch (error) {
      fail += 1;
      consecutive += 1;
      const msg = `${subject.shopName || subject.shopId}：${error.message || error}`;
      state.failures.push(msg);
      (state.failuresByPlatform[platform] ||= []).push(msg);
      const reason = stopReasonForError(error, consecutive, fail);
      updateProgress({ platform, current: i + 1, total: list.length, success, fail, status: reason ? 'stopped' : 'running', text: reason || msg });
      if (reason) {
        await requestStop(reason, platform);
        break;
      }
    }
  }
  const status = isPlatformStopRequested(platform) ? 'stopped' : 'completed';
  updateProgress({ platform, current: list.length, total: list.length, success, fail, status, text: status === 'completed' ? '抖店采集完成' : '抖店采集已停止' });
  setMainStatus(`抖店采集结束：成功 ${success}，失败 ${fail}`);
}

async function collectPdd(runId) {
  const platform = 'pdd';
  updateProgress({ platform, current: 0, total: 1, success: 0, fail: 0, status: 'running', text: '正在采集拼多多当前店铺数据…' });
  state.results.pdd = [];
  await saveCache();
  try {
    const response = await sendMessage({ type: 'COLLECT_PDD_CURRENT', runId });
    state.results.pdd.push(response);
    state.lastCollectedAt = new Date().toISOString();
    updateProgress({ platform, current: 1, total: 1, success: 1, fail: 0, status: 'completed', text: '拼多多采集完成' });
    setMainStatus('拼多多当前店铺采集完成');
    renderAll();
    await saveCache();
  } catch (error) {
    const msg = `拼多多：${error.message || error}`;
    state.failures.push(msg);
    (state.failuresByPlatform[platform] ||= []).push(msg);
    updateProgress({ platform, current: 1, total: 1, success: 0, fail: 1, status: 'failed', text: msg });
    throw error;
  }
}


function findSuspiciousDoudianDuplicate(current) {
  const currentFp = buildDoudianFingerprint(current);
  if (!currentFp) return null;
  const currentShopId = String(current?.shop?.shopId || current?.shop?.subjectId || '').trim();
  const currentShopName = String(current?.shop?.shopName || '').trim();
  for (const previous of state.results.doudian || []) {
    const previousFp = buildDoudianFingerprint(previous);
    if (!previousFp || previousFp !== currentFp) continue;
    const previousShopId = String(previous?.shop?.shopId || previous?.shop?.subjectId || '').trim();
    const previousShopName = String(previous?.shop?.shopName || '').trim();
    const differentId = currentShopId && previousShopId && currentShopId !== previousShopId;
    const differentName = currentShopName && previousShopName && currentShopName !== previousShopName;
    if (differentId || differentName) return previous;
  }
  return null;
}

function buildDoudianFingerprint(item) {
  if (!item) return '';
  const o = item.experienceOverview?.data || {};
  const s = item.serviceSubScore?.data || {};
  const c = item.commentStatistics?.data || {};
  const serviceItems = (s.items || []).map(x => [x.nodeId, x.score, x.weight, x.weightedScore, x.rawValue, x.numeratorValue, x.denominatorValue].join(':')).join('|');
  const parts = [
    o.experienceScore, o.goodsScore, o.logisticsScore, o.serviceScore, o.badBehaviorDeductScore,
    s.shopId, s.servicePreviewScore, serviceItems,
    c.positiveRate30d, c.neutralRate30d, c.negativeRate30d, c.positiveCount30d, c.neutralCount30d, c.negativeCount30d
  ].map(v => v === null || v === undefined ? '' : String(v));
  const meaningful = parts.filter(Boolean).length >= 4;
  return meaningful ? JSON.stringify(parts) : '';
}

function stopReasonForError(error, consecutiveFailures, totalFailures) {
  if (FATAL_ERROR_CODES.has(error.code)) return error.message || '采集已停止';
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return `已连续失败 ${consecutiveFailures} 家，达到安全阈值，已停止后续请求。`;
  if (totalFailures >= MAX_TOTAL_FAILURES) return `本次累计失败 ${totalFailures} 家，达到安全阈值，已停止后续请求。`;
  return '';
}

async function requestStop(reason, platform = '') {
  if (platform) {
    state.stopRequestedByPlatform[platform] = true;
    const runId = state.activeRuns?.[platform];
    if (runId) {
      try { await sendMessage({ type: 'STOP_RUN', runId, reason }); } catch {}
    }
  } else {
    state.stopRequested = true;
    const entries = Object.entries(state.activeRuns || {});
    for (const [p, runId] of entries) {
      state.stopRequestedByPlatform[p] = true;
      try { await sendMessage({ type: 'STOP_RUN', runId, reason }); } catch {}
    }
  }
  setMainStatus(reason || '采集已停止');
  updateCollectButtonsByEnvironment();
}

function setCollectingUI() {
  updateCollectButtonsByEnvironment();
  updateExportButtons();
}

function updateProgress({ platform, current, total, success, fail, status, text }) {
  const key = platform || 'unknown';
  state.progressByPlatform[key] = { platform: key, current, total, success, fail, status, text, updatedAt: Date.now() };
  renderProgressCards();
}

function renderProgressCards() {
  const panel = $('#progressPanel');
  const cardsBox = $('#progressCards');
  if (!panel || !cardsBox) return;
  const entries = Object.values(state.progressByPlatform || {})
    .sort((a, b) => platformOrder(a.platform) - platformOrder(b.platform));
  panel.classList.remove('hidden');
  const running = isAnyCollecting();
  const overallPercent = calculateOverallProgress(entries);
  panel.classList.toggle('collecting', running);
  panel.classList.toggle('idle', !running);
  panel.classList.toggle('empty', !entries.length);
  const hasFailed = entries.some(item => item.status === 'failed' || item.status === 'stopped');
  panel.classList.toggle('has-error', hasFailed);
  const isCollapsed = panel.classList.contains('collapsed');
  const actionText = isCollapsed ? '双击展开，长按拖拽' : '双击收起，长按拖拽';
  const progressStateText = running ? `采集中｜整体进度 ${overallPercent}%` : (entries.length ? '可重复采集' : '待采集');
  $('#progressTitle').textContent = running ? '多平台采集进度' : progressStateText;
  $('#progressText').textContent = `${progressStateText}｜${actionText}`;
  const miniText = $('#progressMiniText');
  const miniPercent = $('#progressMiniPercent');
  const miniTip = $('#progressMiniTip');
  if (miniText) miniText.textContent = '采集';
  if (miniPercent) miniPercent.textContent = running ? `${overallPercent}%` : '';
  if (miniTip) miniTip.textContent = '双击展开/长按拖拽';
  const btn = $('#btnProgressCollapse');
  if (btn) btn.textContent = isCollapsed ? '展开' : '收起';
  cardsBox.innerHTML = entries.length ? entries.map(item => renderProgressCard(item)).join('') : '<div class="progress-empty-card">暂无采集任务，点击平台采集后自动展开。</div>';
  requestAnimationFrame(() => {
    if (state.progressDock.userPositioned) clampProgressDockPosition();
    else positionProgressDockDefault();
  });
}

function calculateOverallProgress(entries = []) {
  const rows = entries.filter(item => item && Number(item.total || 0) > 0);
  if (!rows.length) return 0;
  const total = rows.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const done = rows.reduce((sum, item) => sum + Number(item.success || 0) + Number(item.fail || 0), 0);
  return Math.max(0, Math.min(100, Math.round(done / Math.max(total, 1) * 100)));
}

function platformOrder(platform) {
  return { weixin_shop: 1, doudian: 2, pdd: 3 }[platform] || 99;
}

function renderProgressCard(item) {
  const processed = Number(item.success || 0) + Number(item.fail || 0);
  const total = Number(item.total || 0);
  const percent = total > 0 ? Math.min(100, Math.round(processed / total * 100)) : 5;
  const statusText = item.status === 'running' ? '进行中' : item.status === 'completed' ? '完成' : item.status === 'failed' ? '失败' : '停止';
  const failures = state.failuresByPlatform?.[item.platform] || [];
  const failureHtml = failures.length ? `<div class="progress-card-failures">${failures.slice(-5).map(x => `<div>${escapeHtml(x)}</div>`).join('')}</div>` : '';
  return `<div class="progress-card ${escapeHtml(item.status || '')}">
    <div class="progress-card-head"><span class="progress-card-title">${platformName(item.platform)}</span><span class="progress-card-status">${statusText}</span></div>
    <div class="progress-card-text">${escapeHtml(item.text || '')}</div>
    <div class="progress-bar-track"><div class="progress-bar" style="width:${percent}%"></div></div>
    <div class="progress-card-summary">成功 ${escapeHtml(item.success || 0)}，失败 ${escapeHtml(item.fail || 0)}，已处理 ${processed}/${total || 0}</div>
    ${failureHtml}
  </div>`;
}

function renderFailures() {
  renderProgressCards();
}

function collapseProgressDock() {
  const panel = $('#progressPanel');
  if (!panel) return;
  panel.classList.add('collapsed');
  const btn = $('#btnProgressCollapse');
  if (btn) btn.textContent = '展开';
  state.progressDock.userExpanded = false;
  renderProgressCards();
  requestAnimationFrame(() => {
    if (state.progressDock.userPositioned) clampProgressDockPosition();
    else positionProgressDockDefault();
  });
}

function expandProgressDock() {
  const panel = $('#progressPanel');
  if (!panel) return;
  panel.classList.remove('collapsed');
  const btn = $('#btnProgressCollapse');
  if (btn) btn.textContent = '收起';
  state.progressDock.userExpanded = true;
  renderProgressCards();
  requestAnimationFrame(() => {
    if (state.progressDock.userPositioned) clampProgressDockPosition();
    else positionProgressDockDefault();
  });
}

function toggleProgressCollapse() {
  const panel = $('#progressPanel');
  if (!panel) return;
  if (panel.classList.contains('collapsed')) expandProgressDock();
  else collapseProgressDock();
}

function setProgressPanelInlinePosition(left, top) {
  const panel = $('#progressPanel');
  if (!panel) return;
  panel.style.setProperty('left', `${Math.round(left)}px`, 'important');
  panel.style.setProperty('top', `${Math.round(top)}px`, 'important');
  panel.style.setProperty('right', 'auto', 'important');
  panel.style.setProperty('bottom', 'auto', 'important');
}

function progressPanelSizeForPosition() {
  const panel = $('#progressPanel');
  if (!panel) return { width: 540, height: 140 };
  const isCollapsed = panel.classList.contains('collapsed');
  const preferredWidth = isCollapsed ? 168 : Math.min(540, Math.max(320, window.innerWidth - 32));
  const width = Math.max(preferredWidth, panel.offsetWidth || 0);
  const height = Math.max(isCollapsed ? 158 : 180, panel.offsetHeight || 0);
  return { width, height };
}

function defaultProgressDockPosition() {
  const app = $('.app-shell');
  const { width, height } = progressPanelSizeForPosition();
  const margin = 16;
  const appRect = app?.getBoundingClientRect();
  const defaultLeft = appRect ? appRect.right + 20 : window.innerWidth - width - 32;
  const left = Math.max(margin, Math.min(window.innerWidth - width - margin, defaultLeft));
  const preferredTop = Math.round(window.innerHeight * 0.36);
  const top = Math.max(margin, Math.min(window.innerHeight - height - margin, preferredTop));
  return { left, top };
}

function positionProgressDockDefault() {
  const pos = defaultProgressDockPosition();
  setProgressPanelInlinePosition(pos.left, pos.top);
}

function clampProgressDockPosition() {
  const panel = $('#progressPanel');
  if (!panel) return;
  const { width, height } = progressPanelSizeForPosition();
  const rect = panel.getBoundingClientRect();
  const margin = 8;
  const left = Math.max(margin, Math.min(window.innerWidth - width - margin, rect.left));
  const top = Math.max(margin, Math.min(window.innerHeight - height - margin, rect.top));
  setProgressPanelInlinePosition(left, top);
}

function bindProgressDockDrag() {
  const panel = $('#progressPanel');
  const handle = $('#progressDragHandle');
  if (!panel || !handle) return;

  const clearDragTimer = () => {
    if (state.progressDock.dragTimer) {
      clearTimeout(state.progressDock.dragTimer);
      state.progressDock.dragTimer = null;
    }
  };

  const beginPress = event => {
    if (event.target.closest('button')) return;
    state.progressDock.pressActive = true;
    state.progressDock.dragReady = false;
    state.progressDock.dragging = false;
    state.progressDock.justDragged = false;
    const rect = panel.getBoundingClientRect();
    state.progressDock.dx = event.clientX - rect.left;
    state.progressDock.dy = event.clientY - rect.top;
    clearDragTimer();
    state.progressDock.dragTimer = setTimeout(() => {
      if (!state.progressDock.pressActive) return;
      state.progressDock.dragReady = true;
      state.progressDock.dragging = true;
      state.progressDock.userPositioned = true;
      panel.classList.add('dragging');
      setProgressPanelInlinePosition(rect.left, rect.top);
    }, 250);
    try { handle.setPointerCapture?.(event.pointerId); } catch {}
  };

  const moveDrag = event => {
    if (!state.progressDock.pressActive || !state.progressDock.dragReady) return;
    const width = panel.offsetWidth || 360;
    const height = panel.offsetHeight || 120;
    state.progressDock.justDragged = true;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - state.progressDock.dx));
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - state.progressDock.dy));
    setProgressPanelInlinePosition(left, top);
    event.preventDefault();
  };

  const endPress = event => {
    clearDragTimer();
    state.progressDock.pressActive = false;
    state.progressDock.dragReady = false;
    state.progressDock.dragging = false;
    panel.classList.remove('dragging');
    try { handle.releasePointerCapture?.(event.pointerId); } catch {}
    setTimeout(() => { state.progressDock.justDragged = false; }, 120);
  };

  handle.addEventListener('pointerdown', beginPress);
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endPress);
  window.addEventListener('pointercancel', endPress);

  handle.addEventListener('dblclick', event => {
    if (event.target.closest('button')) return;
    event.preventDefault();
    clearDragTimer();
    toggleProgressCollapse();
  });
}

function setMainStatus(text) {
  state.lastRunSummary = text;
  $('#mainStatus').textContent = text;
}

function isWeakWeixinShopName(name, appid = '') {
  const text = String(name || '').trim();
  const id = String(appid || '').trim();
  if (!text) return true;
  if (id && text === id) return true;
  if (/^wx[a-z0-9_-]{8,}$/i.test(text)) return true;
  if (/^店铺\d+$/i.test(text)) return true;
  return false;
}

function chooseWeixinShopName(original, collected) {
  const appid = Shared.firstNonEmpty(original?.appid, original?.shopId, collected?.appid, collected?.shopId);
  const candidates = [collected?.name, collected?.shopName, original?.name, original?.shopName, appid];
  const strong = candidates.find(value => !isWeakWeixinShopName(value, appid));
  return Shared.firstNonEmpty(strong, ...candidates, appid);
}

function mergeShop(original, collected) {
  const appid = Shared.firstNonEmpty(original?.appid, original?.shopId, collected?.appid, collected?.shopId);
  return {
    ...original,
    ...collected,
    appid,
    shopId: appid,
    name: chooseWeixinShopName(original, collected),
    logo: Shared.firstNonEmpty(collected?.logo, original?.logo, collected?.shopLogo)
  };
}

function renderAll() {
  renderRoleSwitch();
  renderLatestTime();
  renderOverview();
  renderWeixin();
  renderDoudian();
  renderPdd();
  $('#rawJson').textContent = JSON.stringify({ lastCollectedAt: state.lastCollectedAt, results: state.results }, null, 2);
  renderDebugLogs();
  updateExportButtons();
}

function renderLatestTime() {
  $('#latestTime').textContent = state.lastCollectedAt ? formatDateTime(state.lastCollectedAt) : '暂无';
}

function renderOverview() {
  const wx = state.results.weixin_shop || [];
  const dd = state.results.doudian || [];
  const pdd = state.results.pdd || [];
  const pddStaffRows = pdd.reduce((sum, item) => sum + (item.customerServicePerformance?.data?.list?.length || 0), 0);
  const wxSalesRows = wx.reduce((sum, item) => sum + (item.kfSales?.list?.length || 0), 0);
  const wxReceptionRows = wx.reduce((sum, item) => sum + (item.kfReception?.list?.length || 0), 0);
  const ddCommentOk = dd.filter(item => item.commentStatistics?.ok).length;
  const ddStaffRows = dd.reduce((sum, item) => sum + (item.customerServiceStaff?.data?.list?.length || 0), 0);
  $('#overviewContent').innerHTML = `
    <div class="metric-grid">
      <div class="metric-card blue"><div class="label">微信小店店铺数</div><div class="value">${wx.length}</div></div>
      <div class="metric-card green"><div class="label">微信客服销售行数</div><div class="value">${wxSalesRows}</div></div>
      <div class="metric-card orange"><div class="label">微信客服接待行数</div><div class="value">${wxReceptionRows}</div></div>
      <div class="metric-card purple"><div class="label">抖店店铺数</div><div class="value">${dd.length}</div></div>
      <div class="metric-card blue"><div class="label">拼多多店铺数</div><div class="value">${pdd.length}</div></div>
    </div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>平台</th><th>采集店铺</th><th>关键数据</th><th>备注</th></tr></thead><tbody>
      <tr><td>微信小店</td><td>${wx.length}</td><td>诊断中心 ${wx.filter(x=>x.diagnosis?.ok).length} 组；体验分 ${wx.filter(x=>x.shopScore?.ok).length} 组；销售 ${wxSalesRows} 行；接待 ${wxReceptionRows} 行</td><td>诊断/体验分 + 昨日客服数据采集</td></tr>
      <tr><td>抖店</td><td>${dd.length}</td><td>体验分总览 ${dd.filter(x=>x.experienceOverview?.ok).length}；服务明细 ${dd.filter(x=>x.serviceSubScore?.ok).length}；评价概览 ${ddCommentOk}；客服 ${ddStaffRows} 行</td><td>店铺维度 + 昨日客服数据</td></tr>
      <tr><td>拼多多</td><td>${pdd.length}</td><td>服务体验 ${pdd.filter(x=>x.mallServeScore?.ok).length}；售后质量 ${pdd.filter(x=>x.saleQuality?.ok).length}；客服绩效 ${pddStaffRows} 行</td><td>当前店铺 + 昨日客服绩效</td></tr>
    </tbody></table></div>`;
}

function stripDateLabel(text) {
  return String(text || '').replace(/^\s*(请求时间|采集时间)\s*[=:：]\s*/u, '').trim();
}

function requestDateValue(meta) {
  const safeMeta = meta && typeof meta === 'object' ? meta : {};
  return stripDateLabel(safeMeta.display || yesterdayYmdFromNow());
}

function requestDateBadge(meta, options = {}) {
  const safeMeta = meta && typeof meta === 'object' ? meta : {};
  const display = requestDateValue(safeMeta);
  const responseDate = options.responseDate || safeMeta.responseDate || '';
  const responseLabel = options.responseLabel || safeMeta.responseLabel || '出参日期';
  const responseText = responseDate ? `<span class="date-chip response">${escapeHtml(responseLabel)}=${escapeHtml(responseDate)}</span>` : '';
  return `<span class="date-chip request">${escapeHtml(display)}</span>${responseText}`;
}

function requestDateText(meta) {
  return requestDateValue(meta);
}

function inlineDateChip(meta, extraClass = '') {
  return `<span class="date-chip request inline-date-chip ${escapeHtml(extraClass)}">${escapeHtml(requestDateValue(meta))}</span>`;
}

function yesterdayYmdFromNow() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function moduleDateLine(meta, options = {}) {
  return `<div class="module-date-line">${requestDateBadge(meta, options)}</div>`;
}

function renderWeixin() {
  const list = state.results.weixin_shop || [];
  if (!list.length) {
    $('#weixinContent').className = 'empty-state';
    $('#weixinContent').textContent = '暂无微信小店数据。';
    return;
  }
  $('#weixinContent').className = '';
  const cards = list.map((item, index) => renderWeixinDetails(item, index)).join('');
  $('#weixinContent').innerHTML = `<div class="section-title"><h3>微信小店店铺统计</h3><span class="tag">${list.length} 家</span></div><div class="weixin-store-list">${cards}</div>`;
}

function renderWeixinDetails(item, index = 0) {
  const shop = item.shop || {};
  const appid = shop.appid || shop.shopId || '';
  const shopName = chooseWeixinShopName(shop, {});
  const score = item.shopScore?.summary || {};
  const diagnosis = item.diagnosis?.summary || {};
  const sales = item.kfSales?.list || [];
  const reception = item.kfReception?.list || [];
  const summaryDate = requestDateText(item.shopScore?.dateMeta || item.diagnosis?.dateMeta);
  const receptionDate = inlineDateChip(item.kfReception?.dateMeta, 'title-date-chip');
  const salesDate = inlineDateChip(item.kfSales?.dateMeta, 'title-date-chip');
  const salesRows = sales.map(r => `<tr><td>${avatarCell(r.headUrl, r.displayName)}</td><td class="num">${escapeHtml(r.consultUserCount)}</td><td class="num">${escapeHtml(r.orderUserCount)}</td><td class="num">${escapeHtml(r.payUserCount)}</td><td class="num">${weixinPercent(r.conversionRate)}</td><td class="num">${weixinMoney(r.payGmv)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty-cell">暂无销售数据</td></tr>`;
  const receptionRows = reception.map(r => `<tr><td>${avatarCell(r.kfHeadImg, r.kfNickname)}</td><td class="num">${escapeHtml(r.userCount)}</td><td class="num">${escapeHtml(r.sessionCount)}</td><td class="num">${weixinPercent(r.replyRate)}</td><td class="num">${weixinSeconds(r.avgResponse)}</td><td class="num">${weixinPercent(r.unReplyRate)}</td><td class="num">${weixinPercent(r.satisfactionRate)}</td></tr>`).join('') || `<tr><td colspan="7" class="empty-cell">暂无接待数据</td></tr>`;
  return `<details class="weixin-shop-block" ${index === 0 ? 'open' : ''}>
    <summary>
      <div class="weixin-shop-summary-left">
        ${shopCell(shop.logo, shopName, appid)}
        <span class="date-chip request store-date-chip">${escapeHtml(summaryDate)}</span>
        <span class="tag">展开销售/接待数据</span>
      </div>
      <div class="weixin-summary-kpis">
        ${weixinSummaryPill('我的体验分', weixinDisplay(score.score), 'strong')}
        ${weixinSummaryPill('商品', weixinDisplay(score.goodsScore))}
        ${weixinSummaryPill('物流', weixinDisplay(score.logisticsScore))}
        ${weixinSummaryPill('服务', weixinDisplay(score.serviceScore))}
        ${weixinSummaryPill('品质退货率', weixinPercent(diagnosis.qualityReturnRate30d), 'warn')}
        ${weixinSummaryPill('差评率', weixinPercent(diagnosis.badEvaluateRate30d), 'warn')}
        ${weixinSummaryPill('纠纷发起率', weixinPercent(diagnosis.disputeInitiationRate30d), 'warn')}
      </div>
    </summary>
    <div class="weixin-kf-stack">
      <section class="weixin-kf-panel">
        <div class="section-title sub"><h3>客服考核-接待数据表 ${receptionDate}</h3><span class="tag">${reception.length} 行</span></div>
        <div class="data-table-wrap"><table class="data-table weixin-compact-table reception"><thead><tr><th>客服</th><th>咨询用户数</th><th>会话数</th><th>回复率</th><th>平均响应</th><th>未回复率</th><th>满意率</th></tr></thead><tbody>${receptionRows}</tbody></table></div>
      </section>
      <section class="weixin-kf-panel">
        <div class="section-title sub"><h3>客服考核-销售数据 ${salesDate}</h3><span class="tag">${sales.length} 行</span></div>
        <div class="data-table-wrap"><table class="data-table weixin-compact-table"><thead><tr><th>客服</th><th>询单人数</th><th>下单人数</th><th>成交人数</th><th>询单转化率</th><th>客服销售额</th></tr></thead><tbody>${salesRows}</tbody></table></div>
      </section>
    </div>
  </details>`;
}

function weixinSummaryPill(label, value, tone = '') {
  return `<span class="weixin-summary-pill ${tone}"><em>${escapeHtml(label)}</em><b>${escapeHtml(value || '--')}</b></span>`;
}

function weixinKpi(label, value, tone = '') {
  return `<div class="weixin-kpi ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '--')}</strong></div>`;
}

function weixinDisplay(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(String(value).replace(/,/g, '').trim());
  if (Number.isFinite(num)) return String(Math.round(num * 100) / 100);
  return escapeHtml(value);
}

function weixinPercent(value) {
  if (value === null || value === undefined || value === '') return '--';
  const text = String(value).trim();
  if (!text) return '--';
  if (text.includes('%')) return escapeHtml(text);
  const num = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(num)) return escapeHtml(text);
  const percent = Math.abs(num) > 1 ? num : num * 100;
  return `${Number(percent.toFixed(2)).toString()}%`;
}


function weixinSeconds(value) {
  if (value === null || value === undefined || value === '') return '--';
  const text = String(value).trim();
  if (!text) return '--';
  if (/秒|分|时/.test(text)) return escapeHtml(text);
  const num = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(num)) return escapeHtml(text);
  return `${Math.round(num)} 秒`;
}

function weixinMoney(value) {
  if (value === null || value === undefined || value === '') return '--';
  const text = String(value).trim();
  if (!text) return '--';
  if (/^¥/.test(text)) return escapeHtml(text);
  const num = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(num)) return escapeHtml(text);
  return `¥${Number(num.toFixed(2)).toLocaleString('zh-CN')}`;
}

function renderDoudian() {
  const list = state.results.doudian || [];
  if (!list.length) {
    $('#doudianContent').className = 'empty-state';
    $('#doudianContent').textContent = '暂无抖店数据。';
    return;
  }
  $('#doudianContent').className = '';
  const blocks = list.map((item, index) => renderDoudianShopBlock(item, index)).join('');
  $('#doudianContent').innerHTML = `<div class="section-title"><h3>抖店店铺数据</h3><span class="tag">${list.length} 家</span></div>${blocks}`;
}

function renderDoudianShopBlock(item, index = 0) {
  const shop = item.shop || {};
  const overview = item.experienceOverview?.data || {};
  const service = item.serviceSubScore?.data || {};
  const comment = item.commentStatistics?.data || {};
  const staff = item.customerServiceStaff?.data || {};
  const staffRows = renderDoudianStaffRows(staff.list || []);
  const serviceScore = scoreDisplay(overview.servicePreviewScore ?? service.servicePreviewScore);
  const commonDate = item.experienceOverview?.dateMeta || item.serviceSubScore?.dateMeta || item.commentStatistics?.dateMeta;
  const staffStatus = item.customerServiceStaff?.ok ? `${staff.list?.length || 0} 个客服` : `客服接口失败：${escapeHtml(item.customerServiceStaff?.error || '')}`;
  return `<details class="doudian-shop-block doudian-collapsible" ${index === 0 ? 'open' : ''}>
    <summary>
      <div class="doudian-summary-left">${shopCell(shop.shopLogo, shop.shopName, shop.shopId)}<span class="date-chip request store-date-chip">${escapeHtml(requestDateText(commonDate))}</span><span class="tag">展开/关闭</span></div>
      <div class="doudian-summary-kpis">
        ${weixinSummaryPill('我的体验分', scoreDisplay(overview.experienceScore), 'strong')}
        ${weixinSummaryPill('新服务体验得分', serviceScore, 'strong')}
        ${weixinSummaryPill('差评率', comment.negativeRate30d || '--', 'warn')}
        ${weixinSummaryPill('客服', `${staff.list?.length || 0} 人`)}
      </div>
    </summary>
    <section class="doudian-combined-card grouped">
      <div class="module-title-inline"><h3>体验分 / 服务 / 评价概览 <span class="date-chip request inline-date-chip title-date-chip">${escapeHtml(requestDateText(commonDate))}</span></h3></div>
      <div class="doudian-group-layout">
        <section class="doudian-group-card score-group">
          <h4>我的体验分</h4>
          <div class="experience-formula-box">
            <strong>${escapeHtml(scoreDisplay(overview.experienceScore))}</strong>
            <span>= <b>${escapeHtml(scoreDisplay(overview.goodsScore))}</b> <i>+</i> <b>${escapeHtml(scoreDisplay(overview.logisticsScore))}</b> <i>+</i> <b>${escapeHtml(scoreDisplay(overview.serviceScore))}</b> <i class="minus">-</i> <b class="deduct">${escapeHtml(scoreDisplay(overview.badBehaviorDeductScore))}</b></span>
          </div>
          <div class="experience-formula-label">我的体验分 = 商品体验分 + 物流体验分 + 服务体验分 - 差行为扣分</div>
          <div class="doudian-score-grid grouped-score experience-parts">
            ${doudianMetric('商品体验分', scoreDisplay(overview.goodsScore), 'goods')}
            ${doudianMetric('物流体验分', scoreDisplay(overview.logisticsScore), 'logistics')}
            ${doudianMetric('服务体验分', scoreDisplay(overview.serviceScore), 'service')}
            ${doudianMetric('差行为扣分', scoreDisplay(overview.badBehaviorDeductScore), 'warn')}
          </div>
        </section>
        <section class="doudian-group-card service-group">
          <h4>新服务体验得分</h4>
          <div class="service-formula-box">
            <strong>${escapeHtml(serviceScore)}</strong>
            <span>= ${escapeHtml(serviceItemScore(service, 322))} + ${escapeHtml(serviceItemScore(service, 316))} + ${escapeHtml(serviceItemScore(service, 317))} + ${escapeHtml(serviceItemScore(service, 318))}</span>
          </div>
          <div class="service-formula-label">新服务体验得分 = 飞鸽评价响应时长得分 + 售后平均审核时长得分 + 飞鸽会话不满意得分 + 平台求助率得分</div>
          <div class="doudian-score-grid grouped-score service-parts">
            ${doudianMetric('飞鸽评价响应时长', serviceItemScore(service, 322))}
            ${doudianMetric('售后平均审核时长', serviceItemScore(service, 316))}
            ${doudianMetric('飞鸽会话不满意', serviceItemScore(service, 317))}
            ${doudianMetric('平台求助率', serviceItemScore(service, 318))}
          </div>
        </section>
        <section class="doudian-group-card comment-group">
          <h4>评价概览数据</h4>
          <div class="doudian-score-grid grouped-score">
            ${doudianMetric('近30天好评率', comment.positiveRate30d || '--')}
            ${doudianMetric('近30天中评率', comment.neutralRate30d || '--')}
            ${doudianMetric('近30天差评率', comment.negativeRate30d || '--', 'warn')}
          </div>
        </section>
      </div>
    </section>
    <div class="section-title sub"><h3>客服数据 ${inlineDateChip(item.customerServiceStaff?.dateMeta, 'title-date-chip')}</h3><span class="tag">${staffStatus}</span></div>
    <div class="data-table-wrap"><table class="data-table staff-table staff-table-compact"><thead><tr>
      <th>客服账号</th><th>已接待人数</th><th>全天首响时长</th><th>工作时间3分钟回复率</th><th>全天3分钟回复率</th><th>服务问题会话数</th><th>询单人数</th><th>下单人数</th><th>支付人数</th><th>退款后销售额</th><th>询单转化率</th>
    </tr></thead><tbody>${staffRows}</tbody></table></div>
  </details>`;
}

function doudianMetric(label, value, tone = '') {
  return `<div class="doudian-metric ${tone}"><strong>${escapeHtml(value || '--')}</strong><span>${escapeHtml(label)}</span></div>`;
}

function serviceItemScore(service, nodeId) {
  const item = (service?.items || []).find(x => Number(x.nodeId) === Number(nodeId));
  return scoreDisplay(item?.score);
}

function scoreDisplay(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (Number.isFinite(num)) return String(Math.round(num * 100) / 100);
  return escapeHtml(value);
}

function renderDoudianStaffRows(list) {
  if (!list.length) return `<tr><td colspan="11" class="empty-cell">暂无客服明细数据</td></tr>`;
  return list.map(r => `<tr>
    <td>${escapeHtml(r.staffAccountName || r.staffNickName)}</td><td>${escapeHtml(r.servUserCnt)}</td><td>${escapeHtml(r.firstRespDuration)}</td><td>${escapeHtml(r.workTimeThreeMinRespRate)}</td><td>${escapeHtml(r.threeMinRespRate)}</td><td>${escapeHtml(r.servProblemConvCnt)}</td><td>${escapeHtml(r.inquiryCnt)}</td><td>${escapeHtml(r.orderCnt)}</td><td>${escapeHtml(r.payCnt)}</td><td class="money">${escapeHtml(r.afterRefundSaleAmount)}</td><td>${escapeHtml(r.inquiryOrderRate)}</td>
  </tr>`).join('');
}

function renderPdd() {
  const list = state.results.pdd || [];
  if (!list.length) {
    $('#pddContent').className = 'empty-state';
    $('#pddContent').textContent = '暂无拼多多数据。';
    return;
  }
  $('#pddContent').className = '';
  const blocks = list.map((item, index) => renderPddShopBlock(item, index)).join('');
  $('#pddContent').innerHTML = `<div class="section-title"><h3>拼多多店铺数据</h3><span class="tag">${list.length} 家</span></div>${blocks}`;
}

function renderPddShopBlock(item, index = 0) {
  const shop = item.shop || {};
  const serve = item.mallServeScore?.data || {};
  const sale = item.saleQuality?.data || {};
  const staff = item.customerServicePerformance?.data || {};
  const staffList = staff.list || [];
  const staffRows = renderPddStaffRows(staffList);
  const assessmentDate = serve.readyDate || item.mallServeScore?.dateMeta?.responseDate || '';
  const pddShopName = shop.shopName || (shop.shopId ? `拼多多店铺 ${shop.shopId}` : '当前拼多多店铺');
  return `<details class="pdd-shop-block pdd-collapsible" ${index === 0 ? 'open' : ''}>
    <summary>
      <div class="pdd-summary-left">${shopCell(shop.logo || '', pddShopName, shop.shopId || shop.mallId || '')}<span class="date-chip request store-date-chip">${escapeHtml(requestDateText(item.mallServeScore?.dateMeta || item.saleQuality?.dateMeta))}</span><span class="tag">展开/关闭</span></div>
      <div class="pdd-summary-kpis">
        ${weixinSummaryPill('消费者服务体验分', pddDisplay(serve.consumerServiceScore), 'strong')}
        ${weixinSummaryPill('纠纷退款率', pddDisplay(sale.disputeRefundRate), 'warn')}
        ${weixinSummaryPill('品质退款率', pddDisplay(sale.qualityRefundRate), 'warn')}
        ${weixinSummaryPill('客服', `${staffList.length || 0} 人`)}
      </div>
    </summary>
    <div class="pdd-module-grid">
      <section class="pdd-module pdd-module-score">
        <div class="pdd-module-head"><span>消费者服务体验分 ${inlineDateChip(item.mallServeScore?.dateMeta, 'title-date-chip')}</span>${assessmentDate ? `<small>上次评估时间=${escapeHtml(assessmentDate)}</small>` : ''}</div>
        <div class="pdd-main-number">${pddDisplay(serve.consumerServiceScore)}</div>
        <div class="pdd-kpi-grid compact">
          ${pddKpi('服务态度', serve.serviceAttitudeScore, 'strong')}
          ${pddKpi('基础服务', serve.baseServiceScore)}
          ${pddKpi('商品服务', serve.goodsServiceScore)}
          ${pddKpi('发货服务', serve.shippingServiceScore)}
          ${pddKpi('物流服务', serve.logisticsServiceScore)}
        </div>
      </section>

      <section class="pdd-module">
        <div class="pdd-module-head"><span>售后质量数据 ${inlineDateChip(item.saleQuality?.dateMeta, 'title-date-chip')}</span></div>
        <div class="pdd-highlight-row">
          <div><span>纠纷退款数</span><strong>${pddDisplay(sale.disputeRefundCount)}</strong></div>
          <div><span>品质退款数</span><strong>${pddDisplay(sale.qualityRefundCount)}</strong></div>
          <div><span>平台介入单</span><strong>${pddDisplay(sale.platformInterventionOrderCount)}</strong></div>
        </div>
        <div class="pdd-kpi-grid compact">
          ${pddKpi('纠纷退款率', sale.disputeRefundRate, 'warn')}
          ${pddKpi('平台介入率', sale.platformInterventionRate, 'warn')}
          ${pddKpi('品质退款率', sale.qualityRefundRate, 'warn')}
        </div>
      </section>
    </div>

    <div class="section-title sub pdd-staff-title"><h3>客服绩效详情 ${inlineDateChip(item.customerServicePerformance?.dateMeta, 'title-date-chip')}</h3><span class="tag">${staffList.length || 0} 个客服</span></div>
    <div class="data-table-wrap pdd-staff-wrap"><table class="data-table pdd-staff-table"><thead><tr>
      <th>客服账号</th><th>服务分</th><th>咨询</th><th>询单</th><th>成团</th><th>去退销售额</th><th>需人工回复</th><th>人工接待</th><th>3分钟未回</th><th>3分钟回复率</th><th>30秒应答率</th><th>平均响应</th>
    </tr></thead><tbody>${staffRows}</tbody></table></div>
  </details>`;
}

function renderPddStaffRows(list) {
  if (!list.length) return `<tr><td colspan="12" class="empty-cell">暂无客服绩效明细数据</td></tr>`;
  return list.map(r => `<tr>
    <td class="pdd-staff-account">${escapeHtml(r.csAccount)}</td><td class="num strong">${escapeHtml(r.customerServiceScore)}</td><td class="num">${escapeHtml(r.consultUserCount)}</td><td class="num">${escapeHtml(r.inquiryUserCount)}</td><td class="num">${escapeHtml(r.finalGroupUserCount)}</td><td class="num money">${escapeHtml(r.afterRefundSalesAmount)}</td><td class="num">${escapeHtml(r.needManualReplyConsultUserCount)}</td><td class="num">${escapeHtml(r.manualReceiveUserCount)}</td><td class="num warn">${escapeHtml(r.threeMinUnreplyUserCount)}</td><td class="num strong">${escapeHtml(r.threeMinManualReplyRate)}</td><td class="num">${escapeHtml(r.thirtySecondAnswerRate)}</td><td class="num">${escapeHtml(r.avgManualResponseDuration)}</td>
  </tr>`).join('');
}

function pddKpi(label, value, tone = '') {
  return `<div class="pdd-kpi ${tone}"><span>${escapeHtml(label)}</span><strong>${pddDisplay(value)}</strong></div>`;
}

function pddDisplay(value) {
  if (value === null || value === undefined || value === '') return '--';
  return escapeHtml(value);
}

function buildPddStaffStats(list) {
  const count = list.length;
  const sumField = field => list.reduce((sum, item) => sum + safeNumber(item?.[field]), 0);
  const avgRawPercent = field => {
    const nums = list.map(item => parsePercentText(item?.[field])).filter(Number.isFinite);
    if (!nums.length) return '--';
    return `${(nums.reduce((sum, n) => sum + n, 0) / nums.length).toFixed(2)}%`;
  };
  const avgSeconds = field => {
    const nums = list.map(item => parseSecondsText(item?.[field])).filter(Number.isFinite);
    if (!nums.length) return '--';
    const seconds = nums.reduce((sum, n) => sum + n, 0) / nums.length;
    return seconds >= 60 ? `${Math.round(seconds / 60 * 10) / 10}分钟` : `${Math.round(seconds)}秒`;
  };
  const scoreNums = list.map(item => toNumberOrNaN(item?.customerServiceScore)).filter(Number.isFinite);
  return {
    count,
    avgScore: scoreNums.length ? (scoreNums.reduce((sum, n) => sum + n, 0) / scoreNums.length).toFixed(1) : '--',
    consultTotal: sumField('consultUserCount'),
    avgThreeMinRate: avgRawPercent('threeMinManualReplyRate'),
    avgThirtySecondRate: avgRawPercent('thirtySecondAnswerRate'),
    avgResponseDuration: avgSeconds('avgManualResponseDuration')
  };
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/,/g, '').replace(/元|人|单|秒|分钟|%/g, '').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function toNumberOrNaN(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const normalized = String(value).replace(/,/g, '').replace(/元|人|单|秒|分钟|%/g, '').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : NaN;
}

function parsePercentText(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const num = Number(String(value).replace('%', '').trim());
  return Number.isFinite(num) ? num : NaN;
}

function parseSecondsText(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const text = String(value).trim();
  const minuteMatch = text.match(/^([\d.]+)\s*分钟$/);
  if (minuteMatch) return Number(minuteMatch[1]) * 60;
  const secondMatch = text.match(/^([\d.]+)\s*秒$/);
  if (secondMatch) return Number(secondMatch[1]);
  const num = Number(text);
  return Number.isFinite(num) ? num : NaN;
}

function shopCell(logo, name, id) {
  const safeName = escapeHtml(name || id || '--');
  const safeId = escapeHtml(id || '');
  const img = logo ? `<img class="shop-logo" src="${escapeHtml(logo)}" title="${safeId}" referrerpolicy="no-referrer">` : `<span class="shop-logo" title="${safeId}">店</span>`;
  return `<div class="shop-cell">${img}<div><div>${safeName}</div><small>${safeId}</small></div></div>`;
}

function avatarCell(logo, name) {
  const safeName = escapeHtml(name || '--');
  const img = logo ? `<img class="shop-logo" src="${escapeHtml(logo)}" referrerpolicy="no-referrer">` : `<span class="shop-logo">客</span>`;
  return `<div class="shop-cell">${img}<span>${safeName}</span></div>`;
}

async function loadCache() {
  const keys = [CACHE_KEY, ...LEGACY_CACHE_KEYS];
  const stored = await chrome.storage.local.get(keys);
  const cache = stored[CACHE_KEY] || LEGACY_CACHE_KEYS.map(key => stored[key]).find(value => value && typeof value === 'object');
  if (!cache || typeof cache !== 'object') return;
  state.results = cache.results || state.results;
  state.lastCollectedAt = cache.lastCollectedAt || '';
  state.lastRunSummary = cache.lastRunSummary || '';
  if (state.lastRunSummary) $('#mainStatus').textContent = state.lastRunSummary;
}

async function saveCache() {
  await chrome.storage.local.set({ [CACHE_KEY]: { results: state.results, lastCollectedAt: state.lastCollectedAt, lastRunSummary: state.lastRunSummary, savedAt: new Date().toISOString() } });
}

async function clearCache() {
  if (state.collecting) return;
  state.results = { weixin_shop: [], doudian: [], pdd: [] };
  state.lastCollectedAt = '';
  state.lastRunSummary = '本地缓存已清空';
  state.progressByPlatform = {};
  state.failuresByPlatform = {};
  await chrome.storage.local.remove(CACHE_KEY);
  setMainStatus('本地缓存已清空');
  renderAll();
  renderProgressCards();
}

function updateExportButtons() {
  const hasData = hasAnyCollectedData();
  $('#btnExportCsv').disabled = state.collecting || !hasData;
  $('#btnExportJson').disabled = state.collecting || !hasData;
  $('#btnCopyApiStats').disabled = !hasData;
  const syncButton = $('#btnSyncAll');
  if (syncButton) {
    const syncReady = String(state.syncSettings?.apiUrl || '').trim();
    syncButton.disabled = state.syncing || !hasData || !syncReady;
    syncButton.textContent = state.syncing ? '同步中…' : '同步运营系统';
    syncButton.title = !hasData ? '暂无采集数据' : (!String(state.syncSettings?.apiUrl || '').trim() ? '请先配置运营系统接口地址' : '一键同步当前所有平台采集数据');
  }
}


function normalizeSyncSettings(value = {}) {
  return {
    apiUrl: String(value.apiUrl || '').trim(),
    token: String(value.token || '').trim()
  };
}


async function loadReminders() {
  try {
    const response = await sendMessage({ type: 'LIST_REMINDERS' });
    state.reminders = Array.isArray(response.reminders) ? response.reminders : [];
  } catch (error) {
    console.warn('读取提醒列表失败', error);
    state.reminders = [];
  }
}

function toggleReminderPanel() {
  state.reminderPanelExpanded = !state.reminderPanelExpanded;
}

function renderReminders() {
  const panel = $('#reminderPanel');
  const body = $('#reminderBody');
  const btn = $('#btnToggleReminderPanel');
  const badge = $('#reminderCountBadge');
  const list = $('#reminderList');
  if (!panel || !body || !btn || !badge || !list) return;
  const reminders = Array.isArray(state.reminders) ? state.reminders.slice() : [];
  reminders.sort((a, b) => String(a.remindAt || '').localeCompare(String(b.remindAt || '')));
  const enabledCount = reminders.filter(item => item.enabled !== false).length;
  badge.textContent = `${reminders.length} 个提醒${enabledCount ? ` / ${enabledCount} 启用` : ''}`;
  panel.classList.toggle('collapsed', !state.reminderPanelExpanded);
  body.classList.toggle('hidden', !state.reminderPanelExpanded);
  btn.textContent = state.reminderPanelExpanded ? '收起' : '展开';
  list.innerHTML = reminders.length ? reminders.map(renderReminderItem).join('') : '<div class="reminder-empty">暂无提醒。可以添加“每天同步运营系统”“每周检查采集失败”等事项。</div>';
  list.querySelectorAll('[data-reminder-action]').forEach(el => {
    el.addEventListener('click', async () => {
      const action = el.dataset.reminderAction;
      const id = el.dataset.reminderId || '';
      if (!id) return;
      if (action === 'delete') await deleteReminder(id);
      if (action === 'toggle') await toggleReminderEnabled(id);
    });
  });
}

function renderReminderItem(item) {
  const title = item.title || '未命名提醒';
  const note = item.note || '';
  const time = formatReminderTime(item.remindAt);
  const freq = reminderFrequencyText(item.frequency);
  const enabled = item.enabled !== false;
  return `<div class="reminder-item ${enabled ? '' : 'disabled'}">
    <div class="reminder-main">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(time)} · ${escapeHtml(freq)}${note ? ` · ${escapeHtml(note)}` : ''}</span>
    </div>
    <div class="reminder-item-actions">
      <button class="button ghost small" type="button" data-reminder-action="toggle" data-reminder-id="${escapeHtml(item.id)}">${enabled ? '停用' : '启用'}</button>
      <button class="button ghost small danger-text" type="button" data-reminder-action="delete" data-reminder-id="${escapeHtml(item.id)}">删除</button>
    </div>
  </div>`;
}

function reminderFrequencyText(value) {
  return { once: '仅一次', daily: '每天', weekly: '每周', monthly: '每月' }[value] || '仅一次';
}

function formatReminderTime(value) {
  if (!value) return '未设置时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function saveReminderFromForm() {
  const titleEl = $('#reminderTitle');
  const timeEl = $('#reminderTime');
  const freqEl = $('#reminderFrequency');
  const noteEl = $('#reminderNote');
  const statusEl = $('#reminderStatusText');
  const title = String(titleEl?.value || '').trim();
  const remindAt = String(timeEl?.value || '').trim();
  const frequency = String(freqEl?.value || 'once');
  const note = String(noteEl?.value || '').trim();
  if (!title) {
    if (statusEl) statusEl.textContent = '请先填写提醒事项。';
    return;
  }
  if (!remindAt) {
    if (statusEl) statusEl.textContent = '请先选择提醒时间。';
    return;
  }
  try {
    const response = await sendMessage({ type: 'SAVE_REMINDER', reminder: { title, remindAt, frequency, note, enabled: true } });
    state.reminders = Array.isArray(response.reminders) ? response.reminders : [];
    if (titleEl) titleEl.value = '';
    if (noteEl) noteEl.value = '';
    if (statusEl) statusEl.textContent = '提醒已保存，到点后会通过浏览器系统通知弹出。';
    state.reminderPanelExpanded = true;
    } catch (error) {
    if (statusEl) statusEl.textContent = `保存提醒失败：${error.message || error}`;
  }
}

async function deleteReminder(id) {
  try {
    const response = await sendMessage({ type: 'DELETE_REMINDER', id });
    state.reminders = Array.isArray(response.reminders) ? response.reminders : [];
    } catch (error) {
    alert(`删除提醒失败：${error.message || error}`);
  }
}

async function toggleReminderEnabled(id) {
  try {
    const response = await sendMessage({ type: 'TOGGLE_REMINDER', id });
    state.reminders = Array.isArray(response.reminders) ? response.reminders : [];
    } catch (error) {
    alert(`切换提醒状态失败：${error.message || error}`);
  }
}

async function testReminderNotification() {
  const statusEl = $('#reminderStatusText');
  try {
    await sendMessage({ type: 'TEST_REMINDER_NOTIFICATION', title: '九安智能采集测试提醒', note: '这是一条浏览器系统通知测试。' });
    if (statusEl) statusEl.textContent = '测试通知已触发；如果没有看到，请检查浏览器通知权限。';
  } catch (error) {
    if (statusEl) statusEl.textContent = `测试通知失败：${error.message || error}`;
  }
}



function roleById(roleId) {
  return ROLE_BY_ID[roleId] || ROLE_BY_ID[DEFAULT_ROLE_ID];
}

function roleName(roleId) {
  return roleById(roleId)?.name || '客服-数据报表';
}

function normalizeRoleId(value) {
  const key = String(value || '').trim();
  if (ROLE_BY_ID[key]) return key;
  if (ROLE_BY_CODE[key]) return ROLE_BY_CODE[key].id;
  return DEFAULT_ROLE_ID;
}

function defaultRoleConfig() {
  return {
    enabledRoles: COLLECT_ROLES.filter(role => role.enabledDefault).map(role => role.id),
    defaultRole: DEFAULT_ROLE_ID,
    disabledRoleDisplay: 'hidden'
  };
}

function normalizeRoleConfig(raw = {}) {
  const defaults = defaultRoleConfig();
  const enabledSet = new Set();
  const values = Array.isArray(raw.enabledRoles) ? raw.enabledRoles : defaults.enabledRoles;
  values.forEach(value => {
    const normalized = normalizeRoleId(value);
    if (ROLE_BY_ID[normalized]) enabledSet.add(normalized);
  });
  if (!enabledSet.size) enabledSet.add(DEFAULT_ROLE_ID);
  const enabledRoles = Array.from(enabledSet);
  return {
    enabledRoles,
    defaultRole: enabledRoles[0] || DEFAULT_ROLE_ID,
    disabledRoleDisplay: raw.disabledRoleDisplay === 'disabled' ? 'disabled' : 'hidden'
  };
}

function isRoleEnabled(roleId) {
  const id = normalizeRoleId(roleId);
  return (state.roleConfig?.enabledRoles || [DEFAULT_ROLE_ID]).includes(id);
}

async function loadRoleConfig() {
  try {
    const url = chrome.runtime.getURL(ROLE_CONFIG_PATH);
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`配置文件读取失败：${response.status}`);
    state.roleConfig = normalizeRoleConfig(await response.json());
  } catch (error) {
    console.warn('读取角色配置失败，使用默认全角色配置', error);
    state.roleConfig = defaultRoleConfig();
  }
  state.activeRole = state.roleConfig.defaultRole || DEFAULT_ROLE_ID;
}

function roleStorePayload() {
  return {
    activeRole: state.activeRole || DEFAULT_ROLE_ID,
    roles: Object.fromEntries(COLLECT_ROLES.map(role => [role.id, normalizeAutoCollectSettings(state.roleAutoSettings?.[role.id] || { roleId: role.id }, role.id)]))
  };
}

async function saveRoleStore() {
  await chrome.storage.local.set({ [ROLE_SETTINGS_KEY]: roleStorePayload() });
}

function syncActiveRoleSettings() {
  const roleId = normalizeRoleId(state.activeRole);
  state.autoSettings = normalizeAutoCollectSettings(state.roleAutoSettings?.[roleId] || { roleId }, roleId);
  state.roleAutoSettings[roleId] = state.autoSettings;
}

function setActiveRole(roleId, options = {}) {
  const normalized = normalizeRoleId(roleId);
  if (!isRoleEnabled(normalized)) {
    setAutoStatus(`${roleName(normalized)}未启用，请用打包脚本重新生成包含该角色的安装包后重新加载插件。`, 'warn');
    return;
  }
  state.activeRole = normalized;
  syncActiveRoleSettings();
  if (options.persist !== false) void saveRoleStore().catch(() => {});
  renderRoleSwitch();
  renderAutoCollectSettingsForm();
  renderAll();
}

function renderRoleSwitch() {
  const active = normalizeRoleId(state.activeRole);
  const badge = $('#activeRoleBadge');
  if (badge) {
    badge.textContent = roleName(active);
    badge.className = 'badge online';
  }
  $$('.role-button').forEach(button => {
    const roleId = normalizeRoleId(button.dataset.role);
    const enabled = isRoleEnabled(roleId);
    button.textContent = roleName(roleId);
    button.classList.toggle('active', roleId === active);
    button.classList.toggle('disabled', !enabled);
    button.disabled = !enabled;
    button.title = enabled ? `${roleName(roleId)}已启用` : '该角色未在配置文件中启用';
    if (!enabled && state.roleConfig?.disabledRoleDisplay === 'hidden') button.classList.add('hidden');
    else button.classList.remove('hidden');
  });
  const role = roleById(active);
  const customerActive = active === 'customer_report';
  ['.platform-grid', '.global-toolbar', '.batch-settings', '.tabs', 'main'].forEach(selector => {
    const el = document.querySelector(selector);
    if (el) el.classList.toggle('hidden', !customerActive);
  });
  const placeholder = $('#rolePlaceholderPanel');
  if (placeholder) placeholder.classList.toggle('hidden', customerActive);
  const title = $('#rolePlaceholderTitle');
  if (title) title.textContent = role.name;
  const text = $('#rolePlaceholderText');
  if (text) text.textContent = role.supported
    ? '该角色可直接采集。'
    : '该角色已启用独立计划、状态和同步结构；当前版本先预留采集入口，待补充对应账单接口后即可接入。';
  const roleBtn = $('#btnCollectCurrentRole');
  if (roleBtn) {
    roleBtn.textContent = `采集${role.name}`;
    roleBtn.disabled = isAnyCollecting() || !role.supported;
    roleBtn.title = role.supported ? '采集当前角色' : '该角色采集接口尚未接入';
  }
  const placeholderStatus = $('#rolePlaceholderStatus');
  if (placeholderStatus) placeholderStatus.textContent = role.supported ? '当前角色可采集。' : '当前角色暂无已接入采集接口。';
}

function updateScheduleVisibility() {
  const type = $('#autoScheduleType')?.value || 'day';
  const dayMode = $('#autoDayMode')?.value || 'daily';
  $('#autoDayModeLabel')?.classList.toggle('hidden', type === 'month');
  $('#autoMonthDayLabel')?.classList.toggle('hidden', type !== 'month');
  $('#autoWeekdayPicker')?.classList.toggle('hidden', !(type === 'day' && dayMode === 'weekdays'));
}

function describeRoleSchedule(cfg = state.autoSettings) {
  const normalized = normalizeAutoCollectSettings(cfg);
  if (normalized.scheduleType === 'month') return `每月 ${normalized.monthDay} 号 ${normalized.time}`;
  if (normalized.dayMode === 'workdays') return `工作日 ${normalized.time}`;
  if (normalized.dayMode === 'weekdays') return `每周 ${normalized.weekdays.map(day => ['一','二','三','四','五','六','日'][day - 1]).join('、')} ${normalized.time}`;
  return `每天 ${normalized.time}`;
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

function normalizeAutoCollectSettings(raw = {}, roleId = raw?.roleId || state?.activeRole || DEFAULT_ROLE_ID) {
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

async function loadAutoCollectSettings() {
  try {
    const keys = [ROLE_SETTINGS_KEY, AUTO_SETTINGS_KEY, ...LEGACY_AUTO_SETTINGS_KEYS];
    const stored = await chrome.storage.local.get(keys);
    const roleStore = stored[ROLE_SETTINGS_KEY] && typeof stored[ROLE_SETTINGS_KEY] === 'object' ? stored[ROLE_SETTINGS_KEY] : {};
    const legacy = stored[AUTO_SETTINGS_KEY] || LEGACY_AUTO_SETTINGS_KEYS.map(key => stored[key]).find(value => value && typeof value === 'object') || {};
    state.roleAutoSettings = {};
    COLLECT_ROLES.forEach(role => {
      const fromStore = roleStore.roles?.[role.id];
      const source = fromStore || (role.id === DEFAULT_ROLE_ID ? legacy : { roleId: role.id, enabled: false });
      state.roleAutoSettings[role.id] = normalizeAutoCollectSettings(source, role.id);
    });
    const storedActive = normalizeRoleId(roleStore.activeRole || state.roleConfig.defaultRole || DEFAULT_ROLE_ID);
    state.activeRole = isRoleEnabled(storedActive) ? storedActive : state.roleConfig.defaultRole;
    syncActiveRoleSettings();
  } catch {
    state.roleAutoSettings = Object.fromEntries(COLLECT_ROLES.map(role => [role.id, defaultAutoCollectSettings(role.id)]));
    state.activeRole = state.roleConfig?.defaultRole || DEFAULT_ROLE_ID;
    syncActiveRoleSettings();
  }
  await refreshAutoCollectScheduleStatus(false);
  renderRoleSwitch();
  renderAutoCollectSettingsForm();
}

function renderAutoCollectSettingsForm() {
  syncActiveRoleSettings();
  const cfg = normalizeAutoCollectSettings(state.autoSettings || {}, state.activeRole);
  const role = roleById(state.activeRole);
  const setChecked = (id, value) => { const el = $(id); if (el) el.checked = Boolean(value); };
  const setValue = (id, value) => { const el = $(id); if (el) el.value = value; };
  setChecked('#autoEnabled', cfg.enabled);
  setValue('#autoTime', cfg.time || '09:30');
  setValue('#autoScheduleType', cfg.scheduleType || 'day');
  setValue('#autoDayMode', cfg.dayMode || 'daily');
  setValue('#autoMonthDay', cfg.monthDay || 1);
  $$('#autoWeekdayPicker input[data-weekday]').forEach(input => {
    input.checked = (cfg.weekdays || []).includes(Number(input.dataset.weekday));
  });
  setValue('#autoAfterCollect', cfg.afterCollect || 'sync');
  setChecked('#autoKeepAliveEnabled', cfg.keepAlive?.enabled);
  setValue('#autoKeepAliveMode', cfg.keepAlive?.intervalMode || '8_10');
  setChecked('#autoPlatformWeixin', cfg.platforms.weixin_shop);
  setChecked('#autoPlatformDoudian', cfg.platforms.doudian);
  setChecked('#autoPlatformPdd', cfg.platforms.pdd);
  const title = $('#autoCollectTitle');
  if (title) title.textContent = `${role.name}自动采集`;
  const platformsBlock = $('#autoPlatformsBlock');
  if (platformsBlock) platformsBlock.classList.toggle('hidden', role.platformLocked);
  updateScheduleVisibility();
  renderAutoCollectPanel();
}

function renderAutoCollectPanel() {
  syncActiveRoleSettings();
  const cfg = normalizeAutoCollectSettings(state.autoSettings || {}, state.activeRole);
  const role = roleById(state.activeRole);
  const panel = $('#autoCollectPanel');
  const body = $('#autoCollectBody');
  const btn = $('#btnToggleAutoCollect');
  if (panel && body && btn) {
    panel.classList.toggle('collapsed', !state.autoPanelExpanded);
    body.classList.toggle('hidden', !state.autoPanelExpanded);
    btn.textContent = state.autoPanelExpanded ? '收起' : (cfg.enabled ? '编辑计划' : '展开配置');
  }
  updateAutoConfigBadge();
  const roleText = $('#autoRoleText');
  const nextText = $('#autoNextRunText');
  const lastRunText = $('#autoLastRunText');
  const lastResultText = $('#autoLastResultText');
  const keepNextText = $('#autoKeepAliveNextText');
  const keepLastText = $('#autoKeepAliveLastText');
  if (roleText) roleText.textContent = role.name;
  if (nextText) nextText.textContent = cfg.enabled ? (formatAutoTime(cfg.nextRunAt) || '等待重新计算') : '未开启';
  if (lastRunText) lastRunText.textContent = cfg.lastRunAt ? formatDateTime(cfg.lastRunAt) : '暂无';
  if (lastResultText) lastResultText.textContent = cfg.lastResult || '暂无';
  if (keepNextText) keepNextText.textContent = cfg.keepAlive?.enabled ? (formatAutoTime(cfg.keepAlive?.nextRunAt) || '等待随机调度') : '未开启';
  if (keepLastText) keepLastText.textContent = cfg.keepAlive?.lastRunAt ? `${formatDateTime(cfg.keepAlive.lastRunAt)}｜${cfg.keepAlive.lastResult || '已探活'}` : '暂无';
  const status = $('#autoStatusText');
  if (status && !status.dataset.manual) {
    status.textContent = cfg.enabled
      ? `已开启：${role.name}，${describeRoleSchedule(cfg)}。${cfg.keepAlive?.enabled ? '平台探活已开启，采集中会自动跳过探活。' : '平台探活未开启。'}`
      : (cfg.keepAlive?.enabled ? `${role.name}自动采集未开启；平台探活已开启。` : `${role.name}自动采集未开启。`);
    status.className = cfg.enabled ? 'auto-ok' : 'auto-warn';
  }
  renderRoleSwitch();
}

function updateAutoConfigBadge() {
  const badge = $('#autoConfigBadge');
  if (!badge) return;
  const cfg = normalizeAutoCollectSettings(state.autoSettings || {}, state.activeRole);
  badge.textContent = cfg.enabled ? '已开启' : '未开启';
  badge.className = `badge ${cfg.enabled ? 'online' : 'neutral'}`;
}

function setAutoStatus(text, type = 'warn') {
  const el = $('#autoStatusText');
  if (!el) return;
  el.textContent = text;
  el.className = type === 'ok' ? 'auto-ok' : type === 'error' ? 'auto-error' : 'auto-warn';
  el.dataset.manual = '1';
  setTimeout(() => { if (el) delete el.dataset.manual; }, 6000);
}

function toggleAutoCollectPanel() {
  state.autoPanelExpanded = !state.autoPanelExpanded;
  renderAutoCollectPanel();
}

function collapseAutoCollectPanel() {
  state.autoPanelExpanded = false;
  renderAutoCollectPanel();
}

function readAutoCollectSettingsFromForm() {
  const weekdays = $$('#autoWeekdayPicker input[data-weekday]')
    .filter(input => input.checked)
    .map(input => Number(input.dataset.weekday));
  return normalizeAutoCollectSettings({
    roleId: state.activeRole,
    enabled: $('#autoEnabled')?.checked,
    time: $('#autoTime')?.value,
    scheduleType: $('#autoScheduleType')?.value,
    dayMode: $('#autoDayMode')?.value,
    weekdays,
    monthDay: $('#autoMonthDay')?.value,
    afterCollect: $('#autoAfterCollect')?.value,
    keepAlive: {
      enabled: $('#autoKeepAliveEnabled')?.checked,
      intervalMode: $('#autoKeepAliveMode')?.value,
      nextRunAt: state.autoSettings?.keepAlive?.nextRunAt,
      lastRunAt: state.autoSettings?.keepAlive?.lastRunAt,
      lastResult: state.autoSettings?.keepAlive?.lastResult
    },
    platforms: {
      weixin_shop: $('#autoPlatformWeixin')?.checked,
      doudian: $('#autoPlatformDoudian')?.checked,
      pdd: $('#autoPlatformPdd')?.checked
    },
    nextRunAt: state.autoSettings?.nextRunAt,
    lastRunAt: state.autoSettings?.lastRunAt,
    lastResult: state.autoSettings?.lastResult
  }, state.activeRole);
}

async function saveAutoCollectSettingsFromForm() {
  const cfg = readAutoCollectSettingsFromForm();
  const role = roleById(state.activeRole);
  if (role.supported && !selectedAutoPlatforms(cfg).length) {
    setAutoStatus('请至少选择一个自动采集平台。', 'error');
    return;
  }
  state.roleAutoSettings[state.activeRole] = cfg;
  syncActiveRoleSettings();
  await saveRoleStore();
  const schedule = await sendMessage({ type: 'RESCHEDULE_ROLE_AUTO_COLLECT', roleSettings: roleStorePayload() });
  applyRoleScheduleStatus(schedule);
  await saveRoleStore();
  renderAutoCollectSettingsForm();
  if (cfg.enabled) {
    const current = state.roleAutoSettings[state.activeRole] || cfg;
    const keepText = current.keepAlive?.enabled ? `平台探活：${formatAutoTime(current.keepAlive.nextRunAt) || '等待随机调度'}。` : '平台探活未开启。';
    setAutoStatus(`${role.name}自动采集已开启，下次计划：${formatAutoTime(current.nextRunAt) || '等待计算'}。${keepText}`, 'ok');
  } else {
    setAutoStatus(`${role.name}自动采集已关闭。`, 'warn');
  }
  collapseAutoCollectPanel();
}

function applyRoleScheduleStatus(response = {}) {
  const roles = response.roles || {};
  Object.entries(roles).forEach(([roleId, item]) => {
    const rid = normalizeRoleId(roleId);
    state.roleAutoSettings[rid] = normalizeAutoCollectSettings({
      ...(state.roleAutoSettings[rid] || {}),
      nextRunAt: item.nextRunAt || '',
      keepAlive: { ...(state.roleAutoSettings[rid]?.keepAlive || {}), nextRunAt: item.keepAliveNextRunAt || state.roleAutoSettings[rid]?.keepAlive?.nextRunAt || '' }
    }, rid);
  });
  if (response.keepAliveNextRunAt) {
    COLLECT_ROLES.forEach(role => {
      const old = state.roleAutoSettings[role.id] || defaultAutoCollectSettings(role.id);
      state.roleAutoSettings[role.id] = normalizeAutoCollectSettings({
        ...old,
        keepAlive: { ...(old.keepAlive || {}), nextRunAt: response.keepAliveNextRunAt }
      }, role.id);
    });
  }
  syncActiveRoleSettings();
}

function startAutoCollectLiveRefresh() {
  if (state.autoStatusRefreshTimer) clearInterval(state.autoStatusRefreshTimer);
  state.autoStatusRefreshTimer = setInterval(async () => {
    try {
      await refreshAutoCollectScheduleStatus(false);
      renderAutoCollectPanel();
    } catch {}
  }, 15000);
  window.addEventListener('focus', () => {
    void refreshAutoCollectScheduleStatus(false).then(renderAutoCollectPanel).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void refreshAutoCollectScheduleStatus(false).then(renderAutoCollectPanel).catch(() => {});
    }
  });
}

async function refreshAutoCollectScheduleStatus(updateStorage = true) {
  try {
    const response = await sendMessage({ type: 'GET_ROLE_AUTO_COLLECT_STATUS' });
    applyRoleScheduleStatus(response);
    if (updateStorage) await saveRoleStore();
  } catch {}
}

function selectedAutoPlatforms(cfg = state.autoSettings) {
  const platforms = normalizeAutoCollectSettings(cfg).platforms || {};
  return ['weixin_shop', 'doudian', 'pdd'].filter(platform => platforms[platform] !== false);
}

function isAutoCollectDayAllowed(cfg = state.autoSettings, date = new Date()) {
  const normalized = normalizeAutoCollectSettings(cfg);
  if (normalized.scheduleType === 'month') return date.getDate() === normalized.monthDay;
  const day = date.getDay() || 7;
  if (normalized.dayMode === 'workdays') return day >= 1 && day <= 5;
  if (normalized.dayMode === 'weekdays') return normalized.weekdays.includes(day);
  return true;
}

function formatAutoTime(value) {
  if (!value) return '';
  try { return formatDateTime(value); } catch { return String(value); }
}

async function consumePendingAutoCollectTrigger(source) {
  try {
    const stored = await chrome.storage.local.get(AUTO_TRIGGER_KEY);
    const trigger = stored[AUTO_TRIGGER_KEY];
    if (!trigger || !trigger.id) return;
    await chrome.storage.local.remove(AUTO_TRIGGER_KEY);
    await runAutomaticCollection(trigger, source);
  } catch (error) {
    console.warn('处理自动采集触发失败', error);
  }
}

async function runAutoCollectNow(source = 'manual') {
  await saveAutoCollectSettingsFromForm();
  await runAutomaticCollection({ id: `manual-${Date.now()}`, roleId: state.activeRole, source }, source);
}

async function runCurrentRoleManualCollect() {
  await runAutoCollectNow('manual-role');
}

async function runAutomaticCollection(trigger = {}, source = 'alarm') {
  const roleId = normalizeRoleId(trigger.roleId || state.activeRole);
  if (isRoleEnabled(roleId)) setActiveRole(roleId, { persist: false });
  const role = roleById(roleId);
  if (state.autoRunning || isAnyCollecting()) {
    const msg = '已有采集任务正在执行，本次自动采集跳过。';
    setMainStatus(msg);
    await notifyAutoCollect('九安智能采集：自动采集跳过', msg);
    await recordAutoCollectResult(msg, false, roleId);
    return;
  }
  const cfg = normalizeAutoCollectSettings(state.roleAutoSettings?.[roleId] || state.autoSettings || {}, roleId);
  if (!cfg.enabled && source !== 'manual' && source !== 'manual-role') {
    setAutoStatus(`${role.name}自动采集未开启，本次触发已忽略。`, 'warn');
    return;
  }
  if (!isAutoCollectDayAllowed(cfg) && source !== 'manual' && source !== 'manual-role') {
    const msg = `今天不是${role.name}配置的自动采集日期，已跳过。`;
    setMainStatus(msg);
    await recordAutoCollectResult(msg, true, roleId);
    return;
  }
  if (!role.supported) {
    const msg = `${role.name}已启用独立计划，但该角色采集接口尚未接入，已跳过真实采集。`;
    setAutoStatus(msg, 'warn');
    await notifyAutoCollect('九安智能采集：角色采集未接入', msg);
    await recordAutoCollectResult(msg, false, roleId);
    return;
  }
  const platforms = selectedAutoPlatforms(cfg);
  if (!platforms.length) {
    const msg = `${role.name}未选择采集平台，已跳过。`;
    setAutoStatus(msg, 'error');
    await recordAutoCollectResult(msg, false, roleId);
    return;
  }
  state.autoRunning = true;
  setAutoStatus(`${role.name}自动采集开始：正在检测三方平台登录态…`, 'warn');
  await notifyAutoCollect('九安智能采集：自动采集开始', `${role.name}正在采集：${platforms.map(platformName).join('、')}`);
  try {
    const result = await collectSelectedPlatforms(platforms, { auto: true, source: trigger.source || source, roleId });
    if (!result.platforms.length) {
      const missingText = result.missing?.length ? `未登录：${result.missing.map(platformName).join('、')}` : '没有可采集平台';
      const msg = `${role.name}自动采集未执行，${missingText}。请人工登录后补采。`;
      setAutoStatus(msg, 'error');
      await notifyAutoCollect('九安智能采集：需要人工登录', msg);
      await recordAutoCollectResult(msg, false, roleId);
      return;
    }
    let msg = `${role.name}自动采集完成：${result.platforms.map(platformName).join('、')}。`;
    if (cfg.afterCollect === 'sync') {
      if (state.syncSettings?.apiUrl && hasAnyCollectedData()) {
        setAutoStatus(`${role.name}自动采集完成，正在同步运营系统…`, 'warn');
        await syncAllToOperationSystem({ roleId });
        msg += '已尝试同步运营系统。';
      } else {
        msg += '未同步：运营系统接口未配置或暂无数据。';
      }
    }
    setAutoStatus(msg, 'ok');
    await notifyAutoCollect('九安智能采集：自动采集完成', msg);
    await recordAutoCollectResult(msg, true, roleId);
  } catch (error) {
    const msg = `${role.name}自动采集失败：${error.message || error}`;
    setAutoStatus(msg, 'error');
    setMainStatus(msg);
    await notifyAutoCollect('九安智能采集：自动采集失败', msg);
    await recordAutoCollectResult(msg, false, roleId);
  } finally {
    state.autoRunning = false;
    await refreshAutoCollectScheduleStatus(true);
    renderAutoCollectPanel();
  }
}

async function recordAutoCollectResult(text, ok, roleId = state.activeRole) {
  const rid = normalizeRoleId(roleId);
  state.roleAutoSettings[rid] = normalizeAutoCollectSettings({
    ...(state.roleAutoSettings?.[rid] || {}),
    lastRunAt: new Date().toISOString(),
    lastResult: text || (ok ? '执行成功' : '执行失败')
  }, rid);
  syncActiveRoleSettings();
  await saveRoleStore();
  renderAutoCollectPanel();
}

async function notifyAutoCollect(title, message) {
  try {
    await sendMessage({ type: 'SHOW_AUTO_COLLECT_NOTIFICATION', title, message });
  } catch {}
}

async function testAutoCollectNotification() {
  try {
    await notifyAutoCollect('九安智能采集：自动采集提醒测试', '锁屏可以继续运行；睡眠、关机、重启会中断插件自动采集。');
    setAutoStatus('测试提醒已触发；如果没有看到，请检查浏览器通知权限。', 'ok');
  } catch (error) {
    setAutoStatus(`测试提醒失败：${error.message || error}`, 'error');
  }
}

async function runPlatformKeepAliveNow(source = 'manual') {
  try {
    const lock = await getCollectingLock();
    if (lock || isAnyCollecting()) {
      setAutoStatus('当前正在采集，已跳过本次平台探活。', 'warn');
      return;
    }
    const cfg = readAutoCollectSettingsFromForm();
    state.roleAutoSettings[state.activeRole] = cfg;
    syncActiveRoleSettings();
    await saveRoleStore();
    setAutoStatus('正在执行平台探活：首页刷新中…', 'warn');
    const result = await sendMessage({ type: 'RUN_PLATFORM_KEEPALIVE', roleSettings: roleStorePayload(), activeRole: state.activeRole, source });
    COLLECT_ROLES.forEach(role => {
      const oldCfg = state.roleAutoSettings[role.id] || defaultAutoCollectSettings(role.id);
      state.roleAutoSettings[role.id] = normalizeAutoCollectSettings({
        ...oldCfg,
        keepAlive: {
          ...(oldCfg.keepAlive || {}),
          lastRunAt: result.lastRunAt || oldCfg.keepAlive?.lastRunAt || new Date().toISOString(),
          lastResult: result.message || '探活完成',
          nextRunAt: result.keepAliveNextRunAt || oldCfg.keepAlive?.nextRunAt || ''
        }
      }, role.id);
    });
    syncActiveRoleSettings();
    await saveRoleStore();
    renderAutoCollectSettingsForm();
    setAutoStatus(result.message || '平台探活完成。', result.ok === false ? 'error' : 'ok');
  } catch (error) {
    setAutoStatus(`平台探活失败：${error.message || error}`, 'error');
  }
}

async function loadSyncSettings() {
  try {
    const keys = [SYNC_SETTINGS_KEY, ...LEGACY_SYNC_SETTINGS_KEYS];
    const stored = await chrome.storage.local.get(keys);
    const settings = stored[SYNC_SETTINGS_KEY] || LEGACY_SYNC_SETTINGS_KEYS.map(key => stored[key]).find(value => value && typeof value === 'object') || {};
    state.syncSettings = normalizeSyncSettings(settings);
  } catch {
    state.syncSettings = normalizeSyncSettings({});
  }
  renderSyncSettingsForm();
}

function renderSyncSettingsForm() {
  const cfg = state.syncSettings || {};
  const setValue = (id, value) => { const el = $(id); if (el) el.value = value || ''; };
  setValue('#syncApiUrl', cfg.apiUrl);
  setValue('#syncToken', cfg.token);
  updateSyncConfigBadge();
  updateExportButtons();
}

function updateSyncConfigBadge() {
  const badge = $('#syncConfigBadge');
  if (!badge) return;
  const cfg = state.syncSettings || {};
  const ok = Boolean(cfg.apiUrl);
  badge.textContent = ok ? (cfg.token ? '已配置' : '已配置｜无Token') : '未配置';
  badge.className = `badge ${ok ? 'online' : 'neutral'}`;
  const text = $('#syncStatusText');
  if (text) {
    text.textContent = ok
      ? (cfg.token ? '同步时会附带 Token、时间戳、nonce、bodyHash 和 HMAC 签名请求头。' : '已配置接口地址；未配置 Token 时仍可同步，后端可先放过，后续再启用鉴权。')
      : '同步前请配置运营系统接口地址。';
    text.className = ok ? (cfg.token ? 'sync-ok' : 'sync-warn') : 'sync-warn';
  }
}

async function saveSyncSettingsFromForm() {
  state.syncSettings = normalizeSyncSettings({
    apiUrl: $('#syncApiUrl')?.value,
    token: $('#syncToken')?.value
  });
  await chrome.storage.local.set({ [SYNC_SETTINGS_KEY]: state.syncSettings });
  updateSyncConfigBadge();
  updateExportButtons();
  const apiUrl = String(state.syncSettings?.apiUrl || '').trim();
  if (apiUrl) {
    try {
      new URL(apiUrl);
      collapseSyncSettingsPanel();
      setMainStatus('运营系统同步配置已保存，配置面板已自动收起。');
      return;
    } catch {
      setSyncStatus('接口地址格式不正确，请检查 URL。', 'error');
      setMainStatus('运营系统同步配置已保存，但接口地址格式需要检查。');
      return;
    }
  }
  setMainStatus('运营系统同步配置已保存。');
}

async function testSyncSettings() {
  await saveSyncSettingsFromForm();
  const cfg = state.syncSettings || {};
  if (!cfg.apiUrl) {
    setSyncStatus('请先填写运营系统接口地址。', 'error');
    return;
  }
  try {
    const url = new URL(cfg.apiUrl);
    setSyncStatus(`配置格式正常：${url.origin}`, 'ok');
  } catch {
    setSyncStatus('接口地址格式不正确，请检查 URL。', 'error');
  }
}

function setSyncStatus(text, type = 'ok') {
  const el = $('#syncStatusText');
  if (!el) return;
  el.textContent = text;
  el.className = type === 'error' ? 'sync-error' : (type === 'warn' ? 'sync-warn' : 'sync-ok');
}

function buildCollectorMeta(extra = {}) {
  return {
    name: '九安智能采集',
    version: COLLECTOR_VERSION,
    extensionId: chrome.runtime.id,
    generatedAt: new Date().toISOString(),
    ...extra
  };
}

function buildServerNetworkHint() {
  return {
    source: 'server_should_resolve',
    note: '真实公网 IP、X-Forwarded-For、地理位置、运营商建议由运营系统后端按请求源统一解析并入库。'
  };
}

function randomNonce(length = 24) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildSyncAuthHeaders(cfg, apiUrl, bodyText) {
  const timestamp = String(Date.now());
  const nonce = randomNonce();
  const bodyHash = await sha256Hex(bodyText || '');
  const url = new URL(apiUrl);
  const pathWithQuery = `${url.pathname}${url.search || ''}`;
  const signText = ['POST', pathWithQuery, timestamp, nonce, bodyHash].join('\n');
  const headers = {
    'Content-Type': 'application/json;charset=utf-8',
    'X-Jiuan-Collector-Version': COLLECTOR_VERSION,
    'X-Jiuan-Extension-Id': chrome.runtime.id,
    'X-Jiuan-Timestamp': timestamp,
    'X-Jiuan-Nonce': nonce,
    'X-Jiuan-Body-SHA256': bodyHash,
    'X-Jiuan-Signature-Alg': 'HMAC-SHA256',
    'X-Jiuan-Auth-Window': '300s'
  };
  const token = String(cfg?.token || '').trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Jiuan-Signature'] = await hmacSha256Hex(token, signText);
    headers['X-Jiuan-Auth-Mode'] = 'bearer+hmac';
  } else {
    headers['X-Jiuan-Auth-Mode'] = 'unsigned-dev';
  }
  return { headers, authMeta: { timestamp, nonce, bodyHash, signatureAlg: 'HMAC-SHA256', signed: Boolean(token), signPath: pathWithQuery, validWindowSeconds: 300 } };
}

function setSyncSettingsPanelCollapsed(collapsed) {
  const panel = $('#syncSettingsPanel');
  const body = $('#syncSettingsBody');
  const btn = $('#btnToggleSyncSettings');
  if (!panel || !body || !btn) return;
  panel.classList.toggle('collapsed', Boolean(collapsed));
  body.classList.toggle('hidden', Boolean(collapsed));
  btn.textContent = collapsed ? '展开' : '收起';
}

function collapseSyncSettingsPanel() {
  setSyncSettingsPanelCollapsed(true);
}

function toggleSyncSettingsPanel() {
  const panel = $('#syncSettingsPanel');
  if (!panel) return;
  setSyncSettingsPanelCollapsed(!panel.classList.contains('collapsed'));
}


function clearSyncResultAutoClose() {
  if (syncResultAutoCloseTimer) clearTimeout(syncResultAutoCloseTimer);
  syncResultAutoCloseTimer = null;
}

function scheduleSyncResultAutoClose(status) {
  clearSyncResultAutoClose();
  const modal = $('#syncResultModal');
  if (!modal || modal.classList.contains('hidden')) return;
  if (status !== 'success' && status !== 'error') return;
  const openedRaw = modal.querySelector('.sync-result-raw[open]');
  if (openedRaw) return;
  const delay = status === 'success' ? 5000 : 10000;
  syncResultAutoCloseTimer = setTimeout(() => hideSyncResultModal(), delay);
}

function hideSyncResultModal() {
  clearSyncResultAutoClose();
  const modal = $('#syncResultModal');
  if (modal) modal.classList.add('hidden');
}

function placeSyncResultModal() {
  const modal = $('#syncResultModal');
  const button = $('#btnSyncAll');
  if (!modal || !button) return;
  const rect = button.getBoundingClientRect();
  const width = Math.min(400, Math.max(300, window.innerWidth - 24));
  const margin = 12;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(margin, Math.min(window.innerWidth - width - margin, left));
  let top = rect.bottom + 10;
  const estimatedHeight = 320;
  if (top + estimatedHeight > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - estimatedHeight - 10);
  }
  modal.style.width = `${width}px`;
  modal.style.left = `${left}px`;
  modal.style.top = `${top}px`;
  modal.style.right = 'auto';
  modal.style.bottom = 'auto';
}

function showSyncResultModal({ percent = 0, status = 'running', title = '运营系统同步', text = '', result = null, error = '' } = {}) {
  const modal = $('#syncResultModal');
  const ring = $('#syncResultRing');
  const percentEl = $('#syncResultPercent');
  const titleEl = $('#syncResultTitle');
  const textEl = $('#syncResultText');
  const bodyEl = $('#syncResultBody');
  if (!modal || !ring || !percentEl || !titleEl || !textEl || !bodyEl) return;
  clearSyncResultAutoClose();
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent || 0))));
  modal.classList.remove('hidden', 'success', 'error', 'running');
  modal.classList.add(status);
  modal.dataset.status = status;
  placeSyncResultModal();
  ring.style.setProperty('--sync-percent', String(safePercent));
  percentEl.textContent = `${safePercent}%`;
  titleEl.textContent = title;
  textEl.textContent = text || '';
  if (result) bodyEl.innerHTML = renderSyncResultBody(result);
  else if (error) bodyEl.innerHTML = `<div class="sync-result-error">${escapeHtml(error)}</div><div class="sync-result-tip">10 秒后自动关闭，可在页面状态中查看失败信息。</div>`;
  else bodyEl.innerHTML = '<div class="sync-result-tip">正在等待运营系统响应，请不要关闭页面。</div>';
  if (status === 'success') bodyEl.insertAdjacentHTML('beforeend', '<div class="sync-result-tip">同步成功，5 秒后自动关闭。</div>');
  scheduleSyncResultAutoClose(status);
}

function renderSyncResultBody(result) {
  const rows = [
    ['状态', result.ok === true || result.success === true ? '成功' : (result.ok === false || result.success === false ? '失败' : '已返回')],
    ['任务ID', result.task_id || result.taskId || result.data?.task_id || result.data?.taskId || ''],
    ['批次号', result.batchNo || result.batch_no || result.data?.batchNo || result.data?.batch_no || ''],
    ['平台数', result.platform_count ?? result.platformCount ?? result.data?.platform_count ?? result.data?.platformCount ?? ''],
    ['店铺数', result.shop_count ?? result.shopCount ?? result.data?.shop_count ?? result.data?.shopCount ?? ''],
    ['模块数', result.module_count ?? result.moduleCount ?? result.data?.module_count ?? result.data?.moduleCount ?? ''],
    ['明细行数', result.detail_row_count ?? result.detailRowCount ?? result.data?.detail_row_count ?? result.data?.detailRowCount ?? '']
  ].filter(([, value]) => value !== '' && value !== null && value !== undefined);
  const rowHtml = rows.map(([label, value]) => `<div class="sync-result-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  const raw = JSON.stringify(result, null, 2);
  return `<div class="sync-result-rows">${rowHtml}</div><details class="sync-result-raw"><summary>查看完整返回 JSON</summary><pre>${escapeHtml(raw)}</pre></details>`;
}

async function syncAllToOperationSystem(options = {}) {
  if (state.syncing) return;
  await saveSyncSettingsFromForm();
  const cfg = state.syncSettings || {};
  if (!cfg.apiUrl) {
    setSyncStatus('请先填写运营系统接口地址。', 'error');
    showSyncResultModal({ status: 'error', percent: 0, title: '同步失败', text: '运营系统接口地址未配置', error: '请先展开“运营系统同步”配置，并填写接口地址。' });
    return;
  }
  if (!hasAnyCollectedData()) {
    setSyncStatus('暂无可同步数据，请先采集。', 'warn');
    showSyncResultModal({ status: 'error', percent: 0, title: '同步失败', text: '暂无可同步数据', error: '请先完成微信小店、抖店或拼多多的数据采集。' });
    return;
  }
  state.syncing = true;
  updateExportButtons();
  setSyncStatus('正在准备同步数据…', 'warn');
  showSyncResultModal({ status: 'running', percent: 8, title: '运营系统同步', text: '正在整理当前所有平台采集数据…' });
  try {
    const payloadBase = buildOperationPayload({ roleId: options.roleId || state.activeRole });
    showSyncResultModal({ status: 'running', percent: 22, title: '运营系统同步', text: '正在生成同步载体和批次信息…' });
    const payload = {
      ...payloadBase,
      syncMeta: {
        collector: buildCollectorMeta(),
        serverNetworkHint: buildServerNetworkHint(),
        submitTime: new Date().toISOString(),
        auth: {
          providedInHeaders: true,
          signatureAlg: 'HMAC-SHA256',
          signed: Boolean(String(cfg.token || '').trim()),
          validWindowSeconds: 300
        }
      }
    };
    const bodyText = JSON.stringify(payload);
    showSyncResultModal({ status: 'running', percent: 38, title: '运营系统同步', text: '正在计算 bodyHash、nonce 和签名请求头…' });
    const { headers } = await buildSyncAuthHeaders(cfg, cfg.apiUrl, bodyText);
    showSyncResultModal({ status: 'running', percent: 58, title: '运营系统同步', text: '正在向运营系统提交数据…' });
    const response = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers,
      body: bodyText,
      credentials: 'omit',
      cache: 'no-store'
    });
    showSyncResultModal({ status: 'running', percent: 82, title: '运营系统同步', text: '运营系统已响应，正在解析返回结果…' });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 1000) }; }
    if (!response.ok) {
      throw new Error(`运营系统返回 HTTP ${response.status}：${body?.message || body?.error || text.slice(0, 180)}`);
    }
    const batchNo = body?.batchNo || body?.batch_no || body?.data?.batchNo || body?.data?.batch_no || body?.result?.batchNo || body?.result?.batch_no || '';
    const taskId = body?.task_id || body?.taskId || body?.data?.task_id || body?.data?.taskId || '';
    const resultText = `同步成功${batchNo ? `，批次 ${batchNo}` : ''}${taskId ? `，任务 ${taskId}` : ''}。`;
    setSyncStatus(resultText, 'ok');
    setMainStatus(resultText);
    showSyncResultModal({ status: 'success', percent: 100, title: '同步成功', text: resultText, result: body });
  } catch (error) {
    const message = error.message || String(error);
    setSyncStatus(`同步失败：${message}`, 'error');
    setMainStatus(`运营系统同步失败：${message}`);
    showSyncResultModal({ status: 'error', percent: 100, title: '同步失败', text: '运营系统同步失败，请检查接口地址、Token、CORS 或后端日志。', error: message });
  } finally {
    state.syncing = false;
    updateExportButtons();
  }
}

async function copyApiStats() {
  const text = buildApiStatsText();
  try {
    await navigator.clipboard.writeText(text);
    setMainStatus('采集接口统计已复制到剪贴板');
  } catch (error) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `api-stats-${dateStamp()}.txt`);
    setMainStatus('复制失败，已改为导出接口统计文本');
  }
}

function exportJson() {
  const payload = buildOperationPayload({ roleId: state.activeRole });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `jiuan-operation-payload-${dateStamp()}.json`);
}

function buildOperationPayload(options = {}) {
  const exportedAt = new Date().toISOString();
  const roleId = normalizeRoleId(options.roleId || state.activeRole);
  const role = roleById(roleId);
  return {
    schemaVersion: '0.9.11',
    exportedAt,
    collectRole: roleId,
    collectRoleName: role.name,
    collector: { ...buildCollectorMeta(), roleId, roleName: role.name },
    description: '九安智能采集运营系统请求载体：数据区仅保留字段名和值，字段中文名统一见 fieldDefinitions。',
    fieldDefinitions: buildFieldDefinitions(),
    platforms: {
      weixin_shop: {
        platformName: '微信小店',
        date: platformDateText(state.results.weixin_shop),
        shops: (state.results.weixin_shop || []).map(item => buildWeixinOperationShop(item))
      },
      doudian_shop: {
        platformName: '抖店',
        date: platformDateText(state.results.doudian),
        shops: (state.results.doudian || []).map(item => buildDoudianOperationShop(item))
      },
      pdd_shop: {
        platformName: '拼多多',
        date: platformDateText(state.results.pdd),
        shops: (state.results.pdd || []).map(item => buildPddOperationShop(item))
      }
    }
  };
}

function platformDateText(list) {
  const item = (list || [])[0] || {};
  const metas = [item.shopScore?.dateMeta, item.diagnosis?.dateMeta, item.experienceOverview?.dateMeta, item.mallServeScore?.dateMeta].filter(Boolean);
  return metas[0] ? requestDateText(metas[0]) : yesterdayYmdFromNow();
}

function field(fieldName, title, value) {
  return { field: fieldName, value: value ?? '' };
}

function modulePayload(moduleKey, moduleName, dateMeta, fields) {
  return {
    moduleKey,
    moduleName,
    date: requestDateText(dateMeta),
    fields
  };
}

function detailModulePayload(moduleKey, moduleName, dateMeta, rows) {
  return {
    moduleKey,
    moduleName,
    date: requestDateText(dateMeta),
    rows
  };
}

function buildWeixinOperationShop(item) {
  const shop = item.shop || {};
  const score = item.shopScore?.summary || {};
  const diagnosis = item.diagnosis?.summary || {};
  return {
    platform: 'weixin_shop',
    platformName: '微信小店',
    date: requestDateText(item.shopScore?.dateMeta || item.diagnosis?.dateMeta),
    shop: {
      shopName: chooseWeixinShopName(shop, {}),
      id: shop.shopId || shop.appid || '',
      shopId: shop.shopId || shop.appid || '',
      logo: shop.logo || ''
    },
    storeDimension: {
      shopScoreModule: modulePayload('shopScoreModule', '店铺体验分', item.shopScore?.dateMeta, [
        field('myExperienceScore', '我的体验分', score.score || ''),
        field('goodsExperienceScore', '商品体验分', score.goodsScore || ''),
        field('logisticsExperienceScore', '物流体验分', score.logisticsScore || ''),
        field('serviceExperienceScore', '服务体验分', score.serviceScore || '')
      ]),
      diagnosisModule: modulePayload('diagnosisModule', '诊断中心', item.diagnosis?.dateMeta, [
        field('qualityReturnRate30d', '近30天品质退货率', weixinPercent(diagnosis.qualityReturnRate30d)),
        field('badReviewRate30d', '近30天差评率', weixinPercent(diagnosis.badEvaluateRate30d)),
        field('disputeInitiationRate30d', '近30天纠纷发起率', weixinPercent(diagnosis.disputeInitiationRate30d))
      ])
    },
    kfReceptionDetails: detailModulePayload('kfReceptionDetails', '客服考核-接待数据表', item.kfReception?.dateMeta, (item.kfReception?.list || []).map(r => ({
      kfName: r.kfNickname || '',
      fields: [
        field('consultUserCount', '咨询用户数', r.userCount || ''),
        field('sessionCount', '会话数', r.sessionCount || ''),
        field('replyRate', '回复率', weixinPercent(r.replyRate)),
        field('avgResponse', '平均响应', weixinSeconds(r.avgResponse)),
        field('unReplyRate', '未回复率', weixinPercent(r.unReplyRate)),
        field('satisfactionRate', '满意率', weixinPercent(r.satisfactionRate))
      ]
    }))),
    kfSalesDetails: detailModulePayload('kfSalesDetails', '客服考核-销售数据', item.kfSales?.dateMeta, (item.kfSales?.list || []).map(r => ({
      kfName: r.displayName || '',
      fields: [
        field('inquiryUserCount', '询单人数', r.consultUserCount || ''),
        field('orderUserCount', '下单人数', r.orderUserCount || ''),
        field('payUserCount', '成交人数', r.payUserCount || ''),
        field('inquiryConversionRate', '询单转化率', weixinPercent(r.conversionRate)),
        field('kfSalesAmount', '客服销售额', weixinMoney(r.payGmv))
      ]
    })))
  };
}

function buildDoudianOperationShop(item) {
  const shop = item.shop || {};
  const o = item.experienceOverview?.data || {};
  const service = item.serviceSubScore?.data || {};
  const comment = item.commentStatistics?.data || {};
  return {
    platform: 'doudian_shop',
    platformName: '抖店',
    date: requestDateText(item.experienceOverview?.dateMeta),
    shop: {
      shopName: shop.shopName || '',
      id: shop.shopId || '',
      shopId: shop.shopId || '',
      logo: shop.shopLogo || ''
    },
    storeDimension: {
      experienceOverviewModule: modulePayload('experienceOverviewModule', '我的体验分', item.experienceOverview?.dateMeta, [
        field('myExperienceScore', '我的体验分', o.experienceScore ?? ''),
        field('goodsExperienceScore', '商品体验分', o.goodsScore ?? ''),
        field('logisticsExperienceScore', '物流体验分', o.logisticsScore ?? ''),
        field('serviceExperienceScore', '服务体验分', o.serviceScore ?? ''),
        field('badBehaviorDeductScore', '差行为扣分', o.badBehaviorDeductScore ?? '')
      ]),
      newServiceExperienceModule: modulePayload('newServiceExperienceModule', '新服务体验得分', item.serviceSubScore?.dateMeta, [
        field('newServiceExperienceScore', '新服务体验得分', o.servicePreviewScore ?? service.servicePreviewScore ?? ''),
        field('pigeonEvaluationResponseDurationScore', '飞鸽评价响应时长得分', serviceItemScore(service, 322)),
        field('afterSaleAverageReviewDurationScore', '售后平均审核时长得分', serviceItemScore(service, 316)),
        field('pigeonSessionDissatisfactionScore', '飞鸽会话不满意得分', serviceItemScore(service, 317)),
        field('platformHelpRateScore', '平台求助率得分', serviceItemScore(service, 318))
      ]),
      commentOverviewModule: modulePayload('commentOverviewModule', '评价概览数据', item.commentStatistics?.dateMeta, [
        field('positiveRate30d', '近30天好评率', comment.positiveRate30d || ''),
        field('neutralRate30d', '近30天中评率', comment.neutralRate30d || ''),
        field('negativeRate30d', '近30天差评率', comment.negativeRate30d || '')
      ])
    },
    customerServiceDetails: detailModulePayload('customerServiceDetails', '客服数据', item.customerServiceStaff?.dateMeta, (item.customerServiceStaff?.data?.list || []).map(r => ({
      kfName: r.staffAccountName || r.staffNickName || '',
      fields: buildDoudianStaffExportFields(r)
    })))
  };
}

function buildDoudianStaffExportFields(r) {
  return [
    field('receivedUserCount', '已接待人数', r.servUserCnt || ''),
    field('allDayFirstResponseDuration', '全天首响时长', r.firstRespDuration || ''),
    field('workTimeThreeMinReplyRate', '工作时间3分钟回复率', r.workTimeThreeMinRespRate || ''),
    field('allDayThreeMinReplyRate', '全天3分钟回复率', r.threeMinRespRate || ''),
    field('serviceProblemSessionCount', '服务问题会话数', r.servProblemConvCnt || ''),
    field('inquiryUserCount', '询单人数', r.inquiryCnt || ''),
    field('orderUserCount', '下单人数', r.orderCnt || ''),
    field('payUserCount', '支付人数', r.payCnt || ''),
    field('afterRefundSalesAmount', '退款后销售额', r.afterRefundSaleAmount || ''),
    field('inquiryConversionRate', '询单转化率', r.inquiryOrderRate || '')
  ];
}

function buildPddOperationShop(item) {
  const shop = item.shop || {};
  const s = item.mallServeScore?.data || {};
  const q = item.saleQuality?.data || {};
  return {
    platform: 'pdd_shop',
    platformName: '拼多多',
    date: requestDateText(item.mallServeScore?.dateMeta),
    shop: {
      shopName: shop.shopName || '当前拼多多店铺',
      id: shop.shopId || '',
      shopId: shop.shopId || '',
      logo: shop.logo || ''
    },
    storeDimension: {
      mallServeScoreModule: modulePayload('mallServeScoreModule', '消费者服务体验分', item.mallServeScore?.dateMeta, [
        field('consumerServiceScore', '消费者服务体验分', s.consumerServiceScore || ''),
        field('lastAssessmentTime', '上次评估时间', item.mallServeScore?.dateMeta?.responseDate || s.readyDate || ''),
        field('serviceAttitudeScore', '服务态度体验分', s.serviceAttitudeScore || ''),
        field('baseServiceScore', '基础服务体验分', s.baseServiceScore || ''),
        field('goodsServiceScore', '商品服务体验分', s.goodsServiceScore || ''),
        field('shippingServiceScore', '发货服务体验分', s.shippingServiceScore || ''),
        field('logisticsServiceScore', '物流服务体验分', s.logisticsServiceScore || '')
      ]),
      saleQualityModule: modulePayload('saleQualityModule', '售后质量数据', item.saleQuality?.dateMeta, [
        field('disputeRefundCount', '纠纷退款数', q.disputeRefundCount ?? ''),
        field('disputeRefundRate', '纠纷退款率', q.disputeRefundRate || ''),
        field('platformInterventionOrderCount', '平台介入订单数', q.platformInterventionOrderCount ?? ''),
        field('platformInterventionRate', '平台介入率', q.platformInterventionRate || ''),
        field('qualityRefundCount', '品质退款数', q.qualityRefundCount ?? ''),
        field('qualityRefundRate', '品质退款率', q.qualityRefundRate || '')
      ])
    },
    customerServicePerformanceDetails: detailModulePayload('customerServicePerformanceDetails', '客服绩效详情', item.customerServicePerformance?.dateMeta, (item.customerServicePerformance?.data?.list || []).map(r => ({
      kfName: r.csAccount || '',
      fields: [
        field('customerServiceScore', '客服服务分', r.customerServiceScore || ''),
        field('consultUserCount', '咨询人数', r.consultUserCount || ''),
        field('inquiryUserCount', '询单人数', r.inquiryUserCount || ''),
        field('finalGroupUserCount', '最终成团人数', r.finalGroupUserCount || ''),
        field('afterRefundSalesAmount', '去退销售额', r.afterRefundSalesAmount || ''),
        field('needManualReplyConsultUserCount', '需要人工回复的咨询人数', r.needManualReplyConsultUserCount || ''),
        field('manualReceiveUserCount', '人工接待人数', r.manualReceiveUserCount || ''),
        field('threeMinUnreplyUserCount', '3分钟未回复人数', r.threeMinUnreplyUserCount || ''),
        field('threeMinManualReplyRate', '3分钟人工回复率', r.threeMinManualReplyRate || ''),
        field('thirtySecondAnswerRate', '30秒应答率', r.thirtySecondAnswerRate || ''),
        field('avgManualResponseDuration', '平均人工响应时长', r.avgManualResponseDuration || '')
      ]
    })))
  };
}

function buildFieldDefinitions() {
  return {
    weixin_shop: {
      platformName: '微信小店',
      modules: {
        shopScoreModule: { moduleName: '店铺体验分', fields: fieldDefs([
          ['myExperienceScore', '我的体验分'], ['goodsExperienceScore', '商品体验分'], ['logisticsExperienceScore', '物流体验分'], ['serviceExperienceScore', '服务体验分']
        ]) },
        diagnosisModule: { moduleName: '诊断中心', fields: fieldDefs([
          ['qualityReturnRate30d', '近30天品质退货率'], ['badReviewRate30d', '近30天差评率'], ['disputeInitiationRate30d', '近30天纠纷发起率']
        ]) },
        kfReceptionDetails: { moduleName: '客服考核-接待数据表', fields: fieldDefs([
          ['kfName', '客服'], ['consultUserCount', '咨询用户数'], ['sessionCount', '会话数'], ['replyRate', '回复率'], ['avgResponse', '平均响应'], ['unReplyRate', '未回复率'], ['satisfactionRate', '满意率']
        ]) },
        kfSalesDetails: { moduleName: '客服考核-销售数据', fields: fieldDefs([
          ['kfName', '客服'], ['inquiryUserCount', '询单人数'], ['orderUserCount', '下单人数'], ['payUserCount', '成交人数'], ['inquiryConversionRate', '询单转化率'], ['kfSalesAmount', '客服销售额']
        ]) }
      }
    },
    doudian_shop: {
      platformName: '抖店',
      modules: {
        experienceOverviewModule: { moduleName: '我的体验分', fields: fieldDefs([
          ['myExperienceScore', '我的体验分'], ['goodsExperienceScore', '商品体验分'], ['logisticsExperienceScore', '物流体验分'], ['serviceExperienceScore', '服务体验分'], ['badBehaviorDeductScore', '差行为扣分']
        ]) },
        newServiceExperienceModule: { moduleName: '新服务体验得分', fields: fieldDefs([
          ['newServiceExperienceScore', '新服务体验得分'], ['pigeonEvaluationResponseDurationScore', '飞鸽评价响应时长得分'], ['afterSaleAverageReviewDurationScore', '售后平均审核时长得分'], ['pigeonSessionDissatisfactionScore', '飞鸽会话不满意得分'], ['platformHelpRateScore', '平台求助率得分']
        ]) },
        commentOverviewModule: { moduleName: '评价概览数据', fields: fieldDefs([
          ['positiveRate30d', '近30天好评率'], ['neutralRate30d', '近30天中评率'], ['negativeRate30d', '近30天差评率']
        ]) },
        customerServiceDetails: { moduleName: '客服数据', fields: fieldDefs([
          ['kfName', '客服账号'], ['receivedUserCount', '已接待人数'], ['allDayFirstResponseDuration', '全天首响时长'], ['workTimeThreeMinReplyRate', '工作时间3分钟回复率'], ['allDayThreeMinReplyRate', '全天3分钟回复率'], ['serviceProblemSessionCount', '服务问题会话数'], ['inquiryUserCount', '询单人数'], ['orderUserCount', '下单人数'], ['payUserCount', '支付人数'], ['afterRefundSalesAmount', '退款后销售额'], ['inquiryConversionRate', '询单转化率']
        ]) }
      }
    },
    pdd_shop: {
      platformName: '拼多多',
      modules: {
        mallServeScoreModule: { moduleName: '消费者服务体验分', fields: fieldDefs([
          ['consumerServiceScore', '消费者服务体验分'], ['lastAssessmentTime', '上次评估时间'], ['serviceAttitudeScore', '服务态度体验分'], ['baseServiceScore', '基础服务体验分'], ['goodsServiceScore', '商品服务体验分'], ['shippingServiceScore', '发货服务体验分'], ['logisticsServiceScore', '物流服务体验分']
        ]) },
        saleQualityModule: { moduleName: '售后质量数据', fields: fieldDefs([
          ['disputeRefundCount', '纠纷退款数'], ['disputeRefundRate', '纠纷退款率'], ['platformInterventionOrderCount', '平台介入订单数'], ['platformInterventionRate', '平台介入率'], ['qualityRefundCount', '品质退款数'], ['qualityRefundRate', '品质退款率']
        ]) },
        customerServicePerformanceDetails: { moduleName: '客服绩效详情', fields: fieldDefs([
          ['kfName', '客服账号'], ['customerServiceScore', '客服服务分'], ['consultUserCount', '咨询人数'], ['inquiryUserCount', '询单人数'], ['finalGroupUserCount', '最终成团人数'], ['afterRefundSalesAmount', '去退销售额'], ['needManualReplyConsultUserCount', '需要人工回复的咨询人数'], ['manualReceiveUserCount', '人工接待人数'], ['threeMinUnreplyUserCount', '3分钟未回复人数'], ['threeMinManualReplyRate', '3分钟人工回复率'], ['thirtySecondAnswerRate', '30秒应答率'], ['avgManualResponseDuration', '平均人工响应时长']
        ]) }
      }
    }
  };
}

function fieldDefs(list) {
  return list.map(([fieldName, name]) => ({ field: fieldName, name }));
}

function buildApiStatsText() {
  const lines = [];
  const addPlatform = (platform, items) => {
    if (!items.length) return;
    lines.push(`【${platform}】`);
    for (const item of items) {
      lines.push(`- ${item.module} | ${item.method} | ${item.url} | 入参：${item.params || '无'}`);
    }
    lines.push('');
  };
  const wx = (state.results.weixin_shop || [])[0] || {};
  if ((state.results.weixin_shop || []).length) {
    addPlatform('微信小店', [
      { module: '诊断中心', method: 'POST', url: 'https://store.weixin.qq.com/shop-faas/mmecnodeviolationsec/prewarn/cgi/getChartData?lang=zh_CN', params: `date=${requestDateText(wx.diagnosis?.dateMeta)}` },
      { module: '店铺体验分', method: 'POST', url: 'https://store.weixin.qq.com/shop-faas/statistic/cgi/search?lang=zh_CN', params: `date=${requestDateText(wx.shopScore?.dateMeta)}；body={days:14,scoreTypeList:[11,12,13,14,1000]}` },
      { module: '客服考核-接待数据表', method: 'GET', url: 'https://store.weixin.qq.com/shop/kf/cgi/data/getOfflineTableV2', params: `date=${requestDateText(wx.kfReception?.dateMeta)}` },
      { module: '客服考核-销售数据', method: 'GET', url: 'https://store.weixin.qq.com/shop/kf/cgi/data/getSalesDetail', params: `date=${requestDateText(wx.kfSales?.dateMeta)}` }
    ]);
  }
  const dd = (state.results.doudian || [])[0] || {};
  if ((state.results.doudian || []).length) {
    addPlatform('抖店', [
      { module: '我的体验分', method: 'GET', url: 'https://fxg.jinritemai.com/governance/shop/experiencescore/getOverviewByVersion', params: `date=${requestDateText(dd.experienceOverview?.dateMeta)}` },
      { module: '新服务体验得分', method: 'GET', url: 'https://fxg.jinritemai.com/governance/shop/experiencescore/getSubScoreNew', params: `date=${requestDateText(dd.serviceSubScore?.dateMeta)}` },
      { module: '评价概览数据', method: 'GET', url: 'https://fxg.jinritemai.com/product/tcomment/statistics', params: `date=${requestDateText(dd.commentStatistics?.dateMeta)}` },
      { module: '客服数据', method: 'GET', url: 'https://pigeon.jinritemai.com/backstage/queryStaffData', params: `date=${requestDateText(dd.customerServiceStaff?.dateMeta)}` }
    ]);
  }
  const pdd = (state.results.pdd || [])[0] || {};
  if ((state.results.pdd || []).length) {
    addPlatform('拼多多', [
      { module: '店铺信息', method: 'GET', url: 'https://mms.pinduoduo.com/earth/api/mallInfo/commonMallInfo', params: '无' },
      { module: '消费者服务体验分', method: 'POST', url: 'https://mms.pinduoduo.com/sydney/api/mallService/getMallServeScoreV2', params: `date=${requestDateText(pdd.mallServeScore?.dateMeta)}；body={}` },
      { module: '售后质量数据', method: 'POST', url: 'https://mms.pinduoduo.com/sydney/api/saleQuality/querySaleQualityDetailInfo', params: `queryDate=${requestDateText(pdd.saleQuality?.dateMeta)}` },
      { module: '客服绩效详情', method: 'GET', url: 'https://mms.pinduoduo.com/chats/csReportDetail', params: `date=${requestDateText(pdd.customerServicePerformance?.dateMeta)}` }
    ]);
  }
  return lines.join('\n').trim() || '暂无接口统计。';
}

function exportCsv() {
  const rows = [];
  const push = (...cols) => rows.push(cols.map(csvCell).join(','));
  push('平台','店铺ID','店铺名称','数据类型','字段1','字段2','字段3','字段4','字段5','请求时间','采集时间');
  for (const item of state.results.weixin_shop || []) {
    const shop = item.shop || {};
    const score = item.shopScore?.summary || {};
    const diagnosis = item.diagnosis?.summary || {};
    push('微信小店', shop.appid || shop.shopId || '', shop.name || '', '诊断中心', weixinPercent(diagnosis.qualityReturnRate30d), weixinPercent(diagnosis.badEvaluateRate30d), weixinPercent(diagnosis.disputeInitiationRate30d), '', '', requestDateText(item.diagnosis?.dateMeta), item.collectedAt || '');
    push('微信小店', shop.appid || shop.shopId || '', shop.name || '', '店铺体验分', score.score || '', score.goodsScore || '', score.logisticsScore || '', score.serviceScore || '', '', requestDateText(item.shopScore?.dateMeta), item.collectedAt || '');
    for (const r of item.kfSales?.list || []) push('微信小店', shop.appid || '', shop.name || '', '客服考核-销售数据', r.displayName || '', r.consultUserCount || '', r.orderUserCount || '', r.payUserCount || '', r.payGmv || '', requestDateText(item.kfSales?.dateMeta), item.collectedAt || '');
    for (const r of item.kfReception?.list || []) push('微信小店', shop.appid || '', shop.name || '', '客服考核-接待数据表', r.kfNickname || '', r.userCount || '', r.sessionCount || '', r.replyRate || '', r.avgResponse || '', requestDateText(item.kfReception?.dateMeta), item.collectedAt || '');
  }
  for (const item of state.results.doudian || []) {
    const shop = item.shop || {};
    const o = item.experienceOverview?.data || {};
    const c = item.commentStatistics?.data || {};
    push('抖店', shop.shopId || '', shop.shopName || '', '体验分总览', o.experienceScore ?? '', o.goodsScore ?? '', o.logisticsScore ?? '', o.serviceScore ?? '', o.badBehaviorDeductScore ?? '', requestDateText(item.experienceOverview?.dateMeta), item.collectedAt || '');
    for (const s of item.serviceSubScore?.data?.items || []) push('抖店', shop.shopId || '', shop.shopName || '', '新服务体验明细', s.title || '', s.score ?? '', formatPercentNumber(s.weight), s.weightedScore ?? '', formatRawValue(s.rawValue, s.valueType), requestDateText(item.serviceSubScore?.dateMeta), item.collectedAt || '');
    push('抖店', shop.shopId || '', shop.shopName || '', '评价数据概览', c.positiveRate30d || '', c.neutralRate30d || '', c.negativeRate30d || '', c.positiveCount30d ?? '', c.negativeCount30d ?? '', requestDateText(item.commentStatistics?.dateMeta), item.collectedAt || '');
    for (const r of item.customerServiceStaff?.data?.list || []) push('抖店', shop.shopId || '', shop.shopName || '', '客服数据', r.staffAccountName || '', r.staffNickName || '', r.servConvCnt || '', r.inquiryCnt || '', r.inquiryPayAmount || '', requestDateText(item.customerServiceStaff?.dateMeta), item.collectedAt || '');
  }
  for (const item of state.results.pdd || []) {
    const shop = item.shop || {};
    const s = item.mallServeScore?.data || {};
    const q = item.saleQuality?.data || {};
    push('拼多多', shop.shopId || '', shop.shopName || '', '消费者服务体验分', s.consumerServiceScore || '', s.serviceAttitudeScore || '', s.baseServiceScore || '', s.goodsServiceScore || '', s.logisticsServiceScore || '', requestDateText(item.mallServeScore?.dateMeta), item.collectedAt || '');
    push('拼多多', shop.shopId || '', shop.shopName || '', '售后质量数据', q.disputeRefundCount ?? '', q.disputeRefundRate || '', q.platformInterventionOrderCount ?? '', q.platformInterventionRate || '', q.qualityRefundRate || '', requestDateText(item.saleQuality?.dateMeta), item.collectedAt || '');
    for (const r of item.customerServicePerformance?.data?.list || []) push('拼多多', shop.shopId || '', shop.shopName || '', '客服绩效详情', r.csAccount || '', r.customerServiceScore || '', r.consultUserCount ?? '', r.threeMinManualReplyRate || '', r.avgManualResponseDuration || '', requestDateText(item.customerServicePerformance?.dateMeta), item.collectedAt || '');
  }

  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `multi-platform-collector-${dateStamp()}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => setTimeout(() => URL.revokeObjectURL(url), 2000));
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
}

function dateStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function platformName(platform) {
  return { weixin_shop: '微信小店', doudian: '抖店', pdd: '拼多多' }[platform] || platform;
}

function formatPercentNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `${Math.round(num * 1000) / 10}%`;
}

function formatRawValue(value, valueType) {
  if (value === null || value === undefined || value === '') return '';
  if (valueType === 2) return formatPercentNumber(value);
  return String(value);
}
