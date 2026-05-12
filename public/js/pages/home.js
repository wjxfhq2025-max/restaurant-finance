// Home / Dashboard page
const HomePage = {
  async render(container) {
    Utils.showLoading(container);
    
    try {
      const stats = await API.getDashboardStats();
      const categories = await API.getDashboardCategories();
      this.renderContent(container, stats, categories);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">😔</div><p class="empty-text">加载失败: ${err.message}</p></div>`;
    }
  },
  
  renderContent(container, stats, categories) {
    const monthStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
    
    let pendingHtml = '';
    if (stats.pendingCount > 0) {
      pendingHtml = `
        <div class="pending-badge" onclick="App.navigate('/requests')">
          🔔 您有 ${stats.pendingCount} 条待审批申请
        </div>
      `;
    }
    
    // Quick actions
    let quickActions = `
      <div class="quick-actions">
        <button class="quick-action" onclick="App.navigate('/record', 'income')">
          <div class="quick-action-icon">💰</div>
          <div class="quick-action-text">记收入</div>
        </button>
        <button class="quick-action" onclick="App.navigate('/record', 'expense')">
          <div class="quick-action-icon">💸</div>
          <div class="quick-action-text">记支出</div>
        </button>
        <button class="quick-action" onclick="App.navigate('/request-form')">
          <div class="quick-action-icon">📋</div>
          <div class="quick-action-text">采购申请</div>
        </button>
        <button class="quick-action" onclick="App.navigate('/transactions')">
          <div class="quick-action-icon">📊</div>
          <div class="quick-action-text">全部记录</div>
        </button>
      </div>
    `;
    
    // Recent transactions
    let recentHtml = '';
    if (stats.recent && stats.recent.length > 0) {
      recentHtml = stats.recent.map(tx => `
        <div class="tx-item" onclick="App.navigate('/transactions')">
          <div class="tx-icon ${tx.type}">
            ${Utils.getCategoryIcon(tx.category)}
          </div>
          <div class="tx-info">
            <div class="tx-category">${tx.category}${tx.source === 'purchase_request' ? ' (采购)' : ''}</div>
            <div class="tx-desc">${tx.description || tx.creator_name || ''}</div>
          </div>
          <div class="tx-right">
            <div class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${Utils.formatMoney(tx.amount)}</div>
            <div class="tx-date">${Utils.formatDate(tx.created_at)}</div>
          </div>
        </div>
      `).join('');
    } else {
      recentHtml = '<div class="empty-state"><div class="empty-icon">📭</div><p class="empty-text">暂无记录</p></div>';
    }
    
    // Expense categories chart
    let expenseChart = '';
    if (categories.expenseCategories && categories.expenseCategories.length > 0) {
      const maxVal = Math.max(...categories.expenseCategories.map(c => c.total));
      expenseChart = categories.expenseCategories.map(c => `
        <div class="chart-bar-group">
          <div class="chart-label">${c.category}</div>
          <div class="chart-bar-wrap">
            <div class="chart-bar expense" style="width: ${(c.total / maxVal * 100).toFixed(1)}%"></div>
          </div>
          <div class="chart-value">${Utils.formatMoney(c.total)}</div>
        </div>
      `).join('');
    }
    
    container.innerHTML = `
      <div style="margin-bottom:4px;">
        <span style="font-size:var(--font-size-sm);color:var(--text-muted);">${monthStr} 概览</span>
      </div>
      ${pendingHtml}
      
      ${quickActions}
      
      <div class="stats-grid">
        <div class="stat-card income">
          <div class="stat-label">📥 本月收入</div>
          <div class="stat-value income">${Utils.formatMoney(stats.monthly.income)}</div>
        </div>
        <div class="stat-card expense">
          <div class="stat-label">📤 本月支出</div>
          <div class="stat-value expense">${Utils.formatMoney(stats.monthly.expense)}</div>
        </div>
      </div>
      
      <div class="stat-card profit" style="margin-bottom:16px;">
        <div class="stat-label">💡 本月利润</div>
        <div class="stat-value profit" style="font-size:28px;">${Utils.formatMoney(stats.monthly.profit)}</div>
      </div>
      
      ${expenseChart ? `
        <div class="card">
          <div class="card-title">📊 支出分类 (本月)</div>
          <div class="chart-container">${expenseChart}</div>
        </div>
      ` : ''}
      
      <div class="section-title">
        最近记录
        <span class="more" onclick="App.navigate('/transactions')">查看全部 →</span>
      </div>
      <div class="tx-list">${recentHtml}</div>
    `;
  }
};
