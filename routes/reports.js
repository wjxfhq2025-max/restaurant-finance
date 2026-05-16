const express = require('express');
const archiver = require('archiver');
const https = require('https');
const http = require('http');
const { get, all } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ========== Financial Reports ==========

// Summary report
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (startDate) { where += ` AND created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { where += ` AND created_at <= $${idx++}`; params.push(endDate + ' 23:59:59'); }
    if (type) { where += ` AND type = $${idx++}`; params.push(type); }

    const summary = await get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as total_expense,
        COUNT(*) as total_count,
        COUNT(CASE WHEN type='income' THEN 1 END) as income_count,
        COUNT(CASE WHEN type='expense' THEN 1 END) as expense_count
      FROM transactions ${where}
    `, params);

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

    // Daily stats for selected period
    const daily = await all(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as date,
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense,
        COUNT(*) as count
      FROM transactions ${where}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY date DESC
      LIMIT 90
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
      monthly: monthly || [],
      daily: daily || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Category report
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

// Purchase request report
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

// Helper: download file from URL
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error('Download failed: ' + response.statusCode));
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject).on('timeout', function() {
      this.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// Helper: generate CSV string
function generateCSV(headers, rows) {
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const lines = [headers.join(',')];
  for (const row of (rows || [])) {
    lines.push(headers.map(h => escape(row[h] !== undefined ? row[h] : row[Object.keys(row)[headers.indexOf(h)]] || '')).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

// Export CSV (existing, unchanged)
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
      const reqParams = [...params];
      let reqIdx = 1;
      let reqWhere = 'WHERE 1=1';
      if (startDate) { reqWhere += ` AND r.created_at >= $${reqIdx++}`; }
      if (endDate) { reqWhere += ` AND r.created_at <= $${reqIdx++}`; }
      if (type) { reqWhere += ` AND r.type = $${reqIdx++}`; }
      rows = await all(`
        SELECT r.id, r.title, r.amount, r.category, r.status, r.description,
               u.real_name as applicant_name, r.created_at, r.updated_at
        FROM purchase_requests r
        JOIN users u ON r.applicant_id = u.id
        ${reqWhere}
        ORDER BY r.created_at DESC
      `, reqParams);
      filename = `采购申请报表_${startDate || '全时期'}_${endDate || '至今'}.csv`;
    } else if (reportType === 'category') {
      const catParams = [...params];
      let catIdx = 1;
      let catWhere = 'WHERE 1=1';
      if (startDate) { catWhere += ` AND created_at >= $${catIdx++}`; }
      if (endDate) { catWhere += ` AND created_at <= $${catIdx++}`; }
      if (type) { catWhere += ` AND type = $${catIdx++}`; }
      rows = await all(`
        SELECT category as "分类", type as "类型", count as "笔数",
               total as "总金额", avg_amount as "平均金额"
        FROM (
          SELECT category, type, COUNT(*) as count,
                 COALESCE(SUM(amount), 0) as total,
                 COALESCE(AVG(amount), 0) as avg_amount
          FROM transactions ${catWhere}
          GROUP BY category, type
        ) sub ORDER BY total DESC
      `, catParams);
      headers = ['分类', '类型', '笔数', '总金额', '平均金额'];
      filename = `分类统计报表_${startDate || '全时期'}_${endDate || '至今'}.csv`;
    } else {
      const txParams = [...params];
      let txIdx = 1;
      let txWhere = 'WHERE 1=1';
      if (startDate) { txWhere += ` AND t.created_at >= $${txIdx++}`; }
      if (endDate) { txWhere += ` AND t.created_at <= $${txIdx++}`; }
      if (type) { txWhere += ` AND t.type = $${txIdx++}`; }
      rows = await all(`
        SELECT t.id, t.type, t.category, t.amount, t.description,
               u.username as creator, t.receipt_path, t.created_at
        FROM transactions t
        LEFT JOIN users u ON t.created_by = u.id
        ${txWhere}
        ORDER BY t.created_at DESC
        LIMIT 5000
      `, txParams);
      headers = ['ID', '类型', '分类', '金额', '描述', '创建人', '票据链接', '创建时间'];
      filename = `收支明细报表_${startDate || '全时期'}_${endDate || '至今'}.csv`;
    }

    const csv = generateCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export ZIP with attachments
router.get('/export-zip', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (startDate) { where += ` AND created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { where += ` AND created_at <= $${idx++}`; params.push(endDate + ' 23:59:59'); }
    if (type) { where += ` AND type = $${idx++}`; params.push(type); }

    // Get transactions with receipts
    const txParams = [...params];
    let txIdx = 1;
    let txWhere = 'WHERE 1=1';
    if (startDate) { txWhere += ` AND t.created_at >= $${txIdx++}`; }
    if (endDate) { txWhere += ` AND t.created_at <= $${txIdx++}`; }
    if (type) { txWhere += ` AND t.type = $${txIdx++}`; }

    const rows = await all(`
      SELECT t.id, t.type, t.category, t.amount, t.description,
             u.username as creator, t.receipt_path, t.created_at
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      ${txWhere}
      ORDER BY t.created_at DESC
      LIMIT 1000
    `, txParams);

    const period = `${startDate || '全时期'}_${endDate || '至今'}`;
    const filename = `财务报表_${period}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    // Generate CSV
    const headers = ['ID', '类型', '分类', '金额', '描述', '创建人', '票据文件', '创建时间'];
    const csv = generateCSV(headers, rows);
    archive.append(csv, { name: '收支明细.csv' });

    // Download and add receipt images
    const receiptRows = (rows || []).filter(r => r.receipt_path);
    if (receiptRows.length > 0) {
      for (const row of receiptRows) {
        try {
          const imgBuffer = await downloadFile(row.receipt_path);
          const ext = row.receipt_path.split('.').pop().split('?')[0] || 'jpg';
          const safeCategory = (row.category || '其他').replace(/[\/\\:*?"<>|]/g, '_');
          const imgName = `${row.id}_${safeCategory}_${row.type}.${ext}`;
          archive.append(imgBuffer, { name: `票据图片/${imgName}` });
        } catch (err) {
          console.error(`Failed to download receipt for tx ${row.id}:`, err.message);
          // Add a placeholder text file
          archive.append(`票据下载失败: ${row.receipt_path}\n错误: ${err.message}`, {
            name: `票据图片/${row.id}_下载失败.txt`
          });
        }
      }
    }

    // Also export purchase requests
    const reqParams2 = [...params];
    let reqIdx2 = 1;
    let reqWhere2 = 'WHERE 1=1';
    if (startDate) { reqWhere2 += ` AND r.created_at >= $${reqIdx2++}`; }
    if (endDate) { reqWhere2 += ` AND r.created_at <= $${reqIdx2++}`; }
    const reqRows = await all(`
      SELECT r.id, r.title, r.amount, r.category, r.status, r.description,
             u.real_name as applicant_name, r.created_at, r.updated_at
      FROM purchase_requests r
      JOIN users u ON r.applicant_id = u.id
      ${reqWhere2}
      ORDER BY r.created_at DESC
      LIMIT 500
    `, reqParams2);
    const reqHeaders = ['ID', '标题', '金额', '分类', '状态', '描述', '申请人', '创建时间', '更新时间'];
    const reqCsv = generateCSV(reqHeaders, reqRows);
    archive.append(reqCsv, { name: '采购申请.csv' });

    await archive.finalize();
  } catch (err) {
    console.error('ZIP export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
