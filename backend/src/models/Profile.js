import mongoose from "mongoose";

const linksSchema = new mongoose.Schema(
  {
    portfolio: { type: String, default: "" },
    github: { type: String, default: "" },
    linkedin: { type: String, default: "" },
  },
  { _id: false },
);

const salaryExpectationSchema = new mongoose.Schema(
  {
    amount: { type: String, default: "" },
    currency: { type: String, default: "" },
  },
  { _id: false },
);

const preferencesSchema = new mongoose.Schema(
  {
    roles: { type: [String], default: [] },
    industries: { type: [String], default: [] },
    companies: { type: [String], default: [] },
    salary: { type: String, default: "" },
    remoteOnly: { type: Boolean, default: false },
    cities: { type: [String], default: [] },
  },
  { _id: false },
);

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    title: { type: String, default: "" },
    seniority: { type: String, default: "" },
    locations: { type: [String], default: [] },
    links: { type: linksSchema, default: () => ({}) },
    authorization: { type: String, default: "" },
    salaryExpectation: {
      type: salaryExpectationSchema,
      default: () => ({}),
    },
    preferences: {
      type: preferencesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

const Profile = mongoose.model("Profile", profileSchema);

export default Profile;
