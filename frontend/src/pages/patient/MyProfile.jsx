import { useState } from 'react';
import useResource, { errorText } from '../../hooks/useResource';
import api from '../../api';
import { Avatar, Button, Input, message, Spin, Alert } from 'antd';
import { CameraOutlined, UserOutlined } from '@ant-design/icons';

const MyProfile = ({ onProfileUpdated }) => {
  const resource = useResource('profile/');
  const [saving, setSaving] = useState(false);

  const [draft, setProfile] = useState(null);
  const profile = draft || (resource.data ? { ...resource.data, date_of_birth: resource.data.date_of_birth || '' } : {});

  const primaryTeal = '#4cb4b3';
  const darkText = '#333333';

  // Xử lý thay đổi dữ liệu trong các ô input
  const handleChange = (field, value) => {
    setProfile({ ...profile, [field]: value });
  };

  // 2. Lưu thay đổi khi bấm nút Save Changes
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await api.put('profile/update/', profile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile({ ...response.data, date_of_birth: response.data.date_of_birth || '' });
      onProfileUpdated?.(response.data);
      message.success('Cập nhật thông tin thành công!');
    } catch (error) {
      console.error("Lỗi cập nhật profile:", error);
      message.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  if (resource.error) return <Alert type="error" title={resource.error} action={<Button onClick={resource.reload}>Thử lại</Button>} />;
  if (resource.loading) {
    return <div style={{ textAlign: 'center', padding: '60px' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', width: '100%', paddingBottom: '40px' }}>
      
      {/* Khung 1: Thông tin cá nhân & Avatar */}
      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '35px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0' }}>
        
        {/* Phần Avatar và nút đổi ảnh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '30px' }}>
          <div style={{ position: 'relative' }}>
            <Avatar size={90} style={{ backgroundColor: '#e6f4f4', color: primaryTeal, fontWeight: 'bold', fontSize: '28px' }}>
              {profile.avatar_initials || <UserOutlined />}
            </Avatar>
          </div>
          <Button 
            icon={<CameraOutlined />}
            disabled title="Chức năng ảnh đại diện đang phát triển"
            shape="round" 
            style={{ borderColor: '#d9d9d9', color: '#555', fontWeight: '500', height: '40px', padding: '0 20px' }}
          >
            Edit Photo
          </Button>
        </div>

        {/* Các trường thông tin (Grid 2 cột) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* ID (Disabled - Không cho chỉnh sửa) */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>ID</label>
            <Input 
              value={profile.id} 
              disabled 
              style={{ backgroundColor: '#fafafa', color: '#888', borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Full Name</label>
            <Input 
              value={profile.full_name} 
              onChange={(e) => handleChange('full_name', e.target.value)}
              style={{ borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Date of Birth</label>
            <Input 
              type="date" max={new Date().toLocaleDateString("en-CA")} value={profile.date_of_birth}
              onChange={(e) => handleChange('date_of_birth', e.target.value)}
              style={{ borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Phone</label>
            <Input 
              value={profile.phone} 
              onChange={(e) => handleChange('phone', e.target.value)}
              style={{ borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Address</label>
            <Input 
              value={profile.address} 
              onChange={(e) => handleChange('address', e.target.value)}
              style={{ borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

        </div>
      </div>

      {/* Khung 2: Medical & Emergency Contact */}
      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '35px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0' }}>
        <h3 style={{ fontFamily: 'serif', fontSize: '20px', color: darkText, margin: '0 0 25px 0' }}>Medical & Emergency Contact</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Blood Type</label>
            <Input 
              value={profile.blood_type} 
              onChange={(e) => handleChange('blood_type', e.target.value)}
              style={{ borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Known Allergies</label>
            <Input 
              value={profile.allergies} 
              onChange={(e) => handleChange('allergies', e.target.value)}
              style={{ borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Emergency Contact Name</label>
            <Input 
              value={profile.emergency_contact_name} 
              onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
              style={{ borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Emergency Contact Phone</label>
            <Input 
              value={profile.emergency_contact_phone} 
              onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
              style={{ borderRadius: '10px', height: '45px', border: '1px solid #eaeaea' }} 
            />
          </div>

        </div>
      </div>

      {/* Nút Save Changes ở góc dưới bên phải */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          type="primary" 
          size="large"
          loading={saving}
          onClick={handleSaveChanges}
          style={{ 
            backgroundColor: primaryTeal, 
            borderColor: primaryTeal, 
            borderRadius: '10px', 
            height: '48px', 
            padding: '0 35px', 
            fontWeight: 'bold',
            fontSize: '15px'
          }}
        >
          Save Changes
        </Button>
      </div>

    </div>
  );
};

export default MyProfile;
