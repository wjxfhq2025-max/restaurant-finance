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
      actions = `<div class="header-actions">
        <span style="font-size:14px;opacity:0.9;">${user.real_name || user.username}</span>
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
    
    // Initial route
    await this.router();
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
