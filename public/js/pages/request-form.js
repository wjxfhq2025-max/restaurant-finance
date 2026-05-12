// Purchase request form page
const RequestFormPage = {
  uploadedFile: null,
  
  render(container) {
    this.uploadedFile = null;
    
    const categories = ['食材', '设备', '物料', '装修', '其他'];
    const categoryOptions = categories.map(c => `<option value="${c}">${Utils.getCategoryIcon(c)} ${c}</option>`).join('');
    
    container.innerHTML = `
      <div class="card">
        <div class="card-title">📋 新建采购申请</div>
        <div style="background:#FFF7ED;border-left:4px solid var(--primary);padding:12px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:16px;font-size:var(--font-size-sm);color:#9A3412;">
          💡 采购申请提交后，将依次由主管 → 财务审批；金额≥10000元时还需股东审批。无票据采购请使用此功能。
        </div>
        
        <form id="requestForm">
          <div class="form-group">
            <label class="form-label">申请标题</label>
            <input type="text" class="form-input" id="reqTitle" placeholder="如：采购5月蔬菜" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">金额 (元)</label>
            <input type="number" class="form-input" id="reqAmount" placeholder="请输入金额" step="0.01" min="0.01" inputmode="decimal" required style="font-size:24px;font-weight:700;">
            <div id="amountHint" style="margin-top:4px;font-size:var(--font-size-sm);color:var(--text-muted);"></div>
          </div>
          
          <div class="form-group">
            <label class="form-label">分类</label>
            <select class="form-select" id="reqCategory" required>
              <option value="">请选择分类</option>
              ${categoryOptions}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">详细说明</label>
            <textarea class="form-textarea" id="reqDesc" placeholder="请详细说明采购内容、用途等" rows="3"></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">上传附件（可选）</label>
            <div class="upload-area" id="uploadArea" onclick="document.getElementById('attachmentInput').click()">
              <div class="upload-icon">📎</div>
              <div class="upload-text">点击上传附件图片</div>
            </div>
            <input type="file" id="attachmentInput" accept="image/*" style="display:none;">
            <div id="uploadPreview" class="upload-preview" style="display:none;">
              <img id="previewImg" src="" alt="预览">
              <button type="button" class="upload-remove" onclick="RequestFormPage.removeFile()">✕</button>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary" style="margin-top:8px;">📤 提交申请</button>
        </form>
      </div>
    `;
    
    // Amount hint
    document.getElementById('reqAmount').addEventListener('input', (e) => {
      const amt = parseFloat(e.target.value);
      const hint = document.getElementById('amountHint');
      if (amt >= 10000) {
        hint.textContent = '⚠️ 金额≥10000元，需要股东审批';
        hint.style.color = '#D97706';
      } else if (amt > 0) {
        hint.textContent = '✅ 将依次由主管和财务审批';
        hint.style.color = '#16A34A';
      } else {
        hint.textContent = '';
      }
    });
    
    // File upload
    document.getElementById('attachmentInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.uploadedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          document.getElementById('previewImg').src = ev.target.result;
          document.getElementById('uploadPreview').style.display = 'block';
          document.getElementById('uploadArea').style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    });
    
    // Submit
    document.getElementById('requestForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitRequest();
    });
  },
  
  removeFile() {
    this.uploadedFile = null;
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('attachmentInput').value = '';
  },
  
  async submitRequest() {
    const title = document.getElementById('reqTitle').value.trim();
    const amount = document.getElementById('reqAmount').value;
    const category = document.getElementById('reqCategory').value;
    const desc = document.getElementById('reqDesc').value.trim();
    
    if (!title) { Utils.showToast('请输入申请标题'); return; }
    if (!amount || parseFloat(amount) <= 0) { Utils.showToast('请输入有效金额'); return; }
    if (!category) { Utils.showToast('请选择分类'); return; }
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('amount', amount);
    formData.append('category', category);
    formData.append('description', desc);
    if (this.uploadedFile) {
      formData.append('attachment', this.uploadedFile);
    }
    
    const btn = document.querySelector('#requestForm button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '提交中...';
    
    try {
      const result = await API.createRequest(formData);
      Utils.showToast('✅ 申请已提交');
      setTimeout(() => App.navigate('/requests'), 800);
    } catch (err) {
      Utils.showToast(err.message);
      btn.disabled = false;
      btn.textContent = '📤 提交申请';
    }
  }
};
