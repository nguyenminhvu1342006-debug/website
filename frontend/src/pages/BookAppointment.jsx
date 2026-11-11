import React, { useState, useEffect } from 'react';
import api from '../api';
import { Select, Button, Avatar, message, Spin, Empty } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Calendar } from 'antd'; 
import dayjs from 'dayjs';

const BookAppointment = ({ preSelectedDoctor }) => {
  const primaryTeal = '#4cb4b3';
  const darkText = '#333333';
 
  const [selectedSpecialty, setSelectedSpecialty] = useState(
    preSelectedDoctor ? preSelectedDoctor.specialty : ''
  );
  const [selectedDoctor, setSelectedDoctor] = useState(preSelectedDoctor ? preSelectedDoctor.full_name : '');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const formattedDate = selectedDate.format('YYYY-MM-DD');
  const [selectedTime, setSelectedTime] = useState('');
  
  // State quản lý dữ liệu thật từ API
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [allDoctors, setAllDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  // TỰ ĐỘNG CHỌN SẴN BÁC SĨ VÀ CHUYÊN KHOA KHI NHẬN ĐƯỢC PRE-SELECTED DOCTOR
  useEffect(() => {
    if (preSelectedDoctor) {
      setSelectedDoctor(preSelectedDoctor.full_name || preSelectedDoctor.name || '');
      if (preSelectedDoctor.specialty) {
        setSelectedSpecialty(preSelectedDoctor.specialty);
      }
    }
  }, [preSelectedDoctor]);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await api.get('doctors/');
        const doctorsData = response.data;
        setAllDoctors(doctorsData);
        
        // Tự động lọc ra danh sách các chuyên khoa không trùng lặp
        const uniqueSpecialties = [...new Set(doctorsData.map(doc => doc.specialty))];
        setSpecialties(uniqueSpecialties);
        
        // 🛑 QUAN TRỌNG: Chỉ gán mặc định khi KHÔNG có preSelectedDoctor được truyền sang từ trang Doctors
        if (!preSelectedDoctor && uniqueSpecialties.length > 0) {
          setSelectedSpecialty(uniqueSpecialties[0]);
          const firstDocs = doctorsData.filter(doc => doc.specialty === uniqueSpecialties[0]);
          if (firstDocs.length > 0) setSelectedDoctor(firstDocs[0].name);
        }
      } catch (error) {
        console.error("Lỗi tải danh sách bác sĩ:", error);
      }
    };
    fetchDoctors();
  }, [preSelectedDoctor]); // Thêm preSelectedDoctor vào dependency

  // 1. Tự động gọi API hỏi giờ trống khi đổi Bác sĩ hoặc đổi Ngày
  useEffect(() => {
    fetchAvailableSlots();
  }, [selectedDoctor, selectedDate]);

  const fetchAvailableSlots = async () => {
    if (!selectedDoctor) return;
    setLoadingSlots(true);
    setSelectedTime(''); // Reset lại giờ khi đổi ngày
    try {
      const token = localStorage.getItem('accessToken');
      const response = await api.get(`slots/`, {
        params: { doctor: selectedDoctor, date: formattedDate },
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableSlots(response.data.available_slots);
    } catch (error) {
      console.error("Lỗi lấy giờ rảnh:", error);
      message.error('Không thể tải lịch của bác sĩ lúc này.');
    } finally {
      setLoadingSlots(false);
    }
  };

  // 2. Gửi yêu cầu chốt lịch
  const handleConfirmBooking = async () => {
    if (!selectedTime) {
      message.warning('Vui lòng chọn một khung giờ trước khi xác nhận!');
      return;
    }

    setIsBooking(true);
    try {
      const token = localStorage.getItem('accessToken');
      await api.post(`book/`, {
        doctor: selectedDoctor,
        date: formattedDate,
        time: selectedTime
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      message.success('🎉 Đặt lịch thành công!');
      fetchAvailableSlots(); // Load lại giờ trống (Giờ vừa đặt sẽ tự động biến mất)
      
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Có lỗi xảy ra khi đặt lịch.';
      message.error(errorMsg);
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* 1. SELECT DOCTOR & SPECIALTY */}
      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontFamily: 'serif', fontSize: '20px', color: darkText, margin: '0 0 5px 0' }}>Select Doctor & Specialty</h3>
        <p style={{ color: '#888', margin: '0 0 20px 0', fontSize: '14px' }}>Choose a specialty and pick a doctor for your appointment.</p>
        
        <Select 
          value={selectedSpecialty} 
          style={{ width: '100%', height: '50px', marginBottom: '25px', borderRadius: '10px' }}
          options={specialties.map(spec => ({ value: spec, label: spec }))}
          onChange={(value) => {
            setSelectedSpecialty(value); 
            const newDocs = allDoctors.filter(doc => doc.specialty === value);
            if (newDocs.length > 0) setSelectedDoctor(newDocs[0].name);
            else setSelectedDoctor('');
          }}
        />

        <div style={{ display: 'flex', gap: '20px', overflowX: 'auto' }}>
          {allDoctors.filter(doc => doc.specialty === selectedSpecialty).map(doc => {
            const isSelected = selectedDoctor === doc.name;
            return (
              <div key={doc.id} onClick={() => setSelectedDoctor(doc.name)}
                style={{
                  flex: 1, minWidth: '250px', padding: '25px', borderRadius: '16px', cursor: 'pointer',
                  border: isSelected ? `2px solid ${primaryTeal}` : '1px solid #eaeaea',
                  backgroundColor: isSelected ? '#eef8f8' : 'white', transition: 'all 0.2s'
                }}>
                <Avatar size={60} style={{ backgroundColor: isSelected ? primaryTeal : '#e6f4f4', color: isSelected ? 'white' : primaryTeal, fontWeight: 'bold', fontSize: '20px', marginBottom: '15px' }}>
                  {doc.initials}
                </Avatar>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '18px', color: darkText }}>{doc.name}</h4>
                <p style={{ margin: '0 0 20px 0', color: '#888', fontSize: '14px' }}>{doc.specialty}</p>
                <Button block style={{ backgroundColor: isSelected ? primaryTeal : 'transparent', color: isSelected ? 'white' : '#666', borderColor: isSelected ? primaryTeal : '#eaeaea', borderRadius: '8px' }}>
                  {isSelected ? 'Selected' : 'Select'}
                </Button>
              </div>
            )
          })}
          {allDoctors.filter(doc => doc.specialty === selectedSpecialty).length === 0 && (
            <p style={{ color: '#888', padding: '10px' }}>Chưa có bác sĩ nào thuộc chuyên khoa này.</p>
          )}
        </div>
      </div>

      {/* 2. DATE & TIME SELECTION */}
      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: '40px' }}>
          {/* Lịch thật từ Ant Design */}
          <div style={{ backgroundColor: '#fafafa', borderRadius: '16px', padding: '15px', width: '350px', overflow: 'hidden' }}>
            <style>{`
              .ant-picker-calendar-header .ant-radio-group {
                display: none !important;
              }
            `}</style>
            <Calendar 
              fullscreen={false} 
              value={selectedDate}
              onSelect={(newDate) => setSelectedDate(newDate)} 
              disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))} 
            />
          </div>
         

          {/* Time Slots (Dữ liệu thật từ DB) */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '16px', color: darkText }}>Available Times</span>
              <span style={{ color: '#888' }}>{selectedDate.format('MMM D, YYYY')}</span>
            </div>
            
            <div style={{ minHeight: '150px' }}>
              {loadingSlots ? (
                 <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin size="large" /></div>
              ) : availableSlots.length === 0 ? (
                 <Empty description="Kín lịch! Vui lòng chọn ngày khác." />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                  {availableSlots.map(time => {
                    const isSelected = selectedTime === time;
                    // Format lại từ 09:00:00 thành 09:00 để nhìn gọn hơn
                    const displayTime = time.substring(0, 5); 
                    return (
                      <Button key={time} shape="round" onClick={() => setSelectedTime(time)}
                        style={{ width: '100px', height: '40px', backgroundColor: isSelected ? primaryTeal : 'transparent', color: isSelected ? 'white' : '#666', borderColor: isSelected ? primaryTeal : '#eaeaea', fontWeight: isSelected ? 'bold' : 'normal' }}>
                        {displayTime}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. REVIEW & CONFIRM */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '25px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eaeaea' }}>
        <div>
          <h3 style={{ fontFamily: 'serif', margin: '0 0 8px 0', fontSize: '18px', color: darkText }}>Review your selection</h3>
          <p style={{ margin: 0, color: '#666', fontSize: '15px' }}>
            {/* ✅ Thay "Cardiology" bằng biến {selectedSpecialty} */}
            {selectedDoctor} • {selectedSpecialty} • {selectedDate.format('MMM D, YYYY')} {selectedTime && `• ${selectedTime.substring(0, 5)}`}
          </p>
        </div>
        <Button 
          type="primary" 
          size="large"
          loading={isBooking}
          onClick={handleConfirmBooking}
          style={{ backgroundColor: primaryTeal, borderRadius: '8px', padding: '0 30px', height: '45px', fontWeight: 'bold', border: 'none' }}
        >
          Confirm Booking
        </Button>
      </div>

    </div>
  );
};

export default BookAppointment;