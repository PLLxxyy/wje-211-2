import { Router, Response } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const VALID_REASONS = ['色情低俗', '广告营销', '虚假信息', '违法违规', '辱骂攻击', '其他'];

router.post('/:postId', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const { reason, description } = req.body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      res.status(400).json({ error: '请选择有效的举报原因' });
      return;
    }

    if (description && description.length > 500) {
      res.status(400).json({ error: '补充说明不能超过500个字符' });
      return;
    }

    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      res.status(404).json({ error: '帖子不存在' });
      return;
    }

    if ((post as any).user_id === req.userId) {
      res.status(400).json({ error: '不能举报自己的帖子' });
      return;
    }

    const existingReport = db.prepare(
      'SELECT id FROM reports WHERE post_id = ? AND user_id = ?'
    ).get(postId, req.userId);
    if (existingReport) {
      res.status(400).json({ error: '您已经举报过这篇帖子了' });
      return;
    }

    db.prepare(
      'INSERT INTO reports (post_id, user_id, reason, description) VALUES (?, ?, ?, ?)'
    ).run(postId, req.userId, reason, description || null);

    res.json({ message: '举报成功，我们会尽快处理' });
  } catch (err) {
    console.error('举报失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/check/:postId', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const report = db.prepare(
      'SELECT id FROM reports WHERE post_id = ? AND user_id = ?'
    ).get(postId, req.userId);
    res.json({ reported: !!report });
  } catch (err) {
    console.error('检查举报状态失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;
