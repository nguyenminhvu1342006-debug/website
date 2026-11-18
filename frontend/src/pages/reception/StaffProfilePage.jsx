import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button, Form, Input, Spin, message } from 'antd';
import api from '../../api';
import SectionCard from './components/SectionCard';
import { errorText } from '../../hooks/useResource';
import { BORDER, MUTED, TEAL, TEAL_LIGHT } from './constants';

const fieldStyle = { border: `1px solid ${BORDER}` };
const label = (text) => <span style={{ fontSize: 12, color: MUTED }}>{text}</span>;
const EDITABLE = [
  'full_name',
  'phone',
  'email',
  'position',
  'assigned_counter',
  'department',
  'current_shift',
];

const ProfileForm = ({ profile, onSaved }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(EDITABLE.map((key) => [key, values[key] ?? '']));
      const { data } = await api.put('reception/profile/', payload);
      message.success('Profile saved.');
      onSaved(data);
    } catch (error) {
      const fieldErrors = error.response?.data;
      if (fieldErrors && typeof fieldErrors === 'object') {
        form.setFields(
          Object.entries(fieldErrors)
            .filter(([name]) => EDITABLE.includes(name))
            .map(([name, errors]) => ({ name, errors: [].concat(errors).map(String) }))
        );
      }
      message.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={profile}
      onFinish={handleSave}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
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
              fontSize: 36,
              flexShrink: 0,
              marginLeft: 16,
              marginTop: 4,
            }}
          >
            {profile.avatar_initials}
          </div>
          <div className="rc-form-grid">
            <Form.Item
              name="full_name"
              label={label('Full Name')}
              rules={[{ required: true, whitespace: true, message: 'Please enter your full name.' }]}
            >
              <Input variant="filled" style={fieldStyle} />
            </Form.Item>
            <Form.Item name="staff_code" label={label('Staff ID')}>
              <Input variant="filled" style={fieldStyle} disabled />
            </Form.Item>
            <Form.Item
              name="phone"
              label={label('Phone')}
              rules={[{ pattern: /^[0-9+\s.-]{8,20}$/, message: 'Invalid phone number.' }]}
            >
              <Input variant="filled" style={fieldStyle} />
            </Form.Item>
            <Form.Item name="email" label={label('Work Email')} rules={[{ type: 'email', message: 'Invalid email.' }]}>
              <Input variant="filled" style={fieldStyle} />
            </Form.Item>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Work & Assignment Details">
        <div className="rc-form-grid">
          <Form.Item name="position" label={label('Position')}>
            <Input variant="filled" style={fieldStyle} />
          </Form.Item>
          <Form.Item name="assigned_counter" label={label('Assigned Counter')}>
            <Input variant="filled" style={fieldStyle} placeholder="e.g. Desk 01" />
          </Form.Item>
          <Form.Item name="department" label={label('Department')}>
            <Input variant="filled" style={fieldStyle} placeholder="e.g. Outpatient Admission" />
          </Form.Item>
          <Form.Item name="current_shift" label={label('Current Shift')}>
            <Input variant="filled" style={fieldStyle} placeholder="e.g. Morning Shift (07:30 - 15:30)" />
          </Form.Item>
        </div>
      </SectionCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" size="large" htmlType="submit" loading={saving} style={{ minWidth: 150 }}>
          Save Changes
        </Button>
      </div>
    </Form>
  );
};

/** Hồ sơ nhân viên Lễ tân (dữ liệu lấy từ layout để header cập nhật ngay sau khi lưu). */
const StaffProfilePage = () => {
  const { profile, reloadProfile } = useOutletContext();
  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }
  // key: dựng lại form khi hồ sơ được tải lại sau khi lưu
  return <ProfileForm key={JSON.stringify(profile)} profile={profile} onSaved={reloadProfile} />;
};

export default StaffProfilePage;
