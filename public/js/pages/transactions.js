// Transactions list page
const TransactionsPage = {
  currentType: 'all',
  currentPage: 1,
  searchTerm: '',
  selectedCategory: '',
  
  async render(container, type) {
    this.currentType = type || 'all';
    this.currentPage = 1;
    this.searchTerm = '';
    this.selectedCategory = '';
    
    container.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" placeholder="搜索记录...">
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
    
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
      this.currentPage++;
      this.loadTransactions(true);
    });
    
    this.loadTransactions();
  },
  
  async loadTransactions(append = false) {
    const listEl = document.getElementById('transactionsList');
    if (!append) Utils.showLoading(listEl);
    
    try {
      const params = {
        page: this.currentPage,
        limit: 20
      };
      if (this.currentType !== 'all') params.type = this.currentType;
      if (this.searchTerm) params.search = this.searchTerm;
      
      const data = await API.getTransactions(params);
      
      if (!append) listEl.innerHTML = '';
      
      if (data.list.length === 0 && !append) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p class="empty-text">暂无记录</p></div>';
        document.getElementById('loadMore').style.display = 'none';
        return;
      }
      
      for (const tx of data.list) {
        const item = Utils.el('div', { className: 'tx-item', onclick: () => App.navigate('/transactions', 'detail', tx.id) }, [
          Utils.el('div', { className: `tx-icon ${tx.type}` }, [Utils.getCategoryIcon(tx.category)]),
          Utils.el('div', { className: 'tx-info' }, [
            Utils.el('div', { className: 'tx-category' }, [tx.category + (tx.source === 'purchase_request' ? ' (采购)' : '')]),
            Utils.el('div', { className: 'tx-desc' }, [tx.description || tx.creator_name || ''])
          ]),
          Utils.el('div', { className: 'tx-right' }, [
            Utils.el('div', { className: `tx-amount ${tx.type}` }, [(tx.type === 'income' ? '+' : '-') + Utils.formatMoney(tx.amount)]),
            Utils.el('div', { className: 'tx-date' }, [Utils.formatDate(tx.created_at)]),
            ...(tx.receipt_path ? [Utils.el('div', { className: 'tx-attachment' }, ['📎 有票据'])] : [])
          ])
        ]);
        listEl.appendChild(item);
      }
      
      document.getElementById('loadMore').style.display = data.list.length === 20 ? 'block' : 'none';
      
    } catch (err) {
      if (!append) listEl.innerHTML = `<div class="empty-state"><p class="empty-text">加载失败: ${err.message}</p></div>`;
    }
  }
};
