const config = require('./config');
const { OrderTask } = require('./order_task');

class Order {
  orderTasks = [];
  polling = false;
  interval = 100;

  constructor() {
    this.updateTasks().catch(error => {
      this.orderTasks = [];
      console.error('初始化淘宝任务失败:', error);
    });
  }

  async updateTasks() {
    try {
      const cfg = await config.load();
      cfg.forEach((item, index) => console.log(`淘宝配置 ${index + 1}:`, item));
      this.orderTasks = cfg.map(task => new OrderTask(task));
    } catch (error) {
      this.orderTasks = [];
      throw error;
    }
  }

  queryConfig() {
    return this.orderTasks.map(item => item.getConfig());
  }

  async queryCart() {
    return await Promise.all(this.orderTasks.map(task => task.queryCart()));
  }

  async queryConfirmOrder(payload = {}) {
    return await Promise.all(this.orderTasks.map(task => task.queryConfirmOrder(payload)));
  }

  async queryPreOrder() {
    return await Promise.all(this.orderTasks.map(task => task.queryPreOrder()));
  }

  async queryRebuildPreview(payload = {}) {
    return await Promise.all(this.orderTasks.map(task => task.queryPreOrder(payload)));
  }

  async createOrder(payload = {}) {
    return await Promise.all(this.orderTasks.map(task => task.createOrder(payload)));
  }

  pollingOrder({ polling = false, interval = 50 } = {}) {
    const isStarting = polling && !this.polling;
    const isStopping = !polling && this.polling;

    this.interval = interval;
    this.polling = polling;

    if (isStopping) {
      console.log('用户手动触发：停止淘宝轮询');
    }

    if (isStarting) {
      (async () => {
        console.log('开始淘宝轮询下单');
        const pollingStart = Date.now();
        const timeout = 15000;

        while (this.polling && Date.now() - pollingStart < timeout) {
          const currentStart = Date.now();

          try {
            await this.createOrder();
          } catch (error) {
            console.error('淘宝轮询下单异常:', error);
          }

          const executionTime = Date.now() - currentStart;
          const delay = this.interval - executionTime;

          if (this.polling && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        console.log('淘宝轮询流程结束');
        this.polling = false;
      })();
    }

    return polling ? '开始轮询...' : '取消轮询...';
  }

  async targetOrder() {
    const currentTimestamp = Date.now();
    return await Promise.all(this.orderTasks.map(task => task.checkTargetTime(currentTimestamp)));
  }
}

module.exports = new Order();
