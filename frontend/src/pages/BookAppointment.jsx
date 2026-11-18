import { useState } from 'react';
import { Alert, Avatar, Button, Calendar, Empty, Select, Spin, message } from 'antd';
import dayjs from 'dayjs';
import api from '../api';
import useResource, { errorText } from '../hooks/useResource';

export default function BookAppointment({ preSelectedDoctor, patientUserId, onBooked, rescheduleId }) {
  const doctors = useResource('doctors/');
  const [specialty, setSpecialty] = useState(preSelectedDoctor?.specialty || '');
  const [doctorId, setDoctorId] = useState(preSelectedDoctor?.id || null);
  const [date, setDate] = useState(dayjs());
  const [selection, setSelection] = useState(null);
  const [saving, setSaving] = useState(false);
  const allDoctors = doctors.data || [];
  const selectedSpecialty = specialty || allDoctors[0]?.specialty || '';
  const filtered = allDoctors.filter((doctor) => doctor.specialty === selectedSpecialty);
  const doctor = filtered.find((item) => item.id === doctorId) || filtered[0];
  const day = date.format('YYYY-MM-DD');
  const slots = useResource(doctor ? 'slots/' : null, { doctor_id: doctor?.id, date: day });
  const slotKey = `${doctor?.id}:${day}`;
  const selectedTime = selection?.key === slotKey ? selection.time : '';

  const confirm = async () => {
    if (!doctor || !selectedTime || !slots.data?.available_slots.includes(selectedTime)) return;
    setSaving(true);
    try {
      const payload = { doctor_id: doctor.id, date: day, time: selectedTime };
      if (patientUserId) payload.patient_user_id = patientUserId;
      if (rescheduleId) payload.action = 'reschedule';
      await api.post(rescheduleId ? `reception/appointments/${rescheduleId}/`
        : patientUserId ? 'reception/appointments/' : 'book/', payload);
      message.success(rescheduleId ? 'Đã đổi lịch hẹn.' : 'Đặt lịch thành công.');
      setSelection(null);
      slots.reload();
      onBooked?.({ date: day });
    } catch (error) {
      message.error(errorText(error));
      setSelection(null);
      slots.reload();
    } finally { setSaving(false); }
  };
  return <div className="stack">
    <section className="panel">
      <h2>Chọn bác sĩ và chuyên khoa</h2>
      {doctors.error ? <Alert type="error" title={doctors.error} action={<Button onClick={doctors.reload}>Thử lại</Button>} />
        : doctors.loading ? <Spin /> : !allDoctors.length ? <Empty description="Chưa có bác sĩ." /> : <>
          <Select aria-label="Chuyên khoa" value={selectedSpecialty} className="full-width"
            options={[...new Set(allDoctors.map((item) => item.specialty))].map((value) => ({ value, label: value }))}
            onChange={(value) => { setSpecialty(value); setDoctorId(null); setSelection(null); }} />
          <div className="doctor-choice-grid">{filtered.map((item) => <button type="button" key={item.id}
            aria-pressed={item.id === doctor?.id} className={`doctor-choice ${item.id === doctor?.id ? 'selected' : ''}`}
            onClick={() => { setDoctorId(item.id); setSelection(null); }}>
            <Avatar size={48}>{item.initials}</Avatar><strong>{item.name}</strong><span>{item.specialty}</span>
            <span>{item.id === doctor?.id ? 'Đã chọn' : 'Chọn bác sĩ'}</span>
          </button>)}</div>
        </>}
    </section>
    <section className="panel booking-date-grid">
      <div className="booking-calendar"><Calendar fullscreen={false} value={date}
        onSelect={(value) => { setDate(value); setSelection(null); }}
        disabledDate={(value) => value.isBefore(dayjs().startOf('day'))} /></div>
      <div><h2>Giờ khám còn trống</h2><p>{date.format('DD/MM/YYYY')}</p>
        {slots.loading ? <Spin /> : slots.error ? <Alert type="error" title={slots.error}
          action={<Button onClick={slots.reload}>Thử lại</Button>} /> : !doctor ? <Empty description="Chọn bác sĩ trước." />
          : !slots.data?.available_slots.length ? <Empty description="Không còn giờ trống. Hãy chọn ngày khác." />
            : <div className="slot-grid">{slots.data.available_slots.map((time) => <Button key={time}
              type={time === selectedTime ? 'primary' : 'default'}
              onClick={() => setSelection({ key: slotKey, time })}>{time.slice(0, 5)}</Button>)}</div>}
      </div>
    </section>
    <section className="panel booking-summary"><div><h2>Xác nhận lịch khám</h2>
      <p>{doctor?.name || 'Chưa chọn bác sĩ'} · {date.format('DD/MM/YYYY')} · {selectedTime?.slice(0, 5) || 'Chưa chọn giờ'}</p></div>
      <Button type="primary" size="large" loading={saving} onClick={confirm}
        disabled={!selectedTime || slots.loading || Boolean(slots.error) || !doctor}>Xác nhận</Button>
    </section>
  </div>;
}
