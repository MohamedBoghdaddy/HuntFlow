import axios from "axios";

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

export const analyzeCvWithPython = async ({ profile, cvText }) => {
  const response = await axios.post(`${PYTHON_AI_URL}/analyze-cv`, {
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
  const response = await axios.post(`${PYTHON_AI_URL}/career-chat`, {
    profile,
    cv_analysis: cvAnalysis,
    history,
    message,
  });
  return response.data;
};
