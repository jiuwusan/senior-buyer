const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const config = require('./config');

async function withConfigFile(initial, work) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'weidian-config-'));
  const configPath = path.join(directory, 'config.json');
  const previousPath = process.env.WEIDIAN_CONFIG_PATH;
  process.env.WEIDIAN_CONFIG_PATH = configPath;
  try {
    if (initial !== undefined) await fs.writeFile(configPath, JSON.stringify(initial));
    await work(configPath);
  } finally {
    if (previousPath === undefined) delete process.env.WEIDIAN_CONFIG_PATH;
    else process.env.WEIDIAN_CONFIG_PATH = previousPath;
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('missing configuration initializes with the new object shape', async () => {
  await withConfigFile(undefined, async configPath => {
    assert.deepEqual(await config.load(), { source_id: '', shop_id: '1711911458', users: [] });
    assert.deepEqual(JSON.parse(await fs.readFile(configPath, 'utf8')), { source_id: '', shop_id: '1711911458', users: [] });
  });
});

test('legacy task arrays require an explicit migration', async () => {
  await withConfigFile([{ buyers: [] }], async () => {
    await assert.rejects(config.load(), /旧版配置/);
  });
});

test('updating a user with a blank password retains the stored password', async () => {
  await withConfigFile({ source_id: 'old', users: [{ username: '13800000000', password: 'saved-secret' }] }, async configPath => {
    await config.update({ source_id: 'new', users: [{ username: '13800000000', password: '', passwordConfigured: true }] });
    assert.deepEqual(JSON.parse(await fs.readFile(configPath, 'utf8')), {
      source_id: 'new',
      shop_id: '1711911458',
      users: [{ username: '13800000000', password: 'saved-secret' }]
    });
  });
});

test('a new user requires a password and public configuration never returns one', async () => {
  await withConfigFile({ source_id: 'source', users: [] }, async () => {
    await assert.rejects(config.update({ source_id: 'source', users: [{ username: '13800000000', password: '' }] }), /密码/);
    assert.deepEqual(config.publicView({ source_id: 'source', users: [{ username: '13800000000', password: 'saved-secret' }] }), {
      source_id: 'source',
      shop_id: '1711911458',
      users: [{ username: '13800000000', passwordConfigured: true }]
    });
  });
});

test('shop ID is configurable and old configurations retain the current shop', async () => {
  await withConfigFile({ source_id: 'source', users: [] }, async () => {
    assert.equal((await config.load()).shop_id, '1711911458');
    await config.update({ source_id: 'source', shop_id: '1234567890', users: [] });
    assert.equal((await config.load()).shop_id, '1234567890');
    await assert.rejects(config.update({ source_id: 'source', shop_id: 'not-a-shop', users: [] }), /shop_id/);
  });
});
