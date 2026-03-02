import mongoose from "mongoose";

// A Chat document stores a conversation between the user and the career
// coach AI. Messages are stored in chronological order with a role
// ("user" or "assistant") and the message content. Additional
// metadata (e.g. message IDs from the AI service) can be added later.
const chatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;