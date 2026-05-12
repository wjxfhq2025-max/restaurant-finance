# 🍽️ 餐饮店财务管理系统 - 项目说明

## 访问地址
http://localhost:3000

## 默认账号密码

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | admin | admin123 | 全部权限 |
| 采购员 | purchaser1 | purchase123 | 记账、提交采购申请 |
| 主管 | supervisor | super123 | 审批采购申请 |
| 财务 | finance | finance123 | 审批申请、管理账目 |
| 股东 | shareholder | share123 | 审批≥10000元的申请 |

登录后请在「我的」页面修改密码。

---

## 系统功能

### 1. 收支记录
- 支持收入（堂食/外卖/团购/饮品）和支出（食材/房租/水电/人工/物料/设备/其他）
- 每条记录可上传票据图片（拍照或相册选择）
- 记录自动按时间倒序排列

### 2. 采购申请（无票据采购）
流程：采购员提交 → 主管审批 → 财务审批 → (金额≥10000元时) 股东审批 → 自动入账

### 3. 审批方式（老年人友好设计）
- 审批人可通过微信分享的链接直接打开审批页面
- 页面只有「同意」「拒绝」两个超大按钮
- **无需登录、无需安装APP**，点链接即用

### 4. 数据看板
- 本月收入/支出/利润汇总
- 支出分类条形图
- 待审批事项提醒

---

## 技术说明

### 启动服务
```bash
cd C:\Users\Linda\.qclaw\workspace\restaurant-finance
node server.js
```

### 初始化数据库（首次运行或重置）
```bash
cd C:\Users\Linda\.qclaw\workspace\restaurant-finance
node seed.js
```

### 停止服务
Ctrl + C 或在任务管理器中结束 node 进程。

---

## 文件结构

```
restaurant-finance/
├── server.js              # 主服务入口
├── config.js              # 配置（端口、密钥等）
├── database.js            # SQLite 数据库初始化
├── seed.js               # 初始化默认用户
├── package.json          # 依赖配置
├── data/                 # 数据库文件目录
│   └── finance.db       # SQLite 数据库
├── uploads/              # 上传的票据图片
├── middleware/
│   └── auth.js           # 认证中间件
├── routes/
│   ├── auth.js           # 登录/登出
│   ├── transactions.js    # 收支记录 API
│   ├── requests.js       # 采购申请 API（含审批）
│   ├── dashboard.js      # 数据看板 API
│   └── users.js         # 用户管理 API
└── public/
    ├── index.html        # SPA 入口
    ├── css/style.css     # 样式（大字体、大按钮）
    └── js/
        ├── api.js              # API 调用封装
        ├── utils.js            # 工具函数
        ├── app.js              # SPA 路由
        └── pages/
            ├── login.js        # 登录页
            ├── home.js         # 首页看板
            ├── record.js       # 记账页
            ├── transactions.js  # 收支记录列表
            ├── requests.js     # 采购申请列表
            ├── request-form.js # 新建采购申请
            ├── request-detail.js # 申请详情/审批
            ├── approve.js      # 独立审批页（股东用）
            └── profile.js      # 个人中心
```

---

## 注意事项

1. **数据库文件**：`data/finance.db` 是 SQLite 数据库文件，请定期备份
2. **上传文件**：票据图片存在 `uploads/` 目录，建议定期归档
3. **端口**：默认 3000，可在 `config.js` 中修改 `port`
4. **会话**：登录会话有效期 24 小时，过期需重新登录
5. **审批链接**：有效期 7 天，过期后需重新生成

---

*系统由 QClaw AI 助手自动生成，2026-05-12*
