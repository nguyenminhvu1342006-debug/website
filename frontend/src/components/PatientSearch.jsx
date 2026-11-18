import { useEffect, useState } from 'react';
import { AutoComplete, Input, Spin } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import useResource from '../hooks/useResource';

const patientLabel = (patient) => [patient.id, patient.full_name, patient.username, patient.phone, patient.address].filter(Boolean).join(' · ');

export default function PatientSearch({ initialPatient, onSelect, onSearch, source = 'reception/patients/', initialSearch = '', placeholder = 'ID, tên, tài khoản, SĐT hoặc địa chỉ', style }) {
  const [value, setValue] = useState(initialPatient ? patientLabel(initialPatient) : initialSearch);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const patients = useResource(source, { search: debounced });
  const pending = query.trim() !== debounced || patients.loading;
  return <AutoComplete className="full-width" style={style} value={value} open={open} onOpenChange={setOpen}
    options={pending ? [] : (patients.data || []).map((patient) => ({ value: patientLabel(patient), label: patientLabel(patient), patient }))}
    onChange={(text) => { setValue(text); setQuery(text); onSelect?.(null); if (!text) onSearch?.(''); }}
    onSelect={(_, option) => {
      setValue(onSelect ? option.value : option.patient.id);
      setQuery(''); setOpen(false); onSelect?.(option.patient); onSearch?.(option.patient.id);
    }}
    notFoundContent={pending ? <Spin size="small" /> : patients.error || 'Không tìm thấy bệnh nhân. Thử ID, tên, tài khoản, SĐT hoặc địa chỉ khác.'}>
    <Input.Search aria-label="Tìm và chọn bệnh nhân theo ID, tên, tài khoản, số điện thoại hoặc địa chỉ" placeholder={placeholder}
      onFocus={() => setOpen(true)} suffix={<button type="button" className="patient-suggest-toggle"
        aria-label="Gợi ý bệnh nhân" aria-expanded={open}
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}><DownOutlined /></button>}
      allowClear onSearch={() => {
        setDebounced(query.trim()); patients.reload();
        if (onSearch) { onSearch(value.trim()); setOpen(false); } else setOpen(true);
      }} />
  </AutoComplete>;
}
