import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import CV from "../models/Cv.js";
import Profile from "../models/Profile.js";
import { analyzeCvWithPython } from "../services/pythonAiService.js";

const extractTextFromFile = async (file) => {
  if (file.mimetype === "application/pdf") {
    const buffer = fs.readFileSync(file.path);
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ path: file.path });
    return result.value;
  }

  return "";
};

export const uploadCv = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await Profile.findOne({ userId });

    if (!req.file) {
      return res.status(400).json({ message: "No CV uploaded" });
    }

    const extractedText = await extractTextFromFile(req.file);
    const analysis = await analyzeCvWithPython({
      profile,
      cvText: extractedText,
    });

    const cv = await CV.create({
      userId,
      originalName: req.file.originalname,
      filePath: req.file.path,
      extractedText,
      analysis,
    });

    res.status(201).json({
      message: "CV uploaded and analyzed successfully",
      cv,
    });
  } catch (error) {
    console.error("uploadCv error:", error.message);
    res.status(500).json({ message: "CV upload failed" });
  }
};
