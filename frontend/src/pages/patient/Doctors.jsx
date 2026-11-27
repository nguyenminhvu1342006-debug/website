import { useState } from 'react';
import useResource from '../../hooks/useResource';
import { SearchOutlined } from '@ant-design/icons';
import { Input, Select, Avatar, Spin, Button, Modal, Alert } from 'antd';

const Doctors = ({ onSelectDoctorForBooking }) => {
  const { data, loading, error, reload } = useResource('doctors/');
  const doctors = data || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');

  // State quản lý hiển thị Modal xem hồ sơ bác sĩ
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const primaryTeal = '#4cb4b3';
  const darkText = '#333333';

  const normalizeStr = (value = '') => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .toLowerCase()
    .replace(/^dr\.?\s+/, '')
    .trim()
    .replace(/\s+/g, ' ');

  const specialtyOptions = [...new Set(doctors.map((doctor) => doctor.specialty).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map((specialty) => ({ value: specialty, label: specialty }));
  const normalizedSearch = normalizeStr(searchTerm);
  const filteredDoctors = doctors.filter((doctor) => {
    const matchesName = normalizeStr(doctor.name || doctor.full_name).includes(normalizedSearch);
    const matchesSpecialty = selectedSpecialty === 'All' || doctor.specialty === selectedSpecialty;
    return matchesName && matchesSpecialty;
  });

  const handleBookClick = (doctor) => {

    if (onSelectDoctorForBooking) {
        onSelectDoctorForBooking(doctor); 
    }
  };

  // Mở Modal xem thông tin chi tiết bác sĩ từ Database
  const handleViewProfile = (doctor) => {
    setSelectedDoctor(doctor);
    setIsModalVisible(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', width: '100%' }}>
      
      {/* Thanh tìm kiếm và bộ lọc chuyên khoa */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Input 
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} 
          placeholder="Search doctor..."
          aria-label="Search doctor"
          allowClear
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, borderRadius: '20px', backgroundColor: 'white', padding: '10px 20px', border: '1px solid #eaeaea' }} 
        />
        <Select
          value={selectedSpecialty}
          aria-label="Filter by specialty"
          style={{ width: '200px', height: '42px' }}
          onChange={(value) => setSelectedSpecialty(value)}
          options={[{ value: 'All', label: 'All Specialties' }, ...specialtyOptions]}
        />
      </div>

      {/* Lưới hiển thị danh sách bác sĩ */}
      {error ? <Alert type="error" title={error} action={<Button onClick={reload}>Thử lại</Button>} /> : loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin size="large" /></div>
      ) : filteredDoctors.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', border: '1px dashed #d9d9d9' }}>
          <p style={{ color: '#888', margin: 0 }}>Không tìm thấy bác sĩ phù hợp.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {filteredDoctors.map((doc) => (
            <div 
              key={doc.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '25px',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                border: '1px solid #f0f0f0',
                transition: 'all 0.3s'
              }}
            >
              {/* Avatar viết tắt tên bác sĩ */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                <Avatar size={70} style={{ backgroundColor: '#e6f4f4', color: primaryTeal, fontWeight: 'bold', fontSize: '20px' }}>
                  {doc.initials || 'DR'}
                </Avatar>
              </div>

              {/* Thông tin bác sĩ (Đã bỏ sao và review) */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold', color: darkText }}>{doc.name || doc.full_name || 'Bác sĩ'}</h3>
                <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{doc.specialty}</p>
              </div>

              <div style={{ textAlign: 'center', fontSize: '13px', color: '#666' }}>
                {doc.education || 'Thông tin đào tạo đang cập nhật'}
              </div>

              {/* Các nút bấm thao tác */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                      <Button
                          type="primary"
                          shape="round"
                          style={{
                              flex: 1,
                              backgroundColor: primaryTeal,
                              borderColor: primaryTeal,
                              fontWeight: 'bold',
                              fontSize: '12px',      /* Giảm cỡ chữ một chút cho vừa vặn */
                              padding: '0 4px',      /* Giảm khoảng đệm ngang */
                              height: '36px'         /* Cố định chiều cao nút */
                          }}
                          onClick={() => handleBookClick(doc)}
                      >
                          Book Appointment
                      </Button>
                      <Button
                          shape="round"
                          style={{
                              flex: 1,
                              borderColor: '#d9d9d9',
                              color: '#666',
                              fontSize: '12px',      /* Giảm cỡ chữ tương ứng */
                              padding: '0 4px',      /* Giảm khoảng đệm ngang */
                              height: '36px'         /* Cố định chiều cao nút */
                          }}
                          onClick={() => handleViewProfile(doc)}
                      >
                          View Profile
                      </Button>
                  </div>
              

            </div>
          ))}
        </div>
      )}

      {/* Modal hiển thị thông tin chi tiết bác sĩ từ Database */}
      <Modal
        title={<span style={{ color: darkText, fontSize: '18px', fontFamily: 'serif' }}>Thông tin chi tiết bác sĩ</span>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" type="primary" style={{ backgroundColor: primaryTeal, borderColor: primaryTeal }} onClick={() => setIsModalVisible(false)}>
            Đóng
          </Button>
        ]}
      >
        {selectedDoctor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <Avatar size={60} style={{ backgroundColor: '#e6f4f4', color: primaryTeal, fontWeight: 'bold', fontSize: '18px' }}>
                {selectedDoctor.initials || 'DR'}
              </Avatar>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: darkText }}>{selectedDoctor.full_name || selectedDoctor.name}</h3>
                <p style={{ margin: 0, color: primaryTeal, fontWeight: '500' }}>{selectedDoctor.specialty}</p>
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0' }} />
            <div>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: darkText }}>Đào tạo:</p>
              <p style={{ margin: 0, color: '#666' }}>{selectedDoctor.education || 'Đang cập nhật'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: darkText }}>Chứng chỉ:</p>
              <p style={{ margin: 0, color: '#666' }}>{selectedDoctor.certificate || 'Đang cập nhật'}</p>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Doctors;
