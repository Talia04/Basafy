import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FloatingNav from '../../components/main/FloatingNav';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  onOpenApplication?: (application: {
    id: string;
    company: string | null;
    role: string | null;
    status: string | null;
    source_type?: string | null;
  }) => void;
};

type PipelineItem = {
  id: string;
  company: string;
  role: string;
  status: string;
  appliedLabel: string;
};

const pipelineColumns: Array<{
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
}> = [
  {
    key: 'applied',
    title: 'Applied',
    icon: 'mail-outline',
    tone: '#8AA4FF',
  },
  {
    key: 'assessment',
    title: 'Assessment',
    icon: 'clipboard-outline',
    tone: '#5AEFD5',
  },
  {
    key: 'interview',
    title: 'Interview',
    icon: 'chatbubbles-outline',
    tone: '#9CC6FF',
  },
  {
    key: 'offer',
    title: 'Offer',
    icon: 'ribbon-outline',
    tone: '#F7C873',
  },
  {
    key: 'rejected',
    title: 'Rejected',
    icon: 'close-circle-outline',
    tone: '#FF7B7B',
  },
];

export default function PipelineScreen({ activeTab = 'pipeline', onNavigate, onOpenApplication }: Props) {
  const insets = useSafeAreaInsets();
  const [columns, setColumns] = useState<Record<string, PipelineItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [createVisible, setCreateVisible] = useState(false);
  const [createStatus, setCreateStatus] = useState('applied');
  const [createCompany, setCreateCompany] = useState('');
  const [createRole, setCreateRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const allItems = Object.values(columns).flat();
    const inactive = new Set(['rejected', 'archived', 'offer_declined']);
    const total = allItems.length;
    const active = allItems.filter((item) => !inactive.has(item.status.toLowerCase())).length;
    return { total, active };
  }, [columns]);

  useEffect(() => {
    let mounted = true;
    const loadApps = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      if (mounted) setUserId(uid);

      const { data, error } = await supabase
        .from('applications')
        .select('id, company, role_title, role, status, applied_at, created_at, source_type')
        .order('applied_at', { ascending: false, nullsFirst: false });

      if (!mounted) return;
      if (error || !data) {
        setColumns({});
        setLoading(false);
        return;
      }

      const nextColumns: Record<string, PipelineItem[]> = {};
      pipelineColumns.forEach((col) => {
        nextColumns[col.key] = [];
      });

      data.forEach((app: any) => {
        const statusRaw = (app.status || 'applied').toString().toLowerCase();
        let statusKey = 'applied';
        if (statusRaw.includes('assess')) statusKey = 'assessment';
        else if (statusRaw.includes('interview')) statusKey = 'interview';
        else if (statusRaw.includes('offer')) statusKey = 'offer';
        else if (statusRaw.includes('reject')) statusKey = 'rejected';
        const appliedLabel = formatAppliedLabel(app.applied_at || app.created_at);
        nextColumns[statusKey] = [
          ...(nextColumns[statusKey] || []),
          {
            id: app.id,
            company: app.company || 'Unknown',
            role: app.role_title || app.role || 'Role pending',
            status: formatStatus(statusKey),
            appliedLabel,
          },
        ];
      });

      setColumns(nextColumns);
      setLoading(false);
    };
    loadApps();
    return () => {
      mounted = false;
    };
  }, []);

  const openCreateModal = (statusKey: string) => {
    setCreateStatus(statusKey);
    setCreateCompany('');
    setCreateRole('');
    setCreateVisible(true);
  };

  const handleCreate = async () => {
    const company = createCompany.trim();
    const roleTitle = createRole.trim();
    if (!company) {
      Alert.alert('Missing info', 'Company name is required.');
      return;
    }
    if (!userId) {
      Alert.alert('Not signed in', 'Please sign in to create an application.');
      return;
    }
    setSaving(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from('applications').insert([
      {
        user_id: userId,
        company,
        role_title: roleTitle || null,
        role: roleTitle || null,
        status: createStatus,
        applied_at: nowIso,
        source_type: 'manual',
      },
    ]);
    setSaving(false);
    if (error) {
      Alert.alert('Create failed', error.message || 'Unable to add application.');
      return;
    }
    setCreateVisible(false);
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('id, company, role_title, role, status, applied_at, created_at, source_type')
      .order('applied_at', { ascending: false, nullsFirst: false });
    const nextColumns: Record<string, PipelineItem[]> = {};
    pipelineColumns.forEach((col) => {
      nextColumns[col.key] = [];
    });
    (data || []).forEach((app: any) => {
      const statusRaw = (app.status || 'applied').toString().toLowerCase();
      let statusKey = 'applied';
      if (statusRaw.includes('assess')) statusKey = 'assessment';
      else if (statusRaw.includes('interview')) statusKey = 'interview';
      else if (statusRaw.includes('offer')) statusKey = 'offer';
      else if (statusRaw.includes('reject')) statusKey = 'rejected';
      const appliedLabel = formatAppliedLabel(app.applied_at || app.created_at);
      nextColumns[statusKey] = [
        ...(nextColumns[statusKey] || []),
        {
          id: app.id,
          company: app.company || 'Unknown',
          role: app.role_title || app.role || 'Role pending',
          status: formatStatus(statusKey),
          appliedLabel,
        },
      ];
    });
    setColumns(nextColumns);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Pipeline</Text>
          <Text style={styles.subtitle}>
            {totals.total} total • {totals.active} active
          </Text>
          <TouchableOpacity style={styles.newButton} activeOpacity={0.85} onPress={() => openCreateModal('applied')}>
            <Ionicons name="add" size={18} color={palette.text} />
            <Text style={styles.newButtonText}>New Application</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columnsRow}>
          {pipelineColumns.map((column) => {
            const items = columns[column.key] || [];
            return (
            <View key={column.key} style={styles.columnCard}>
              <View style={styles.columnHeader}>
                <View style={styles.columnTitleRow}>
                  <View style={[styles.columnIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons name={column.icon} size={16} color={column.tone} />
                  </View>
                  <Text style={styles.columnTitle}>{column.title}</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{items.length}</Text>
                </View>
              </View>

              <View style={styles.cardList}>
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.applicationCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      onOpenApplication?.({
                        id: item.id,
                        company: item.company,
                        role: item.role,
                        status: item.status,
                        source_type: 'manual',
                      })
                    }
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.company.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.companyText}>{item.company}</Text>
                      <Text style={styles.roleText}>{item.role}</Text>
                      <View style={styles.statusRow}>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{item.status}</Text>
                        </View>
                      </View>
                      <View style={styles.appliedRow}>
                        <Ionicons name="time-outline" size={12} color={palette.muted} />
                        <Text style={styles.appliedText}>{item.appliedLabel}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.addRow}
                activeOpacity={0.85}
                onPress={() => openCreateModal(column.key)}
              >
                <Ionicons name="add" size={16} color={palette.muted} />
                <Text style={styles.addRowText}>Add Application</Text>
              </TouchableOpacity>
            </View>
          )})}
        </ScrollView>
      </ScrollView>
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
      <Modal visible={createVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Application</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)} disabled={saving}>
                <Ionicons name="close" size={20} color={palette.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Company</Text>
              <TextInput
                value={createCompany}
                onChangeText={setCreateCompany}
                placeholder="Company name"
                placeholderTextColor="#6B7280"
                style={styles.input}
                editable={!saving}
              />
              <Text style={styles.inputLabel}>Role title</Text>
              <TextInput
                value={createRole}
                onChangeText={setCreateRole}
                placeholder="Role title"
                placeholderTextColor="#6B7280"
                style={styles.input}
                editable={!saving}
              />
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.statusRow}>
                {pipelineColumns.map((col) => (
                  <TouchableOpacity
                    key={col.key}
                    style={[styles.statusPill, createStatus === col.key && styles.statusPillActive]}
                    onPress={() => setCreateStatus(col.key)}
                  >
                    <Text style={styles.statusPillText}>{col.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setCreateVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleCreate}
                disabled={saving}
              >
                <Text style={styles.modalButtonTextPrimary}>{saving ? 'Saving…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const formatStatus = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatAppliedLabel = (iso?: string | null) => {
  if (!iso) return 'Applied recently';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Applied recently';
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  return `Applied ${diffDays} days ago`;
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },
  loadingText: {
    color: palette.muted,
    textAlign: 'center',
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
  },
  newButton: {
    marginTop: 6,
    backgroundColor: '#4A8CFF',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  newButtonText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 15,
  },
  columnsRow: {
    gap: 14,
    paddingRight: 18,
  },
  columnCard: {
    width: 260,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  columnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 16,
  },
  countBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 12,
  },
  cardList: {
    gap: 12,
  },
  applicationCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.text,
    fontWeight: '800',
  },
  companyText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 15,
  },
  roleText: {
    color: palette.muted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusPillActive: {
    backgroundColor: 'rgba(74,140,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(74,140,255,0.45)',
  },
  statusPillText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  appliedText: {
    color: palette.muted,
    fontSize: 12,
  },
  addRow: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  addRowText: {
    color: palette.muted,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: palette.background,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    gap: 10,
  },
  inputLabel: {
    color: palette.muted,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: palette.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#4A8CFF',
  },
  modalButtonSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalButtonTextPrimary: {
    color: palette.text,
    fontWeight: '800',
  },
  modalButtonTextSecondary: {
    color: palette.muted,
    fontWeight: '700',
  },
});
