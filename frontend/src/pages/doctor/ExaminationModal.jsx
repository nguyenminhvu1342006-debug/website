import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import { DeleteOutlined, FileTextOutlined, MedicineBoxOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../../api';

const { TextArea } = Input;

const PRIMARY_TEAL = '#4cb4b3';
const EMPTY_MEDICATION = { medication_name: '', dosage: '', instructions: '' };

const ExaminationModal = ({ open, appointment, onClose, onSuccess }) => {
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState([{ ...EMPTY_MEDICATION }]);
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(Boolean(open && appointment?.patient_info?.user_id));

  const patient = appointment?.patient_info;

  useEffect(() => {
    if (!open || !patient?.user_id) return;
    let active = true;
    api
      .get('doctor/records/', { params: { patient_user_id: patient.user_id } })
      .then(({ data }) => {
        if (active) setHistory(data);
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });

    return () => {
      active = false;
    };
  }, [open, patient?.user_id]);

  const handleMedicationChange = (index, field, value) => {
    setPrescriptions((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddMedication = () => {
    setPrescriptions((prev) => [...prev, { ...EMPTY_MEDICATION }]);
  };

  const handleRemoveMedication = (index) => {
    setPrescriptions((prev) => (prev.length === 1 ? [{ ...EMPTY_MEDICATION }] : prev.filter((_, idx) => idx !== index)));
  };

  const handleSubmit = async () => {
    if (!diagnosis.trim()) {
      message.warning('Vui lòng nhập chẩn đoán bệnh trước khi hoàn thành khám.');
      return;
    }

    const nonEmptyMeds = prescriptions.filter(
      (item) => item.medication_name.trim() || item.dosage.trim() || item.instructions.trim()
    );
    const incompleteMed = nonEmptyMeds.find(
      (item) => !item.medication_name.trim() || !item.dosage.trim()
    );
    if (incompleteMed) {
      message.warning('Mỗi dòng thuốc cần nhập đầy đủ Tên thuốc và Liều lượng.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`doctor/appointments/${appointment.id}/examine/`, {
        diagnosis: diagnosis.trim(),
        notes: notes.trim(),
        prescriptions: nonEmptyMeds.map((item) => ({
          medication_name: item.medication_name.trim(),
          dosage: item.dosage.trim(),
          instructions: item.instructions.trim(),
        })),
      });
      message.success('Đã lưu bệnh án và hoàn thành buổi khám!');
      onSuccess?.();
      onClose?.();
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.detail || 'Không thể lưu bệnh án.';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={860}
      destroyOnHidden
      title={
        <span style={{ fontFamily: 'serif', fontSize: '20px', color: '#333' }}>
          Khám bệnh — Lịch hẹn #{appointment?.id} ({appointment?.date} • {appointment?.time})
        </span>
      }
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Đóng
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
          style={{ backgroundColor: PRIMARY_TEAL, borderColor: PRIMARY_TEAL, fontWeight: 'bold' }}
        >
          Hoàn thành khám & Lưu bệnh án
        </Button>,
      ]}
    >
      {patient && (
        <div style={{ marginBottom: '16px' }}>
          <Descriptions
            bordered
            size="small"
            column={3}
            style={{ backgroundColor: '#fafafa', borderRadius: '8px' }}
          >
            <Descriptions.Item label="Mã BN">{patient.patient_code}</Descriptions.Item>
            <Descriptions.Item label="Họ tên">
              <strong>{patient.full_name}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="SĐT">{patient.phone || 'Chưa cập nhật'}</Descriptions.Item>
            <Descriptions.Item label="Ngày sinh">{patient.date_of_birth || 'Chưa cập nhật'}</Descriptions.Item>
            <Descriptions.Item label="Nhóm máu">
              {patient.blood_type ? <Tag color="cyan">{patient.blood_type}</Tag> : 'Chưa rõ'}
            </Descriptions.Item>
            <Descriptions.Item label="Lịch sử khám">{history.length} lần</Descriptions.Item>
          </Descriptions>

          {patient.known_allergies && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: '12px' }}
              title={`Cảnh báo dị ứng: ${patient.known_allergies}`}
            />
          )}
        </div>
      )}

      <Tabs
        defaultActiveKey="exam"
        items={[
          {
            key: 'exam',
            label: (
              <span>
                <MedicineBoxOutlined /> Ghi nhận khám bệnh
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
                    Chẩn đoán bệnh <span style={{ color: '#ff4d4f' }}>*</span>
                  </label>
                  <TextArea
                    rows={3}
                    placeholder="Nhập kết luận chẩn đoán của bác sĩ..."
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontWeight: 'bold', color: '#333' }}>Đơn thuốc</label>
                    <Button type="dashed" icon={<PlusOutlined />} size="small" onClick={handleAddMedication}>
                      Thêm thuốc
                    </Button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {prescriptions.map((med, index) => (
                      <div
                        key={index}
                        style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.4fr auto', gap: '8px', alignItems: 'center' }}
                      >
                        <Input
                          placeholder="Tên thuốc (VD: Paracetamol 500mg)"
                          value={med.medication_name}
                          onChange={(e) => handleMedicationChange(index, 'medication_name', e.target.value)}
                        />
                        <Input
                          placeholder="Liều lượng (VD: 1 viên x 3)"
                          value={med.dosage}
                          onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                        />
                        <Input
                          placeholder="Cách dùng (VD: Sau ăn)"
                          value={med.instructions}
                          onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)}
                        />
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveMedication(index)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
                    Lời dặn / Ghi chú thêm
                  </label>
                  <TextArea
                    rows={2}
                    placeholder="Chế độ ăn uống, sinh hoạt, lịch tái khám..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'history',
            label: (
              <span>
                <FileTextOutlined /> Lịch sử khám trước đó ({history.length})
              </span>
            ),
            children: loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <Spin />
              </div>
            ) : history.length === 0 ? (
              <Empty description="Bệnh nhân chưa có dữ liệu lịch sử khám" />
            ) : (
              <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      border: '1px solid #eaeaea',
                      borderRadius: '10px',
                      padding: '14px',
                      backgroundColor: '#fcfcfc',
                    }}
                  >
                    <Space style={{ marginBottom: '8px' }}>
                      <Tag color="teal">{rec.appointment_date}</Tag>
                      <strong>BS. {rec.doctor_name}</strong>
                      <span style={{ color: '#888' }}>({rec.doctor_specialty})</span>
                    </Space>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Chẩn đoán:</strong> {rec.diagnosis}
                    </p>
                    {rec.notes && (
                      <p style={{ margin: '4px 0', color: '#555' }}>
                        <strong>Lời dặn:</strong> {rec.notes}
                      </p>
                    )}
                    {rec.prescriptions?.length > 0 && (
                      <>
                        <Divider style={{ margin: '8px 0' }} />
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="id"
                          dataSource={rec.prescriptions}
                          columns={[
                            { title: 'Tên thuốc', dataIndex: 'medication_name', key: 'medication_name' },
                            { title: 'Liều lượng', dataIndex: 'dosage', key: 'dosage' },
                            { title: 'Cách dùng', dataIndex: 'instructions', key: 'instructions' },
                          ]}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default ExaminationModal;
