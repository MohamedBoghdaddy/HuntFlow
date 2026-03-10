import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fullName: String,
    email: String,
    phone: String,
    location: String,
    targetRole: String,
    yearsOfExperience: Number,
    skills: [String],
    education: [String],
    certifications: [String],
    summary: String,
  },
  { timestamps: true }
);

export default mongoose.model("Profile", profileSchema);