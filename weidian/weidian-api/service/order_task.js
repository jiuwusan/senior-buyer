const Buyer = require('./buyer');
const { runSequential } = require('./sequential');
const { publicView } = require('./config');

class OrderTask {
  buyers = [];

  constructor(config) {
    const { source_id, users } = config;
    this.publicConfig = publicView(config);
    this.buyers = users.map(user => new Buyer({ source_id, ...user }));
  }

  getConfig() {
    return this.publicConfig;
  }

  async queryCart() {
    return await runSequential(this.buyers, buyer => buyer.queryCart());
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
