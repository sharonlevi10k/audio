import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERRED = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function pickMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return null;
  for (const t of PREFERRED) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // older Safari throws — skip
    }
  }
  return '';
}

function filenameFor(mimeType) {
  if (!mimeType) return 'recording.bin';
  if (mimeType.includes('mp4')) return 'recording.m4a';
  if (mimeType.includes('webm')) return 'recording.webm';
  if (mimeType.includes('ogg')) return 'recording.ogg';
  if (mimeType.includes('wav')) return 'recording.wav';
  return 'recording.bin';
}

export function useRecorder() {
  const [status, setStatus] = useState('idle'); // idle | recording | stopping | error
  const [error, setError] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [supported, setSupported] = useState(true);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef(null);
  const resolverRef = useRef(null);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      !!window.MediaRecorder &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia;
    setSupported(ok);
  }, []);

  const cleanup = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError('הדפדפן שלך לא תומך בהקלטה. נסה Safari 14.3+ או Chrome עדכני.');
      setStatus('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const rec = new MediaRecorder(stream, options);
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = (e) => {
        setError(e?.error?.message || 'שגיאה בהקלטה');
        setStatus('error');
        cleanup();
      };
      rec.onstop = () => {
        const actualType = rec.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualType });
        const filename = filenameFor(actualType);
        cleanup();
        setStatus('idle');
        setElapsedMs(0);
        if (resolverRef.current) {
          const r = resolverRef.current;
          resolverRef.current = null;
          r({ blob, filename, mimeType: actualType });
        }
      };

      rec.start(1000); // timeslice — important for iOS
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setStatus('recording');
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 100);
    } catch (err) {
      setError(err?.message || 'לא הצלחנו לקבל גישה למיקרופון');
      setStatus('error');
      cleanup();
    }
  }, [supported, cleanup]);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        resolve(null);
        return;
      }
      resolverRef.current = resolve;
      setStatus('stopping');
      try {
        rec.stop();
      } catch {
        cleanup();
        setStatus('idle');
        resolve(null);
      }
    });
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { status, error, elapsedMs, supported, start, stop };
}
