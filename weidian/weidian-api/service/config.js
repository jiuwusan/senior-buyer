const path = require('path');
const fs = require('fs-extra');

const load = async () => {
  // __dirname 是当前文件所在的目录
  const configPath = path.join(__dirname, '../database', 'config.json');
  console.log('配置文件路径:', configPath);
  return await fs.readJson(configPath);
};

const update = async () => {
  // 更新用户信息
};

module.exports = {
  load,
  update
};
