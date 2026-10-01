const assert = require('node:assert/strict');
const test = require('node:test');
const { OrderTask } = require('./order_task');

test('target request requires a runtime target time', async () => {
  const task = new OrderTask({ source_id: 'source-1', users: [] });
  assert.deepEqual(await task.checkTargetTime(1000), {
    status: 'invalid',
    message: '请在请求 Body 中提供 targetTime'
  });
});

test('target request accepts runtime timing without storing it in account configuration', async () => {
  const task = new OrderTask({ source_id: 'source-1', users: [] });
  let startedWith;
  task.startTask = async diff => { startedWith = diff; };

  const result = await task.checkTargetTime(1000, { targetTime: '1970-01-01T00:00:01.500Z' });

  assert.equal(result.status, 'running');
  assert.equal(startedWith, 500);
  assert.equal(task.config.advanceTimestamps, 1000);
  assert.deepEqual(task.getConfig(), { source_id: 'source-1', users: [] });
});
