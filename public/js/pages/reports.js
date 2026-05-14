// Reports page with export functionality
const ReportsPage = {
  currentType: '',
  
  async render(container) {
    Utils.showLoading(container);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const defaultStart = `${year}-01-01`;
      const defaultEnd = `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`;
      
      this.startDate = defaultStart;
      this.endDate = defaultEnd;
      this.renderContent(container);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">😔</div><p class="empty-text">加载失败: ${err.message}</p></div>`;
    }
  },
  
  renderContent(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">📊 报表中心</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="date" id="r-start" value="${this.startDate}" style="flex:1;min-width:120px;padding:8px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;">
          <span style="color:var(--text-muted);line-height:36px;">至</span>
          <input type="date" id="r-end" value="${this.endDate}" style="flex:1;min-width:120px;padding:8px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;">
          <select id="r-type" style="padding:8px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;min-width:90px;">
            <option value="">全部类型</option>
            <option value="income">收入</option>
            <option value="expense">支出</option>
          </select>
          <button class="btn btn-primary" onclick="ReportsPage.loadSummary()" style="padding:8px 16px;">查询</button>
        </div>
        
        <div id="summary-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
          <div class="stat-card income" style="text-align:center;padding:16px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">💰 总收入</div>
            <div id="total-income" class="stat-value income" style="font-size:20px;">-</div>
          </div>
          <div class="stat-card expense" style="text-align:center;padding:16px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">💸 总支出</div>
            <div id="total-expense" class="stat-value expense" style="font-size:20px;">-</div>
          </div>
          <div class="stat-card" style="text-align:center;padding:16px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;">
            <div style="font-size:12px;opacity:0.9;margin-bottom:4px;">💡 净利润</div>
            <div id="total-profit" style="font-size:20px;font-weight:bold;color:#fff;">-</div>
          </div>
          <div class="stat-card" style="text-align:center;padding:16px;background:var(--card-bg);border:1px solid var(--border-color);">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">📋 总笔数</div>
            <div id="total-count" style="font-size:20px;font-weight:bold;">-</div>
          </div>
        </div>
        
        <div style="margin-bottom:8px;font-size:13px;color:var(--text-muted);">
          月度趋势（近6个月）
        </div>
        <div id="monthly-chart" style="margin-bottom:16px;"></div>
      </div>
      
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">📂 分类统计</div>
        <div id="category-list" style="margin-bottom:12px;"></div>
        <div id="category-export-bar" style="text-align:right;"></div>
      </div>
      
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">🧾 采购申请报表</div>
        <div id="requests-summary" style="margin-bottom:12px;"></div>
        <div id="requests-export-bar" style="text-align:right;"></div>
      </div>
      
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
        <button class="btn btn-default" onclick="ReportsPage.exportCSV('transactions')" style="padding:10px 20px;">📥 导出收支明细</button>
        <button class="btn btn-default" onclick="ReportsPage.exportCSV('requests')" style="padding:10px 20px;">📥 导出采购申请</button>
        <button class="btn btn-default" onclick="ReportsPage.exportCSV('category')" style="padding:10px 20px;">📥 导出分类统计</button>
      </div>
    `;
    
    // Bind date change
    container.querySelector('#r-start').addEventListener('change', e => this.startDate = e.target.value);
    container.querySelector('#r-end').addEventListener('change', e => this.endDate = e.target.value);
    container.querySelector('#r-type').addEventListener('change', e => this.currentType = e.target.value);
    
    this.loadSummary();
  },
  
  async loadSummary() {
    try {
      const startDate = document.getElementById('r-start')?.value || this.startDate;
      const endDate = document.getElementById('r-end')?.value || this.endDate;
      const type = document.getElementById('r-type')?.value || '';
      
      const params = new URLSearchParams({ startDate, endDate });
      if (type) params.set('type', type);
      
      const [summaryData, categoryData] = await Promise.all([
        API.request('GET', `/reports/summary?${params.toString()}`).catch(() => ({ summary: {}, monthly: [] })),
        API.request('GET', `/reports/by-category?${params.toString()}`).catch(() => ({ categories: [] }))
      ]);
      
      // Summary cards
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
      
      // Monthly chart
      this.renderMonthlyChart(summaryData.monthly || []);
      
      // Category list
      this.renderCategoryList(categoryData.categories || [], startDate, endDate);
      
      // Requests summary
      this.loadRequestsSummary(startDate, endDate);
      
    } catch (err) {
      console.error('Load summary error:', err);
    }
  },
  
  renderMonthlyChart(monthly) {
    const el = document.getElementById('monthly-chart');
    if (!el || !monthly.length) {
      if (el) el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px;">暂无数据</div>';
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
  
  renderCategoryList(categories, startDate, endDate) {
    const el = document.getElementById('category-list');
    const barEl = document.getElementById('category-export-bar');
    if (!el) return;
    
    if (!categories.length) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px;">暂无分类数据</div>';
      barEl.innerHTML = '';
      return;
    }
    
    const maxVal = Math.max(...categories.map(c => Number(c.total)), 1);
    
    el.innerHTML = categories.map(c => {
      const pct = (Number(c.total) / maxVal * 100).toFixed(1);
      const color = c.type === 'income' ? '#22c55e' : '#ef4444';
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
            <span>${c.category} <span style="color:var(--text-muted);font-size:12px;">(${c.count}笔)</span></span>
            <span style="font-weight:600;">${Utils.formatMoney(c.total)}</span>
          </div>
          <div style="background:var(--border-color);border-radius:4px;height:8px;">
            <div style="background:${color};height:100%;border-radius:4px;width:${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
    
    const params = new URLSearchParams({ startDate, endDate, reportType: 'category' });
    barEl.innerHTML = `<button class="btn btn-default btn-sm" onclick="ReportsPage.exportCSV('category')" style="padding:6px 16px;">📥 导出此报表</button>`;
  },
  
  async loadRequestsSummary(startDate, endDate) {
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const data = await API.request('GET', `/reports/requests?${params.toString()}`).catch(() => ({ summary: {}, requests: [] }));
      
      const s = data.summary || {};
      const el = document.getElementById('requests-summary');
      const barEl = document.getElementById('requests-export-bar');
      
      if (!el) return;
      
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">
          <div style="text-align:center;padding:12px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-muted);">总申请</div>
            <div style="font-size:22px;font-weight:bold;">${s.total || 0}</div>
          </div>
          <div style="text-align:center;padding:12px;background:#fef3c7;border-radius:8px;">
            <div style="font-size:11px;color:#92400e;">⏳ 待审批</div>
            <div style="font-size:22px;font-weight:bold;color:#d97706;">${s.pending || 0}</div>
          </div>
          <div style="text-align:center;padding:12px;background:#dcfce7;border-radius:8px;">
            <div style="font-size:11px;color:#166534;">✅ 已通过</div>
            <div style="font-size:22px;font-weight:bold;color:#16a34a;">${s.approved || 0}</div>
          </div>
          <div style="text-align:center;padding:12px;background:#fee2e2;border-radius:8px;">
            <div style="font-size:11px;color:#991b1b;">❌ 已拒绝</div>
            <div style="font-size:22px;font-weight:bold;color:#dc2626;">${s.rejected || 0}</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-muted);">申请总额</div>
            <div style="font-size:18px;font-weight:bold;">${Utils.formatMoney(s.totalAmount || 0)}</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-muted);">已通过金额</div>
            <div style="font-size:18px;font-weight:bold;color:#16a34a;">${Utils.formatMoney(s.approvedAmount || 0)}</div>
          </div>
        </div>
      `;
      
      barEl.innerHTML = `<button class="btn btn-default btn-sm" onclick="ReportsPage.exportCSV('requests')" style="padding:6px 16px;">📥 导出采购申请</button>`;
    } catch (err) {
      console.error('Load requests summary error:', err);
    }
  },
  
  exportCSV(type) {
    const startDate = document.getElementById('r-start')?.value || this.startDate;
    const endDate = document.getElementById('r-end')?.value || this.endDate;
    const typeParam = this.currentType ? `&type=${this.currentType}` : '';
    
    const baseUrl = `${API.baseUrl}/reports/export?reportType=${type}&startDate=${startDate}&endDate=${endDate}${typeParam}`;
    
    // Use cookie-based auth - open the URL in the same browser context
    // The browser will include cookies automatically
    window.open(baseUrl, '_blank');
  }
};
