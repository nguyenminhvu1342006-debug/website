import { useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Alert, Button, Empty, Modal, Pagination, Popconfirm, Spin, Tabs, Tooltip, message } from 'antd';
import { LuPrinter } from 'react-icons/lu';
import dayjs from 'dayjs';
import api from '../../api';
import useResource, { errorText } from '../../hooks/useResource';
import BookAppointment from '../shared/BookAppointment';
import { BORDER, DANGER, MUTED, SERIF, STATUS_META, TEAL, TEAL_LIGHT, formatDateShort, formatTime12h } from './constants';

const PAGE_SIZE = 10;

const tabParams = (tab, search) => {
  const today = dayjs().format('YYYY-MM-DD');
  const params =
    tab === 'checkin'
      ? { status: 'Confirmed', date_from: today }
      : { status: 'Checked-in,Completed', date_to: today, order: 'desc' };
  // Tìm theo mã lịch hẹn (#12) có thể là lịch của ngày khác -> mở rộng khoảng ngày.
  if (search) Object.assign(params, { search, date_from: params.date_from || '2000-01-01' });
  return params;
};

const initialsOf = (name) => {
  const parts = (name || '').split(' ').filter(Boolean);
  return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() : 'DR';
};

const StatusTag = ({ status, queueNumber }) => {
  const meta = STATUS_META[status] || { label: status, color: MUTED, bg: '#f2f2f2' };
  return (
    <span style={{ display: 'inline-block', fontSize: 11, padding: '2px 7px', borderRadius: 4, backgroundColor: meta.bg, color: meta.color }}>
      {meta.label}
      {queueNumber ? ` • No. ${queueNumber}` : ''}
    </span>
  );
};

const AppointmentCard = ({ appointment, busy, showActions, onCheckIn, onCancel, onReschedule }) => {
  const patient = appointment.patient_info;
  const isToday = appointment.date === dayjs().format('YYYY-MM-DD');
  const linkButton = { border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0 };

  return (
    <div
      className="rc-appt-card"
      data-testid="appointment-card"
      style={{ backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, boxShadow: '0 2px 10px rgba(0,0,0,0.03)', padding: 18 }}
    >
      <div className="rc-appt-when">
        <div style={{ fontSize: 16 }}>{formatDateShort(appointment.date)}</div>
        <div style={{ fontSize: 12, color: MUTED }}>
          {formatTime12h(appointment.time)} • #{appointment.id}
        </div>
      </div>
      <div
        style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: TEAL_LIGHT, color: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
      >
        {initialsOf(appointment.doctor_name)}
      </div>
      <div>
        <div style={{ fontSize: 15 }}>Dr. {appointment.doctor_name}</div>
        <div style={{ fontSize: 12, color: MUTED, margin: '2px 0 4px' }}>{appointment.doctor_specialty || 'General'}</div>
        <StatusTag status={appointment.status} queueNumber={appointment.queue_number} />
      </div>
      <div className="rc-appt-patient" style={{ fontSize: 13 }}>
        <div style={{ color: MUTED, fontSize: 11 }}>Patient</div>
        <div style={{ fontSize: 15 }}>{patient?.full_name}</div>
        <div style={{ color: MUTED, fontSize: 12 }}>
          PID: {patient?.patient_code}
          {patient?.phone ? ` • ${patient.phone}` : ''}
        </div>
      </div>
      <div className="rc-appt-actions">
        {showActions && (
          <>
            <Tooltip title={isToday ? null : 'Check-in opens on the appointment day.'}>
              <Button loading={busy === 'check-in'} disabled={!isToday || Boolean(busy)} onClick={() => onCheckIn(appointment)}>
                Check-in
              </Button>
            </Tooltip>
            <button type="button" style={{ ...linkButton, color: TEAL }} disabled={Boolean(busy)} onClick={() => onReschedule(appointment)}>
              Reschedule
            </button>
            <Popconfirm
              title="Cancel this appointment?"
              description={`${patient?.full_name} • ${formatDateShort(appointment.date)} ${formatTime12h(appointment.time)}`}
              okText="Cancel appointment"
              cancelText="Keep"
              okButtonProps={{ danger: true }}
              onConfirm={() => onCancel(appointment)}
            >
              <button type="button" style={{ ...linkButton, color: DANGER }} disabled={Boolean(busy)}>
                Cancel
              </button>
            </Popconfirm>
          </>
        )}
      </div>
    </div>
  );
};

