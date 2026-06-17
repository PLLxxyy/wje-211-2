import { Router, Response } from 'express';
import db from '../db';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 管理员删除帖子
router.delete('/posts/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(id);

    if (!post) {
      res.status(404).json({ error: '帖子不存在' });
      return;
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    res.json({ message: '帖子已删除' });
  } catch (err) {
    console.error('管理员删除帖子失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 管理员删除评论
router.delete('/comments/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(id);

    if (!comment) {
      res.status(404).json({ error: '评论不存在' });
      return;
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    res.json({ message: '评论已删除' });
  } catch (err) {
    console.error('管理员删除评论失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有帖子（管理员）
router.get('/posts', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const posts = db.prepare(`
      SELECT p.id, p.content, p.mood, p.created_at, p.user_id,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = (db.prepare('SELECT COUNT(*) as total FROM posts').get() as any).total;

    res.json({ posts, total, page, limit });
  } catch (err) {
    console.error('获取管理员帖子列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取举报列表（管理员）
router.get('/reports', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (status && ['pending', 'resolved', 'rejected'].includes(status)) {
      whereClause = 'WHERE r.status = ?';
      params.push(status);
    }

    const reports = db.prepare(`
      SELECT r.id, r.post_id, r.reason, r.description, r.status, r.created_at,
        p.content as post_content, p.mood as post_mood, p.created_at as post_created_at,
        (SELECT COUNT(*) FROM reports WHERE post_id = r.post_id AND status = 'pending') as pending_report_count
      FROM reports r
      JOIN posts p ON r.post_id = p.id
      ${whereClause}
      GROUP BY r.post_id
      ORDER BY pending_report_count DESC, r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const countQuery = `
      SELECT COUNT(DISTINCT post_id) as total FROM reports r
      ${whereClause}
    `;
    const total = status
      ? (db.prepare(countQuery).get(status) as any).total
      : (db.prepare(countQuery).get() as any).total;

    res.json({ reports, total, page, limit });
  } catch (err) {
    console.error('获取举报列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 处理举报 - 删除帖子（管理员）
router.post('/reports/:id/resolve', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const report = db.prepare('SELECT post_id FROM reports WHERE id = ?').get(id) as any;

    if (!report) {
      res.status(404).json({ error: '举报不存在' });
      return;
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(report.post_id);
    db.prepare("UPDATE reports SET status = 'resolved' WHERE post_id = ?").run(report.post_id);

    res.json({ message: '帖子已删除，举报已处理' });
  } catch (err) {
    console.error('处理举报失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 驳回举报（管理员）
router.post('/reports/:id/reject', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const report = db.prepare('SELECT post_id FROM reports WHERE id = ?').get(id) as any;

    if (!report) {
      res.status(404).json({ error: '举报不存在' });
      return;
    }

    db.prepare("UPDATE reports SET status = 'rejected' WHERE post_id = ?").run(report.post_id);

    res.json({ message: '举报已驳回' });
  } catch (err) {
    console.error('驳回举报失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;
