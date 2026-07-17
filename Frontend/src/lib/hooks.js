import { useCallback, useEffect, useState } from 'react';
import api from './api';

// One-shot / re-fetchable GET.
export function useFetch(url, { params, skip } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const key = JSON.stringify({ url, params });

  const run = useCallback(async () => {
    if (skip) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params });
      setData(res.data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, skip]);

  useEffect(() => {
    run();
  }, [run]);

  return { data: data?.data, meta: data?.meta, raw: data, loading, error, refetch: run };
}

// Paginated list helper.
export function usePaged(url, extraParams = {}) {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = useFetch(url, {
    params: { page, limit: 20, ...extraParams },
  });
  const pagination = meta?.pagination || {};
  return {
    items: data || [],
    page,
    setPage,
    totalPages: pagination.totalPages || 1,
    total: pagination.total || 0,
    loading,
    error,
    refetch,
  };
}
