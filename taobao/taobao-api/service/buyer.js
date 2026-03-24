const crypto = require('crypto');
const zlib = require('zlib');

const DEFAULT_CREATE_EX_PARAMS = {
  page_from_type: 'main_site_pc',
  openFrom: 'carts',
  installApp: '',
  umfVersions: {
    version: '0.1.0',
    features: {}
  },
  cartTraceId: '',
  coVersion: '2.0'
};

const DEFAULT_CONFIRM_ORDER_EX_PARAMS = {
  pageVersion: '0.0.45',
  page_from_type: 'main_site_pc',
  pcTBNewBuy: '1',
  pcWebxOrderFromType: 'FROM_MALL_CART',
  pcRenderOrderRequestUrl: 'http://buy.tmall.com/order/confirm_order.htm'
};

const maskCookie = cookie => {
  if (!cookie) {
    return '';
  }

  return cookie
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [key, ...rest] = item.split('=');
      if (!rest.length) {
        return item;
      }
      return `${key}=***`;
    })
    .join('; ');
};

const parseCookieValue = (cookie, key) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${escapedKey}=([^;]+)`));
  return match ? match[1] : '';
};

const replaceAll = (input, searchValue, replaceValue) => {
  if (searchValue === undefined || searchValue === null || searchValue === '') {
    return input;
  }

  return String(input).split(String(searchValue)).join(String(replaceValue));
};

const tryParseJSON = value => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const cloneJSON = value => JSON.parse(JSON.stringify(value));

const normalizeObject = value => {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    return tryParseJSON(value) || {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return cloneJSON(value);
  }

  return {};
};

const serializeLike = (template, value) => (typeof template === 'string' ? JSON.stringify(value) : value);

class Buyer {
  config = {};
  succeed = false;

  constructor(config) {
    this.config = config;
  }

  md5(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  getToken() {
    const tokenValue = parseCookieValue(this.config.cookie || '', '_m_h5_tk');
    if (!tokenValue) {
      throw new Error('cookie 缺少 _m_h5_tk，无法生成 sign');
    }
    return tokenValue.split('_')[0];
  }

  getRequestData(payload = {}) {
    const requestData = payload.requestData || this.config.requestData || this.config.data;
    if (!requestData || typeof requestData !== 'object' || Array.isArray(requestData)) {
      throw new Error('requestData 必须是对象');
    }
    return requestData;
  }

  decodeParamsPayload(paramsValue) {
    if (!paramsValue || typeof paramsValue !== 'string') {
      throw new Error('params 必须是字符串');
    }

    try {
      return JSON.parse(zlib.gunzipSync(Buffer.from(paramsValue, 'base64')).toString('utf8'));
    } catch (error) {
      throw new Error(`params 解码失败: ${error.message}`);
    }
  }

  encodeParamsPayload(paramsObject) {
    return zlib.gzipSync(Buffer.from(JSON.stringify(paramsObject), 'utf8')).toString('base64');
  }

  parseBuyParam(buyParam) {
    const parts = String(buyParam || '').split('_');
    const extensions = {};

    (parts[13] || '').split('~~').forEach(item => {
      if (!item) {
        return;
      }
      const [key, ...rest] = item.split('~');
      extensions[key] = rest.join('~');
    });

    return {
      parts,
      extensions,
      itemId: parts[0] || '',
      quantity: parts[1] || '',
      skuId: parts[2] || '',
      cartId: parts[7] || ''
    };
  }

  parseCombinedBuyParam(buyParam) {
    return String(buyParam || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  stringifyBuyParam(parsedBuyParam) {
    const parts = parsedBuyParam.parts.slice();
    parts[13] = Object.entries(parsedBuyParam.extensions)
      .map(([key, value]) => `${key}~${value}`)
      .join('~~');
    return parts.join('_');
  }

  buildRebuildContext(requestData, rebuild = {}) {
    const parsedBuyParam = this.parseBuyParam(requestData.buyParam || '');
    const decodedParams = this.decodeParamsPayload(requestData.params || '');
    const hiddenExParamsText = decodedParams?.data?.pcTaoBuy?.features?.linkage?.hidden?.extensionMap?.exParams || '{}';
    const hiddenExParams = tryParseJSON(hiddenExParamsText) || {};
    const utparam = tryParseJSON(hiddenExParams.utparam) || {};
    const outerExParams = typeof requestData.exParams === 'string' ? tryParseJSON(requestData.exParams) || {} : requestData.exParams || {};
    const renderPriceKey = Object.keys(hiddenExParams).find(key => key.endsWith('_renderPrice')) || '';
    const promotionShopIdMatch = String(hiddenExParams.promotionCompressInfo || '').match(/:(\d+)/);
    const selectedAddressId = decodedParams?.data?.address?.fields?.selectedId || parsedBuyParam.extensions.iCartAddressId || '';

    const template = {
      itemId: parsedBuyParam.itemId || hiddenExParams.id || '',
      quantity: parsedBuyParam.quantity || '1',
      skuId: parsedBuyParam.skuId || hiddenExParams.skuId || '',
      cartId: parsedBuyParam.cartId || '',
      shopId: promotionShopIdMatch ? promotionShopIdMatch[1] : '',
      addressId: selectedAddressId,
      cartTraceId: outerExParams.cartTraceId || parsedBuyParam.extensions.priceTrace || '',
      cartCreateTime: parsedBuyParam.extensions.cartCreateTime || '',
      xxc: hiddenExParams.xxc || parsedBuyParam.extensions.xxc || '',
      pcOrderFrom: hiddenExParams.pcOrderFrom || parsedBuyParam.extensions.pcOrderFrom || '',
      icart: parsedBuyParam.extensions.icart || '',
      priceTraceTotal: parsedBuyParam.extensions.priceTraceTotal || '',
      priceTraceTotalDiscount: parsedBuyParam.extensions.priceTraceTotalDiscount || '',
      totalFeeCent: hiddenExParams.alipayFrontRenderTotalFeeCENT || parsedBuyParam.extensions.priceTraceTotal || '',
      renderPriceKey
    };

    const normalizedRebuild = {};
    Object.entries(rebuild).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        normalizedRebuild[key] = value;
      }
    });

    return {
      rebuild: {
        ...template,
        ...normalizedRebuild
      },
      overrideKeys: new Set(Object.keys(normalizedRebuild)),
      template,
      parsedBuyParam,
      decodedParams,
      hiddenExParams,
      utparam,
      outerExParams
    };
  }

  rebuildBuyParamValue(buyParam, context) {
    const parsedBuyParam = this.parseBuyParam(buyParam);
    const next = {
      parts: parsedBuyParam.parts.slice(),
      extensions: {
        ...parsedBuyParam.extensions
      }
    };

    next.parts[0] = String(context.rebuild.itemId);
    next.parts[1] = String(context.rebuild.quantity || '1');
    next.parts[2] = String(context.rebuild.skuId);
    next.parts[7] = String(context.rebuild.cartId || parsedBuyParam.cartId);

    if (context.overrideKeys.has('priceTraceTotal')) {
      next.extensions.priceTraceTotal = String(context.rebuild.priceTraceTotal);
    }
    if (context.overrideKeys.has('priceTraceTotalDiscount')) {
      next.extensions.priceTraceTotalDiscount = String(context.rebuild.priceTraceTotalDiscount);
    }
    if (context.overrideKeys.has('cartTraceId')) {
      next.extensions.priceTrace = String(context.rebuild.cartTraceId);
    }
    if (context.overrideKeys.has('addressId')) {
      next.extensions.iCartAddressId = String(context.rebuild.addressId);
    }
    if (context.overrideKeys.has('cartCreateTime')) {
      next.extensions.cartCreateTime = String(context.rebuild.cartCreateTime);
    }
    if (context.overrideKeys.has('xxc')) {
      next.extensions.xxc = String(context.rebuild.xxc);
    }
    if (context.overrideKeys.has('pcOrderFrom')) {
      next.extensions.pcOrderFrom = String(context.rebuild.pcOrderFrom);
    }
    if (context.overrideKeys.has('icart')) {
      next.extensions.icart = String(context.rebuild.icart);
    }

    return this.stringifyBuyParam(next);
  }

  rebuildParamsValue(context) {
    const decodedParams = cloneJSON(context.decodedParams);
    const hiddenExParams = {
      ...context.hiddenExParams
    };
    const utparam = {
      ...context.utparam
    };

    hiddenExParams.id = String(context.rebuild.itemId);
    hiddenExParams.skuId = String(context.rebuild.skuId);
    hiddenExParams.xxc = String(context.rebuild.xxc || hiddenExParams.xxc || '');
    hiddenExParams.pcOrderFrom = String(context.rebuild.pcOrderFrom || hiddenExParams.pcOrderFrom || '');

    if (context.overrideKeys.has('totalFeeCent')) {
      hiddenExParams.alipayFrontRenderTotalFeeCENT = String(context.rebuild.totalFeeCent);
      if (context.template.renderPriceKey) {
        hiddenExParams[context.template.renderPriceKey] = Number(context.rebuild.totalFeeCent);
      }
    }

    if (utparam.x_object_id !== undefined) {
      utparam.x_object_id = Number(context.rebuild.itemId);
    }

    hiddenExParams.utparam = JSON.stringify(utparam);
    decodedParams.data.pcTaoBuy.features.linkage.hidden.extensionMap.exParams = JSON.stringify(hiddenExParams);

    if (decodedParams?.data?.address?.fields?.selectedId !== undefined && context.overrideKeys.has('addressId')) {
      decodedParams.data.address.fields.selectedId = String(context.rebuild.addressId);
    }

    if (Array.isArray(decodedParams?.data?.address?.fields?.options) && context.overrideKeys.has('addressId')) {
      decodedParams.data.address.fields.options = decodedParams.data.address.fields.options.map(option => ({
        ...option,
        ...(option.selected ? { deliveryAddressId: String(context.rebuild.addressId) } : {})
      }));
    }

    let jsonText = JSON.stringify(decodedParams);

    if (context.template.itemId && context.template.itemId !== String(context.rebuild.itemId)) {
      jsonText = replaceAll(jsonText, context.template.itemId, String(context.rebuild.itemId));
    }
    if (context.template.skuId && context.template.skuId !== String(context.rebuild.skuId)) {
      jsonText = replaceAll(jsonText, context.template.skuId, String(context.rebuild.skuId));
    }
    if (context.overrideKeys.has('addressId') && context.template.addressId && context.template.addressId !== String(context.rebuild.addressId)) {
      jsonText = replaceAll(jsonText, context.template.addressId, String(context.rebuild.addressId));
    }
    if (context.overrideKeys.has('cartTraceId') && context.template.cartTraceId && context.template.cartTraceId !== String(context.rebuild.cartTraceId)) {
      jsonText = replaceAll(jsonText, context.template.cartTraceId, String(context.rebuild.cartTraceId));
    }
    if (context.overrideKeys.has('shopId') && context.template.shopId && context.template.shopId !== String(context.rebuild.shopId)) {
      jsonText = replaceAll(jsonText, `shopCard_${context.template.shopId}`, `shopCard_${context.rebuild.shopId}`);
      jsonText = replaceAll(jsonText, `shopTitle_${context.template.shopId}`, `shopTitle_${context.rebuild.shopId}`);
      jsonText = replaceAll(jsonText, `:${context.template.shopId}`, `:${context.rebuild.shopId}`);
      jsonText = replaceAll(jsonText, `s_${context.template.shopId}=`, `s_${context.rebuild.shopId}=`);
    }

    return this.encodeParamsPayload(JSON.parse(jsonText));
  }

  rebuildRequestData(payload = {}) {
    const requestData = cloneJSON(this.getRequestData(payload));
    const cartItem = this.normalizeCartItem(payload.cartItem);
    const rebuild = {
      ...(cartItem ? this.buildRebuildFromCartItem(cartItem) : {}),
      ...(payload.rebuild || {})
    };

    if (!Object.keys(rebuild).length) {
      return requestData;
    }

    if (cartItem?.settlement) {
      requestData.buyParam = cartItem.settlement;
    }

    const context = this.buildRebuildContext(requestData, rebuild);
    requestData.buyParam = this.rebuildBuyParamValue(requestData.buyParam || '', context);
    requestData.params = this.rebuildParamsValue(context);

    if (requestData.exParams) {
      const nextOuterExParams = {
        ...context.outerExParams
      };
      if (context.rebuild.cartTraceId) {
        nextOuterExParams.cartTraceId = String(context.rebuild.cartTraceId);
      }
      requestData.exParams = typeof requestData.exParams === 'string' ? JSON.stringify(nextOuterExParams) : nextOuterExParams;
    }

    return requestData;
  }

  getConfirmOrderExParams(payload = {}) {
    return {
      ...DEFAULT_CONFIRM_ORDER_EX_PARAMS,
      ...normalizeObject(this.config.confirmOrderExParams),
      ...normalizeObject(payload.confirmOrderExParams)
    };
  }

  buildCreateExParams(payload = {}, buyParam = '') {
    const baseRequestData = this.getRequestData(payload);
    const baseExParams = normalizeObject(baseRequestData.exParams);
    const payloadExParams = normalizeObject(payload.createExParams || payload.exParams);
    const traceIdFromBuyParam = this.parseCombinedBuyParam(buyParam)
      .map(item => this.parseBuyParam(item).extensions.priceTrace || '')
      .find(Boolean);

    const nextExParams = {
      ...DEFAULT_CREATE_EX_PARAMS,
      ...baseExParams,
      ...payloadExParams
    };

    if (!nextExParams.cartTraceId) {
      nextExParams.cartTraceId = payload.cartTraceId || traceIdFromBuyParam || '';
    }

    return nextExParams;
  }

  normalizeCartItems(cartItems) {
    if (Array.isArray(cartItems)) {
      return cartItems.map(item => this.normalizeCartItem(item)).filter(Boolean);
    }

    const singleItem = this.normalizeCartItem(cartItems);
    return singleItem ? [singleItem] : [];
  }

  resolveConfirmCartItems(payload = {}) {
    if (payload.cartItems?.items && Array.isArray(payload.cartItems.items)) {
      return this.normalizeCartItems(payload.cartItems.items);
    }

    if (payload.cartItems?.data?.items && Array.isArray(payload.cartItems.data.items)) {
      return this.normalizeCartItems(payload.cartItems.data.items);
    }

    return this.normalizeCartItems(payload.cartItems || payload.cartItem);
  }

  resolveConfirmBuyParam(payload = {}, cartItems = []) {
    const directBuyParam = String(payload.buyParam || '').trim();
    if (directBuyParam) {
      return directBuyParam;
    }

    return cartItems
      .map(item => item?.settlement)
      .filter(Boolean)
      .join(',');
  }

  buildConfirmOrderRequestData(payload = {}, cartItems = []) {
    const buyParam = this.resolveConfirmBuyParam(payload, cartItems);
    if (!buyParam) {
      throw new Error('确认订单缺少 buyParam 或 cartItems.settlement');
    }

    return {
      exParams: JSON.stringify(this.getConfirmOrderExParams(payload)),
      buyParam
    };
  }

  extractConfirmParamsPayload(result) {
    const payload = result?.data || {};
    const paramsPayload = {
      data: payload.data,
      linkage: payload.linkage,
      endpoint: payload.endpoint,
      hierarchy: payload.hierarchy
    };

    if (!paramsPayload.data || !paramsPayload.linkage || !paramsPayload.endpoint || !paramsPayload.hierarchy) {
      throw new Error('确认订单返回缺少必要字段，无法生成 params');
    }

    return paramsPayload;
  }

  buildRequestDataFromConfirmResult(payload = {}, confirmRequestData, confirmResult) {
    const baseRequestData = cloneJSON(this.getRequestData(payload));
    const paramsPayload = this.extractConfirmParamsPayload(confirmResult);
    const createExParams = this.buildCreateExParams(payload, confirmRequestData.buyParam);
    const featureValue = normalizeObject(baseRequestData.feature);
    const nextFeature = Object.keys(featureValue).length ? featureValue : { gzip: true };
    const itemCount = payload.itemCount !== undefined ? payload.itemCount : baseRequestData.itemCount ?? 0;
    const buyNow = payload.buyNow !== undefined ? payload.buyNow : 'false';

    return {
      ...baseRequestData,
      buyNow: String(buyNow),
      params: this.encodeParamsPayload(paramsPayload),
      buyParam: confirmRequestData.buyParam,
      exParams: serializeLike(baseRequestData.exParams, createExParams),
      itemCount,
      feature: serializeLike(baseRequestData.feature, nextFeature)
    };
  }

  shouldUseConfirmOrder(payload = {}) {
    if (payload.useConfirmOrder === false) {
      return false;
    }

    if (payload.useConfirmOrder === true) {
      return true;
    }

    if (payload.buyParam) {
      return true;
    }

    return this.resolveConfirmCartItems(payload).length > 0;
  }

  buildMtopRequest({ api, version, requestData, payload = {}, overrides = {} }) {
    const token = this.getToken();
    const appKey = String(overrides.appKey || payload.appKey || this.config.appKey || '12574478');
    const jsv = overrides.jsv || payload.jsv || this.config.jsv || '2.7.2';
    const t = String(Date.now());
    const dataString = JSON.stringify(requestData);
    const sign = this.md5(`${token}&${t}&${appKey}&${dataString}`);

    const query = new URLSearchParams({
      jsv,
      appKey,
      t,
      sign,
      v: String(version),
      ecode: String(overrides.ecode || payload.ecode || this.config.ecode || '1'),
      timeout: String(overrides.timeout || payload.timeout || this.config.timeout || '60000'),
      dataType: overrides.dataType || payload.dataType || this.config.dataType || 'json',
      valueType: overrides.valueType || payload.valueType || this.config.valueType || 'original',
      ttid: overrides.ttid || payload.ttid || this.config.ttid || '1@tbwang_windows_1.0.0#pc',
      needLogin: String(overrides.needLogin || payload.needLogin || this.config.needLogin || 'true'),
      type: overrides.type || payload.type || this.config.type || 'originaljson',
      isHttps: String(overrides.isHttps || payload.isHttps || this.config.isHttps || '1'),
      api,
      preventFallback: String(overrides.preventFallback || payload.preventFallback || this.config.preventFallback || 'true'),
      ...(overrides.extraQuery || {})
    });

    if (overrides.submitref !== false) {
      query.set('submitref', String(overrides.submitref || payload.submitref || this.config.submitref || ''));
    }

    const url = `https://h5api.m.${overrides.host || 'tmall'}.com/h5/${api}/${version}/?${query.toString()}`;
    const body = new URLSearchParams({ data: dataString }).toString();
    const headers = {
      accept: 'application/json',
      'accept-language': this.config.acceptLanguage || 'zh-CN,zh;q=0.9,zh-TW;q=0.8',
      'content-type': 'application/x-www-form-urlencoded',
      cookie: this.config.cookie || '',
      priority: 'u=1, i',
      referer: overrides.referer || this.config.referer || 'https://buy.tmall.com/order/confirm_order.htm',
      origin: overrides.origin,
      'user-agent':
        this.config.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
    };

    Object.keys(headers).forEach(key => headers[key] === undefined && delete headers[key]);

    return {
      requestData,
      dataString,
      url,
      body,
      headers
    };
  }

  async buildRequest(payload = {}) {
    const requestData = this.shouldUseConfirmOrder(payload)
      ? await this.buildRequestDataFromConfirmOrder(payload)
      : this.rebuildRequestData(payload);
    const api = payload.api || this.config.api || 'mtop.trade.order.create';
    const version = String(payload.v || this.config.v || '6.0');
    const built = this.buildMtopRequest({ api, version, requestData, payload });

    return {
      buyerName: this.config.buyer_name,
      ...built
    };
  }

  normalizeCartItem(cartItem) {
    if (!cartItem || typeof cartItem !== 'object') {
      return null;
    }

    const fields = cartItem.fields || cartItem;
    const sku = fields.sku || {};
    const pay = fields.pay || {};

    return {
      cartId: fields.cartId || fields.id || '',
      settlement: fields.settlement || '',
      cartBc: fields.cart_bc || '',
      itemId: fields.itemId || '',
      quantity: fields.quantity || fields.quantityInfo?.quantity || 1,
      skuId: fields.skuId || sku.skuId || '0',
      shopId: fields.shopId || '',
      sellerId: fields.sellerId || '',
      shopTitle: fields.shopTitle || fields.seller || '',
      xxc: this.extractCartExtensions(fields.cart_bc || '').xxc || '',
      addressId: this.extractCartExtensions(fields.cart_bc || '').iCartAddressId || '',
      cartCreateTime: this.extractCartExtensions(fields.cart_bc || '').cartCreateTime || '',
      pcOrderFrom: this.extractCartExtensions(fields.cart_bc || '').pcOrderFrom || '',
      icart: this.extractCartExtensions(fields.cart_bc || '').icart || '',
      totalFeeCent: pay.couponDiscountedPrice || pay.total || pay.now || '',
      priceTraceTotal: pay.couponDiscountedPrice || pay.total || pay.now || ''
    };
  }

  extractCartExtensions(cartBc) {
    const extensions = {};
    String(cartBc || '')
      .split('~~')
      .forEach(item => {
        if (!item) {
          return;
        }
        const [key, ...rest] = item.split('~');
        extensions[key] = rest.join('~');
      });
    return extensions;
  }

  buildRebuildFromCartItem(cartItem) {
    const rebuild = {
      itemId: cartItem.itemId,
      skuId: cartItem.skuId || '0',
      quantity: cartItem.quantity || 1,
      cartId: cartItem.cartId,
      shopId: cartItem.shopId,
      addressId: cartItem.addressId,
      cartCreateTime: cartItem.cartCreateTime,
      pcOrderFrom: cartItem.pcOrderFrom,
      icart: cartItem.icart,
      xxc: cartItem.xxc,
      totalFeeCent: cartItem.totalFeeCent
    };

    Object.keys(rebuild).forEach(key => (rebuild[key] === undefined || rebuild[key] === '' || rebuild[key] === null) && delete rebuild[key]);
    return rebuild;
  }

  collectCartItems(cartData) {
    const sourceData = cartData?.data && cartData?.hierarchy ? cartData : cartData?.data || cartData;
    const nodes = sourceData?.data || {};
    const items = [];
    const bundleHeaders = {};

    Object.values(nodes).forEach(node => {
      if (node?.tag === 'bundleHeader' && node.fields?.bundleId) {
        bundleHeaders[node.fields.bundleId] = node.fields;
      }
    });

    Object.values(nodes).forEach(node => {
      if (node?.tag !== 'item' || !node.fields?.settlement) {
        return;
      }

      const bundleHeader = bundleHeaders[node.fields.bundleId] || {};
      items.push({
        cartId: node.fields.cartId,
        bundleId: node.fields.bundleId,
        itemId: node.fields.itemId,
        quantity: node.fields.quantity,
        settlement: node.fields.settlement,
        cart_bc: node.fields.cart_bc,
        shopId: node.fields.shopId || bundleHeader.shopId || '',
        sellerId: bundleHeader.sellerId || node.fields.sellerId || '',
        shopTitle: node.fields.shopTitle || bundleHeader.title || bundleHeader.seller || '',
        skuId: node.fields.sku?.skuId || '0',
        title: node.fields.title || node.fields.sku?.title || '',
        pay: node.fields.pay || {},
        raw: node.fields
      });
    });

    return items;
  }

  async queryCart(payload = {}) {
    const requestData = payload.cartQueryData || this.config.cartQueryData;
    if (!requestData || typeof requestData !== 'object' || Array.isArray(requestData)) {
      throw new Error('cartQueryData 必须是对象');
    }

    const request = this.buildMtopRequest({
      api: payload.cartApi || 'mtop.trade.query.bag',
      version: payload.cartVersion || '5.0',
      requestData,
      payload,
      overrides: {
        host: 'taobao',
        referer: 'https://cart.taobao.com/',
        origin: 'https://cart.taobao.com',
        submitref: false,
        timeout: payload.cartTimeout || '6000',
        extraQuery: {
          __customTag__: 'build'
        }
      }
    });

    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body
    });

    const result = await response.json();
    const items = this.collectCartItems(result?.data);

    return {
      buyer_name: this.config.buyer_name,
      httpStatus: response.status,
      total: items.length,
      items
    };
  }

  async queryConfirmOrder(payload = {}) {
    const cartItems = this.resolveConfirmCartItems(payload);
    const requestData = this.buildConfirmOrderRequestData(payload, cartItems);
    const request = this.buildMtopRequest({
      api: payload.confirmApi || 'mtop.trade.order.build',
      version: payload.confirmVersion || '5.0',
      requestData,
      payload,
      overrides: {
        host: 'tmall',
        referer: 'https://buy.tmall.com/',
        origin: 'https://buy.tmall.com',
        submitref: false
      }
    });

    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body
    });

    const result = await response.json();

    return {
      buyer_name: this.config.buyer_name,
      httpStatus: response.status,
      buyParam: requestData.buyParam,
      requestData,
      headers: {
        ...request.headers,
        cookie: maskCookie(request.headers.cookie)
      },
      result
    };
  }

  async buildRequestDataFromConfirmOrder(payload = {}) {
    const cartItems = this.resolveConfirmCartItems(payload);
    const confirmRequestData = this.buildConfirmOrderRequestData(payload, cartItems);
    const confirmRequest = this.buildMtopRequest({
      api: payload.confirmApi || 'mtop.trade.order.build',
      version: payload.confirmVersion || '5.0',
      requestData: confirmRequestData,
      payload,
      overrides: {
        host: 'tmall',
        referer: 'https://buy.tmall.com/',
        origin: 'https://buy.tmall.com',
        submitref: false
      }
    });

    const response = await fetch(confirmRequest.url, {
      method: 'POST',
      headers: confirmRequest.headers,
      body: confirmRequest.body
    });

    const result = await response.json();
    return this.buildRequestDataFromConfirmResult(payload, confirmRequestData, result);
  }

  async queryPreOrder(payload = {}) {
    const request = await this.buildRequest(payload);
    return {
      buyer_name: request.buyerName,
      url: request.url,
      body: request.body,
      data: request.requestData,
      requestSource: this.shouldUseConfirmOrder(payload) ? 'confirm_order' : 'template_rebuild',
      rebuild: payload.rebuild || {},
      headers: {
        ...request.headers,
        cookie: maskCookie(request.headers.cookie)
      }
    };
  }

  isSuccessResult(result) {
    if (Array.isArray(result?.ret) && result.ret.length > 0) {
      return result.ret.every(item => String(item).startsWith('SUCCESS'));
    }

    if (result?.data && typeof result.data === 'object') {
      return Boolean(result.data.nextUrl || result.data.orderId || result.data.orderIds || result.data.alipayWapCashierUrl);
    }

    return false;
  }

  async createOrder(payload = {}) {
    if (this.succeed && !payload.force) {
      return {
        buyer_name: this.config.buyer_name,
        status: 'success',
        message: '已下单成功'
      };
    }

    const request = await this.buildRequest(payload);

    console.log('开始淘宝下单:', {
      buyer_name: this.config.buyer_name,
      url: request.url,
      data: request.requestData
    });

    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body
    });

    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json') ? await response.json() : await response.text();

    if (this.isSuccessResult(result)) {
      this.succeed = true;
    }

    return {
      buyer_name: this.config.buyer_name,
      status: response.ok ? 'ok' : 'http_error',
      httpStatus: response.status,
      success: this.isSuccessResult(result),
      result
    };
  }
}

module.exports = Buyer;
