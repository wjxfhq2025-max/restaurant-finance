const express = require('express');
const session = require('express-session');

function authMiddleware(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: '请先登录' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '请先登录' });
    }
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

// 兼容别名
const roleMiddleware = requireRole;

function optionalAuth(req, res, next) {
  next();
}

module.exports = { authMiddleware, requireRole, roleMiddleware, optionalAuth };
