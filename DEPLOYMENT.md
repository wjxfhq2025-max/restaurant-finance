# 餐饮店财务管理系统 - Render.com 部署指南

## 当前状态

✅ 代码已修复（数据库兼容性问题已解决）
✅ Git 已安装 (v2.54.0)
✅ GitHub CLI 已安装 (v2.92.0)
✅ Git 仓库已初始化并提交 (29 个文件)
✅ `.gitignore` 已创建
✅ `render.yaml` 已创建

❌ 尚未登录 GitHub（需要你手动操作）

---

## 第一步：登录 GitHub

在 PowerShell 中运行：

```powershell
gh auth login
```

然后按以下步骤选择：

1. **What account do you want to log into?** → 选择 `GitHub.com`
2. **What is your preferred protocol for Git operations?** → 选择 `HTTPS`
3. **Authenticate Git with your GitHub token?** → 选择 `Yes`
4. **How would you like to authenticate GitHub CLI?** → 选择 `Login with a web browser`
5. 浏览器会打开，输入显示的一次性代码
6. 授权 GitHub CLI

---

## 第二步：创建 GitHub 仓库并推送

登录成功后，运行：

```powershell
cd C:\Users\Linda\.qclaw\workspace\restaurant-finance
gh repo create restaurant-finance --public --source=. --remote=origin --push
```

这会创建一个名为 `restaurant-finance` 的公开仓库并推送代码。

---

## 第三步：在 Render.com 创建 Web Service

1. 打开浏览器，访问 **https://render.com**
2. 点击 **Sign Up**（可以用 GitHub 账号直接登录）
3. 登录后，点击 **New** → **Web Service**
4. 点击 **Connect a repository**
5. 授权 Render 访问你的 GitHub（首次需要）
6. 选择 `restaurant-finance` 仓库

---

## 第四步：配置部署参数

| 设置项 | 值 |
|--------|-----|
| **Name** | `restaurant-finance` |
| **Region** | Oregon (US West) 或 Singapore |
| **Branch** | `main` 或 `master` |
| **Root Directory** | （留空） |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node seed.js && node server.js` |
| **Plan** | **Free** |

---

## 第五步：添加环境变量（可选）

在 **Environment Variables** 部分：

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |

---

## 第六步：部署

1. 点击 **Deploy Web Service**
2. 等待几分钟，构建完成后会显示部署日志
3. 成功后会给你一个域名，如：`https://restaurant-finance.onrender.com`

---

## 默认账号

系统会自动创建以下测试账号（在 `seed.js` 中定义）：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| supervisor | super123 | 主管 |
| finance | finance123 | 财务 |
| shareholder | share123 | 股东 |
| purchaser | purchase123 | 采购员 |

**⚠️ 上线后请立即修改所有默认密码！**

---

## 免费版限制

- 每月 750 小时免费
- 15分钟无访问会休眠（首次访问需等几秒唤醒）
- 512MB 内存
- 适合小型团队使用

---

## 如需帮助

如果在部署过程中遇到问题，请告诉我具体的错误信息。
