import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { api } from "../api/api";

export default function CoachScreen() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I am your HuntFlow career coach powered by Gemini. Ask me anything about your CV, job search, interviews, or career goals.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await api.cv.coach({ messages: nextMessages });
      const replyText = res?.data?.text || res?.text || "Sorry, I could not generate a response.";
      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "The career coach is temporarily unavailable. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>
          {item.content}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {loading && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#1976d2" />
          <Text style={styles.typingText}>Coach is typing...</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask your career coach..."
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  chatList: { padding: 12, paddingBottom: 8 },
  bubble: {
    maxWidth: "80%",
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: "#1976d2",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: "#fff" },
  aiText: { color: "#212121" },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  typingText: { color: "#999", fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    maxHeight: 100,
    backgroundColor: "#fafafa",
  },
  sendBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: "#fff", fontWeight: "700" },
});
