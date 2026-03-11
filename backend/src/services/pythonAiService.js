import axios from "axios";

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://127.0.0.1:8000";

const pythonAiClient = axios.create({
  baseURL: PYTHON_AI_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const analyzeCvWithPython = async ({ profile, cvText }) => {
  const response = await pythonAiClient.post("/analyze-cv", {
    profile,
    cv_text: cvText,
  });

  return response.data;
};

export const chatWithPython = async ({
  profile,
  cvAnalysis,
  history,
  message,
}) => {
  const response = await pythonAiClient.post("/career-chat", {
    profile,
    cv_analysis: cvAnalysis,
    history,
    message,
  });

  return response.data;
};

export default pythonAiClient;
