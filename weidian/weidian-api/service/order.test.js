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
      return { OrderTask: class {} };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let order;
  try {
    order = require('./order');
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
