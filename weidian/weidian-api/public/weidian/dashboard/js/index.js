let configData = { source_id: '', shop_id: '1711911458', users: [] };
const apiDefinitions = [
  {
    key: 'timestamp',
    name: '获取时间戳',
    method: 'GET',
    path: '/weidian/api/timestamp',
    description: '获取服务端当前时间戳。',
    defaultParams: () => ({})
  },
  {
    key: 'queryConfig',
    name: '查询配置',
    method: 'GET',
    path: '/weidian/api/order/query/config',
    description: '获取当前账号配置（密码不会返回）。',
    defaultParams: () => ({})
  },
  {
    key: 'queryCart',
    name: '查询购物车',
    method: 'GET',
    path: '/weidian/api/order/query/cart',
    description: '查询所有启用买家的购物车。',
    defaultParams: () => ({})
  },
  {
    key: 'queryCachedUsers',
    name: '查看缓存用户信息',
    method: 'GET',
    path: '/weidian/api/order/query/cached-users',
    description: '查看进程内缓存信息；可用 username 查询单个账号，不返回 Cookie 或 token。',
    defaultParams: () => ({})
  },
  {
    key: 'refreshCookies',
    name: '批量刷新 Cookie',
    method: 'POST',
    path: '/weidian/api/order/cookies/refresh',
    description: '重新登录已保存账号；请求 Body 可传 username 刷新单个账号，不传则批量刷新。',
    defaultParams: () => ({})
  },
  {
    key: 'queryPreOrder',
    name: '查询预下单',
    method: 'GET',
    path: '/weidian/api/order/query/preOrder',
    description: '查询预下单参数。',
    defaultParams: () => ({})
  },
  {
    key: 'splitOrder',
    name: '拆单下单',
    method: 'POST',
    path: '/weidian/api/order/create',
    description: '对全部任务按商品拆单发起下单。',
    defaultParams: () => ({ combine: false })
  },
  {
    key: 'combineOrder',
    name: '聚合下单',
    method: 'POST',
    path: '/weidian/api/order/create',
    description: '对全部任务按聚合订单发起下单。',
    defaultParams: () => ({ combine: true })
  },
  {
    key: 'pollingCreate',
    name: '轮询下单',
    method: 'POST',
    path: '/weidian/api/order/polling/create',
    description: '手动开启或停止轮询。开启后最长运行 15 秒，前 3 秒聚合下单；定时触发请在服务器 crontab 中配置。',
    defaultParams: () => ({ polling: true })
  },
  {
    key: 'updateConfig',
    name: '更新配置',
    method: 'POST',
    path: '/weidian/api/order/update/config',
    description: '将当前页面配置提交到后端。',
    defaultParams: () => ({
      source_id: configData.source_id,
      shop_id: configData.shop_id,
      users: configData.users.map(user => ({ username: user.username, password: '' }))
    })
  }
];
let activeApiKey = apiDefinitions[0].key;
let messageTimeout;
let refreshPending = false;

function showMessage(msg, type = 'success') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = msg;
  messageEl.className = `message ${type} show`;
  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => {
    messageEl.className = 'message';
  }, 3000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

async function loadConfig(showSuccess = false) {
  try {
    const response = await fetch('/weidian/api/order/query/config');
    const result = await response.json();
    if (result.code !== 200) throw new Error(result.msg || '加载失败');
    configData = {
      source_id: result.data.source_id || '',
      shop_id: result.data.shop_id || '1711911458',
      users: (result.data.users || []).map(user => ({
        username: user.username,
        password: '',
        passwordConfigured: user.passwordConfigured
      }))
    };
    renderConfig();
    if (showSuccess) showMessage('配置已重新载入');
  } catch (error) {
    showMessage('加载配置失败: ' + error.message, 'error');
  }
}

