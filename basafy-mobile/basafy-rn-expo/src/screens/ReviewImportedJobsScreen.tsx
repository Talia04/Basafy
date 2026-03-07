import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, FlatList, Keyboard, KeyboardAvoidingView, Platform,
  TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
  ActivityIndicator, Switch, TextInput, Modal, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme, Palette } from "../theme/palette";
import { supabase } from "@backend/supabase/client";
import EmptyState from "../components/common/EmptyState";

type Application = {
  id: string;
  company: string | null;
  role: string | null;
  role_title: string | null;
  status: string | null;
  is_hidden: boolean;
  source_type: string | null;
};

type Props = {
  onExit?: () => void;
};

const STATUS_OPTIONS = ["Applied", "Interview", "Assessment", "Offer", "Rejected"];
const FETCH_LIMIT = 60;

function needsReview(app: Application) {
  return !app.company || !(app.role_title || app.role);
}

export default function ReviewImportedJobsScreen({ onExit }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const queryClient = useQueryClient();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Application | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  async function fetchApplications(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    setErrorMessage(null);

    let query = supabase
      .from("applications")
      .select("id, company, role, role_title, status, is_hidden, source_type", { count: "exact" })
      .eq("source_type", "gmail")
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);

    if (!showHidden) {
      query = query.or("is_hidden.is.null,is_hidden.eq.false");
    }

    const { data, error, count } = await query;

    if (error) {
      setErrorMessage("Unable to load Gmail imports right now.");
      setApplications([]);
    } else {
      // Sort: needs-review apps first, then the rest
      const sorted = (data ?? []).slice().sort((a, b) => {
        const aNr = needsReview(a) ? 0 : 1;
        const bNr = needsReview(b) ? 0 : 1;
        return aNr - bNr;
      });
      setApplications(sorted);
      setTotalCount(count ?? null);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchApplications(); }, [showHidden]);

  const needsReviewCount = useMemo(
    () => applications.filter(needsReview).length,
    [applications]
  );

  async function hideApplication(id: string) {
    await supabase.from("applications").update({ is_hidden: true }).eq("id", id);
    setApplications((prev) => prev.filter((app) => app.id !== id));
    queryClient.invalidateQueries({ queryKey: ["applications"] });
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
  }

  function openEdit(app: Application) {
    setEditing(app);
    setEditCompany(app.company ?? "");
    setEditRole(app.role_title ?? app.role ?? "");
    setEditStatus(app.status ?? null);
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    const company = editCompany.trim() || editing.company;
    const role = editRole.trim() || editing.role_title || editing.role;
    const status = editStatus || editing.status;
    const { error } = await supabase
      .from("applications")
      .update({ company, role, role_title: role, status })
      .eq("id", editing.id);

    if (!error) {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === editing.id
            ? { ...app, company, role, role_title: role, status }
            : app
        )
      );
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    } else {
      setErrorMessage("Unable to save changes right now.");
    }
    setSavingEdit(false);
  }

  function renderItem({ item }: { item: Application }) {
    const nr = needsReview(item);
    const companyLabel = item.company ?? "Unknown company";
    const roleLabel = item.role_title ?? item.role ?? "Role not set";
    const statusLabel = item.status ?? "Unknown";

    return (
      <View style={[styles.card, nr && styles.cardNeedsReview]}>
        {nr && (
          <View style={styles.reviewBadge}>
            <Ionicons name="alert-circle-outline" size={12} color="#F7C873" />
            <Text style={styles.reviewBadgeText}>Needs review</Text>
          </View>
        )}
        <View style={styles.companyRow}>
          <Text style={[styles.company, !item.company && styles.missingText]} numberOfLines={1}>
            {companyLabel}
          </Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={[styles.role, !(item.role_title || item.role) && styles.missingText]} numberOfLines={1}>
          {roleLabel}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
            <Ionicons name="pencil-outline" size={14} color={palette.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hideBtn} onPress={() => hideApplication(item.id)}>
            <Ionicons name="eye-off-outline" size={14} color={palette.muted} />
            <Text style={styles.hideBtnText}>Hide</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const subtitle = totalCount !== null
    ? `${applications.length} of ${totalCount} imports${needsReviewCount > 0 ? ` · ${needsReviewCount} need review` : ""}`
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Review Gmail Imports</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {onExit && (
          <TouchableOpacity style={styles.doneBtn} onPress={onExit}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Show hidden toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show hidden</Text>
        <Switch
          value={showHidden}
          onValueChange={setShowHidden}
          trackColor={{ true: palette.primary }}
          thumbColor={palette.card}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.helper}>Loading Gmail imports…</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchApplications()}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchApplications(true); }}
              tintColor={palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-circle-outline"
              title="All caught up!"
              message="No Gmail imports to review."
            />
          }
          ListFooterComponent={
            totalCount !== null && totalCount > FETCH_LIMIT ? (
              <Text style={styles.moreHint}>
                Showing first {FETCH_LIMIT} of {totalCount}. Sync again to process remaining.
              </Text>
            ) : null
          }
        />
      )}

      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit import</Text>
                  <TouchableOpacity onPress={() => setEditing(null)}>
                    <Ionicons name="close" size={22} color={palette.muted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalLabel}>Company</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCompany}
                  onChangeText={setEditCompany}
                  placeholder="Company name"
                  placeholderTextColor={palette.muted}
                  autoCapitalize="words"
                />

                <Text style={styles.modalLabel}>Role</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editRole}
                  onChangeText={setEditRole}
                  placeholder="Job title"
                  placeholderTextColor={palette.muted}
                  autoCapitalize="words"
                />

                <Text style={styles.modalLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((opt) => {
                    const active = editStatus === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.statusChip, active && styles.statusChipActive]}
                        onPress={() => setEditStatus(opt)}
                      >
                        <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, savingEdit && { opacity: 0.6 }]}
                  onPress={saveEdit}
                  disabled={savingEdit}
                >
                  <Text style={styles.saveBtnText}>{savingEdit ? "Saving…" : "Save changes"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(90,239,213,0.14)",
    borderWidth: 1,
    borderColor: "rgba(90,239,213,0.35)",
  },
  doneBtnText: {
    color: "#5AEFD5",
    fontWeight: "700",
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.muted,
  },
  list: {
    paddingBottom: 40,
    paddingTop: 4,
  },
  moreHint: {
    textAlign: "center",
    color: palette.muted,
    fontSize: 12,
    paddingVertical: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  helper: {
    color: palette.muted,
    fontSize: 13,
  },
  errorText: {
    color: "#FF7B7B",
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: palette.card,
  },
  retryBtnText: {
    color: palette.text,
    fontWeight: "600",
  },
  // Card
  card: {
    backgroundColor: palette.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardNeedsReview: {
    borderColor: "rgba(247,200,115,0.3)",
    backgroundColor: "rgba(247,200,115,0.05)",
  },
  reviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  reviewBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F7C873",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  company: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
    flex: 1,
  },
  role: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: 10,
  },
  missingText: {
    color: "#F7C873",
    fontStyle: "italic",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(156,198,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(156,198,255,0.25)",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CC6FF",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(156,198,255,0.3)",
    backgroundColor: "rgba(156,198,255,0.08)",
  },
  editBtnText: {
    color: palette.primary,
    fontWeight: "600",
    fontSize: 13,
  },
  hideBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  hideBtnText: {
    color: palette.muted,
    fontWeight: "600",
    fontSize: 13,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
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
  modalLabel: {
    color: palette.muted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginBottom: -4,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: palette.text,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    fontSize: 15,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  statusChipActive: {
    backgroundColor: "#5AEFD5",
    borderColor: "#5AEFD5",
  },
  statusChipText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "600",
  },
  statusChipTextActive: {
    color: "#0A0E1A",
    fontWeight: "700",
  },
  saveBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#5AEFD5",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#0A0E1A",
    fontWeight: "800",
    fontSize: 15,
  },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cancelBtnText: {
    color: palette.text,
    fontWeight: "700",
  },
});
