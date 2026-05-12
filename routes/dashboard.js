const express = require('express');
const { get, all } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Dashboard stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    // Monthly totals
    const monthly = await get(
      `SELECT 
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as month_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as month_expense
       FROM transactions WHERE created_at >= $1`,
      [monthStart]
    );
    
    // Total all time
    const total = await get(
      `SELECT 
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as total_expense
       FROM transactions`
    );
    
    // Pending requests count
    let pendingCount = 0;
    const role = req.session.role;
    if (role === 'supervisor' || role === 'admin') {
      pendingCount += (await get("SELECT COUNT(*) as c FROM purchase_requests WHERE status = 'pending_supervisor'")).c;
    }
    if (role === 'finance' || role === 'admin') {
      pendingCount += (await get("SELECT COUNT(*) as c FROM purchase_requests WHERE status = 'pending_finance'")).c;
    }
    if (role === 'shareholder' || role === 'admin') {
      pendingCount += (await get("SELECT COUNT(*) as c FROM purchase_requests WHERE status = 'pending_shareholder'")).c;
    }
    
    // Recent transactions
    const recent = await all(
      `SELECT t.*, u.real_name as creator_name 
       FROM transactions t LEFT JOIN users u ON t.created_by = u.id 
       ORDER BY t.created_at DESC LIMIT 10`
    );
    
    res.json({
      monthly: {
        income: Number(monthly.month_income),
        expense: Number(monthly.month_expense),
        profit: Number(monthly.month_income) - Number(monthly.month_expense)
      },
      total: {
        income: Number(total.total_income),
        expense: Number(total.total_expense),
        profit: Number(total.total_income) - Number(total.total_expense)
      },
      pendingCount,
      recent
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Category breakdown for current month
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    const expenseCategories = await all(
      `SELECT category, SUM(amount) as total, COUNT(*) as count 
       FROM transactions WHERE type = 'expense' AND created_at >= $1 
       GROUP BY category ORDER BY total DESC`,
      [monthStart]
    );
    
    const incomeCategories = await all(
      `SELECT category, SUM(amount) as total, COUNT(*) as count 
       FROM transactions WHERE type = 'income' AND created_at >= $1 
       GROUP BY category ORDER BY total DESC`,
      [monthStart]
    );
    
    // Daily totals for the month (for chart)
    const daily = await all(
      `SELECT date(created_at) as date, 
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
       FROM transactions WHERE created_at >= $1 
       GROUP BY date(created_at) ORDER BY date`,
      [monthStart]
    );
    
    res.json({ expenseCategories, incomeCategories, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
