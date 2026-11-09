import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage'; 
import UserDashboard from './pages/UserDashboard';
import MyAppointment from './pages/MyAppointment';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} /> 
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/my-appointments" element={<MyAppointment />} />
      </Routes>
    </Router>
  );
}

export default App;