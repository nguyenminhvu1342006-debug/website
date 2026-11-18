import { Empty, Spin, Tooltip } from 'antd';
import { BORDER, MUTED, SERIF, TEAL, TEAL_LIGHT, TEXT, formatDateShort, formatTime12h } from '../constants';

const STATE_HINT = { booked: 'Already booked', past: 'This time has passed' };

/**
 * Khung "Available Times" bên phải lịch.
 * mode = 'book'  : giờ đã đặt / đã qua bị khóa (trang Patient Booking).
 * mode = 'view'  : giờ đã đặt được tô màu để xem lịch bác sĩ (trang Doctors).
 */
const TimeSlotPanel = ({ date, slots, loading, error, value, onChange, placeholder, mode = 'book', footer }) => {
  let body;
  if (placeholder) {
    body = <div style={{ color: MUTED, fontSize: 14, padding: '18px 0' }}>{placeholder}</div>;
  } else if (loading) {
    body = (
      <div style={{ textAlign: 'center', padding: '28px 0' }}>
        <Spin />
      </div>
    );
  } else if (error) {
    body = <div style={{ color: MUTED, padding: '18px 0' }}>{error}</div>;
  } else if (!slots.length) {
    body = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No time slots" />;
  } else {
    body = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {slots.map(({ time, state }) => {
          const selected = time === value;
          const unavailable = state !== 'available';
          const booked = state === 'booked';
          const disabled = mode === 'book' ? unavailable : state !== 'available';

          let style = { backgroundColor: 'white', color: TEXT, borderColor: BORDER };
          if (selected) style = { backgroundColor: TEAL, color: 'white', borderColor: TEAL };
          else if (mode === 'view' && booked) style = { backgroundColor: TEAL_LIGHT, color: TEXT, borderColor: '#cfe4e5' };
          else if (unavailable) style = { backgroundColor: '#f3f4f5', color: '#b8bcc0', borderColor: BORDER };

          const button = (
            <button
              key={time}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(time)}
              style={{
                ...style,
                minWidth: 76,
                padding: '6px 12px',
                borderRadius: 999,
                borderWidth: 1,
                borderStyle: 'solid',
                fontFamily: SERIF,
                fontSize: 13,
                cursor: disabled ? 'not-allowed' : 'pointer',
                textDecoration: mode === 'book' && booked ? 'line-through' : 'none',
              }}
            >
              {formatTime12h(time)}
            </button>
          );
          return unavailable ? (
            <Tooltip key={time} title={STATE_HINT[state]}>
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f6f8f9', borderRadius: 12, padding: '18px 18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: 16 }}>Available Times</div>
        <div style={{ fontSize: 12, color: MUTED }}>{date ? formatDateShort(date) : ''}</div>
      </div>
      {body}
      {footer}
    </div>
  );
};

export default TimeSlotPanel;
