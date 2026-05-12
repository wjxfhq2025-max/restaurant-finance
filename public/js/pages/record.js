// Record page (add income/expense)
const RecordPage = {
  currentType: 'expense',
  uploadedFile: null,
  
  render(container, type) {
    this.currentType = type || 'expense';
    this.uploadedFile = null;
    
    const isIncome = this.currentType === 'income';
    const incomeCategories = ['堂食', '外卖', '团购', '饮品', '其他'];
    const expenseCategories = ['食材', '房租', '水电', '人工', '物料', '设备', '其他'];
    const categories = isIncome ? incomeCategories : expenseCategories;
    const categoryOptions = categories.map(c => `<option value="${c}">${Utils.getCategoryIcon(c)} ${c}</option>`).join('');
    
    container.innerHTML = `
      <div class="card">
        <div class="card-title">
          <span>${isIncome ? '💰 记录收入' : '💸 记录支出'}</span>
        </div>
        
        <div class="tabs" style="margin-bottom:20px;">
          <button class="tab ${!isIncome ? 'active' : ''}" onclick="RecordPage.switchType('expense')">支出</button>
          <button class="tab ${isIncome ? 'active' : ''}" onclick="RecordPage.switchType('income')">收入</button>
        </div>
        
        <form id="recordForm">
          <div class="form-group">
            <label class="form-label">金额 (元)</label>
            <input type="number" class="form-input" id="recordAmount" placeholder="请输入金额" step="0.01" min="0.01" inputmode="decimal" required style="font-size:24px;font-weight:700;">
          </div>
          
          <div class="form-group">
            <label class="form-label">分类</label>
            <select class="form-select" id="recordCategory" required>
              <option value="">请选择分类</option>
              ${categoryOptions}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">备注说明</label>
            <textarea class="form-textarea" id="recordDesc" placeholder="选填，如：采购蔬菜一批" rows="2"></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">上传票据图片</label>
            <div class="upload-area" id="uploadArea" onclick="document.getElementById('receiptInput').click()">
              <div class="upload-icon">📷</div>
              <div class="upload-text">点击拍照或选择图片</div>
            </div>
            <input type="file" id="receiptInput" accept="image/*" capture="environment" style="display:none;">
            <div id="uploadPreview" class="upload-preview" style="display:none;">
              <img id="previewImg" src="" alt="预览">
              <button type="button" class="upload-remove" onclick="RecordPage.removeFile()">✕</button>
            </div>
          </div>
          
          <button type="submit" class="btn ${isIncome ? 'btn-success' : 'btn-danger'}" style="margin-top:8px;">
            ${isIncome ? '✅ 确认收入' : '✅ 确认支出'}
          </button>
        </form>
      </div>
    `;
    
    // Bind events
    document.getElementById('receiptInput').addEventListener('change', (e) => {
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
    
    document.getElementById('recordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitRecord();
    });
  },
  
  switchType(type) {
    this.currentType = type;
    this.uploadedFile = null;
    this.render(document.getElementById('appMain'), type);
  },
  
  removeFile() {
    this.uploadedFile = null;
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('receiptInput').value = '';
  },
  
  async submitRecord() {
    const amount = document.getElementById('recordAmount').value;
    const category = document.getElementById('recordCategory').value;
    const desc = document.getElementById('recordDesc').value.trim();
    
    if (!amount || parseFloat(amount) <= 0) {
      Utils.showToast('请输入有效金额');
      return;
    }
    
    if (!category) {
      Utils.showToast('请选择分类');
      return;
    }
    
    const formData = new FormData();
    formData.append('type', this.currentType);
    formData.append('amount', amount);
    formData.append('category', category);
    formData.append('description', desc);
    if (this.uploadedFile) {
      formData.append('receipt', this.uploadedFile);
    }
    
    const btn = document.querySelector('#recordForm button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '提交中...';
    
    try {
      await API.createTransaction(formData);
      Utils.showToast(this.currentType === 'income' ? '✅ 收入已记录' : '✅ 支出已记录');
      // Reset form
      document.getElementById('recordAmount').value = '';
      document.getElementById('recordCategory').value = '';
      document.getElementById('recordDesc').value = '';
      this.removeFile();
      
      setTimeout(() => App.navigate('/home'), 800);
    } catch (err) {
      Utils.showToast(err.message);
      btn.disabled = false;
      btn.textContent = this.currentType === 'income' ? '✅ 确认收入' : '✅ 确认支出';
    }
  }
};
