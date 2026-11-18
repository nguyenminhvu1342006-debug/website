import { BORDER, MUTED } from '../constants';

/** Khung trắng bo góc có tiêu đề + mô tả, dùng chung cho các trang Lễ tân. */
const SectionCard = ({ title, subtitle, extra, children, style }) => (
  <section
    style={{
      backgroundColor: 'white',
      borderRadius: 16,
      border: `1px solid ${BORDER}`,
      boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
      padding: '22px 22px 24px',
      ...style,
    }}
  >
    {(title || extra) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div>
          {title && <h3 style={{ margin: 0, fontSize: 19, fontWeight: 'normal' }}>{title}</h3>}
          {subtitle && <div style={{ marginTop: 4, fontSize: 13, color: MUTED }}>{subtitle}</div>}
        </div>
        {extra}
      </div>
    )}
    {children}
  </section>
);

export default SectionCard;
