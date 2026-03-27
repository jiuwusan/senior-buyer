const config = require('./config');
const { OrderTask } = require('./order_task');
const { runSequential } = require('./sequential');

class Order {
  orderTasks = [];
  polling = false;
  interval = 100;
  constructor() {
    this.updateTasks().catch(error => {
      this.orderTasks = [];
      console.error('初始化任务失败:', error);
    });
  }

  async updateTasks() {
    try {
      const cfg = await config.load();
      cfg.forEach((item, index) => console.log(`配置文件 ${index + 1}：`, item));
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
    return await runSequential(this.orderTasks, task => task.queryCart());
  }

  async createOrder({ combine }) {
    return await runSequential(this.orderTasks, task => task.createOrder({ combine }));
  }

  async queryPreOrder() {
    return await runSequential(this.orderTasks, task => task.queryPreOrder());
  }

  pollingOrder({ polling = false, interval = 50 } = {}) {
    const isStarting = polling && !this.polling; // 记录是否是从“关”到“开”
    const isStopping = !polling && this.polling; // 记录是否是从“开”到“关”

    this.interval = interval;
    this.polling = polling;

    isStopping && console.log('用户手动触发：停止轮询');

    isStarting &&
      (async () => {
        console.log('开始轮询下单');
        const pollingStart = Date.now();
        const TIMEOUT = 35000;

        // 使用同步循环 + await 补偿
        while (this.polling && Date.now() - pollingStart < TIMEOUT) {
          const currentStart = Date.now();

          try {
            await this.createOrder({ combine: currentStart - pollingStart < 5000 });
          } catch (error) {
            console.error('下单异常:', error);
          }

          // 计算剩余需要等待的时间
          const executionTime = Date.now() - currentStart;
          const delay = this.interval - executionTime;

          // 二次确认：如果在请求期间手动停止了，就没必要 sleep 了
          if (this.polling && delay > 0) {
            console.log(`等待 ${delay} ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        // 循环自然结束（超时或手动停止）后清理状态
        console.log('轮询流程结束');
        this.polling = false;
      })();

    return polling ? '开始轮询...' : '取消轮询...';
  }

  async targetOrder() {
    const currentTimestamp = Date.now();
    return await runSequential(this.orderTasks, task => task.checkTargetTime(currentTimestamp));
  }
}

module.exports = new Order();