/** Phiếu số thứ tự sau khi check-in (UC-09 bước 3). */
const QueueTicket = ({ ticket, onClose }) => (
  <Modal
    open={Boolean(ticket)}
    onCancel={onClose}
    title="Check-in successful"
    footer={[
      <Button key="close" onClick={onClose}>
        Close
      </Button>,
      <Button key="print" type="primary" icon={<LuPrinter />} onClick={() => window.print()}>
        Print ticket
      </Button>,
    ]}
  >
    {ticket && (
      <div className="queue-ticket" style={{ textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: 12, padding: 20, fontFamily: SERIF }}>
        <div style={{ fontSize: 13, color: MUTED }}>Clinic — Queue ticket</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>Your number</div>
        <div style={{ fontSize: 56, color: TEAL, lineHeight: 1.1 }} data-testid="queue-number">
          {ticket.queueNumber}
        </div>
        <div style={{ fontSize: 16, marginTop: 8 }}>{ticket.patient}</div>
        <div style={{ fontSize: 13, color: MUTED }}>
          Dr. {ticket.doctor} • {formatTime12h(ticket.time)} • {dayjs().format('MMM D, YYYY')}
        </div>
      </div>
    )}
  </Modal>
);

/** UC-09 — Check-in bệnh nhân và cấp số thứ tự hàng chờ. */
const CheckInPage = () => {
  const { refreshCounts } = useOutletContext();
  const [searchParams] = useSearchParams();
  const search = (searchParams.get('search') || '').trim();

  const [tab, setTab] = useState('checkin');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState({ id: null, action: null });
  const [ticket, setTicket] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);

  const list = useResource('reception/appointments/', tabParams(tab, search));
  const items = list.data || [];
  const currentPage = Math.min(page, Math.max(1, Math.ceil(items.length / PAGE_SIZE)));
  const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const runAction = async (appointment, action) => {
    setBusy({ id: appointment.id, action });
    try {
      const { data } = await api.post(`reception/appointments/${appointment.id}/`, { action });
      if (action === 'check-in') {
        setTicket({
          queueNumber: data.queue_number,
          patient: appointment.patient_info?.full_name,
          doctor: appointment.doctor_name,
          time: appointment.time,
        });
      } else {
        message.success(`Appointment of ${appointment.patient_info?.full_name} was cancelled.`);
      }
      list.reload();
      refreshCounts();
    } catch (error) {
      message.error(errorText(error));
    } finally {
      setBusy({ id: null, action: null });
    }
  };

  let body;
  if (list.loading) {
    body = (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  } else if (list.error) {
    body = <Alert type="error" showIcon title={list.error} action={<Button onClick={list.reload}>Retry</Button>} />;
  } else if (items.length === 0) {
    body = (
      <div style={{ backgroundColor: 'white', borderRadius: 12, border: `1px solid ${BORDER}`, padding: 30 }}>
        <Empty
          description={
            search ? (
              // UC-09 (1b) và (1a): không tìm thấy -> gợi ý đăng ký / đặt lịch tức thì cho khách vãng lai
              <span>
                No valid appointment found for “{search}”.
                <br />
                Walk-in patient? <Link to="/reception/register">Register</Link> or{' '}
                <Link to="/reception">book an appointment</Link>.
              </span>
            ) : tab === 'checkin' ? (
              'No upcoming appointments waiting for check-in.'
            ) : (
              'No checked-in or completed visits yet.'
            )
          }
        />
      </div>
    );
  } else {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {pageItems.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            busy={busy.id === appointment.id ? busy.action : null}
            showActions={tab === 'checkin'}
            onCheckIn={(a) => runAction(a, 'check-in')}
            onCancel={(a) => runAction(a, 'cancel')}
            onReschedule={setRescheduling}
          />
        ))}
        {items.length > PAGE_SIZE && (
          <Pagination align="end" current={currentPage} pageSize={PAGE_SIZE} total={items.length} onChange={setPage} showSizeChanger={false} />
        )}
      </div>
    );
  }

  return (
    <>
      <Tabs
        activeKey={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
        }}
        items={[
          { key: 'checkin', label: 'Check-in' },
          { key: 'completed', label: 'Completed' },
        ]}
        style={{ marginBottom: -8 }}
      />
      {search && <div style={{ fontSize: 13, color: MUTED }}>Showing results for “{search}”.</div>}
      {body}

      <QueueTicket ticket={ticket} onClose={() => setTicket(null)} />

      <Modal
        open={Boolean(rescheduling)}
        title={`Reschedule — ${rescheduling?.patient_info?.full_name || ''}`}
        width={1000}
        footer={null}
        onCancel={() => setRescheduling(null)}
        destroyOnHidden
      >
        {rescheduling && (
          <BookAppointment
            key={rescheduling.id}
            rescheduleId={rescheduling.id}
            onBooked={() => {
              setRescheduling(null);
              list.reload();
              refreshCounts();
            }}
          />
        )}
      </Modal>
    </>
  );
};

export default CheckInPage;
