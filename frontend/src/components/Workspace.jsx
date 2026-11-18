import { Avatar, Button } from 'antd';
import { LogoutOutlined, MedicineBoxOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { logout } from '../auth';

export default function Workspace({ menu, active, onChange, profile, subtitle, children }) {
  const navigate = useNavigate();
  return <div className="workspace">
    <aside className="workspace-sidebar">
      <a className="clinic-brand" href="/" aria-label="Clinic — trang chủ">
        <span className="clinic-logo"><MedicineBoxOutlined /></span>
        <span><strong>Clinic</strong><small>{subtitle || 'Care made easy, every visit.'}</small></span>
      </a>
      <nav aria-label="Điều hướng">
        {menu.map((item) => <button key={item.key} aria-label={item.label} className={active === item.key ? 'active' : ''}
          onClick={() => onChange(item.key)}>{item.icon}<span>{item.label}</span></button>)}
      </nav>
      <Button className="logout-button" icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/login'); }}>Đăng xuất</Button>
    </aside>
    <div className="workspace-main">
      <header className="workspace-header"><h1>Xin chào{profile?.full_name ? `, ${profile.full_name}` : ''}!</h1>
        <Avatar icon={!profile?.avatar_initials ? <UserOutlined /> : undefined}
          style={{ background: '#e6f4f4', color: '#4cb4b3' }}>{profile?.avatar_initials}</Avatar>
      </header>
      <main className="workspace-content">{children}</main>
    </div>
  </div>;
}
