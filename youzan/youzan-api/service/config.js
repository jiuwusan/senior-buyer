const fs = require('node:fs/promises');
const path = require('node:path');

const getConfigPath = () =>
  process.env.YOUZAN_CONFIG_PATH || path.join(__dirname, '../database/config.json');

const load = async () => {
  const configPath = getConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  let data;
  try {
    data = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    data = '[]';
    await fs.writeFile(configPath, data);
  }

  const tasks = JSON.parse(data);
  if (!Array.isArray(tasks)) throw new Error('配置文件必须是数组格式');
  return tasks;
};

module.exports = { load };
