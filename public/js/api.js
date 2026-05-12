// API wrapper
const API = {
  baseUrl: '/api',
  
  async request(method, path, data) {
    const opts = {
      method,
      headers: {},
      credentials: 'same-origin'
    };
    
    if (data instanceof FormData) {
      opts.body = data;
    } else if (data) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
    
    const res = await fetch(this.baseUrl + path, opts);
    const json = await res.json();
    
    if (!res.ok) {
      throw new Error(json.error || '请求失败');
    }
    
    return json;
  },
  
  // Auth
  login(username, password) {
    return this.request('POST', '/auth/login', { username, password });
  },
  
  logout() {
    return this.request('POST', '/auth/logout');
  },
  
  getMe() {
    return this.request('GET', '/auth/me');
  },
  
  // Transactions
  getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', '/transactions' + (query ? '?' + query : ''));
  },
  
  createTransaction(data) {
    return this.request('POST', '/transactions', data);
  },
  
  getTransaction(id) {
    return this.request('GET', '/transactions/' + id);
  },
  
  deleteTransaction(id) {
    return this.request('DELETE', '/transactions/' + id);
  },
  
  // Purchase Requests
  getRequests(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', '/requests' + (query ? '?' + query : ''));
  },
  
  getPendingRequests() {
    return this.request('GET', '/requests/pending/mine');
  },
  
  createRequest(data) {
    return this.request('POST', '/requests', data);
  },
  
  getRequest(id) {
    return this.request('GET', '/requests/' + id);
  },
  
  approveRequest(id, stage, comment) {
    return this.request('POST', '/requests/' + id + '/approve', { stage, comment });
  },
  
  rejectRequest(id, stage, reason) {
    return this.request('POST', '/requests/' + id + '/reject', { stage, reason });
  },
  
  // Public approval (no auth)
  getApprovalInfo(token) {
    return this.request('GET', '/requests/approve/' + token);
  },
  
  submitApproval(token, decision, comment) {
    return this.request('POST', '/requests/approve/' + token, { decision, comment });
  },
  
  // Dashboard
  getDashboardStats() {
    return this.request('GET', '/dashboard/stats');
  },
  
  getDashboardCategories() {
    return this.request('GET', '/dashboard/categories');
  },
  
  // Users
  getUsers() {
    return this.request('GET', '/users');
  },
  
  createUser(data) {
    return this.request('POST', '/users', data);
  }
};
