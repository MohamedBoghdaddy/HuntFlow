import mongoose from "mongoose";

// Schema definition for a Job document. Jobs can originate from internal
// postings or external aggregators. We store metadata about the company,
// position and any ATS (applicant tracking system) integration details to
// facilitate automated applications.
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
    // Source information allows us to deduplicate jobs across multiple
    // aggregators and store a reference back to the original posting. An
    // optional contact email can be provided to enable outreach to
    // recruiters or hiring managers.
    source: {
      name: String,
      id: String,
      url: String,
      email: String,
    },
    // ATS details describe how to automatically apply to this job via the
    // company's applicant tracking system. `supportsApiApply` indicates
    // whether programmatic application is available. `boardToken` and
    // `jobId` are used by some providers such as Greenhouse.
    ats: {
      type: String, // e.g., Greenhouse, Lever, etc.
      supportsApiApply: { type: Boolean, default: false },
      boardToken: String,
      jobId: String,
    },
    // Additional enrichment fields that can be populated by external
    // services (e.g. Clearbit) to provide more context about the
    // employer.
    enrichment: {
      companySize: String,
      industry: String,
    },
  },
  { timestamps: true },
);

const Job = mongoose.model("Job", jobSchema);
export default Job;