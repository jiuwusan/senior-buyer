const Buyer = require('./buyer');
const { runSequential } = require('./sequential');
const { publicView } = require('./config');

class OrderTask {
  buyers = [];

  constructor(config) {
    const { source_id, shop_id, users } = config;
    this.publicConfig = publicView(config);
    this.buyers = users.map(user => new Buyer({ source_id, shop_id, ...user }));
  }

  getConfig() {
    return this.publicConfig;
  }

  getCachedUsers(username) {
    const buyers = username === undefined ? this.buyers : this.buyers.filter(buyer => buyer.credentials.username === username);
    return buyers.map(buyer => buyer.getCachedUserInfo());
  }

  async queryCart() {
    return await runSequential(this.buyers, buyer => buyer.queryCart());
  }

  async refreshCookies(username) {
    const buyers = username === undefined ? this.buyers : this.buyers.filter(buyer => buyer.credentials.username === username);
    return await runSequential(buyers, async buyer => {
      const username = buyer.credentials.username;
      try {
        await buyer.refreshSession();
        return { username, status: 'success' };
      } catch {
        return { username, status: 'error', message: '登录失败' };
      }
    });
  }

  async createOrder({ combine }) {
    return await runSequential(this.buyers, buyer => buyer.orderCart({ combine }));
  }

  async queryPreOrder() {
    return await runSequential(this.buyers, buyer => buyer.queryPreOrder());
  }
}

module.exports = {
  OrderTask
};
