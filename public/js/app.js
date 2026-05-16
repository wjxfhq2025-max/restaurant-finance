// Main app router and initialization
const App = {
  currentPage: null,
  currentParams: null,
  
  routes: {
    '/login':       () => LoginPage.render(App.getMain()),
    '/home':       () => HomePage.render(App.getMain()),
    '/record':     (type) => RecordPage.render(App.getMain(), type || 'expense'),
    '/transactions': (action, id) => {
      if (action === 'detail' && id) {
        TransactionDetailPage.render(App.getMain(), id);
      } else {
        TransactionsPage.render(App.getMain());
      }
    },
    '/requests':   (action, id) => {
      if (action === 'detail' && id) {
        RequestsPage.render(App.getMain(), id);
      } else {
        RequestsPage.render(App.getMain());
      }
    },
    '/request-form': () => RequestFormPage.render(App.getMain()),
    '/profile':    () => ProfilePage.render(App.getMain()),
    '/approve':    (token) => ApprovePage.render(App.getMain(), token),
    '/reports':    () => ReportsPage.render(App.getMain()),
  },
  
  getMain() {
    return document.getElementById('appMain');
  },
  
  getHeader() {
    return document.getElementById('appHeader');
  },
  
  getNav() {
    return document.getElementById('bottomNav');
  },
  
  getCurrentParams() {
    return this.currentParams;
  },
  
  navigate(hash) {
    location.hash = hash;
  },
  
  parseHash(hash) {
    // Handle both '#/path' and '#/path/action/id' formats
    const cleaned = hash.replace('#', '');
    const parts = cleaned.split('/').filter(Boolean);
    const route = '/' + (parts[0] || 'home');
    const params = parts.slice(1);
    return { route, params };
  },
  
  async router() {
    const hash = location.hash || '#/home';
    
    // Special case: approve page (no auth check)
    if (hash.startsWith('#/approve/')) {
      const token = hash.replace('#/approve/', '');
      App.getNav().style.display = 'none';
      App.getHeader().innerHTML = '<h1>🍽️ 采购审批</h1>';
      ApprovePage.render(App.getMain(), token);
      return;
    }
    
    // Check auth for all other routes
    try {
      const user = await API.getMe();
      window.__currentUser = user;
      
      // Redirect to home if on login page
      if (hash === '#/login' || hash === '#/') {
        location.hash = '#/home';
        return;
      }
    } catch (err) {
      // Not logged in, redirect to login
      if (hash !== '#/login') {
        location.hash = '#/login';
        return;
      }
    }
    
    // Show nav and header for logged-in pages
    App.getNav().style.display = '';
    App.updateHeader();
    App.updateNav();
    
    // Route
    const { route, params } = this.parseHash(hash);
    const handler = this.routes[route];
    
    if (handler) {
      this.currentPage = route;
      this.currentParams = params.length > 0 ? { action: params[0], id: params[1] } : null;
      handler(...params);
    } else {
      location.hash = '#/home';
    }
  },
  
  updateHeader() {
    const hash = location.hash || '#/home';
    const header = App.getHeader();
    const user = window.__currentUser;
    
    let title = '🍽️ 餐饮店财务管理';
    if (hash.startsWith('#/home')) title = '🏠 首页';
    else if (hash.startsWith('#/record')) title = '📝 记账';
    else if (hash.startsWith('#/transactions')) title = '📊 收支记录';
    else if (hash.startsWith('#/requests')) title = '📋 采购申请';
    else if (hash.startsWith('#/request-form')) title = '📋 新建申请';
    else if (hash.startsWith('#/reports')) title = '📊 财务报表';
    else if (hash.startsWith('#/profile')) title = '👤 我的';
    
    let actions = '';
    if (user) {
      actions = `<div class="header-actions" style="position:relative;">
        <span style="font-size:14px;opacity:0.9;cursor:pointer;display:flex;align-items:center;gap:4px;" onclick="App.toggleUserMenu(event)" id="userMenuBtn">
          👤 ${user.real_name || user.username} ▾
        </span>
        <div id="userSwitchMenu" style="display:none;position:absolute;top:100%;right:0;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);min-width:140px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:4px 0;">
          <div class="user-switch-item" onclick="App.switchUserLogout()">🔄 切换账号</div>
          <div class="user-switch-item" onclick="App.switchUserLogout()" style="color:var(--expense);">🚪 退出登录</div>
        </div>
      </div>`;
    }
    
    header.innerHTML = `<h1>${title}</h1>${actions}`;
  },
  
  updateNav() {
    const hash = location.hash || '#/home';
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
      item.classList.remove('active');
      
      const href = item.getAttribute('href');
      if (href) {
        const page = href.replace('#/', '');
        const currentPage = hash.replace('#/', '').split('/')[0];
        if (page === currentPage) {
          item.classList.add('active');
        }
      }
    });
  },
  
  async init() {
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.router());
    // Close user menu on outside click
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('userSwitchMenu');
      const btn = document.getElementById('userMenuBtn');
      if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
    // Initial route
    await this.router();
  },

  toggleUserMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('userSwitchMenu');
    if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  },

  async switchUserLogout() {
    document.getElementById('userSwitchMenu').style.display = 'none';
    await API.logout();
    window.__currentUser = null;
    location.hash = '#/login';
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
