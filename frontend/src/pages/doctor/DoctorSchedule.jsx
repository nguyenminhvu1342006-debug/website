import { useState } from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'antd';
import {
  FileTextOutlined,
  HistoryOutlined,
  MedicineBoxOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import useResource from '../../hooks/useResource';
import ExaminationModal from './ExaminationModal';

const PRIMARY_TEAL = '#4cb4b3';
const DARK_TEXT = '#333333';

const STATUS_META = {
  'Checked-in': { color: 'cyan', label: 'Chờ khám (Đã check-in)' },
  Confirmed: { color: 'blue', label: 'Sắp tới (Chưa check-in)' },
  Completed: { color: 'green', label: 'Đã khám xong' },
  Cancelled: { color: 'red', label: 'Đã hủy' },
};

const DoctorSchedule = ({ onViewPatientHistory, onViewRecordDetail }) => {

  const [rangeFilter, setRangeFilter] = useState('today');
  const [selectedDate, setSelectedDate] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [examTarget, setExamTarget] = useState(null);

  const params = { status: statusFilter, search: searchTerm.trim() };
  if (selectedDate) params.date = selectedDate.format('YYYY-MM-DD');
  else params.range = rangeFilter;
  const { data, loading, error, reload } = useResource('doctor/appointments/', params);
  const appointments = data || [];

  const columns = [
    {
      title: 'Thời gian',
      key: 'datetime',
      width: 150,
      render: (_, app) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '15px', color: DARK_TEXT }}>{app.time}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{app.date}</div>
        </div>
      ),
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      render: (_, app) => (
        <div>
          <div style={{ fontWeight: 'bold', color: DARK_TEXT }}>{app.patient_info?.full_name}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {app.patient_info?.patient_code}
            {app.patient_info?.phone ? ` • ${app.patient_info.phone}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Thông tin y tế nhanh',
      key: 'medical_brief',
      render: (_, app) => (
        <Space size={4} wrap>
          {app.patient_info?.blood_type && (
            <Tag color="geekblue">Nhóm máu: {app.patient_info.blood_type}</Tag>
          )}
          {app.patient_info?.known_allergies && (
            <Tag color="warning">Dị ứng: {app.patient_info.known_allergies}</Tag>
          )}
          {!app.patient_info?.blood_type && !app.patient_info?.known_allergies && (
            <span style={{ color: '#aaa', fontSize: '13px' }}>—</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 190,
      render: (status) => {
        const meta = STATUS_META[status] || { color: 'default', label: status };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 240,
      align: 'right',
      render: (_, app) => (
        <Space>
          {app.status === 'Checked-in' && (
            <Button
              aria-label="Khám bệnh"
              type="primary"
              icon={<MedicineBoxOutlined />}
              onClick={() => setExamTarget(app)}
              style={{ backgroundColor: PRIMARY_TEAL, borderColor: PRIMARY_TEAL, fontWeight: 'bold' }}
            >
              Khám bệnh
            </Button>
          )}
          {app.status === 'Completed' && app.medical_record_id && (
            <Button
              icon={<FileTextOutlined />}
              onClick={() => onViewRecordDetail?.(app.medical_record_id)}
              style={{ borderColor: PRIMARY_TEAL, color: PRIMARY_TEAL }}
            >
              Xem bệnh án
            </Button>
          )}
          <Button
            icon={<HistoryOutlined />}
            onClick={() => onViewPatientHistory?.(app.patient_info)}
          >
            Lịch sử
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div>
        <h2 style={{ fontFamily: 'serif', margin: 0, color: DARK_TEXT, fontSize: '24px' }}>
          My Schedule
        </h2>
        <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>
          Danh sách bệnh nhân đặt khám và đang chờ khám. Chỉ các lịch đã Check-in mới tiến hành khám bệnh.
        </p>
      </div>

      {/* Bộ lọc ngày / tuần / trạng thái / tìm kiếm */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid #f0f0f0',
        }}
      >
        <Space wrap>
          <Segmented
            value={selectedDate ? 'custom' : rangeFilter}
            options={[
              { label: 'Hôm nay', value: 'today' },
              { label: 'Tuần này', value: 'week' },
              { label: 'Tất cả', value: 'all' },
            ]}
            onChange={(val) => {
              setSelectedDate(null);
              setRangeFilter(val);
            }}
          />
          <DatePicker
            placeholder="Chọn ngày cụ thể"
            value={selectedDate}
            onChange={(val) => setSelectedDate(val)}
            format="YYYY-MM-DD"
            allowClear
          />
        </Space>

        <Space wrap>
          <Select
            value={statusFilter}
            style={{ width: 200 }}
            onChange={setStatusFilter}
            options={[
              { value: 'All', label: 'Tất cả trạng thái' },
              { value: 'Checked-in', label: 'Chờ khám (Checked-in)' },
              { value: 'Confirmed', label: 'Sắp tới (Confirmed)' },
              { value: 'Completed', label: 'Đã khám xong' },
              { value: 'Cancelled', label: 'Đã hủy' },
            ]}
          />
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            aria-label="Tìm bệnh nhân theo ID, họ tên, tài khoản hoặc số điện thoại"
            placeholder="ID, tên, tài khoản hoặc SĐT"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            style={{ width: 230, borderRadius: '10px' }}
          />
        </Space>
      </div>

      {/* Bảng lịch khám */}
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
        {error ? <Alert type="error" title={error} action={<Button onClick={reload}>Thử lại</Button>} /> : loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
          </div>
        ) : appointments.length === 0 ? (
          <Empty description="Không có lịch khám nào trong khoảng thời gian này" />
        ) : (
          <Table
            rowKey="id"
            dataSource={appointments}
            columns={columns}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 980 }}
          />
        )}
      </div>

      <ExaminationModal
        key={examTarget?.id || 'closed'}
        open={Boolean(examTarget)}
        appointment={examTarget}
        onClose={() => setExamTarget(null)}
        onSuccess={reload}
      />
    </div>
  );
};

export default DoctorSchedule;
