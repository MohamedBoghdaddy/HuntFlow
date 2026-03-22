import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { api } from "../api/api";

const MATCH_COLOR = (percent) => {
  if (percent == null) return "#9e9e9e";
  if (percent >= 70) return "#2e7d32";
  if (percent >= 50) return "#e65100";
  return "#c62828";
};

export default function JobsScreen() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      let list = [];
      try {
        const res = await api.jobs.searchIngest({
          query: search.trim() || "software",
          limit: 20,
        });
        list = res?.data?.jobs || [];
      } catch {
        const res = await api.jobs.search({
          query: search.trim() || "software",
          pages: 1,
          results_per_page: 20,
        });
        list = res?.data?.jobs || res?.jobs || [];
      }
      setJobs(list);
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleMatchCv = async () => {
    if (jobs.length === 0) return;
    setMatching(true);
    try {
      const payload = jobs.map((j) => ({
        title: j.title || "",
        company: j.company || "",
        description_snippet: j.description || j.description_snippet || "",
      }));
      const res = await api.jobs.match(payload);
      const matched = res?.data?.jobs || [];
      setJobs((prev) =>
        prev.map((job, i) => ({
          ...job,
          match_score: matched[i]?.match_score ?? job.match_score,
          match_percent: matched[i]?.match_percent ?? job.match_percent,
        })),
      );
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to match CV");
    } finally {
      setMatching(false);
    }
  };

  const handleApply = (job) => {
    const url = job.apply_url || job.job_url || job.url;
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert("No URL", "No application URL available for this job.");
    }
  };

  const handleSave = async (job) => {
    try {
      await api.applications.create({ externalJob: job });
      Alert.alert("Saved", "Job saved to your pipeline.");
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.error || err?.message || "Failed to save");
    }
  };

  const renderJob = ({ item: job }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.jobTitle} numberOfLines={2}>{job.title || "Job"}</Text>
          <Text style={styles.jobCompany}>{job.company || ""}</Text>
          <Text style={styles.jobLocation}>{job.location || "Remote"}</Text>
        </View>
        {job.match_percent != null && (
          <View style={[styles.badge, { backgroundColor: MATCH_COLOR(job.match_percent) }]}>
            <Text style={styles.badgeText}>{job.match_percent}%</Text>
          </View>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnOutlined]}
          onPress={() => handleSave(job)}
        >
          <Text style={styles.btnOutlinedText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnFilled]}
          onPress={() => handleApply(job)}
        >
          <Text style={styles.btnFilledText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={fetchJobs}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={fetchJobs}>
          <Text style={styles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.matchBtn, (matching || jobs.length === 0) && styles.matchBtnDisabled]}
        onPress={handleMatchCv}
        disabled={matching || jobs.length === 0}
      >
        {matching ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.matchBtnText}>Match with my CV</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item, i) => item._id || item.job_url || String(i)}
          renderItem={renderJob}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No jobs found. Try a different search.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 12 },
  searchRow: { flexDirection: "row", marginBottom: 8, gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchBtnText: { color: "#fff", fontWeight: "700" },
  matchBtn: {
    backgroundColor: "#7b1fa2",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  matchBtnDisabled: { opacity: 0.5 },
  matchBtnText: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  cardTitleBlock: { flex: 1, marginRight: 8 },
  jobTitle: { fontSize: 15, fontWeight: "700", color: "#212121" },
  jobCompany: { fontSize: 13, color: "#555", marginTop: 2 },
  jobLocation: { fontSize: 12, color: "#888", marginTop: 2 },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    minWidth: 44,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  cardActions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, borderRadius: 6, padding: 8, alignItems: "center" },
  btnOutlined: { borderWidth: 1, borderColor: "#1976d2" },
  btnFilled: { backgroundColor: "#1976d2" },
  btnOutlinedText: { color: "#1976d2", fontWeight: "600", fontSize: 13 },
  btnFilledText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
});
