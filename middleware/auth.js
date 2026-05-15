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
    // Support multi-role: session.role can be comma-separated like "admin,shareholder"
    const userRoles = (req.session.role || '').split(',').map(r => r.trim());
    const hasRole = roles.some(r => userRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

function hasRole(userRole, role) {
  const roles = (userRole || '').split(',').map(r => r.trim());
  return roles.includes(role);
}

// Compatible aliases
const roleMiddleware = requireRole;

function optionalAuth(req, res, next) {
  next();
}

module.exports = { authMiddleware, requireRole, roleMiddleware, optionalAuth, hasRole };
