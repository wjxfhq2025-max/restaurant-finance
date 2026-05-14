const express = require('express');
const { get, all } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ========== 财务报表 ==========

// 收支汇总报表
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    
    if (startDate) { where += ` AND created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { where += ` AND created_at <= $${idx++}`; params.push(endDate + ' 23:59:59'); }
    if (type) { where += ` AND type = $${idx++}`; params.push(type); }
    
    // 总体汇总
    const summary = await get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as total_expense,
        COUNT(*) as total_count,
        COUNT(CASE WHEN type='income' THEN 1 END) as income_count,
        COUNT(CASE WHEN type='expense' THEN 1 END) as expense_count
      FROM transactions ${where}
    `, params);
    
    // 按月统计
    const monthly = await all(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense,
        COUNT(*) as count
      FROM transactions ${where}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 24
    `, params);
    
    res.json({
      summary: {
        totalIncome: Number(summary?.total_income || 0),
        totalExpense: Number(summary?.total_expense || 0),
        profit: Number(summary?.total_income || 0) - Number(summary?.total_expense || 0),
        totalCount: Number(summary?.total_count || 0),
        incomeCount: Number(summary?.income_count || 0),
        expenseCount: Number(summary?.expense_count || 0)
      },
      monthly: monthly || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 分类统计报表
router.get('/by-category', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    
    if (startDate) { where += ` AND created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { where += ` AND created_at <= $${idx++}`; params.push(endDate + ' 23:59:59'); }
    if (type) { where += ` AND type = $${idx++}`; params.push(type); }
    
    const categories = await all(`
      SELECT 
        category,
        type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total,
        COALESCE(AVG(amount), 0) as avg_amount,
        COALESCE(MIN(amount), 0) as min_amount,
        COALESCE(MAX(amount), 0) as max_amount
      FROM transactions ${where}
      GROUP BY category, type
      ORDER BY total DESC
    `, params);
    
    res.json({ categories: categories || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 采购申请报表
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    
    if (startDate) { where += ` AND r.created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { where += ` AND r.created_at <= $${idx++}`; params.push(endDate + ' 23:59:59'); }
    if (status === 'pending') { where += ` AND r.status LIKE 'pending%'`; }
    else if (status) { where += ` AND r.status = $${idx++}`; params.push(status); }
    
    const requests = await all(`
      SELECT r.*, u.real_name as applicant_name
      FROM purchase_requests r
      JOIN users u ON r.applicant_id = u.id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT 200
    `, params);
    
    const summary = await get(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status LIKE 'pending%' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount
      FROM purchase_requests r ${where}
    `, params);
    
    res.json({
      requests: requests || [],
      summary: {
        total: Number(summary?.total || 0),
        pending: Number(summary?.pending || 0),
        approved: Number(summary?.approved || 0),
        rejected: Number(summary?.rejected || 0),
        totalAmount: Number(summary?.total_amount || 0),
        approvedAmount: Number(summary?.approved_amount || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 导出 CSV
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { reportType, startDate, endDate, type } = req.query;
    
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    
    if (startDate) { where += ` AND created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { where += ` AND created_at <= $${idx++}`; params.push(endDate + ' 23:59:59'); }
    if (type) { where += ` AND type = $${idx++}`; params.push(type); }
    
    let rows, filename, headers;
    
    if (reportType === 'requests') {
      // 采购申请报表
      let reqWhere = where.replace('created_at', 'r.created_at');
      rows = await all(`
        SELECT r.id, r.title, r.amount, r.category, r.status, r.description,
               u.real_name as applicant_name, r.created_at, r.updated_at
        FROM purchase_requests r
        JOIN users u ON r.applicant_id = u.id
        ${reqWhere}
        ORDER BY r.created_at DESC
      `, params);
      
      headers = ['ID', '标题', '金额', '分类', '状态', '描述', '申请人', '创建时间', '更新时间'];
      filename = `采购申请报表_${startDate || '全时期'}_${endDate || '至今'}.csv`;
      
    } else if (reportType === 'category') {
      // 分类统计报表
      rows = await all(`
        SELECT category, type, COUNT(*) as count,
               COALESCE(SUM(amount), 0) as total,
               COALESCE(AVG(amount), 0) as avg_amount
        FROM transactions ${where}
        GROUP BY category, type ORDER BY total DESC
      `, params);
      
      headers = ['分类', '类型', '笔数', '总金额', '平均金额'];
      filename = `分类统计报表_${startDate || '全时期'}_${endDate || '至今'}.csv`;
      
    } else {
      // 收支明细报表（默认）
      rows = await all(`
        SELECT t.id, t.type, t.category, t.amount, t.description,
               u.username as creator, t.created_at
        FROM transactions t
        LEFT JOIN users u ON t.created_by = u.id
        ${where}
        ORDER BY t.created_at DESC
        LIMIT 5000
      `, params);
      
      headers = ['ID', '类型', '分类', '金额', '描述', '创建人', '创建时间'];
      filename = `收支明细报表_${startDate || '全时期'}_${endDate || '至今'}.csv`;
    }
    
    // 生成 CSV
    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    
    const csvLines = [headers.join(',')];
    for (const row of (rows || [])) {
      const vals = Object.values(row).map(escape);
      csvLines.push(vals.join(','));
    }
    
    const csv = '\uFEFF' + csvLines.join('\r\n'); // BOM for Excel UTF-8
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(csv);
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
