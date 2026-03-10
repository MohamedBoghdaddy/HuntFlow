import mongoose from "mongoose";

const cvSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originalName: String,
    filePath: String,
    extractedText: String,
    analysis: {
      strengths: [String],
      weaknesses: [String],
      missingSkills: [String],
      recommendedRoles: [String],
      rewriteSuggestions: [String],
      atsScore: Number,
      summary: String,
    },
  },
  { timestamps: true },
);

export default mongoose.model("CV", cvSchema);
