import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Avatar, Badge, Button, ConfigProvider, Input, Tooltip, message } from 'antd';
import { LuBell, LuCalendar, LuClock, LuFileText, LuLogOut, LuPill, LuSearch, LuUserRound, LuUsers } from 'react-icons/lu';
import dayjs from 'dayjs';
import { logout } from '../../auth';
import useResource from '../../hooks/useResource';
import { MUTED, SERIF, TEAL, TEAL_LIGHT, TEXT, THEME, greeting } from './constants';
import './reception.css';

const MENU = [
  { to: '/reception', label: 'Patient Booking', icon: LuCalendar, end: true },
  { to: '/reception/check-in', label: 'Check-in', icon: LuClock },
  { to: '/reception/register', label: 'Register', icon: LuFileText },
  { to: '/reception/doctors', label: 'Doctors', icon: LuUsers },
  { to: '/reception/profile', label: 'Staff Profile', icon: LuUserRound },
];

const menuItemStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '11px 16px',
  borderRadius: 10,
  backgroundColor: active ? TEAL : 'transparent',
  color: active ? 'white' : TEXT,
  fontSize: 16,
  textDecoration: 'none',
  transition: 'background-color 0.2s',
});

/** Khung chung của giao diện Lễ tân: sidebar, header (tìm kiếm, thông báo, avatar) và nội dung trang. */
const ReceptionLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const onCheckInPage = location.pathname.endsWith('/check-in');
  const [headerSearch, setHeaderSearch] = useState('');

  const profile = useResource('reception/profile/');
  // Số lịch hẹn hôm nay chưa check-in -> hiện trên chuông thông báo.
  const waiting = useResource('reception/appointments/', {
    date: dayjs().format('YYYY-MM-DD'),
    status: 'Confirmed',
  });
  const waitingCount = waiting.data?.length || 0;

  const handleLogout = () => {
    logout();
    message.info('Logged out.');
    navigate('/login');
  };

  // Trên trang Check-in, ô tìm kiếm lọc trực tiếp danh sách; ở trang khác nhấn Enter để tìm.
  const searchValue = onCheckInPage ? searchParams.get('search') || '' : headerSearch;
  const handleSearchChange = (value) => {
    if (onCheckInPage) {
      const next = new URLSearchParams(searchParams);
      if (value) next.set('search', value);
      else next.delete('search');
      setSearchParams(next, { replace: true });
    } else {
      setHeaderSearch(value);
    }
  };
  const handleSearchSubmit = () => {
    if (onCheckInPage || !headerSearch.trim()) return;
    navigate(`/reception/check-in?search=${encodeURIComponent(headerSearch.trim())}`);
    setHeaderSearch('');
  };

  const outletContext = {
    profile: profile.data,
    reloadProfile: profile.reload,
    refreshCounts: waiting.reload,
  };

  return (
    <ConfigProvider theme={THEME}>
      <div className="rc-shell" style={{ fontFamily: SERIF }}>
        {/* ================= SIDEBAR ================= */}
        <aside className="rc-sidebar">
          <div>
            <div className="rc-brand" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, paddingLeft: 2 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: TEAL,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                <LuPill />
              </div>
              <div>
                <div style={{ fontSize: 22, lineHeight: 1.1 }}>Clinic</div>
                <div style={{ fontSize: 12, color: MUTED }}>Care made easy, every visit.</div>
              </div>
            </div>

            <nav className="rc-nav" aria-label="Reception navigation">
              {MENU.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} style={({ isActive }) => menuItemStyle(isActive)}>
                  <Icon style={{ fontSize: 18, flexShrink: 0 }} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <button
            type="button"
            className="rc-logout"
            onClick={handleLogout}
            style={{ ...menuItemStyle(false), border: 'none', background: 'none', cursor: 'pointer', fontFamily: SERIF, color: '#555' }}
          >
            <LuLogOut style={{ fontSize: 18 }} />
            <span>Log Out</span>
          </button>
        </aside>

        {/* ================= MAIN ================= */}
        <div className="rc-main">
          <header className="rc-header">
            <h1 style={{ fontSize: 18, fontWeight: 'normal', margin: 0, fontFamily: SERIF }}>
              {greeting()}
              {profile.data?.full_name ? `, ${profile.data.full_name}` : ''}!
            </h1>
            <div className="rc-header-tools">
              <Input
                className="rc-search"
                variant="filled"
                prefix={<LuSearch style={{ color: MUTED }} />}
                placeholder={onCheckInPage ? 'Search by Patient name, Phone, ...' : 'Search records...'}
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                onPressEnter={handleSearchSubmit}
                allowClear
                aria-label="Search appointments"
              />
              <Tooltip title={`${waitingCount} patient(s) waiting for check-in today`}>
                <Badge count={waitingCount} size="small" offset={[-2, 2]}>
                  <button
                    type="button"
                    aria-label="Patients waiting for check-in"
                    onClick={() => navigate('/reception/check-in')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: TEXT, display: 'flex' }}
                  >
                    <LuBell style={{ fontSize: 22 }} />
                  </button>
                </Badge>
              </Tooltip>
              <Avatar
                size={36}
                style={{ backgroundColor: TEAL_LIGHT, color: TEAL, cursor: 'pointer', fontFamily: SERIF, flexShrink: 0 }}
                onClick={() => navigate('/reception/profile')}
              >
                {profile.data?.avatar_initials || 'LT'}
              </Avatar>
            </div>
          </header>

          <main className="rc-content">
            {profile.error && (
              <Alert type="error" showIcon title={profile.error} action={<Button onClick={profile.reload}>Retry</Button>} />
            )}
            <Outlet context={outletContext} />
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default ReceptionLayout;
