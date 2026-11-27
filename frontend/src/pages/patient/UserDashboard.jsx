import NotificationBell from '../../components/NotificationBell';
import { useState, useEffect } from 'react';
import api from '../../api';
import { logout } from '../../auth';
import useResource, { errorText } from '../../hooks/useResource';
import BookAppointment from '../shared/BookAppointment'; 
import MyAppointment from './MyAppointment';
import MyProfile from './MyProfile';
import Doctors from './Doctors';
import MedicalRecords from '../shared/MedicalRecords';
import RecentVisits from '../../components/RecentVisits';
import { useNavigate } from 'react-router-dom';
import { 
  HomeOutlined, CalendarOutlined, ClockCircleOutlined, 
  FileTextOutlined, TeamOutlined, UserOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { Button, Avatar, Spin, Popconfirm, message, Alert } from 'antd';



const UserDashboard = () => {
  const navigate = useNavigate();
  const primaryTeal = '#4cb4b3';
  const darkText = '#333333';
  
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [recordId, setRecordId] = useState(null);
  const [recordSearch, setRecordSearch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }
    let active = true;
    api.get('profile/', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => {
      if (active) {
        setProfile(data);
        setProfileError('');
      }
    }).catch((error) => {
      if (!active) return;
      if (error.response?.status === 401) navigate('/login');
      else setProfileError('Không thể tải hồ sơ bệnh nhân.');
    });
    return () => { active = false; };
  }, [activeMenu, navigate]);
  
  // State quản lý dữ liệu lịch hẹn gần nhất
  const { data: upcoming, error: upcomingError, loading: loadingUpcoming, reload: fetchUpcomingAppointment } = useResource(activeMenu === 'Dashboard' ? 'upcoming-appointment/' : null);

  const menuItems = [
    { name: 'Dashboard', icon: <HomeOutlined /> },
    { name: 'Book Appointment', icon: <CalendarOutlined /> },
    { name: 'My Appointments', icon: <ClockCircleOutlined /> },
    { name: 'Medical Records', icon: <FileTextOutlined /> },
    { name: 'Doctors', icon: <TeamOutlined /> },
    { name: 'My profile', icon: <UserOutlined /> },
  ];

  const handleCancel = async (appointmentId) => {
    try {
      const token = sessionStorage.getItem('accessToken');
      await api.post(`cancel/${appointmentId}/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Đã hủy lịch hẹn thành công!');
      fetchUpcomingAppointment(); // Gọi lại API, thẻ lịch hẹn sẽ biến mất và hiện nút "Đặt lịch ngay"
    } catch (error) {
      message.error(errorText(error));
    }
  };

  return (
    <div className="legacy-workspace" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fcfcfc', fontFamily: 'Arial, sans-serif' }}>
      
      {/* ================= LEFT SIDEBAR ================= */}
      <div className="clinic-sidebar patient-sidebar" style={{ width: '260px', backgroundColor: 'white', borderRight: '1px solid #eaeaea', display: 'flex', flexDirection: 'column', padding: '30px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 30px', marginBottom: '50px' }}>
          <div style={{ width: '45px', height: '45px', backgroundColor: primaryTeal, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '20px' }}>💊</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', fontFamily: 'serif', color: darkText }}>Clinic</h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>Care made easy, every visit.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 15px' }}>
          {menuItems.map((item) => {
            const isActive = activeMenu === item.name;
            return (
              <div 
                key={item.name}
                onClick={() => {
                  if (item.name === 'Medical Records') { setRecordId(null); setRecordSearch(''); }
                  setActiveMenu(item.name);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 20px', borderRadius: '12px',
                  backgroundColor: isActive ? primaryTeal : 'transparent', color: isActive ? 'white' : '#666',
                  cursor: 'pointer', fontWeight: isActive ? 'bold' : 'normal', transition: 'all 0.3s'
                }}
              >
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                <span style={{ fontSize: '15px' }}>{item.name}</span>
              </div>
            );
          })}
        </div>
        <div className="sidebar-footer" style={{ padding: '0 20px' }}><Button block icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/login'); }}>Đăng xuất</Button></div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div style={{ flex: 1, padding: '30px 50px', display: 'flex', flexDirection: 'column', gap: '30px', overflowY: 'auto' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontFamily: 'serif', margin: 0, color: darkText, fontSize: '26px' }}>Xin chào{profile?.full_name ? `, ${profile.full_name}` : ''}!</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
            <NotificationBell />
            <Avatar icon={!profile?.avatar_initials ? <UserOutlined /> : undefined} style={{ backgroundColor: '#e6f4f4', color: primaryTeal, fontWeight: 'bold' }} size="large">{profile?.avatar_initials}</Avatar>
          </div>
        </div>

        {profileError && <Alert type="error" title={profileError} showIcon />}
        {/* Nếu click chọn 'Dashboard' */}
        {activeMenu === 'Dashboard' && (
          <>
            {/* THẺ HIỂN THỊ LỊCH HẸN GẦN NHẤT */}
            {loadingUpcoming ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin size="large" /></div>
            ) : upcomingError ? (
              <Alert type="error" title={upcomingError} showIcon action={<Button onClick={fetchUpcomingAppointment}>Thử lại</Button>} />
            ) : upcoming ? (
              <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '25px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <Avatar size={50} icon={<CalendarOutlined />} style={{ backgroundColor: '#e6f4f4', color: primaryTeal }} />
                  <div><p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px', color: darkText }}>{upcoming.date}</p><p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{upcoming.time}</p></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <Avatar size={50} style={{ backgroundColor: '#e6f4f4', color: primaryTeal, fontWeight: 'bold' }}>{upcoming.doctor_initials}</Avatar>
                  <div><p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px', color: darkText }}>{upcoming.doctor_name}</p><p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{upcoming.doctor_specialty}</p></div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px' }}>
                  <Popconfirm
                    title="Hủy lịch khám"
                    description="Bạn có chắc chắn muốn hủy lịch hẹn này không?"
                    disabled={upcoming.status === 'Checked-in'}
                    onConfirm={() => handleCancel(upcoming.id)}
                    okText="Có, hủy lịch"
                    cancelText="Không"
                  >
                    <Button disabled={upcoming.status === 'Checked-in'} shape="round" type="text" style={{ color: '#ff4d4f', fontWeight: '500' }}>{upcoming.status === 'Checked-in' ? 'Đã check-in' : 'Hủy lịch'}</Button>
                  </Popconfirm>
                </div>
                
              </div>
              
            ) : (
              <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px 30px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px dashed #d9d9d9' }}>
                <p style={{ color: '#888', fontSize: '16px', margin: 0 }}>Bạn chưa có lịch hẹn nào sắp tới.</p>
              </div>
            )}

            <div style={{ backgroundColor: '#3b8686', borderRadius: '20px', padding: '35px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', boxShadow: '0 10px 20px rgba(59, 134, 134, 0.2)' }}>
              <div><h2 style={{ margin: '0 0 10px 0', fontFamily: 'serif', fontSize: '28px', color: 'white' }}>Need to see a doctor?</h2><p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>Book a new appointment with your preferred specialist today.</p></div>
              <Button shape="round" size="large" style={{ color: primaryTeal, fontWeight: 'bold', border: 'none', padding: '0 30px' }} onClick={() => setActiveMenu('Book Appointment')}>+ Book New Appointment</Button>
            </div>

            <RecentVisits onOpenRecord={(id) => { setRecordId(id); setRecordSearch(''); setActiveMenu('Medical Records'); }} />
          </>
        )}

        {/* Nếu click chọn 'Book Appointment' */}
        {activeMenu === 'Book Appointment' && (
          <BookAppointment key={selectedDoctor?.id || "booking"} preSelectedDoctor={selectedDoctor} onBooked={() => setActiveMenu("My Appointments")} />
        )}
        {activeMenu === 'My Appointments' && (
          <MyAppointment />
        )}
        {activeMenu === 'Doctors' && (
          <Doctors 
            onSelectDoctorForBooking={(doctor) => {
              setSelectedDoctor(doctor);
              setActiveMenu('Book Appointment'); 
           }}
          />
        )}
        {activeMenu === 'Medical Records' && <MedicalRecords key={`${recordId || 'list'}:${recordSearch}`} initialRecordId={recordId} initialSearch={recordSearch} />}
        {activeMenu === 'My profile' && (
          <MyProfile onProfileUpdated={setProfile} />
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
