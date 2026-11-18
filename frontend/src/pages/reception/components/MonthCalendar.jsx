import { useState } from 'react';
import dayjs from 'dayjs';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { BORDER, MUTED, SERIF, TEAL, TEXT } from '../constants';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const navButtonStyle = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  backgroundColor: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: TEXT,
};

/**
 * Lịch tháng dạng gọn như mockup (tuần bắt đầu từ Thứ Hai).
 * value: 'YYYY-MM-DD' | null; onChange(dateString); disablePast: chặn chọn ngày đã qua.
 */
const MonthCalendar = ({ value, onChange, disablePast = false }) => {
  const [month, setMonth] = useState(() => dayjs(value || undefined).startOf('month'));
  const today = dayjs().startOf('day');

  const leadingBlanks = (month.day() + 6) % 7; // Chủ nhật = 0 -> Thứ Hai là cột đầu tiên
  const cells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1)),
  ];

  return (
    <div style={{ backgroundColor: '#f6f8f9', borderRadius: 12, padding: '18px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 16 }}>{month.format('MMMM YYYY')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            aria-label="Previous month"
            style={navButtonStyle}
            onClick={() => setMonth((m) => m.subtract(1, 'month'))}
          >
            <LuChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Next month"
            style={navButtonStyle}
            onClick={() => setMonth((m) => m.add(1, 'month'))}
          >
            <LuChevronRight />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 6, textAlign: 'center' }}>
        {WEEKDAYS.map((day) => (
          <div key={day} style={{ fontSize: 11, color: MUTED, paddingBottom: 6 }}>
            {day}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} />;
          const iso = day.format('YYYY-MM-DD');
          const selected = iso === value;
          const disabled = disablePast && day.isBefore(today);
          const isToday = day.isSame(today);
          return (
            <div key={iso} style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(iso)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  border: 'none',
                  fontFamily: SERIF,
                  fontSize: 14,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  backgroundColor: selected ? TEAL : 'transparent',
                  color: selected ? 'white' : disabled ? '#c4c8cc' : TEXT,
                  fontWeight: isToday && !selected ? 'bold' : 'normal',
                  textDecoration: isToday && !selected ? 'underline' : 'none',
                }}
              >
                {day.date()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthCalendar;
