import useResource from '../../../hooks/useResource';

/** Danh sách bác sĩ đang hoạt động (API công khai /api/doctors/). */
const useDoctors = () => {
  const { data, loading, error } = useResource('doctors/');
  return { doctors: data || [], loading, error };
};

export default useDoctors;
