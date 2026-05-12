// Utility functions
const Utils = {
  // Format amount
  formatMoney(amount) {
    return '¥' + Number(amount).toLocaleString('zh-CN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  },
  
  // Format date
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} ${h}:${min}`;
  },
  
  formatDateFull(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  
  // Category icons
  getCategoryIcon(category) {
    const icons = {
      '堂食': '🍽️', '外卖': '🛵', '团购': '📱', '饮品': '🥤',
      '食材': '🥬', '房租': '🏠', '水电': '💡', '人工': '👷',
      '物料': '📦', '设备': '🔧', '其他': '📌'
    };
    return icons[category] || '📌';
  },
  
  // Role display name
  getRoleName(role) {
    const names = {
      'admin': '管理员',
      'purchaser': '采购员',
      'supervisor': '主管',
      'finance': '财务',
      'shareholder': '股东'
    };
    return names[role] || role;
  },
  
  // Status display
  getStatusText(status) {
    const texts = {
      'pending_supervisor': '待主管审批',
      'pending_finance': '待财务审批',
      'pending_shareholder': '待股东审批',
      'approved': '已通过',
      'rejected': '已拒绝'
    };
    return texts[status] || status;
  },
  
  isPendingStatus(status) {
    return status && status.startsWith('pending_');
  },
  
  // Toast notification
  showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  },
  
  // Confirm dialog
  confirm(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const msg = document.getElementById('confirmMessage');
      const okBtn = document.getElementById('confirmOk');
      const cancelBtn = document.getElementById('confirmCancel');
      
      msg.textContent = message;
      modal.style.display = 'flex';
      
      const cleanup = () => {
        modal.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
      };
      
      const onOk = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };
      
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
    });
  },
  
  // Image preview
  showImage(url) {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('imagePreview');
    const close = document.getElementById('imageClose');
    
    img.src = url;
    modal.style.display = 'flex';
    
    const cleanup = () => {
      modal.style.display = 'none';
      img.src = '';
      close.removeEventListener('click', cleanup);
      modal.removeEventListener('click', onOverlay);
    };
    
    const onOverlay = (e) => {
      if (e.target === modal) cleanup();
    };
    
    close.addEventListener('click', cleanup);
    modal.addEventListener('click', onOverlay);
  },
  
  // Loading state
  showLoading(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) container = document.getElementById('appMain');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>加载中...</p></div>';
  },
  
  // Create element helper
  el(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') element.className = val;
      else if (key === 'textContent') element.textContent = val;
      else if (key === 'innerHTML') element.innerHTML = val;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), val);
      else if (key === 'style' && typeof val === 'object') Object.assign(element.style, val);
      else element.setAttribute(key, val);
    }
    for (const child of children) {
      if (typeof child === 'string') element.appendChild(document.createTextNode(child));
      else if (child) element.appendChild(child);
    }
    return element;
  }
};
