// Profile page
const ProfilePage = {
  async render(container) {
    Utils.showLoading(container);
    
    try {
      const user = await API.getMe();
      window.__currentUser = user;
      this.renderContent(container, user);
    } catch (err) {
      App.navigate('/login');
    }
  },
  
  renderContent(container, user) {
    const isAdmin = user.role === 'admin';
    
    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${user.real_name ? user.real_name[0] : user.username[0]}</div>
        <div class="profile-name">${user.real_name || user.username}</div>
        <div class="profile-role">${Utils.getRoleName(user.role)}</div>
      </div>
      
      <div class="menu-list" style="margin-top:8px;">
        ${isAdmin ? `
        <div class="menu-item" onclick="ProfilePage.showUserManager()">
          <span class="menu-icon">👥</span>
          <span>用户管理</span>
          <span class="menu-arrow">›</span>
        </div>
        ` : ''}
        <div class="menu-item" onclick="ProfilePage.showChangePassword()">
          <span class="menu-icon">🔑</span>
          <span>修改密码</span>
          <span class="menu-arrow">›</span>
        </div>
        <div class="menu-item" onclick="ProfilePage.showAbout()">
          <span class="menu-icon">ℹ️</span>
          <span>关于系统</span>
          <span class="menu-arrow">›</span>
        </div>
      </div>
      
      <div style="margin-top:24px;padding:0 16px;">
        <button class="btn btn-danger" onclick="ProfilePage.logout()" style="width:100%;">
          退出登录
        </button>
      </div>
      
      <div id="changePwdForm" style="display:none;margin-top:16px;" class="card">
        <div class="card-title">修改密码</div>
        <form id="pwdForm">
          <div class="form-group">
            <label class="form-label">原密码</label>
            <input type="password" class="form-input" id="oldPwd" required>
          </div>
          <div class="form-group">
            <label class="form-label">新密码</label>
            <input type="password" class="form-input" id="newPwd" required minlength="6">
          </div>
          <div class="form-group">
            <label class="form-label">确认新密码</label>
            <input type="password" class="form-input" id="confirmPwd" required minlength="6">
          </div>
          <div class="form-group" style="display:flex;gap:8px;">
            <button type="submit" class="btn btn-primary" style="flex:1;">确认修改</button>
            <button type="button" class="btn btn-default" onclick="ProfilePage.hideChangePassword()" style="flex:1;">取消</button>
          </div>
        </form>
      </div>
      
      <!-- User Manager Modal -->
      <div id="userManagerModal" class="modal-overlay" style="display:none;">
        <div class="modal-box" style="max-width:500px;max-height:85vh;overflow-y:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;font-size:16px;">👥 用户管理</h3>
            <button onclick="ProfilePage.hideUserManager()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
          </div>
          <div id="userManagerContent">
            <div style="text-align:center;padding:20px;color:var(--text-muted);">加载中...</div>
          </div>
        </div>
      </div>
    `;
    
    // Bind password change form
    const pwdForm = document.getElementById('pwdForm');
    if (pwdForm) {
      pwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPwd = document.getElementById('oldPwd').value;
        const newPwd = document.getElementById('newPwd').value;
        const confirmPwd = document.getElementById('confirmPwd').value;
        
        if (newPwd !== confirmPwd) {
          Utils.showToast('两次输入的新密码不一致');
          return;
        }
        if (newPwd.length < 6) {
          Utils.showToast('新密码至少6位');
          return;
        }
        
        try {
          await API.request('PUT', '/users/me/password', { oldPassword: oldPwd, newPassword: newPwd });
          Utils.showToast('密码修改成功，请重新登录');
          setTimeout(() => ProfilePage.logout(), 1000);
        } catch (err) {
          Utils.showToast(err.message);
        }
      });
    }
  },
  
  showChangePassword() {
    document.getElementById('changePwdForm').style.display = 'block';
  },
  
  hideChangePassword() {
    document.getElementById('changePwdForm').style.display = 'none';
  },
  
  showAbout() {
    alert('餐饮店财务管理系统 v1.0\n\n功能：收支记录、采购审批、数据统计\n\n技术支持：QClaw');
  },
  
  // ===== User Management =====
  async showUserManager() {
    document.getElementById('userManagerModal').style.display = 'flex';
    await this.loadUserList();
  },
  
  hideUserManager() {
    document.getElementById('userManagerModal').style.display = 'none';
  },
  
  async loadUserList() {
    const content = document.getElementById('userManagerContent');
    try {
      const users = await API.request('GET', '/users');
      const currentUser = window.__currentUser;
      
      const roleOptions = [
        { value: 'admin', label: '管理员' },
        { value: 'purchaser', label: '采购员' },
        { value: 'supervisor', label: '主管' },
        { value: 'finance', label: '财务' },
        { value: 'shareholder', label: '股东' }
      ];
      
      const roleSelect = (selected, id) => {
        return `<select id="role-${id}" style="padding:4px 8px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;">
          ${roleOptions.map(r => `<option value="${r.value}" ${r.value === selected ? 'selected' : ''}>${r.label}</option>`).join('')}
        </select>`;
      };
      
      const rows = (users || []).map(u => `
        <tr>
          <td style="padding:8px 4px;font-size:13px;">
            <div style="font-weight:600;">${u.real_name || u.username}</div>
            <div style="color:var(--text-muted);font-size:11px;">@${u.username}</div>
          </td>
          <td style="padding:8px 4px;">${roleSelect(u.role, u.id)}</td>
          <td style="padding:8px 4px;">
            ${u.id !== currentUser.id ? `
              <button class="btn btn-default btn-sm" onclick="ProfilePage.updateUser(${u.id})" style="padding:4px 8px;font-size:11px;">💾</button>
              <button class="btn btn-danger btn-sm" onclick="ProfilePage.deleteUser(${u.id}, '${u.username}')" style="padding:4px 8px;font-size:11px;margin-left:4px;">🗑️</button>
            ` : '<span style="color:var(--text-muted);font-size:11px;">当前</span>'}
          </td>
        </tr>
      `).join('');
      
      content.innerHTML = `
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color);">
              <th style="text-align:left;padding:6px 4px;font-size:12px;color:var(--text-muted);">用户</th>
              <th style="text-align:left;padding:6px 4px;font-size:12px;color:var(--text-muted);">角色</th>
              <th style="text-align:left;padding:6px 4px;font-size:12px;color:var(--text-muted);">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        
        <div style="border-top:1px solid var(--border-color);padding-top:12px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">➕ 添加新用户</div>
          <div style="display:grid;gap:8px;">
            <input type="text" id="newUsername" placeholder="用户名" class="form-input" style="font-size:13px;padding:8px;">
            <input type="password" id="newPassword" placeholder="初始密码" class="form-input" style="font-size:13px;padding:8px;">
            <input type="text" id="newRealName" placeholder="姓名（如：李明）" class="form-input" style="font-size:13px;padding:8px;">
            <select id="newRole" class="form-select" style="font-size:13px;padding:8px;">
              ${roleOptions.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
            </select>
            <button class="btn btn-primary" onclick="ProfilePage.addUser()" style="padding:10px;font-size:14px;">创建用户</button>
          </div>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div style="color:#f87171;text-align:center;padding:20px;">加载失败: ${err.message}</div>`;
    }
  },
  
  async addUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const real_name = document.getElementById('newRealName').value.trim();
    const role = document.getElementById('newRole').value;
    
    if (!username || !password) {
      Utils.showToast('用户名和密码不能为空');
      return;
    }
    if (password.length < 6) {
      Utils.showToast('密码至少6位');
      return;
    }
    
    try {
      await API.request('POST', '/users', { username, password, real_name, role });
      Utils.showToast('✅ 用户创建成功');
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newRealName').value = '';
      await this.loadUserList();
    } catch (err) {
      Utils.showToast(err.message);
    }
  },
  
  async updateUser(id) {
    const role = document.getElementById('role-' + id).value;
    try {
      await API.request('PUT', `/users/${id}`, { role });
      Utils.showToast('✅ 角色更新成功');
    } catch (err) {
      Utils.showToast(err.message);
    }
  },
  
  async deleteUser(id, username) {
    const confirmed = await Utils.confirm(`确认删除用户 "${username}"？此操作不可恢复。`);
    if (!confirmed) return;
    
    try {
      await API.request('DELETE', `/users/${id}`);
      Utils.showToast('✅ 用户已删除');
      await this.loadUserList();
    } catch (err) {
      Utils.showToast(err.message);
    }
  },
  
  async logout() {
    const confirmed = await Utils.confirm('确认退出登录？');
    if (!confirmed) return;
    
    try {
      await API.logout();
      window.__currentUser = null;
      App.navigate('/login');
    } catch (err) {
      Utils.showToast('退出失败: ' + err.message);
    }
  }
};
