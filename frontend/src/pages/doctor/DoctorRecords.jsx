import MedicalRecords from '../MedicalRecords';

export default function DoctorRecords(props) {
  return <MedicalRecords key={`${props.initialPatient?.user_id || 'all'}:${props.initialRecordId || 'list'}`}
    {...props} role="doctor" />;
}
