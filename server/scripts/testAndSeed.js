/**
 * Test Atlas connection and run seed. Exits 0 on success, 1 on failure.
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI is not set in server/.env");
  process.exit(1);
}

async function main() {
  console.log("Connecting to MongoDB...");
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log(`Connected: ${mongoose.connection.host}`);
    await mongoose.disconnect();
  } catch (err) {
    console.error("\nConnection failed:", err.message);
    if (/whitelist|IP/i.test(err.message)) {
      console.error(
        "\nFix: MongoDB Atlas → Network Access → Add IP Address →",
        '"Allow Access from Anywhere" (0.0.0.0/0) for development, or add your current IP.'
      );
    }
    process.exit(1);
  }

  console.log("\nRunning seed...\n");
  const { spawnSync } = require("child_process");
  const result = spawnSync(process.execPath, ["seed.js"], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

main();
