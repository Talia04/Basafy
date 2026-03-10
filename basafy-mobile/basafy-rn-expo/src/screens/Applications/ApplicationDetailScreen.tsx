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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme, Palette } from '../../theme/palette';
import type { Application } from './ApplicationsScreen';
import { supabase } from '@backend/supabase/client';
import { lightImpact, selectionChanged, successNotification } from '../../lib/haptics';
import { copyToClipboard } from '../../lib/universalLinkOpener';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Applied', 'Assessment', 'Interview', 'Offer', 'Rejected'] as const;
const PIPELINE_STAGES = ['Applied', 'Assessment', 'Interview', 'Offer'] as const;

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  Applied:    { color: '#94A3B8', bg: 'rgba(148,163,184,0.14)', icon: 'paper-plane-outline' },
  Assessment: { color: '#5AEFD5', bg: 'rgba(90,239,213,0.14)',  icon: 'clipboard-outline' },
  Interview:  { color: '#4A8CFF', bg: 'rgba(74,140,255,0.14)',  icon: 'people-outline' },
  Offer:      { color: '#F7C873', bg: 'rgba(247,200,115,0.14)', icon: 'trophy-outline' },
  Rejected:   { color: '#FF7B7B', bg: 'rgba(255,123,123,0.14)', icon: 'close-circle-outline' },
};

