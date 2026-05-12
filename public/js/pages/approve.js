// Standalone approval page (accessed via token link, no login needed)
// This is designed for elderly shareholders - very simple, large buttons
const ApprovePage = {
  token: null,
  data: null,
  
  render(container, token) {
    this.token = token;
    this.data = null;
    
    container.innerHTML = `
      <div class="approve-page">
        <div style="text-align:center;padding:24px 0 8px;">
          <div style="font-size:48px;margin-bottom:8px;">🍽️</div>
          <h2 style="font-size:22px;font-weight:700;">餐饮店采购审批</h2>
          <p style="font-size:14px;color:#999;margin-top:4px;">请仔细查看采购信息后做出审批决定</p>
        </div>
        <div id="approveContent">
          <div class="loading-spinner"><div class="spinner"></div><p>加载中...</p></div>
        </div>
      </div>
    `;
    
    this.loadApprovalInfo();
  },
  
  async loadApprovalInfo() {
    const contentEl = document.getElementById('approveContent');
    
    try {
      this.data = await API.getApprovalInfo(this.token);
      this.renderApprovalForm(contentEl);
    } catch (err) {
      contentEl.innerHTML = `
        <div class="card" style="text-align:center;padding:32px 16px;">
          <div style="font-size:48px;margin-bottom:12px;">😔</div>
          <p style="font-size:16px;color:#666;">${err.message}</p>
          <p style="font-size:14px;color:#999;margin-top:8px;">请确认链接是否正确，或联系管理员</p>
        </div>
      `;
    }
  },
  
  renderApprovalForm(container) {
    const { request, approvals, stage, needsShareholder } = this.data;
    const stageNames = { supervisor: '主管', finance: '财务', shareholder: '股东' };
    const currentStageName = stageNames[stage] || stage;
    const isRejected = request.status === 'rejected';
    const isApproved = request.status === 'approved';
    
    // Previous approvals
    let approvalsHtml = '';
    if (approvals && approvals.length > 0) {
      approvalsHtml = `
        <div style="margin-top:16px;border-top:1px solid #eee;padding-top:12px;">
          <div style="font-size:14px;color:#999;margin-bottom:8px;">审批记录</div>
          ${approvals.map(a => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:15px;">
              <span>${a.decision === 'approved' ? '✅' : '❌'}</span>
              <span style="color:#666;">${a.approver_name || stageNames[a.stage]}</span>
              <span style="color:#999;font-size:13px;">${Utils.formatDate(a.created_at)}</span>
              ${a.comment ? `<span style="color:#666;">${a.comment}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
    
    // If already processed
    if (isApproved) {
      container.innerHTML = `
        <div class="approve-card" style="text-align:center;">
          <div style="font-size:64px;margin-bottom:12px;">✅</div>
          <h3 style="font-size:20px;color:var(--income);">已通过</h3>
          <p style="color:#999;margin-top:8px;">此采购申请已通过全部审批</p>
        </div>
      `;
      return;
    }
    
    if (isRejected) {
      container.innerHTML = `
        <div class="approve-card" style="text-align:center;">
          <div style="font-size:64px;margin-bottom:12px;">❌</div>
          <h3 style="font-size:20px;color:var(--expense);">已拒绝</h3>
          <p style="color:#999;margin-top:8px;">此采购申请已被拒绝</p>
          ${request.reject_reason ? `<p style="color:#666;margin-top:8px;">原因: ${request.reject_reason}</p>` : ''}
        </div>
      `;
      return;
    }
    
    // Attachment preview
    let attachmentHtml = '';
    if (request.attachment_path) {
      attachmentHtml = `
        <div style="margin-top:12px;">
          <div style="font-size:14px;color:#999;margin-bottom:6px;">附件图片</div>
          <img src="/uploads/${request.attachment_path}" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover;cursor:pointer;" onclick="Utils.showImage('/uploads/${request.attachment_path}')">
        </div>
      `;
    }
    
    container.innerHTML = `
      <div class="approve-card">
        <div style="text-align:center;margin-bottom:8px;">
          <span style="background:#FFF7ED;color:var(--primary);padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;">
            等待 ${currentStageName} 审批
          </span>
        </div>
        
        <div class="approve-amount">${Number(request.amount).toLocaleString('zh-CN', {minimumFractionDigits:2})}</div>
        
        <div style="background:#F9FAFB;border-radius:8px;padding:12px;">
          <div class="approve-detail-row" style="border:none;padding:6px 0;">
            <span class="approve-detail-label">申请标题</span>
            <span style="font-weight:500;">${request.title}</span>
          </div>
          <div class="approve-detail-row" style="border:none;padding:6px 0;">
            <span class="approve-detail-label">分类</span>
            <span>${Utils.getCategoryIcon(request.category)} ${request.category}</span>
          </div>
          <div class="approve-detail-row" style="border:none;padding:6px 0;">
            <span class="approve-detail-label">申请人</span>
            <span>${request.applicant_name || '-'}</span>
          </div>
          <div class="approve-detail-row" style="border:none;padding:6px 0;">
            <span class="approve-detail-label">申请时间</span>
            <span>${Utils.formatDate(request.created_at)}</span>
          </div>
        </div>
        
        ${request.description ? `
          <div style="margin-top:12px;">
            <div style="font-size:14px;color:#999;margin-bottom:6px;">详细说明</div>
            <div style="background:#F9FAFB;border-radius:8px;padding:12px;font-size:15px;line-height:1.6;">${request.description}</div>
          </div>
        ` : ''}
        
        ${attachmentHtml}
        ${approvalsHtml}
        
        <div style="margin-top:16px;">
          <label style="font-size:14px;color:#999;">备注说明（选填）</label>
          <textarea id="approveComment" class="form-textarea" placeholder="可填写审批意见（选填）" rows="2" style="margin-top:6px;"></textarea>
        </div>
      </div>
      
      <div class="approve-buttons">
        <button class="btn btn-approve" onclick="ApprovePage.submit('approved')">
          同 意
        </button>
        <button class="btn btn-reject" onclick="ApprovePage.submit('rejected')">
          拒 绝
        </button>
      </div>
    `;
  },
  
  async submit(decision) {
    const comment = document.getElementById('approveComment') 
      ? document.getElementById('approveComment').value.trim() 
      : '';
    
    if (decision === 'rejected') {
      const reason = prompt('请输入拒绝原因（必填）：');
      if (!reason) return;
      this._rejectReason = reason;
    }
    
    const btnText = decision === 'approved' ? '处理中...' : '处理中...';
    const buttons = document.querySelectorAll('.approve-buttons .btn');
    buttons.forEach(b => { b.disabled = true; b.textContent = btnText; });
    
    try {
      const result = await API.submitApproval(this.token, decision, decision === 'approved' ? comment : (this._rejectReason || ''));
      
      if (decision === 'approved') {
        if (result.nextStatus && result.nextStatus !== 'approved') {
          // Need further approval
          const stageNames = { pending_finance: '财务', pending_shareholder: '股东' };
          const nextStage = result.nextStatus.replace('pending_', '');
          const nextName = stageNames[result.nextStatus] || '下一审批人';
          document.getElementById('approveContent').innerHTML = `
            <div class="approve-card" style="text-align:center;">
              <div style="font-size:64px;margin-bottom:12px;">✅</div>
              <h3 style="font-size:20px;color:var(--income);">审批已通过</h3>
              <p style="color:#999;margin-top:8px;">等待${nextName}审批</p>
              <p style="color:#999;font-size:14px;margin-top:4px;">审批结果已通知相关人员</p>
            </div>
          `;
          document.querySelector('.approve-buttons').innerHTML = '';
        } else {
          document.getElementById('approveContent').innerHTML = `
            <div class="approve-card" style="text-align:center;">
              <div style="font-size:64px;margin-bottom:12px;">🎉</div>
              <h3 style="font-size:20px;color:var(--income);">审批全部通过！</h3>
              <p style="color:#999;margin-top:8px;">采购申请已通过全部审批，支出已入账</p>
            </div>
          `;
          document.querySelector('.approve-buttons').innerHTML = '';
        }
      } else {
        document.getElementById('approveContent').innerHTML = `
          <div class="approve-card" style="text-align:center;">
            <div style="font-size:64px;margin-bottom:12px;">❌</div>
            <h3 style="font-size:20px;color:var(--expense);">已拒绝</h3>
            <p style="color:#999;margin-top:8px;">已通知申请人</p>
          </div>
        `;
        document.querySelector('.approve-buttons').innerHTML = '';
      }
      
    } catch (err) {
      Utils.showToast(err.message);
      buttons.forEach(b => { b.disabled = false; b.textContent = decision === 'approved' ? '同 意' : '拒 绝'; });
    }
  }
};
