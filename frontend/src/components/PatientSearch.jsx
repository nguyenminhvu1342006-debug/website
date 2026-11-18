import { useEffect, useState } from 'react';
import { AutoComplete, Input, Spin } from 'antd';
import useResource from '../hooks/useResource';

const patientLabel = (patient) => [patient.id, patient.full_name, patient.username, patient.phone, patient.address].filter(Boolean).join(' · ');

export default function PatientSearch({ initialPatient, onSelect }) {
  const [value, setValue] = useState(initialPatient ? patientLabel(initialPatient) : '');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const patients = useResource('reception/patients/', { search: debounced });
  const pending = query.trim() !== debounced || patients.loading;
  return <AutoComplete className="full-width" value={value}
    options={pending ? [] : (patients.data || []).map((patient) => ({ value: patientLabel(patient), label: patientLabel(patient), patient }))}
    onChange={(text) => { setValue(text); setQuery(text); onSelect(null); }}
    onSelect={(_, option) => { setValue(option.value); setQuery(''); onSelect(option.patient); }}
    notFoundContent={pending ? <Spin size="small" /> : patients.error || 'Không tìm thấy bệnh nhân. Thử ID, tên, tài khoản, SĐT hoặc địa chỉ khác.'}>
    <Input.Search aria-label="Tìm và chọn bệnh nhân theo ID, tên, tài khoản, số điện thoại hoặc địa chỉ" placeholder="ID, tên, tài khoản, SĐT hoặc địa chỉ"
      allowClear onSearch={() => { setDebounced(query.trim()); patients.reload(); }} />
  </AutoComplete>;
}
