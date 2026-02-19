import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    description: { type: String },
    location: { type: String },
    salary: {
      min: Number,
      max: Number,
      currency: String,
    },
    tags: [String],
    postedAt: { type: Date },
    source: {
      name: String,
      id: String,
      url: String,
    },
    ats: {
      type: String, // e.g., Greenhouse, Lever, etc.
      supportsApiApply: { type: Boolean, default: false },
      boardToken: String,
    },
    enrichment: {
      companySize: String,
      industry: String,
    },
  },
  { timestamps: true },
);

const Job = mongoose.model("Job", jobSchema);
export default Job;
