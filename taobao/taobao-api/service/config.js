const path = require('path');
const fs = require('fs-extra');

const getConfigPath = () => path.join(__dirname, '../database', 'config.json');

const getDefaultConfig = () => [
  {
    targetTime: '',
    advanceTimestamps: 1000,
    advancePostInterval: 200,
    postDuration: 1000,
    postInterval: 50,
    buyers: [
      {
        disabled: true,
        buyer_name: '示例淘宝账号',
        cookie: '_m_h5_tk=your_token_here_1234567890; _m_h5_tk_enc=your_token_enc_here;',
        appKey: '12574478',
        api: 'mtop.trade.order.create',
        v: '6.0',
        jsv: '2.7.2',
        ecode: '1',
        timeout: '60000',
        dataType: 'json',
        valueType: 'original',
        ttid: '1@tbwang_windows_1.0.0#pc',
        needLogin: 'true',
        type: 'originaljson',
        isHttps: '1',
        submitref: '',
        preventFallback: 'true',
        referer: 'https://buy.tmall.com/order/confirm_order.htm',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        cartQueryData: {
          mixed: false,
          netType: 0,
          extStatus: '0',
          cartFrom: 'main_site',
          isPage: true,
          exParams: JSON.stringify({
            supportCalculateUpdate: 'true',
            mergeCombo: 'true',
            globalSell: '1',
            spiPage: 'pcTao',
            isPcMixCart: 'true',
            pcOrderFrom: 'pcWeb^cart^mainCart',
            pageVersion: '0.0.46'
          })
        },
        confirmOrderExParams: {
          pageVersion: '0.0.45',
          page_from_type: 'main_site_pc',
          pcTBNewBuy: '1',
          pcWebxOrderFromType: 'FROM_MALL_CART',
          pcRenderOrderRequestUrl: 'http://buy.tmall.com/order/confirm_order.htm'
        },
        requestData: {
          buyNow: 'false',
          params: 'replace_with_confirm_order_params',
          buyParam: 'replace_with_buy_param',
          exParams: '{"page_from_type":"main_site_pc","openFrom":"carts","coVersion":"2.0"}',
          itemCount: 0,
          feature: '{"gzip":true}'
        }
      }
    ]
  }
];

const ensureConfigFile = async () => {
  const configPath = getConfigPath();
  await fs.ensureDir(path.dirname(configPath));

  if (!(await fs.pathExists(configPath))) {
    await fs.writeJson(configPath, getDefaultConfig(), { spaces: 2 });
  }

  return configPath;
};

const load = async () => {
  const configPath = await ensureConfigFile();
  const data = await fs.readJson(configPath);
  if (!Array.isArray(data)) {
    throw new Error('配置文件必须是数组格式');
  }
  return data;
};

const update = async data => {
  const configPath = await ensureConfigFile();
  await fs.writeJson(configPath, data, { spaces: 2 });
  return data;
};

module.exports = {
  load,
  update
};
