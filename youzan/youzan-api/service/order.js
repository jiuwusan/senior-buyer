const config = require('./config');
const { OrderTask } = require('./order_task');

class Order {
  orderTasks = [];
  polling = false;
  interval = 100;
  constructor() {
    this.updateTasks();
  }

  async updateTasks() {
    const cfg = await config.load();
    cfg.forEach((item, index) => console.log(`配置文件 ${index + 1}：`, item));
    this.orderTasks = cfg.map(task => new OrderTask(task));
  }
  queryConfig() {
    return this.orderTasks.map(item => item.getConfig());
  }
  async queryCart() {
    return await Promise.all(this.orderTasks.map(task => task.queryCart()));
  }

  async createOrder() {
    return await Promise.all(this.orderTasks.map(task => task.createOrder()));
  }

  pollingOrder({ polling = false, interval = 100 }) {
    this.polling = polling;
    this.interval = interval;
    if (polling) {
      (async () => {
        // console.log('查询购物车');
        // await this.queryCart();
        console.log('开始轮询下单');
        while (this.polling) {
          console.log('调用下单:', this.polling, this.interval);
          this.createOrder();
          await new Promise(resolve => setTimeout(resolve, this.interval));
        }
      })();
    }
    return polling ? '开始轮询' : '取消轮询';
  }

  async targetOrder() {
    const currentTimestamp = Date.now();
    return await Promise.all(this.orderTasks.map(task => task.checkTargetTime(currentTimestamp)));
  }
}

module.exports = new Order();
