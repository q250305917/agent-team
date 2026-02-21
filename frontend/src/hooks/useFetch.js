import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '../api';

/**
 * 通用的数据获取 Hook
 * - 支持缓存
 * - 支持自动刷新
 * - 支持错误处理
 * - 支持 loading 状态
 *
 * @param {function} fetcher - 数据获取函数
 * @param {object} options - 配置选项
 */
export default function useFetch(fetcher, options = {}) {
  const {
    immediate = true,
    defaultValue = [],
    cacheKey,
    cacheTime = 5 * 60 * 1000, // 5分钟缓存
    refetchInterval,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const cacheRef = useRef(null);
  const abortControllerRef = useRef(null);

  // 缓存管理
  if (cacheKey) {
    const cached = sessionStorage.getItem(`cache_${cacheKey}`);
    if (cached && !cacheRef.current) {
      try {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTime) {
          cacheRef.current = cachedData;
        } else {
          sessionStorage.removeItem(`cache_${cacheKey}`);
        }
      } catch {
        sessionStorage.removeItem(`cache_${cacheKey}`);
      }
    }
  }

  /**
   * 获取数据
   */
  const execute = useCallback(async (params) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher(params);

      // 更新缓存
      if (cacheKey) {
        sessionStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
          data: result,
          timestamp: Date.now(),
        }));
        cacheRef.current = result;
      }

      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      // 忽略主动取消的错误
      if (err.name === 'AbortError' || err.name === 'CancellationError') {
        return defaultValue;
      }

      const error = err instanceof ApiError ? err : new ApiError(err.message, 0, null);
      setError(error);
      onError?.(error);
      return defaultValue;
    } finally {
      setLoading(false);
    }
  }, [fetcher, cacheKey, cacheTime, defaultValue, onSuccess, onError]);

  /**
   * 清除缓存
   */
  const clearCache = useCallback(() => {
    if (cacheKey) {
      sessionStorage.removeItem(`cache_${cacheKey}`);
      cacheRef.current = null;
    }
  }, [cacheKey]);

  /**
   * 重新获取数据
   */
  const refetch = useCallback(() => {
    clearCache();
    return execute();
  }, [execute, clearCache]);

  // 初始化时获取数据
  useEffect(() => {
    if (immediate) {
      // 使用缓存数据
      if (cacheRef.current !== null) {
        setData(cacheRef.current);
        setLoading(false);
      } else {
        execute();
      }
    }
  }, [immediate]);

  // 定时刷新
  useEffect(() => {
    if (refetchInterval) {
      const timer = setInterval(refetch, refetchInterval);
      return () => clearInterval(timer);
    }
  }, [refetchInterval, refetch]);

  // 清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    setData,
    loading,
    error,
    execute,
    refetch,
    clearCache,
    isEmpty: Array.isArray(data) ? data.length === 0 : !data,
  };
}

/**
 * 专门用于获取团队列表的 Hook（全局缓存）
 */
export function useTeams(options = {}) {
  const { fetchTeams } = require('../api');
  return useFetch(fetchTeams, {
    cacheKey: 'teams_list',
    cacheTime: 10 * 60 * 1000, // 10分钟
    ...options,
  });
}

/**
 * 专门用于获取统计数据的 Hook
 */
export function useStats(options = {}) {
  const { fetchStats } = require('../api');
  return useFetch(fetchStats, {
    cacheKey: 'stats',
    cacheTime: 60 * 1000, // 1分钟
    ...options,
  });
}
