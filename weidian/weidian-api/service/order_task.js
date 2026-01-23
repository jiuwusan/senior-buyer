const Buyer = require('./buyer');

class OrderTask {
  config = {};
  buyers = [];
  running = false;

  constructor(config) {
    const { targetTime, buyers } = config;
    this.config = { targetTimestamp: new Date(targetTime).getTime(), ...config };
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

  async startTask(diffTimestamp) {
    console.log(`任务开始执行...`);
    this.running = true;
    await this.queryCart();
    const { advanceTimestamps, advancePostInterval, postDuration, postInterval } = this.config;
    if (diffTimestamp > advancePostInterval) {
      // 未到提前的时间点
      await new Promise(resolve => setTimeout(resolve, diffTimestamp - advancePostInterval));
    }
    let remainingTimestamps = Math.min(advanceTimestamps, diffTimestamp);
    if (remainingTimestamps > advancePostInterval) {
      await new Promise(resolve => {
        const remainingInterval = setInterval(() => {
          if (!this.running) {
            resolve();
            return clearInterval(remainingInterval);
          }
          remainingTimestamps -= advancePostInterval;
          if (remainingTimestamps < advancePostInterval) {
            resolve();
            clearInterval(remainingInterval);
          }
        }, advancePostInterval);
      });
    }
    await new Promise(resolve => {
      let postDurationStocks = 0;
      const postDurationInterval = setInterval(() => {
        if (!this.running) {
          resolve();
          return clearInterval(postDurationInterval);
        }
        postDurationStocks += postInterval;
        if (postDurationStocks >= postDuration) {
          resolve();
          clearInterval(postDurationInterval);
        }
      }, postInterval);
    });
  }

  async stopTask() {
    this.running = false;
  }

  async checkTargetTime(currentTimestamp) {
    const { targetTimestamp, advanceTimestamps, advancePostInterval, postDuration, postInterval } = this.config;
    if (this.running) {
      return {
        status: 'running',
        message: '任务正在运行中...！'
      };
    }
    if (targetTimestamp < currentTimestamp) {
      return {
        status: 'timeout',
        message: '任务时间已过期！'
      };
    }
    const diffTimestamp = targetTimestamp - currentTimestamp;
    if (diffTimestamp > advanceTimestamps && diffTimestamp > 1000) {
      return {
        status: 'waiting',
        message: `任务将在${diffTimestamp}秒后开始执行！`
      };
    }
    this.startTask(diffTimestamp);
    return {
      status: 'running',
      message: `任务已开始执行！`
    };
  }
}

module.exports = {
  OrderTask
};
