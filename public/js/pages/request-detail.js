// Purchase request detail page
const RequestDetailPage = {
  async render(container, id) {
    Utils.showLoading(container);
    
    try {
      const data = await API.getRequest(id);
      this.renderContent(container, data);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">😔</div><p class="empty-text">加载失败: ${err.message}</p></div>`;
    }
  },
  
  renderContent(container, data) {
    const { request, approvals } = data;
    const isPending = request.status.startsWith('pending_');
    const statusText = Utils.getStatusText(request.status);
    const statusEmoji = request.status === 'approved' ? '✅' : request.status === 'rejected' ? '❌' : '⏳';
    const isRejected = request.status === 'rejected';
    
    // Approval flow
    const stages = [
      { key: 'supervisor', name: '主管审批', role: '主管' },
      { key: 'finance', name: '财务审批', role: '财务' },
    ];
    if (request.amount >= 10000) {
      stages.push({ key: 'shareholder', name: '股东审批', role: '股东' });
    }
    
    let currentStageIdx = 0;
    if (request.status === 'pending_finance') currentStageIdx = 1;
    if (request.status === 'pending_shareholder') currentStageIdx = 2;
    const isFullyApproved = request.status === 'approved';
    
    let flowHtml = '<div class="approval-flow">';
    stages.forEach((stage, idx) => {
      const approval = approvals.find(a => a.stage === stage.key);
      let indicatorClass = '';
      let desc = '';
      
      if (approval) {
        if (approval.decision === 'approved') {
          indicatorClass = 'done';
          desc = `${stage.role}已通过 ${Utils.formatDate(approval.created_at)}`;
          if (approval.comment) desc += `（${approval.comment}）`;
        } else {
          indicatorClass = 'rejected';
          desc = `${stage.role}已拒绝: ${approval.comment || ''}`;
        }
      } else if (isFullyApproved) {
        // 已通过但没有审批记录（可能是旧数据或管理员直接操作）
        indicatorClass = 'done';
        desc = `${stage.role}已通过`;
      } else if (idx === currentStageIdx && isPending) {
        indicatorClass = 'current';
        desc = `等待${stage.role}审批中...`;
      } else if (idx < currentStageIdx) {
        indicatorClass = 'done';
        desc = `${stage.role}已通过`;
      } else {
        desc = `等待${stage.role}审批`;
      }
      
      const emoji = indicatorClass === 'done' ? '✅' : indicatorClass === 'rejected' ? '❌' : indicatorClass === 'current' ? '🔔' : '⏳';
      
      flowHtml += `
        <div class="approval-step">
          <div class="step-indicator ${indicatorClass}">${emoji}</div>
          <div class="step-info">
            <div class="step-title">${stage.name}</div>
            <div class="step-desc">${desc}</div>
          </div>
        </div>
      `;
    });
    flowHtml += '</div>';
    
    // Attachment
    let attachmentHtml = '';
    if (request.attachment_path) {
      attachmentHtml = `
        <div class="form-group">
          <label class="form-label">附件图片</label>
          <div style="border-radius:var(--radius-sm);overflow:hidden;cursor:pointer;" onclick="Utils.showImage('/uploads/${request.attachment_path}')">
            <img src="/uploads/${request.attachment_path}" style="width:100%;max-height:200px;object-fit:cover;" alt="附件">
          </div>
        </div>
      `;
    }
    
    // Action buttons (for current approver)
    let actionHtml = '';
    if (isPending) {
      const currentUser = window.__currentUser;
      const stageMap = {
        'pending_supervisor': 'supervisor',
        'pending_finance': 'finance',
        'pending_shareholder': 'shareholder'
      };
      const expectedStage = stageMap[request.status];
      
      // Show approve/reject buttons if user can approve
      const hasRole = (r, check) => r && r.split(',').map(x => x.trim()).includes(check);
      const canApprove = currentUser && (
        (expectedStage === 'supervisor' && hasRole(currentUser.role, 'supervisor')) ||
        (expectedStage === 'finance' && hasRole(currentUser.role, 'finance')) ||
        (expectedStage === 'shareholder' && hasRole(currentUser.role, 'shareholder')) ||
        hasRole(currentUser.role, 'admin')
      );
      
      if (canApprove) {
        actionHtml = `
          <div class="request-actions" id="approveActions">
            <button class="btn btn-success" onclick="RequestDetailPage.approve('${expectedStage}')" style="flex:1;">✅ 同意</button>
            <button class="btn btn-danger" onclick="RequestDetailPage.reject('${expectedStage}')" style="flex:1;">❌ 拒绝</button>
          </div>
        `;
      }
    }
    
    // Rejection info
    let rejectHtml = '';
    if (isRejected && request.reject_reason) {
      rejectHtml = `
        <div class="card" style="border-left:4px solid var(--expense);margin-top:12px;">
          <div style="font-weight:600;color:var(--expense);margin-bottom:4px;">拒绝原因</div>
          <div>${request.reject_reason}</div>
        </div>
      `;
    }
    
    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <button class="back-btn" onclick="App.navigate('/requests')">← 返回列表</button>
      </div>
      
      <div class="request-item status-${request.status}" style="cursor:default;">
        <div class="request-header">
          <div class="request-title">${request.title}</div>
          <span class="request-status ${isRejected ? 'rejected' : isPending ? 'pending' : 'approved'}">
            ${statusEmoji} ${statusText}
          </span>
        </div>
        <div class="request-amount">¥${Number(request.amount).toLocaleString('zh-CN', {minimumFractionDigits:2})}</div>
        <div class="request-meta">分类: ${request.category} | 申请人: ${request.applicant_name || '-'} | ${Utils.formatDate(request.created_at)}</div>
      </div>
      
      ${request.description ? `
        <div class="card">
          <div class="card-title">详细说明</div>
          <p style="font-size:var(--font-size-base);line-height:1.6;">${request.description}</p>
        </div>
      ` : ''}
      
      ${attachmentHtml}
      
      <div class="card">
        <div class="card-title">📭 审批流程</div>
        ${flowHtml}
      </div>
      
      ${rejectHtml}
      
      <div id="commentGroup" style="display:none;margin-top:12px;">
        <div class="card">
          <textarea class="form-textarea" id="approveComment" placeholder="备注说明（选填）" rows="2"></textarea>
        </div>
      </div>
      
      ${actionHtml}
    `;
  },
  
  async approve(stage) {
    const comment = document.getElementById('approveComment') ? document.getElementById('approveComment').value.trim() : '';
    
    if (!confirm(`确认同意此采购申请（${stage}审批）？`)) return;
    
    try {
      await API.approveRequest(
        App.getCurrentParams()?.id || new URLSearchParams(location.hash.slice(1)).get('id'),
        stage,
        comment
      );
      Utils.showToast('✅ 审批已通过');
      setTimeout(() => App.navigate('/requests'), 800);
    } catch (err) {
      Utils.showToast(err.message);
    }
  },
  
  async reject(stage) {
    const comment = prompt('请输入拒绝原因（必填）：');
    if (comment === null) return;
    if (!comment.trim()) { Utils.showToast('请填写拒绝原因'); return; }
    
    try {
      await API.rejectRequest(
        App.getCurrentParams()?.id || new URLSearchParams(location.hash.slice(1)).get('id'),
        stage,
        comment.trim()
      );
      Utils.showToast('已拒绝此申请');
      setTimeout(() => App.navigate('/requests'), 800);
    } catch (err) {
      Utils.showToast(err.message);
    }
  }
};
