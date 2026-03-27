class CreateOrderLimiter {
  constructor({
    limit = 40,
    windowMs = 1000,
    now = () => Date.now(),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.sleep = sleep;
    this.timestamps = [];
    this.pending = Promise.resolve();
  }

  async waitTurn() {
    const currentTask = this.pending.then(() => this.acquire());
    this.pending = currentTask.catch(() => {});
    return await currentTask;
  }

  async acquire() {
    let totalWaitMs = 0;

    while (true) {
      const currentTime = this.now();

      while (this.timestamps.length > 0 && currentTime - this.timestamps[0] >= this.windowMs) {
        this.timestamps.shift();
      }

      if (this.timestamps.length < this.limit) {
        this.timestamps.push(currentTime);
        return totalWaitMs;
      }

      const waitMs = this.timestamps[0] + this.windowMs - currentTime;
      totalWaitMs += waitMs;
      await this.sleep(waitMs);
    }
  }
}

const createOrderLimiter = new CreateOrderLimiter();

module.exports = {
  CreateOrderLimiter,
  createOrderLimiter
};
