// Reports page - 股东友好的财务查账中心
const ReportsPage = {
  currentType: '',
  txPage: 1,
  txSearchTerm: '',
  txCategoryFilter: '',
  _allTxData: [],

  async render(container) {
    Utils.showLoading(container);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      this.startDate = `${year}-01-01`;
      this.endDate = `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`;
      this.txPage = 1;
      this.txSearchTerm = '';
      this.txCategoryFilter = '';
      this.renderContent(container);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">😔</div><p class="empty-text">加载失败: ${err.message}</p></div>`;
    }
  },

  renderContent(container) {
    container.innerHTML = `
      <!-- 筛选栏 -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">📊 财务查账</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
          <input type="date" id="r-start" value="${this.startDate}" style="flex:1;min-width:120px;padding:8px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;">
          <span style="color:var(--text-muted);line-height:36px;">至</span>
          <input type="date" id="r-end" value="${this.endDate}" style="flex:1;min-width:120px;padding:8px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;">
          <select id="r-type" style="padding:8px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;min-width:90px;">
            <option value="">全部类型</option>
            <option value="income">收入</option>
            <option value="expense">支出</option>
          </select>
          <button class="btn btn-primary" onclick="ReportsPage.refreshAll()" style="padding:8px 16px;">🔍 查询</button>
        </div>

        <!-- 汇总卡片 -->
        <div id="summary-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
          <div style="text-align:center;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
            <div style="font-size:12px;color:#166534;margin-bottom:4px;">💰 总收入</div>
            <div id="total-income" style="font-size:20px;font-weight:bold;color:#16a34a;">-</div>
          </div>
          <div style="text-align:center;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
            <div style="font-size:12px;color:#991b1b;margin-bottom:4px;">💸 总支出</div>
            <div id="total-expense" style="font-size:20px;font-weight:bold;color:#dc2626;">-</div>
          </div>
          <div style="text-align:center;padding:16px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:10px;">
            <div style="font-size:12px;opacity:0.9;margin-bottom:4px;">💡 净利润</div>
            <div id="total-profit" style="font-size:20px;font-weight:bold;color:#fff;">-</div>
          </div>
          <div style="text-align:center;padding:16px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:10px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">📋 总笔数</div>
            <div id="total-count" style="font-size:20px;font-weight:bold;">-</div>
          </div>
        </div>

        <!-- 月度趋势 -->
        <div style="margin-bottom:8px;font-size:13px;color:var(--text-muted);font-weight:600;">📈 月度趋势（近6个月）</div>
        <div id="monthly-chart" style="margin-bottom:4px;"></div>
      </div>

      <!-- 收支明细列表 -->
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div class="card-title" style="margin:0;">📝 收支明细</div>
          <span id="tx-count-badge" style="background:var(--primary);color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;display:none;"></span>
        </div>

        <!-- 明细筛选 -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="text" id="tx-search" placeholder="🔍 搜索备注/分类..." value="${this.txSearchTerm}"
            style="flex:2;min-width:120px;padding:7px 10px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;">
          <select id="tx-cat-filter" style="flex:1;min-width:80px;padding:7px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;">
            <option value="">全部分类</option>
          </select>
          <div class="tabs" id="tx-tabs" style="flex:1;min-width:180px;">
            <button class="tab active" data-txtype="all">全部</button>
            <button class="tab" data-txtype="income">收入</button>
            <button class="tab" data-txtype="expense">支出</button>
          </div>
        </div>

        <div id="transactionsList" style="min-height:100px;"></div>

        <div id="loadMoreTx" style="display:none;text-align:center;padding:12px;">
          <button class="btn btn-default btn-sm" id="loadMoreTxBtn">加载更多 ▼</button>
        </div>
      </div>

      <!-- 分类统计 -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">📂 分类统计</div>
        <div id="category-list" style="margin-bottom:8px;"></div>
      </div>

      <!-- 采购申请汇总 -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">🧾 采购申请</div>
        <div id="requests-summary"></div>
      </div>

      <!-- 存储监控 -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">💾 存储用量</div>
        <div id="storage-widget" style="text-align:center;padding:8px 0;"><span style="color:#aaa">加载中...</span></div>
      </div>

      <!-- 导出按钮区 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px;margin-bottom:20px;">
        <button class="btn btn-primary" onclick="ReportsPage.exportReport()" style="padding:10px 18px;">📄 导出完整报表(含票据)</button>
        <button class="btn btn-default" onclick="ReportsPage.exportCSV('transactions')" style="padding:10px 18px;">📥 导出收支CSV</button>
        <button class="btn btn-default" onclick="ReportsPage.exportCSV('requests')" style="padding:10px 18px;">📥 导出采购申请</button>
        <button class="btn btn-default" onclick="ReportsPage.exportCSV('category')" style="padding:10px 18px;">📥 导出分类统计</button>
      </div>
    `;

    // 绑定事件
    document.getElementById('r-start').addEventListener('change', e => { this.startDate = e.target.value; });
    document.getElementById('r-end').addEventListener('change', e => { this.endDate = e.target.value; });
    document.getElementById('r-type').addEventListener('change', e => { this.currentType = e.target.value; });

    // 明细搜索
    const searchEl = document.getElementById('tx-search');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this.txSearchTerm = e.target.value.trim();
          this.txPage = 1;
          this.loadTransactions();
        }, 400);
      });
    }

    // 分类筛选
    const catEl = document.getElementById('tx-cat-filter');
    if (catEl) catEl.addEventListener('change', (e) => {
      this.txCategoryFilter = e.target.value;
      this.txPage = 1;
      this.loadTransactions();
    });

    // 类型Tab切换
    const tabsEl = document.getElementById('tx-tabs');
    if (tabsEl) tabsEl.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      this._txTypeFilter = tab.dataset.txtype;
      this.txPage = 1;
      this.loadTransactions();
    });

    // 加载更多
    const loadMoreBtn = document.getElementById('loadMoreTxBtn');
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => {
      this.txPage++;
      this.loadTransactions(true);
    });

    this.refreshAll();
  },

  async refreshAll() {
    this.startDate = document.getElementById('r-start')?.value || this.startDate;
    this.endDate = document.getElementById('r-end')?.value || this.endDate;
    this.currentType = document.getElementById('r-type')?.value || '';
    this.txPage = 1;

    await Promise.all([
      this.loadSummary(),
      this.loadTransactions(),
      this.loadRequestsSummary(),
      this.loadStorage()
    ]);
  },

  async loadSummary() {
    try {
      const params = new URLSearchParams({ startDate: this.startDate, endDate: this.endDate });
      if (this.currentType) params.set('type', this.currentType);

      const [summaryData, categoryData] = await Promise.all([
        API.request('GET', `/reports/summary?${params.toString()}`).catch(() => ({ summary: {}, monthly: [] })),
        API.request('GET', `/reports/by-category?${params.toString()}`).catch(() => ({ categories: [] }))
      ]);

      const s = summaryData.summary || {};
      const incomeEl = document.getElementById('total-income');
      const expenseEl = document.getElementById('total-expense');
      const profitEl = document.getElementById('total-profit');
      const countEl = document.getElementById('total-count');

      if (incomeEl) incomeEl.textContent = Utils.formatMoney(s.totalIncome || 0);
      if (expenseEl) expenseEl.textContent = Utils.formatMoney(s.totalExpense || 0);
      if (profitEl) {
        const profit = (s.totalIncome || 0) - (s.totalExpense || 0);
        profitEl.textContent = Utils.formatMoney(profit);
        profitEl.style.color = profit >= 0 ? '#4ade80' : '#f87171';
      }
      if (countEl) countEl.textContent = (s.totalCount || 0) + ' 笔';

      this.renderMonthlyChart(summaryData.monthly || []);
      this.renderCategoryList(categoryData.categories || []);

      // 填充分类筛选下拉框
      this.populateCategoryFilter(categoryData.categories || []);
    } catch (err) {
      console.error('Load summary error:', err);
    }
  },

  populateCategoryFilter(categories) {
    const sel = document.getElementById('tx-cat-filter');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">全部分类</option>';
    const cats = [...new Set(categories.map(c => c.category))];
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c + ' ' + Utils.getCategoryIcon(c);
      sel.appendChild(opt);
    });
    sel.value = currentVal;
  },

  renderMonthlyChart(monthly) {
    const el = document.getElementById('monthly-chart');
    if (!el || !monthly.length) {
      if (el) el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px;">暂无数据</div>';
      return;
    }

    const last6 = monthly.slice(0, 6).reverse();
    const maxVal = Math.max(...last6.map(m => Math.max(Number(m.income), Number(m.expense))), 1);

    const bars = last6.map(m => {
      const incomePct = (Number(m.income) / maxVal * 100).toFixed(1);
      const expensePct = (Number(m.expense) / maxVal * 100).toFixed(1);
      return `
        <div style="flex:1;text-align:center;min-width:60px;">
          <div style="display:flex;align-items:flex-end;justify-content:center;height:80px;gap:4px;">
            <div style="width:18px;background:#22c55e;border-radius:3px 3px 0 0;height:${incomePct}%;" title="收入:${m.income}"></div>
            <div style="width:18px;background:#ef4444;border-radius:3px 3px 0 0;height:${expensePct}%;" title="支出:${m.expense}"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${m.month}</div>
          <div style="font-size:10px;color:#22c55e;">${Utils.formatMoney(m.income)}</div>
          <div style="font-size:10px;color:#ef4444;">${Utils.formatMoney(m.expense)}</div>
        </div>
      `;
    }).join('');

    el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:8px;overflow-x:auto;padding-bottom:4px;">${bars}</div>
    <div style="display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:11px;">
      <span style="color:#22c55e;">■ 收入</span>
      <span style="color:#ef4444;">■ 支出</span>
    </div>`;
  },

  renderCategoryList(categories) {
    const el = document.getElementById('category-list');
    if (!el) return;

    if (!categories.length) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px;">暂无分类数据</div>';
      return;
    }

    const maxVal = Math.max(...categories.map(c => Number(c.total)), 1);

    el.innerHTML = categories.map(c => {
      const pct = (Number(c.total) / maxVal * 100).toFixed(1);
      const color = c.type === 'income' ? '#22c55e' : '#ef4444';
      const typeLabel = c.type === 'income' ? '收' : '支';
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
            <span>${Utils.getCategoryIcon(c.category)} ${c.category} 
              <span style="color:var(--text-muted);font-size:11px;">(${c.count}笔 · ${typeLabel})</span></span>
            <span style="font-weight:600;color:${color};">${Utils.formatMoney(c.total)}</span>
          </div>
          <div style="background:var(--border-color);border-radius:4px;height:8px;">
            <div style="background:${color};height:100%;border-radius:4px;width:${pct}%;transition:width 0.3s;"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  // ========== 收支明细列表（核心新增功能）==========

  async loadTransactions(append = false) {
    const listEl = document.getElementById('transactionsList');
    if (!append) Utils.showLoading(listEl);

    try {
      const params = { page: this.txPage, limit: 30 };

      // 合并全局日期筛选和明细独立筛选
      params.startDate = this.startDate;
      params.endDate = this.endDate;

      // 明细独立的类型筛选（优先于全局）
      const activeType = this._txTypeFilter !== undefined ? this._txTypeFilter : (this.currentType || '');
      if (activeType && activeType !== 'all') params.type = activeType;

      if (this.txSearchTerm) params.search = this.txSearchTerm;
      if (this.txCategoryFilter) params.category = this.txCategoryFilter;

      const data = await API.getTransactions(params);

      if (!append) listEl.innerHTML = '';

      if (data.list.length === 0 && !append) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p class="empty-text">该条件下暂无收支记录</p></div>';
        document.getElementById('loadMoreTx').style.display = 'none';
        document.getElementById('tx-count-badge').style.display = 'none';
        return;
      }

      const isAdmin = this._isAdmin();

      for (const tx of data.list) {
        const item = this.createTxItem(tx, isAdmin);
        listEl.appendChild(item);
      }

      // 更新计数角标
      const badge = document.getElementById('tx-count-badge');
      if (badge && !append) {
        badge.textContent = `共 ${data.total} 条`;
        badge.style.display = '';
      }

      document.getElementById('loadMoreTx').style.display = data.list.length === 30 ? 'block' : 'none';

    } catch (err) {
      if (!append) listEl.innerHTML = `<div class="empty-state"><p class="empty-text">加载失败: ${err.message}</p></div>`;
    }
  },

  createTxItem(tx, isAdmin) {
    const isIncome = tx.type === 'income';
    const color = isIncome ? 'var(--income)' : 'var(--expense)';
    const bgLight = isIncome ? 'var(--income-light)' : 'var(--expense-light)';
    const sign = isIncome ? '+' : '-';

    // 左侧：图标+分类+备注
    const leftCol = Utils.el('div', { style: 'flex:1;min-width:0;' }, [
      Utils.el('div', { style: 'display:flex;align-items:center;gap:6px;margin-bottom:3px;' }, [
        Utils.el('span', { textContent: Utils.getCategoryIcon(tx.category), style: 'font-size:16px;' }),
        Utils.el('span', { className: 'tx-category', style: 'font-weight:600;font-size:14px;' }, [tx.category]),
        ...(tx.source === 'purchase_request' ? [Utils.el('span', { textContent: '采购', style: 'font-size:10px;background:var(--primary-light);color:#fff;padding:1px 5px;border-radius:4px;' })] : [])
      ]),
      Utils.el('div', { className: 'tx-desc', style: 'font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, [tx.description || tx.creator_name || '-'])
    ]);

    // 右侧：金额+时间+附件
    const rightCol = Utils.el('div', { style: 'text-align:right;flex-shrink:0;' }, [
      Utils.el('div', { style: `font-weight:700;font-size:15px;color:${color};` }, [sign + Utils.formatMoney(tx.amount)]),
      Utils.el('div', { className: 'tx-date', style: 'font-size:11px;color:var(--text-muted);' }, [Utils.formatDate(tx.created_at)]),
      ...(tx.receipt_path ? [Utils.el('div', { style: 'cursor:pointer;font-size:14px;', textContent: '📎', onclick: (e) => { e.stopPropagation(); Utils.showImage(tx.receipt_path); } })] : [])
    ]);

    const children = [leftCol, rightCol];

    // 管理员操作按钮
    if (isAdmin) {
      children.push(
        Utils.el('div', {
          style: 'display:flex;gap:4px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border-color);',
          onclick: (e) => e.stopPropagation()
        }, [
          Utils.el('button', {
            className: 'btn btn-default btn-sm',
            style: 'padding:3px 10px;font-size:11px;',
            onclick: () => ReportsPage.openEditModal(tx.id)
          }, ['✏️ 编辑']),
          Utils.el('button', {
            className: 'btn btn-danger btn-sm',
            style: 'padding:3px 10px;font-size:11px;',
            onclick: () => ReportsPage.deleteTx(tx.id, tx.category)
          }, ['🗑️ 删除'])
        ])
      );
    }

    const item = Utils.el('div', {
      className: 'tx-item',
      style: `margin-bottom:8px;padding:12px 14px;background:${bgLight};border-left:3px solid ${color};border-radius:0 8px 8px 0;`,
      onclick: () => App.navigate('/transactions/detail/' + tx.id)
    }, children);

    return item;
  },

  _isAdmin() {
    const user = window.__currentUser;
    if (!user) return false;
    const roles = (user.role || '').split(',').map(r => r.trim());
    return roles.includes('admin');
  },

  // 编辑弹窗（复用 transactions 页面的逻辑）
  async openEditModal(id) {
    const modal = document.getElementById('editTxModal');
    if (!modal) {
      // 如果页面没有编辑弹窗，动态创建一个
      this._createEditModal();
      return this.openEditModal(id);
    }
    modal.style.display = 'flex';

    const tx = await API.request('GET', `/transactions/${id}`).catch(() => null);
    if (!tx) { Utils.showToast('获取记录失败'); return; }

    this._editingId = id;
    document.getElementById('editTxType').value = tx.type;
    document.getElementById('editTxAmount').value = tx.amount;
    document.getElementById('editTxDesc').value = tx.description || '';

    const cats = tx.type === 'income'
      ? ['堂食', '外卖', '团购', '饮品', '其他']
      : ['食材', '房租', '水电', '人工', '物料', '设备', '其他'];
    document.getElementById('editTxCategory').innerHTML = cats.map(c =>
      `<option value="${c}" ${c === tx.category ? 'selected' : ''}>${c}</option>`
    ).join('');
  },

  _createEditModal() {
    const modalHtml = `
    <div id="editTxModal" class="modal-overlay" style="display:none;z-index:999;">
      <div class="modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:16px;">✏️ 编辑记录</h3>
          <button onclick="document.getElementById('editTxModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
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
            <button type="button" class="btn btn-default" onclick="document.getElementById('editTxModal').style.display='none'" style="flex:1;">取消</button>
          </div>
        </form>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('editTxForm').addEventListener('submit', (e) => {
      e.preventDefault();
      ReportsPage.saveEdit();
    });
  },

  closeEditModal() {
    const modal = document.getElementById('editTxModal');
    if (modal) modal.style.display = 'none';
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
      this.txPage = 1;
      this.refreshAll(); // 刷新所有数据
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
      this.txPage = 1;
      this.refreshAll();
    } catch (err) {
      Utils.showToast(err.message);
    }
  },

  // ========== 采购申请汇总 ==========

  async loadRequestsSummary(startDate, endDate) {
    try {
      const sd = startDate || this.startDate;
      const ed = endDate || this.endDate;
      const params = new URLSearchParams({ startDate: sd, endDate: ed });
      const data = await API.request('GET', `/reports/requests?${params.toString()}`).catch(() => ({ summary: {}, requests: [] }));

      const s = data.summary || {};
      const el = document.getElementById('requests-summary');

      if (!el) return;

      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;">
          <div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-muted);">总申请</div>
            <div style="font-size:20px;font-weight:bold;">${s.total || 0}</div>
          </div>
          <div style="text-align:center;padding:10px;background:#fef3c7;border-radius:8px;">
            <div style="font-size:11px;color:#92400e;">⏳ 待审批</div>
            <div style="font-size:20px;font-weight:bold;color:#d97706;">${s.pending || 0}</div>
          </div>
          <div style="text-align:center;padding:10px;background:#dcfce7;border-radius:8px;">
            <div style="font-size:11px;color:#166534;">✅ 已通过</div>
            <div style="font-size:20px;font-weight:bold;color:#16a34a;">${s.approved || 0}</div>
          </div>
          <div style="text-align:center;padding:10px;background:#fee2e2;border-radius:8px;">
            <div style="font-size:11px;color:#991b1b;">❌ 已拒绝</div>
            <div style="font-size:20px;font-weight:bold;color:#dc2626;">${s.rejected || 0}</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-muted);">申请总额</div>
            <div style="font-size:17px;font-weight:bold;">${Utils.formatMoney(s.totalAmount || 0)}</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-muted);">已通过金额</div>
            <div style="font-size:17px;font-weight:bold;color:#16a34a;">${Utils.formatMoney(s.approvedAmount || 0)}</div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Load requests error:', err);
    }
  },

  // ========== 导出功能 ==========

  async loadStorage() {
    const el = document.getElementById('storage-widget');
    if (!el) return;
    try {
      const data = await API.request('GET', '/reports/storage');
      const pct = data.usagePercent || 0;
      const color = pct >= 90 ? '#ff4d4f' : pct >= 80 ? '#faad14' : '#52c41a';
      const warnText = data.warning ? '<div style="color:#ff4d4f;font-size:13px;margin-top:6px;">⚠️ 存储空间不足，请及时清理旧图片或升级套餐</div>' : '';
      el.innerHTML = `
        <div style="font-size:28px;font-weight:bold;color:${color};margin-bottom:4px;">${pct}%</div>
        <div style="color:#888;font-size:13px;">已用 ${data.usedMB} MB / ${data.limitMB} MB</div>
        <div style="background:#f0f0f0;border-radius:4px;height:8px;margin:8px auto;max-width:200px;overflow:hidden;">
          <div style="background:${color};height:100%;width:${Math.min(pct, 100)}%;border-radius:4px;transition:width .3s;"></div>
        </div>
        <div style="color:#aaa;font-size:12px;">${data.imageCount} 张票据图片</div>
        ${warnText}
      `;
    } catch (err) {
      el.innerHTML = '<span style="color:#ccc">存储监控不可用</span>';
    }
  },

  exportCSV(type) {
    const startDate = document.getElementById('r-start')?.value || this.startDate;
    const endDate = document.getElementById('r-end')?.value || this.endDate;
    const typeParam = this.currentType ? `&type=${this.currentType}` : '';
    const baseUrl = `${API.baseUrl}/reports/export?reportType=${type}&startDate=${startDate}&endDate=${endDate}${typeParam}`;
    window.open(baseUrl, '_blank');
  },

  exportReport() {
    const startDate = document.getElementById('r-start')?.value || this.startDate;
    const endDate = document.getElementById('r-end')?.value || this.endDate;
    const typeParam = this.currentType ? `&type=${this.currentType}` : '';
    const url = `${API.baseUrl}/reports/export-report?startDate=${startDate}&endDate=${endDate}${typeParam}`;
    Utils.showToast('⏳ 正在生成报表，请稍候...');
    window.open(url, '_blank');
  }
};
