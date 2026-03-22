// src/controllers/cvController.js (UPDATED + FIXED)
// Fixes:
// - Removes stray top-level "await cvCoach" code
// - Uses cvCoach instead of analyzeCvWithPython
// - Correct payload keys: cv_text (not cvText)
// - Stores analysis as ai.text (or full ai object) safely
// - Keeps PDF/DOCX extraction helpers
// - Cleans up imports (fs not used -> removed)

import mammoth from "mammoth";
import PDFParser from "pdf2json";

import Cv from "../models/Cv.js";
import Profile from "../models/Profile.js";
import { cvCoach, cvBuildResume, cvCoverLetter } from "../services/pythonAiService.js";

const pickUploadedFile = (req) => {
  const files = req.files || {};
  return (
    (files.file && files.file[0]) ||
    (files.cv && files.cv[0]) ||
    (files.resume && files.resume[0]) ||
    (files.document && files.document[0]) ||
    null
  );
};

// -------------------- Text extraction helpers --------------------

const extractTextFromPdf = (filePath) =>
  new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

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

// -------------------- Controllers --------------------

export const uploadCv = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const uploaded = pickUploadedFile(req);
    if (!uploaded) {
      return res.status(400).json({
        message: "No CV uploaded",
        hint: "Send multipart/form-data with a file field (any name).",
      });
    }

    const profileDoc = await Profile.findOne({ userId });
    const profile = profileDoc?.toObject?.() || profileDoc || {};

    const extractedText = await extractTextFromFile(uploaded);

    const ai = await cvCoach({
      profile,
      cv_text: extractedText,
      prompt:
        "Analyze my CV, point out weaknesses, and propose fixes tailored to my target role.",
    });

    const analysisText = ai?.text || "";

    const cv = await Cv.create({
      userId,
      originalName: uploaded.originalname || uploaded.filename || "cv",
      filePath: uploaded.path,
      extractedText,
      analysis: analysisText || ai,
    });

    return res.status(201).json({
      message: "CV uploaded and analyzed successfully",
      cv,
    });
  } catch (error) {
    console.error("uploadCv error:", error);
    return res.status(error?.status || 500).json({
      message: "CV upload failed",
      error: error.message,
      details: error?.meta || null,
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

export const analyzeCv = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const prompt =
      String(req.body?.prompt || "").trim() ||
      "Analyze my CV, point out weaknesses, and propose fixes tailored to my target role.";

    // Prefer body text if provided, otherwise use latest stored CV text
    const cv_text_from_body = req.body?.cv_text ? String(req.body.cv_text) : "";
    let cv_text = cv_text_from_body;

    if (!cv_text) {
      const latest = await Cv.findOne({ userId }).sort({ createdAt: -1 });
      if (!latest) return res.status(404).json({ message: "No CV found" });
      cv_text = latest.extractedText || "";
    }

    const profileDoc = await Profile.findOne({ userId });
    const profile = profileDoc?.toObject?.() || profileDoc || {};

    const ai = await cvCoach({ profile, cv_text, prompt });

    return res.json({ ok: true, ...ai }); // ai is usually { text }
  } catch (error) {
    console.error("analyzeCv error:", error);
    return res.status(error?.status || 500).json({
      message: "CV analyze failed",
      error: error.message,
      details: error?.meta || null,
    });
  }
};


export const createCv = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { user_profile, target_role, target_market } = req.body || {};
    const out = await cvBuildResume({
      user_profile: user_profile || {},
      target_role,
      target_market,
    });

    return res.json({ ok: true, ...out });
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: "CV create failed",
      error: error.message,
      details: error?.meta || null,
    });
  }
};

export const generateCoverLetter = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { job_title, company, job_description } = req.body || {};

    // Prefer body cv_text; otherwise fall back to latest stored CV
    let cv_text = req.body?.cv_text ? String(req.body.cv_text) : "";
    if (!cv_text) {
      const latest = await Cv.findOne({ userId }).sort({ createdAt: -1 });
      if (!latest) return res.status(404).json({ message: "No CV found. Please upload your CV first." });
      cv_text = latest.extractedText || "";
    }

    const result = await cvCoverLetter({
      cv_text,
      job_title: job_title || "",
      company: company || "",
      job_description: job_description || "",
    });

    return res.json({ ok: true, cover_letter: result?.cover_letter || result });
  } catch (error) {
    console.error("generateCoverLetter error:", error);
    return res.status(error?.status || 500).json({
      message: "Cover letter generation failed",
      error: error.message,
      details: error?.meta || null,
    });
  }
};