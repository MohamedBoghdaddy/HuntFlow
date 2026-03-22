import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const { login, register } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Email and password are required.");
      return;
    }
    if (isRegister && !name.trim()) {
      Alert.alert("Error", "Name is required for registration.");
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Authentication failed";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>HuntFlow</Text>
        <Text style={styles.subtitle}>Your AI-powered job hunt assistant</Text>

        {isRegister && (
          <TextInput
            style={styles.input}
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isRegister ? "Register" : "Login"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegister((p) => !p)} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {isRegister
              ? "Already have an account? Login"
              : "Don't have an account? Register"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  logo: { fontSize: 36, fontWeight: "800", color: "#1976d2", textAlign: "center", mb: 4 },
  subtitle: { fontSize: 15, color: "#666", textAlign: "center", marginBottom: 32 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  toggle: { alignItems: "center" },
  toggleText: { color: "#1976d2", fontSize: 14 },
});
