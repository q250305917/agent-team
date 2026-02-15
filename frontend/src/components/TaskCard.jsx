/** 任务状态对应的颜色 */
const statusColors = {
  pending: 'bg-amber-500/20 text-amber-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  deleted: 'bg-red-500/20 text-red-400',
};

/** 任务卡片组件 */
export default function TaskCard({ task, showTeam = false }) {
  const statusStyle = statusColors[task.status] || statusColors.pending;
  const statusLabel = {
    pending: '待办',
    in_progress: '进行中',
    completed: '已完成',
    deleted: '已删除',
  };

  return (
    <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">#{task.task_id}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle}`}>
          {statusLabel[task.status] || task.status}
        </span>
      </div>
      <h4 className="text-sm font-medium text-slate-200 mb-2">{task.subject}</h4>
      {task.owner && (
        <p className="text-xs text-slate-400 mb-2">
          负责人: <span className="text-slate-300">{task.owner}</span>
        </p>
      )}
      {showTeam && task.team_name && (
        <p className="text-xs text-slate-500 mb-2">团队: {task.team_name}</p>
      )}
      {/* 依赖关系 */}
      {task.blocked_by && task.blocked_by.length > 0 && (
        <p className="text-xs text-amber-400/70">
          被阻塞: {task.blocked_by.map(id => `#${id}`).join(', ')}
        </p>
      )}
      {task.blocks && task.blocks.length > 0 && (
        <p className="text-xs text-blue-400/70">
          阻塞: {task.blocks.map(id => `#${id}`).join(', ')}
        </p>
      )}
    </div>
  );
}
