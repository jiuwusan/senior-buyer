const Buyer = require('./buyer');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class OrderTask {
  config = {};
  buyers = [];
  running = false;

  constructor(config) {
    const { targetTime, buyers = [] } = config;
    this.config = {
      ...config,
      targetTimestamp: targetTime ? new Date(targetTime).getTime() : 0
    };
    this.buyers = buyers.filter(buyerConfig => !buyerConfig.disabled).map(buyerConfig => new Buyer(buyerConfig));
  }

  getConfig() {
    return this.config;
  }

  async queryCart() {
    return await Promise.all(this.buyers.map(buyer => buyer.queryCart()));
  }

  async queryConfirmOrder(payload = {}) {
    return await Promise.all(this.buyers.map(buyer => buyer.queryConfirmOrder(payload)));
  }

  async queryPreOrder(payload = {}) {
    return await Promise.all(this.buyers.map(buyer => buyer.queryPreOrder(payload)));
  }

  async createOrder(payload = {}) {
    return await Promise.all(this.buyers.map(buyer => buyer.createOrder(payload)));
  }

  async startTask(diffTimestamp) {
    if (this.running) {
      return;
    }

    console.log('淘宝任务开始执行...');
    this.running = true;

    try {
      const { advanceTimestamps = 0, advancePostInterval = 200, postDuration = 1000, postInterval = 50 } = this.config;
      const warmupWindow = Math.min(Math.max(diffTimestamp, 0), Math.max(advanceTimestamps, 0));
      const waitBeforeWarmup = Math.max(diffTimestamp - warmupWindow, 0);

      if (waitBeforeWarmup > 0) {
        await sleep(waitBeforeWarmup);
      }

      const warmupEnd = Date.now() + warmupWindow;
      while (this.running && Date.now() < warmupEnd) {
        const startedAt = Date.now();
        await this.createOrder();
        const delay = Math.max(advancePostInterval - (Date.now() - startedAt), 0);
        if (this.running && delay > 0) {
          await sleep(delay);
        }
      }

      const executeEnd = Date.now() + Math.max(postDuration, 0);
      while (this.running && Date.now() < executeEnd) {
        const startedAt = Date.now();
        await this.createOrder();
        const delay = Math.max(postInterval - (Date.now() - startedAt), 0);
        if (this.running && delay > 0) {
          await sleep(delay);
        }
      }
    } finally {
      this.running = false;
      console.log('淘宝任务执行结束');
    }
  }

  async stopTask() {
    this.running = false;
  }

  async checkTargetTime(currentTimestamp) {
    const { targetTimestamp, advanceTimestamps = 0 } = this.config;

    if (this.running) {
      return {
        status: 'running',
        message: '任务正在运行中...！'
      };
    }

    if (!targetTimestamp) {
      return {
        status: 'invalid',
        message: '未配置目标时间'
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
        message: `任务将在 ${diffTimestamp} 毫秒后开始执行`
      };
    }

    this.startTask(diffTimestamp);
    return {
      status: 'running',
      message: '任务已开始执行！'
    };
  }
}

module.exports = {
  OrderTask
};
