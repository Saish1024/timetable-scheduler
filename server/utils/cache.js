const { Redis } = require("@upstash/redis");

const CACHE_TTL_SECONDS = 300; // 5 minutes

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const keys = {
  timetable: (deptId, sem, academicYear) =>
    `timetable:${deptId}:${sem}:${academicYear}`,
  subjects: (deptId) => `subjects:${deptId}`,
  faculty: (deptId) => `faculty:${deptId}`,
};

const get = async (key) => {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    if (value == null) return null;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (err) {
    console.warn(`Redis get failed (${key}):`, err.message);
    return null;
  }
};

const set = async (key, payload) => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(payload), { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.warn(`Redis set failed (${key}):`, err.message);
  }
};

const del = async (...cacheKeys) => {
  if (!redis || cacheKeys.length === 0) return;
  try {
    await redis.del(...cacheKeys);
  } catch (err) {
    console.warn("Redis del failed:", err.message);
  }
};

const invalidateTimetable = async (deptId, sem, academicYear) => {
  if (!deptId || sem == null || !academicYear) return;
  await del(keys.timetable(deptId, sem, academicYear));
};

const invalidateSubjects = async (deptId) => {
  if (!deptId) return;
  await del(keys.subjects(deptId));
};

const invalidateFaculty = async (deptId) => {
  if (!deptId) return;
  await del(keys.faculty(deptId));
};

module.exports = {
  redis,
  keys,
  get,
  set,
  del,
  invalidateTimetable,
  invalidateSubjects,
  invalidateFaculty,
  CACHE_TTL_SECONDS,
};
