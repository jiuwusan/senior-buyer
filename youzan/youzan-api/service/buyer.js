const queryPublicIp = async () => {
  try {
    return await (await fetch('https://ifconfig.me/ip')).text();
  } catch (error) {
    console.log('queryPublicIp error:', error);
  }
};

class Buyer {
  config = {
    shop_name: '',
    kdt_id: '',
    cookie: '',
    address: {}
  };
  orderList = [];
  succeedIds = [];
  constructor(config) {
    this.config = config;
  }

  uuid() {
    // 标准 UUID 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      // 如果是 'x' 则取 r；如果是 'y' 则取 (r & 0x3 | 0x8) 以符合 RFC 标准
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async fetchAPI(url, options) {
    console.log('接口请求 原始参数:', url, options);
    // 判断是否为 HTML 页面
    if (options && typeof options === 'object') {
      if (options.query && typeof url === 'string') {
        const queryStr = Object.keys(options.query)
          .map(key => `${key}=${options.query[key]}`)
          .join('&');
        // 拼接 url
        url.includes('?') ? (url += `&${queryStr}`) : (url += `?${queryStr}`);
      }
      options.data && (options.body = JSON.stringify(options.data));
      // options.data && (options.body = new URLSearchParams(options.data));
      delete options.query;
      delete options.data;
    }
    // 添加请求头
    !options && (options = {});

    options.headers = {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'zh-CN,zh;q=0.9,zh-TW;q=0.8',
      'content-type': 'application/json',
      'extra-data': '{"sid":"","version":"","bizEnv":""}',
      'page-path': 'https://tuicashier.youzan.com/wsctrade/cart',
      priority: 'u=1, i',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      cookie: this.config.cookie,
      Referer:
        'https://tuicashier.youzan.com/wsctrade/cart?banner_id=cart.118622541~recService.1~1~j9NzLTY4&alg=common_by_shop.store_ctr_30d_1000.0%3A20251225%2Ccommon_by_shop.inner_hot.2%3A20251224%2Ccommon_by_shop.inner_price_hot.0%3A20251224%2Ccommon_by_shop.inner_7d_hot.0%3A20251224%2Ccommon_by_shop.inner_1d_hot.0%3A20251224%2Ccold_simple_rank%2C0.0.0.0.0.0.0.0.0_2b0e9eebd35d486c8a6927189f3850d7&alias=3ex44eto5dcbx6i&spm=g.4372016492&kdt_id=118622541',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      ...(options.headers || {})
    };

    try {
      console.log('接口请求:', url, options);
      const response = await fetch(url, options);
      console.log('接口响应:', response);
      return await response.json();
    } catch (error) {
      console.log('请求异常:', error);
    }
    return void 0;
  }

  async authorization() {
    return '登录成功';
  }

  async queryCart() {
    const clientIp = await queryPublicIp();
    const result = await this.fetchAPI('https://shop118814709.youzan.com/wsctrade/cartGoodstList.json', {
      query: {
        kdt_id: this.config.kdt_id,
        store_id: 0,
        supportReviveGroup: true,
        supportCombo: true,
        excludedComboSubType: [],
        disableSearchYzGuarantee: true
      }
    });
    const items = result?.data?.[0]?.items || [];
    this.orderList = await this.generateOrderList(items, clientIp);
    return this.orderList;
  }
  async orderCart() {
    return await Promise.all(this.orderList.map(orderInfo => this.creatOrder(orderInfo)));
  }
  async creatOrder(orderInfo) {
    const { submitId, itemName, orderParam } = orderInfo;
    if (this.succeedIds.includes(submitId)) {
      console.log('已下单成功，跳过...', submitId);
      return {
        submitId,
        itemName,
        status: 'success',
        message: '已下单成功'
      };
    }
    console.log('开始下单...', submitId);
    const result = await this.fetchAPI('https://cashier.youzan.com/pay/wsctrade/order/buy/v2/bill-fast.json', {
      method: 'POST',
      query: { kdt_id: this.config.kdt_id },
      data: orderParam
    });
    console.log('下单结果:', result);
    if (result?.data?.orderNo) {
      // 下单成功
      this.succeedIds.push(orderInfo.submitId);
    }
    return {
      submitId,
      itemName,
      result
    };
  }
  async getGoodsBookKey(goodsItem) {
    const bookpKeyParams = {
      goodsList: JSON.stringify([
        {
          goods_id: goodsItem.goodsId,
          num: goodsItem.num,
          sku_id: goodsItem.skuId,
          price: goodsItem.price,
          extra: {},
          dcPs: '',
          biz_trace_point_ext: JSON.stringify({
            atr_uuid: '',
            yzk_ex: '',
            page_type: '',
            tui_platform: '',
            tui_click: '',
            wecom_uuid: '',
            from_source: '',
            pv_id: '/v2/showcase/homepage~085945c9-cdce-430c-9eae-22fd427310d2',
            st: 'js',
            sv: '1.1.49',
            yai: 'wsc_c',
            uuid: '6a3b3b3f-3607-7659-bed3-08e4b81bb087',
            userId: this.config.user_id,
            platform: 'web',
            alias: '2oknqq9yxogu5tq'
          }),
          qr: '',
          tpps: '',
          fcode: '',
          isSevenDayUnconditionalReturn: true
        }
      ]),
      common: JSON.stringify({
        kdt_id: this.config.kdt_id,
        store_id: 0,
        store_name: '',
        postage: 0,
        activity_alias: '',
        activity_id: 0,
        activity_type: 0,
        use_wxpay: 0,
        from: '',
        bosWorkFlow: false,
        isFromItemDetail: false,
        source: 'goods_detail'
      })
    };
    const result = await this.fetchAPI('https://shop118814709.youzan.com/wsctrade/order/goodsBook.json', {
      method: 'POST',
      query: { kdt_id: this.config.kdt_id },
      data: bookpKeyParams
    });
    console.log('获取商品 bookKey 结果:', result);
    return result?.data;
  }
  /**
   * 构建提交订单请求参数
   * @param {Object} cartData - 购物车返回数据
   * @param {Object} addressData - 收货地址列表数据
   * @returns {Object} 提交订单参数
   */
  async generateOrderList(selectedItems, clientIp) {
    const shippingAddress = this.config.address;
    // 4. 构造 items 详情
    const items = selectedItems.map(item => ({
      cartCreateTime: item.created_time,
      cartUpdateTime: item.updated_time,
      CART_ID: item.cart_id,
      goodsId: item.goods_id,
      skuId: item.sku_id,
      num: item.num,
      kdtId: item.kdt_id,
      price: item.pay_price,
      deliverTime: item.deliver_time || 0,
      confirmTotalPrice: item.pay_price * item.num,
      title: item.title,
      activityId: item.activity_id,
      activityType: item.activity_type
    }));

    // for (let index = 0; index < items.length; index++) {
    //   items[index].bookKey = (await this.getGoodsBookKey(items[index]))?.bookKey;
    // }

    // 6. 返回最终 JSON 结构
    return items.map(item => ({
      submitId: this.uuid(),
      itemName: item.title,
      orderParam: {
        version: 2,
        source: {
          bookKey: item.bookKey || this.uuid(),
          clientIp,
          fromThirdApp: false,
          isWeapp: false,
          itemSources: [
            {
              activityId: item.activityId,
              activityType: item.activityType,
              bizTracePointExt: JSON.stringify({
                atr_uuid: '',
                yzk_ex: '',
                page_type: '',
                tui_platform: '',
                tui_click: '',
                wecom_uuid: '',
                from_source: '',
                pv_id: '/v2/showcase/homepage~ce2462ee-fa92-4487-a00f-0cdcd6ec88c0',
                banner_id: 'cart.118622541~recService.1~1~j9NzLTY4',
                st: 'js',
                sv: '1.1.49',
                yai: 'wsc_c',
                uuid: '6a3b3b3f-3607-7659-bed3-08e4b81bb087',
                userId: '',
                platform: 'web',
                alg: 'common_by_shop.store_ctr_30d_1000.0:20251225,common_by_shop.inner_hot.2:20251224,common_by_shop.inner_price_hot.0:20251224,common_by_shop.inner_7d_hot.0:20251224,common_by_shop.inner_1d_hot.0:20251224,cold_simple_rank,0.0.0.0.0.0.0.0.0_2b0e9eebd35d486c8a6927189f3850d7',
                alias: '3ex44eto5dcbx6i'
              }),
              cartCreateTime: 0,
              cartUpdateTime: 0,
              goodsId: item.goodsId,
              propertyIds: [],
              skuId: item.skuId
            }
          ],
          kdtSessionId: this.config.kdt_session_id,
          needAppRedirect: false,
          orderType: 0,
          platform: 'weixin',
          salesman: '',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
          orderMark: '',
          bizPlatform: ''
        },
        config: {
          bosWorkFlow: false,
          containsUnavailableItems: false,
          fissionActivity: { fissionTicketNum: 0 },
          isFromItemDetail: true,
          paymentExpiry: 0,
          receiveMsg: true,
          usePoints: false,
          useWxpay: false,
          buyerMsg: '',
          disableStoredDiscount: false,
          storedDiscountRechargeGuide: true,
          isWholesaleOrder: false,
          valueCardsExtContext: '{"IS_RELOAD":false,"CUSTOMER_SELECT_CARD_LIST":false,"SELECTED_RECHARGE_FREE_PRODUCT":false,"DIY_SELECT_CARDS":"0"}'
        },
        usePayAsset: {},
        items: [
          {
            activityId: item.activityId,
            activityType: item.activityType,
            deliverTime: 0,
            extensions: { OUTER_ITEM_ID: '10000' },
            goodsId: item.goodsId,
            isSevenDayUnconditionalReturn: true,
            itemFissionTicketsNum: 0,
            itemMessage: '{}',
            kdtId: this.config.kdt_id,
            num: item.num,
            pointsPrice: 0,
            price: item.price,
            propertyIds: [],
            skuId: item.skuId,
            storeId: 0,
            umpSkuId: 0
          }
        ],
        seller: { kdtId: this.config.kdt_id, storeId: 0 },
        ump: {
          activities: [
            {
              activityAlias: '',
              activityId: item.activityId,
              activityType: item.activityType,
              externalPointId: 0,
              goodsId: item.goodsId,
              kdtId: this.config.kdt_id,
              pointsPrice: 0,
              propertyIds: [],
              skuId: item.skuId,
              usePoints: false
            }
          ],
          coupon: {},
          multiCoupon: { coupons: [], deliveryCoupons: [] },
          useCustomerCardInfo: { specified: false },
          costPoints: { kdtId: this.config.kdt_id, usePointDeduction: false, costPoints: 0, defaultPointDeductEffect: true }
        },
        newCouponProcess: true,
        unavailableItems: [],
        asyncOrder: false,
        delivery: {
          hasFreightInsurance: true,
          address: shippingAddress,
          expressType: 'express',
          expressTypeChoice: 0
        },
        cloudOrderExt: { extension: {} },
        bookKeyCloudExtension: { umpExt: '' },
        confirmTotalPrice: item.confirmTotalPrice,
        extensions: {
          CONFIRM_TRADE_RISK_DIALOG: 'false',
          TRADE_PAGE_TYPE: 'TRADE_BUY_PAGE',
          NEW_MEMBER_FLOW: 'true',
          IS_OPTIMAL_SOLUTION: 'true',
          ATTR_SUPPORT_TIMESPAN_DELIVERY_FEE: '1',
          IS_OVERLYING_COUPON: 'true',
          IS_SELECT_PRESENT: '0',
          NOT_SALE_SINGLE: '1',
          SELECTED_PRESENTS: '[]',
          BIZ_ORDER_ATTRIBUTE: '{"RISK_GOODS_TAX_INFOS":"0"}',
          ATTR_SOURCE_PAGE: 'goods_detail',
          USE_OPTIMAL_CALCULATE: '1'
        },
        behaviorOrderInfo: { bizType: 158, token: '' }
      }
    }));
  }
}

module.exports = Buyer;
