const Buyer = require('./buyer');

class OrderTask {
  config = {};
  buyers = [];

  constructor(config) {
    const { buyers } = config;
    this.config = config;
    this.buyers = buyers.filter(buyerConfig => !buyerConfig.disabled).map(buyerConfig => new Buyer(buyerConfig));
  }

  getConfig() {
    return this.config;
  }

  async queryCart() {
    return await Promise.all(this.buyers.map(buyer => buyer.queryCart()));
  }

  async createOrder({ combine }) {
    return await Promise.all(this.buyers.map(buyer => buyer.orderCart({ combine })));
  }

  async queryPreOrder() {
    return await Promise.all(this.buyers.map(buyer => buyer.queryPreOrder()));
  }
}

module.exports = {
  OrderTask
};
