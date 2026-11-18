import { useState } from 'react';
import { Alert, Button, DatePicker, Empty, Segmented, Spin, Tag } from 'antd';
import useResource from '../hooks/useResource';
import MedicalRecordDetail from '../components/MedicalRecordDetail';
import PatientSearch from '../components/PatientSearch';

export default function MedicalRecords({ role = 'patient', initialPatient, initialRecordId, initialSearch = '', onClearContext }) {
  const [search, setSearch] = useState(role === 'doctor' ? initialSearch : '');
  const [period, setPeriod] = useState({ mode: 'date', value: null });
  const [chosen, setChosen] = useState(null);
  const [closedInitial, setClosedInitial] = useState(false);
  const records = useResource(role === 'doctor' ? 'doctor/records/' : 'my-records/', {
    ...(role === 'doctor' ? { search } : {}), ...(period.value ? period.mode === 'year'
      ? { year: period.value.year() } : { date: period.value.format('YYYY-MM-DD') } : {}),
    ...(initialPatient ? { patient_user_id: initialPatient.user_id } : {}),
  });
  const detailId = chosen || (!closedInitial ? initialRecordId : null);
  return <div className="stack">
    <div><h2>Medical Records</h2><p>{role === 'doctor' ? 'Bệnh án và đơn thuốc đã hoàn tất.' : 'Kết quả khám và đơn thuốc của bạn.'}</p></div>
    {initialPatient && <Alert type="info" title={`Tiền sử: ${initialPatient.full_name} (${initialPatient.patient_code})`}
      action={<Button onClick={onClearContext}>Xem bệnh án do tôi lập</Button>} />}
    <section className="panel"><div className="toolbar">
      {role === 'doctor' && <PatientSearch source="doctor/patients/" initialSearch={initialSearch}
        placeholder="ID, bệnh nhân, chẩn đoán hoặc thuốc" onSearch={setSearch} style={{ width: 360, maxWidth: '100%' }} />}
      <DatePicker aria-label="Lọc ngày hoặc năm khám" placeholder="Ngày hoặc năm khám"
        picker={period.mode} format={period.mode === 'year' ? 'YYYY' : 'DD/MM/YYYY'} value={period.value}
        onChange={(value) => setPeriod((current) => ({ ...current, value }))}
        renderExtraFooter={() => <Segmented aria-label="Kiểu lọc thời gian" value={period.mode}
          options={[{ label: 'Theo ngày', value: 'date' }, { label: 'Theo năm', value: 'year' }]}
          onChange={(mode) => setPeriod({ mode, value: null })} style={{ margin: '8px 0' }} />} />
      <Button onClick={records.reload}>Làm mới</Button>
    </div>
      {records.loading ? <div className="page-loading"><Spin /></div> : records.error ? <Alert type="error" title={records.error}
        action={<Button onClick={records.reload}>Thử lại</Button>} /> : !records.data?.length ? <Empty description="Không có bệnh án phù hợp." />
        : <div className="record-list">{records.data.map((record) => <article className="record-card" key={record.id}>
          <div className="record-title"><div><Tag color="cyan">{record.appointment_date} · {record.appointment_time}</Tag>
            <h3>{role === 'doctor' ? record.patient.full_name : `BS. ${record.doctor_name}`}</h3>
            <p>{role === 'doctor' ? `${record.patient.patient_code} · BS. ${record.doctor_name}` : record.doctor_specialty}</p></div>
            <Button onClick={() => setChosen(record.id)}>Xem chi tiết</Button></div>
          <p className="record-text"><strong>Chẩn đoán: </strong>{record.diagnosis}</p>
          {record.notes && <p className="record-text"><strong>Lời dặn: </strong>{record.notes}</p>}
          <p className="record-meta">{record.prescriptions.length ? `${record.prescriptions.length} loại thuốc được kê` : 'Không kê thuốc'} · Bệnh án #{record.id}</p>
        </article>)}</div>}
    </section>
    <MedicalRecordDetail role={role} recordId={detailId} onClose={() => { setChosen(null); setClosedInitial(true); }} />
  </div>;
}
