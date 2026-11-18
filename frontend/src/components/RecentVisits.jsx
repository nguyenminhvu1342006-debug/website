import { Alert, Button, Empty, Spin, Table } from 'antd';
import useResource from '../hooks/useResource';

export default function RecentVisits({ onOpenRecord }) {
  const records = useResource('my-records/', { limit: 3 });
  return <section className="panel"><h2>Recent Visits</h2>
    {records.loading ? <Spin /> : records.error ? <Alert type="error" title={records.error}
      action={<Button onClick={records.reload}>Thử lại</Button>} /> : !records.data?.length ? <Empty description="Bạn chưa có bệnh án đã hoàn tất." />
      : <Table rowKey="id" pagination={false} dataSource={records.data} scroll={{ x: 550 }} columns={[
        { title: 'Ngày khám', dataIndex: 'appointment_date' },
        { title: 'Bác sĩ', dataIndex: 'doctor_name' },
        { title: 'Chẩn đoán', dataIndex: 'diagnosis', ellipsis: true },
        { title: 'Thao tác', render: (_, record) => <Button type="link" onClick={() => onOpenRecord(record.id)}>Xem chi tiết</Button> },
      ]} />}
  </section>;
}
