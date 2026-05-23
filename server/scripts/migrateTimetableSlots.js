/**
 * One-time migration: legacy slotType (theory/tutorial) → lecture/practical,
 * and backfill teachingDepartment from department when missing.
 *
 * Usage: node server/scripts/migrateTimetableSlots.js
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const TimetableSlot = require("../models/TimetableSlot");
const { normalizeSlotType, isLecture } = require("../utils/slotTypes");

const migrate = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is not defined in .env");

  await mongoose.connect(mongoUri);
  const slots = await TimetableSlot.find({});
  let updated = 0;

  for (const slot of slots) {
    const before = `${slot.slotType}|${slot.teachingDepartment}|${slot.batch}`;
    slot.slotType = normalizeSlotType(slot.slotType);
    if (!slot.teachingDepartment) {
      slot.teachingDepartment = slot.department;
    }
    if (isLecture(slot.slotType)) {
      slot.batch = null;
    }
    const after = `${slot.slotType}|${slot.teachingDepartment}|${slot.batch}`;
    if (before !== after) {
      await slot.save();
      updated += 1;
    }
  }

  console.log(`Migrated ${updated} of ${slots.length} timetable slot(s).`);
  await mongoose.disconnect();
};

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
