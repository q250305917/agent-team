import { useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket 连接管理 Hook
 * 连接 ws://localhost:8000/ws，收到更新后触发 onMessage 回调
 * 断线自动重连（5秒间隔）
 */
export default function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    // 清除旧连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onopen = () => {
      console.log('[WS] 已连接');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch {
        // 忽略非 JSON 消息
      }
    };

    ws.onclose = () => {
      console.log('[WS] 连接断开，5秒后重连...');
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
