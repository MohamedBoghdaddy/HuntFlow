import ChatSession from "../models/ChatSession.js";
import Profile from "../models/Profile.js";
import CV from "../models/Cv.js";
import { chatWithPython } from "../services/pythonAiService.js";

export const sendCareerCoachMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, sessionId } = req.body;

    const profile = await Profile.findOne({ userId });
    const cv = await CV.findOne({ userId }).sort({ createdAt: -1 });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    let chatSession;

    if (sessionId) {
      chatSession = await ChatSession.findOne({ _id: sessionId, userId });
    }

    if (!chatSession) {
      chatSession = await ChatSession.create({
        userId,
        messages: [],
      });
    }

    const history = chatSession.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const aiResult = await chatWithPython({
      profile,
      cvAnalysis: cv?.analysis || null,
      history,
      message,
    });

    chatSession.messages.push({ role: "user", content: message });
    chatSession.messages.push({ role: "assistant", content: aiResult.reply });
    await chatSession.save();

    res.json({
      sessionId: chatSession._id,
      reply: aiResult.reply,
      suggestions: aiResult.suggestions || [],
    });
  } catch (error) {
    console.error("sendCareerCoachMessage error:", error.message);
    res.status(500).json({ message: "Failed to send message" });
  }
};
