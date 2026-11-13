import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

const LoginPage = () => {
  const primaryTeal = '#4cb4b3';
  const navigate = useNavigate();
  
  // Khai báo state lưu trữ dữ liệu người dùng gõ vào
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Hàm xử lý sự kiện khi bấm nút Đăng nhập
  const handleLogin = async () => {
    if (!username || !password) {
      message.warning('Vui lòng nhập đầy đủ tài khoản và mật khẩu!');
      return;
    }

    setLoading(true);
    try {
      // Gọi API sang Django Backend
      const response = await api.post('login/', {
        username: username,
        password: password
      });

      // Nếu thành công, lưu Token và Role vào localStorage
      const { access, refresh, role } = response.data;
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);

      let resolvedRole = role;
      if (!resolvedRole) {
        const meRes = await api.get('me/', {
          headers: { Authorization: `Bearer ${access}` },
        });
        resolvedRole = meRes.data.role;
      }
      localStorage.setItem('userRole', resolvedRole);

      message.success('Đăng nhập thành công!');

      // Chuyển hướng người dùng theo vai trò
      navigate(resolvedRole === 'doctor' ? '/doctor/dashboard' : '/dashboard');
      
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      const serverMsg = error.response?.data?.detail;
      message.error(serverMsg || 'Tài khoản hoặc mật khẩu không chính xác!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' }}>
      <div style={{ width: '400px', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ width: '60px', height: '60px', backgroundColor: primaryTeal, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '24px', margin: '0 auto 10px' }}>💊</div>
          <h2 style={{ margin: 0, fontFamily: 'serif', fontSize: '24px', color: '#333' }}>Clinic Portal</h2>
          <p style={{ color: '#888', marginTop: '5px' }}>Đăng nhập bằng tài khoản do Lễ tân cấp</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input 
            size="large" 
            placeholder="Tên đăng nhập" 
            prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input.Password 
            size="large" 
            placeholder="Mật khẩu" 
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleLogin} // Cho phép nhấn Enter để đăng nhập
          />
          
          <Button 
            type="primary" 
            size="large" 
            block 
            loading={loading}
            onClick={handleLogin}
            style={{ backgroundColor: primaryTeal, borderColor: primaryTeal, fontWeight: 'bold', marginTop: '10px' }}
          >
            Sign In
          </Button>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;