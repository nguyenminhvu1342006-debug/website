import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import useResource from '../hooks/useResource';
import { roleHome } from '../auth';

export default function ProtectedRoute({ allowedRoles, children }) {
  const [expired, setExpired] = useState(false);
  const token = sessionStorage.getItem('accessToken');
  const { data, error, loading, reload } = useResource(token ? 'me/' : null);
  useEffect(() => {
    const expire = () => setExpired(true);
    window.addEventListener('auth-expired', expire);
    return () => window.removeEventListener('auth-expired', expire);
  }, []);
  if (!token || expired) return <Navigate to="/login" replace />;
  if (loading) return <div className="page-loading"><Spin size="large" /></div>;
  if (error) return <div className="page-loading"><Alert type="error" title={error}
    action={<Button onClick={reload}>Thử lại</Button>} /></div>;
  if (!data?.role) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(data.role)) return <Navigate to={roleHome(data.role)} replace />;
  return children;
}
