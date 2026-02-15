import { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard';
import TeamCard from '../components/TeamCard';
import MessageItem from '../components/MessageItem';
import useWebSocket from '../hooks/useWebSocket';
import { fetchTeams, fetchMessages, fetchStats } from '../api';

/** 总览页：统计 + 最近团队 + 最新消息 */
export default function OverviewPage() {
  const [teams, setTeams] = useState([]);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({ teams: 0, members: 0, messages: 0, task_completion: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [teamsData, msgsData, statsData] = await Promise.all([
        fetchTeams(),
        fetchMessages({ limit: 10 }),
        fetchStats(),
      ]);
      setTeams(teamsData);
      setMessages(msgsData);
      setStats(statsData);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // WebSocket 收到更新后刷新数据
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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-200">总览</h2>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="团队数" value={stats.teams} accent="blue" />
        <StatCard label="活跃成员" value={stats.members} accent="emerald" />
        <StatCard label="消息总数" value={stats.messages} accent="amber" />
        <StatCard
          label="任务完成率"
          value={`${Math.round(stats.task_completion)}%`}
          accent="purple"
        />
      </div>

      {/* 活跃团队 */}
      <section>
        <h3 className="text-lg font-semibold text-slate-300 mb-3">活跃团队</h3>
        {teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <TeamCard key={team.name} team={team} />
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">暂无团队数据</p>
        )}
      </section>

      {/* 最新消息 */}
      <section>
        <h3 className="text-lg font-semibold text-slate-300 mb-3">最新消息</h3>
        <div className="space-y-2">
          {messages.length > 0 ? (
            messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} showTeam />
            ))
          ) : (
            <p className="text-slate-500 text-sm">暂无消息</p>
          )}
        </div>
      </section>
    </div>
  );
}
