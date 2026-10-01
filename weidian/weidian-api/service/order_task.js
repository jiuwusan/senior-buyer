const Buyer = require('./buyer');
const { runSequential } = require('./sequential');
const { publicView } = require('./config');

class OrderTask {
  config = {};
  buyers = [];
  running = false;

  constructor(config) {
    const { source_id, users } = config;
    this.config = { source_id };
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

  async checkTargetTime(currentTimestamp, options = {}) {
    if (this.running) {
      return {
        status: 'running',
        message: '任务正在运行中...！'
      };
    }
    if (options.targetTime === undefined || options.targetTime === '') {
      return { status: 'invalid', message: '请在请求 Body 中提供 targetTime' };
    }
    const targetTimestamp = typeof options.targetTime === 'number'
      ? options.targetTime
      : Date.parse(options.targetTime);
    if (!Number.isFinite(targetTimestamp)) {
      return { status: 'invalid', message: 'targetTime 必须是有效的时间' };
    }
    const defaults = {
      advanceTimestamps: 1000,
      advancePostInterval: 200,
      postDuration: 1000,
      postInterval: 50
    };
    const timing = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, options[key] ?? fallback]));
    if (Object.values(timing).some(value => !Number.isFinite(value) || value <= 0)) {
      return { status: 'invalid', message: '定时参数必须是大于 0 的数字' };
    }
    if (targetTimestamp < currentTimestamp) {
      return {
        status: 'timeout',
        message: '任务时间已过期！'
      };
    }
    Object.assign(this.config, timing);
    const diffTimestamp = targetTimestamp - currentTimestamp;
    if (diffTimestamp > timing.advanceTimestamps && diffTimestamp > 1000) {
      return {
        status: 'waiting',
        message: `任务将在${Math.ceil(diffTimestamp / 1000)}秒后开始执行！`
      };
    }
    this.startTask(diffTimestamp)
      .catch(error => console.error('定时任务执行失败:', error))
      .finally(() => { this.running = false; });
    return {
      status: 'running',
      message: `任务已开始执行！`
    };
  }
}

module.exports = {
  OrderTask
};
