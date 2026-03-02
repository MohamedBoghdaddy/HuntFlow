import mongoose from "mongoose";

// A Track groups multiple applications into a named pipeline for a user.
// Users can create tracks (e.g. "Spring internships", "Backend roles")
// and assign applications to them. Each track references an array of
// Application object IDs, but can remain empty until populated.
const trackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    description: { type: String },
    applications: [{ type: mongoose.Schema.Types.ObjectId, ref: "Application" }],
  },
  { timestamps: true },
);

const Track = mongoose.model("Track", trackSchema);
export default Track;