import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Button, Empty, Spin, Tag, message } from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import api from '../../api';
import DoctorSchedule from './DoctorSchedule';
import DoctorRecords from './DoctorRecords';
import DoctorProfile from './DoctorProfile';
import ExaminationModal from './ExaminationModal';

const PRIMARY_TEAL = '#4cb4b3';
const DARK_TEXT = '#333333';

const MENU_ITEMS = [
  { key: 'Dashboard', label: 'Dashboard', icon: <HomeOutlined /> },
  { key: 'My Schedule', label: 'My Schedule', icon: <ClockCircleOutlined /> },
  { key: 'Medical Records', label: 'Medical Records', icon: <FileTextOutlined /> },
  { key: 'My profile', label: 'My profile', icon: <UserOutlined /> },
];

const STATUS_TAGS = {
  'Checked-in': { color: 'cyan', label: 'Chờ khám' },
  Confirmed: { color: 'blue', label: 'Sắp tới' },
  Completed: { color: 'green', label: 'Đã khám' },
  Cancelled: { color: 'red', label: 'Đã hủy' },
};

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('Dashboard');

  const [dashboardData, setDashboardData] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [examTarget, setExamTarget] = useState(null);
  const [recordContext, setRecordContext] = useState({ patient: null, recordId: null });
  const [reloadTick, setReloadTick] = useState(0);

  const reloadDashboard = useCallback(() => {
    setLoading(true);
    setErrorMsg('');
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (activeMenu !== 'Dashboard') return;
    let active = true;

    api
      .get('doctor/dashboard/')
      .then(({ data }) => {
        if (!active) return;
        setDashboardData(data);
        setDoctorProfile(data.doctor);
        setErrorMsg('');
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userRole');
          navigate('/login');
          return;
        }
        setErrorMsg(error.response?.data?.detail || 'Không thể tải dữ liệu bảng điều khiển bác sĩ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeMenu, navigate, reloadTick]);

  const handleClearRecordContext = useCallback(() => {
    setRecordContext({ patient: null, recordId: null });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    message.info('Đã đăng xuất.');
    navigate('/login');
  };

  const handleViewPatientHistory = (patientInfo) => {
    setRecordContext({ patient: patientInfo, recordId: null });
    setActiveMenu('Medical Records');
  };

  const handleViewRecordDetail = (recordId) => {
    setRecordContext({ patient: null, recordId });
    setActiveMenu('Medical Records');
  };

  const stats = dashboardData?.stats || {
    today_total: 0,
    today_waiting: 0,
    today_confirmed: 0,
    today_completed: 0,
    total_patients_seen: 0,
  };
  const nextApp = dashboardData?.next_appointment;
  const todayApps = dashboardData?.today_appointments || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fcfcfc', fontFamily: 'Arial, sans-serif' }}>
      {/* ================= LEFT SIDEBAR ================= */}
      <div
        style={{
          width: '260px',
          backgroundColor: 'white',
          borderRight: '1px solid #eaeaea',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '30px 0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 30px', marginBottom: '50px' }}>
            <div
              style={{
                width: '45px',
                height: '45px',
                backgroundColor: PRIMARY_TEAL,
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white',
                fontSize: '20px',
              }}
            >
              🩺
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', fontFamily: 'serif', color: DARK_TEXT }}>
                Clinic
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>Doctor Workspace</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 15px' }}>
            {MENU_ITEMS.map((item) => {
              const isActive = activeMenu === item.key;
              return (
                <div
                  key={item.key}
                  onClick={() => {
                    if (item.key !== 'Medical Records') {
                      setRecordContext({ patient: null, recordId: null });
                    }
                    setActiveMenu(item.key);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: isActive ? PRIMARY_TEAL : 'transparent',
                    color: isActive ? 'white' : '#666',
                    cursor: 'pointer',
                    fontWeight: isActive ? 'bold' : 'normal',
                    transition: 'all 0.25s',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <span style={{ fontSize: '15px' }}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '0 15px' }}>
          <Button
            icon={<LogoutOutlined />}
            block
            size="large"
            onClick={handleLogout}
            style={{ borderRadius: '12px', color: '#666', borderColor: '#eaeaea' }}
          >
            Đăng xuất
          </Button>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div style={{ flex: 1, minWidth: 0, padding: '30px 50px', display: 'flex', flexDirection: 'column', gap: '28px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'serif', margin: 0, color: DARK_TEXT, fontSize: '26px' }}>
              Xin chào{doctorProfile?.full_name ? `, BS. ${doctorProfile.full_name}` : ''}!
            </h1>
            {doctorProfile?.specialization_name && (
              <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>
                Chuyên khoa: {doctorProfile.specialization_name} • Mã BS: {doctorProfile.doctor_code}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Avatar
              size="large"
              icon={!doctorProfile?.avatar_initials ? <UserOutlined /> : undefined}
              style={{ backgroundColor: '#e6f4f4', color: PRIMARY_TEAL, fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => setActiveMenu('My profile')}
            >
              {doctorProfile?.avatar_initials}
            </Avatar>
          </div>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeMenu === 'Dashboard' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Spin size="large" />
              </div>
            ) : errorMsg ? (
              <Alert
                type="error"
                showIcon
                title={errorMsg}
                action={<Button onClick={reloadDashboard}>Thử lại</Button>}
              />
            ) : (
              <>
                {/* 4 Thẻ thống kê nhanh */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
                  {[
                    {
                      title: 'Lịch khám hôm nay',
                      value: stats.today_total,
                      icon: <CalendarOutlined />,
                      accent: PRIMARY_TEAL,
                    },
                    {
                      title: 'Đang chờ khám (Checked-in)',
                      value: stats.today_waiting,
                      icon: <ClockCircleOutlined />,
                      accent: '#13c2c2',
                    },
                    {
                      title: 'Đã khám hôm nay',
                      value: stats.today_completed,
                      icon: <CheckCircleOutlined />,
                      accent: '#52c41a',
                    },
                    {
                      title: 'Tổng bệnh nhân đã khám',
                      value: stats.total_patients_seen,
                      icon: <TeamOutlined />,
                      accent: '#3b8686',
                    },
                  ].map((card) => (
                    <div
                      key={card.title}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '18px',
                        padding: '22px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                        border: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '13px' }}>{card.title}</p>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: DARK_TEXT }}>{card.value}</div>
                      </div>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          backgroundColor: '#eef8f8',
                          color: card.accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                        }}
                      >
                        {card.icon}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Banner Bệnh nhân tiếp theo */}
                <div
                  style={{
                    backgroundColor: '#3b8686',
                    borderRadius: '20px',
                    padding: '28px 36px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'white',
                    boxShadow: '0 10px 20px rgba(59, 134, 134, 0.18)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '6px' }}>
                      {nextApp?.status === 'Checked-in'
                        ? 'BỆNH NHÂN ĐANG CHỜ KHÁM (ĐÃ CHECK-IN)'
                        : 'CUỘC HẸN SẮP TỚI'}
                    </div>
                    {nextApp ? (
                      <>
                        <h2 style={{ margin: '0 0 6px 0', fontFamily: 'serif', fontSize: '26px', color: 'white' }}>
                          {nextApp.patient_info?.full_name} ({nextApp.patient_info?.patient_code})
                        </h2>
                        <p style={{ margin: 0, fontSize: '15px', opacity: 0.92 }}>
                          Thời gian: {nextApp.date} lúc {nextApp.time}
                          {nextApp.patient_info?.known_allergies
                            ? ` • Dị ứng: ${nextApp.patient_info.known_allergies}`
                            : ''}
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 style={{ margin: '0 0 6px 0', fontFamily: 'serif', fontSize: '24px', color: 'white' }}>
                          Chưa có bệnh nhân chờ khám
                        </h2>
                        <p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>
                          Bạn có thể xem toàn bộ lịch hẹn tại mục My Schedule.
                        </p>
                      </>
                    )}
                  </div>

                  {nextApp?.status === 'Checked-in' ? (
                    <Button
                      shape="round"
                      size="large"
                      icon={<MedicineBoxOutlined />}
                      onClick={() => setExamTarget(nextApp)}
                      style={{ color: '#2b6a6a', fontWeight: 'bold', border: 'none', padding: '0 28px' }}
                    >
                      Bắt đầu khám ngay
                    </Button>
                  ) : (
                    <Button
                      shape="round"
                      size="large"
                      onClick={() => setActiveMenu('My Schedule')}
                      style={{ color: '#2b6a6a', fontWeight: 'bold', border: 'none', padding: '0 28px' }}
                    >
                      Xem lịch khám
                    </Button>
                  )}
                </div>

                {/* Danh sách lịch khám hôm nay */}
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    padding: '28px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontFamily: 'serif', margin: 0, fontSize: '22px', color: DARK_TEXT }}>
                      Lịch khám hôm nay ({dashboardData?.today_date})
                    </h3>
                    <Button type="link" style={{ color: PRIMARY_TEAL }} onClick={() => setActiveMenu('My Schedule')}>
                      Xem tất cả lịch →
                    </Button>
                  </div>

                  {todayApps.length === 0 ? (
                    <Empty description="Không có lịch khám nào trong ngày hôm nay." />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {todayApps.map((app) => {
                        const tagMeta = STATUS_TAGS[app.status] || { color: 'default', label: app.status };
                        return (
                          <div
                            key={app.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '16px 20px',
                              borderRadius: '14px',
                              border: '1px solid #f0f0f0',
                              backgroundColor: app.status === 'Checked-in' ? '#f6fcfc' : 'white',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <Avatar size={44} style={{ backgroundColor: '#e6f4f4', color: PRIMARY_TEAL, fontWeight: 'bold' }}>
                                {app.patient_info?.initials}
                              </Avatar>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '15px', color: DARK_TEXT }}>
                                  {app.patient_info?.full_name}{' '}
                                  <span style={{ color: '#888', fontWeight: 'normal', fontSize: '13px' }}>
                                    ({app.patient_info?.patient_code})
                                  </span>
                                </div>
                                <div style={{ color: '#888', fontSize: '13px' }}>
                                  Giờ hẹn: <strong>{app.time}</strong>
                                  {app.patient_info?.phone ? ` • SĐT: ${app.patient_info.phone}` : ''}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Tag color={tagMeta.color}>{tagMeta.label}</Tag>
                              {app.status === 'Checked-in' && (
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<MedicineBoxOutlined />}
                                  onClick={() => setExamTarget(app)}
                                  style={{ backgroundColor: PRIMARY_TEAL, borderColor: PRIMARY_TEAL }}
                                >
                                  Khám bệnh
                                </Button>
                              )}
                              {app.status === 'Completed' && app.medical_record_id && (
                                <Button
                                  size="small"
                                  onClick={() => handleViewRecordDetail(app.medical_record_id)}
                                >
                                  Xem bệnh án
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* TAB 2: MY SCHEDULE (UC-06) */}
        {activeMenu === 'My Schedule' && (
          <DoctorSchedule
            onViewPatientHistory={handleViewPatientHistory}
            onViewRecordDetail={handleViewRecordDetail}
          />
        )}

        {/* TAB 3: MEDICAL RECORDS (UC-07) */}
        {activeMenu === 'Medical Records' && (
          <DoctorRecords
            initialPatient={recordContext.patient}
            initialRecordId={recordContext.recordId}
            onClearContext={handleClearRecordContext}
          />
        )}

        {/* TAB 4: MY PROFILE */}
        {activeMenu === 'My profile' && (
          <DoctorProfile onProfileUpdated={setDoctorProfile} />
        )}
      </div>

      <ExaminationModal
        key={examTarget?.id || 'closed'}
        open={Boolean(examTarget)}
        appointment={examTarget}
        onClose={() => setExamTarget(null)}
        onSuccess={reloadDashboard}
      />
    </div>
  );
};

export default DoctorDashboard;
