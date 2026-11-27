import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Drawer, Empty, Spin, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import api from '../api';
import useResource, { errorText } from '../hooks/useResource';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useResource('notifications/');
  useEffect(() => {
    const refresh = () => { if (!document.hidden) reload(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('notifications-updated', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('notifications-updated', refresh);
    };
  }, [reload]);

  const markRead = async (id) => {
    setBusy(true);
    try {
      await api.post('notifications/', id ? { id } : {});
      reload();
    } catch (err) { message.error(errorText(err)); }
    finally { setBusy(false); }
  };

  return <>
    <Badge count={data?.unread_count || 0} size="small">
      <Button aria-label="Thông báo" shape="circle" icon={<BellOutlined />}
        onClick={() => { setOpen(true); reload(); }} />
    </Badge>
    <Drawer title="Thông báo" open={open} onClose={() => setOpen(false)}
      extra={<Button disabled={busy || !data?.unread_count} onClick={() => markRead()}>Đọc tất cả</Button>}>
      {error ? <Alert type="error" title={error} action={<Button onClick={reload}>Thử lại</Button>} />
        : loading ? <Spin /> : !data?.results.length ? <Empty description="Chưa có thông báo" />
          : data.results.map((item) => <article key={item.id} style={{
            padding: 16, marginBottom: 12, borderRadius: 12, border: '1px solid #eaeaea',
            background: item.is_read ? '#fff' : '#e6f4f4',
          }}>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <small>{new Date(item.created_at).toLocaleString('vi-VN')}</small>
            {!item.is_read && <Button type="link" disabled={busy} onClick={() => markRead(item.id)}>Đánh dấu đã đọc</Button>}
          </article>)}
      {data?.results.length === 50 && <p>Hiển thị 50 thông báo gần nhất.</p>}
    </Drawer>
  </>;
}
