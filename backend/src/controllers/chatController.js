import axios from "axios";
import Chat from "../models/Chat.js";

export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await Chat.findOne({ user: userId }).sort({ updatedAt: -1 });
    return res.json({ messages: chat?.messages || [] });
  } catch (err) {
    console.error("getChatHistory error:", err);
    return res.status(500).json({ error: "Failed to retrieve chat history" });
  }
};

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

    const pythonBaseUrl = process.env.PYTHON_AI_URL || process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

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

    // Persist to MongoDB (best-effort, don't block response)
    const userId = req.user?._id || req.user?.id;
    if (userId) {
      const aiText = response.data?.response || response.data?.text || JSON.stringify(response.data);
      Chat.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            messages: {
              $each: [
                { role: "user", content: message },
                { role: "assistant", content: aiText },
              ],
            },
          },
        },
        { upsert: true, new: true },
      ).catch(() => {});
    }

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
