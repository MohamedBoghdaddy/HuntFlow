import mongoose from "mongoose";

// Schema definition for an Application document. Each application links a
// user to a job and tracks the status throughout the pipeline (saved,
// queued, applied, interview, offer, rejected). Additional metadata such
// as resume versions, cover letters and interview notes are stored here.
const applicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    status: {
      type: String,
      enum: ["saved", "queued", "applied", "interview", "offer", "rejected"],
      default: "saved",
    },
    resumeVersion: { type: String },
    coverLetter: { type: String },
    matchScore: { type: Number },
    appliedAt: { type: Date },
    notes: { type: String },
    timeline: [
      {
        action: String,
        description: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

const Application = mongoose.model("Application", applicationSchema);
export default Application;