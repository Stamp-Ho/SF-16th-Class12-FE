'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Phase } from './rules';

type Notes = Record<string, string>;
type Stage = 'lobby' | 'started';

const NOTE_PREFIX = 'avalon:note:';
const LEGACY_NOTE_PREFIX = 'avalon:notes:';
const PHASE_PREFIX = 'avalon:room-phase:';
const WRITE_INTERVAL_MS = 500;

function readAllNotes(): Notes {
  const result: Notes = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(NOTE_PREFIX)) result[key.slice(NOTE_PREFIX.length)] = localStorage.getItem(key) ?? '';
    }
  } catch { /* Storage may be unavailable. */ }
  return result;
}

function clearAllNotes() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(NOTE_PREFIX) || key?.startsWith(LEGACY_NOTE_PREFIX)) localStorage.removeItem(key);
    }
  } catch { /* Storage may be unavailable. */ }
}

export function useLocalNotes(roomId: string, phase?: Phase) {
  const [notes, setNotes] = useState<Notes>({});
  const [readyMarker, setReadyMarker] = useState<string | null>(null);
  const notesRef = useRef<Notes>({});
  const dirtyRef = useRef<Set<string>>(new Set());
  const lastWriteRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage: Stage | null = phase ? phase === 'lobby' ? 'lobby' : 'started' : null;
  const marker = roomId && stage ? `${roomId}:${stage}` : null;

  const flush = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    try {
      for (const name of dirtyRef.current) {
        const value = notesRef.current[name] ?? '';
        if (value) localStorage.setItem(`${NOTE_PREFIX}${name}`, value);
        else localStorage.removeItem(`${NOTE_PREFIX}${name}`);
      }
      dirtyRef.current.clear();
    } catch { /* Keep the current in-memory notes if storage fails. */ }
    lastWriteRef.current = Date.now();
  }, []);

  useEffect(() => {
    let active = true;
    const show = (next: Notes) => queueMicrotask(() => {
      if (active) { setNotes(next); setReadyMarker(marker); }
    });
    if (!roomId || !stage) {
      flush();
      show({});
      return () => { active = false; };
    }

    const phaseKey = `${PHASE_PREFIX}${roomId}`;
    let previous: string | null = null;
    try { previous = localStorage.getItem(phaseKey); } catch { /* Storage may be unavailable. */ }
    if (stage === 'started' && previous !== 'started') {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      dirtyRef.current.clear();
      clearAllNotes();
      notesRef.current = {};
      show({});
    } else {
      flush();
      const stored = readAllNotes();
      notesRef.current = stored;
      show(stored);
    }
    try { localStorage.setItem(phaseKey, stage); } catch { /* Storage may be unavailable. */ }
    lastWriteRef.current = Date.now();
    return () => { active = false; };
  }, [roomId, stage, marker, flush]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [flush]);

  function updateNote(name: string, value: string) {
    const next = { ...notesRef.current, [name]: value };
    notesRef.current = next;
    setNotes(next);
    dirtyRef.current.add(name);
    const remaining = WRITE_INTERVAL_MS - (Date.now() - lastWriteRef.current);
    if (remaining <= 0 && !timerRef.current) flush();
    else if (!timerRef.current) timerRef.current = setTimeout(flush, Math.max(0, remaining));
  }

  return { notes, updateNote, ready: marker !== null && readyMarker === marker };
}
