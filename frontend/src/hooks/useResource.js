import { useCallback, useEffect, useState } from 'react';
import api from '../api';

export function errorText(error) {
  const data = error.response?.data;
  if (typeof data === 'string') return 'Không thể xử lý yêu cầu.';
  if (data) {
    const flatten = (value, path = '') => {
      if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item,
        typeof item === 'object' && item !== null ? `${path} #${index + 1}` : path));
      if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) =>
        flatten(item, ['detail', 'error', 'non_field_errors'].includes(key) ? path : [path, key].filter(Boolean).join(' · ')));
      return `${path ? `${path}: ` : ''}${value}`;
    };
    return flatten(data).join(' ');
  }
  return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}

export default function useResource(url, params = {}) {
  const query = JSON.stringify(params);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: '' });
  const key = `${url}:${query}:${tick}`;
  const reload = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    api.get(url, { params: JSON.parse(query), signal: controller.signal })
      .then(({ data, status }) => {
        if (!controller.signal.aborted) setState({ key, data: status === 204 ? null : data, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ key, data: null, error: errorText(error) });
      });
    return () => controller.abort();
  }, [url, query, key]);
  const ready = state.key === key;
  return { data: ready ? state.data : null, error: ready ? state.error : '', loading: Boolean(url && !ready), reload };
}
