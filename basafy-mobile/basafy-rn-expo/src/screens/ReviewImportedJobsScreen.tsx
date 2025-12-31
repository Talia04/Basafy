import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette } from "../theme/palette";
import { supabase } from "@backend/supabase/client";

type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  email_snippet: string | null;
  is_hidden: boolean;
  source_type: string | null;
};

type Props = {
  onExit?: () => void;
};

export default function ReviewImportedJobsScreen({ onExit }: Props) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  // No navigation in standalone mode
  const theme = palette;

  useEffect(() => {
    fetchApplications();
  }, [showHidden]);

  async function fetchApplications() {
    setLoading(true);
    let query = supabase
      .from("applications")
      .select("id, company, role, status, email_snippet, is_hidden, source_type")
      .eq("source_type", "gmail")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!showHidden) {
      query = query.eq("is_hidden", false);
    }
    const { data, error } = await query;
    if (!error && data) setApplications(data);
    setLoading(false);
  }

  async function hideApplication(id: number) {
    await supabase.from("applications").update({ is_hidden: true }).eq("id", id);
    setApplications((prev) => prev.filter((app) => app.id !== id));
  }

  function renderItem({ item }: { item: Application }) {
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.companyRow}>
          <Text style={[styles.company, { color: theme.text }]}>{item.company}</Text>
          {item.source_type === "gmail" && (
            <View style={styles.gmailBadge}>
              <Text style={styles.gmailBadgeText}>Gmail</Text>
            </View>
          )}
        </View>
        <Text style={[styles.role, { color: theme.muted }]}>{item.role}</Text>
        <Text style={styles.status}>Status: {item.status}</Text>
        {item.email_snippet && (
          <Text style={styles.snippet}>Gmail: {item.email_snippet.slice(0, 80)}...</Text>
        )}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.keepBtn, { backgroundColor: theme.primary }]}
            onPress={() => hideApplication(item.id)}
          >
            <Text style={styles.keepText}>Keep</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hideBtn} onPress={() => hideApplication(item.id)}>
            <Text style={styles.hideText}>Hide</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Review Imported Gmail Jobs</Text>
        {onExit && (
          <TouchableOpacity style={styles.exitBtn} onPress={onExit}>
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.toggleRow}>
        <Text style={[styles.toggleLabel, { color: theme.muted }]}>Show hidden imports</Text>
        <Switch value={showHidden} onValueChange={setShowHidden} />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} />
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No new Gmail jobs to review.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  toggleLabel: { fontSize: 14, fontWeight: "600" },
  exitBtn: { padding: 8, borderRadius: 8, backgroundColor: "#eee" },
  exitText: { color: "#d00", fontWeight: "bold", fontSize: 16 },
  list: { paddingBottom: 32 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  company: { fontSize: 18, fontWeight: "bold" },
  role: { fontSize: 16, marginTop: 4 },
  status: { fontSize: 14, marginTop: 6, color: "#888" },
  snippet: { fontSize: 13, marginTop: 8, color: "#666" },
  gmailBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(234, 67, 53, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 67, 53, 0.35)",
  },
  gmailBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EA4335",
  },
  actions: { flexDirection: "row", marginTop: 12 },
  keepBtn: {
    flex: 1,
    marginRight: 8,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    opacity: 0.7,
  },
  keepText: { color: "#fff", fontWeight: "bold" },
  hideBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#eee",
    alignItems: "center",
  },
  hideText: { color: "#d00", fontWeight: "bold" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
});
