const express = require('express');
const { get, all } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Dashboard stats
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    // Monthly totals
    const monthly = get(
      `SELECT 
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as month_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as month_expense
       FROM transactions WHERE created_at >= ?`,
      [monthStart]
    );
    
    // Total all time
    const total = get(
      `SELECT 
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as total_expense
       FROM transactions`
    );
    
    // Pending requests count
    let pendingCount = 0;
    const role = req.session.role;
    if (role === 'supervisor' || role === 'admin') {
      pendingCount += get("SELECT COUNT(*) as c FROM purchase_requests WHERE status = 'pending_supervisor'").c;
    }
    if (role === 'finance' || role === 'admin') {
      pendingCount += get("SELECT COUNT(*) as c FROM purchase_requests WHERE status = 'pending_finance'").c;
    }
    if (role === 'shareholder' || role === 'admin') {
      pendingCount += get("SELECT COUNT(*) as c FROM purchase_requests WHERE status = 'pending_shareholder'").c;
    }
    
    // Recent transactions
    const recent = all(
      `SELECT t.*, u.real_name as creator_name 
       FROM transactions t LEFT JOIN users u ON t.created_by = u.id 
       ORDER BY t.created_at DESC LIMIT 10`
    );
    
    res.json({
      monthly: {
        income: monthly.month_income,
        expense: monthly.month_expense,
        profit: monthly.month_income - monthly.month_expense
      },
      total: {
        income: total.total_income,
        expense: total.total_expense,
        profit: total.total_income - total.total_expense
      },
      pendingCount,
      recent
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Category breakdown for current month
router.get('/categories', authMiddleware, (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    const expenseCategories = all(
      `SELECT category, SUM(amount) as total, COUNT(*) as count 
       FROM transactions WHERE type = 'expense' AND created_at >= ? 
       GROUP BY category ORDER BY total DESC`,
      [monthStart]
    );
    
    const incomeCategories = all(
      `SELECT category, SUM(amount) as total, COUNT(*) as count 
       FROM transactions WHERE type = 'income' AND created_at >= ? 
       GROUP BY category ORDER BY total DESC`,
      [monthStart]
    );
    
    // Daily totals for the month (for chart)
    const daily = all(
      `SELECT date(created_at) as date, 
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
       FROM transactions WHERE created_at >= ? 
       GROUP BY date(created_at) ORDER BY date`,
      [monthStart]
    );
    
    res.json({ expenseCategories, incomeCategories, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
