const fs = require('node:fs/promises');
const path = require('node:path');
const DEFAULT_SHOP_ID = '1711911458';

const emptyConfig = () => ({ source_id: '', shop_id: DEFAULT_SHOP_ID, users: [] });
const getConfigPath = () =>
  process.env.WEIDIAN_CONFIG_PATH || path.join(__dirname, '../database/config.json');

function validate(data) {
  if (Array.isArray(data)) {
    throw new Error('检测到旧版配置；请先改为 {"source_id":"...","users":[{"username":"...","password":"..."}]}');
  }
  if (!data || typeof data !== 'object' || typeof data.source_id !== 'string' || !Array.isArray(data.users)) {
    throw new Error('配置必须包含 source_id 字符串和 users 数组');
  }
  const shopId = data.shop_id === undefined ? DEFAULT_SHOP_ID : data.shop_id;
  if (typeof shopId !== 'string' || !/^\d+$/.test(shopId.trim())) {
    throw new Error('shop_id 必须是数字字符串');
  }
  if (data.users.length > 0 && !data.source_id.trim()) throw new Error('source_id 不能为空');

  const usernames = new Set();
  const users = data.users.map((user, index) => {
    const username = typeof user?.username === 'string' ? user.username.trim() : '';
    const password = user?.password;
    if (!username || typeof password !== 'string' || !password) {
      throw new Error(`第 ${index + 1} 个用户需要用户名和密码`);
    }
    if (usernames.has(username)) throw new Error(`重复的 username：${username}`);
    usernames.add(username);
    return { username, password };
  });

  return { source_id: data.source_id.trim(), shop_id: shopId.trim(), users };
}

async function load() {
  const configPath = getConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  let content;
  try {
    content = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const initial = emptyConfig();
    await fs.writeFile(configPath, JSON.stringify(initial, null, 2), { mode: 0o600 });
    return initial;
  }
  return validate(JSON.parse(content));
}

async function update(input) {
  const current = await load();
  const savedPasswords = new Map(current.users.map(user => [user.username, user.password]));
  const merged = {
    source_id: input?.source_id,
    shop_id: input?.shop_id ?? current.shop_id,
    users: Array.isArray(input?.users)
      ? input.users.map(user => ({
          username: user?.username,
          password: user?.password || savedPasswords.get(user?.username) || ''
        }))
      : input?.users
  };
  const next = validate(merged);
  const configPath = getConfigPath();
  await fs.writeFile(configPath, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

function publicView(data) {
  return {
    source_id: data.source_id,
    shop_id: data.shop_id ?? DEFAULT_SHOP_ID,
    users: data.users.map(user => ({ username: user.username, passwordConfigured: Boolean(user.password) }))
  };
}

module.exports = { load, update, publicView, DEFAULT_SHOP_ID };
