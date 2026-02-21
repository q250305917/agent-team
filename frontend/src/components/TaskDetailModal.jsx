import { memo } from 'react';
import { getTaskStatusStyle, getTaskStatusLabel } from '../constants';

/**
 * 任务详情弹窗组件 - 使用 memo 优化
 */
function TaskDetailModalComponent({ task, onClose }) {
  if (!task) return null;

  const statusStyle = getTaskStatusStyle(task.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* 弹窗内容 */}
      <div
        className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">#{task.task_id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              {getTaskStatusLabel(task.status)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-120px)] space-y-4">
          {/* 任务标题 */}
          <div>
            <h3 className="text-lg font-semibold text-slate-200">{task.subject}</h3>
          </div>

          {/* 描述 */}
          {task.description && (
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase mb-1">描述</h4>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase mb-1">负责人</h4>
              <p className="text-sm text-slate-300">{task.owner || '-'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase mb-1">团队</h4>
              <p className="text-sm text-slate-300">{task.team_name || '-'}</p>
            </div>
          </div>

          {/* 依赖关系 */}
          <div className="space-y-2">
            {task.blocked_by && task.blocked_by.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-amber-400/70 uppercase mb-1">被阻塞</h4>
                <p className="text-sm text-amber-400/70">
                  {task.blocked_by.map(id => `#${id}`).join(', ')}
                </p>
              </div>
            )}
            {task.blocks && task.blocks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-blue-400/70 uppercase mb-1">阻塞</h4>
                <p className="text-sm text-blue-400/70">
                  {task.blocks.map(id => `#${id}`).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(TaskDetailModalComponent);
