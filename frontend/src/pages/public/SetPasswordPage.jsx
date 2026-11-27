import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import api from '../../api';
import { errorText } from '../../hooks/useResource';

export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const validLink = /^\d+$/.test(params.get('invitation') || '') && Boolean(params.get('token'));
  const submit = async (values) => {
    setSaving(true); setError('');
    try {
      await api.post('account/set-password/', { ...values, invitation: Number(params.get('invitation')), token: params.get('token') });
      setDone(true);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };
  return <main style={{ maxWidth: 480, margin: '60px auto', padding: 24 }}>
    <h1>Thiết lập mật khẩu</h1>
    {done ? <><Alert type="success" title="Thiết lập mật khẩu thành công." /><p><Link to="/login">Đăng nhập</Link></p></>
      : !validLink ? <Alert type="error" title="Link không hợp lệ. Vui lòng liên hệ lễ tân để gửi lại lời mời." />
        : <><p>Tạo mật khẩu riêng cho tài khoản bệnh nhân của bạn.</p>
          {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}
          <Form layout="vertical" onFinish={submit}>
            <Form.Item name="password" label="Mật khẩu mới" rules={[{ required: true, min: 8, max: 128 }]}><Input.Password autoComplete="new-password" /></Form.Item>
            <Form.Item name="password_confirm" label="Xác nhận mật khẩu" dependencies={['password']}
              rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, value) =>
                value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('Mật khẩu xác nhận không khớp.')) })]}>
              <Input.Password autoComplete="new-password" /></Form.Item>
            <Button htmlType="submit" type="primary" loading={saving}>Lưu mật khẩu</Button>
          </Form></>}
  </main>;
}
