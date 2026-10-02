const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

test('polling runs for 15 seconds and combines orders in the first 3 seconds', async () => {
  const orderPath = path.join(__dirname, 'order.js');
  const originalLoad = Module._load;

  Module._load = function (request, parent, isMain) {
    if (parent?.filename === orderPath && request === './config') {
      return { load: async () => [] };
    }
    if (parent?.filename === orderPath && request === './order_task') {
      return { OrderTask: class { buyers = []; get activeBuyers() { return this.buyers; } } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let order;
  try {
    order = require('./order');
    await order.updateTasks();
  } finally {
    Module._load = originalLoad;
  }

  const originalNow = Date.now;
  const originalCreateOrder = order.createOrder;
  let elapsedMs = 0;
  const calls = [];
  Date.now = () => elapsedMs;
  order.createOrder = async ({ combine }) => {
    calls.push(combine);
    elapsedMs += 1000;
  };
  order.orderTasks = [{ buyers: [{}], activeBuyers: [{}] }];

  try {
    order.pollingOrder({ polling: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(order.polling, false);
    assert.equal(calls.length, 15);
    assert.deepEqual(calls.slice(0, 3), [true, true, true]);
    assert.ok(calls.slice(3).every(combine => combine === false));
  } finally {
    Date.now = originalNow;
    order.createOrder = originalCreateOrder;
    order.polling = false;
  }
});

test('polling does not start when no users are configured', async () => {
  const originalLoad = Module._load;
  const orderPath = path.join(__dirname, 'order.js');
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === orderPath && request === './config') {
      return { load: async () => ({ source_id: '', users: [] }) };
    }
    if (parent?.filename === orderPath && request === './order_task') {
      return { OrderTask: class { buyers = []; get activeBuyers() { return this.buyers; } } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let order;
  try {
    delete require.cache[require.resolve('./order')];
    order = require('./order');
    await order.updateTasks();
  } finally {
    Module._load = originalLoad;
  }

  const originalNow = Date.now;
  let now = 0;
  Date.now = () => (now += 15000);
  try {
    assert.equal(order.pollingOrder({ polling: true }), '没有可下单的用户');
    assert.equal(order.polling, false);
  } finally {
    Date.now = originalNow;
    order.polling = false;
  }
});
