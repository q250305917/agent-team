import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MermaidDiagram from '../components/MermaidDiagram';
import { fetchTeams, fetchMessageFlow } from '../api';

/** 消息流转可视化分析页面 */
export default function MessageFlowPage() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 时间线消息类型筛选
  const [selectedAgent, setSelectedAgent] = useState(''); // 单个 agent 筛选

  // 加载团队列表（用于顶部选择器），无 name 参数时跳转第一个团队
  useEffect(() => {
    fetchTeams().then((res) => {
      const list = Array.isArray(res) ? res : res.items || [];
      setTeams(list);
      if (!name && list.length > 0) {
        navigate(`/teams/${list[0].name}/flow`, { replace: true });
      }
    });
  }, [name, navigate]);

  // 加载消息流转数据
  const loadFlow = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    try {
      const result = await fetchMessageFlow(name, selectedAgent || undefined);
      setData(result);
    } catch (err) {
      console.error('加载消息流转数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [name, selectedAgent]);

  useEffect(() => { loadFlow(); }, [loadFlow]);

  // 切换团队时重置 agent 筛选
  const handleTeamChange = (e) => {
    setSelectedAgent('');
    navigate(`/teams/${e.target.value}/flow`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-slate-400">未找到消息流转数据</div>;
  }

  const totalMessages = Object.values(data.type_stats).reduce((a, b) => a + b, 0);

  // 筛选后的时间线
  const filteredTimeline = filterType === 'all'
    ? data.timeline
    : data.timeline.filter((t) => t.msg_type === filterType);

  return (
    <div className="space-y-6">
      {/* 顶部：团队选择器 + Agent 筛选器 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-200">
          消息流转分析
          {selectedAgent && (
            <span className="text-sm font-normal text-blue-400 ml-2">
              - {selectedAgent}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {/* Agent 筛选器 */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="">全部 Agent</option>
            {data?.members?.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {/* 团队选择器 */}
          <select
            value={name}
            onChange={handleTeamChange}
            className="bg-slate-800 border border-slate-600 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            {teams.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 概览卡片区 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="团队成员" value={data.members.length} />
        <StatCard label="消息总数" value={totalMessages} />
        <StatCard label="通信链路" value={data.flows.length} />
        <StatCard label="消息类型" value={Object.keys(data.type_stats).length} />
      </div>

      {/* Agent 通信矩阵 */}
      <section className="bg-slate-800/60 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-300 mb-4">Agent 通信矩阵</h3>
        <CommunicationMatrix members={data.members} flows={data.flows} />
      </section>

      {/* 消息类型分布 */}
      <section className="bg-slate-800/60 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-300 mb-4">消息类型分布</h3>
        <TypeDistribution typeStats={data.type_stats} total={totalMessages} />
      </section>

      {/* Mermaid 序列图 */}
      <section className="bg-slate-800/60 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-300 mb-4">消息序列图</h3>
        <MermaidDiagram chart={data.mermaid} />
      </section>

      {/* 详细时间线 */}
      <section className="bg-slate-800/60 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-300">详细时间线</h3>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1"
          >
            <option value="all">全部类型</option>
            {Object.keys(data.type_stats).map((t) => (
              <option key={t} value={t}>{t} ({data.type_stats[t]})</option>
            ))}
          </select>
        </div>
        <Timeline items={filteredTimeline} />
      </section>
    </div>
  );
}

/** 统计卡片 */
function StatCard({ label, value }) {
  return (
    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 text-center">
      <p className="text-2xl font-bold text-blue-400">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

/** Agent 通信矩阵：行=发送方，列=接收方 */
function CommunicationMatrix({ members, flows }) {
  // 构建 from->to 的计数映射
  const countMap = {};
  let maxCount = 0;
  for (const f of flows) {
    const key = `${f.from}|${f.to}`;
    countMap[key] = f.count;
    if (f.count > maxCount) maxCount = f.count;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left text-slate-400 p-2 text-xs">发送 / 接收</th>
            {members.map((m) => (
              <th key={m} className="text-center text-slate-400 p-2 text-xs font-normal">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((sender) => (
            <tr key={sender}>
              <td className="text-slate-300 p-2 text-xs font-medium">{sender}</td>
              {members.map((receiver) => {
                const count = countMap[`${sender}|${receiver}`] || 0;
                // 根据数量计算背景颜色深度
                const intensity = maxCount > 0 ? count / maxCount : 0;
                const bg = count > 0
                  ? `rgba(59, 130, 246, ${0.1 + intensity * 0.6})`
                  : 'transparent';
                return (
                  <td
                    key={receiver}
                    className="text-center p-2 text-xs"
                    style={{ backgroundColor: bg }}
                  >
                    {count > 0 ? (
                      <span className="text-slate-200 font-medium">{count}</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 消息类型分布：水平柱状图（纯 CSS 实现） */
function TypeDistribution({ typeStats, total }) {
  // 按数量降序排列
  const sorted = Object.entries(typeStats).sort((a, b) => b[1] - a[1]);

  // 类型颜色映射
  const typeColors = {
    normal: '#3b82f6',
    idle: '#64748b',
    shutdown_request: '#ef4444',
    shutdown_response: '#f97316',
    task_assignment: '#22c55e',
    broadcast: '#a855f7',
  };

  return (
    <div className="space-y-3">
      {sorted.map(([type, count]) => {
        const pct = total > 0 ? (count / total * 100).toFixed(1) : 0;
        const color = typeColors[type] || '#6366f1';
        return (
          <div key={type} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-36 shrink-0 text-right">{type}</span>
            <div className="flex-1 h-6 bg-slate-700/50 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs text-slate-300 w-16 shrink-0">{count} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

/** 详细时间线列表 */
function Timeline({ items }) {
  if (!items || items.length === 0) {
    return <p className="text-slate-500 text-sm">暂无时间线数据</p>;
  }

  // 消息类型对应的颜色标签
  const typeColors = {
    normal: 'bg-blue-500/20 text-blue-400',
    shutdown_request: 'bg-red-500/20 text-red-400',
    shutdown_response: 'bg-orange-500/20 text-orange-400',
    task_assignment: 'bg-green-500/20 text-green-400',
    broadcast: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="relative pl-6 space-y-2 max-h-96 overflow-y-auto">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-700" />
      {items.map((item, idx) => (
        <div key={idx} className="relative">
          <div className="absolute -left-6 top-3 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-slate-800" />
          <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium text-slate-200">{item.from}</span>
              <span className="text-xs text-slate-500">-&gt;</span>
              <span className="text-xs font-medium text-slate-200">{item.to}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[item.msg_type] || 'bg-slate-600/30 text-slate-400'}`}>
                {item.msg_type}
              </span>
              {item.timestamp && (
                <span className="text-xs text-slate-500 ml-auto">{item.timestamp}</span>
              )}
            </div>
            {item.summary && (
              <p className="text-xs text-slate-400 truncate">{item.summary}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
