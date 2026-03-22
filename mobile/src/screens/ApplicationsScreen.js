import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { api } from "../api/api";

const COLUMNS = [
  { key: "saved", label: "Saved", color: "#1976d2" },
  { key: "queued", label: "Queued", color: "#7b1fa2" },
  { key: "applied", label: "Applied", color: "#0288d1" },
  { key: "interview", label: "Interview", color: "#f57c00" },
  { key: "offer", label: "Offer", color: "#2e7d32" },
  { key: "rejected", label: "Rejected", color: "#c62828" },
];

const STATUS_NEXT = {
  saved: "queued",
  queued: "applied",
  applied: "interview",
  interview: "offer",
};

export default function ApplicationsScreen() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await api.applications.list();
      setApplications(res?.data?.applications || []);
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to load applications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchApplications();
  };

  const handleAdvance = async (app) => {
    const nextStatus = STATUS_NEXT[app.status];
    if (!nextStatus) return;
    try {
      await api.applications.update(app._id, { status: nextStatus });
      setApplications((prev) =>
        prev.map((a) => (a._id === app._id ? { ...a, status: nextStatus } : a)),
      );
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to update status");
    }
  };

  const handleDelete = async (app) => {
    Alert.alert("Remove", "Remove this application from your pipeline?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.applications.delete(app._id);
            setApplications((prev) => prev.filter((a) => a._id !== app._id));
          } catch (err) {
            Alert.alert("Error", err?.message || "Failed to delete");
          }
        },
      },
    ]);
  };

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.key] = applications.filter((a) => a.status === col.key);
    return acc;
  }, {});

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>Application Pipeline</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.kanban}>
          {COLUMNS.map((col) => (
            <View key={col.key} style={styles.column}>
              <View style={[styles.colHeader, { backgroundColor: col.color }]}>
                <Text style={styles.colTitle}>{col.label}</Text>
                <Text style={styles.colCount}>{grouped[col.key]?.length || 0}</Text>
              </View>

              {(grouped[col.key] || []).map((app) => (
                <View key={app._id} style={styles.card}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {app.job?.title || "Job"}
                  </Text>
                  <Text style={styles.cardCompany} numberOfLines={1}>
                    {app.job?.company || ""}
                  </Text>
                  <View style={styles.cardActions}>
                    {STATUS_NEXT[app.status] && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: col.color }]}
                        onPress={() => handleAdvance(app)}
                      >
                        <Text style={styles.actionBtnText}>Advance</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => handleDelete(app)}
                    >
                      <Text style={styles.actionBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {grouped[col.key]?.length === 0 && (
                <Text style={styles.emptyCol}>Empty</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 22, fontWeight: "800", padding: 16, color: "#212121" },
  kanban: { flexDirection: "row", paddingHorizontal: 8, paddingBottom: 24 },
  column: {
    width: 200,
    marginRight: 10,
    backgroundColor: "#ececec",
    borderRadius: 10,
    overflow: "hidden",
  },
  colHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
  },
  colTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  colCount: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  card: {
    backgroundColor: "#fff",
    margin: 6,
    borderRadius: 8,
    padding: 10,
    elevation: 1,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#212121" },
  cardCompany: { fontSize: 12, color: "#666", marginTop: 2, marginBottom: 8 },
  cardActions: { flexDirection: "row", gap: 4 },
  actionBtn: {
    flex: 1,
    borderRadius: 6,
    padding: 5,
    alignItems: "center",
  },
  deleteBtn: { backgroundColor: "#9e9e9e" },
  actionBtnText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  emptyCol: { textAlign: "center", color: "#bbb", padding: 12, fontSize: 12 },
});
