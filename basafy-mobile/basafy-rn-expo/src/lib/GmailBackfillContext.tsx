import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runBackfill } from './gmailIntegration';
import { queryClient } from './queryClient';
import { scheduleAllReminders } from './localReminders';
import { supabase } from '@backend/supabase/client';

export type BackfillLookback = '1' | '3' | '6' | '12' | 'all';

const PERSIST_KEY = 'basafy:backfill-persist';

type PersistedState = {
  lookback: BackfillLookback;
  pagesProcessed: number;
};

type BackfillCtx = {
  running: boolean;
  pagesProcessed: number;
  done: boolean;
  lookback: BackfillLookback;
  setLookback: (v: BackfillLookback) => void;
  start: (lookbackOverride?: BackfillLookback) => void;
  stop: () => void;
};

const Ctx = createContext<BackfillCtx>({
  running: false,
  pagesProcessed: 0,
  done: false,
  lookback: '3',
  setLookback: () => {},
  start: () => {},
  stop: () => {},
});

export function GmailBackfillProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [pagesProcessed, setPagesProcessed] = useState(0);
  const [done, setDone] = useState(false);
  const [lookback, setLookback] = useState<BackfillLookback>('3');
  const inFlightRef = useRef(false);
  const stopRef = useRef(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs so AppState handler sees latest values without stale closures.
  const lookbackRef = useRef<BackfillLookback>('3');
  const pagesProcessedRef = useRef(0);

  // Keep ref in sync with state.
  useEffect(() => { lookbackRef.current = lookback; }, [lookback]);
  useEffect(() => { pagesProcessedRef.current = pagesProcessed; }, [pagesProcessed]);

  // Auto-clear "done" state after 10s so the banner doesn't linger forever.
  useEffect(() => {
    if (done) {
      doneTimerRef.current = setTimeout(() => setDone(false), 10_000);
    }
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [done]);

  /** Core runner — separated so resume can pass an initial page token and page count. */
  const _run = useCallback((
    effective: BackfillLookback,
    opts?: {
      initialPageToken?: string | null;
      initialPagesProcessed?: number;
    },
  ) => {
    const initialPageToken = opts?.initialPageToken ?? null;
    const initialPagesProcessed = opts?.initialPagesProcessed ?? 0;

    inFlightRef.current = true;
    stopRef.current = false;
    lookbackRef.current = effective;
    setRunning(true);
    setPagesProcessed(initialPagesProcessed);
    setDone(false);

    runBackfill({
      lookbackMonths: effective,
      initialPageToken,
      shouldStop: () => stopRef.current,
      onPage: (pages, isDone) => {
        setPagesProcessed(initialPagesProcessed + pages);
        queryClient.invalidateQueries({ queryKey: ['applications'] });
        queryClient.invalidateQueries({ queryKey: ['pipeline'] });
        if (isDone) {
          setDone(true);
          scheduleAllReminders().catch(() => {});
        }
      },
    }).finally(() => {
      stopRef.current = false;
      inFlightRef.current = false;
      setRunning(false);
    });
  }, []);

  const start = useCallback(
    (lookbackOverride?: BackfillLookback) => {
      if (inFlightRef.current) return;
      _run(lookbackOverride ?? lookback);
    },
    [lookback, _run],
  );

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  // ── Background / foreground persistence ───────────────────────────────────
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Persist in-progress backfill so we can resume when app comes back.
        if (inFlightRef.current) {
          try {
            const payload: PersistedState = {
              lookback: lookbackRef.current,
              pagesProcessed: pagesProcessedRef.current,
            };
            await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
          } catch {}
        }
      } else if (nextState === 'active') {
        // If already running (app never fully suspended), nothing to do.
        if (inFlightRef.current) return;

        try {
          const raw = await AsyncStorage.getItem(PERSIST_KEY);
          if (!raw) return;
          const saved = JSON.parse(raw) as PersistedState;

          // Fetch the page token the edge function persisted after its last page.
          // If non-null the sync was interrupted mid-way; resume from there.
          // If null and backfill_completed_at is set, the sync finished server-side
          // while the app was backgrounded and should not be restarted.
          const session = (await supabase.auth.getSession()).data.session;
          if (!session) return;

          const { data } = await supabase
            .from('gmail_connections')
            .select('backfill_page_token, backfill_completed_at')
            .eq('user_id', session.user.id)
            .eq('provider', 'google')
            .maybeSingle();

          const resumeToken: string | null = (data as any)?.backfill_page_token ?? null;
          const completedAt: string | null = (data as any)?.backfill_completed_at ?? null;

          if (resumeToken) {
            await AsyncStorage.removeItem(PERSIST_KEY);
            _run(saved.lookback, {
              initialPageToken: resumeToken,
              initialPagesProcessed: saved.pagesProcessed ?? 0,
            });
            return;
          }

          if (completedAt) {
            await AsyncStorage.removeItem(PERSIST_KEY);
            setPagesProcessed(saved.pagesProcessed ?? 0);
            setDone(true);
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            queryClient.invalidateQueries({ queryKey: ['pipeline'] });
            scheduleAllReminders().catch(() => {});
          }
        } catch {}
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [_run]);

  return (
    <Ctx.Provider value={{ running, pagesProcessed, done, lookback, setLookback, start, stop }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGmailBackfill() {
  return useContext(Ctx);
}
