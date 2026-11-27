import { useState } from 'react';
import { Alert, Button, DatePicker, Form, Input, Modal, Popconfirm, Spin, Table, Tag, message } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api';
import useResource, { errorText } from '../../hooks/useResource';
import Workspace from '../../components/Workspace';
import PatientSearch from '../../components/PatientSearch';
import BookAppointment from '../shared/BookAppointment';

const menu = [
  { key: 'appointments', label: 'Appointments & Check-in', icon: <CheckCircleOutlined /> },
  { key: 'booking', label: 'Book Appointment', icon: <CalendarOutlined /> },
  { key: 'patients', label: 'Patient Registration', icon: <TeamOutlined /> },
  { key: 'profile', label: 'My Profile', icon: <UserOutlined /> },
];
const statusNames = { Confirmed: 'Chưa check-in', 'Checked-in': 'Chờ khám', Completed: 'Đã khám', Cancelled: 'Đã hủy', 'No-show': 'Không đến khám' };

function ReceptionProfile({ profile, onSaved }) {
  const [saving, setSaving] = useState(false);
  return <section className="panel"><h2>Hồ sơ lễ tân</h2><Form layout="vertical" initialValues={profile}
    onFinish={async (values) => {
      setSaving(true);
      try { await api.put('reception/profile/', values); message.success('Đã cập nhật hồ sơ.'); onSaved(); }
      catch (error) { message.error(errorText(error)); }
      finally { setSaving(false); }
    }}>
    <Form.Item label="Tên đăng nhập"><Input value={profile.username} disabled /></Form.Item>
    <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
    <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
    <Button htmlType="submit" type="primary" loading={saving}>Lưu thay đổi</Button>
  </Form></section>;
}

