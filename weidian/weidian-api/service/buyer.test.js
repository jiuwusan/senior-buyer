const assert = require('node:assert/strict');
const test = require('node:test');
const Buyer = require('./buyer');
const { LoginLimiter } = require('./login_limiter');
const noWaitLimiter = new LoginLimiter({ intervalMs: 0 });

test('buyers share the login interval when sessions refresh together', async () => {
  let time = 0;
  const starts = [];
  const limiter = new LoginLimiter({ intervalMs: 5000, now: () => time, sleep: async ms => { time += ms; } });
  const buyers = ['user-1', 'user-2'].map(username => new Buyer(
    { source_id: 'source-1', username, password: 'test-password' },
    async () => {
      starts.push(time);
      return { buyer_id: username, address_id: 55, shopid: '1711911458', wdtoken: 'token', cookie: 'wdtoken=token' };
    },
    limiter
  ));

  await Promise.all(buyers.map(buyer => buyer.refreshSession()));
  assert.deepEqual(starts, [0, 5000]);
  assert.equal(buyers[0].getCachedUserInfo().status, 'cached');
  assert.equal(buyers[1].getCachedUserInfo().status, 'cached');
});

test('cart query uses login-derived buyer and address fields', async () => {
  const shop = {
    groupId: 'group-1',
    shopId: '1711911458',
    partitions: [{ itemList: [{ itemId: 'item-1', skuId: 'sku-1', count: 1, price: '10', oriPrice: '10', itemName: 'test item' }] }]
  };
  const html = `<div id="__rocker-render-inject__" data-obj='${JSON.stringify({ cart: { result: { shops: [shop] } } })}'></div>`;
  const sessionCalls = [];
  const buyer = new Buyer(
    { source_id: 'source-1', username: '13800000000', password: 'test-password' },
    async credentials => {
      sessionCalls.push(credentials);
      return { buyer_id: 123, address_id: 55, shopid: '1711911458', wdtoken: 'token123', cookie: 'wdtoken=token123' };
    },
    noWaitLimiter
  );
  buyer.fetchWeidianAPI = async () => html;

  const cart = await buyer.queryCart();
  const orderParam = JSON.parse(buyer.orderList[0].orderParam.param);

  assert.equal(sessionCalls.length, 1);
  assert.equal(cart.order_total, 1);
  assert.equal(orderParam.source_id, 'source-1');
  assert.equal(orderParam.buyer.buyer_id, 123);
  assert.equal(orderParam.buyer.address_id, 55);
  assert.equal(buyer.orderList[0].orderParam.wdtoken, 'token123');
  assert.equal(buyer.config.password, undefined);

  await buyer.queryCart();
  assert.equal(sessionCalls.length, 1);
});

test('refreshing a session updates cached order tokens and address', async () => {
  let loginCount = 0;
  const buyer = new Buyer(
    { source_id: 'source-1', username: '13800000000', password: 'test-password' },
    async () => {
      loginCount += 1;
      return { buyer_id: 123, address_id: loginCount, shopid: '1711911458', wdtoken: `token-${loginCount}`, cookie: `wdtoken=token-${loginCount}` };
    },
    noWaitLimiter
  );
  const shop = { groupId: 'group-1', shopId: '1711911458', partitions: [{ itemList: [{ itemId: 'item-1', count: 1, price: '10' }] }] };
  buyer.fetchWeidianAPI = async () => `<div id="__rocker-render-inject__" data-obj='${JSON.stringify({ cart: { result: { shops: [shop] } } })}'></div>`;
  await buyer.queryCart();

  await buyer.refreshSession();

  assert.equal(loginCount, 2);
  for (const item of [...buyer.orderList, buyer.combineOrder]) {
    assert.equal(item.orderParam.wdtoken, 'token-2');
    assert.equal(JSON.parse(item.orderParam.param).buyer.address_id, 2);
  }
  assert.equal(buyer.config.cookie, 'wdtoken=token-2');
});

test('cached user information exposes identity and address without session secrets', async () => {
  const buyer = new Buyer(
    { source_id: 'source-1', username: '13800000000', password: 'test-password' },
    async () => ({ buyer_id: 123, address_id: 55, shopid: '1711911458', wdtoken: 'secret-token', cookie: 'secret-cookie' }),
    noWaitLimiter
  );

  assert.deepEqual(buyer.getCachedUserInfo(), {
    username: '13800000000', status: 'not_logged_in', buyer_id: null,
    address_id: null, shopid: null, refreshedAt: null
  });

  await buyer.refreshSession();
  const cached = buyer.getCachedUserInfo();
  assert.equal(cached.status, 'cached');
  assert.equal(cached.buyer_id, 123);
  assert.equal(cached.address_id, 55);
  assert.equal(cached.shopid, '1711911458');
  assert.ok(Number.isFinite(Date.parse(cached.refreshedAt)));
  assert.doesNotMatch(JSON.stringify(cached), /secret|test-password/);
});

test('cart query keeps orders only from the configured shop', async () => {
  const buyer = new Buyer(
    { source_id: 'source-1', shop_id: '1234567890', username: '13800000000', password: 'test-password' },
    async credentials => ({ buyer_id: 123, address_id: 55, shopid: credentials.shop_id, wdtoken: 'token', cookie: 'wdtoken=token' }),
    noWaitLimiter
  );
  const shops = ['1711911458', '1234567890'].map(shopId => ({
    groupId: `group-${shopId}`, shopId,
    partitions: [{ itemList: [{ itemId: `item-${shopId}`, count: 1, price: '10' }] }]
  }));
  buyer.fetchWeidianAPI = async () => `<div id="__rocker-render-inject__" data-obj='${JSON.stringify({ cart: { result: { shops } } })}'></div>`;

  const result = await buyer.queryCart();

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].shopId, '1234567890');
  assert.equal(buyer.orderList.length, 1);
  assert.equal(JSON.parse(buyer.orderList[0].orderParam.param).shop_list[0].shop_id, '1234567890');
});
