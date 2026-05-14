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
    
    const pendingCount = await get(`SELECT COUNT(*) as cnt FROM requests WHERE status='pending'`);
    const recentTrans = await all(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5`);
    
    res.json({
      monthIncome: monthly?.month_income || 0,
      monthExpense: monthly?.month_expense || 0,
      totalIncome: total?.total_income || 0,
      totalExpense: total?.total_expense || 0,
      pendingRequests: pendingCount?.cnt || 0,
      recentTransactions: recentTrans || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
