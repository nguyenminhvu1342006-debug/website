import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { SearchOutlined } from '@ant-design/icons';
import { Input, Select, Avatar, Spin, Button, Modal, message } from 'antd';

const Doctors = ({ onSelectDoctorForBooking }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');

  // State quản lý hiển thị Modal xem hồ sơ bác sĩ
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const primaryTeal = '#4cb4b3';
  const darkText = '#333333';

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get('http://127.0.0.1:8000/api/doctors/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDoctors(response.data);
    } catch (error) {
      console.error("Lỗi tải danh sách bác sĩ:", error);
      message.error("Không thể tải danh sách bác sĩ.");
    } finally {
      setLoading(false);
    }
  };

  // Hàm chuẩn hóa chuỗi: viết thường, bỏ tiền tố "Dr.", bỏ khoảng trắng thừa
  const normalizeStr = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/^dr\.\s*/, '') // Xóa tiền tố "Dr. " ở đầu
      .replace(/^dr\s*/, '')   // Xóa tiền tố "Dr " ở đầu
      .trim();
  };

  const filteredDoctors = doctors.filter((doc) => {
    const docName = doc.name || doc.full_name || '';
    const docSpecialty = doc.specialty || '';

    // Chuẩn hóa tên bác sĩ và từ khóa người dùng nhập vào để so sánh
    const normalizedDocName = normalizeStr(docName);
    const normalizedSearch = normalizeStr(searchTerm);

    const matchesName = normalizedDocName.includes(normalizedSearch);
    const matchesSpecialty = selectedSpecialty === 'All' || docSpecialty === selectedSpecialty;
    
    return matchesName && matchesSpecialty;
  });

  // Xử lý khi bấm nút "Book Appointment": Lưu thông tin bác sĩ và chuyển tab sang Book Appointment
  const handleBookClick = (doctor) => {
    localStorage.setItem('targetDoctorId', doctor.id);
    localStorage.setItem('targetDoctorName', doctor.full_name || doctor.name);
    localStorage.setItem('targetSpecialty', doctor.specialty);

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
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Input 
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} 
          placeholder="Search doctor..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, borderRadius: '20px', backgroundColor: 'white', padding: '10px 20px', border: '1px solid #eaeaea' }} 
        />
        <Select
          defaultValue="All Specialties"
          style={{ width: '200px', height: '42px' }}
          onChange={(value) => setSelectedSpecialty(value)}
          options={[
            { value: 'All', label: 'All Specialties' },
            { value: 'Cardiologist', label: 'Cardiologist' },
            { value: 'Neurologist', label: 'Neurologist' },
            { value: 'Pediatrician', label: 'Pediatrician' },
            { value: 'Oncologist', label: 'Oncologist' },
          ]}
        />
      </div>

      {/* Lưới hiển thị danh sách bác sĩ */}
      {loading ? (
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
                {doc.experience || 'Kinh nghiệm lâu năm'}
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
                <h3 style={{ margin: 0, fontSize: '18px', color: darkText }}>{selectedDoctor.full_name}</h3>
                <p style={{ margin: 0, color: primaryTeal, fontWeight: '500' }}>{selectedDoctor.specialty}</p>
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0' }} />
            <div>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: darkText }}>Kinh nghiệm:</p>
              <p style={{ margin: 0, color: '#666' }}>{selectedDoctor.experience || 'Đang cập nhật'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: darkText }}>Giới thiệu / Tiểu sử:</p>
              <p style={{ margin: 0, color: '#666' }}>{selectedDoctor.bio || 'Bác sĩ chuyên khoa giàu kinh nghiệm, tận tâm với người bệnh tại phòng khám.'}</p>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Doctors;