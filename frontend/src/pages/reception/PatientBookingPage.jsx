import { useState } from 'react';
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { Button, message } from 'antd';
import dayjs from 'dayjs';
import api from '../../api';
import { errorText } from '../../hooks/useResource';
import PatientSearch from '../../components/PatientSearch';
import DoctorPicker from './components/DoctorPicker';
import MonthCalendar from './components/MonthCalendar';
import SectionCard from './components/SectionCard';
import TimeSlotPanel from './components/TimeSlotPanel';
import useDoctors from './components/useDoctors';
import useSlotBoard from './components/useSlotBoard';
import { ALL_SPECIALTIES, MUTED, formatDateShort, formatTime12h } from './constants';

// Bệnh nhân từ /api/reception/patients/: id = mã bệnh nhân (PID), user_id = khóa dùng khi đặt lịch
const describePatient = (p) => `${p.full_name} (PID: ${p.id}${p.phone ? ` | Phone: ${p.phone}` : ''})`;

/** UC-08 — Đặt lịch hộ bệnh nhân. */
const PatientBookingPage = () => {
  const { refreshCounts } = useOutletContext();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Có thể mở trang với dữ liệu điền sẵn:
  //  - bệnh nhân vừa đăng ký: navigate('/reception', { state: { patient } })
  //  - từ trang Doctors: ?doctor=<id>&date=YYYY-MM-DD&time=HH:mm
  const [patient, setPatient] = useState(() => location.state?.patient || null);

  const { doctors, loading: loadingDoctors } = useDoctors();
  const [specialty, setSpecialty] = useState(ALL_SPECIALTIES);
  const [doctorId, setDoctorId] = useState(() => Number(searchParams.get('doctor')) || null);
  const [date, setDate] = useState(() => {
    const preset = searchParams.get('date');
    return preset && !dayjs(preset).isBefore(dayjs(), 'day') ? preset : dayjs().format('YYYY-MM-DD');
  });
  const [time, setTime] = useState(() => searchParams.get('time'));
  const [submitting, setSubmitting] = useState(false);

  const { slots, loading: loadingSlots, error: slotError, reload: reloadSlots } = useSlotBoard(doctorId, date);
  const doctor = doctors.find((d) => d.id === doctorId) || null;
  const timeIsAvailable = slots.some((s) => s.time === time && s.state === 'available');

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await api.post('reception/appointments/', {
        patient_user_id: patient.user_id,
        doctor_id: doctorId,
        date,
        time: `${time}:00`,
      });
      message.success(
        `Booked ${patient.full_name} with ${doctor?.name} on ${formatDateShort(date)} at ${formatTime12h(time)}.`
      );
      setTime(null);
      refreshCounts();
    } catch (error) {
      // UC-08 (2a): khung giờ vừa bị người khác đặt -> báo lỗi và tải lại giờ trống.
      message.error(errorText(error));
      setTime(null);
    } finally {
      setSubmitting(false);
      reloadSlots();
    }
  };

  const canConfirm = Boolean(patient && doctorId && date && time && timeIsAvailable);
  const summary = [
    `Patient: ${patient ? patient.full_name : '—'}`,
    doctor ? doctor.name : 'Doctor: —',
    doctor?.specialty,
    formatDateShort(date),
    time ? formatTime12h(time) : 'Time: —',
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <>
      <SectionCard title="Patient Information" subtitle="Enter Patient Phone Number or PID to lookup...">
        {/* Ô tìm bệnh nhân dùng chung của nhóm: gợi ý theo PID, tên, tài khoản, SĐT, địa chỉ */}
        <PatientSearch
          initialPatient={location.state?.patient}
          onSelect={setPatient}
          placeholder="Phone number, PID, name or address"
        />
        <div style={{ marginTop: 14, fontSize: 14, minHeight: 22 }}>
          {patient ? (
            <>
              Selected: {describePatient(patient)}{' '}
            </>
          ) : (
            <span style={{ color: MUTED }}>
              No patient selected. New patient? <Link to="/reception/register">Register first</Link>.
            </span>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Select Doctor & Specialty" subtitle="Choose a specialty and pick a doctor for your appointment.">
        <DoctorPicker
          doctors={doctors}
          loading={loadingDoctors}
          specialty={specialty}
          onSpecialtyChange={setSpecialty}
          selectedId={doctorId}
          onSelect={(d) => {
            setDoctorId(d.id);
            setTime(null);
          }}
        />
      </SectionCard>

      <SectionCard title="Date & Time Selection" subtitle="Pick a date and choose an available time slot.">
        <div className="rc-datetime">
          <MonthCalendar
            value={date}
            disablePast
            onChange={(d) => {
              setDate(d);
              setTime(null);
            }}
          />
          <TimeSlotPanel
            date={date}
            slots={slots}
            loading={loadingSlots}
            error={slotError}
            value={time}
            onChange={setTime}
            placeholder={doctorId ? null : 'Select a doctor to see available times.'}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <div className="rc-review">
          <div>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 'normal' }}>Review your selection</h3>
            <div style={{ marginTop: 4, fontSize: 13, color: MUTED }}>{summary}</div>
          </div>
          <Button
            type="primary"
            size="large"
            disabled={!canConfirm}
            loading={submitting}
            onClick={handleConfirm}
            style={{ minWidth: 150 }}
          >
            Confirm Booking
          </Button>
        </div>
      </SectionCard>
    </>
  );
};

export default PatientBookingPage;
