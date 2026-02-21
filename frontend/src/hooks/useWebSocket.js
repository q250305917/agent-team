import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * WebSocket 连接管理 Hook
 * 连接 ws://localhost:8000/ws，收到更新后触发 onMessage 回调
 * 支持令牌认证，断线自动重连
 */
export default function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (reconnectAttempts.current > 5) {
      console.error('[WS] 重连次数过多，停止重连');
      setConnectionStatus('error');
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');

    const wsToken = import.meta.env.VITE_WS_TOKEN || '';
    const wsUrl = wsToken
      ? `ws://localhost:8000/ws?token=${encodeURIComponent(wsToken)}`
      : 'ws://localhost:8000/ws';

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] 已连接');
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch {}
    };

    ws.onclose = (event) => {
      if (event.code === 4001) {
        console.error('[WS] 认证失败');
        setConnectionStatus('error');
        return;
      }

      reconnectAttempts.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      console.log(`[WS] 连接断开，${delay/1000}秒后重连...`);
      setConnectionStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, delay);
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

  return { connectionStatus, reconnect: connect };
}
