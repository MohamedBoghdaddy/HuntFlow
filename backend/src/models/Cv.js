import mongoose from "mongoose";

// Schema definition for a CV document. A CV belongs to a user and
// includes a title and the raw content of the résumé. Additional fields
// (such as parsed sections or attachments) can be added later.
const cvSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    content: { type: String },
  },
  { timestamps: true },
);

const Cv = mongoose.model("Cv", cvSchema);
export default Cv;