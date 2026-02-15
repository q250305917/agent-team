/** 统计卡片组件 */
export default function StatCard({ label, value, accent = 'blue' }) {
  const accentMap = {
    blue: 'text-blue-400 border-blue-500/30',
    emerald: 'text-emerald-400 border-emerald-500/30',
    amber: 'text-amber-400 border-amber-500/30',
    purple: 'text-purple-400 border-purple-500/30',
  };
  const colors = accentMap[accent] || accentMap.blue;

  return (
    <div className={`bg-slate-800/60 rounded-xl p-5 border ${colors.split(' ')[1]}`}>
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors.split(' ')[0]}`}>{value}</p>
    </div>
  );
}
