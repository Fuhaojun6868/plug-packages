'use strict';

(function attachShared(root, factory) {
  const api = factory();
  root.MultiCollectorShared = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis, function createShared() {
  function firstNonEmpty(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  }

  function deepPickValue(obj, names) {
    const nameSet = new Set(names.map(n => String(n).toLowerCase()));
    const seen = new Set();
    function direct(x) {
      if (!x || typeof x !== 'object') return undefined;
      for (const [k, v] of Object.entries(x)) {
        if (nameSet.has(String(k).toLowerCase()) && v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return undefined;
    }
    function kv(x) {
      if (!x || typeof x !== 'object') return undefined;
      const key = firstNonEmpty(x.key, x.name, x.field, x.fieldName, x.metricKey, x.metricName, x.indicator, x.id, x.title);
      if (key && nameSet.has(String(key).toLowerCase())) {
        return firstNonEmpty(x.value, x.val, x.fieldValue, x.metricValue, x.data, x.num, x.text, x.score);
      }
      return undefined;
    }
    function walk(x) {
      if (x === null || x === undefined || typeof x !== 'object' || seen.has(x)) return undefined;
      seen.add(x);
      const d = direct(x);
      if (d !== undefined) return d;
      const k = kv(x);
      if (k !== undefined) return k;
      for (const v of Object.values(x)) {
        const r = walk(v);
        if (r !== undefined) return r;
      }
      return undefined;
    }
    return walk(obj);
  }

  function findDeep(object, keyNames) {
    return deepPickValue(object, keyNames);
  }

  function pickLogo(object) {
    if (!object || typeof object !== 'object') return '';
    const direct = firstNonEmpty(
      object.logo, object.headimgurl, object.headImg, object.head_img, object.headImgUrl, object.head_img_url,
      object.shopLogo, object.shop_logo, object.storeLogo, object.store_logo, object.logoUrl, object.logo_url,
      object.shopLogoUrl, object.shop_logo_url, object.avatar, object.avatarUrl, object.avatar_url,
      object.account_avatar, object.headUrl, object.head_url, object.iconUrl, object.icon_url, object.imageUrl,
      object.image_url, object.picUrl, object.pic_url, object.coverUrl, object.cover_url, object.finderHeadImg,
      object.finderHeadImgUrl
    );
    if (direct) return String(direct);
    const deep = findDeep(object, [
      'logo', 'headimgurl', 'headImg', 'head_img', 'headImgUrl', 'head_img_url', 'shopLogo', 'shop_logo',
      'logoUrl', 'logo_url', 'shopLogoUrl', 'shop_logo_url', 'avatar', 'avatarUrl', 'avatar_url',
      'account_avatar', 'finderHeadImg', 'finderHeadImgUrl'
    ]);
    if (deep) return String(deep);
    const seen = new Set();
    function walk(value) {
      if (!value) return '';
      if (typeof value === 'string') {
        if (/^(https?:)?\/\//i.test(value) && /(mmbiz\.qpic\.cn|qlogo\.cn|ecombdimg\.com|wx_fmt=|\.(jpg|jpeg|png|webp)(\?|$))/i.test(value)) return value;
        return '';
      }
      if (typeof value !== 'object' || seen.has(value)) return '';
      seen.add(value);
      for (const child of Object.values(value)) {
        const result = walk(child);
        if (result) return result;
      }
      return '';
    }
    return walk(object);
  }

  function normalizeLogo(source) {
    if (!source) return '';
    let value = String(source).trim();
    if (!value) return '';
    if (value.startsWith('//')) value = `https:${value}`;
    if (/^(wx\.qlogo\.cn|mmbiz\.qpic\.cn|qlogo\.cn|thirdwx\.qlogo\.cn)/i.test(value)) value = `https://${value}`;
    value = value.replace(/^http:\/\//i, 'https://');
    if (/^https:\/\/wx\.qlogo\.cn\/mmhead\//i.test(value) && !/\/(0|46|64|96|132)(?:\?|#|$)/.test(value)) {
      value = `${value.replace(/\/+$/, '')}/64`;
    }
    return value;
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

  function chooseWeixinShopName(previousName, nextName, appid, fallbackIndex) {
    const candidates = [nextName, previousName].filter(value => value !== undefined && value !== null && String(value).trim() !== '');
    const strong = candidates.find(value => !isWeakWeixinShopName(value, appid));
    return firstNonEmpty(strong, previousName, nextName, fallbackIndex !== undefined ? `店铺${fallbackIndex + 1}` : '', appid);
  }

  function normalizeWeixinShop(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    const store = raw.store && typeof raw.store === 'object' ? raw.store : raw;
    const appid = firstNonEmpty(raw.appid, raw.appId, raw.shopAppid, raw.authorizerAppid, raw.app_id, store.appid, store.appId, store.shopAppid);
    if (!appid || !String(appid).startsWith('wx')) return null;
    const directName = firstNonEmpty(
      raw.name, raw.nickname, raw.nickName, raw.nick_name, raw.shopName, raw.shop_name, raw.storeName, raw.store_name, raw.alias,
      raw.appName, raw.app_name, raw.displayName, raw.display_name, raw.bizName, raw.biz_name,
      store.name, store.nickname, store.nickName, store.nick_name, store.shopName, store.shop_name, store.storeName, store.store_name,
      store.appName, store.app_name, store.displayName, store.display_name, store.bizName, store.biz_name
    );
    const deepName = directName || deepPickValue(raw, [
      'shopName', 'shop_name', 'storeName', 'store_name', 'nickname', 'nickName', 'nick_name', 'name', 'appName', 'app_name', 'displayName', 'display_name', 'bizName', 'biz_name', 'alias'
    ]);
    const name = chooseWeixinShopName('', deepName, String(appid), index);
    return { appid: String(appid), shopId: String(appid), name: String(name || appid), logo: normalizeLogo(pickLogo(raw) || pickLogo(store)), index };
  }

  function extractWeixinShops(payload) {
    const shops = new Map();
    const seen = new Set();
    let sequence = 0;
    function merge(shop) {
      if (!shop || !shop.appid) return;
      const previous = shops.get(shop.appid) || {};
      shops.set(shop.appid, {
        appid: shop.appid,
        shopId: shop.appid,
        name: chooseWeixinShopName(previous.name, shop.name, shop.appid, previous.index ?? shop.index ?? sequence),
        logo: firstNonEmpty(previous.logo, shop.logo),
        index: previous.index ?? shop.index ?? sequence++
      });
    }
    function walk(value) {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      const shop = normalizeWeixinShop(value, sequence);
      if (shop) merge(shop);
      for (const child of Object.values(value)) walk(child);
    }
    walk(payload);
    return Array.from(shops.values()).sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  }

  function recordScore(item, fields) {
    let score = 0;
    for (const f of fields) {
      const v = deepPickValue(item, [f]);
      if (v !== undefined && v !== null && String(v).trim() !== '') score++;
    }
    return score;
  }

  function findArrayWithFields(obj, fields) {
    const seen = new Set();
    let best = [];
    let bestScore = 0;
    function evaluateArray(arr) {
      if (!Array.isArray(arr) || !arr.length) return;
      const totalScore = arr.reduce((sum, item) => sum + recordScore(item, fields), 0);
      if (totalScore > bestScore) {
        best = arr;
        bestScore = totalScore;
      }
    }
    function walk(x) {
      if (!x || typeof x !== 'object' || seen.has(x)) return;
      seen.add(x);
      if (Array.isArray(x)) {
        evaluateArray(x);
        x.forEach(walk);
        return;
      }
      for (const key of ['list', 'rows', 'dataList', 'items', 'table', 'tableData', 'detailList', 'resultList', 'records']) {
        if (Array.isArray(x[key])) evaluateArray(x[key]);
      }
      for (const v of Object.values(x)) walk(v);
    }
    walk(obj);
    if (best.length) return best;
    if (recordScore(obj, fields) > 0) return [obj];
    return [];
  }

  function normalizeKfReceptionList(raw) {
    const list = findArrayWithFields(raw, [
      'kfNickname', 'kfHeadImg', 'userCount', 'sessionCount', 'replyRate', 'avgReplyTime', 'unReplyRate', 'satisfactionRate'
    ]);
    return list.map(item => {
      const sessionCount = firstNonEmpty(deepPickValue(item, ['sessionCount', 'sessionCnt', 'conversationCount', 'conversationCnt', 'convCount', 'kf_session_cnt', 'talkCnt', 'chatCnt']), '');
      const userCount = firstNonEmpty(deepPickValue(item, ['userCount', 'user_count', 'consultUserCount', 'consult_user_count', 'consultUserCnt', 'kf_consult_user_cnt']), '');
      return {
        kfNickname: String(firstNonEmpty(deepPickValue(item, ['kfNickname', 'nickname', 'displayName', 'name', 'realName']), '--')),
        kfHeadImg: normalizeLogo(deepPickValue(item, ['kfHeadImg', 'headImg', 'headUrl', 'avatarUrl', 'headimgurl', 'headImgUrl', 'kf_head_img']) || ''),
        userCount,
        sessionCount: firstNonEmpty(sessionCount, deepPickValue(item, ['conversationCount', 'session_count']), userCount, ''),
        replyRate: firstNonEmpty(deepPickValue(item, ['replyRate', 'reply_rate', 'replyRateValue', 'kf_reply_rate', '5min_reply_rate']), ''),
        avgResponse: firstNonEmpty(deepPickValue(item, ['avgResponse', 'avgReplyTime', 'avg_reply_time', 'averageReplyTime', 'avgRespDuration', 'replyAvgTime']), ''),
        unReplyRate: firstNonEmpty(deepPickValue(item, ['unReplyRate', 'unreplyRate', 'unreply_rate', 'notReplyRate', 'un_reply_rate']), ''),
        satisfactionRate: firstNonEmpty(deepPickValue(item, ['satisfactionRate', 'satisfyRate', 'satisfiedRate', 'satisfaction_rate', 'kf_satisfaction_rate']), '')
      };
    }).filter(x => x.kfNickname !== '--' || x.kfHeadImg || String(x.userCount || x.sessionCount || '').trim() !== '');
  }

  function normalizeKfSalesList(raw) {
    const list = findArrayWithFields(raw, [
      'displayName', 'headUrl', 'kf_market_panel_kf_consult_user_cnt', 'kf_market_panel_kf_order_user_cnt',
      'kf_market_panel_kf_pay_user_cnt', 'conversionRate', 'kf_market_panel_kf_kefu_pay_gmv'
    ]);
    return list.map(item => {
      const consult = firstNonEmpty(deepPickValue(item, ['kf_market_panel_kf_consult_user_cnt', 'consultUserCount', 'consult_user_count', 'consultUserCnt', 'inquiryUserCount', 'inquiry_user']), '');
      const order = firstNonEmpty(deepPickValue(item, ['kf_market_panel_kf_order_user_cnt', 'orderUserCount', 'order_user_count', 'orderUserCnt']), '');
      const pay = firstNonEmpty(deepPickValue(item, ['kf_market_panel_kf_pay_user_cnt', 'payUserCount', 'pay_user_count', 'payUserCnt', 'finalGroupUser', 'final_group_user']), '');
      const conversion = firstNonEmpty(deepPickValue(item, ['conversionRate', 'kf_market_panel_kf_conversion_rate', 'convertRate', 'payConversionRate', 'inquiry_group_rate']), '');
      const gmv = firstNonEmpty(deepPickValue(item, ['kf_market_panel_kf_kefu_pay_gmv', 'payGmv', 'gmv', 'kefuPayGmv', 'payAmount', 'cs_sales_amount']), '');
      return {
        displayName: String(firstNonEmpty(deepPickValue(item, ['displayName', 'kfNickname', 'nickname', 'name', 'realName', 'cs_name']), '--')),
        headUrl: normalizeLogo(deepPickValue(item, ['headUrl', 'kfHeadImg', 'headImg', 'avatarUrl', 'headimgurl', 'headImgUrl', 'kf_head_img']) || ''),
        consultUserCount: consult,
        orderUserCount: order,
        payUserCount: pay,
        conversionRate: conversion,
        payGmv: gmv,
        kf_market_panel_kf_consult_user_cnt: consult,
        kf_market_panel_kf_order_user_cnt: order,
        kf_market_panel_kf_pay_user_cnt: pay,
        kf_market_panel_kf_kefu_pay_gmv: gmv
      };
    }).filter(x => x.displayName !== '--' || x.headUrl || String(x.consultUserCount || x.payGmv || '').trim() !== '');
  }

  function extractResponseData(raw) {
    if (!raw || typeof raw !== 'object') return {};
    return raw.data || raw.result || raw.respData || raw;
  }

  function findDeepObjectByKey(obj, names) {
    const nameSet = new Set(names.map(n => String(n).toLowerCase()));
    const seen = new Set();
    function walk(x) {
      if (!x || typeof x !== 'object' || seen.has(x)) return null;
      seen.add(x);
      for (const [key, value] of Object.entries(x)) {
        if (nameSet.has(String(key).toLowerCase()) && value && typeof value === 'object') return value;
      }
      for (const value of Object.values(x)) {
        const found = walk(value);
        if (found) return found;
      }
      return null;
    }
    return walk(obj);
  }

  function metricCurrentValue(obj) {
    if (!obj || typeof obj !== 'object') return '';
    return firstNonEmpty(obj.curValue, obj.currentValue, obj.value, obj.score, obj.shop, obj.num, obj.metricValue, obj.val, obj.text);
  }

  function extractWeixinShopScoreSummary(raw) {
    const data = extractResponseData(raw);
    const dsrScore = findDeepObjectByKey(data, ['dsrScore', 'shopScore', 'storeScore', 'overallScore']) || {};
    const productScore = findDeepObjectByKey(data, ['productScore', 'goodsScore', 'commodityScore']) || {};
    const deliverScore = findDeepObjectByKey(data, ['deliverScore', 'deliveryScore', 'logisticsScore']) || {};
    const serviceScore = findDeepObjectByKey(data, ['serviceScore', 'customerServiceScore', 'afterSaleScore']) || {};
    return {
      score: firstNonEmpty(metricCurrentValue(dsrScore), deepPickValue(raw, ['score', 'shopScore', 'shop_score', 'experienceScore', 'totalScore', 'value']), ''),
      goodsScore: firstNonEmpty(metricCurrentValue(productScore), deepPickValue(raw, ['goodsScore', 'goods_score', 'productScore']), ''),
      logisticsScore: firstNonEmpty(metricCurrentValue(deliverScore), deepPickValue(raw, ['logisticsScore', 'logistics_score', 'deliverScore', 'deliveryScore']), ''),
      serviceScore: firstNonEmpty(metricCurrentValue(serviceScore), deepPickValue(raw, ['serviceScore', 'service_score', 'customerServiceScore', 'afterSaleScore']), ''),
      rawMetrics: { dsrScore, productScore, deliverScore, serviceScore }
    };
  }

  function extractWeixinDiagnosisSummary(raw) {
    const data = extractResponseData(raw);
    const qualityRate = findDeepObjectByKey(data, ['qualityRate']) || {};
    const badEvaluateRate = findDeepObjectByKey(data, ['badEvaluateRate']) || {};
    const validComplaintRate = findDeepObjectByKey(data, ['validComplaintRate']) || {};
    return {
      qualityReturnRate30d: firstNonEmpty(qualityRate.shop, qualityRate.curValue, qualityRate.value, deepPickValue(raw, ['qualityRateShop', 'qualityReturnRate30d']), ''),
      badEvaluateRate30d: firstNonEmpty(badEvaluateRate.shop, badEvaluateRate.curValue, badEvaluateRate.value, deepPickValue(raw, ['badEvaluateRateShop', 'badEvaluateRate30d']), ''),
      disputeInitiationRate30d: firstNonEmpty(validComplaintRate.shop, validComplaintRate.curValue, validComplaintRate.value, deepPickValue(raw, ['validComplaintRateShop', 'disputeInitiationRate30d']), ''),
      rawMetrics: { qualityRate, badEvaluateRate, validComplaintRate }
    };
  }

  function yesterdayRangeSeconds() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 0);
    return { beginDate: Math.floor(start.getTime() / 1000), endDate: Math.floor(end.getTime() / 1000) };
  }

  function truthyFlag(value) {
    if (value === true || value === 1) return true;
    const text = String(value ?? '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'selected', 'current', 'active', 'login', 'loggedin', 'using'].includes(text);
  }

  function doudianCurrentScore(item) {
    if (!item || typeof item !== 'object') return 0;
    let score = 0;
    for (const key of ['is_current', 'isCurrent', 'current', 'selected', 'is_selected', 'checked', 'active', 'is_active', 'is_login', 'isLogin', 'login', 'using']) {
      if (truthyFlag(item[key])) score += 2;
    }
    for (const key of ['login_status', 'status', 'subject_status']) {
      const text = String(item[key] ?? '').toLowerCase();
      if (['current', 'selected', 'active', 'using', 'logined', 'loggedin'].includes(text)) score += 2;
    }
    return score;
  }

  function normalizeDoudianSubjects(raw) {
    const list = Array.isArray(raw?.data?.login_subject_list) ? raw.data.login_subject_list : [];
    return list.map((item, index) => ({
      platform: 'doudian',
      shopId: String(item.account_id || ''),
      shopName: String(item.account_name || item.account_id || `抖店${index + 1}`),
      shopLogo: normalizeLogo(item.account_avatar || ''),
      accountId: String(item.account_id || ''),
      accountName: String(item.account_name || ''),
      subjectId: String(item.subject_id || ''),
      memberId: String(item.member_id || ''),
      busMemberId: String(item.bus_member_id || ''),
      encodeShopId: String(item.encode_shop_id || ''),
      encodeMemberId: String(item.encode_member_id || ''),
      canLogin: item.can_login === true,
      identityTypeDesc: String(item.identity_type_desc || ''),
      labels: Array.isArray(item.bottom_label) ? item.bottom_label.filter(x => x && x.show !== false).map(x => String(x.text || '')).filter(Boolean) : [],
      currentScore: doudianCurrentScore(item),
      current: doudianCurrentScore(item) > 0,
      index,
      raw: item
    })).filter(x => x.shopId || x.subjectId);
  }

  function encodeDoudianId(value) {
    return String(value || '').split('').map(ch => (ch.charCodeAt(0) ^ 5).toString(16).padStart(2, '0')).join('');
  }

  function nullIfSentinel(value) {
    if (value === -9999 || value === '-9999') return null;
    return value ?? null;
  }

  function normalizeDoudianExperienceOverview(raw) {
    const data = raw?.data || {};
    return {
      shopId: data.shop_id ? String(data.shop_id) : '',
      shopName: data.shop_name || '',
      category: data.category || '',
      hasData: data.has_data === true,
      updateTime: data.update_time || null,
      experienceScore: data.experience_score?.value ?? null,
      experienceRating: data.experience_score?.rating ?? '',
      goodsScore: data.goods_score?.value ?? null,
      goodsRating: data.goods_score?.rating ?? '',
      goodsWeight: data.goods_score?.weight ?? null,
      goodsWeightedScore: data.goods_score?.score_weight ?? null,
      logisticsScore: data.logistics_score?.value ?? null,
      logisticsRating: data.logistics_score?.rating ?? '',
      logisticsWeight: data.logistics_score?.weight ?? null,
      logisticsWeightedScore: data.logistics_score?.score_weight ?? null,
      serviceScore: data.service_score?.value ?? null,
      servicePreviewScore: data.service_score?.score_preview ?? null,
      serviceRating: data.service_score?.rating ?? '',
      serviceWeight: data.service_score?.weight ?? null,
      serviceWeightedScore: data.service_score?.score_weight ?? null,
      badBehaviorDeductScore: data.bad_behavior_deduct_score?.value ?? 0,
      badBehaviorRating: data.bad_behavior_deduct_score?.rating ?? '',
      fiveScore: data.score_five_info?.score ?? null,
      fiveGoodsScore: data.score_five_info?.goods_score ?? null,
      fiveLogisticsScore: data.score_five_info?.logistics_score ?? null,
      fiveServiceScore: data.score_five_info?.service_score ?? null,
      raw: data
    };
  }

  const NEW_SERVICE_NODE_IDS = new Set([322, 316, 317, 318]);
  const SERVICE_NODE_LABELS = {
    322: '飞鸽评价响应时长得分',
    316: '售后平均审核时长得分',
    317: '飞鸽会话不满意率得分',
    318: '平台求助率得分'
  };

  function normalizeDoudianServiceSubScore(raw) {
    const data = raw?.data || {};
    const list = Array.isArray(data.shop_analysis) ? data.shop_analysis : [];
    const items = list.filter(item => NEW_SERVICE_NODE_IDS.has(Number(item.experience_node))).map(item => ({
      nodeId: Number(item.experience_node),
      title: SERVICE_NODE_LABELS[Number(item.experience_node)] || `${item.title || ''}得分`,
      metricTitle: item.title || '',
      rawValue: nullIfSentinel(item.value?.value_figure),
      valueType: item.value?.value_type ?? null,
      score: item.node_score_info?.node_score ?? null,
      weight: item.node_score_info?.node_weight ?? null,
      weightedScore: item.node_score_info?.node_score_weight ?? null,
      compareWithYesterday: item.compare_with_self?.rise_than_yesterday ?? null,
      numeratorTitle: item.calculate_numerator?.[0]?.sub_title || '',
      numeratorValue: item.calculate_numerator?.[0]?.value ?? null,
      denominatorTitle: item.calculate_denominator?.sub_title || '',
      denominatorValue: item.calculate_denominator?.value ?? null,
      raw: item
    })).sort((a, b) => [322, 316, 317, 318].indexOf(a.nodeId) - [322, 316, 317, 318].indexOf(b.nodeId));
    return {
      shopId: data.shop_id ? String(data.shop_id) : '',
      shopName: data.shop_name || '',
      beginDate: data.begin_date || '',
      currentDate: data.current_date || '',
      latest30OrderCount: data.shop_order_latest_30_cnt ?? null,
      servicePreviewScore: items.reduce((sum, item) => sum + Number(item.weightedScore || 0), 0),
      items,
      raw: data
    };
  }

  function normalizeDoudianCommentStatistics(raw) {
    const data = raw?.data || {};
    return {
      latestDate: data.latestDate || '',
      positiveRate30d: data.positive_comment_rate?.last_30days_value || '',
      positiveCount30d: data.positive_commnet_count_30d ?? null,
      positiveEcologyScoreCount30d: data.positive_commnet_in_ecology_score_count_30d ?? '',
      positiveCompareLast7days: data.positive_comment_rate?.compare_last_7days_value || '',
      positiveAheadPeers: data.positive_comment_rate?.ahead_peers_value || '',
      neutralRate30d: data.neutral_comment_rate?.last_30days_value || '',
      neutralCount30d: data.neutral_comment_count_30d ?? null,
      neutralEcologyScoreCount30d: data.neutral_comment_in_ecology_score_count_30d ?? '',
      neutralCompareLast7days: data.neutral_comment_rate?.compare_last_7days_value || '',
      neutralAheadPeers: data.neutral_comment_rate?.ahead_peers_value || '',
      negativeRate30d: data.negative_comment_rate?.last_30days_value || '',
      negativeCount30d: data.negative_comment_count_30d ?? null,
      negativeEcologyScoreCount30d: data.negative_comment_in_ecology_score_count_30d ?? '',
      negativeCompareLast7days: data.negative_comment_rate?.compare_last_7days_value || '',
      negativeAheadPeers: data.negative_comment_rate?.ahead_peers_value || '',
      orderCommentRate30d: data.order_comment_rate?.last_30days_value || '',
      newOrderComment30d: data.new_order_comment_30d?.last_30days_value ?? null,
      raw: data
    };
  }


  function unwrapDisplayValue(value) {
    if (value && typeof value === 'object' && 'fieldValue' in value) return value.fieldValue;
    if (value === null || value === undefined || value === '') return '-';
    return value;
  }

  function normalizeDoudianCustomerServiceStaff(raw) {
    const data = raw?.data || {};
    const list = Array.isArray(data.staffDataModel) ? data.staffDataModel : [];
    const rows = list.map((item, index) => {
      const user = item.staffUserInfo || {};
      return {
        rank: item.rank ?? index + 1,
        staffId: String(user.staffId || item.staffId || ''),
        staffAccountName: user.staffAccountName || item.staffAccountName || item.staffName || '',
        staffNickName: user.staffNickName || item.staffNickName || item.staffName || '',
        staffName: item.staffName || user.staffNickName || user.staffAccountName || '',
        staffOnlineDays: unwrapDisplayValue(item.staffOnlineDays),
        staffOnlineTotalDuration: unwrapDisplayValue(item.staffOnlineTotalDuration),
        staffNapTotalDuration: unwrapDisplayValue(item.staffNapTotalDuration),
        maxServiceNum: unwrapDisplayValue(item.maxServiceNum),
        servConvCnt: unwrapDisplayValue(item.servConvCnt),
        toReplyConvCnt: unwrapDisplayValue(item.toReplyConvCnt),
        servUserCnt: unwrapDisplayValue(item.servUserCnt),
        inChatNum: unwrapDisplayValue(item.inChatNum ?? item.inServiceUserCnt ?? item.servingUserCnt),
        outConvCnt: unwrapDisplayValue(item.outConvCnt),
        workSaturation: unwrapDisplayValue(item.workSaturation),
        validCommentCnt: unwrapDisplayValue(item.validCommentCnt),
        validGoodCommentCnt: unwrapDisplayValue(item.validGoodCommentCnt),
        validBadCommentCnt: unwrapDisplayValue(item.validBadCommentCnt),
        unSatisfyRate: unwrapDisplayValue(item.unSatisfyRate),
        workTimeUnSatisfyRate: unwrapDisplayValue(item.workTimeUnSatisfyRate),
        satisfyRate: unwrapDisplayValue(item.satisfyRate),
        workTimeSatisfyRate: unwrapDisplayValue(item.workTimeSatisfyRate),
        workTimeAvgRespDuration: unwrapDisplayValue(item.workTimeAvgRespDuration),
        avgRespDuration: unwrapDisplayValue(item.avgRespDuration),
        workTimeFirstRespDuration: unwrapDisplayValue(item.workTimeFirstRespDuration),
        firstRespDuration: unwrapDisplayValue(item.firstRespDuration),
        workTimeThreeMinRespRate: unwrapDisplayValue(item.workTimeThreeMinRespRate),
        threeMinRespRate: unwrapDisplayValue(item.threeMinRespRate),
        servProblemConvCnt: unwrapDisplayValue(item.servProblemConvCnt),
        inquiryCnt: unwrapDisplayValue(item.inquiryCnt),
        orderCnt: unwrapDisplayValue(item.orderCnt),
        payCnt: unwrapDisplayValue(item.payCnt),
        refundCnt: unwrapDisplayValue(item.refundCnt),
        inquiryPayAmount: unwrapDisplayValue(item.inquiryPayAmount),
        refundAmount: unwrapDisplayValue(item.refundAmount),
        afterRefundSaleAmount: unwrapDisplayValue(item.afterRefundSaleAmount),
        inquiryOrderRate: unwrapDisplayValue(item.inquiryOrderRate),
        raw: item
      };
    });
    return {
      total: Number(data.total ?? raw?.total ?? rows.length) || rows.length,
      list: rows,
      core: data.staffCoreDataModel || null,
      raw: data
    };
  }

  return {
    firstNonEmpty,
    deepPickValue,
    pickLogo,
    normalizeLogo,
    extractWeixinShops,
    normalizeKfReceptionList,
    normalizeKfSalesList,
    extractWeixinShopScoreSummary,
    extractWeixinDiagnosisSummary,
    yesterdayRangeSeconds,
    normalizeDoudianSubjects,
    encodeDoudianId,
    truthyFlag,
    doudianCurrentScore,
    normalizeDoudianExperienceOverview,
    normalizeDoudianServiceSubScore,
    normalizeDoudianCommentStatistics,
    normalizeDoudianCustomerServiceStaff
  };
});
