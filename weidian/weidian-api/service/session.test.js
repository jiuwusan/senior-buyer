const assert = require('node:assert/strict');
const test = require('node:test');
const { loginAndResolveBuyer } = require('./session');

function response(body, cookies = []) {
  return {
    ok: true,
    status: 200,
    headers: { getSetCookie: () => cookies },
    json: async () => body
  };
}

test('login resolves buyer session and default address from credentials', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return response(
        { status: { status_code: 0 }, result: { bid: 123 } },
        ['wdtoken=token123; Path=/; Domain=.weidian.com', 'login_token=session456; Path=/; Domain=.weidian.com']
      );
    }
    return response({ status: { code: 0 }, result: [{ id: 44, isDefault: 0 }, { id: 55, isDefault: 1 }] });
  };

  const session = await loginAndResolveBuyer({ username: '13800000000', password: 'test-password' }, fetchImpl);

  assert.deepEqual(session, {
    buyer_id: 123,
    address_id: 55,
    shopid: '1711911458',
    wdtoken: 'token123',
    cookie: 'wdtoken=token123; login_token=session456'
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0].options.body.toString(), /phone=13800000000/);
  assert.match(calls[0].options.body.toString(), /password=test-password/);
  assert.equal(calls[1].options.body.get('wdtoken'), 'token123');
});

test('multiple addresses without a default fail before any order can be placed', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return calls === 1
      ? response({ status: { status_code: 0 }, result: { bid: 123 } }, ['wdtoken=token123; Path=/'])
      : response({ status: { code: 0 }, result: [{ id: 1 }, { id: 2 }] });
  };

  await assert.rejects(
    loginAndResolveBuyer({ username: '13800000000', password: 'test-password' }, fetchImpl),
    /默认收货地址/
  );
});

test('login errors do not include the submitted password', async () => {
  const fetchImpl = async () => response({ status: { status_code: 430001, status_reason: '需要图形验证' } });

  await assert.rejects(
    loginAndResolveBuyer({ username: '13800000000', password: 'test-password' }, fetchImpl),
    error => error.message.includes('需要图形验证') && !error.message.includes('test-password')
  );
});

test('login session uses the configured shop ID', async () => {
  let calls = 0;
  const fetchImpl = async () => ++calls === 1
    ? response({ status: { status_code: 0 }, result: { bid: 123 } }, ['wdtoken=token123; Path=/'])
    : response({ status: { code: 0 }, result: [{ id: 55, isDefault: 1 }] });

  const session = await loginAndResolveBuyer(
    { username: '13800000000', password: 'test-password', shop_id: '1234567890' },
    fetchImpl
  );

  assert.equal(session.shopid, '1234567890');
});
