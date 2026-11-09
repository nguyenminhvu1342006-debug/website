import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BookAppointment from './BookAppointment'; 
import MyAppointment from './MyAppointment';
import MyProfile from './MyProfile';
import Doctors from './Doctors';
import { useNavigate, Outlet } from 'react-router-dom';
import { 
  HomeOutlined, CalendarOutlined, ClockCircleOutlined, 
  FileTextOutlined, TeamOutlined, UserOutlined,
  SearchOutlined, BellOutlined
} from '@ant-design/icons';
import { Input, Button, Badge, Avatar, Spin, Popconfirm, message } from 'antd';



const UserDashboard = () => {
  const navigate = useNavigate();
  const primaryTeal = '#4cb4b3';
  const darkText = '#333333';
  
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  
  // State quản lý dữ liệu lịch hẹn gần nhất
  const [upcoming, setUpcoming] = useState(null);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  const menuItems = [
    { name: 'Dashboard', icon: <HomeOutlined /> },
    { name: 'Book Appointment', icon: <CalendarOutlined /> },
    { name: 'My Appointments', icon: <ClockCircleOutlined /> },
    { name: 'Medical Records', icon: <FileTextOutlined /> },
    { name: 'Doctors', icon: <TeamOutlined /> },
    { name: 'My profile', icon: <UserOutlined /> },
  ];

  const recentVisits = [
    { date: 'Sep 24, 2026', doctor: 'Dr. John Smith', diagnosis: 'Annual Checkup' },
    { date: 'Sep 10, 2026', doctor: 'Dr. Sarah Jenkins', diagnosis: 'Flu Vaccination' },
    { date: 'Aug 18, 2026', doctor: 'Dr. Michael Chen', diagnosis: 'Dermatology Consult' },
  ];

  // Tự động gọi API mỗi khi vào tab Dashboard
  useEffect(() => {
    if (activeMenu === 'Dashboard') {
      fetchUpcomingAppointment();
    }
  }, [activeMenu]);

  const fetchUpcomingAppointment = async () => {
    setLoadingUpcoming(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get('http://127.0.0.1:8000/api/upcoming-appointment/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.status === 200) {
        setUpcoming(response.data);
      } else {
        setUpcoming(null); // Trạng thái 204: Không có lịch
      }
    } catch (error) {
      console.error("Lỗi lấy lịch hẹn:", error);
      setUpcoming(null);
    } finally {
      setLoadingUpcoming(false);
    }
  };
  const handleCancel = async (appointmentId) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`http://127.0.0.1:8000/api/cancel/${appointmentId}/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Đã hủy lịch hẹn thành công!');
      fetchUpcomingAppointment(); // Gọi lại API, thẻ lịch hẹn sẽ biến mất và hiện nút "Đặt lịch ngay"
    } catch (error) {
      message.error('Có lỗi xảy ra khi hủy lịch.');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fcfcfc', fontFamily: 'Arial, sans-serif' }}>
      
      {/* ================= LEFT SIDEBAR ================= */}
      <div style={{ width: '260px', backgroundColor: 'white', borderRight: '1px solid #eaeaea', display: 'flex', flexDirection: 'column', padding: '30px 0' }}>
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
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div style={{ flex: 1, padding: '30px 50px', display: 'flex', flexDirection: 'column', gap: '30px', overflowY: 'auto' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontFamily: 'serif', margin: 0, color: darkText, fontSize: '26px' }}>Good morning,!</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
            <Input prefix={<SearchOutlined style={{ color: '#bfbfbf' }}/>} placeholder="Search records..." style={{ width: '250px', borderRadius: '20px', backgroundColor: '#f5f5f5', border: 'none', padding: '8px 15px' }} />
            <Badge count={3} size="small"><BellOutlined style={{ fontSize: '22px', color: '#666' }} /></Badge>
            <Avatar style={{ backgroundColor: '#e6f4f4', color: primaryTeal, fontWeight: 'bold' }} size="large">PN</Avatar>
          </div>
        </div>

        {/* Nếu click chọn 'Dashboard' */}
        {activeMenu === 'Dashboard' && (
          <>
            {/* THẺ HIỂN THỊ LỊCH HẸN GẦN NHẤT */}
            {loadingUpcoming ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin size="large" /></div>
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
                    onConfirm={() => handleCancel(upcoming.id)}
                    okText="Có, hủy lịch"
                    cancelText="Không"
                  >
                    <Button shape="round" type="text" style={{ color: '#ff4d4f', fontWeight: '500' }}>Cancel</Button>
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

            <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0' }}>
              <h3 style={{ fontFamily: 'serif', margin: '0 0 25px 0', fontSize: '22px', color: darkText }}>Recent Visits</h3>
              <div style={{ display: 'flex', paddingBottom: '15px', borderBottom: '1px solid #f0f0f0', color: '#888', fontSize: '14px' }}><div style={{ flex: 1 }}>Date</div><div style={{ flex: 1 }}>Doctor</div><div style={{ flex: 2 }}>Diagnosis</div><div style={{ width: '100px', textAlign: 'right' }}>Action</div></div>
              {recentVisits.map((visit, index) => (
                <div key={index} style={{ display: 'flex', padding: '20px 0', borderBottom: index !== recentVisits.length - 1 ? '1px solid #f9f9f9' : 'none', color: darkText, fontSize: '15px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>{visit.date}</div><div style={{ flex: 1 }}>{visit.doctor}</div><div style={{ flex: 2 }}>{visit.diagnosis}</div><div style={{ width: '100px', textAlign: 'right' }}><span style={{ color: primaryTeal, cursor: 'pointer', fontWeight: '500' }}>View Details</span></div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Nếu click chọn 'Book Appointment' */}
        {activeMenu === 'Book Appointment' && (
          <BookAppointment preSelectedDoctor={selectedDoctor} />
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
        {activeMenu === 'My profile' && (
          <MyProfile />
        )}
      </div>
    </div>
  );
};

export default UserDashboard;