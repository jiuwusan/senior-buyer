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
});
