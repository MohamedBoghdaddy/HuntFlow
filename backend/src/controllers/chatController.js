import Chat from "../models/Chat.js";

// Create a new chat with an initial message. If no message is provided
// the chat will be created with an empty messages array.
const createChat = async (req, res) => {
  try {
    const { messages } = req.body;
    const chat = new Chat({ user: req.user.id, messages: [] });
    if (Array.isArray(messages)) {
      // Only keep valid entries (role + content) and assign current timestamp
      for (const msg of messages) {
        if (msg && msg.role && msg.content) {
          chat.messages.push({
            role: msg.role,
            content: msg.content,
            createdAt: new Date(),
          });
        }
      }
    }
    await chat.save();
    return res.status(201).json({ chat });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create chat" });
  }
};

// List all chats for the authenticated user.
const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user.id }).sort({ updatedAt: -1 });
    return res.json({ chats });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch chats" });
  }
};

// Get a specific chat by ID.
const getChatById = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await Chat.findOne({ _id: id, user: req.user.id });
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    return res.json({ chat });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch chat" });
  }
};

// Append a message to an existing chat. Expects a JSON body with
// { role: 'user'|'assistant', content: string }.
const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, content } = req.body;
    if (!role || !content) {
      return res.status(400).json({ error: "Role and content are required" });
    }
    const chat = await Chat.findOne({ _id: id, user: req.user.id });
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    chat.messages.push({ role, content, createdAt: new Date() });
    await chat.save();
    return res.json({ chat });
  } catch (err) {
    return res.status(500).json({ error: "Failed to add message" });
  }
};

// Delete a chat by ID.
const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await Chat.findOneAndDelete({ _id: id, user: req.user.id });
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    return res.json({ message: "Chat deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete chat" });
  }
};

export default {
  createChat,
  getChats,
  getChatById,
  addMessage,
  deleteChat,
};