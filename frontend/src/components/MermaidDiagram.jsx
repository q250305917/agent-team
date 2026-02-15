import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// 初始化 mermaid 配置，使用暗色主题
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#1e40af',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#3b82f6',
    lineColor: '#64748b',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
  },
  sequence: {
    actorMargin: 50,
    messageMargin: 40,
    mirrorActors: false,
  },
});

/** Mermaid 图表渲染组件 */
export default function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chart || !containerRef.current) return;

    const renderChart = async () => {
      try {
        // 每次渲染使用唯一 id
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        console.error('Mermaid 渲染失败:', err);
        setError('图表渲染失败');
      }
    };

    renderChart();
  }, [chart]);

  // 复制 Mermaid 源码到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('复制失败');
    }
  };

  if (!chart) {
    return <p className="text-slate-500 text-sm">暂无序列图数据</p>;
  }

  return (
    <div className="space-y-3">
      {/* 工具栏 */}
      <div className="flex justify-end">
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
        >
          {copied ? '已复制' : '复制 Mermaid 源码'}
        </button>
      </div>

      {/* 图表渲染区域 */}
      {error ? (
        <div className="text-red-400 text-sm bg-red-900/20 rounded p-3">{error}</div>
      ) : (
        <div
          ref={containerRef}
          className="bg-slate-900/50 rounded-lg p-4 overflow-x-auto flex justify-center [&_svg]:max-w-full"
        />
      )}
    </div>
  );
}
