const Router = require('@koa/router');
const order = require('./order');
const router = new Router();
router.use('/youzan/api', order.routes(), order.allowedMethods());
module.exports = router;