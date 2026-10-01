const assert = require('node:assert/strict');
const test = require('node:test');
const Buyer = require('./buyer');

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
    }
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
    }
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
