// The shop shows every order time in Vietnam time, so the field reads and writes the same clock,
// whatever timezone the admin's device is set to. Vietnam has no daylight saving: the offset is fixed.
const VIETNAM_OFFSET_MS = 7 * 3600000;
const MINUTE_MS = 60000;

export function toVietnamInput(date: Date) {
  return new Date(date.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 16);
}

export function fromVietnamInput(value: string) {
  return new Date(`${value}:00+07:00`);
}

/** Answers what is wrong with the chosen time, or an empty string when it can be sent. */
export function deliveryTimeProblem(value: string, handedOverAt: string | undefined) {
  const chosen = fromVietnamInput(value).getTime();
  if (Number.isNaN(chosen)) return 'Chọn thời điểm giao.';
  if (chosen > Date.now()) return 'Thời điểm giao không được ở tương lai.';
  // The field has no seconds, so the handover's own minute still counts as after it.
  if (handedOverAt && chosen < Math.floor(new Date(handedOverAt).getTime() / MINUTE_MS) * MINUTE_MS) {
    return 'Thời điểm giao không được trước lúc bàn giao.';
  }
  return '';
}
