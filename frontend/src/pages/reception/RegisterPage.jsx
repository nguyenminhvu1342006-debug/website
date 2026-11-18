import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, DatePicker, Form, Input, Modal, Select, message } from 'antd';
import dayjs from 'dayjs';
import api from '../../api';
import { errorText } from '../../hooks/useResource';
import SectionCard from './components/SectionCard';
import { BORDER, MUTED, SERIF, TEAL, TEAL_LIGHT } from './constants';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const PHONE_RULE = { pattern: /^[0-9+\s.-]{8,20}$/, message: 'Invalid phone number.' };
const fieldStyle = { border: `1px solid ${BORDER}` };
const label = (text) => <span style={{ fontSize: 12, color: MUTED }}>{text}</span>;

/** '+84 902 123 456' -> '0902123456' (cùng quy tắc với backend: tên đăng nhập mặc định) */
const phoneToLogin = (phone) => {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`;
  return digits;
};

const initialsOf = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Avatar';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

/** UC-10 — Lễ tân tạo tài khoản và hồ sơ cho bệnh nhân lần đầu đến khám. */
const RegisterPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [modal, modalContext] = Modal.useModal();
  const [submitting, setSubmitting] = useState(false);
  const [existingPatient, setExistingPatient] = useState(null);
  const fullName = Form.useWatch('full_name', form);
  const phone = Form.useWatch('phone', form);

  const bookFor = (patient) => navigate('/reception', { state: { patient } });

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setExistingPatient(null);
    try {
      const { data } = await api.post('reception/patients/', {
        ...values,
        password: values.password || '',
        blood_type: values.blood_type || '',
        date_of_birth: values.date_of_birth ? values.date_of_birth.format('YYYY-MM-DD') : null,
      });
      form.resetFields();
      modal.success({
        title: 'Patient account created',
        content: (
          <div style={{ fontFamily: SERIF }} data-testid="new-account">
            <p style={{ margin: '8px 0' }}>
              {data.full_name} — PID: <strong>{data.id}</strong>
            </p>
            <p style={{ margin: '4px 0' }}>
              Username: <strong>{data.username}</strong>
            </p>
            <p style={{ margin: '4px 0' }}>
              Password: {data.initial_password ? <strong>{data.initial_password}</strong> : 'as entered'}
            </p>
            {data.initial_password && (
              <p style={{ color: MUTED, fontSize: 12 }}>
                Give these login details to the patient now — the password is shown only once. Ask them to change it after
                the first login.
              </p>
            )}
          </div>
        ),
        okText: 'Book an appointment',
        closable: true,
        onOk: () => bookFor(data),
      });
    } catch (error) {
      const fieldErrors = error.response?.data;
      if (fieldErrors?.existing_patient) {
        // UC-10 (2a): SĐT đã đăng ký -> gợi ý mở hồ sơ cũ thay vì tạo mới.
        const existing = fieldErrors.existing_patient;
        setExistingPatient({ ...existing, user_id: Number(existing.user_id), id: existing.patient_code });
      }
      if (fieldErrors && typeof fieldErrors === 'object') {
        form.setFields(
          Object.entries(fieldErrors)
            .filter(([name]) => Object.prototype.hasOwnProperty.call(values, name))
            .map(([name, errors]) => ({ name, errors: [].concat(errors).map(String) }))
        );
      }
      // Lỗi trùng SĐT đã hiện ngay dưới ô nhập và trong khung cảnh báo -> chỉ báo ngắn gọn.
      message.error(fieldErrors?.existing_patient ? [].concat(fieldErrors.phone).join(' ') : errorText(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {modalContext}
      <Form form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {existingPatient && (
          <Alert
            type="warning"
            showIcon
            title={`This phone number already belongs to ${existingPatient.full_name} (PID: ${existingPatient.patient_code}).`}
            description="Open the existing record instead of creating a new one."
            action={
              <Button size="small" onClick={() => bookFor(existingPatient)}>
                Book for this patient
              </Button>
            }
          />
        )}

        <SectionCard>
          <div className="rc-identity">
            <div
              style={{
                width: 104,
                height: 104,
                borderRadius: '50%',
                backgroundColor: TEAL_LIGHT,
                color: TEAL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: fullName?.trim() ? 36 : 30,
                flexShrink: 0,
                marginLeft: 16,
                marginTop: 4,
              }}
            >
              {initialsOf(fullName)}
            </div>
            <div className="rc-form-grid">
              <Form.Item name="full_name" label={label('Full Name')} rules={[{ required: true, whitespace: true, message: 'Please enter the full name.' }]}>
                <Input variant="filled" style={fieldStyle} placeholder="Nguyen Van A" maxLength={100} />
              </Form.Item>
              <Form.Item name="date_of_birth" label={label('Date of Birth')}>
                <DatePicker
                  variant="filled"
                  style={{ ...fieldStyle, width: '100%' }}
                  format="MMM DD, YYYY"
                  placeholder="Select date"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
              <Form.Item
                name="phone"
                label={label('Phone')}
                rules={[{ required: true, message: 'Phone number is required.' }, PHONE_RULE]}
                extra={
                  <span style={{ fontSize: 12 }}>
                    Login username: {phoneToLogin(phone) || 'the phone number'}
                  </span>
                }
              >
                <Input variant="filled" style={fieldStyle} placeholder="+84 902 123 456" maxLength={20} />
              </Form.Item>
              <Form.Item
                name="password"
                label={label('Password (auto-generated if empty)')}
                rules={[{ min: 8, message: 'At least 8 characters.' }]}
              >
                <Input.Password variant="filled" style={fieldStyle} placeholder="Leave empty to generate" autoComplete="new-password" />
              </Form.Item>
              <Form.Item name="address" label={label('Address')} style={{ gridColumn: '1 / -1' }}>
                <Input variant="filled" style={fieldStyle} maxLength={255} />
              </Form.Item>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Medical & Emergency Contact">
          <div className="rc-form-grid">
            <Form.Item name="blood_type" label={label('Blood Type')}>
              <Select
                variant="filled"
                allowClear
                placeholder="Unknown"
                style={{ ...fieldStyle, borderRadius: 8 }}
                options={BLOOD_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </Form.Item>
            <Form.Item name="known_allergies" label={label('Known Allergies')}>
              <Input variant="filled" style={fieldStyle} placeholder="e.g. Penicillin" maxLength={255} />
            </Form.Item>
            <Form.Item name="emergency_contact_name" label={label('Emergency Contact Name')}>
              <Input variant="filled" style={fieldStyle} maxLength={100} />
            </Form.Item>
            <Form.Item name="emergency_contact_phone" label={label('Emergency Contact Phone')} rules={[PHONE_RULE]}>
              <Input variant="filled" style={fieldStyle} maxLength={20} />
            </Form.Item>
          </div>
        </SectionCard>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" size="large" htmlType="submit" loading={submitting} style={{ minWidth: 190 }}>
            Create Patient Account
          </Button>
        </div>
      </Form>
    </>
  );
};

export default RegisterPage;
