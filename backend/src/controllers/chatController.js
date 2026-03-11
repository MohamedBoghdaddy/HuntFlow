import axios from "axios";

export const sendCareerCoachMessage = async (req, res) => {
  try {
    const {
      message,
      profile_summary,
      resume_text,
      target_role,
      target_industry,
      target_location,
      job_description,
      conversation_history = [],
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const pythonBaseUrl = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

    const response = await axios.post(
      `${pythonBaseUrl}/career-coach/chat`,
      {
        message,
        profile_summary,
        resume_text,
        target_role,
        target_industry,
        target_location,
        job_description,
        conversation_history,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "sendCareerCoachMessage error:",
      error.response?.data || error.message,
    );

    return res.status(error.response?.status || 500).json({
      error: "Career coach request failed",
      details: error.response?.data || error.message,
    });
  }
};
