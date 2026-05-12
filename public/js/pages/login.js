// Login page
const LoginPage = {
  render(container) {
    container.innerHTML = `
      <div class="login-page">
        <div class="login-logo">🍽️</div>
        <h2 class="login-title">餐饮店财务管理</h2>
        <p class="login-subtitle">安全、便捷的收支管理系统</p>
        <form class="login-form" id="loginForm">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input type="text" class="form-input" id="loginUsername" placeholder="请输入用户名" autocomplete="username" required>
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="password" class="form-input" id="loginPassword" placeholder="请输入密码" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:8px;">登 录</button>
        </form>
      </div>
    `;
    
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      
      if (!username || !password) {
        Utils.showToast('请输入用户名和密码');
        return;
      }
      
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = '登录中...';
      
      try {
        await API.login(username, password);
        Utils.showToast('登录成功');
        App.navigate('/home');
      } catch (err) {
        Utils.showToast(err.message);
        btn.disabled = false;
        btn.textContent = '登 录';
      }
    });
  }
};
