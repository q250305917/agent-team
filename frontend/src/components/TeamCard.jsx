import { Link } from 'react-router-dom';

/** 团队卡片组件 */
export default function TeamCard({ team }) {
  return (
    <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700 hover:border-blue-500/50 transition-all hover:bg-slate-800">
      <Link to={`/teams/${team.name}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-200">{team.name}</h3>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
            {team.member_count} 成员
          </span>
        </div>
        {team.description && (
          <p className="text-sm text-slate-400 mb-3 line-clamp-2">{team.description}</p>
        )}
        <p className="text-xs text-slate-500">
          创建于 {team.created_at ? new Date(team.created_at).toLocaleDateString('zh-CN') : '未知'}
        </p>
      </Link>
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <Link
          to={`/teams/${team.name}/flow`}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          ⇄ 流转分析
        </Link>
      </div>
    </div>
  );
}
