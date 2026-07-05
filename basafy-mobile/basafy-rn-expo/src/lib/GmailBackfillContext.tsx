import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  clearPendingImportReview,
  clearPersistedBackfillState,
  getPendingImportReview,
  getPersistedBackfillState,
  runBackfill,
  setPendingImportReview,
  setPersistedBackfillState,
} from './gmailIntegration';
import { queryClient } from './queryClient';
import { scheduleAllReminders } from './localReminders';
import { supabase } from '@backend/supabase/client';

export type BackfillLookback = '1' | '3' | '6' | '12' | 'all';

type BackfillCtx = {
  running: boolean;
  pagesProcessed: number;
  done: boolean;
  reviewReady: boolean;
  lookback: BackfillLookback;
  setLookback: (v: BackfillLookback) => void;
  start: (lookbackOverride?: BackfillLookback, options?: { reviewOnComplete?: boolean }) => void;
  stop: () => void;
  clearReviewPrompt: () => void;
};

const Ctx = createContext<BackfillCtx>({
  running: false,
  pagesProcessed: 0,
  done: false,
  reviewReady: false,
  lookback: '3',
  setLookback: () => {},
  start: () => {},
  stop: () => {},
  clearReviewPrompt: () => {},
});

export function GmailBackfillProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [pagesProcessed, setPagesProcessed] = useState(0);
  const [done, setDone] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);
  const [lookback, setLookback] = useState<BackfillLookback>('3');
  const inFlightRef = useRef(false);
  const stopRef = useRef(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewOnCompleteRef = useRef(true);
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

  const markReviewReady = useCallback(async () => {
    if (!reviewOnCompleteRef.current) return;
    const session = (await supabase.auth.getSession()).data.session;
    const userId = session?.user?.id;
    if (!userId) return;
    await setPendingImportReview(userId, {
      completedAt: new Date().toISOString(),
      source: 'manual_backfill',
    });
    setReviewReady(true);
  }, []);

  const clearReviewPrompt = useCallback(async () => {
    setReviewReady(false);
    const session = (await supabase.auth.getSession()).data.session;
    const userId = session?.user?.id;
    if (!userId) return;
    await clearPendingImportReview(userId);
  }, []);

  /** Core runner. The server owns the durable Gmail cursor and seen-ID checkpoint. */
  const _run = useCallback((
    effective: BackfillLookback,
    opts?: {
      initialPagesProcessed?: number;
      reviewOnComplete?: boolean;
    },
  ) => {
    const initialPagesProcessed = opts?.initialPagesProcessed ?? 0;
    reviewOnCompleteRef.current = opts?.reviewOnComplete ?? reviewOnCompleteRef.current;

    inFlightRef.current = true;
    stopRef.current = false;
    lookbackRef.current = effective;
    setRunning(true);
    setPagesProcessed(initialPagesProcessed);
    setDone(false);

    runBackfill({
      lookbackMonths: effective,
      shouldStop: () => stopRef.current,
      onPage: (pages, isDone) => {
        setPagesProcessed(initialPagesProcessed + pages);
        queryClient.invalidateQueries({ queryKey: ['applications'] });
        queryClient.invalidateQueries({ queryKey: ['pipeline'] });
        if (isDone) {
          void clearPersistedBackfillState();
          setDone(true);
          scheduleAllReminders().catch(() => {});
          void markReviewReady();
        }
      },
    }).finally(() => {
      stopRef.current = false;
      inFlightRef.current = false;
      setRunning(false);
    });
  }, [markReviewReady]);

  const start = useCallback(
    async (lookbackOverride?: BackfillLookback, options?: { reviewOnComplete?: boolean }) => {
      if (inFlightRef.current) return;
      const effectiveLookback = lookbackOverride ?? lookback;
      reviewOnCompleteRef.current = options?.reviewOnComplete ?? true;
      setReviewReady(false);
      await setPersistedBackfillState({
        lookback: effectiveLookback,
        pagesProcessed: 0,
      });
      _run(effectiveLookback, { reviewOnComplete: reviewOnCompleteRef.current });
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
            await setPersistedBackfillState({
              lookback: lookbackRef.current,
              pagesProcessed: pagesProcessedRef.current,
            });
          } catch {}
        }
      } else if (nextState === 'active') {
        // If already running (app never fully suspended), nothing to do.
        if (inFlightRef.current) return;

        try {
          const saved = await getPersistedBackfillState();
          if (!saved) return;

          const session = (await supabase.auth.getSession()).data.session;
          if (!session) return;
          _run(saved.lookback, {
            initialPagesProcessed: saved.pagesProcessed ?? 0,
            reviewOnComplete: reviewOnCompleteRef.current,
          });
        } catch {}
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [_run, markReviewReady]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId) return;
      const pending = await getPendingImportReview(userId);
      if (pending) setReviewReady(true);
    }).catch(() => {});
  }, []);

  return (
    <Ctx.Provider value={{ running, pagesProcessed, done, reviewReady, lookback, setLookback, start, stop, clearReviewPrompt }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGmailBackfill() {
  return useContext(Ctx);
}
