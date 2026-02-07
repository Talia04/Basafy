import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Keyboard, KeyboardAvoidingView, Platform, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, ActivityIndicator, Switch, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, Palette } from '../theme/palette';
import { supabase } from "@backend/supabase/client";
import EmptyState from "../components/common/EmptyState";

type Application = {
  id: string;
  company: string;
  role: string;
  status: string | null;
  email_snippet: string | null;
  is_hidden: boolean;
  source_type: string | null;
};

type Props = {
  onExit?: () => void;
};

export default function ReviewImportedJobsScreen({ onExit }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Application | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // No navigation in standalone mode
  const theme = palette;
  const statusOptions = useMemo(
    () => ["Applied", "Interview", "Offer", "Rejected", "Assessment", "Other"],
    []
  );

  useEffect(() => {
    fetchApplications();
  }, [showHidden]);

  async function fetchApplications() {
    setLoading(true);
    setErrorMessage(null);
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
    if (error) {
      setErrorMessage(error.message || "Unable to load Gmail imports.");
      setApplications([]);
    } else if (data) {
      setApplications(data);
    }
    setLoading(false);
  }

  async function hideApplication(id: string) {
    await supabase.from("applications").update({ is_hidden: true }).eq("id", id);
    setApplications((prev) => prev.filter((app) => app.id !== id));
  }

  function openEdit(application: Application) {
    setEditing(application);
    setEditCompany(application.company || "");
    setEditRole(application.role || "");
    setEditStatus(application.status || null);
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    const updates = {
      company: editCompany.trim() || editing.company,
      role: editRole.trim() || editing.role,
      status: editStatus || null,
    };
    const { error } = await supabase.from("applications").update(updates).eq("id", editing.id);
    if (!error) {
      setApplications((prev) =>
        prev.map((app) => (app.id === editing.id ? { ...app, ...updates } : app))
      );
      setEditing(null);
    } else {
      setErrorMessage(error.message || "Unable to update this application.");
    }
    setSavingEdit(false);
  }

  function renderItem({ item }: { item: Application }) {
    const statusLabel = item.status ? `Status: ${item.status}` : "Status: Unknown";
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
        <Text style={styles.status}>{statusLabel}</Text>
        {item.email_snippet && (
          <Text style={styles.snippet}>Gmail: {item.email_snippet.slice(0, 80)}...</Text>
        )}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.keepBtn, { backgroundColor: theme.primary }]}
            onPress={() => openEdit(item)}
          >
            <Text style={styles.keepText}>Edit</Text>
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
      {onExit && (
        <TouchableOpacity style={styles.doneButton} onPress={onExit}>
          <Text style={styles.doneText}>Looks good</Text>
        </TouchableOpacity>
      )}
      <View style={styles.toggleRow}>
        <Text style={[styles.toggleLabel, { color: theme.muted }]}>Show hidden imports</Text>
        <Switch value={showHidden} onValueChange={setShowHidden} />
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.helper}>Loading Gmail imports…</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centered}>
          <Text style={[styles.helper, styles.error]}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchApplications}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-circle-outline"
              title="All caught up!"
              message="No new Gmail jobs to review. You're all set."
            />
          }
        />
      )}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit import</Text>
                  <TouchableOpacity onPress={() => setEditing(null)}>
                    <Text style={styles.modalClose}>Close</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalLabel}>Company</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCompany}
                  onChangeText={setEditCompany}
                  placeholder="Company"
                  placeholderTextColor="rgba(244,246,250,0.4)"
                />
                <Text style={styles.modalLabel}>Role</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editRole}
                  onChangeText={setEditRole}
                  placeholder="Role"
                  placeholderTextColor="rgba(244,246,250,0.4)"
                />
                <Text style={styles.modalLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {statusOptions.map((option) => {
                    const isActive = editStatus === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[styles.statusChip, isActive && styles.statusChipActive]}
                        onPress={() => setEditStatus(option)}
                      >
                        <Text style={[styles.statusChipText, isActive && styles.statusChipTextActive]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={saveEdit}
                    disabled={savingEdit}
                  >
                    <Text style={styles.modalButtonText}>{savingEdit ? "Saving…" : "Save changes"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalButton} onPress={() => setEditing(null)}>
                    <Text style={styles.modalButtonGhostText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  doneButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(90, 239, 213, 0.16)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(90, 239, 213, 0.4)",
    marginBottom: 10,
  },
  doneText: { color: "#5AEFD5", fontWeight: "700" },
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
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 10 },
  helper: { color: "#888", fontSize: 13 },
  error: { color: "#FF7B7B" },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  retryText: { color: "#333", fontWeight: "600" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0D1426",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
  },
  modalClose: {
    color: "#9CC6FF",
    fontWeight: "700",
  },
  modalLabel: {
    color: palette.muted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  statusChipActive: {
    backgroundColor: "#5AEFD5",
    borderColor: "#5AEFD5",
  },
  statusChipText: {
    color: palette.text,
    fontSize: 12,
  },
  statusChipTextActive: {
    color: "#0A0E1A",
    fontWeight: "700",
  },
  modalActions: {
    marginTop: 8,
    gap: 10,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalButtonPrimary: {
    backgroundColor: "#5AEFD5",
    borderColor: "#5AEFD5",
  },
  modalButtonText: {
    color: "#0A0E1A",
    fontWeight: "800",
  },
  modalButtonGhostText: {
    color: palette.text,
    fontWeight: "700",
  },
});
