let configData = [];
let selectedBuyers = {};

function showMessage(msg, type = 'success') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = msg;
  messageEl.className = `message ${type} show`;
  setTimeout(() => {
    messageEl.className = 'message';
  }, 3000);
}

async function loadConfig() {
  try {
    const response = await fetch('/weidian/api/order/query/config');
    const result = await response.json();
    if (result.code === 200) {
      configData = result.data;
      selectedBuyers = {};
      renderConfig();
      showMessage('配置加载成功');
    } else {
      showMessage('加载配置失败: ' + result.msg, 'error');
    }
  } catch (error) {
    showMessage('加载配置失败: ' + error.message, 'error');
  }
}

async function saveConfig() {
  try {
    const response = await fetch('/weidian/api/order/update/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(configData)
    });
    const result = await response.json();
    if (result.code === 200) {
      showMessage('配置保存成功');
      loadConfig();
    } else {
      showMessage('保存配置失败: ' + result.msg, 'error');
    }
  } catch (error) {
    showMessage('保存配置失败: ' + error.message, 'error');
  }
}

function renderConfig() {
  const container = document.getElementById('tasksContainer');
  if (configData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无配置任务</p>
        <button class="btn btn-primary" onclick="addTask()">添加任务</button>
      </div>
    `;
    return;
  }

  container.innerHTML = configData.map((task, taskIndex) => renderTask(task, taskIndex)).join('');
}

function renderTask(task, taskIndex) {
  return `
    <div class="task-card">
      <div class="task-header">
        <span class="task-title">任务 ${taskIndex + 1}</span>
        <button class="btn btn-danger btn-sm" onclick="removeTask(${taskIndex})">删除任务</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>目标时间</label>
          <input type="text" value="${task.targetTime || ''}" onchange="updateTask(${taskIndex}, 'targetTime', this.value)">
        </div>
        <div class="form-group">
          <label>提前时间 (ms)</label>
          <input type="number" value="${task.advanceTimestamps || 0}" onchange="updateTask(${taskIndex}, 'advanceTimestamps', parseInt(this.value))">
        </div>
        <div class="form-group">
          <label>提前请求间隔 (ms)</label>
          <input type="number" value="${task.advancePostInterval || 0}" onchange="updateTask(${taskIndex}, 'advancePostInterval', parseInt(this.value))">
        </div>
        <div class="form-group">
          <label>请求持续时间 (ms)</label>
          <input type="number" value="${task.postDuration || 0}" onchange="updateTask(${taskIndex}, 'postDuration', parseInt(this.value))">
        </div>
        <div class="form-group">
          <label>请求间隔 (ms)</label>
          <input type="number" value="${task.postInterval || 0}" onchange="updateTask(${taskIndex}, 'postInterval', parseInt(this.value))">
        </div>
      </div>
      <div class="buyers-section">
        <div class="section-header">
          <span class="section-title">买家账号 (${task.buyers?.length || 0})</span>
          <button class="btn btn-primary btn-sm" onclick="addBuyer(${taskIndex})">添加买家</button>
        </div>
        <div class="buyers-container">
          ${renderBuyersList(task, taskIndex)}
          ${renderBuyerEditor(task, taskIndex)}
        </div>
      </div>
    </div>
  `;
}

function renderBuyersList(task, taskIndex) {
  const buyers = task.buyers || [];
  const selectedIdx = selectedBuyers[taskIndex];

  return `
    <div class="buyers-list">
      <div class="buyers-list-header">
        <span>买家列表</span>
        <span>${buyers.length}</span>
      </div>
      <div class="buyers-list-items">
        ${buyers.length === 0 ? `
          <div class="empty-list">
            <p>暂无买家</p>
          </div>
        ` : buyers.map((buyer, buyerIndex) => `
          <div class="buyer-item ${buyerIndex === selectedIdx ? 'selected' : ''} ${buyer.disabled ? 'disabled' : ''}" onclick="selectBuyer(${taskIndex}, ${buyerIndex})">
            <div>
              <span class="buyer-item-name">${buyer.buyer_name || '未命名买家'}</span>
              <span class="buyer-item-status ${buyer.disabled ? 'disabled' : 'enabled'}">${buyer.disabled ? '已禁用' : '已启用'}</span>
            </div>
            <div class="buyer-item-actions" onclick="event.stopPropagation()">
              <button class="buyer-item-btn" onclick="toggleBuyer(${taskIndex}, ${buyerIndex})">${buyer.disabled ? '启用' : '禁用'}</button>
              <button class="buyer-item-btn" onclick="removeBuyer(${taskIndex}, ${buyerIndex})">删除</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBuyerEditor(task, taskIndex) {
  const buyers = task.buyers || [];
  const selectedIdx = selectedBuyers[taskIndex];

  if (selectedIdx === undefined || selectedIdx === null || !buyers[selectedIdx]) {
    return `
      <div class="buyer-editor">
        <div class="empty-editor">
          <div class="empty-editor-icon">👤</div>
          <p>请从左侧选择一个买家进行编辑</p>
        </div>
      </div>
    `;
  }

  const buyer = buyers[selectedIdx];
  return `
    <div class="buyer-editor">
      <div class="buyer-editor-header">
        <span class="buyer-editor-title">编辑买家</span>
        <span class="buyer-editor-status ${buyer.disabled ? 'disabled' : 'enabled'}" onclick="toggleBuyer(${taskIndex}, ${selectedIdx})">
          ${buyer.disabled ? '已禁用 - 点击启用' : '已启用 - 点击禁用'}
        </span>
      </div>
      <div class="buyer-editor-form">
        <div class="form-group">
          <label>买家名称</label>
          <input type="text" value="${buyer.buyer_name || ''}" onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'buyer_name', this.value)">
        </div>
        <div class="form-group">
          <label>买家ID</label>
          <input type="text" value="${buyer.buyer_id || ''}" onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'buyer_id', this.value)">
        </div>
        <div class="form-group">
          <label>地址ID</label>
          <input type="text" value="${buyer.address_id || ''}" onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'address_id', this.value)">
        </div>
        <div class="form-group">
          <label>Source ID</label>
          <input type="text" value="${buyer.source_id || ''}" onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'source_id', this.value)">
        </div>
        <div class="form-group">
          <label>店铺名称</label>
          <input type="text" value="${buyer.shop_name || ''}" onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'shop_name', this.value)">
        </div>
        <div class="form-group">
          <label>店铺ID</label>
          <input type="text" value="${buyer.shopid || ''}" onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'shopid', this.value)">
        </div>
        <div class="form-group">
          <label>Wdtoken</label>
          <input type="text" value="${buyer.wdtoken || ''}" onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'wdtoken', this.value)">
        </div>
        <div class="form-group">
          <label>UDC</label>
          <input type="text" value="${buyer.udc || ''}" onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'udc', this.value)">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Cookie</label>
          <textarea onchange="updateBuyer(${taskIndex}, ${selectedIdx}, 'cookie', this.value)" rows="7">${buyer.cookie || ''}</textarea>
        </div>
      </div>
    </div>
  `;
}

function addTask() {
  configData.push({
    targetTime: '',
    advanceTimestamps: 1000,
    advancePostInterval: 200,
    postDuration: 1000,
    postInterval: 50,
    buyers: []
  });
  renderConfig();
}

function removeTask(taskIndex) {
  if (confirm('确定要删除这个任务吗？')) {
    configData.splice(taskIndex, 1);
    delete selectedBuyers[taskIndex];
    renderConfig();
  }
}

function updateTask(taskIndex, field, value) {
  configData[taskIndex][field] = value;
}

function addBuyer(taskIndex) {
  const existingBuyers = configData[taskIndex].buyers || [];
  const defaultBuyer = existingBuyers.find(b => !b.disabled) || existingBuyers[0] || {};

  const newBuyer = {
    disabled: false,
    buyer_name: '',
    buyer_id: '',
    address_id: '',
    source_id: defaultBuyer.source_id || '',
    shop_name: defaultBuyer.shop_name || '',
    shopid: defaultBuyer.shopid || '',
    wdtoken: '',
    cookie: '',
    udc: ''
  };

  configData[taskIndex].buyers.push(newBuyer);
  selectedBuyers[taskIndex] = configData[taskIndex].buyers.length - 1;
  renderConfig();
}

function removeBuyer(taskIndex, buyerIndex) {
  if (confirm('确定要删除这个买家吗？')) {
    configData[taskIndex].buyers.splice(buyerIndex, 1);
    if (selectedBuyers[taskIndex] === buyerIndex) {
      delete selectedBuyers[taskIndex];
    } else if (selectedBuyers[taskIndex] > buyerIndex) {
      selectedBuyers[taskIndex]--;
    }
    renderConfig();
  }
}

function selectBuyer(taskIndex, buyerIndex) {
  selectedBuyers[taskIndex] = buyerIndex;
  renderConfig();
}

function toggleBuyer(taskIndex, buyerIndex) {
  configData[taskIndex].buyers[buyerIndex].disabled = !configData[taskIndex].buyers[buyerIndex].disabled;
  renderConfig();
}

function updateBuyer(taskIndex, buyerIndex, field, value) {
  configData[taskIndex].buyers[buyerIndex][field] = value;
}

// Load config on page load
loadConfig();
