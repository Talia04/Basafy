import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Palette } from '../../theme/palette';
import type { Application } from './ApplicationsScreen';
import { supabase } from '@backend/supabase/client';

type TimelineEvent = {
  id: number;
  event_type: string;
  received_at: string;
  raw_subject: string | null;
  raw_snippet: string | null;
};

type Props = {
  application: Application;
  onBack?: () => void;
};

export default function ApplicationDetailScreen({ application, onBack }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [detail, setDetail] = useState<Application | null>(application);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplication();
  }, [application.id]);

  async function fetchApplication() {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from('applications')
      .select(
        'id, company, role, status, source_type, is_hidden, gmail_message_id, gmail_thread_id, email_snippet, created_at, updated_at, last_synced_at'
      )
      .eq('id', application.id)
      .maybeSingle();
    if (error) {
      setErrorMessage(error.message || 'Unable to load application details.');
    } else if (data) {
      setDetail(data);
    }
    await fetchTimeline();
    setLoading(false);
  }

  async function fetchTimeline() {
    setTimelineError(null);
    const { data, error } = await supabase
      .from('job_email_events')
      .select('id, event_type, received_at, raw_subject, raw_snippet')
      .eq('application_id', application.id)
      .order('received_at', { ascending: true })
      .limit(5);
    if (error) {
      setTimelineError(error.message || 'Unable to load email history.');
      setTimeline([]);
    } else if (data) {
      setTimeline(data);
    } else {
      setTimeline([]);
    }
  }

  const title = detail?.company || 'Application';
  const roleLabel = detail?.role || 'Role not set';
  const statusLabel = detail?.status || 'Status not set';
  const isGmail = detail?.source_type === 'gmail';
  const sourceLabel = detail?.source_type ? detail.source_type : 'manual';
  const lastUpdatedLabel = useMemo(() => {
    if (!detail?.updated_at) return 'Last updated: --';
    const parsed = new Date(detail.updated_at);
    return `Last updated: ${parsed.toLocaleDateString()}`;
  }, [detail?.updated_at]);
  const emailSnippet = detail?.email_snippet || null;
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
                    {new Date(event.received_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.timelineText}>
                    {timelineLabel(event.event_type)}
                  </Text>
                  {!!event.raw_snippet && <Text style={styles.timelineSnippet}>{event.raw_snippet}</Text>}
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes and attachments</Text>
          <View style={styles.card}>
            <Text style={styles.valueMuted}>Add a note or upload a resume or portfolio link.</Text>
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
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Update status</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Add event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Add a note</Text>
          </TouchableOpacity>
          {isGmail && (
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>Open in email</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      )}
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
  },
  primaryButtonText: {
    color: palette.text,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
});
