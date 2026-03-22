import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api } from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState({ name: "", headline: "", location: "", bio: "" });
  const [cv, setCv] = useState(null);
  const [cvAnalysis, setCvAnalysis] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, cvRes] = await Promise.allSettled([
        api.profile.get(),
        api.cv.latest(),
      ]);
      if (profileRes.status === "fulfilled") {
        const p = profileRes.value?.data || {};
        setProfile({
          name: p.name || user?.name || "",
          headline: p.headline || "",
          location: p.location || "",
          bio: p.bio || "",
        });
      }
      if (cvRes.status === "fulfilled") {
        setCv(cvRes.value?.data || null);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.profile.update(profile);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyseCv = async () => {
    if (!cv?.extractedText) {
      Alert.alert("No CV", "Please upload your CV first via the web app.");
      return;
    }
    setAnalysing(true);
    try {
      const res = await api.cv.analyze({
        cv_text: cv.extractedText,
        prompt: "Analyze my CV, highlight strengths, weaknesses, and suggest improvements.",
      });
      setCvAnalysis(res?.data?.text || res?.data?.analysis || "No analysis returned.");
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to analyse CV");
    } finally {
      setAnalysing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.heading}>My Profile</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={profile.name}
          onChangeText={(v) => setProfile((p) => ({ ...p, name: v }))}
          placeholder="Your full name"
        />

        <Text style={styles.label}>Headline</Text>
        <TextInput
          style={styles.input}
          value={profile.headline}
          onChangeText={(v) => setProfile((p) => ({ ...p, headline: v }))}
          placeholder="e.g. Senior Software Engineer"
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={profile.location}
          onChangeText={(v) => setProfile((p) => ({ ...p, location: v }))}
          placeholder="e.g. Cairo, Egypt"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={profile.bio}
          onChangeText={(v) => setProfile((p) => ({ ...p, bio: v }))}
          placeholder="Short bio..."
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Profile</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My CV</Text>
        {cv ? (
          <>
            <Text style={styles.cvName}>{cv.originalName || "Uploaded CV"}</Text>
            <Text style={styles.cvMeta}>
              Uploaded: {cv.createdAt ? new Date(cv.createdAt).toLocaleDateString() : "—"}
            </Text>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, analysing && styles.btnDisabled]}
              onPress={handleAnalyseCv}
              disabled={analysing}
            >
              {analysing ? (
                <ActivityIndicator color="#1976d2" />
              ) : (
                <Text style={styles.btnSecondaryText}>Analyse CV with AI</Text>
              )}
            </TouchableOpacity>

            {cvAnalysis ? (
              <View style={styles.analysisBox}>
                <Text style={styles.analysisText}>{cvAnalysis}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.noCV}>
            No CV uploaded yet. Upload your CV from the web app to enable AI features.
          </Text>
        )}
      </View>

      <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={logout}>
        <Text style={styles.btnText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 24, fontWeight: "800", padding: 16, color: "#212121" },
  section: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 10,
    padding: 16,
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: "#333" },
  label: { fontSize: 13, color: "#666", marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fafafa",
    marginBottom: 4,
  },
  multiline: { height: 90, textAlignVertical: "top" },
  btn: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    padding: 13,
    alignItems: "center",
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#1976d2" },
  btnSecondaryText: { color: "#1976d2", fontWeight: "700", fontSize: 14 },
  btnDanger: { backgroundColor: "#c62828", margin: 12 },
  cvName: { fontSize: 15, fontWeight: "600", color: "#212121" },
  cvMeta: { fontSize: 12, color: "#999", marginTop: 2, marginBottom: 8 },
  noCV: { color: "#888", fontSize: 14, lineHeight: 20 },
  analysisBox: {
    marginTop: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
  },
  analysisText: { fontSize: 13, color: "#333", lineHeight: 20 },
});
