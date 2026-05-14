// Transaction detail page
const TransactionDetailPage = {
  currentId: null,
  
  async render(container, id) {
    Utils.showLoading(container);
    this.currentId = id;
    
    try {
      const tx = await API.getTransaction(id);
      this.renderContent(container, tx);
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😔</div>
          <p class="empty-text">加载失败: ${err.message}</p>
          <button class="btn btn-default" onclick="App.navigate('/transactions')" style="margin-top:12px;">返回记录</button>
        </div>
      `;
    }
  },
  
  renderContent(container, tx) {
    const isIncome = tx.type === 'income';
    const isAdmin = window.__currentUser && window.__currentUser.role === 'admin';
    const amountColor = isIncome ? 'color:#22c55e;' : 'color:#ef4444;';
    const amountPrefix = isIncome ? '+' : '-';
    
    let receiptHtml = '';
    if (tx.receipt_path) {
      const imgSrc = tx.receipt_path;
      receiptHtml = `
        <div class="card" style="margin-top:16px;">
          <div class="card-title">📎 票据图片</div>
          <div style="text-align:center;">
            <img src="${imgSrc}" alt="票据" style="max-width:100%;max-height:280px;border-radius:8px;cursor:pointer;object-fit:cover;" onclick="Utils.showImage('${imgSrc}')">
            <p style="font-size:12px;color:var(--text-muted);margin-top:6px;">点击图片可放大查看</p>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = `
      <div style="padding:16px;">
        <!-- Back button -->
        <div style="display:flex;align-items:center;margin-bottom:20px;">
          <button onclick="App.navigate('/transactions')" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>
          <span style="font-size:16px;font-weight:600;flex:1;text-align:center;padding-right:32px;">记录详情</span>
        </div>
        
        <!-- Amount Card -->
        <div class="card" style="text-align:center;padding:24px;">
          <div style="font-size:40px;margin-bottom:8px;">${Utils.getCategoryIcon(tx.category)}</div>
          <div style="font-size:14px;color:var(--text-muted);margin-bottom:4px;">${tx.category}</div>
          <div style="font-size:32px;font-weight:700;${amountColor}">
            ${amountPrefix}${Utils.formatMoney(tx.amount)}
          </div>
          <div style="margin-top:12px;">
            <span class="tag ${isIncome ? 'tag-success' : 'tag-danger'}">${isIncome ? '💰 收入' : '💸 支出'}</span>
          </div>
        </div>
        
        <!-- Details Card -->
        <div class="card" style="margin-top:16px;">
          <div class="card-title">📋 详细信息</div>
          <div style="display:grid;gap:10px;">
            ${tx.description ? `
            <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color);">
              <div style="color:var(--text-muted);min-width:70px;">备注</div>
              <div style="flex:1;">${tx.description}</div>
            </div>` : ''}
            <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color);">
              <div style="color:var(--text-muted);min-width:70px;">时间</div>
              <div style="flex:1;">${new Date(tx.created_at).toLocaleString('zh-CN')}</div>
            </div>
            ${tx.creator_name ? `
            <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color);">
              <div style="color:var(--text-muted);min-width:70px;">记录人</div>
              <div style="flex:1;">${tx.creator_name}</div>
            </div>` : ''}
            ${tx.source === 'purchase_request' ? `
            <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color);">
              <div style="color:var(--text-muted);min-width:70px;">来源</div>
              <div style="flex:1;">📦 采购申请</div>
            </div>` : ''}
            <div style="display:flex;gap:12px;padding:8px 0;">
              <div style="color:var(--text-muted);min-width:70px;">票据</div>
              <div style="flex:1;">${tx.receipt_path ? '✅ 已上传' : '—'}</div>
            </div>
          </div>
        </div>
        
        ${receiptHtml}
        
        ${isAdmin ? `
        <div style="display:flex;gap:8px;margin-top:20px;">
          <button class="btn btn-default" id="editTxBtn" style="flex:1;">✏️ 编辑</button>
          <button class="btn btn-danger" id="deleteTxBtn" style="flex:1;">🗑️ 删除</button>
        </div>
        ` : ''}
        
        <!-- Edit Modal -->
        <div id="editModal" class="modal-overlay" style="display:none;">
          <div class="modal-box">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;font-size:16px;">✏️ 编辑记录</h3>
              <button onclick="TransactionDetailPage.closeEdit()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
            </div>
            <form id="editForm">
              <div class="form-group">
                <label class="form-label">类型</label>
                <select class="form-select" id="editType" required>
                  <option value="income">💰 收入</option>
                  <option value="expense">💸 支出</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">金额 (元)</label>
                <input type="number" class="form-input" id="editAmount" step="0.01" min="0.01" required>
              </div>
              <div class="form-group">
                <label class="form-label">分类</label>
                <select class="form-select" id="editCategory" required></select>
              </div>
              <div class="form-group">
                <label class="form-label">备注说明</label>
                <textarea class="form-textarea" id="editDesc" rows="2"></textarea>
              </div>
              <div class="form-group" style="display:flex;gap:8px;margin-top:16px;">
                <button type="submit" class="btn btn-primary" style="flex:1;">💾 保存</button>
                <button type="button" class="btn btn-default" onclick="TransactionDetailPage.closeEdit()" style="flex:1;">取消</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    
    // Populate edit form with current tx data
    document.getElementById('editType').value = tx.type;
    document.getElementById('editAmount').value = tx.amount;
    document.getElementById('editDesc').value = tx.description || '';
    
    const cats = this.getCategories(tx.type);
    document.getElementById('editCategory').innerHTML = cats.map(c => 
      `<option value="${c}" ${c === tx.category ? 'selected' : ''}>${c}</option>`
    ).join('');
    
    // Type change updates categories
    document.getElementById('editType').addEventListener('change', () => {
      const t = document.getElementById('editType').value;
      const cats2 = this.getCategories(t);
      document.getElementById('editCategory').innerHTML = cats2.map(c => `<option value="${c}">${c}</option>`).join('');
    });
    
    // Bind buttons
    const editBtn = document.getElementById('editTxBtn');
    if (editBtn) editBtn.addEventListener('click', () => this.openEdit(tx));
    
    const deleteBtn = document.getElementById('deleteTxBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteTx());
    
    // Bind form
    document.getElementById('editForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveEdit();
    });
  },
  
  getCategories(type) {
    if (type === 'income') return ['堂食', '外卖', '团购', '饮品', '其他'];
    if (type === 'expense') return ['食材', '房租', '水电', '人工', '物料', '设备', '其他'];
    return ['其他'];
  },
  
  openEdit(tx) {
    document.getElementById('editModal').style.display = 'flex';
  },
  
  closeEdit() {
    document.getElementById('editModal').style.display = 'none';
  },
  
  async saveEdit() {
    const type = document.getElementById('editType').value;
    const amount = document.getElementById('editAmount').value;
    const category = document.getElementById('editCategory').value;
    const description = document.getElementById('editDesc').value.trim();
    
    try {
      await API.request('PUT', `/transactions/${this.currentId}`, { type, amount, category, description });
      Utils.showToast('✅ 修改成功');
      this.closeEdit();
      this.render(document.getElementById('appMain'), this.currentId);
    } catch (err) {
      Utils.showToast(err.message);
    }
  },
  
  async deleteTx() {
    const confirmed = await Utils.confirm('确认删除此记录？此操作不可恢复。');
    if (!confirmed) return;
    
    try {
      await API.request('DELETE', `/transactions/${this.currentId}`);
      Utils.showToast('✅ 已删除');
      App.navigate('/transactions');
    } catch (err) {
      Utils.showToast(err.message);
    }
  }
};
