const path = require('path');
const fs = require('fs-extra');

const getConfigPath = () => path.join(__dirname, '../database', 'config.json');

const ensureConfigFile = async () => {
  const configPath = getConfigPath();
  await fs.ensureDir(path.dirname(configPath));

  if (!(await fs.pathExists(configPath))) {
    console.warn('配置文件不存在，已初始化为空数组:', configPath);
    await fs.writeJson(configPath, [], { spaces: 2 });
  }

  return configPath;
};

const load = async () => {
  const configPath = await ensureConfigFile();
  console.log('配置文件路径:', configPath);
  const data = await fs.readJson(configPath);
  if (!Array.isArray(data)) {
    throw new Error('配置文件必须是数组格式');
  }
  return data;
};

const update = async (data) => {
  const configPath = await ensureConfigFile();
  console.log('更新配置文件:', configPath);
  await fs.writeJson(configPath, data, { spaces: 2 });
  return data;
};

module.exports = {
  load,
  update
};