const TIMELINE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  application_received: { label: 'Application received', icon: 'paper-plane-outline', color: '#94A3B8' },
  interview_invite:     { label: 'Interview invite',     icon: 'people-outline',       color: '#4A8CFF' },
  assessment:           { label: 'Assessment',           icon: 'clipboard-outline',    color: '#5AEFD5' },
  rejection:            { label: 'Rejection received',   icon: 'close-circle-outline', color: '#FF7B7B' },
  offer:                { label: 'Offer received',       icon: 'trophy-outline',       color: '#F7C873' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type AppTask = {
  id: string;
  title: string;
  due_at: string | null;
  status: string;
};

type AppEvent = {
  id: string;
  title: string | null;
  event_type: string;
  start_at: string;
  meeting_link: string | null;
};

type TimelineEvent = {
  id: number;
  event_type: string;
  created_at: string;
  received_at: string | null;
  parsed_company: string | null;
  parsed_role: string | null;
};

type MergeCandidate = {
  id: string;
  company: string | null;
  role: string | null;
  role_title: string | null;
  status: string | null;
};

type Props = {
  application: Application;
  onBack?: () => void;
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function ApplicationDetailScreen({ application, onBack }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [detail, setDetail] = useState<Application | null>(application);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status modal
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string>('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Gmail modal
  const [gmailModalVisible, setGmailModalVisible] = useState(false);
  const [gmailSearchQuery, setGmailSearchQuery] = useState('');
  const [queryCopied, setQueryCopied] = useState(false);

  // Tasks
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDueAt, setNewTaskDueAt] = useState<Date | null>(null);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // Company / role edit
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [editCompany, setEditCompany] = useState('');
  const [editRole, setEditRole] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);

  // Email snippet
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Merge
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [mergeSearching, setMergeSearching] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<MergeCandidate | null>(null);
  const [merging, setMerging] = useState(false);
  const mergeSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchAll(); }, [application.id]);

  async function fetchAll() {
    setLoading(true);
    setErrorMessage(null);
    const [appResult, timelineResult, tasksResult, eventsResult] = await Promise.all([
      supabase
        .from('applications')
        .select('id, company, role, role_title, status, source_type, is_hidden, gmail_message_id, gmail_thread_id, internet_message_id, email_snippet, portal_domain, applied_at, created_at, updated_at, last_synced_at, notes')
        .eq('id', application.id)
        .maybeSingle(),
      supabase
        .from('job_email_events')
        .select('id, event_type, received_at, created_at, parsed_company, parsed_role')
        .eq('application_id', application.id)
        .order('created_at', { ascending: true })
        .limit(10),
      supabase
        .from('tasks')
        .select('id, title, due_at, status')
        .eq('application_id', application.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('id, title, event_type, start_at, meeting_link')
        .eq('application_id', application.id)
        .order('start_at', { ascending: true }),
    ]);

    if (appResult.error) {
      setErrorMessage('Unable to load application details right now.');
    } else if (appResult.data) {
      setDetail(appResult.data);
      setNotes((appResult.data as any).notes ?? '');
    }
    setTimeline(timelineResult.data ?? []);
    setTasks((tasksResult.data ?? []) as AppTask[]);
    setEvents((eventsResult.data ?? []) as AppEvent[]);
    setLoading(false);
  }

  // ─── Status ───────────────────────────────────────────────────────────────

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
    if (error) { Alert.alert('Update failed', 'Unable to update status right now.'); return; }
    setDetail((prev) => prev ? { ...prev, status: pendingStatus } : prev);
    setStatusModalVisible(false);
    successNotification();
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  };

  // ─── Company / role ───────────────────────────────────────────────────────

  const openIdentityEdit = () => {
    setEditCompany(detail?.company ?? '');
    setEditRole(detail?.role_title ?? detail?.role ?? '');
    setEditingIdentity(true);
    lightImpact();
  };

  const handleSaveIdentity = async () => {
    if (!detail) return;
    setSavingIdentity(true);
    const { error } = await supabase
      .from('applications')
      .update({ company: editCompany.trim() || null, role: editRole.trim() || null, role_title: editRole.trim() || null })
      .eq('id', detail.id);
    setSavingIdentity(false);
    if (error) { Alert.alert('Save failed', 'Unable to save changes right now.'); return; }
    setDetail((prev) => prev ? {
      ...prev,
      company: editCompany.trim() || null,
      role: editRole.trim() || null,
      role_title: editRole.trim() || null,
    } : prev);
    setEditingIdentity(false);
    Keyboard.dismiss();
    successNotification();
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  };

  // ─── Notes ────────────────────────────────────────────────────────────────

  const handleSaveNotes = async () => {
    if (!detail) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from('applications')
      .update({ notes: notes.trim() || null })
      .eq('id', detail.id);
    setSavingNotes(false);
    if (error) { Alert.alert('Save failed', 'Unable to save notes right now.'); return; }
    setEditingNotes(false);
    Keyboard.dismiss();
    successNotification();
  };

  // ─── Tasks ────────────────────────────────────────────────────────────────

  const handleAddTask = async () => {
    if (!newTaskText.trim() || !detail) return;
    setAddingTask(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { setAddingTask(false); Alert.alert('Error', 'Not signed in.'); return; }
    const { data, error } = await supabase
      .from('tasks')
      .insert({ user_id: userId, application_id: detail.id, title: newTaskText.trim(), status: 'open', origin: 'manual', due_at: newTaskDueAt?.toISOString() ?? null } as any)
      .select('id, title, due_at, status')
      .single();
    setAddingTask(false);
    if (error) { Alert.alert('Error', 'Unable to add task right now.'); return; }
    if (data) {
      setTasks((prev) => [data as AppTask, ...prev]);
      setNewTaskDueAt(null);
    }
    setNewTaskText('');
    successNotification();
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'open' : 'done';
    setTogglingTaskId(taskId);
    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus, completed_at: nextStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', taskId);
    setTogglingTaskId(null);
    if (!error) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: nextStatus } : t));
      selectionChanged();
    }
  };

  // ─── Gmail ────────────────────────────────────────────────────────────────

  const handleOpenInEmail = () => {
    const rfc822Id = (detail as any)?.internet_message_id as string | null | undefined;
    const domain   = (detail as any)?.portal_domain as string | null | undefined;
    const company  = detail?.company ?? '';
    const role     = detail?.role_title ?? detail?.role ?? '';

    const searchQuery = rfc822Id
      ? `rfc822msgid:${rfc822Id}`
      : [
          domain ? `from:@${domain}` : company ? `from:(${company})` : '',
          company,
          role,
        ].filter(Boolean).join(' ').trim();

    if (!searchQuery) {
      Alert.alert('No email link', 'This application has no linked Gmail message.');
      return;
    }

    console.log(`[OpenEmail] query="${searchQuery}" rfc822=${!!rfc822Id}`);
    setGmailSearchQuery(searchQuery);
    setQueryCopied(false);
    setGmailModalVisible(true);
    lightImpact();
  };

  const handleCopyGmailQuery = async () => {
    const ok = await copyToClipboard(gmailSearchQuery);
    if (ok) {
      setQueryCopied(true);
      selectionChanged();
    } else {
      // native module not yet compiled — fall back to share sheet
      Share.share({ message: gmailSearchQuery })
        .then(() => { setQueryCopied(true); selectionChanged(); })
        .catch(() => {});
    }
  };

  const handleLaunchGmail = () => {
    setGmailModalVisible(false);
    Linking.openURL('googlegmail://inbox').catch(() => {
      Alert.alert('Gmail not installed', 'Please install Gmail from the App Store.');
    });
  };

  // ─── Merge ────────────────────────────────────────────────────────────────

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
    const primary = `${detail?.company ?? 'Unknown'} — ${detail?.role_title ?? detail?.role ?? 'Unknown role'}`;
    const secondary = `${mergeSelected.company ?? 'Unknown'} — ${mergeSelected.role_title ?? mergeSelected.role ?? 'Unknown role'}`;
    Alert.alert(
      'Merge applications?',
      `Keep:\n"${primary}"\n\nAbsorb and delete:\n"${secondary}"\n\nAll emails, tasks and events will move to the primary. This cannot be undone.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Merge', style: 'destructive', onPress: executeMerge }]
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
    if (error) { Alert.alert('Merge failed', error.message ?? 'Unable to merge right now.'); return; }
    setMergeModalVisible(false);
    successNotification();
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    fetchAll();
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const statusKey = detail?.status ?? 'Applied';
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG['Applied'];
  const isGmail = detail?.source_type === 'gmail';
  const isRejected = statusKey === 'Rejected';
  const pipelineIndex = PIPELINE_STAGES.indexOf(statusKey as any);
  const companyInitial = (detail?.company ?? '?')[0].toUpperCase();
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const appliedDate = useMemo(() => {
    const dateStr = (detail as any)?.applied_at ?? detail?.created_at;
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [(detail as any)?.applied_at, detail?.created_at]);

  // ─── Loading / error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={18} color={palette.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading application…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={18} color={palette.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color="#FF7B7B" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAll} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={palette.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {isGmail && detail?.gmail_thread_id && (
            <TouchableOpacity style={styles.headerIcon} onPress={handleOpenInEmail} activeOpacity={0.75}>
              <Ionicons name="mail-outline" size={18} color={palette.muted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerIcon} onPress={openMergeModal} activeOpacity={0.75}>
            <Ionicons name="git-merge-outline" size={18} color={palette.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 96 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Hero card ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <LinearGradient colors={['#1E2D50', '#0F1628']} style={styles.companyAvatar}>
                <Text style={styles.companyInitial}>{companyInitial}</Text>
              </LinearGradient>
              <View style={{ flex: 1, gap: 4 }}>
                {editingIdentity ? (
                  <>
                    <TextInput
                      style={styles.identityInput}
                      value={editCompany}
                      onChangeText={setEditCompany}
                      placeholder="Company name"
                      placeholderTextColor={palette.muted}
                      autoFocus
                    />
                    <TextInput
                      style={[styles.identityInput, { fontSize: 13, fontWeight: '500' }]}
                      value={editRole}
                      onChangeText={setEditRole}
                      placeholder="Role / job title"
                      placeholderTextColor={palette.muted}
                      returnKeyType="done"
                      onSubmitEditing={handleSaveIdentity}
                    />
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                      <TouchableOpacity onPress={() => setEditingIdentity(false)}>
                        <Text style={[styles.editLink, { color: palette.muted }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleSaveIdentity} disabled={savingIdentity}>
                        <Text style={styles.editLink}>{savingIdentity ? 'Saving…' : 'Save'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.companyName} numberOfLines={2}>
                      {detail?.company ?? 'Unknown company'}
                    </Text>
                    <Text style={styles.roleName} numberOfLines={2}>
                      {detail?.role_title ?? detail?.role ?? 'Role not specified'}
                    </Text>
                  </>
                )}
              </View>
              {!editingIdentity && (
                <TouchableOpacity style={styles.editIdentityBtn} onPress={openIdentityEdit} activeOpacity={0.75}>
                  <Ionicons name="pencil-outline" size={14} color={palette.muted} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.heroMeta}>
              <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: `${statusCfg.color}50` }]}>
                <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusKey}</Text>
              </View>
              {isGmail && (
                <View style={styles.gmailBadge}>
                  <Ionicons name="mail-outline" size={11} color="#EA4335" />
                  <Text style={styles.gmailBadgeText}>Gmail</Text>
                </View>
              )}
              {detail?.is_hidden && (
                <View style={styles.hiddenBadge}>
                  <Ionicons name="eye-off-outline" size={11} color={palette.muted} />
                  <Text style={styles.hiddenBadgeText}>Hidden</Text>
                </View>
              )}
              {appliedDate && (
                <Text style={styles.metaDate}>Applied {appliedDate}</Text>
              )}
            </View>
          </View>

          {/* ── Needs review banner ── */}
          {(!detail?.company || !(detail?.role_title ?? detail?.role)) && !editingIdentity && (
            <TouchableOpacity style={styles.needsReviewBanner} onPress={openIdentityEdit} activeOpacity={0.8}>
              <Ionicons name="alert-circle-outline" size={14} color="#F4A942" />
              <Text style={styles.needsReviewText}>Company or role is missing — tap to fill in</Text>
              <Ionicons name="chevron-forward" size={14} color="#F4A942" />
            </TouchableOpacity>
          )}

          {/* ── Pipeline progress (hidden if Rejected) ── */}
          {!isRejected && (
            <View style={styles.pipelineCard}>
              {/* Dot row */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {PIPELINE_STAGES.map((stage, i) => {
                  const active = i <= pipelineIndex;
                  const current = i === pipelineIndex;
                  const cfg = STATUS_CONFIG[stage];
                  return (
                    <React.Fragment key={stage}>
                      <View style={[
                        styles.pipelineDot,
                        active && { backgroundColor: cfg.color, borderColor: cfg.color },
                        current && { width: 26, height: 26, borderRadius: 13, shadowColor: cfg.color, shadowOpacity: 0.7, shadowRadius: 8, elevation: 5 },
                      ]}>
                        {current && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0A0E1A' }} />}
                      </View>
                      {i < PIPELINE_STAGES.length - 1 && (
                        <View style={[styles.pipelineConnector, i < pipelineIndex && { backgroundColor: `${STATUS_CONFIG[PIPELINE_STAGES[i + 1]].color}55` }]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
              {/* Label row */}
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                {PIPELINE_STAGES.map((stage, i) => {
                  const active = i <= pipelineIndex;
                  const cfg = STATUS_CONFIG[stage];
                  return (
                    <Text
                      key={stage}
                      style={[styles.pipelineLabel, active && { color: cfg.color }, { flex: 1, textAlign: 'center' }]}
                    >
                      {stage}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Rejection banner ── */}
          {isRejected && (
            <View style={styles.rejectionBanner}>
              <Ionicons name="close-circle-outline" size={18} color="#FF7B7B" />
              <Text style={styles.rejectionText}>
                This application was rejected. You can update the status if this was a mistake.
              </Text>
            </View>
          )}

          {/* ── Upcoming events ── */}
          {events.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              {events.map((event) => {
                const date = new Date(event.start_at);
                const isPast = date < new Date();
                const cfg = event.event_type === 'interview'
                  ? { color: '#4A8CFF', icon: 'people-outline' }
                  : event.event_type === 'assessment'
                    ? { color: '#5AEFD5', icon: 'clipboard-outline' }
                    : { color: '#F7C873', icon: 'calendar-outline' };
                return (
                  <View key={event.id} style={[styles.eventCard, isPast && styles.eventCardPast]}>
                    <View style={[styles.eventIconWrap, { backgroundColor: `${cfg.color}18` }]}>
                      <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.title ?? event.event_type.replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.eventDate}>
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}
                        {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {isPast ? ' · Past' : ''}
                      </Text>
                    </View>
                    {event.meeting_link && !isPast && (
                      <TouchableOpacity
                        style={styles.joinBtn}
                        onPress={() => Linking.openURL(event.meeting_link!).catch(() => {})}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.joinBtnText}>Join</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Tasks ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            <View style={styles.card}>
              {tasks.length === 0 && (
                <Text style={styles.emptyText}>No tasks yet.</Text>
              )}
              {openTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  toggling={togglingTaskId === task.id}
                  onToggle={() => handleToggleTask(task.id, task.status)}
                  palette={palette}
                />
              ))}
              {doneTasks.length > 0 && (
                <>
                  <Text style={styles.doneLabel}>Completed</Text>
                  {doneTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      toggling={togglingTaskId === task.id}
                      onToggle={() => handleToggleTask(task.id, task.status)}
                      palette={palette}
                    />
                  ))}
                </>
              )}
              <View style={styles.addTaskRow}>
                <Ionicons name="add-circle-outline" size={20} color={palette.primary} />
                <TextInput
                  style={styles.addTaskInput}
                  value={newTaskText}
                  onChangeText={setNewTaskText}
                  placeholder="Add a task…"
                  placeholderTextColor={palette.muted}
                  returnKeyType="done"
                  onSubmitEditing={handleAddTask}
                  editable={!addingTask}
                />
                <TouchableOpacity
                  onPress={() => setShowDuePicker(true)}
                  activeOpacity={0.75}
                  style={styles.dueDateChip}
                >
                  <Ionicons name="calendar-outline" size={14} color={newTaskDueAt ? palette.primary : palette.muted} />
                  {newTaskDueAt && (
                    <Text style={[styles.dueDateChipText, { color: palette.primary }]}>
                      {newTaskDueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                </TouchableOpacity>
                {addingTask
                  ? <ActivityIndicator size="small" color={palette.primary} />
                  : newTaskText.trim().length > 0 && (
                    <TouchableOpacity onPress={handleAddTask} activeOpacity={0.75}>
                      <Text style={styles.addTaskBtn}>Add</Text>
                    </TouchableOpacity>
                  )
                }
              </View>
            </View>
          </View>

          {/* ── Email history / Timeline ── */}
          {timeline.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Email history</Text>
              <View style={styles.card}>
                {timeline.map((event, i) => {
                  const cfg = TIMELINE_CONFIG[event.event_type] ?? {
                    label: event.event_type.replace(/_/g, ' '),
                    icon: 'mail-outline',
                    color: '#94A3B8',
                  };
                  const isLast = i === timeline.length - 1;
                  return (
                    <View key={event.id} style={styles.timelineItem}>
                      <View style={styles.timelineLeft}>
                        <View style={[styles.timelineDot, { backgroundColor: cfg.color }]}>
                          <Ionicons name={cfg.icon as any} size={10} color="#0A0E1A" />
                        </View>
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>
                      <View style={[styles.timelineContent, !isLast && { paddingBottom: 18 }]}>
                        <Text style={styles.timelineLabel}>{cfg.label}</Text>
                        <Text style={styles.timelineDate}>
                          {new Date(event.received_at ?? event.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Notes ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Notes</Text>
              {!editingNotes ? (
                <TouchableOpacity onPress={() => { setEditingNotes(true); lightImpact(); }}>
                  <Text style={styles.editLink}>{notes ? 'Edit' : 'Add'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', gap: 16 }}>
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
                  placeholder="Add a note about this application…"
                  placeholderTextColor={palette.muted}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              ) : (
                <Text style={notes ? styles.notesText : styles.emptyText}>
                  {notes || 'No notes yet. Tap Add to write one.'}
                </Text>
              )}
            </View>
          </View>

          {/* ── Email snippet ── */}
          {isGmail && detail?.email_snippet && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.snippetToggle}
                onPress={() => setShowEmailPreview((p) => !p)}
                activeOpacity={0.75}
              >
                <Ionicons name="mail-outline" size={14} color={palette.muted} />
                <Text style={styles.snippetToggleText}>Email preview</Text>
                <Ionicons
                  name={showEmailPreview ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={palette.muted}
                />
              </TouchableOpacity>
              {showEmailPreview && (
                <View style={styles.card}>
                  <Text style={styles.snippetText}>{detail.email_snippet}</Text>
                  {detail.gmail_thread_id && (
                    <TouchableOpacity onPress={handleOpenInEmail} style={styles.openEmailBtn} activeOpacity={0.75}>
                      <Ionicons name="open-outline" size={13} color={palette.primary} />
                      <Text style={styles.openEmailBtnText}>Open in Gmail</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── Merge link ── */}
          <TouchableOpacity style={styles.mergeLink} onPress={openMergeModal} activeOpacity={0.7}>
            <Ionicons name="git-merge-outline" size={14} color={palette.muted} />
            <Text style={styles.mergeLinkText}>Merge duplicate application</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Fixed bottom bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={[styles.statusChipBar, { backgroundColor: statusCfg.bg, borderColor: `${statusCfg.color}50` }]}>
          <Ionicons name={statusCfg.icon as any} size={14} color={statusCfg.color} />
          <Text style={[styles.statusChipBarText, { color: statusCfg.color }]}>{statusKey}</Text>
        </View>
        <TouchableOpacity style={styles.updateBtn} onPress={openStatusModal} activeOpacity={0.85}>
          <Ionicons name="swap-horizontal-outline" size={16} color="#0A0E1A" />
          <Text style={styles.updateBtnText}>Update Status</Text>
        </TouchableOpacity>
      </View>

      {/* ── Status modal ── */}
      <Modal visible={statusModalVisible} transparent animationType="fade">
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
                  {STATUS_OPTIONS.map((status) => {
                    const cfg = STATUS_CONFIG[status];
                    const selected = pendingStatus === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusPill,
                          selected && { backgroundColor: cfg.bg, borderColor: cfg.color },
                        ]}
                        onPress={() => { setPendingStatus(status); selectionChanged(); }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={cfg.icon as any} size={14} color={selected ? cfg.color : palette.muted} />
                        <Text style={[styles.statusPillText, selected && { color: cfg.color }]}>{status}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={[styles.saveStatusBtn, savingStatus && { opacity: 0.6 }]}
                  onPress={handleSaveStatus}
                  disabled={savingStatus}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveStatusBtnText}>{savingStatus ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Merge modal ── */}
      <Modal visible={mergeModalVisible} transparent animationType="slide" onRequestClose={() => setMergeModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.mergeOverlay}>
            <View style={styles.mergeSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Merge duplicate</Text>
                <TouchableOpacity onPress={() => setMergeModalVisible(false)}>
                  <Ionicons name="close" size={22} color={palette.muted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.mergeLabel}>Keep (primary)</Text>
              <View style={styles.mergeAppRow}>
                <Ionicons name="checkmark-circle" size={16} color="#5AEFD5" />
                <Text style={styles.mergeAppText} numberOfLines={1}>
                  {detail?.company ?? 'Unknown'} — {detail?.role_title ?? detail?.role ?? 'Unknown role'}
                </Text>
              </View>
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
                      <View style={styles.mergeCandidateBadge}>
                        <Text style={styles.mergeCandidateBadgeText}>{item.status ?? '—'}</Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={18} color="#5AEFD5" style={{ marginLeft: 8 }} />}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  mergeSearch.trim() && !mergeSearching
                    ? <Text style={styles.mergeEmpty}>No matching applications found.</Text>
                    : null
                }
              />
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

      {/* ── Due-date preset picker ── */}
      <Modal visible={showDuePicker} transparent animationType="fade" onRequestClose={() => setShowDuePicker(false)}>
        <TouchableWithoutFeedback onPress={() => setShowDuePicker(false)}>
          <View style={styles.dueDateOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dueDateSheet}>
                <Text style={styles.dueDateSheetTitle}>Set due date</Text>
                {[
                  { label: 'Today',      days: 0 },
                  { label: 'Tomorrow',   days: 1 },
                  { label: 'In 2 days',  days: 2 },
                  { label: 'In 1 week',  days: 7 },
                  { label: 'In 2 weeks', days: 14 },
                ].map(({ label, days }) => {
                  const d = new Date();
                  d.setDate(d.getDate() + days);
                  const isSelected = newTaskDueAt?.toDateString() === d.toDateString();
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.dueDateOption, isSelected && styles.dueDateOptionSelected]}
                      onPress={() => { setNewTaskDueAt(d); setShowDuePicker(false); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.dueDateOptionText, isSelected && { color: palette.primary }]}>{label}</Text>
                      <Text style={styles.dueDateOptionSub}>
                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {newTaskDueAt && (
                  <TouchableOpacity
                    style={styles.dueDateClear}
                    onPress={() => { setNewTaskDueAt(null); setShowDuePicker(false); }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dueDateClearText}>Clear date</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Gmail search modal ── */}
      <Modal visible={gmailModalVisible} transparent animationType="slide" onRequestClose={() => setGmailModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setGmailModalVisible(false)}>
          <View style={styles.gmailOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.gmailSheet}>

                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Open in Gmail</Text>
                  <TouchableOpacity onPress={() => setGmailModalVisible(false)}>
                    <Ionicons name="close" size={20} color={palette.muted} />
                  </TouchableOpacity>
                </View>

                {/* Step 1 */}
                <View style={styles.gmailStep}>
                  <View style={styles.gmailStepBadge}>
                    <Text style={styles.gmailStepNum}>1</Text>
                  </View>
                  <Text style={styles.gmailStepText}>Copy the search query below</Text>
                </View>

                {/* Query box + copy button */}
                <View style={styles.gmailQueryRow}>
                  <Text style={styles.gmailQueryText} numberOfLines={2} ellipsizeMode="tail">
                    {gmailSearchQuery}
                  </Text>
                  <TouchableOpacity
                    style={[styles.gmailCopyBtn, queryCopied && styles.gmailCopyBtnDone]}
                    onPress={handleCopyGmailQuery}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={queryCopied ? 'checkmark' : 'copy-outline'}
                      size={15}
                      color={queryCopied ? '#0A0E1A' : palette.primary}
                    />
                    <Text style={[styles.gmailCopyBtnText, queryCopied && { color: '#0A0E1A' }]}>
                      {queryCopied ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Step 2 */}
                <View style={styles.gmailStep}>
                  <View style={styles.gmailStepBadge}>
                    <Text style={styles.gmailStepNum}>2</Text>
                  </View>
                  <Text style={styles.gmailStepText}>Open Gmail and paste in the search bar</Text>
                </View>

                {/* Open Gmail button */}
                <TouchableOpacity
                  style={styles.gmailLaunchBtn}
                  onPress={handleLaunchGmail}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mail-outline" size={17} color="#0A0E1A" />
                  <Text style={styles.gmailLaunchBtnText}>Open Gmail</Text>
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  toggling,
  onToggle,
  palette,
}: {
  task: AppTask;
  toggling: boolean;
  onToggle: () => void;
  palette: Palette;
}) {
  const isDone = task.status === 'done';
  const isOverdue = !isDone && task.due_at && new Date(task.due_at) < new Date();
  return (
    <TouchableOpacity
      style={taskRowStyles.row}
      onPress={onToggle}
      activeOpacity={0.75}
      disabled={toggling}
    >
      {toggling ? (
        <ActivityIndicator size="small" color={palette.primary} style={{ width: 22 }} />
      ) : (
        <Ionicons
          name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={isDone ? '#5AEFD5' : palette.muted}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[
          taskRowStyles.title,
          { color: isDone ? palette.muted : palette.text },
          isDone && { textDecorationLine: 'line-through' },
        ]}>
          {task.title}
        </Text>
        {task.due_at && !isDone && (
          <Text style={[taskRowStyles.due, { color: isOverdue ? '#FF7B7B' : palette.muted }]}>
            Due {new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const taskRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  title: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  due: { fontSize: 12, marginTop: 2 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (palette: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: palette.muted, fontSize: 13 },
  errorText: { color: '#FF7B7B', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  retryButton: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  retryButtonText: { color: palette.text, fontWeight: '600', fontSize: 13 },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  backText: { color: palette.text, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { padding: 16, gap: 20 },

  // Hero card
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 14,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  companyAvatar: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  companyInitial: { color: '#9CC6FF', fontSize: 22, fontWeight: '800' },
  companyName: { color: palette.text, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  roleName: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  gmailBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: 'rgba(234,67,53,0.12)', borderWidth: 1, borderColor: 'rgba(234,67,53,0.3)',
  },
  gmailBadgeText: { color: '#EA4335', fontSize: 11, fontWeight: '700' },
  hiddenBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  hiddenBadgeText: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  metaDate: { color: palette.muted, fontSize: 12, marginLeft: 'auto' },

  // Pipeline
  pipelineCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  pipelineDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  pipelineConnector: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1 },
  pipelineLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.25)' },

  // Rejection
  rejectionBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,123,123,0.1)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,123,123,0.25)',
  },
  rejectionText: { flex: 1, color: '#FF7B7B', fontSize: 13, lineHeight: 18 },

  // Sections
  section: { gap: 10 },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLink: { color: palette.primary, fontSize: 13, fontWeight: '700' },
  editIdentityBtn: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  identityInput: {
    color: palette.text, fontSize: 16, fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: `${palette.primary}60`,
  },
  needsReviewBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(244,169,66,0.1)', borderWidth: 1,
    borderColor: 'rgba(244,169,66,0.35)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4,
  },
  needsReviewText: { color: '#F4A942', fontSize: 13, fontWeight: '600', flex: 1 },

  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: { color: palette.muted, fontSize: 13, fontStyle: 'italic', paddingVertical: 2 },

  // Events
  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  eventCardPast: { opacity: 0.5 },
  eventIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { color: palette.text, fontSize: 14, fontWeight: '600' },
  eventDate: { color: palette.muted, fontSize: 12, marginTop: 2 },
  joinBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(74,140,255,0.15)', borderWidth: 1, borderColor: 'rgba(74,140,255,0.4)',
  },
  joinBtnText: { color: '#4A8CFF', fontSize: 12, fontWeight: '700' },

  // Tasks
  doneLabel: {
    color: palette.muted, fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 2,
  },
  addTaskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  addTaskInput: { flex: 1, color: palette.text, fontSize: 14, paddingVertical: 0 },
  addTaskBtn: { color: palette.primary, fontWeight: '700', fontSize: 14 },
  dueDateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dueDateChipText: { fontSize: 12, fontWeight: '600' },

  // Due-date picker modal
  dueDateOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  dueDateSheet: {
    backgroundColor: palette.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36,
  },
  dueDateSheetTitle: {
    color: palette.text, fontWeight: '700', fontSize: 16, marginBottom: 16,
  },
  dueDateOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dueDateOptionSelected: { opacity: 1 },
  dueDateOptionText: { color: palette.text, fontSize: 15, fontWeight: '500' },
  dueDateOptionSub: { color: palette.muted, fontSize: 13 },
  dueDateClear: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  dueDateClearText: { color: '#FF7B7B', fontWeight: '600', fontSize: 14 },

  // Timeline
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  timelineLine: {
    width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.07)',
    marginTop: 4, marginBottom: 0, borderRadius: 1,
  },
  timelineContent: { flex: 1, paddingBottom: 4 },
  timelineLabel: { color: palette.text, fontSize: 13, fontWeight: '600' },
  timelineDate: { color: palette.muted, fontSize: 12, marginTop: 2 },

  // Notes
  notesInput: { color: palette.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top', paddingTop: 0 },
  notesText: { color: palette.text, fontSize: 14, lineHeight: 22 },

  // Email snippet
  snippetToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  snippetToggleText: { flex: 1, color: palette.muted, fontSize: 14, fontWeight: '600' },
  snippetText: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  openEmailBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  openEmailBtnText: { color: palette.primary, fontSize: 13, fontWeight: '600' },

  // Merge link
  mergeLink: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 8 },
  mergeLinkText: { color: palette.muted, fontSize: 13, fontWeight: '600' },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: palette.background,
  },
  statusChipBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1,
  },
  statusChipBarText: { fontSize: 13, fontWeight: '700' },
  updateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#5AEFD5', paddingVertical: 12, borderRadius: 14,
  },
  updateBtnText: { color: '#0A0E1A', fontWeight: '800', fontSize: 15 },

  // Status modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: palette.card,
    borderRadius: 20, padding: 20, borderWidth: 1, borderColor: palette.overlayBorder,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: palette.overlay, borderWidth: 1, borderColor: palette.overlayBorder,
  },
  statusPillText: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  saveStatusBtn: {
    backgroundColor: '#5AEFD5', paddingVertical: 13,
    borderRadius: 14, alignItems: 'center', marginTop: 16,
  },
  saveStatusBtnText: { color: '#0A0E1A', fontWeight: '800', fontSize: 15 },

  // Merge modal
  mergeOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  mergeSheet: {
    backgroundColor: palette.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '85%', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  mergeLabel: {
    color: palette.muted, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.6, fontWeight: '600', marginBottom: -4,
  },
  mergeAppRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(90,239,213,0.07)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(90,239,213,0.2)',
  },
  mergeAppText: { color: palette.text, fontWeight: '600', flex: 1, fontSize: 14 },
  mergeSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  mergeSearchInput: { flex: 1, color: palette.text, fontSize: 14, paddingVertical: 0 },
  mergeList: { maxHeight: 260 },
  mergeCandidateRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  mergeCandidateSelected: { backgroundColor: 'rgba(90,239,213,0.07)', borderColor: 'rgba(90,239,213,0.3)' },
  mergeCandidateCompany: { color: palette.text, fontWeight: '700', fontSize: 14 },
  mergeCandidateRole: { color: palette.muted, fontSize: 12, marginTop: 2 },
  mergeCandidateBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(156,198,255,0.1)', borderWidth: 1, borderColor: 'rgba(156,198,255,0.2)',
    marginLeft: 8,
  },
  mergeCandidateBadgeText: { color: '#9CC6FF', fontSize: 11, fontWeight: '700' },
  mergeEmpty: { color: palette.muted, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  mergeConfirmBtn: { backgroundColor: '#5AEFD5', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  mergeConfirmText: { color: '#0A0E1A', fontWeight: '800', fontSize: 15 },

  // Gmail modal
  gmailOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  gmailSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40,
    gap: 16,
  },
  gmailStep: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  gmailStepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(90,239,213,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  gmailStepNum: { color: '#5AEFD5', fontWeight: '800', fontSize: 13 },
  gmailStepText: { color: palette.text, fontSize: 14, fontWeight: '500', flex: 1 },
  gmailQueryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  gmailQueryText: {
    flex: 1, color: palette.muted, fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  gmailCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(90,239,213,0.12)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(90,239,213,0.25)',
  },
  gmailCopyBtnDone: {
    backgroundColor: '#5AEFD5',
    borderColor: '#5AEFD5',
  },
  gmailCopyBtnText: { color: palette.primary, fontWeight: '700', fontSize: 12 },
  gmailLaunchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#5AEFD5',
    paddingVertical: 14, borderRadius: 14, marginTop: 4,
  },
  gmailLaunchBtnText: { color: '#0A0E1A', fontWeight: '800', fontSize: 15 },
});
