import { useState } from 'react';
import useResource, { errorText } from '../hooks/useResource';
import api from '../api';
import MedicalRecordDetail from '../components/MedicalRecordDetail';
import { CalendarOutlined } from '@ant-design/icons';
import { Alert, Spin, message, Button, Popconfirm, Avatar, Tag } from 'antd';

const MyAppointment = () => {
  const [recordId, setRecordId] = useState(null);
  const [activeTab, setActiveTab] = useState('Confirmed'); // 'Confirmed', 'Completed', 'Cancelled'

  const primaryTeal = '#4cb4b3';
  const darkText = '#333333';

  const { data, loading, error, reload } = useResource('my-appointments/', { status: activeTab });
  const appointments = data || [];

  const handleCancel = async (id) => {
    try {
      const token = sessionStorage.getItem('accessToken');
      await api.post(`cancel/${id}/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Đã hủy lịch hẹn thành công!');
      reload(); // Tải lại danh sách sau khi hủy
    } catch (error) {
      message.error(errorText(error));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* Tiêu đề trang */}
      <h2 style={{ fontFamily: 'serif', margin: 0, color: darkText, fontSize: '24px' }}>My Appointments</h2>

      {/* Các nút chuyển Tab (Upcoming, Completed, Canceled) thiết kế đẹp mắt */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #eaeaea', paddingBottom: '15px' }}>
        {[
          { key: 'Confirmed', label: 'Upcoming' },
          { key: 'Completed', label: 'Completed' },
          { key: 'Cancelled', label: 'Canceled' }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                backgroundColor: isActive ? primaryTeal : '#f5f5f5',
                color: isActive ? 'white' : '#666',
                transition: 'all 0.3s'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Danh sách lịch hẹn */}
      {error ? <Alert type="error" title={error} action={<Button onClick={reload}>Thử lại</Button>} /> : loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin size="large" /></div>
      ) : appointments.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', border: '1px dashed #d9d9d9' }}>
          <p style={{ color: '#888', margin: 0, fontSize: '15px' }}>Không có lịch hẹn nào trong mục này.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {appointments.map((item) => (
            <div 
              key={item.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '20px 25px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                border: '1px solid #f0f0f0'
              }}
            >
              {/* Thông tin Thời gian */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', minWidth: '180px' }}>
                <Avatar size={45} icon={<CalendarOutlined />} style={{ backgroundColor: '#e6f4f4', color: primaryTeal }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '15px', color: darkText }}>{item.date}</p>
                  <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{item.time}</p>
                </div>
              </div>

              {/* Thông tin Bác sĩ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, paddingLeft: '20px' }}>
                <Avatar size={45} style={{ backgroundColor: '#e6f4f4', color: primaryTeal, fontWeight: 'bold' }}>
                  {item.doctor_initials || 'DR'}
                </Avatar>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '15px', color: darkText }}>{item.doctor_name}</p>
                  <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{item.doctor_specialty}</p>
                </div>
              </div>

              {/* Nút thao tác (Chỉ hiện nút Cancel ở tab Upcoming/Confirmed) */}
              <div>
                {activeTab === 'Confirmed' && item.status === 'Checked-in' && <Tag color="cyan">Đã check-in</Tag>}
                {activeTab === 'Confirmed' && item.status === 'Confirmed' && (
                  <Popconfirm
                    title="Hủy lịch khám"
                    description="Bạn có chắc chắn muốn hủy lịch hẹn này không?"
                    onConfirm={() => handleCancel(item.id)}
                    okText="Có, hủy"
                    cancelText="Không"
                  >
                    <Button type="text" danger style={{ fontWeight: '500' }}>Cancel</Button>
                  </Popconfirm>
                )}
                {activeTab === 'Completed' && (
                  <div className="actions"><span style={{ color: '#52c41a' }}>Đã hoàn thành</span>{item.medical_record_id && <Button onClick={() => setRecordId(item.medical_record_id)}>Xem bệnh án</Button>}</div>
                )}
                {activeTab === 'Cancelled' && (
                  <span style={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: '14px' }}>Đã hủy</span>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      <MedicalRecordDetail recordId={recordId} onClose={() => setRecordId(null)} />
    </div>
  );
};

export default MyAppointment;
