const Router = require('@koa/router');
const order = require('./order');

const router = new Router();

router.use('/taobao/api', order.routes(), order.allowedMethods());

module.exports = router;
