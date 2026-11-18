import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import dayjs from 'dayjs';
import DoctorPicker from './components/DoctorPicker';
import MonthCalendar from './components/MonthCalendar';
import SectionCard from './components/SectionCard';
import TimeSlotPanel from './components/TimeSlotPanel';
import useDoctors from './components/useDoctors';
import useSlotBoard from './components/useSlotBoard';
import { ALL_SPECIALTIES, BORDER, MUTED, TEAL, TEAL_LIGHT, formatTime12h } from './constants';

const LegendDot = ({ color, border, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}>
    <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color, border: `1px solid ${border}` }} />
    {label}
  </span>
);

/** Xem lịch làm việc của bác sĩ: giờ nào đã có hẹn, giờ nào còn trống. */
const DoctorsPage = () => {
  const navigate = useNavigate();
  const { doctors, loading: loadingDoctors } = useDoctors();
  const [specialty, setSpecialty] = useState(ALL_SPECIALTIES);
  const [selectedId, setSelectedId] = useState(null);
  const [date, setDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [time, setTime] = useState(null);

  // Mặc định chọn bác sĩ đầu tiên đang hiển thị để lịch luôn có dữ liệu.
  const visibleDoctors = specialty === ALL_SPECIALTIES ? doctors : doctors.filter((d) => d.specialty === specialty);
  const doctorId = visibleDoctors.some((d) => d.id === selectedId) ? selectedId : visibleDoctors[0]?.id ?? null;
  const { slots, loading, error } = useSlotBoard(doctorId, date);

  const bookedCount = slots.filter((s) => s.state === 'booked').length;
  const freeCount = slots.filter((s) => s.state === 'available').length;
  const selectedTimeFree = slots.some((s) => s.time === time && s.state === 'available');

  return (
    <>
      <SectionCard title="Select Doctor & Specialty" subtitle="Choose a specialty and pick a doctor to view the schedule.">
        <DoctorPicker
          doctors={doctors}
          loading={loadingDoctors}
          specialty={specialty}
          onSpecialtyChange={(value) => {
            setSpecialty(value);
            setTime(null);
          }}
          selectedId={doctorId}
          onSelect={(d) => {
            setSelectedId(d.id);
            setTime(null);
          }}
        />
      </SectionCard>

      <SectionCard
        title="Date & Time"
        subtitle={
          doctorId && !loading
            ? `Available time slot. ${freeCount} free • ${bookedCount} booked on this day.`
            : 'Available time slot.'
        }
        extra={
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <LegendDot color="white" border={BORDER} label="Available" />
            <LegendDot color={TEAL_LIGHT} border="#cfe4e5" label="Booked" />
            <LegendDot color={TEAL} border={TEAL} label="Selected" />
          </div>
        }
      >
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
            mode="view"
            date={date}
            slots={slots}
            loading={loading}
            error={error}
            value={time}
            onChange={setTime}
            placeholder={doctorId ? null : 'No doctor to display.'}
            footer={
              selectedTimeFree && (
                <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="primary"
                    onClick={() => navigate(`/reception?doctor=${doctorId}&date=${date}&time=${time}`)}
                  >
                    Book {formatTime12h(time)} for a patient
                  </Button>
                </div>
              )
            }
          />
        </div>
      </SectionCard>
    </>
  );
};

export default DoctorsPage;
