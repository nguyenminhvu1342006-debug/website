import { Button, Empty, Select, Spin } from 'antd';
import { ALL_SPECIALTIES, BORDER, MUTED, SERIF, TEAL, TEAL_LIGHT, TEAL_SOFT } from '../constants';

/** Chọn chuyên khoa (dropdown) + thẻ bác sĩ, giống khối "Select Doctor & Specialty" trong mockup. */
const DoctorPicker = ({ doctors, loading, specialty, onSpecialtyChange, selectedId, onSelect }) => {
  const specialties = [...new Set(doctors.map((d) => d.specialty))].sort();
  const visible = specialty === ALL_SPECIALTIES ? doctors : doctors.filter((d) => d.specialty === specialty);

  return (
    <>
      <Select
        variant="filled"
        size="large"
        value={specialty}
        onChange={onSpecialtyChange}
        style={{ width: '100%', marginBottom: 14, border: `1px solid ${BORDER}`, borderRadius: 8 }}
        options={[
          { value: ALL_SPECIALTIES, label: 'All specialties' },
          ...specialties.map((name) => ({ value: name, label: name })),
        ]}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : visible.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No doctors in this specialty" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {visible.map((doctor) => {
            const selected = doctor.id === selectedId;
            return (
              <div
                key={doctor.id}
                style={{
                  border: `1px solid ${selected ? TEAL : BORDER}`,
                  backgroundColor: selected ? TEAL_SOFT : 'white',
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    backgroundColor: selected ? TEAL : TEAL_LIGHT,
                    color: selected ? 'white' : TEAL,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    marginBottom: 12,
                  }}
                >
                  {doctor.initials}
                </div>
                <div style={{ fontSize: 15 }}>{doctor.name}</div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>{doctor.specialty}</div>
                <Button
                  block
                  type={selected ? 'primary' : 'default'}
                  onClick={() => onSelect(doctor)}
                  style={{ fontFamily: SERIF }}
                >
                  {selected ? 'Selected' : 'Select'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default DoctorPicker;
