import Sidebar from './Sidebar';

/** 布局组件：左侧固定侧边栏 + 右侧内容区 */
export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <main className="ml-60 flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