export default function ReceptionDashboard() {
  const [active, setActive] = useState('appointments');
  const [day, setDay] = useState(dayjs());
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const patientId = selectedPatient?.user_id;
  const [registering, setRegistering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  const [form] = Form.useForm();
  const profile = useResource('reception/profile/');
  const appointments = useResource('reception/appointments/', { date: day.format('YYYY-MM-DD'), search });
  const patients = useResource(active === 'patients' ? 'reception/patients/' : null, { search });
  const act = async (id, action) => {
    setBusy(id);
    try { await api.post(`reception/appointments/${id}/`, { action }); message.success('Đã cập nhật.'); appointments.reload(); }
    catch (error) { message.error(errorText(error)); }
    finally { setBusy(null); }
  };
  const register = async (values) => {
    setSaving(true);
    try {
      const { data } = await api.post('reception/patients/', {
        ...values, date_of_birth: values.date_of_birth?.format('YYYY-MM-DD') || null,
      });
      message.success('Đăng ký bệnh nhân thành công.');
      window.dispatchEvent(new Event('notifications-updated'));
      setSelectedPatient({ ...data, username: values.username }); setSearch(''); patients.reload();
      setRegistering(false); form.resetFields();
    } catch (error) { message.error(errorText(error)); }
    finally { setSaving(false); }
  };
  return <Workspace menu={menu} active={active} onChange={(key) => { setActive(key); setSearch(''); }}
    profile={profile.data} subtitle="Reception Workspace" logoutLabel="Log Out">
    {profile.error && <Alert type="error" title={profile.error} action={<Button onClick={profile.reload}>Thử lại</Button>} />}
    {active === 'appointments' && <section className="panel"><h2>Lịch hẹn & Check-in</h2>
      <div className="toolbar"><DatePicker value={day} allowClear={false} onChange={setDay} />
        <PatientSearch placeholder="Tên, tài khoản, số điện thoại hoặc ID" onSearch={setSearch} style={{ width: 360, maxWidth: '100%' }} />
        <Button onClick={appointments.reload}>Làm mới</Button></div>
      {appointments.error ? <Alert type="error" title={appointments.error} /> : <Table rowKey="id" loading={appointments.loading}
        dataSource={appointments.data || []} scroll={{ x: 850 }} columns={[
          { title: 'Giờ hẹn', dataIndex: 'time' },
          { title: 'Bệnh nhân', render: (_, row) => <><strong>{row.patient_info.full_name}</strong><br />{row.patient_info.patient_code} · {row.patient_info.phone}</> },
          { title: 'Bác sĩ', dataIndex: 'doctor_name' },
          { title: 'Trạng thái', dataIndex: 'status', render: (value) => <Tag color={value === 'Checked-in' ? 'cyan' : 'default'}>{statusNames[value]}</Tag> },
          { title: 'Thao tác', render: (_, row) => row.status === 'Confirmed' && <div className="actions">
            <Button type="primary" loading={busy === row.id} disabled={!day.isSame(dayjs(), 'day')}
              onClick={() => act(row.id, 'check-in')}>Check-in</Button>
            <Button onClick={() => setReschedule(row)}>Đổi lịch</Button>
            <Popconfirm title="Hủy lịch hẹn này?" onConfirm={() => act(row.id, 'cancel')}><Button danger disabled={busy === row.id}>Hủy</Button></Popconfirm>
          </div> },
        ]} />}
    </section>}
    {(active === 'booking' || active === 'patients') && <>
      <section className="panel"><h2>{active === 'booking' ? 'Đặt lịch cho bệnh nhân' : 'Danh sách bệnh nhân'}</h2>
        {active === 'booking' && <p>Đặt lịch hộ bệnh nhân đã có tài khoản. Với bệnh nhân mới, vui lòng vào mục Đăng ký bệnh nhân trước.</p>}
        {active === 'patients' && <div className="toolbar"><PatientSearch key={active} onSearch={setSearch} style={{ width: 360, maxWidth: '100%' }} />
          <Button type="primary" onClick={() => setRegistering(true)}>Đăng ký bệnh nhân mới</Button></div>}
        {patients.error && <Alert type="error" title={patients.error} action={<Button onClick={patients.reload}>Thử lại</Button>} />}
        {active === 'booking' ? <PatientSearch initialPatient={selectedPatient} onSelect={setSelectedPatient} />
          : <Table rowKey="user_id" loading={patients.loading} dataSource={patients.data || []} scroll={{ x: 650 }} columns={[
            { title: 'Mã bệnh nhân', dataIndex: 'id' }, { title: 'Họ tên', dataIndex: 'full_name' },
            { title: 'Tài khoản', dataIndex: 'username' }, { title: 'Số điện thoại', dataIndex: 'phone' },
            { title: 'Thao tác', render: (_, row) => <Button onClick={() => { setSelectedPatient(row); setSearch(''); setActive('booking'); }}>Đặt lịch</Button> },
          ]} />}
      </section>
      {active === 'booking' && patientId && <BookAppointment key={patientId} patientUserId={patientId}
        onBooked={({ date }) => { setDay(dayjs(date)); setActive('appointments'); appointments.reload(); }} />}
    </>}
    {active === 'profile' && (profile.loading ? <Spin /> : profile.data && <ReceptionProfile key={JSON.stringify(profile.data)} profile={profile.data} onSaved={profile.reload} />)}
    <Modal open={registering} title="Đăng ký bệnh nhân" onCancel={() => !saving && setRegistering(false)} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={register}>
        <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]}><Input maxLength={150} autoComplete="off" /></Form.Item>
        <Form.Item name="password" label="Mật khẩu ban đầu" rules={[{ required: true, min: 8 }]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item name="date_of_birth" label="Ngày sinh"><DatePicker disabledDate={(value) => value.isAfter(dayjs(), 'day')} /></Form.Item>
        <Form.Item name="phone" label="Số điện thoại"><Input maxLength={20} /></Form.Item>
        <Form.Item name="address" label="Địa chỉ"><Input maxLength={255} /></Form.Item>
        <Button htmlType="submit" type="primary" loading={saving}>Tạo tài khoản</Button>
      </Form>
    </Modal>
    <Modal open={Boolean(reschedule)} title="Đổi lịch khám" width={1000} footer={null} onCancel={() => setReschedule(null)} destroyOnHidden>
      {reschedule && <BookAppointment key={reschedule.id} rescheduleId={reschedule.id}
        onBooked={() => { setReschedule(null); appointments.reload(); }} />}
    </Modal>
  </Workspace>;
}
