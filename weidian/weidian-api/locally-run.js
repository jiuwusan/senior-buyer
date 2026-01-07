const fs = require('fs-extra');
const Buyer = require('./service/buyer');

const main = async () => {
  const config = await fs.readJson('./database/config.json');
  console.log('配置文件:', config);
};

main();
