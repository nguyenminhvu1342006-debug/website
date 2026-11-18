import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import api from '../api';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem('accessToken');
  const cachedRole = localStorage.getItem('userRole');
  const [role, setRole] = useState(cachedRole);
  const [checking, setChecking] = useState(Boolean(token && !cachedRole));
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;

    api
      .get('me/')
      .then(({ data }) => {
        if (!active) return;
        localStorage.setItem('userRole', data.role);
        setRole(data.role);
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userRole');
          setUnauthorized(true);
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (!token || unauthorized) {
    return <Navigate to="/login" replace />;
  }

  if (checking) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'doctor' ? '/doctor/dashboard' : '/dashboard'} replace />;
  }

  return children;
};

export default ProtectedRoute;
