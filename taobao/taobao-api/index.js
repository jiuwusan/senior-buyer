const Koa = require('koa');
const koaJson = require('koa-json');
const bodyParser = require('koa-bodyparser');
const path = require('path');
const serve = require('koa-static');
const controllers = require('./contoller/index');

const PORT = process.env.PORT || 37073;
const app = new Koa();
const staticMiddleware = serve(path.join(__dirname, 'public'));

app.use(bodyParser());
app.use(koaJson());

app.use(async (ctx, next) => {
  ctx.success = (data, msg = '成功') => {
    ctx.body = { code: 200, msg, data };
  };

  ctx.fail = (code = -99, msg = '失败', data) => {
    ctx.body = { code, msg, data };
  };

  await next();
});

app.use(async (ctx, next) => {
  try {
    console.log('gateway:', ctx.method, ctx.path);
    await next();
  } catch (error) {
    console.error('request error:', error);
    ctx.fail(error.code || -99, error.message || 'system error', error.data);
  }
});

app.use(staticMiddleware);
app.use(controllers.routes());
app.use(controllers.allowedMethods());

controllers.stack.forEach(route => {
  const methods = route.methods.filter(method => method !== 'HEAD');
  console.log(`Route: ${methods.join(', ')} ${route.path}`);
});

app.listen(PORT, () => {
  console.log(`Taobao API running on 0.0.0.0:${PORT}`);
});
