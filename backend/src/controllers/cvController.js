import fs from "fs";
import mammoth from "mammoth";
import PDFParser from "pdf2json";

import Cv from "../models/Cv.js";
import Profile from "../models/Profile.js";
import { analyzeCvWithPython } from "../services/pythonAiService.js";

const extractTextFromPdf = (filePath) =>
  new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(this, 1);

    pdfParser.on("pdfParser_dataError", (err) => {
      reject(new Error(err?.parserError || "Failed to parse PDF"));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        const pages = pdfData?.Pages || [];

        const text = pages
          .map((page) =>
            (page.Texts || [])
              .map((textItem) =>
                (textItem.R || [])
                  .map((r) => decodeURIComponent(r.T || ""))
                  .join(""),
              )
              .join(" "),
          )
          .join("\n");

        resolve(text);
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.loadPDF(filePath);
  });

const extractTextFromDocx = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
};

const extractTextFromFile = async (file) => {
  if (!file) return "";

  if (file.mimetype === "application/pdf") {
    return await extractTextFromPdf(file.path);
  }

  if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return await extractTextFromDocx(file.path);
  }

  return "";
};

export const uploadCv = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No CV uploaded" });
    }

    const profile = await Profile.findOne({ userId });
    const extractedText = await extractTextFromFile(req.file);

    const analysis = await analyzeCvWithPython({
      profile,
      cvText: extractedText,
    });

    const cv = await Cv.create({
      userId,
      originalName: req.file.originalname,
      filePath: req.file.path,
      extractedText,
      analysis,
    });

    return res.status(201).json({
      message: "CV uploaded and analyzed successfully",
      cv,
    });
  } catch (error) {
    console.error("uploadCv error:", error);
    return res.status(500).json({
      message: "CV upload failed",
      error: error.message,
    });
  }
};

export const getLatestCv = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const cv = await Cv.findOne({ userId }).sort({ createdAt: -1 });

    if (!cv) {
      return res.status(404).json({ message: "No CV found" });
    }

    return res.status(200).json(cv);
  } catch (error) {
    console.error("getLatestCv error:", error);
    return res.status(500).json({
      message: "Failed to fetch CV",
      error: error.message,
    });
  }
};
