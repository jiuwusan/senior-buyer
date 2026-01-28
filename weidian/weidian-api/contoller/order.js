const Router = require('@koa/router');
const { koaBody } = require('koa-body');
const order = require('../service/order');
const config = require('../service/config');
const router = new Router();

router.get('/timestamp', ctx => ctx.success(Date.now()));
router.get('/order/query/config', async ctx => ctx.success(await order.queryConfig()));
router.get('/order/query/cart', async ctx => ctx.success(await order.queryCart()));
router.get('/order/query/preOrder', async ctx => ctx.success(await order.queryPreOrder()));
router.post('/order/create', async ctx => ctx.success(await order.createOrder(ctx.request.body || {})));
router.post('/order/polling/create', async ctx => ctx.success(await order.pollingOrder(ctx.request.body || {})));
router.post('/order/target/create', async ctx => ctx.success(await order.targetOrder()));
router.post('/order/update/config', async ctx => {
  const data = ctx.request.body;
  if (!Array.isArray(data)) {
    return ctx.fail(-1, '配置必须是数组格式');
  }
  await config.update(data);
  await order.updateTasks();
  ctx.success(await order.queryConfig(), '配置更新成功');
});

module.exports = router;
