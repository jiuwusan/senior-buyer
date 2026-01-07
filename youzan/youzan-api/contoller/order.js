const Router = require('@koa/router');
const { koaBody } = require('koa-body');
const order = require('../service/order');
const router = new Router();

router.get('/timestamp', ctx => ctx.success(Date.now()));
router.get('/order/query/config', async ctx => ctx.success(await order.queryConfig()));
router.get('/order/query/cart', async ctx => ctx.success(await order.queryCart()));
router.post('/order/create', async ctx => ctx.success(await order.createOrder()));
router.post('/order/polling/create', async ctx => ctx.success(await order.pollingOrder(ctx.request.body)));
router.post('/order/target/create', async ctx => ctx.success(await order.targetOrder()));

module.exports = router;
