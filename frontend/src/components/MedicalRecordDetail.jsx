import { useEffect } from 'react';
import { Alert, Button, Descriptions, Empty, Modal, Spin, Table } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import useResource from '../hooks/useResource';

export default function MedicalRecordDetail({ recordId, role = 'patient', onClose }) {
  const base = role === 'doctor' ? 'doctor/records/' : 'my-records/';
  const record = useResource(recordId ? `${base}${recordId}/` : null);
  useEffect(() => {
    const done = () => document.body.classList.remove('printing-record');
    window.addEventListener('afterprint', done);
    return () => { window.removeEventListener('afterprint', done); done(); };
  }, []);
  const data = record.data;
  const print = () => {
    document.body.classList.add('printing-record');
    window.print();
  };
  return <Modal open={Boolean(recordId)} title="Chi tiết bệnh án" width={900} onCancel={onClose}
    footer={<div className="actions"><Button onClick={onClose}>Đóng</Button>
      <Button icon={<PrinterOutlined />} disabled={!data || record.loading || Boolean(record.error)} onClick={print}>In bệnh án / Lưu PDF</Button></div>}>
    {record.loading ? <div className="page-loading"><Spin /></div> : record.error ? <Alert type="error" title={record.error}
      action={<Button onClick={record.reload}>Thử lại</Button>} /> : data ? <article className="medical-print-sheet">
      <div className="record-title"><div><h2>Clinic · Bệnh án #{data.id}</h2><p>Lịch khám #{data.appointment_id}</p></div>
        <div><strong>{data.appointment_date} · {data.appointment_time}</strong><p>BS. {data.doctor_name} · {data.doctor_specialty}</p></div></div>
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
        { key: 'code', label: 'Mã bệnh nhân', children: data.patient.patient_code },
        { key: 'name', label: 'Họ và tên', children: data.patient.full_name },
        { key: 'dob', label: 'Ngày sinh', children: data.patient.date_of_birth || 'Chưa cập nhật' },
        { key: 'phone', label: 'Số điện thoại', children: data.patient.phone || 'Chưa cập nhật' },
        { key: 'blood', label: 'Nhóm máu', children: data.patient.blood_type || 'Chưa cập nhật' },
        { key: 'allergies', label: 'Dị ứng đã khai báo', children: data.patient.known_allergies || 'Chưa ghi nhận' },
      ]} />
      <section className="record-section"><h3>Chẩn đoán</h3><p className="record-text">{data.diagnosis}</p></section>
      <section className="record-section"><h3>Đơn thuốc</h3>
        {data.prescriptions.length ? <Table rowKey="id" pagination={false} size="small" bordered
          dataSource={data.prescriptions} columns={[
            { title: 'Tên thuốc', dataIndex: 'medication_name' },
            { title: 'Liều lượng', dataIndex: 'dosage' },
            { title: 'Cách dùng', dataIndex: 'instructions', render: (value) => value || '—' },
          ]} /> : <p>Không kê thuốc trong lần khám này.</p>}
      </section>
      <section className="record-section"><h3>Lời dặn / Ghi chú</h3><p className="record-text">{data.notes || 'Không có ghi chú thêm.'}</p></section>
      <p className="record-meta">Ngày lập: {new Date(data.created_at).toLocaleString('vi-VN')}</p>
    </article> : <Empty description="Chưa có dữ liệu bệnh án." />}
  </Modal>;
}
