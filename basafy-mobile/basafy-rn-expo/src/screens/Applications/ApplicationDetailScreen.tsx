import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme, Palette } from '../../theme/palette';
import type { Application } from './ApplicationsScreen';
import { supabase } from '@backend/supabase/client';
import { lightImpact, selectionChanged, successNotification } from '../../lib/haptics';

const STATUS_OPTIONS = ['Applied', 'Assessment', 'Interview', 'Offer', 'Rejected'] as const;

// raw_subject / raw_snippet / received_at were dropped in schema cleanup (2026-02-10).
// Timeline now uses created_at and parsed fields from job_email_events.
type TimelineEvent = {
  id: number;
  event_type: string;
  created_at: string;
  parsed_company: string | null;
  parsed_role: string | null;
};

type Props = {
  application: Application;
  onBack?: () => void;
};

export default function ApplicationDetailScreen({ application, onBack }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const queryClient = useQueryClient();

  const [detail, setDetail] = useState<Application | null>(application);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Status update modal
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string>('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Notes editing
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Merge duplicate
  type MergeCandidate = { id: string; company: string | null; role: string | null; role_title: string | null; status: string | null };
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [mergeSearching, setMergeSearching] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<MergeCandidate | null>(null);
  const [merging, setMerging] = useState(false);
  const mergeSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchApplication();
  }, [application.id]);

  async function fetchApplication() {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from('applications')
      .select(
        'id, company, role, role_title, status, source_type, is_hidden, gmail_message_id, gmail_thread_id, email_snippet, created_at, updated_at, last_synced_at, notes'
      )
      .eq('id', application.id)
      .maybeSingle();
    if (error) {
      setErrorMessage('Unable to load application details right now.');
    } else if (data) {
      setDetail(data);
      setNotes((data as any).notes ?? '');
    }
    await fetchTimeline();
    setLoading(false);
  }

  async function fetchTimeline() {
    setTimelineError(null);
    const { data, error } = await supabase
      .from('job_email_events')
      .select('id, event_type, created_at, parsed_company, parsed_role')
      .eq('application_id', application.id)
      .order('created_at', { ascending: true })
      .limit(5);
    if (error) {
      setTimelineError('Unable to load email history right now.');
      setTimeline([]);
    } else if (data) {
      setTimeline(data);
    } else {
      setTimeline([]);
    }
  }

  const title = detail?.company || 'Application';
  const roleLabel = detail?.role || detail?.role_title || 'Role not set';
  const statusLabel = detail?.status || 'Status not set';
  const isGmail = detail?.source_type === 'gmail';
  const sourceLabel = detail?.source_type ? detail.source_type : 'manual';
  const lastUpdatedLabel = useMemo(() => {
    if (!detail?.updated_at) return '--';
    const parsed = new Date(detail.updated_at);
    return parsed.toLocaleDateString();
  }, [detail?.updated_at]);
  const emailSnippet = detail?.email_snippet || null;

  const openStatusModal = () => {
    setPendingStatus(detail?.status ?? 'Applied');
    setStatusModalVisible(true);
    lightImpact();
  };

  const handleSaveStatus = async () => {
    if (!detail) return;
    setSavingStatus(true);
    const { error } = await supabase
      .from('applications')
      .update({ status: pendingStatus })
      .eq('id', detail.id);
    setSavingStatus(false);
    if (error) {
      Alert.alert('Update failed', 'Unable to update status right now.');
      return;
    }
    setDetail((prev) => (prev ? { ...prev, status: pendingStatus } : prev));
    setStatusModalVisible(false);
    successNotification();
  };

  const handleSaveNotes = async () => {
    if (!detail) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from('applications')
      .update({ notes: notes.trim() || null })
      .eq('id', detail.id);
    setSavingNotes(false);
    if (error) {
      Alert.alert('Save failed', 'Unable to save notes right now.');
      return;
    }
    setEditingNotes(false);
    Keyboard.dismiss();
    successNotification();
  };

  const handleOpenInEmail = () => {
    const threadId = detail?.gmail_thread_id;
    if (!threadId) {
      Alert.alert('No email link', 'This application has no linked Gmail thread.');
      return;
    }
    const url = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Cannot open', 'Unable to open Gmail in the browser.');
    });
  };

  const openMergeModal = () => {
    setMergeSearch(detail?.company ?? '');
    setMergeSelected(null);
    setMergeCandidates([]);
    setMergeModalVisible(true);
    lightImpact();
  };

  const searchMergeCandidates = (query: string) => {
    setMergeSearch(query);
    if (mergeSearchTimer.current) clearTimeout(mergeSearchTimer.current);
    if (!query.trim()) { setMergeCandidates([]); return; }
    mergeSearchTimer.current = setTimeout(async () => {
      setMergeSearching(true);
      const { data } = await supabase
        .from('applications')
        .select('id, company, role, role_title, status')
        .neq('id', application.id)
        .or(`company.ilike.%${query}%,role.ilike.%${query}%,role_title.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      setMergeCandidates((data ?? []) as MergeCandidate[]);
      setMergeSearching(false);
    }, 350);
  };

  const confirmMerge = () => {
    if (!mergeSelected) return;
    const primaryLabel = `${detail?.company ?? 'Unknown'} — ${detail?.role_title ?? detail?.role ?? 'Unknown role'}`;
    const secondaryLabel = `${mergeSelected.company ?? 'Unknown'} — ${mergeSelected.role_title ?? mergeSelected.role ?? 'Unknown role'}`;
    Alert.alert(
      'Merge applications?',
      `Keep:\n"${primaryLabel}"\n\nAbsorb and delete:\n"${secondaryLabel}"\n\nAll emails, tasks and events from the duplicate will move to the primary. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', style: 'destructive', onPress: executeMerge },
      ]
    );
  };

  const executeMerge = async () => {
    if (!mergeSelected) return;
    setMerging(true);
    const { error } = await (supabase.rpc as any)('merge_applications', {
      primary_id: application.id,
      secondary_id: mergeSelected.id,
    });
    setMerging(false);
    if (error) {
      Alert.alert('Merge failed', error.message ?? 'Unable to merge right now.');
      return;
    }
    setMergeModalVisible(false);
    successNotification();
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    // Reload detail to reflect merged data
    fetchApplication();
  };

  const timelineLabel = (eventType: string) => {
    switch (eventType) {
      case 'application_received':
        return 'Application received from Gmail';
      case 'interview_invite':
        return 'Interview invite';
      case 'rejection':
        return 'Rejection';
      case 'offer':
        return 'Offer';
      default:
        return eventType.replace(/_/g, ' ');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={palette.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading application…</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchApplication} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.roleText}>{roleLabel}</Text>
              </View>
              <View style={styles.logoWrap}>
                <Ionicons name="briefcase-outline" size={20} color={palette.muted} />
              </View>
            </View>
            <View style={styles.badgeRow}>
              {isGmail && (
                <View style={styles.gmailBadge}>
                  <Ionicons name="mail-outline" size={11} color="#EA4335" />
                  <Text style={styles.gmailBadgeText}>Gmail</Text>
                </View>
              )}
              {detail?.is_hidden && <Text style={styles.hiddenTag}>Hidden import</Text>}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status and progress</Text>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Current status</Text>
                <Text style={styles.valueText}>{statusLabel}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Last updated</Text>
                <Text style={styles.valueText}>{lastUpdatedLabel}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Next action</Text>
                <Text style={styles.valueMuted}>Add a reminder or task</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Source</Text>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Source type</Text>
                <Text style={styles.valueText}>{sourceLabel}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Email</Text>
                <Text style={styles.valueMuted}>
                  {isGmail && detail?.gmail_message_id ? 'View email' : 'Not available'}
                </Text>
              </View>
              {isGmail && emailSnippet && (
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>Email preview</Text>
                    <TouchableOpacity onPress={() => setShowEmailPreview((prev) => !prev)}>
                      <Text style={styles.previewToggle}>{showEmailPreview ? 'Hide' : 'View full email'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.previewText}>
                    {showEmailPreview ? emailSnippet : `${emailSnippet.slice(0, 120)}...`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            <View style={styles.card}>
              {timelineError ? (
                <Text style={styles.valueMuted}>{timelineError}</Text>
              ) : timeline.length === 0 ? (
                <Text style={styles.valueMuted}>No email history yet.</Text>
              ) : (
                timeline.map((event) => (
                  <View key={event.id} style={styles.timelineRow}>
                    <Text style={styles.timelineDate}>
                      {new Date(event.created_at).toLocaleDateString()}
                    </Text>
                    <Text style={styles.timelineText}>
                      {timelineLabel(event.event_type)}
                    </Text>
                    {!!event.parsed_company && <Text style={styles.timelineSnippet}>{event.parsed_company}</Text>}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Notes</Text>
              {!editingNotes ? (
                <TouchableOpacity onPress={() => { setEditingNotes(true); lightImpact(); }}>
                  <Text style={styles.editLink}>{notes ? 'Edit' : 'Add'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => { setEditingNotes(false); setNotes((detail as any)?.notes ?? ''); }}>
                    <Text style={[styles.editLink, { color: palette.muted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveNotes} disabled={savingNotes}>
                    <Text style={styles.editLink}>{savingNotes ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={styles.card}>
              {editingNotes ? (
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add a note…"
                  placeholderTextColor={palette.muted}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              ) : (
                <Text style={notes ? styles.notesText : styles.valueMuted}>
                  {notes || 'No notes yet. Tap Add to write one.'}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contacts</Text>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Recruiter</Text>
                <Text style={styles.valueMuted}>Add recruiter contact</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Recruiter email</Text>
                <Text style={styles.valueMuted}>Add email</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Hiring manager</Text>
                <Text style={styles.valueMuted}>Add contact</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job details</Text>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Location</Text>
                <Text style={styles.valueMuted}>Add location</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Salary</Text>
                <Text style={styles.valueMuted}>Add salary</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Job link</Text>
                <Text style={styles.valueMuted}>Add job posting</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Type</Text>
                <Text style={styles.valueMuted}>Add type</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>Work style</Text>
                <Text style={styles.valueMuted}>Add work style</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={openStatusModal}>
              <Ionicons name="swap-horizontal-outline" size={15} color={palette.invertedText} style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Update status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => { setEditingNotes(true); lightImpact(); }}>
              <Ionicons name="create-outline" size={15} color={palette.text} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryButtonText}>Add a note</Text>
            </TouchableOpacity>
            {isGmail && detail?.gmail_thread_id && (
              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={handleOpenInEmail}>
                <Ionicons name="open-outline" size={15} color={palette.text} style={{ marginRight: 6 }} />
                <Text style={styles.secondaryButtonText}>Open in email</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.mergeButton} activeOpacity={0.85} onPress={openMergeModal}>
              <Ionicons name="git-merge-outline" size={15} color={palette.muted} style={{ marginRight: 6 }} />
              <Text style={styles.mergeButtonText}>Merge duplicate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Merge duplicate modal */}
      <Modal visible={mergeModalVisible} transparent animationType="slide" onRequestClose={() => setMergeModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.mergeOverlay}>
            <View style={styles.mergeSheet}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Merge duplicate</Text>
                <TouchableOpacity onPress={() => setMergeModalVisible(false)}>
                  <Ionicons name="close" size={22} color={palette.muted} />
                </TouchableOpacity>
              </View>

              {/* Primary (this app) */}
              <Text style={styles.mergeLabel}>Keep (primary)</Text>
              <View style={styles.mergeAppRow}>
                <Ionicons name="checkmark-circle" size={16} color="#5AEFD5" />
                <Text style={styles.mergeAppText} numberOfLines={1}>
                  {detail?.company ?? 'Unknown'} — {detail?.role_title ?? detail?.role ?? 'Unknown role'}
                </Text>
              </View>

              {/* Search */}
              <Text style={styles.mergeLabel}>Search for duplicate</Text>
              <View style={styles.mergeSearchRow}>
                <Ionicons name="search" size={16} color={palette.muted} />
                <TextInput
                  style={styles.mergeSearchInput}
                  value={mergeSearch}
                  onChangeText={searchMergeCandidates}
                  placeholder="Company or role name…"
                  placeholderTextColor={palette.muted}
                  autoCorrect={false}
                />
                {mergeSearching && <ActivityIndicator size="small" color={palette.muted} />}
              </View>

              {/* Candidates list */}
              <FlatList
                data={mergeCandidates}
                keyExtractor={(item) => item.id}
                style={styles.mergeList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = mergeSelected?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.mergeCandidateRow, selected && styles.mergeCandidateSelected]}
                      onPress={() => { setMergeSelected(selected ? null : item); selectionChanged(); }}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mergeCandidateCompany} numberOfLines={1}>
                          {item.company ?? 'Unknown company'}
                        </Text>
                        <Text style={styles.mergeCandidateRole} numberOfLines={1}>
                          {item.role_title ?? item.role ?? 'No role'}
                        </Text>
                      </View>
                      <View style={styles.mergeCandidateStatus}>
                        <Text style={styles.mergeCandidateStatusText}>{item.status ?? '—'}</Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={18} color="#5AEFD5" style={{ marginLeft: 8 }} />}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  mergeSearch.trim() && !mergeSearching ? (
                    <Text style={styles.mergeEmpty}>No matching applications found.</Text>
                  ) : null
                }
              />

              {/* Confirm */}
              {mergeSelected && (
                <TouchableOpacity
                  style={[styles.mergeConfirmBtn, merging && { opacity: 0.6 }]}
                  onPress={confirmMerge}
                  disabled={merging}
                  activeOpacity={0.85}
                >
                  {merging
                    ? <ActivityIndicator color="#0A0E1A" />
                    : <Text style={styles.mergeConfirmText}>Merge into this application</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Status update modal */}
      <Modal visible={statusModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setStatusModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Update Status</Text>
                    <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                      <Ionicons name="close" size={20} color={palette.muted} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.statusGrid}>
                    {STATUS_OPTIONS.map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusPill,
                          pendingStatus === status && styles.statusPillActive,
                        ]}
                        onPress={() => { setPendingStatus(status); selectionChanged(); }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            pendingStatus === status && styles.statusPillTextActive,
                          ]}
                        >
                          {status}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 16 }]}
                    onPress={handleSaveStatus}
                    disabled={savingStatus}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryButtonText}>
                      {savingStatus ? 'Saving…' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 13,
  },
  errorText: {
    color: '#FF7B7B',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  retryButtonText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backText: {
    color: palette.text,
    fontWeight: '700',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  roleText: {
    color: palette.muted,
    fontSize: 14,
    marginTop: 6,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  hiddenTag: {
    color: 'rgba(244, 246, 250, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  gmailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(234, 67, 53, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 67, 53, 0.35)',
  },
  gmailBadgeText: {
    color: '#EA4335',
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  labelText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  valueText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  valueMuted: {
    color: 'rgba(244, 246, 250, 0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  previewCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  previewToggle: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  previewText: {
    color: palette.muted,
    fontSize: 12,
  },
  timelineRow: {
    marginBottom: 10,
  },
  timelineDate: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  timelineText: {
    color: palette.text,
    fontSize: 13,
    marginTop: 4,
  },
  timelineSnippet: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  actionsRow: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: palette.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: palette.invertedText,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
  // ─── Section header row ───
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editLink: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  // ─── Notes ───
  notesInput: {
    color: palette.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  notesText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
  },
  // ─── Status modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.overlayBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: palette.overlay,
    borderWidth: 1,
    borderColor: palette.overlayBorder,
  },
  statusPillActive: {
    backgroundColor: `${palette.primary}22`,
    borderColor: palette.primary,
  },
  statusPillText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: palette.primary,
  },
  // ─── Merge button ───
  mergeButton: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mergeButtonText: {
    color: palette.muted,
    fontWeight: '600',
    fontSize: 13,
  },
  // ─── Merge modal ───
  mergeOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mergeSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mergeLabel: {
    color: palette.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
    marginBottom: -4,
  },
  mergeAppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(90,239,213,0.07)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(90,239,213,0.2)',
  },
  mergeAppText: {
    color: palette.text,
    fontWeight: '600',
    flex: 1,
    fontSize: 14,
  },
  mergeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mergeSearchInput: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  mergeList: {
    maxHeight: 260,
  },
  mergeCandidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mergeCandidateSelected: {
    backgroundColor: 'rgba(90,239,213,0.07)',
    borderColor: 'rgba(90,239,213,0.3)',
  },
  mergeCandidateCompany: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
  },
  mergeCandidateRole: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  mergeCandidateStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(156,198,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(156,198,255,0.2)',
    marginLeft: 8,
  },
  mergeCandidateStatusText: {
    color: '#9CC6FF',
    fontSize: 11,
    fontWeight: '700',
  },
  mergeEmpty: {
    color: palette.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  mergeConfirmBtn: {
    backgroundColor: '#5AEFD5',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  mergeConfirmText: {
    color: '#0A0E1A',
    fontWeight: '800',
    fontSize: 15,
  },
});
