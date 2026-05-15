// Transactions list page
const TransactionsPage = {
  currentType: 'all',
  currentPage: 1,
  searchTerm: '',
  selectedCategory: '',
  startDate: '',
  endDate: '',

  async render(container, type) {
    this.currentType = type || 'all';
    this.currentPage = 1;
    this.searchTerm = '';
    this.selectedCategory = '';
    this.startDate = '';
    this.endDate = '';

    // Default to current month
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    this.startDate = monthStart;
    this.endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    container.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" placeholder="搜索备注/分类...">
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding:0 16px;">
        <input type="date" id="tx-start" value="${this.startDate}" style="flex:1;min-width:100px;padding:6px 8px;border:1px solid var(--border-color);border-radius:6px;font-size:12px;">
        <span style="color:var(--text-muted);line-height:32px;font-size:12px;">至</span>
        <input type="date" id="tx-end" value="${this.endDate}" style="flex:1;min-width:100px;padding:6px 8px;border:1px solid var(--border-color);border-radius:6px;font-size:12px;">
        <button class="btn btn-primary btn-sm" id="tx-filter-btn" style="padding:6px 12px;font-size:12px;">筛选</button>
        <button class="btn btn-default btn-sm" id="tx-clear-btn" style="padding:6px 12px;font-size:12px;">清除</button>
      </div>

      <div class="tabs" id="typeTabs">
        <button class="tab ${this.currentType === 'all' ? 'active' : ''}" data-type="all">全部</button>
        <button class="tab ${this.currentType === 'income' ? 'active' : ''}" data-type="income">收入</button>
        <button class="tab ${this.currentType === 'expense' ? 'active' : ''}" data-type="expense">支出</button>
      </div>

      <div id="transactionsList" class="tx-list">
        <div class="loading-spinner"><div class="spinner"></div><p>加载中...</p></div>
      </div>

      <div id="loadMore" style="display:none;text-align:center;padding:16px;">
        <button class="btn btn-default btn-sm" id="loadMoreBtn">加载更多</button>
      </div>

      <!-- Edit Transaction Modal -->
      <div id="editTxModal" class="modal-overlay" style="display:none;">
        <div class="modal-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;font-size:16px;">✏️ 编辑记录</h3>
            <button onclick="TransactionsPage.closeEditModal()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
          </div>
          <form id="editTxForm">
            <div class="form-group">
              <label class="form-label">类型</label>
              <select class="form-select" id="editTxType" required>
                <option value="income">💰 收入</option>
                <option value="expense">💸 支出</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">金额 (元)</label>
              <input type="number" class="form-input" id="editTxAmount" step="0.01" min="0.01" required>
            </div>
            <div class="form-group">
              <label class="form-label">分类</label>
              <select class="form-select" id="editTxCategory" required></select>
            </div>
            <div class="form-group">
              <label class="form-label">备注说明</label>
              <textarea class="form-textarea" id="editTxDesc" rows="2" placeholder="选填"></textarea>
            </div>
            <div class="form-group" style="display:flex;gap:8px;margin-top:16px;">
              <button type="submit" class="btn btn-primary" style="flex:1;">💾 保存修改</button>
              <button type="button" class="btn btn-default" onclick="TransactionsPage.closeEditModal()" style="flex:1;">取消</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Bind events
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.searchTerm = e.target.value.trim();
        this.currentPage = 1;
        this.loadTransactions();
      }, 400);
    });

    document.getElementById('typeTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      this.currentType = tab.dataset.type;
      this.currentPage = 1;
      document.querySelectorAll('#typeTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      this.loadTransactions();
    });

    document.getElementById('tx-filter-btn').addEventListener('click', () => {
      this.startDate = document.getElementById('tx-start').value;
      this.endDate = document.getElementById('tx-end').value;
      this.currentPage = 1;
      this.loadTransactions();
    });

    document.getElementById('tx-clear-btn').addEventListener('click', () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      document.getElementById('tx-start').value = monthStart;
      document.getElementById('tx-end').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      this.startDate = monthStart;
      this.endDate = document.getElementById('tx-end').value;
      this.currentType = 'all';
      this.searchTerm = '';
      document.getElementById('searchInput').value = '';
      document.querySelectorAll('#typeTabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelector('#typeTabs .tab[data-type="all"]').classList.add('active');
      this.currentPage = 1;
      this.loadTransactions();
    });

    document.getElementById('loadMoreBtn').addEventListener('click', () => {
      this.currentPage++;
      this.loadTransactions(true);
    });

    document.getElementById('editTxForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveEdit();
    });

    this.loadTransactions();
  },

  _isAdmin() {
    const user = window.__currentUser;
    if (!user) return false;
    const roles = (user.role || '').split(',').map(r => r.trim());
    return roles.includes('admin');
  },

  getCategories(type) {
    if (type === 'income') return ['堂食', '外卖', '团购', '饮品', '其他'];
    if (type === 'expense') return ['食材', '房租', '水电', '人工', '物料', '设备', '其他'];
    return ['堂食', '外卖', '团购', '饮品', '其他', '食材', '房租', '水电', '人工', '物料', '设备', '其他'];
  },

  async loadTransactions(append = false) {
    const listEl = document.getElementById('transactionsList');
    if (!append) Utils.showLoading(listEl);

    try {
      const params = { page: this.currentPage, limit: 20 };
      if (this.currentType !== 'all') params.type = this.currentType;
      if (this.searchTerm) params.search = this.searchTerm;
      if (this.startDate) params.startDate = this.startDate;
      if (this.endDate) params.endDate = this.endDate;

      const data = await API.getTransactions(params);

      if (!append) listEl.innerHTML = '';

      if (data.list.length === 0 && !append) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p class="empty-text">暂无记录</p></div>';
        document.getElementById('loadMore').style.display = 'none';
        return;
      }

      const isAdmin = this._isAdmin();

      for (const tx of data.list) {
        const actions = isAdmin ? `
          <div style="display:flex;gap:4px;margin-top:4px;" onclick="event.stopPropagation()">
            <button class="btn btn-default btn-sm" style="padding:3px 8px;font-size:11px;" onclick="TransactionsPage.openEditModal(${tx.id})">✏️</button>
            <button class="btn btn-danger btn-sm" style="padding:3px 8px;font-size:11px;" onclick="TransactionsPage.deleteTx(${tx.id}, '${tx.category}')">🗑️</button>
          </div>
        ` : '';

        const item = Utils.el('div', { className: 'tx-item', onclick: () => App.navigate('/transactions/detail/' + tx.id) }, [
          Utils.el('div', { className: `tx-icon ${tx.type}` }, [Utils.getCategoryIcon(tx.category)]),
          Utils.el('div', { className: 'tx-info' }, [
            Utils.el('div', { className: 'tx-category' }, [tx.category + (tx.source === 'purchase_request' ? ' (采购)' : '')]),
            Utils.el('div', { className: 'tx-desc' }, [tx.description || tx.creator_name || ''])
          ]),
          Utils.el('div', { className: 'tx-right' }, [
            Utils.el('div', { className: `tx-amount ${tx.type}` }, [(tx.type === 'income' ? '+' : '-') + Utils.formatMoney(tx.amount)]),
            Utils.el('div', { className: 'tx-date' }, [Utils.formatDate(tx.created_at)]),
            ...(tx.receipt_path ? [Utils.el('div', { className: 'tx-attachment' }, ['📎'])] : []),
            Utils.el('div', {}, [actions])
          ])
        ]);
        listEl.appendChild(item);
      }

      document.getElementById('loadMore').style.display = data.list.length === 20 ? 'block' : 'none';

    } catch (err) {
      if (!append) listEl.innerHTML = `<div class="empty-state"><p class="empty-text">加载失败: ${err.message}</p></div>`;
    }
  },

  async openEditModal(id) {
    const modal = document.getElementById('editTxModal');
    modal.style.display = 'flex';

    const tx = await API.request('GET', `/transactions/${id}`).catch(() => null);
    if (!tx) { Utils.showToast('获取记录失败'); return; }

    this._editingId = id;

    document.getElementById('editTxType').value = tx.type;
    document.getElementById('editTxAmount').value = tx.amount;
    document.getElementById('editTxDesc').value = tx.description || '';

    const type = tx.type;
    const cats = this.getCategories(type);
    document.getElementById('editTxCategory').innerHTML = cats.map(c =>
      `<option value="${c}" ${c === tx.category ? 'selected' : ''}>${c}</option>`
    ).join('');

    document.getElementById('editTxType').onchange = () => {
      const t = document.getElementById('editTxType').value;
      const cats2 = this.getCategories(t);
      document.getElementById('editTxCategory').innerHTML = cats2.map(c => `<option value="${c}">${c}</option>`).join('');
    };
  },

  closeEditModal() {
    document.getElementById('editTxModal').style.display = 'none';
    this._editingId = null;
  },

  async saveEdit() {
    const id = this._editingId;
    if (!id) return;

    const type = document.getElementById('editTxType').value;
    const amount = document.getElementById('editTxAmount').value;
    const category = document.getElementById('editTxCategory').value;
    const description = document.getElementById('editTxDesc').value.trim();

    try {
      await API.request('PUT', `/transactions/${id}`, { type, amount, category, description });
      Utils.showToast('✅ 修改成功');
      this.closeEditModal();
      this.loadTransactions();
    } catch (err) {
      Utils.showToast(err.message);
    }
  },

  async deleteTx(id, category) {
    const confirmed = await Utils.confirm(`确认删除这条「${category}」记录？此操作不可恢复。`);
    if (!confirmed) return;

    try {
      await API.request('DELETE', `/transactions/${id}`);
      Utils.showToast('✅ 已删除');
      this.loadTransactions();
    } catch (err) {
      Utils.showToast(err.message);
    }
  }
};
