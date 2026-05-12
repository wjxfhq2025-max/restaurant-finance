// Profile page
const ProfilePage = {
  async render(container) {
    Utils.showLoading(container);
    
    try {
      const user = await API.getMe();
      window.__currentUser = user;
      this.renderContent(container, user);
    } catch (err) {
      // Not logged in, redirect to login
      App.navigate('/login');
    }
  },
  
  renderContent(container, user) {
    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${user.real_name ? user.real_name[0] : user.username[0]}</div>
        <div class="profile-name">${user.real_name || user.username}</div>
        <div class="profile-role">${Utils.getRoleName(user.role)}</div>
      </div>
      
      <div class="menu-list" style="margin-top:8px;">
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
