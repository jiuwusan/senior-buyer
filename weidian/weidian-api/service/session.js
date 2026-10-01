const { DEFAULT_SHOP_ID } = require('./config');
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

function getCookies(response) {
  const cookieHeaders = response.headers.getSetCookie();
  const cookies = new Map();
  for (const header of cookieHeaders) {
    const pair = header.split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return cookies;
}

async function loginAndResolveBuyer({ username, password, shop_id = DEFAULT_SHOP_ID }, fetchImpl = globalThis.fetch) {
  const loginResponse = await fetchImpl('https://sso.weidian.com/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      origin: 'https://h5.weidian.com',
      referer: 'https://h5.weidian.com/m/login/index.html',
      'user-agent': USER_AGENT
    },
    body: new URLSearchParams({ phone: username, password, countryCode: '86', version: '1' })
  });
  if (!loginResponse.ok) throw new Error(`微店登录请求失败 (${loginResponse.status})`);

  const login = await loginResponse.json();
  if (login?.status?.status_code !== 0) {
    throw new Error(`微店登录失败：${login?.status?.status_reason || '未知原因'}`);
  }

  const buyerId = login?.result?.bid ?? login?.result?.userId;
  const cookies = getCookies(loginResponse);
  const wdtoken = cookies.get('wdtoken');
  if (!buyerId || !wdtoken) throw new Error('微店登录响应缺少买家 ID 或 wdtoken');
  const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');

  const addressResponse = await fetchImpl('https://thor.weidian.com/address/buyerGetAddressList/1.0', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      origin: 'https://weidian.com',
      referer: 'https://weidian.com/weidian-h5/buy/add-order.html',
      'user-agent': USER_AGENT,
      cookie
    },
    body: new URLSearchParams({ param: '{}', wdtoken })
  });
  if (!addressResponse.ok) throw new Error(`微店收货地址请求失败 (${addressResponse.status})`);

  const addressData = await addressResponse.json();
  if (addressData?.status?.code !== 0 || !Array.isArray(addressData.result)) {
    throw new Error('微店收货地址查询失败');
  }
  const addresses = addressData.result;
  const defaultAddress = addresses.find(address => address.isDefault === 1 || address.isDefault === true);
  const selectedAddress = defaultAddress || (addresses.length === 1 ? addresses[0] : null);
  if (!selectedAddress?.id) throw new Error('未找到唯一的默认收货地址');

  return {
    buyer_id: buyerId,
    address_id: selectedAddress.id,
    shopid: shop_id,
    wdtoken,
    cookie
  };
}

module.exports = { loginAndResolveBuyer };
