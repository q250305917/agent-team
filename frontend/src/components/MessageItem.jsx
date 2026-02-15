import { useState } from 'react';
import Markdown from 'react-markdown';

/** 消息类型对应的样式 */
const typeStyles = {
  normal: 'bg-slate-800/60 border-slate-700',
  idle: 'bg-slate-800/30 border-slate-700/50 opacity-70',
  shutdown: 'bg-red-900/20 border-red-500/30',
  shutdown_request: 'bg-red-900/20 border-red-500/30',
  shutdown_response: 'bg-red-900/20 border-red-500/30',
};

/** 消息条目组件，支持展开/折叠和 Markdown 渲染 */
export default function MessageItem({ message, showTeam = false }) {
  const [expanded, setExpanded] = useState(false);
  const style = typeStyles[message.msg_type] || typeStyles.normal;

  // 使用成员颜色标识发送者
  const agentColor = message.color || '#3b82f6';

  return (
    <div
      className={`rounded-lg p-4 border ${style} cursor-pointer transition-all hover:border-slate-600`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 mb-2">
        {/* 发送者头像（首字母） */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: agentColor }}
        >
          {(message.from_agent || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">
              {message.from_agent}
            </span>
            {showTeam && message.team_name && (
              <span className="text-xs text-slate-500">@ {message.team_name}</span>
            )}
            {message.msg_type !== 'normal' && (
              <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                {message.msg_type}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {message.timestamp ? new Date(message.timestamp).toLocaleString('zh-CN') : ''}
          </p>
        </div>
        <span className="text-slate-500 text-xs">{expanded ? '收起' : '展开'}</span>
      </div>

      {/* 摘要 */}
      {message.summary && (
        <p className="text-sm text-slate-300 mb-1 truncate">{message.summary}</p>
      )}

      {/* 展开后显示完整内容 */}
      {expanded && message.text && (
        <div className="mt-3 pt-3 border-t border-slate-700 markdown-body text-sm text-slate-300">
          <Markdown>{message.text}</Markdown>
        </div>
      )}
    </div>
  );
}
