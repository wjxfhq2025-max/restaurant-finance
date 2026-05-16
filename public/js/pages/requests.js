// Purchase requests list page
const RequestsPage = {
  currentStatus: '',
  currentPage: 1,
  
  async render(container, detailId) {
    if (detailId) {
      RequestDetailPage.render(container, detailId);
      return;
    }
    
    this.currentPage = 1;
    Utils.showLoading(container);
    
    try {
      const [myRequests, pendingRequests] = await Promise.all([
        API.getRequests({ page: 1, limit: 50 }),
        API.getPendingRequests().catch(() => [])
      ]).catch(async (err) => {
        // If one fails, try the other
        const my = await API.getRequests({ page: 1, limit: 50 });
        return [my, []];
      });
      
      this.renderContent(container, myRequests, pendingRequests);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">😔</div><p class="empty-text">加载失败: ${err.message}</p></div>`;
    }
  },
  
  renderContent(container, requestsData, pendingRequests) {
    const requests = requestsData.list || [];
    
    // Status tabs
    const statusTabs = `
      <div class="tabs" style="margin-bottom:16px;">
        <button class="tab ${!this.currentStatus ? 'active' : ''}" data-status="">全部</button>
        <button class="tab ${this.currentStatus === 'pending' ? 'active' : ''}" data-status="pending">待审批</button>
        <button class="tab ${this.currentStatus === 'approved' ? 'active' : ''}" data-status="approved">已通过</button>
        <button class="tab ${this.currentStatus === 'rejected' ? 'active' : ''}" data-status="rejected">已拒绝</button>
      </div>
    `;
    
    // Pending requests section (for approvers)
    let pendingHtml = '';
    if (pendingRequests && pendingRequests.length > 0) {
      pendingHtml = `
        <div class="section-title">🔔 待我审批</div>
        ${pendingRequests.map(r => this.renderRequestCard(r)).join('')}
        <div class="section-title" style="margin-top:24px;">所有申请</div>
      `;
    }
    
    // All requests
    let listHtml = '';
    if (requests.length === 0) {
      listHtml = '<div class="empty-state"><div class="empty-icon">📋</div><p class="empty-text">暂无申请记录</p></div>';
    } else {
      // Filter by status
      let filtered = requests;
      if (this.currentStatus === 'pending') {
        filtered = requests.filter(r => r.status.startsWith('pending_'));
      } else if (this.currentStatus) {
        filtered = requests.filter(r => r.status === this.currentStatus);
      }
      
      if (filtered.length === 0) {
        listHtml = '<div class="empty-state"><div class="empty-icon">📋</div><p class="empty-text">暂无符合条件的申请</p></div>';
      } else {
        listHtml = filtered.map(r => this.renderRequestCard(r)).join('');
      }
    }
    
    container.innerHTML = `
      ${statusTabs}
      ${pendingHtml}
      <div id="requestsList">
        ${listHtml}
      </div>
      <div style="text-align:center;margin-top:16px;">
        <button class="btn btn-default btn-sm" onclick="App.navigate('/request-form')" style="width:auto;padding:10px 32px;">＋ 新建申请</button>
      </div>
    `;
    
    // Bind tab events
    container.querySelectorAll('.tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentStatus = tab.dataset.status;
        container.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.render(container);
      });
    });
  },
  
  renderRequestCard(r) {
    const statusClass = r.status.startsWith('pending_') ? 'pending' : r.status;
    const statusText = Utils.getStatusText(r.status);
    const statusEmoji = r.status === 'approved' ? '✅' : r.status === 'rejected' ? '❌' : '⏳';
    
    return `
      <div class="request-item status-${r.status}" onclick="App.navigate('#/requests/detail/${r.id}')">
        <div class="request-header">
          <div class="request-title">${r.title}</div>
          <span class="request-status ${statusClass}">${statusEmoji} ${statusText}</span>
        </div>
        <div class="request-amount">¥${Number(r.amount).toLocaleString('zh-CN', {minimumFractionDigits:2})}</div>
        <div class="request-meta">申请人: ${r.applicant_name || '-'} | ${Utils.formatDate(r.created_at)}</div>
      </div>
    `;
  }
};
