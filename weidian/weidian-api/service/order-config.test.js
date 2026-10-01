const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('new configuration creates one task and public query hides passwords', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'weidian-order-'));
  const configPath = path.join(directory, 'config.json');
  const previousPath = process.env.WEIDIAN_CONFIG_PATH;
  process.env.WEIDIAN_CONFIG_PATH = configPath;

  try {
    await fs.writeFile(configPath, JSON.stringify({
      source_id: 'source-1',
      users: [{ username: '13800000000', password: 'test-password' }]
    }));
    const order = require('./order');
    await order.updateTasks();

    assert.equal(order.orderTasks.length, 1);
    assert.equal(order.orderTasks[0].buyers.length, 1);
    assert.deepEqual(order.queryConfig(), {
      source_id: 'source-1',
      shop_id: '1711911458',
      users: [{ username: '13800000000', passwordConfigured: true }]
    });
  } finally {
    if (previousPath === undefined) delete process.env.WEIDIAN_CONFIG_PATH;
    else process.env.WEIDIAN_CONFIG_PATH = previousPath;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('saving configuration preserves cached login for an existing user', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'weidian-order-'));
  const configPath = path.join(directory, 'config.json');
  const previousPath = process.env.WEIDIAN_CONFIG_PATH;
  process.env.WEIDIAN_CONFIG_PATH = configPath;

  try {
    const config = require('./config');
    const order = require('./order');
    await config.update({
      source_id: 'source-1', shop_id: '1711911458',
      users: [{ username: 'user-1', password: 'password-1' }]
    });
    await order.updateTasks();
    const buyer = order.orderTasks[0].buyers[0];
    buyer.sessionLoader = async () => ({
      buyer_id: 123, address_id: 456, shopid: '1711911458',
      wdtoken: 'token-1', cookie: 'wdtoken=token-1'
    });
    await buyer.refreshSession();
    const beforeSave = order.queryCachedUsers('user-1')[0];

    await config.update({
      source_id: 'source-2', shop_id: '1711911458',
      users: [
        { username: 'user-1', password: '' },
        { username: 'user-2', password: 'password-2' }
      ]
    });
    await order.updateTasks();

    assert.deepEqual(order.queryCachedUsers('user-1'), [beforeSave]);
    assert.equal(order.queryCachedUsers('user-2')[0].status, 'not_logged_in');
    assert.equal(order.orderTasks[0].buyers[0].config.source_id, 'source-2');
  } finally {
    if (previousPath === undefined) delete process.env.WEIDIAN_CONFIG_PATH;
    else process.env.WEIDIAN_CONFIG_PATH = previousPath;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
