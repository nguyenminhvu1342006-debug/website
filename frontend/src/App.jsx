import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin, Result, Button } from 'antd';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

const HomePage = lazy(() => import('./pages/public/HomePage'));
const LoginPage = lazy(() => import('./pages/public/LoginPage'));
const UserDashboard = lazy(() => import('./pages/patient/UserDashboard'));
const MyAppointment = lazy(() => import('./pages/patient/MyAppointment'));
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'));
const ReceptionDashboard = lazy(() => import('./pages/reception/ReceptionDashboard'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="page-loading"><Spin size="large" /></div>}>
      <Routes>
        <Route path="*" element={<Result status="404" title="404" subTitle="Không tìm thấy trang." extra={<Button href="/">Trang chủ</Button>} />} />
        <Route path="/reception" element={<ProtectedRoute allowedRoles={['receptionist', 'admin']}><ReceptionDashboard /></ProtectedRoute>} />
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-appointments"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <MyAppointment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/dashboard"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
