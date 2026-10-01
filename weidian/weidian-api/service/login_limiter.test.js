const assert = require('node:assert/strict');
const test = require('node:test');
const { LoginLimiter } = require('./login_limiter');

test('login attempts are serialized and start at least five seconds apart, even after a failure', async () => {
  let time = 0;
  let active = 0;
  let maxActive = 0;
  const starts = [];
  const limiter = new LoginLimiter({
    intervalMs: 5000,
    now: () => time,
    sleep: async ms => { time += ms; }
  });

  const attempts = [false, true, false].map(shouldFail => limiter.run(async () => {
    starts.push(time);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
    if (shouldFail) throw new Error('login failed');
    return 'ok';
  }));

  const results = await Promise.allSettled(attempts);
  assert.deepEqual(starts, [0, 5000, 10000]);
  assert.equal(maxActive, 1);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'fulfilled']);
});
