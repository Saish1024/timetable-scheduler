const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ["admin", "hod"],
        message: "Role must be either admin or hod",
      },
      required: true,
      default: "hod",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

userSchema.pre("validate", function (next) {
  if (this.role === "hod" && !this.department) {
    this.invalidate("department", "Department is required for HOD users");
  }
  if (this.role === "admin") {
    this.department = null;
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.statics.createByAdmin = async function (data) {
  const { name, email, password, department } = data;

  if (!name || !email || !password) {
    throw new Error("name, email and password are required");
  }
  if (!department) {
    throw new Error("department is required for HOD accounts");
  }

  const existing = await this.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new Error("Email already registered");
  }

  return this.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role: "hod",
    department,
  });
};

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
