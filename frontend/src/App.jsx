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
const ReceptionLayout = lazy(() => import('./pages/reception/ReceptionLayout'));
const PatientBookingPage = lazy(() => import('./pages/reception/PatientBookingPage'));
const CheckInPage = lazy(() => import('./pages/reception/CheckInPage'));
const RegisterPage = lazy(() => import('./pages/reception/RegisterPage'));
const DoctorsPage = lazy(() => import('./pages/reception/DoctorsPage'));
const StaffProfilePage = lazy(() => import('./pages/reception/StaffProfilePage'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="page-loading"><Spin size="large" /></div>}>
      <Routes>
        <Route path="*" element={<Result status="404" title="404" subTitle="Không tìm thấy trang." extra={<Button href="/">Trang chủ</Button>} />} />
        <Route path="/reception" element={<ProtectedRoute allowedRoles={['receptionist', 'admin']}><ReceptionLayout /></ProtectedRoute>}>
          <Route index element={<PatientBookingPage />} />
          <Route path="check-in" element={<CheckInPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="profile" element={<StaffProfilePage />} />
        </Route>
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
