const config = require('./config');
const { OrderTask } = require('./order_task');
const { runSequential } = require('./sequential');

class Order {
  orderTasks = [];
  polling = false;
  constructor() {
    this.updateTasks().catch(error => {
      this.orderTasks = [];
      console.error('初始化任务失败:', error);
    });
  }

  async updateTasks() {
    try {
      const cfg = await config.load();
      const previousBuyers = new Map(this.orderTasks.flatMap(task => task.buyers.map(buyer => [buyer.credentials.username, buyer])));
      const task = new OrderTask(cfg);
      task.buyers = task.buyers.map(buyer => {
        const existing = previousBuyers.get(buyer.credentials.username);
        if (!existing) return buyer;
        if (existing.config.source_id !== buyer.config.source_id || existing.config.shopid !== buyer.config.shopid) {
          existing.orderList = [];
          existing.combineOrder = {};
          existing.succeedIds = [];
        }
        existing.credentials.password = buyer.credentials.password;
        existing.config.source_id = buyer.config.source_id;
        existing.config.shopid = buyer.config.shopid;
        return existing;
      });
      this.orderTasks = [task];
    } catch (error) {
      this.orderTasks = [];
      throw error;
    }
  }
  queryConfig() {
    return this.orderTasks[0]?.getConfig() || { source_id: '', shop_id: config.DEFAULT_SHOP_ID, users: [] };
  }
  queryCachedUsers(username) {
    const users = this.orderTasks.flatMap(task => task.getCachedUsers(username));
    if (username !== undefined && users.length === 0) throw new Error('未找到指定用户');
    return users;
  }
  async queryCart() {
    return await runSequential(this.orderTasks, task => task.queryCart());
  }

  async refreshCookies(username) {
    const results = (await runSequential(this.orderTasks, task => task.refreshCookies(username))).flat();
    if (username !== undefined && results.length === 0) throw new Error('未找到指定用户');
    return results;
  }

  async createOrder({ combine }) {
    return await runSequential(this.orderTasks, task => task.createOrder({ combine }));
  }

  async queryPreOrder() {
    return await runSequential(this.orderTasks, task => task.queryPreOrder());
  }

  pollingOrder({ polling = false } = {}) {
    if (polling && !this.orderTasks.some(task => task.buyers.length > 0)) {
      return '没有可下单的用户';
    }
    const isStarting = polling && !this.polling; // 记录是否是从“关”到“开”
    const isStopping = !polling && this.polling; // 记录是否是从“开”到“关”

    this.polling = polling;

    isStopping && console.log('用户手动触发：停止轮询');

    isStarting &&
      (async () => {
        console.log('开始轮询下单');
        const pollingStart = Date.now();
        const TIMEOUT = 15000;

        // 使用同步循环 + await 补偿
        while (this.polling && Date.now() - pollingStart < TIMEOUT) {
          try {
            await this.createOrder({ combine: Date.now() - pollingStart < 3000 });
          } catch (error) {
            console.error('下单异常:', error);
          }
        }

        // 循环自然结束（超时或手动停止）后清理状态
        console.log('轮询流程结束');
        this.polling = false;
      })();

    return polling ? '开始轮询...' : '取消轮询...';
  }

}

module.exports = new Order();
