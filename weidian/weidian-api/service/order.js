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
      this.orderTasks = [new OrderTask(cfg)];
    } catch (error) {
      this.orderTasks = [];
      throw error;
    }
  }
  queryConfig() {
    return this.orderTasks[0]?.getConfig() || { source_id: '', users: [] };
  }
  queryCachedUsers() {
    return this.orderTasks.flatMap(task => task.getCachedUsers());
  }
  async queryCart() {
    return await runSequential(this.orderTasks, task => task.queryCart());
  }

  async refreshCookies() {
    return (await runSequential(this.orderTasks, task => task.refreshCookies())).flat();
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
