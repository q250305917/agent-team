/**
 * 通用加载组件
 */
export default function Loading({ text = '加载中...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`${sizeClasses[size]} border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin`}></div>
      {text && <p className="text-slate-400 text-sm mt-3">{text}</p>}
    </div>
  );
}
