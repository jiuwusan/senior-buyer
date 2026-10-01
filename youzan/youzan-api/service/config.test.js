const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('loads Youzan tasks from the configured runtime file', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'senior-buyer-youzan-'));
  const configPath = path.join(directory, 'config.json');
  const previousPath = process.env.YOUZAN_CONFIG_PATH;

  try {
    await fs.writeFile(configPath, JSON.stringify([{ buyers: [] }]));
    process.env.YOUZAN_CONFIG_PATH = configPath;
    const config = require('./config');
    assert.deepEqual(await config.load(), [{ buyers: [] }]);
  } finally {
    if (previousPath === undefined) delete process.env.YOUZAN_CONFIG_PATH;
    else process.env.YOUZAN_CONFIG_PATH = previousPath;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
