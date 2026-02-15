import { useState, useEffect, useCallback } from 'react';
import MessageItem from '../components/MessageItem';
import useWebSocket from '../hooks/useWebSocket';
import { fetchTeams, fetchMessages } from '../api';

/** 消息浏览页：筛选 + 搜索 + 列表 */
export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // 筛选状态
  const [filters, setFilters] = useState({
    team: '',
    from_agent: '',
    msg_type: '',
    search: '',
  });

  const loadMessages = useCallback(async () => {
    try {
      const data = await fetchMessages(filters);
      setMessages(data);
    } catch (err) {
      console.error('加载消息失败:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTeams().then(setTeams).catch(() => {});
  }, []);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useWebSocket((data) => {
    if (data.type === 'update') loadMessages();
  });

  // 收集所有发送者用于筛选
  const allSenders = [...new Set(messages.map((m) => m.from_agent))].sort();

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setLoading(true);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-200">消息浏览</h2>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3">
        {/* 团队选择 */}
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

        {/* 发送者选择 */}
        <select
          value={filters.from_agent}
          onChange={(e) => handleFilterChange('from_agent', e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">全部发送者</option>
          {allSenders.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* 消息类型 */}
        <select
          value={filters.msg_type}
          onChange={(e) => handleFilterChange('msg_type', e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">全部类型</option>
          <option value="normal">普通消息</option>
          <option value="idle">空闲通知</option>
          <option value="shutdown">关闭</option>
          <option value="shutdown_request">关闭请求</option>
          <option value="shutdown_response">关闭响应</option>
        </select>

        {/* 搜索框 */}
        <input
          type="text"
          placeholder="搜索消息..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 flex-1 min-w-48"
        />
      </div>

      {/* 消息列表 */}
      {loading ? (
        <div className="text-slate-400 text-center py-8">加载中...</div>
      ) : (
        <div className="space-y-2">
          {messages.length > 0 ? (
            messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} showTeam />
            ))
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">无匹配消息</p>
          )}
        </div>
      )}
    </div>
  );
}
