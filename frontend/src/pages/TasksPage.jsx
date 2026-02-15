import { useState, useEffect, useCallback } from 'react';
import TaskCard from '../components/TaskCard';
import useWebSocket from '../hooks/useWebSocket';
import { fetchTeams, fetchTasks } from '../api';

/** 任务管理页：列表/看板视图 + 筛选 */
export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'list'

  // 筛选状态
  const [filters, setFilters] = useState({ team: '', status: '' });

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasks(filters);
      setTasks(data);
    } catch (err) {
      console.error('加载任务失败:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTeams().then(setTeams).catch(() => {});
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useWebSocket((data) => {
    if (data.type === 'update') loadTasks();
  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setLoading(true);
  };

  // 按状态分组
  const tasksByStatus = {
    pending: tasks.filter((t) => t.status === 'pending'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    completed: tasks.filter((t) => t.status === 'completed'),
  };

  const statusLabel = { pending: '待办', in_progress: '进行中', completed: '已完成' };
  const statusDot = { pending: 'bg-amber-400', in_progress: 'bg-blue-400', completed: 'bg-emerald-400' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-200">任务管理</h2>
        {/* 视图切换 */}
        <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          <button
            onClick={() => setViewMode('board')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'board'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            看板
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            列表
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex gap-3">
        <select
          value={filters.team}
          onChange={(e) => handleFilterChange('team', e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">全部团队</option>
          {teams.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">全部状态</option>
          <option value="pending">待办</option>
          <option value="in_progress">进行中</option>
          <option value="completed">已完成</option>
        </select>
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-8">加载中...</div>
      ) : viewMode === 'board' ? (
        /* 看板视图 - 三列 */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['pending', 'in_progress', 'completed'].map((status) => (
            <div key={status} className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${statusDot[status]}`}></div>
                <span className="text-sm font-medium text-slate-400">
                  {statusLabel[status]} ({tasksByStatus[status].length})
                </span>
              </div>
              <div className="space-y-2">
                {tasksByStatus[status].map((t) => (
                  <TaskCard key={t.id} task={t} showTeam />
                ))}
                {tasksByStatus[status].length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4">暂无任务</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 列表视图 - 表格样式 */
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">任务</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">负责人</th>
                <th className="text-left px-4 py-3 font-medium">团队</th>
                <th className="text-left px-4 py-3 font-medium">依赖</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-800/80">
                  <td className="px-4 py-3 text-slate-500">#{t.task_id}</td>
                  <td className="px-4 py-3 text-slate-200">{t.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      t.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {statusLabel[t.status] || t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.owner || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{t.team_name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {t.blocked_by?.length > 0 && (
                      <span className="text-amber-400/70">
                        blocked: {t.blocked_by.map(id => `#${id}`).join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                    暂无任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
