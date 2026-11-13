import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import { EyeOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../api';

const PRIMARY_TEAL = '#4cb4b3';
const DARK_TEXT = '#333333';

const DoctorRecords = ({ initialPatient, initialRecordId, onClearContext }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);

  const [manualRecordId, setManualRecordId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const activeRecordId = manualRecordId ?? initialRecordId ?? null;
  const detailOpen = Boolean(activeRecordId);
  const loadingDetail = Boolean(activeRecordId && selectedRecord?.id !== activeRecordId);

  useEffect(() => {
    let active = true;
    const params = {};
    if (initialPatient?.user_id) params.patient_user_id = initialPatient.user_id;
    if (searchTerm.trim()) params.search = searchTerm.trim();
    if (selectedDate) params.date = selectedDate.format('YYYY-MM-DD');

    api
      .get('doctor/records/', { params })
      .then(({ data }) => {
        if (active) setRecords(data);
      })
      .catch((error) => {
        if (active) {
          message.error(error.response?.data?.error || 'Không thể tải danh sách hồ sơ bệnh án.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialPatient?.user_id, searchTerm, selectedDate]);

  useEffect(() => {
    if (!activeRecordId) return;
    let active = true;
    api
      .get(`doctor/records/${activeRecordId}/`)
      .then(({ data }) => {
        if (active) setSelectedRecord(data);
      })
      .catch((error) => {
        if (!active) return;
        message.error(error.response?.data?.detail || 'Không thể tải chi tiết bệnh án.');
        setManualRecordId(null);
        onClearContext?.();
      });

    return () => {
      active = false;
    };
  }, [activeRecordId, onClearContext]);

  const handleOpenDetail = (recordId) => {
    setManualRecordId(recordId);
  };

  const handleCloseDetail = () => {
    setManualRecordId(null);
    onClearContext?.();
  };

  const handlePrint = () => {
    window.print();
  };

  const columns = [
    {
      title: 'Ngày khám',
      key: 'date',
      width: 130,
      render: (_, rec) => (
        <div>
          <div style={{ fontWeight: 'bold', color: DARK_TEXT }}>{rec.appointment_date}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{rec.appointment_time}</div>
        </div>
      ),
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      width: 200,
      render: (_, rec) => (
        <div>
          <div style={{ fontWeight: 'bold', color: DARK_TEXT }}>{rec.patient?.full_name}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {rec.patient?.patient_code} {rec.patient?.phone ? `• ${rec.patient.phone}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Chẩn đoán',
      dataIndex: 'diagnosis',
      key: 'diagnosis',
      width: 200,
      ellipsis: true,
      render: (text) => text || <span style={{ color: '#aaa' }}>Chưa có</span>,
    },
    {
      title: 'Đơn thuốc',
      key: 'prescriptions_count',
      width: 120,
      render: (_, rec) => (
        <Tag color={rec.prescriptions?.length ? 'cyan' : 'default'}>
          {rec.prescriptions?.length || 0} loại thuốc
        </Tag>
      ),
    },
    {
      title: 'Bác sĩ khám',
      key: 'doctor',
      width: 150,
      render: (_, rec) => `BS. ${rec.doctor_name}`,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, rec) => (
        <Button
          icon={<EyeOutlined />}
          onClick={() => handleOpenDetail(rec.id)}
          style={{ borderColor: PRIMARY_TEAL, color: PRIMARY_TEAL, borderRadius: '8px' }}
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #medical-record-print-sheet,
          #medical-record-print-sheet * {
            visibility: visible !important;
          }
          #medical-record-print-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 24px !important;
            background: white !important;
          }
        }
      `}</style>

      <div>
        <h2 style={{ fontFamily: 'serif', margin: 0, color: DARK_TEXT, fontSize: '24px' }}>
          Medical Records
        </h2>
        <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>
          Tra cứu lại biên bản khám bệnh và đơn thuốc đã kê (chỉ đọc).
        </p>
      </div>

      {initialPatient && (
        <Alert
          type="info"
          showIcon
          title={`Đang xem lịch sử khám bệnh của: ${initialPatient.full_name} (${initialPatient.patient_code})`}
          action={
            <Button
              size="small"
              onClick={() => {
                setLoading(true);
                onClearContext?.();
              }}
            >
              Xem tất cả bệnh án
            </Button>
          }
        />
      )}

      {/* Bộ lọc tìm kiếm */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          border: '1px solid #f0f0f0',
        }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Tìm theo tên bệnh nhân, mã BN hoặc chẩn đoán..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          style={{ flex: 1, minWidth: '240px', borderRadius: '10px' }}
        />
        <DatePicker
          placeholder="Lọc theo ngày khám"
          value={selectedDate}
          onChange={(val) => setSelectedDate(val)}
          format="YYYY-MM-DD"
          allowClear
        />
      </div>

      {/* Bảng danh sách bệnh án */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
          border: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
          </div>
        ) : records.length === 0 ? (
          <Empty
            description={
              initialPatient
                ? 'Bệnh nhân chưa có dữ liệu lịch sử khám.'
                : 'Chưa có hồ sơ bệnh án nào phù hợp.'
            }
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={records}
            columns={columns}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 940 }}
          />
        )}
      </div>

      {/* Modal chi tiết biên bản khám (Read-only) + In/Xuất PDF */}
      <Modal
        open={detailOpen}
        onCancel={handleCloseDetail}
        width={780}
        title={
          <span style={{ fontFamily: 'serif', fontSize: '20px', color: DARK_TEXT }}>
            Chi Tiết Biên Bản Khám Bệnh
          </span>
        }
        footer={[
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            disabled={!selectedRecord || loadingDetail}
          >
            Xuất PDF / In hồ sơ
          </Button>,
          <Button
            key="close"
            type="primary"
            style={{ backgroundColor: PRIMARY_TEAL, borderColor: PRIMARY_TEAL }}
            onClick={handleCloseDetail}
          >
            Đóng
          </Button>,
        ]}
      >
        {loadingDetail || !selectedRecord ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <div id="medical-record-print-sheet" style={{ padding: '8px 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'serif', color: PRIMARY_TEAL, fontSize: '20px' }}>
                  CLINIC PORTAL — BIÊN BẢN KHÁM BỆNH
                </h3>
                <p style={{ margin: '2px 0 0 0', color: '#888', fontSize: '13px' }}>
                  Mã bệnh án: #{selectedRecord.id} • Mã lịch hẹn: #{selectedRecord.appointment_id}
                </p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px', color: '#555' }}>
                <div>
                  Ngày khám: <strong>{selectedRecord.appointment_date}</strong> ({selectedRecord.appointment_time})
                </div>
                <div>
                  Bác sĩ: <strong>BS. {selectedRecord.doctor_name}</strong> ({selectedRecord.doctor_specialty})
                </div>
              </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <Descriptions bordered size="small" column={2} style={{ marginBottom: '16px' }}>
              <Descriptions.Item label="Mã bệnh nhân">{selectedRecord.patient?.patient_code}</Descriptions.Item>
              <Descriptions.Item label="Họ và tên">
                <strong>{selectedRecord.patient?.full_name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {selectedRecord.patient?.date_of_birth || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {selectedRecord.patient?.phone || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Nhóm máu">
                {selectedRecord.patient?.blood_type || 'Chưa rõ'}
              </Descriptions.Item>
              <Descriptions.Item label="Tiền sử dị ứng">
                {selectedRecord.patient?.known_allergies || 'Không ghi nhận'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: '16px', backgroundColor: '#fafafa', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px', color: DARK_TEXT }}>Chẩn đoán của bác sĩ</div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{selectedRecord.diagnosis}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: DARK_TEXT }}>Đơn thuốc đã kê</div>
              {selectedRecord.prescriptions?.length ? (
                <Table
                  size="small"
                  bordered
                  pagination={false}
                  rowKey="id"
                  dataSource={selectedRecord.prescriptions}
                  columns={[
                    { title: 'STT', key: 'idx', width: 60, render: (_, __, idx) => idx + 1 },
                    { title: 'Tên thuốc', dataIndex: 'medication_name', key: 'medication_name' },
                    { title: 'Liều lượng', dataIndex: 'dosage', key: 'dosage' },
                    { title: 'Cách dùng', dataIndex: 'instructions', key: 'instructions' },
                  ]}
                />
              ) : (
                <p style={{ color: '#888', margin: 0 }}>Không kê đơn thuốc trong buổi khám này.</p>
              )}
            </div>

            <div style={{ backgroundColor: '#fafafa', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px', color: DARK_TEXT }}>Lời dặn / Ghi chú</div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>
                {selectedRecord.notes || 'Không có ghi chú thêm.'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DoctorRecords;
