let configData = { source_id: '', users: [] };
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
    description: '开启或停止轮询下单。',
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
      users: configData.users.map(user => ({ username: user.username, password: '' }))
    })
  }
];
let activeApiKey = apiDefinitions[0].key;

function showMessage(msg, type = 'success') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = msg;
  messageEl.className = `message ${type} show`;
  setTimeout(() => {
    messageEl.className = 'message';
  }, 3000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

async function loadConfig() {
  try {
    const response = await fetch('/weidian/api/order/query/config');
    const result = await response.json();
    if (result.code !== 200) throw new Error(result.msg || '加载失败');
    configData = {
      source_id: result.data.source_id || '',
      users: (result.data.users || []).map(user => ({
        username: user.username,
        password: '',
        passwordConfigured: user.passwordConfigured
      }))
    };
    renderConfig();
    showMessage('配置加载成功');
  } catch (error) {
    showMessage('加载配置失败: ' + error.message, 'error');
  }
}

async function saveConfig() {
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
  } catch (error) {
    showMessage('保存配置失败: ' + error.message, 'error');
  }
}

function renderConfig() {
  const container = document.getElementById('tasksContainer');
  container.innerHTML = `
    <div class="task-card">
      <div class="task-header"><span class="task-title">微店账号配置</span></div>
      <div class="form-grid">
        <div class="form-group">
          <label>Source ID</label>
          <input type="text" value="${escapeHtml(configData.source_id)}" oninput="configData.source_id = this.value">
        </div>
      </div>
      <div class="buyers-section">
        <div class="section-header">
          <span class="section-title">账号 (${configData.users.length})</span>
          <button class="btn btn-primary btn-sm" onclick="addUser()">添加账号</button>
        </div>
        ${configData.users.length ? configData.users.map((user, index) => `
          <div class="form-grid" style="margin-top: 16px;">
            <div class="form-group">
              <label>手机号</label>
              <input type="text" value="${escapeHtml(user.username)}" autocomplete="off" oninput="updateUser(${index}, 'username', this.value)">
            </div>
            <div class="form-group">
              <label>登录密码</label>
              <input type="password" value="" autocomplete="new-password" placeholder="${user.passwordConfigured ? '已设置，留空保持不变' : '请输入密码'}" oninput="updateUser(${index}, 'password', this.value)">
            </div>
            <div class="form-group">
              <button class="btn btn-danger btn-sm" onclick="removeUser(${index})">删除账号</button>
            </div>
          </div>
        `).join('') : '<p>暂无账号</p>'}
      </div>
    </div>
  `;
  syncApiDebugger(false);
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

// Load config on page load
loadConfig();
