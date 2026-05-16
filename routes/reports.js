const express = require('express');
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
const MAX_DOWNLOAD_SIZE = 5 * 1024 * 1024;
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    let totalSize = 0;
    const req = mod.get(url, { timeout: 10000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error('Download failed: ' + response.statusCode));
      }
      const chunks = [];
      response.on('data', chunk => {
        totalSize += chunk.length;
        if (totalSize > MAX_DOWNLOAD_SIZE) {
          req.destroy();
          return reject(new Error('Image too large'));
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', function() { this.destroy(); reject(new Error('Download timeout')); });
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

// Export CSV
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
      headers = ['ID', '标题', '金额', '分类', '状态', '描述', '申请人', '创建时间', '更新时间'];
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

// Export single HTML report with inline receipt images (base64 embedded)
router.get('/export-report', authMiddleware, async (req, res) => {
  req.setTimeout(180000);

  try {
    const { startDate, endDate, type } = req.query;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (startDate) { where += ` AND created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { where += ` AND created_at <= $${idx++}`; params.push(endDate + ' 23:59:59'); }
    if (type) { where += ` AND type = $${idx++}`; params.push(type); }

    // Get transactions
    const txParams = [...params];
    let txIdx = 1;
    let txWhere = 'WHERE 1=1';
    if (startDate) { txWhere += ` AND t.created_at >= $${txIdx++}`; }
    if (endDate) { txWhere += ` AND t.created_at <= $${txIdx++}`; }
    if (type) { txWhere += ` AND t.type = $${txIdx++}`; }

    const rows = await all(`
      SELECT t.id, t.type, t.category, t.amount, t.description,
             u.real_name as creator, t.receipt_path, t.created_at
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      ${txWhere}
      ORDER BY t.created_at DESC
      LIMIT 500
    `, txParams);

    // Get purchase requests
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

    // Download receipt images as base64
    const receiptRows = (rows || []).filter(r => r.receipt_path);
    const maxImages = Math.min(receiptRows.length, 30);
    for (let i = 0; i < maxImages; i++) {
      const row = receiptRows[i];
      try {
        const imgBuffer = await downloadFile(row.receipt_path);
        const ext = (row.receipt_path.split('.').pop().split('?')[0] || 'jpg').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        row._receiptBase64 = `data:${mime};base64,${imgBuffer.toString('base64')}`;
      } catch (err) {
        console.error(`Receipt download failed for tx ${row.id}:`, err.message);
        row._receiptBase64 = null;
      }
      if (i < maxImages - 1) await new Promise(r => setTimeout(r, 150));
    }

    // Summary
    const totalIncome = rows.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalExpense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0);
    const fmt = (n) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2 });

    // Build HTML
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>财务报表 ${startDate || ''} ~ ${endDate || ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,"Microsoft YaHei",sans-serif;padding:24px;color:#333;background:#f5f5f5}
  .hdr{text-align:center;margin-bottom:24px;background:#fff;padding:20px;border-radius:8px}
  .hdr h1{font-size:22px;margin-bottom:8px}
  .hdr .period{color:#888;font-size:14px}
  .summary{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}
  .s-card{flex:1;min-width:150px;background:#fff;padding:16px;border-radius:8px;text-align:center}
  .s-card .lb{font-size:13px;color:#888;margin-bottom:4px}
  .s-card .vl{font-size:24px;font-weight:bold}
  .inc{color:#52c41a}.exp{color:#ff4d4f}.pft{color:#1890ff}
  .stitle{font-size:16px;font-weight:bold;margin:20px 0 12px;padding-left:8px;border-left:4px solid #1890ff}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;margin-bottom:24px}
  th{background:#fafafa;padding:10px 12px;text-align:left;font-size:13px;color:#666;border-bottom:2px solid #e8e8e8}
  td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;vertical-align:top}
  tr:hover{background:#fafafa}
  .t-inc{color:#52c41a}.t-exp{color:#ff4d4f}
  .amt{text-align:right;font-weight:bold;font-variant-numeric:tabular-nums}
  .rcpt img{max-width:80px;max-height:80px;border-radius:4px;cursor:pointer;border:1px solid #e8e8e8;transition:all .2s}
  .rcpt img:hover{max-width:400px;max-height:400px;box-shadow:0 4px 16px rgba(0,0,0,.15)}
  .st-pending{color:#faad14}.st-approved{color:#52c41a}.st-rejected{color:#ff4d4f}
  .ft{text-align:center;color:#aaa;font-size:12px;margin-top:24px}
  .warn{color:#faad14;font-size:13px;margin-bottom:12px}
  @media print{body{background:#fff;padding:12px}.rcpt img{max-width:60px;max-height:60px}}
</style>
</head>
<body>
<div class="hdr">
  <h1>📊 餐厅财务报表</h1>
  <div class="period">${startDate || '起始'} ~ ${endDate || '至今'} · 共 ${rows.length} 条收支记录</div>
</div>
<div class="summary">
  <div class="s-card"><div class="lb">总收入</div><div class="vl inc">¥${fmt(totalIncome)}</div></div>
  <div class="s-card"><div class="lb">总支出</div><div class="vl exp">¥${fmt(totalExpense)}</div></div>
  <div class="s-card"><div class="lb">净利润</div><div class="vl pft">¥${fmt(totalIncome - totalExpense)}</div></div>
</div>
<div class="stitle">收支明细</div>
<table>
<thead><tr><th>#</th><th>日期</th><th>类型</th><th>分类</th><th>金额</th><th>描述</th><th>记录人</th><th>票据</th></tr></thead>
<tbody>`;

    rows.forEach((r, i) => {
      const ds = r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '-';
      const tc = r.type === 'income' ? 't-inc' : 't-exp';
      const tl = r.type === 'income' ? '收入' : '支出';
      const sign = r.type === 'income' ? '+' : '-';
      let rcpt = '<span style="color:#ccc">无</span>';
      if (r._receiptBase64) {
        rcpt = `<img src="${r._receiptBase64}" alt="票据" title="悬停放大">`;
      } else if (r.receipt_path) {
        rcpt = '<span style="color:#ff4d4f;font-size:12px">加载失败</span>';
      }
      html += `<tr><td>${i + 1}</td><td>${ds}</td><td class="${tc}">${tl}</td><td>${r.category || '-'}</td><td class="amt">${sign}¥${fmt(Number(r.amount || 0))}</td><td>${(r.description || '-').replace(/</g, '&lt;')}</td><td>${r.creator || '-'}</td><td class="rcpt">${rcpt}</td></tr>`;
    });

    html += `</tbody></table>
<div class="stitle">采购申请</div>
<table>
<thead><tr><th>#</th><th>日期</th><th>标题</th><th>金额</th><th>分类</th><th>状态</th><th>申请人</th><th>描述</th></tr></thead>
<tbody>`;

    const statusMap = { pending_supervisor: '待主管审批', pending_finance: '待财务审批', pending_shareholder: '待股东审批', approved: '已通过', rejected: '已驳回' };
    reqRows.forEach((r, i) => {
      const ds = r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '-';
      const sl = statusMap[r.status] || r.status;
      const sc = r.status.includes('pending') ? 'st-pending' : r.status === 'approved' ? 'st-approved' : 'st-rejected';
      html += `<tr><td>${i + 1}</td><td>${ds}</td><td>${r.title || '-'}</td><td class="amt">¥${fmt(Number(r.amount || 0))}</td><td>${r.category || '-'}</td><td class="${sc}">${sl}</td><td>${r.applicant_name || '-'}</td><td>${(r.description || '-').replace(/</g, '&lt;')}</td></tr>`;
    });

    html += `</tbody></table>`;
    if (receiptRows.length > maxImages) {
      html += `<div class="warn">⚠️ 共 ${receiptRows.length} 张票据，本次仅嵌入前 ${maxImages} 张，如需全部请缩小日期范围分批导出。</div>`;
    }
    html += `<div class="ft">导出时间: ${new Date().toLocaleString('zh-CN')} · 餐厅财务管理系统</div>\n</body></html>`;

    const filename = `财务报表_${startDate || '全部'}_${endDate || '至今'}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(html);
  } catch (err) {
    console.error('HTML report export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
