import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
    },
    roles: {
      type: [String],
      default: ["user"],
    },
    profile: {
      title: String,
      seniority: String,
      locations: [String],
      links: {
        portfolio: String,
        github: String,
        linkedin: String,
      },
      authorization: String,
      salaryExpectation: {
        amount: Number,
        currency: String,
      },
      preferences: {
        roles: [String],
        industries: [String],
        companies: [String],
        salary: Number,
        remoteOnly: Boolean,
        cities: [String],
      },
    },
  },
  { timestamps: true },
);

// Pre-save hook to hash password
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

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
