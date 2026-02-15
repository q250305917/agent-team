import { NavLink } from 'react-router-dom';

/** 侧边栏导航项配置 */
const navItems = [
  { to: '/', label: '总览', icon: '◈' },
  { to: '/messages', label: '消息', icon: '✉' },
  { to: '/tasks', label: '任务', icon: '☑' },
  { to: '/flow', label: '消息流转', icon: '⇄' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-700 flex flex-col h-screen fixed left-0 top-0">
      {/* Logo / 标题 */}
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-bold text-blue-400 tracking-wide">
          Agent Teams
        </h1>
        <p className="text-xs text-slate-500 mt-1">Claude Code Dashboard</p>
      </div>

      {/* 导航链接 */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-slate-800 text-blue-400 border-r-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* 底部信息 */}
      <div className="p-4 border-t border-slate-700 text-xs text-slate-600">
        Powered by Claude
      </div>
    </aside>
  );
}