async function saveConfig() {
  const button = document.getElementById('saveConfigButton');
  button.disabled = true;
  try {
    const response = await fetch('/weidian/api/order/update/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });
    const result = await response.json();
    if (result.code !== 200) throw new Error(result.msg || '保存失败');
    showMessage('配置保存成功');
    await loadConfig();
    await loadCachedUsers();
  } catch (error) {
    showMessage('保存配置失败: ' + error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function refreshCookies(username, clickedButton) {
  if (refreshPending) return;
  refreshPending = true;
  const button = clickedButton || document.getElementById('refreshCookiesButton');
  const batchButton = document.getElementById('refreshCookiesButton');
  const resultEl = document.getElementById('refreshResult');
  button.disabled = true;
  batchButton.disabled = true;
  resultEl.className = 'inline-status';
  resultEl.textContent = username ? `正在刷新账号 ${username} 的 Cookie...` : '正在刷新全部已保存账号的 Cookie...';
  try {
    const response = await fetch('/weidian/api/order/cookies/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(username === undefined ? {} : { username })
    });
    const result = await response.json();
    if (!response.ok || result.code !== 200 || !Array.isArray(result.data)) {
      throw new Error(result.msg || '请求失败');
    }
    const succeeded = result.data.filter(item => item.status === 'success').length;
    const failed = result.data.filter(item => item.status !== 'success').map(item => item.username);
    resultEl.textContent = result.data.length === 0
      ? '没有已保存的账号，请先保存配置。'
      : username
        ? `账号 ${username} 的 Cookie ${failed.length ? '刷新失败' : '已刷新'}。`
        : `Cookie 刷新完成：成功 ${succeeded} 个，失败 ${failed.length} 个。${failed.length ? `失败账号：${failed.join('、')}。` : ''}`;
    if (failed.length) resultEl.classList.add('error');
    showMessage(failed.length ? '部分账号刷新失败' : 'Cookie 刷新完成', failed.length ? 'error' : 'success');
    await loadCachedUsers();
  } catch (error) {
    resultEl.textContent = `Cookie 刷新失败：${error.message}`;
    resultEl.classList.add('error');
    showMessage('Cookie 刷新失败', 'error');
  } finally {
    button.disabled = false;
    batchButton.disabled = false;
    refreshPending = false;
  }
}

async function loadCachedUsers(username) {
  const button = document.getElementById('cachedUsersButton');
  const resultEl = document.getElementById('cachedUsersResult');
  button.disabled = true;
  resultEl.textContent = '正在读取缓存用户信息...';
  try {
    const url = new URL('/weidian/api/order/query/cached-users', window.location.origin);
    if (username !== undefined) url.searchParams.set('username', username);
    const response = await fetch(url);
    const result = await response.json();
    if (!response.ok || result.code !== 200 || !Array.isArray(result.data)) {
      throw new Error(result.msg || '请求失败');
    }
    if (username === undefined) {
      document.getElementById('sessionCountSummary').textContent = String(result.data.filter(user => user.status === 'cached').length);
    }
    resultEl.innerHTML = result.data.length === 0
      ? '<p class="empty-note">没有已保存的账号。请先在左侧添加账号并保存。</p>'
      : `${username === undefined ? '' : `<p class="filter-note">正在查看 ${escapeHtml(username)} 的缓存信息</p>`}<div class="session-list">${result.data.map(user => `
          <div class="session-row">
            <div class="session-row-heading"><strong>${escapeHtml(user.username)}</strong><span class="status-badge ${user.status === 'cached' ? '' : 'muted'}">${user.status === 'cached' ? '已缓存' : '未登录'}</span></div>
            <div class="session-details"><span>买家 ID <strong>${escapeHtml(user.buyer_id ?? '—')}</strong></span><span>默认地址 ID <strong>${escapeHtml(user.address_id ?? '—')}</strong></span><span>店铺 ID <strong>${escapeHtml(user.shopid ?? '—')}</strong></span></div>
            <div class="session-time">最后登录：${escapeHtml(user.refreshedAt ? new Date(user.refreshedAt).toLocaleString('zh-CN') : '—')}</div>
            <div class="session-row-actions"><button class="btn btn-quiet btn-sm" type="button" data-view-user="${escapeHtml(user.username)}">查看</button><button class="btn btn-secondary btn-sm" type="button" data-refresh-user="${escapeHtml(user.username)}">刷新 Cookie</button></div>
          </div>`).join('')}</div>`;
  } catch (error) {
    resultEl.textContent = `读取缓存用户信息失败：${error.message}`;
    if (username === undefined) document.getElementById('sessionCountSummary').textContent = '—';
  } finally {
    button.disabled = false;
  }
}

function renderConfig() {
  const container = document.getElementById('tasksContainer');
  document.getElementById('shopIdSummary').textContent = configData.shop_id || '—';
  document.getElementById('accountCountSummary').textContent = String(configData.users.length);
  container.innerHTML = `
      <div class="config-fields">
        <div class="form-group">
          <label>Source ID</label>
          <input type="text" value="${escapeHtml(configData.source_id)}" oninput="configData.source_id = this.value">
        </div>
        <div class="form-group">
          <label>店铺 ID</label>
          <input type="text" inputmode="numeric" value="${escapeHtml(configData.shop_id)}" oninput="updateShopId(this.value)">
        </div>
      </div>
      <div class="buyers-section">
        <div class="section-header">
          <span class="section-title">买家账号 · ${configData.users.length}</span>
          <button class="btn btn-quiet btn-sm" type="button" onclick="addUser()">＋ 添加账号</button>
        </div>
        <div class="account-list">${configData.users.length ? configData.users.map((user, index) => `
          <div class="account-row">
            <div class="form-group">
              <label>手机号</label>
              <input type="text" inputmode="tel" value="${escapeHtml(user.username)}" autocomplete="off" oninput="updateUser(${index}, 'username', this.value)">
            </div>
            <div class="form-group">
              <label>登录密码</label>
              <input type="password" value="" autocomplete="new-password" placeholder="${user.passwordConfigured ? '已设置，留空保持不变' : '请输入密码'}" oninput="updateUser(${index}, 'password', this.value)">
            </div>
            <div class="form-group">
              <button class="btn btn-danger btn-sm" type="button" onclick="removeUser(${index})">移除</button>
            </div>
          </div>
        `).join('') : '<p class="empty-note">还没有账号。添加账号后保存配置即可开始使用。</p>'}</div>
      </div>
  `;
  syncApiDebugger(false);
}

function updateShopId(value) {
  configData.shop_id = value;
  document.getElementById('shopIdSummary').textContent = value || '—';
}

function addUser() {
  configData.users.push({ username: '', password: '', passwordConfigured: false });
  renderConfig();
}

function updateUser(index, field, value) {
  configData.users[index][field] = value;
}

function removeUser(index) {
  if (!confirm('确定要删除这个账号吗？')) return;
  configData.users.splice(index, 1);
  renderConfig();
}

async function copyCronCommand() {
  try {
    await navigator.clipboard.writeText(document.getElementById('cronCommand').textContent.trim());
    showMessage('crontab 示例已复制');
  } catch {
    showMessage('复制失败，请手动选择示例命令', 'error');
  }
}

function getApiDefinition(apiKey = activeApiKey) {
  return apiDefinitions.find(api => api.key === apiKey) || apiDefinitions[0];
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function getDefaultApiParams(api) {
  return api.defaultParams ? api.defaultParams() : {};
}

function getApiParamsInput() {
  return document.getElementById('apiParamsInput');
}

function getApiResultElement() {
  return document.getElementById('apiResult');
}

function getApiRequestUrlElement() {
  return document.getElementById('apiRequestUrl');
}

function openApiModal() {
  document.getElementById('apiModal').classList.add('show');
  document.body.classList.add('modal-open');
  syncApiDebugger(true);
}

function closeApiModal() {
  document.getElementById('apiModal').classList.remove('show');
  document.body.classList.remove('modal-open');
}

function handleModalOverlayClick(event) {
  if (event.target.id === 'apiModal') {
    closeApiModal();
  }
}

function handleApiSelectionChange(apiKey) {
  activeApiKey = apiKey;
  syncApiDebugger(true);
}

function fillApiDefaultParams() {
  const api = getApiDefinition();
  getApiParamsInput().value = formatJson(getDefaultApiParams(api));
  updateApiRequestPreview();
}

function renderApiOptions() {
  const select = document.getElementById('apiSelect');
  const apiList = document.getElementById('apiList');

  select.innerHTML = apiDefinitions
    .map(api => `<option value="${api.key}" ${api.key === activeApiKey ? 'selected' : ''}>${api.method} ${api.name}</option>`)
    .join('');

  apiList.innerHTML = apiDefinitions
    .map(
      api => `
        <button class="api-list-item ${api.key === activeApiKey ? 'active' : ''}" onclick="handleApiSelectionChange('${api.key}')">
          <span class="api-list-method api-list-method-${api.method.toLowerCase()}">${api.method}</span>
          <span class="api-list-name">${api.name}</span>
        </button>
      `
    )
    .join('');
}

function syncApiDebugger(resetParams = false) {
  const api = getApiDefinition();
  const modal = document.getElementById('apiModal');
  const paramsInput = getApiParamsInput();

  if (!modal || !paramsInput) {
    return;
  }

  renderApiOptions();
  document.getElementById('apiMethod').textContent = api.method;
  document.getElementById('apiMethod').className = `api-method api-method-${api.method.toLowerCase()}`;
  document.getElementById('apiPath').textContent = api.path;
  document.getElementById('apiDescription').textContent = api.description;
  document.getElementById('apiParamsLabel').textContent = api.method === 'GET' ? '查询参数 (JSON)' : '请求 Body (JSON)';

  if (resetParams || !paramsInput.value.trim()) {
    paramsInput.value = formatJson(getDefaultApiParams(api));
  }

  updateApiRequestPreview();
}

function parseApiParams() {
  const raw = getApiParamsInput().value.trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function appendQueryParam(url, key, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => appendQueryParam(url, key, item));
    return;
  }
  if (typeof value === 'object') {
    url.searchParams.set(key, JSON.stringify(value));
    return;
  }
  url.searchParams.set(key, String(value));
}

function buildApiRequestPreview() {
  const api = getApiDefinition();
  const params = parseApiParams();
  const url = new URL(api.path, window.location.origin);

  if (api.method === 'GET') {
    Object.entries(params || {}).forEach(([key, value]) => appendQueryParam(url, key, value));
    url.searchParams.set('_t', String(Date.now()));
  }

  return {
    api,
    params,
    url
  };
}

function updateApiRequestPreview() {
  try {
    const { api, url } = buildApiRequestPreview();
    const preview = api.method === 'POST' ? `${url.toString()} [body]` : url.toString();
    getApiRequestUrlElement().value = preview;
  } catch (error) {
    getApiRequestUrlElement().value = '参数 JSON 无法解析';
  }
}

async function invokeSelectedApi() {
  const resultEl = getApiResultElement();

  try {
    const { api, params, url } = buildApiRequestPreview();
    resultEl.textContent = '请求中...';

    const options = {
      method: api.method,
      headers: {}
    };

    if (api.method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), options);
    const contentType = response.headers.get('content-type') || '';
    const responseData = contentType.includes('application/json') ? await response.json() : await response.text();

    resultEl.textContent = formatJson({
      request: {
        method: api.method,
        url: url.toString(),
        ...(api.method === 'POST' ? { body: api.key === 'updateConfig'
          ? { ...params, users: params.users?.map(user => ({ ...user, password: user.password ? '[已隐藏]' : '' })) }
          : params } : {})
      },
      response: {
        status: response.status,
        ok: response.ok,
        data: responseData
      }
    });

    if (response.ok) {
      showMessage(`${api.name} 调用成功`);
      if (api.key === 'updateConfig' || api.key === 'queryConfig') {
        await loadConfig();
      }
    } else {
      showMessage(`${api.name} 调用失败`, 'error');
    }
  } catch (error) {
    resultEl.textContent = formatJson({
      error: error.message
    });
    showMessage(`接口调用失败: ${error.message}`, 'error');
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeApiModal();
  }
});

document.addEventListener('input', event => {
  if (event.target && event.target.id === 'apiParamsInput') {
    updateApiRequestPreview();
  }
});

document.addEventListener('click', event => {
  const refreshButton = event.target.closest('[data-refresh-user]');
  if (refreshButton) {
    refreshCookies(refreshButton.dataset.refreshUser, refreshButton);
    return;
  }
  const viewButton = event.target.closest('[data-view-user]');
  if (viewButton) loadCachedUsers(viewButton.dataset.viewUser);
});

loadConfig();
loadCachedUsers();
