const assert = require('node:assert/strict');
const test = require('node:test');
const { OrderTask } = require('./order_task');

test('batch refresh attempts every buyer and returns no session secrets', async () => {
  const task = new OrderTask({ source_id: 'source-1', users: [] });
  task.buyers = [
    { credentials: { username: 'user-1' }, refreshSession: async () => ({ wdtoken: 'secret-token' }) },
    { credentials: { username: 'user-2' }, refreshSession: async () => { throw new Error('secret-password'); } }
  ];

  const results = await task.refreshCookies();

  assert.deepEqual(results, [
    { username: 'user-1', status: 'success' },
    { username: 'user-2', status: 'error', message: '登录失败' }
  ]);
  assert.doesNotMatch(JSON.stringify(results), /secret/);
});

test('task reports cached information for every configured buyer', () => {
  const task = new OrderTask({ source_id: 'source-1', users: [] });
  task.buyers = [
    { getCachedUserInfo: () => ({ username: 'user-1', status: 'cached' }) },
    { getCachedUserInfo: () => ({ username: 'user-2', status: 'not_logged_in' }) }
  ];

  assert.deepEqual(task.getCachedUsers(), [
    { username: 'user-1', status: 'cached' },
    { username: 'user-2', status: 'not_logged_in' }
  ]);
});

test('single user refresh and lookup do not touch other buyers', async () => {
  const task = new OrderTask({ source_id: 'source-1', users: [] });
  const calls = [];
  task.buyers = ['user-1', 'user-2'].map(username => ({
    credentials: { username },
    refreshSession: async () => { calls.push(username); },
    getCachedUserInfo: () => ({ username, status: 'cached' })
  }));

  assert.deepEqual(await task.refreshCookies('user-2'), [{ username: 'user-2', status: 'success' }]);
  assert.deepEqual(calls, ['user-2']);
  assert.deepEqual(task.getCachedUsers('user-1'), [{ username: 'user-1', status: 'cached' }]);
  assert.deepEqual(await task.refreshCookies('missing'), []);
});
