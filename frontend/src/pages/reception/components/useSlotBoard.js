import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../../api';
import { errorText } from '../../../hooks/useResource';
import { buildSlotBoard } from '../constants';

/**
 * Trạng thái các khung giờ của 1 bác sĩ trong 1 ngày, dựa trên API /api/slots/:
 * [{ time: '09:00', state: 'available' | 'booked' | 'past' }, ...]
 */
const useSlotBoard = (doctorId, date) => {
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState({ key: null, slots: [], error: null });

  const isPastDay = Boolean(date) && dayjs(date).isBefore(dayjs(), 'day');
  const key = doctorId && date && !isPastDay ? `${doctorId}|${date}|${tick}` : null;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    api
      .get('slots/', { params: { doctor_id: doctorId, date }, signal: controller.signal })
      .then(({ data }) => setResult({ key, slots: buildSlotBoard(date, data.available_slots), error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, slots: [], error: errorText(error) });
      });
    return () => controller.abort();
  }, [key, doctorId, date]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  if (doctorId && isPastDay) {
    return { slots: buildSlotBoard(date, []), error: null, loading: false, reload };
  }
  const ready = Boolean(key) && result.key === key;
  return {
    slots: ready ? result.slots : [],
    error: ready ? result.error : null,
    loading: Boolean(key) && !ready,
    reload,
  };
};

export default useSlotBoard;
