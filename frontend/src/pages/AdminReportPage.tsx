import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Report, ReportStatus, getMoodCss, getMoodEmoji } from '../api/types';

type Page = 'home' | 'login' | 'register' | 'post-detail' | 'create' | 'profile' | 'stats' | 'admin-reports';

interface Props {
  onNavigate: (page: Page, postId?: number) => void;
  onBack: () => void;
}

const STATUS_FILTERS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'resolved', label: '已处理' },
  { value: 'rejected', label: '已驳回' },
];

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '待处理',
  resolved: '已处理',
  rejected: '已驳回',
};

export default function AdminReportPage({ onNavigate, onBack }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadReports();
  }, [page, statusFilter]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params: { page: number; status?: string } = { page };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await api.adminGetReports(params);
      setReports(data.reports);
      setTotal(data.total);
    } catch {
      // 忽略
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (report: Report) => {
    const postPreview = report.post_content
      ? `"${report.post_content.slice(0, 50)}..."`
      : '（该帖子已删除）';

    if (!confirm(`确定要将此举报标记为已处理吗？\n\n帖子内容：${postPreview}`)) return;

    setProcessingId(report.id);
    try {
      await api.adminResolveReport(report.id);
      alert('处理成功');
      loadReports();
    } catch (err: any) {
      alert(err.message || '处理失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (report: Report) => {
    if (!confirm('确定要驳回这个举报吗？这将驳回该帖子的所有举报。')) return;

    setProcessingId(report.id);
    try {
      await api.adminRejectReport(report.id);
      alert('举报已驳回');
      loadReports();
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="layout"><div className="loading">正在加载...</div></div>;
  }

  return (
    <div className="layout">
      <div className="page">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>

        <div className="page-header">
          <div>
            <div className="page-title">🚩 举报管理</div>
            <div className="page-description">处理用户举报的违规内容</div>
          </div>
        </div>

        <div className="filter-bar">
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.value}
              className={`filter-chip ${statusFilter === filter.value ? 'active' : ''}`}
              onClick={() => { setStatusFilter(filter.value); setPage(1); }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">暂无举报记录</div>
          </div>
        ) : (
          <>
            {reports.map(report => (
              <div key={report.id} className="report-card">
                <div className="report-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="report-reason-badge">{report.reason}</span>
                    {report.pending_report_count > 0 && (
                      <span className="report-count-badge">
                        {report.pending_report_count} 人举报
                      </span>
                    )}
                    <span className={`status-tag ${report.status}`}>
                      {STATUS_LABELS[report.status]}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {formatTime(report.created_at)}
                  </span>
                </div>

                {report.post_content ? (
                  <>
                    <div className="report-post-meta">
                      <span className={`mood-tag ${getMoodCss(report.post_mood!)}`}>
                        {getMoodEmoji(report.post_mood!)} {report.post_mood}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                        发布于 {formatTime(report.post_created_at!)}
                      </span>
                    </div>

                    <div className="report-post-content">
                      {report.post_content}
                    </div>
                  </>
                ) : (
                  <div className="report-post-content" style={{ background: '#fef2f2', color: '#991b1b' }}>
                    🗑️ 该帖子已被删除
                  </div>
                )}

                {report.description && (
                  <div className="report-description">
                    💬 举报人补充：{report.description}
                  </div>
                )}

                {report.status === 'pending' && report.post_content && (
                  <div className="report-actions">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleReject(report)}
                      disabled={processingId === report.id}
                    >
                      {processingId === report.id ? '...' : '驳回举报'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleResolve(report)}
                      disabled={processingId === report.id}
                    >
                      {processingId === report.id ? '...' : '删除帖子'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {total > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </button>
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--gray-500)', fontSize: 14 }}>
                  第 {page} 页 / 共 {Math.ceil(total / 20)} 页
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 20 >= total}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
