const cheerio = require('cheerio');
const fs = require('fs-extra');

class Buyer {
  config = {
    source_id: '',
    shopid: '',
    buyer_id: '',
    address_id: '',
    cookie: '',
    wdtoken: '',
    udc: ''
  };
  orderList = [];
  succeedIds = [];
  combineOrder = {};
  constructor(config) {
    this.config = config;
  }

  uuid() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      // 使用大写
      return v.toString(16).toLowerCase();
    });
  }

  async fetchWeidianAPI(url, options) {
    console.log('接口请求 原始参数:', url, options);
    // 判断是否为 HTML 页面
    const isHtmlPage = /.*\.(html|php)$/.test(url);
    // 处理参数
    if (options && typeof options === 'object') {
      if (options.query && typeof url === 'string') {
        const queryStr = Object.keys(options.query)
          .map(key => `${key}=${options.query[key]}`)
          .join('&');
        // 拼接 url
        url.includes('?') ? (url += `&${queryStr}`) : (url += `?${queryStr}`);
      }
      // options.data && (options.body = JSON.stringify(options.data));
      options.data && (options.body = new URLSearchParams(options.data));
      delete options.query;
      delete options.data;
    }
    // 添加请求头
    !options && (options = {});

    options.headers = {
      accept: isHtmlPage
        ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
        : 'accept: application/json, */*',
      'accept-language': 'zh-CN,zh;q=0.9,zh-TW;q=0.8',
      cookie: this.config.cookie,
      origin: 'https://weidian.com',
      priority: isHtmlPage ? 'u=0, i' : 'u=1, i',
      referer: `https://shop${this.config.shopid}.v.weidian.com/`,
      'sec-fetch-dest': isHtmlPage ? 'document' : 'empty',
      'sec-fetch-mode': isHtmlPage ? 'navigate' : 'cors',
      'sec-fetch-site': 'same-site',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      ...(options.headers || {})
    };
    let response;
    try {
      console.log('接口请求:', url, options);
      response = await fetch(url, options);
      console.log('接口响应:', response);
      return isHtmlPage ? await response.text() : await response.json();
    } catch (error) {
      console.log('请求异常:', error);
    }
    return response;
  }

  extractDataObjFromHtml(htmlText) {
    // 使用 cheerio 加载 HTML 文本
    const $ = cheerio.load(htmlText);

    // 使用 CSS 选择器查找目标 <script> 标签
    const scriptElement = $('#__rocker-render-inject__');

    if (scriptElement.length > 0) {
      // 提取 data-obj 属性的值
      const dataObjString = scriptElement.attr('data-obj');

      // 确保返回的是字符串值
      return dataObjString || null;
    }

    return null;
  }

  async authorization() {
    return '登录成功';
  }

  async queryCart() {
    console.log('查询购物车...');
    let list = [];
    try {
      const htmlText = await this.fetchWeidianAPI('https://weidian.com/new-cart/index.php', {
        query: {
          referrerURl: `shopid_${this.config.shopid}`,
          pageName: 'shop_menu_cart',
          wfr: 'wxBuyerShare'
          // share_relation: '8ae38713a09b4eba_1974187814_1',
          // spider_token: '3958'
        }
      });
      const dataStr = this.extractDataObjFromHtml(htmlText);
      list = JSON.parse(dataStr)?.cart?.result?.shops || [];
      console.log('查询购物车 结果:', list);
    } catch (error) {
      console.log('查询购物车时出错:', error);
    }

    // 生成下单参数
    Array.isArray(list) &&
      list.length > 0 &&
      ((this.orderList = this.generateOrderParamsFromCart(list, {
        param: {
          channel: 'bjh5',
          source_id: this.config.source_id,
          // q_pv_id: this.uuid(),
          biz_type: 1,
          buyer: { buyer_id: this.config.buyer_id, eat_in_table_name: '', address_id: this.config.address_id, agreement_type_list: [5] },
          // shop_list: [],
          deliver_type: 0,
          is_no_ship_addr: 0,
          // total_pay_price: '',
          total_vjifen: '',
          wfr: 'wxBuyerShare',
          appid: '',
          discount_list: [],
          invalid_shop_list: [],
          pay_type: 0
        },
        context: {
          // shopping_center: '',
          // pageChannel: 'shop_menu_cart',
          subChannel: 'browser',
          thirdSubchannel: 'safari'
        },
        udc: this.config.udc || '',
        wdtoken: this.config.wdtoken || ''
      })),
      (this.combineOrder = this.generateCombineOrder(list, {
        param: {
          channel: 'bjh5',
          source_id: this.config.source_id,
          q_pv_id: this.uuid(),
          biz_type: 1,
          buyer: { buyer_id: this.config.buyer_id, eat_in_table_name: '', address_id: this.config.address_id, agreement_type_list: [5] },
          deliver_type: 0,
          is_no_ship_addr: 0,
          total_vjifen: '',
          wfr: 'wxBuyerShare',
          appid: '',
          discount_list: [],
          invalid_shop_list: [],
          pay_type: 0
        },
        context: {
          subChannel: 'browser',
          thirdSubchannel: 'safari'
        },
        udc: this.config.udc || '',
        wdtoken: this.config.wdtoken || ''
      })));

    return {
      buyer_name: this.config.buyer_name,
      order_total: this.orderList?.length,
      list
    };
  }

  async queryPreOrder() {
    return {
      buyer_name: this.config.buyer_name,
      order_total: this.orderList?.length,
      order_list: this.orderList,
      combine_order: this.combineOrder
    };
  }

  async orderCart({ combine }) {
    if (this.orderList?.length < 1) {
      return '购物车为空';
    }
    if (this.succeedIds.includes('combine')) {
      return '已下单成功';
    }
    if (combine) {
      return this.creatOrder(this.combineOrder);
    }
    console.log('购物车结算...');
    const batchSize = 2;
    const results = [];
    for (let i = 0; i < this.orderList.length; i += batchSize) {
      const batchOrder = this.orderList.slice(i, i + batchSize);
      const batchResults = await Promise.all(batchOrder.map(order => this.creatOrder(order)));
      results.push(...batchResults);
    }
    return results;
  }

  async creatOrder(orderInfo) {
    console.log('创建订单...');
    // 模拟下单
    // return await new Promise(async resolve => setTimeout(resolve, parseInt(Math.random() * 5 + 5)));
    const { submitId, itemName, orderParam } = orderInfo;
    if (this.succeedIds.includes(submitId)) {
      console.log('已下单成功，跳过...', submitId);
      return {
        buyerName: this.config.buyer_name,
        submitId,
        itemName,
        status: 'success',
        message: '已下单成功'
      };
    }
    console.log('开始下单...', submitId);
    const result = await this.fetchWeidianAPI('https://thor.weidian.com/vbuy/CreateOrder/1.0', {
      method: 'POST',
      data: orderParam
    });
    console.log('下单结果:', result);
    if (result?.status?.code === 0 && result?.status?.message === 'OK') {
      // 下单成功
      this.succeedIds.push(orderInfo.submitId);
      orderInfo.succeed = true;
    }
    return {
      submitId,
      itemName,
      result
    };
  }
  /**
   * 根据购物车数据和基础模板，为购物车中的每个商品生成独立的订单提交参数。
   * 遵循“1件商品1个订单”的规则，并动态设置 shopping_center 为第一个店铺的 groupId。
   * * @param {Array<Object>} cartData 购物车接口返回的数据。
   * @param {Object} baseParamsTemplate 下单参数的基础模板。
   * @returns {Array<Object>} 包含每个商品订单参数的列表。
   */
  generateOrderParamsFromCart(cartData, baseParamsTemplate) {
    const orderParamsList = [];

    // 1. 提取基础参数
    const { param: baseParam = {}, context: baseContext = {}, wdtoken, udc = '' } = baseParamsTemplate;
    const { buyer: buyerInfo = {}, channel, source_id, q_pv_id = this.uuid(), biz_type, deliver_type, is_no_ship_addr, wfr, appid, pay_type } = baseParam;

    // 2. 根据补充逻辑：动态设置 context.shopping_center
    // 使用第一个店铺分组的 groupId 作为 shopping_center
    const firstShopGroupId = cartData[0]?.groupId;
    const finalContext = {
      ...baseContext,
      shopping_center: firstShopGroupId || baseContext.shopping_center
    };

    // 3. 遍历购物车数据中的每个店铺/商品组
    for (const shopGroup of cartData) {
      const shopId = shopGroup.shopId;

      // 4. 遍历店铺中的分区
      for (const partition of shopGroup.partitions || []) {
        // 5. 遍历分区中的每个商品项
        for (const item of partition.itemList || []) {
          // 仅处理有效商品
          // if (item.itemInvalid || item.skuInvalid || item.status !== 1) {
          //   continue;
          // }

          const itemId = item.itemId;
          const skuId = String(item.skuId || 0); // 确保是字符串
          const count = item.count || 1;
          const price = item.price || '0';
          const oriPrice = item.oriPrice || price;

          // 计算当前订单的总价，并保留两位小数
          const currentPrice = (parseFloat(price) * count).toFixed(2);
          const currentOriPrice = (parseFloat(oriPrice) * count).toFixed(2);

          // 构建当前商品的 shop_list (1个商品对应1个订单)
          const shopList = [
            {
              shop_id: shopId,
              f_shop_id: '',
              sup_id: '',
              item_list: [
                {
                  item_id: itemId,
                  quantity: count,
                  item_sku_id: skuId,
                  ori_price: parseFloat(oriPrice).toFixed(2),
                  price: parseFloat(price).toFixed(2),
                  extend: {},
                  price_type: 1, // 统一设为正常价类型
                  discount_list: [],
                  item_convey_info: {}
                }
              ],
              order_type: 3,
              ori_price: currentOriPrice,
              price: currentPrice,
              express_fee: '0.00', // 运费需要后端重新计算，此处暂设
              express_type: 4,
              discount_list: [],
              invalid_item_list: []
            }
          ];

          // 构建完整的订单参数 param
          const newParam = {
            channel,
            source_id,
            q_pv_id,
            biz_type,
            buyer: buyerInfo,
            shop_list: shopList,
            deliver_type,
            is_no_ship_addr,
            total_pay_price: currentPrice, // 设定为当前商品的最终支付价
            total_vjifen: '',
            wfr,
            appid,
            discount_list: [],
            invalid_shop_list: [],
            pay_type
          };

          // 构建最终的提交结构，使用更新后的 finalContext
          const orderSubmission = {
            param: JSON.stringify(newParam),
            context: JSON.stringify(finalContext),
            wdtoken,
            udc
          };

          // 添加到结果列表
          orderParamsList.push({
            submitId: this.uuid(),
            itemName: item.itemName, // 方便识别
            orderParam: orderSubmission
          });
        }
      }
    }

    return orderParamsList;
  }

  /**
   * 生成合并订单参数（所有商品合并为一个订单）
   * @param {Array<Object>} cartData 购物车接口返回的数据
   * @param {Object} baseParamsTemplate 下单参数的基础模板
   * @returns {Object} 合并订单参数
   */
  generateCombineOrder(cartData, baseParamsTemplate) {
    // 1. 提取基础参数
    const { param: baseParam = {}, context: baseContext = {}, wdtoken, udc = '' } = baseParamsTemplate;
    const { buyer: buyerInfo = {}, channel, source_id, q_pv_id, biz_type, deliver_type, is_no_ship_addr, wfr, appid, pay_type } = baseParam;

    // 2. 动态设置 context.shopping_center
    const firstShopGroupId = cartData[0]?.groupId;
    const finalContext = {
      ...baseContext,
      shopping_center: firstShopGroupId || baseContext.shopping_center
    };

    // 3. 构建合并订单的 shop_list（包含所有商品）
    const shopListMap = new Map(); // 使用 Map 按店铺分组

    // 4. 遍历购物车数据，按店铺分组收集商品
    for (const shopGroup of cartData) {
      const shopId = shopGroup.shopId;
      if (!shopListMap.has(shopId)) {
        shopListMap.set(shopId, {
          shop_id: shopId,
          f_shop_id: '',
          sup_id: '',
          item_list: [],
          order_type: 3,
          ori_price: '0.00',
          price: '0.00',
          express_fee: '0.00',
          express_type: 4,
          discount_list: [],
          invalid_item_list: []
        });
      }

      const shopListItem = shopListMap.get(shopId);

      // 遍历店铺中的分区
      for (const partition of shopGroup.partitions || []) {
        // 遍历分区中的每个商品项
        for (const item of partition.itemList || []) {
          const itemId = item.itemId;
          const skuId = String(item.skuId || 0);
          const count = item.count || 1;
          const price = item.price || '0';
          const oriPrice = item.oriPrice || price;

          // 累加价格
          shopListItem.ori_price = (parseFloat(shopListItem.ori_price) + parseFloat(oriPrice) * count).toFixed(2);
          shopListItem.price = (parseFloat(shopListItem.price) + parseFloat(price) * count).toFixed(2);

          // 添加商品到 item_list
          shopListItem.item_list.push({
            item_id: itemId,
            quantity: count,
            item_sku_id: skuId,
            ori_price: parseFloat(oriPrice).toFixed(2),
            price: parseFloat(price).toFixed(2),
            extend: {},
            price_type: 1,
            discount_list: [],
            item_convey_info: {}
          });
        }
      }
    }

    // 5. 将 Map 转换为数组
    const shopList = Array.from(shopListMap.values());

    // 6. 计算总支付价格
    const totalPayPrice = shopList.reduce((sum, shop) => (parseFloat(sum) + parseFloat(shop.price)).toFixed(2), '0.00');

    // 7. 构建完整的订单参数 param
    const newParam = {
      channel,
      source_id,
      q_pv_id,
      biz_type,
      buyer: buyerInfo,
      shop_list: shopList,
      deliver_type,
      is_no_ship_addr,
      total_pay_price: totalPayPrice,
      total_vjifen: '',
      wfr,
      appid,
      discount_list: [],
      invalid_shop_list: [],
      pay_type
    };

    // 8. 构建最终的提交结构
    const orderSubmission = {
      param: JSON.stringify(newParam),
      context: JSON.stringify(finalContext),
      wdtoken,
      udc
    };

    // 9. 返回合并订单参数（与单个订单格式保持一致）
    return {
      submitId: 'combine',
      itemName: '合并订单',
      orderParam: orderSubmission
    };
  }
}

module.exports = Buyer;
