import { useEffect, useState } from 'react';
import { Avatar, Button, Input, Spin, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import api from '../../api';

const PRIMARY_TEAL = '#4cb4b3';
const DARK_TEXT = '#333333';

const DoctorProfile = ({ onProfileUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    doctor_code: '',
    full_name: '',
    date_of_birth: '',
    phone: '',
    address: '',
    specialization_name: '',
    education: '',
    certificate: '',
    avatar_initials: '',
  });

  useEffect(() => {
    let active = true;
    api
      .get('doctor/profile/')
      .then(({ data }) => {
        if (!active) return;
        setProfile({ ...data, date_of_birth: data.date_of_birth || '' });
      })
      .catch(() => {
        if (active) message.error('Không thể tải thông tin hồ sơ bác sĩ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth || null,
        phone: profile.phone,
        address: profile.address,
        education: profile.education,
        certificate: profile.certificate,
      };
      const { data } = await api.put('doctor/profile/', payload);
      setProfile({ ...data, date_of_birth: data.date_of_birth || '' });
      onProfileUpdated?.(data);
      message.success('Cập nhật hồ sơ bác sĩ thành công!');
    } catch (error) {
      const detail = error.response?.data?.date_of_birth?.[0] || 'Có lỗi xảy ra khi lưu thay đổi.';
      message.error(detail);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', width: '100%', paddingBottom: '40px' }}>
      <div>
        <h2 style={{ fontFamily: 'serif', margin: 0, color: DARK_TEXT, fontSize: '24px' }}>
          My Profile
        </h2>
        <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>
          Thông tin hành chính và chứng chỉ chuyên môn của bác sĩ.
        </p>
      </div>

      {/* Khung 1: Thông tin cá nhân */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '35px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
          border: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '30px' }}>
          <Avatar
            size={84}
            style={{ backgroundColor: '#e6f4f4', color: PRIMARY_TEAL, fontWeight: 'bold', fontSize: '26px' }}
          >
            {profile.avatar_initials || <UserOutlined />}
          </Avatar>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', color: DARK_TEXT }}>BS. {profile.full_name}</h3>
            <p style={{ margin: '4px 0 0 0', color: PRIMARY_TEAL, fontWeight: '500' }}>
              Chuyên khoa: {profile.specialization_name}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
              Mã bác sĩ
            </label>
            <Input
              value={profile.doctor_code}
              disabled
              style={{ backgroundColor: '#fafafa', color: '#888', borderRadius: '10px', height: '45px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
              Chuyên khoa (do Quản trị viên phân công)
            </label>
            <Input
              value={profile.specialization_name}
              disabled
              style={{ backgroundColor: '#fafafa', color: '#888', borderRadius: '10px', height: '45px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
              Họ và tên
            </label>
            <Input
              value={profile.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              style={{ borderRadius: '10px', height: '45px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
              Ngày sinh (YYYY-MM-DD)
            </label>
            <Input
              placeholder="YYYY-MM-DD"
              value={profile.date_of_birth}
              onChange={(e) => handleChange('date_of_birth', e.target.value)}
              style={{ borderRadius: '10px', height: '45px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
              Số điện thoại
            </label>
            <Input
              value={profile.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              style={{ borderRadius: '10px', height: '45px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
              Địa chỉ
            </label>
            <Input
              value={profile.address}
              onChange={(e) => handleChange('address', e.target.value)}
              style={{ borderRadius: '10px', height: '45px' }}
            />
          </div>
        </div>
      </div>

      {/* Khung 2: Học vấn & Chứng chỉ */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '35px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
          border: '1px solid #f0f0f0',
        }}
      >
        <h3 style={{ fontFamily: 'serif', fontSize: '20px', color: DARK_TEXT, margin: '0 0 20px 0' }}>
          Chuyên Môn & Chứng Chỉ Hành Nghề
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
              Học vấn / Trình độ (Education)
            </label>
            <Input
              value={profile.education}
              onChange={(e) => handleChange('education', e.target.value)}
              placeholder="VD: Thạc sĩ Y khoa - ĐH Y Hà Nội"
              style={{ borderRadius: '10px', height: '45px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
              Chứng chỉ hành nghề (Certificate)
            </label>
            <Input
              value={profile.certificate}
              onChange={(e) => handleChange('certificate', e.target.value)}
              placeholder="VD: CCHN-001234"
              style={{ borderRadius: '10px', height: '45px' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="large"
          loading={saving}
          onClick={handleSave}
          style={{
            backgroundColor: PRIMARY_TEAL,
            borderColor: PRIMARY_TEAL,
            borderRadius: '10px',
            height: '48px',
            padding: '0 35px',
            fontWeight: 'bold',
            fontSize: '15px',
          }}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default DoctorProfile;
