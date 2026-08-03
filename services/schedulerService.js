// Custom in-app scheduler. Generates bookable slots (business hours, weekdays).
// The DB partial-unique index on demo_bookings (status='scheduled', scheduled_at) is the
// hard guarantee against double-booking; this layer decides which slots to show and their state.

const START_HOUR = Number(process.env.SLOT_START_HOUR || 9);   // 09:00
const END_HOUR = Number(process.env.SLOT_END_HOUR || 17);      // last slot before 17:00
const STEP_MIN = Number(process.env.SLOT_STEP_MINUTES || 30);  // 30-min slots
const DAYS_AHEAD = Number(process.env.SLOT_DAYS_AHEAD || 14);
const SKIP_WEEKENDS = process.env.SLOT_SKIP_WEEKENDS !== 'false';

// Future slot Date objects, at least `leadHours` from now.
const generateSlots = ({ leadHours = 2 } = {}) => {
  const slots = [];
  const now = new Date();
  const earliest = new Date(now.getTime() + leadHours * 3600 * 1000);

  for (let d = 0; d <= DAYS_AHEAD; d += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const dow = day.getDay();
    if (SKIP_WEEKENDS && (dow === 0 || dow === 6)) continue;

    for (let h = START_HOUR; h < END_HOUR; h += 1) {
      for (let m = 0; m < 60; m += STEP_MIN) {
        const slot = new Date(day);
        slot.setHours(h, m, 0, 0);
        if (slot > earliest) slots.push(slot);
      }
    }
  }
  return slots;
};

const takenSet = (takenIso = []) => new Set(takenIso.map((t) => new Date(t).getTime()));

// Every slot with its availability, for a green/red grid: [{ iso, taken }]
const slotsWithStatus = (takenIso = []) => {
  const taken = takenSet(takenIso);
  return generateSlots().map((s) => ({ iso: s.toISOString(), taken: taken.has(s.getTime()) }));
};

// Only free slots (ISO strings).
const availableSlots = (takenIso = []) => {
  const taken = takenSet(takenIso);
  return generateSlots().filter((s) => !taken.has(s.getTime())).map((s) => s.toISOString());
};

// A requested slot must be a real generated slot and not already taken.
const isSlotValid = (iso, takenIso = []) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (takenSet(takenIso).has(t)) return false;
  return generateSlots().some((s) => s.getTime() === t);
};

module.exports = { generateSlots, slotsWithStatus, availableSlots, isSlotValid };
