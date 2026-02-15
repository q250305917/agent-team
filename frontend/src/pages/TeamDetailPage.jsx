import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import MessageItem from '../components/MessageItem';
import TaskCard from '../components/TaskCard';
import useWebSocket from '../hooks/useWebSocket';
import { fetchTeam, fetchTeamMessages, fetchTeamTasks } from '../api';

/** 团队详情页：成员 + 消息时间线 + 任务看板 */
export default function TeamDetailPage() {
  const { name } = useParams();
  const [team, setTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [teamData, msgsData, tasksData] = await Promise.all([
        fetchTeam(name),
        fetchTeamMessages(name),
        fetchTeamTasks(name),
      ]);
      setTeam(teamData);
      // 消息 API 返回分页对象 {items: [...]} 或直接数组
      setMessages(Array.isArray(msgsData) ? msgsData : (msgsData.items || []));
      setTasks(Array.isArray(tasksData) ? tasksData : (tasksData.items || []));
    } catch (err) {
      console.error('加载团队数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => { loadData(); }, [loadData]);

  useWebSocket((data) => {
    if (data.type === 'update') loadData();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  if (!team) {
    return <div className="text-slate-400">团队未找到</div>;
  }

  // 按状态分组任务
  const tasksByStatus = {
    pending: tasks.filter((t) => t.status === 'pending'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    completed: tasks.filter((t) => t.status === 'completed'),
  };

  return (
    <div className="space-y-6">
      {/* 团队信息头 */}
      <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-200">{team.name}</h2>
          <Link
            to={`/teams/${name}/flow`}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
          >
            查看消息流转
          </Link>
        </div>
        {team.description && (
          <p className="text-sm text-slate-400 mb-2">{team.description}</p>
        )}
        <p className="text-xs text-slate-500">
          创建于 {team.created_at ? new Date(team.created_at).toLocaleDateString('zh-CN') : '未知'}
        </p>
      </div>

      {/* 成员列表 */}
      <section>
        <h3 className="text-lg font-semibold text-slate-300 mb-3">
          成员 ({team.members?.length || 0})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(team.members || []).map((member) => (
            <div
              key={member.name}
              className="bg-slate-800/60 rounded-lg p-4 border border-slate-700 flex items-center gap-3"
            >
              {/* 首字母头像 + 颜色标识 */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: member.color || '#3b82f6' }}
              >
                {member.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">{member.name}</p>
                <p className="text-xs text-slate-500">
                  {member.model || '未知模型'}
                  {member.agent_type ? ` / ${member.agent_type}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 任务看板 (三列) */}
      <section>
        <h3 className="text-lg font-semibold text-slate-300 mb-3">任务看板</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 待办 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div>
              <span className="text-sm font-medium text-slate-400">
                待办 ({tasksByStatus.pending.length})
              </span>
            </div>
            <div className="space-y-2">
              {tasksByStatus.pending.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
          {/* 进行中 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-sm font-medium text-slate-400">
                进行中 ({tasksByStatus.in_progress.length})
              </span>
            </div>
            <div className="space-y-2">
              {tasksByStatus.in_progress.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
          {/* 已完成 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="text-sm font-medium text-slate-400">
                已完成 ({tasksByStatus.completed.length})
              </span>
            </div>
            <div className="space-y-2">
              {tasksByStatus.completed.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 消息时间线 */}
      <section>
        <h3 className="text-lg font-semibold text-slate-300 mb-3">消息时间线</h3>
        <div className="relative pl-6 space-y-3">
          {/* 左侧时间轴线 */}
          <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-700"></div>
          {messages.length > 0 ? (
            messages.map((msg) => (
              <div key={msg.id} className="relative">
                {/* 时间轴圆点 */}
                <div
                  className="absolute -left-6 top-4 w-3 h-3 rounded-full border-2 border-slate-800"
                  style={{ backgroundColor: msg.color || '#3b82f6' }}
                ></div>
                <MessageItem message={msg} />
              </div>
            ))
          ) : (
            <p className="text-slate-500 text-sm">暂无消息</p>
          )}
        </div>
      </section>
    </div>
  );
}
