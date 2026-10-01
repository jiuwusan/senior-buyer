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
      users: [{ username: '13800000000', passwordConfigured: true }]
    });
  } finally {
    if (previousPath === undefined) delete process.env.WEIDIAN_CONFIG_PATH;
    else process.env.WEIDIAN_CONFIG_PATH = previousPath;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
