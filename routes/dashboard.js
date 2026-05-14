const express = require('express');
const { get, all } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Dashboard stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    const monthly = await get(
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as month_income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as month_expense
       FROM transactions WHERE created_at >= $1`,
      [monthStart]
    );
    
    const total = await get(
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as total_income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as total_expense
       FROM transactions`
    );
    
    const pendingCount = await get(`SELECT COUNT(*) as cnt FROM purchase_requests WHERE status LIKE 'pending%'`);
    const recentTrans = await all(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5`);
    
    const monthIncome = Number(monthly?.month_income || 0);
    const monthExpense = Number(monthly?.month_expense || 0);
    
    res.json({
      pendingCount: pendingCount?.cnt || 0,
      monthly: {
        income: monthIncome,
        expense: monthExpense,
        profit: monthIncome - monthExpense
      },
      total: {
        income: Number(total?.total_income || 0),
        expense: Number(total?.total_expense || 0)
      },
      recent: recentTrans || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard categories
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    const incomeCategories = await all(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE type='income' AND created_at >= $1
       GROUP BY category ORDER BY total DESC`,
      [monthStart]
    );
    
    const expenseCategories = await all(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE type='expense' AND created_at >= $1
       GROUP BY category ORDER BY total DESC`,
      [monthStart]
    );
    
    res.json({
      incomeCategories: incomeCategories || [],
      expenseCategories: expenseCategories || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
