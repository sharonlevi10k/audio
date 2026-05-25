import { useEffect, useState } from 'react';
import { useRecorder } from './useRecorder.js';
import { transcribe } from './api.js';

const JWT_STORAGE_KEY = 'pfa_jwt';

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function App() {
  const { status, error: recError, elapsedMs, supported, start, stop } = useRecorder();
  const [jwt, setJwt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState(null); // { language, text }
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(JWT_STORAGE_KEY) || '';
    setJwt(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem(JWT_STORAGE_KEY, jwt);
  }, [jwt]);

  const isRecording = status === 'recording';
  const buttonDisabled = !supported || transcribing || status === 'stopping';

  const handleClick = async () => {
    setApiError(null);
    if (isRecording) {
      const recording = await stop();
      if (!recording) return;
      setTranscribing(true);
      try {
        const data = await transcribe(recording.blob, recording.filename, jwt);
        setResult(data);
      } catch (err) {
        setApiError(err.message || 'שגיאה לא ידועה בתמלול');
      } finally {
        setTranscribing(false);
      }
    } else {
      setResult(null);
      await start();
    }
  };

  let btnLabel = 'התחל הקלטה';
  let btnIcon = '●'; // ●
  let btnClass = 'rec-btn';
  if (transcribing) {
    btnClass += ' processing';
    btnLabel = 'מתמלל…';
    btnIcon = '';
  } else if (isRecording) {
    btnClass += ' recording';
    btnLabel = 'עצור';
    btnIcon = '■'; // ■
  }

  const errorMessage = apiError || recError;

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">PFA · TRANSCRIBE</span>
        <button className="settings-btn" onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? 'סגור' : 'JWT'}
        </button>
      </div>

      {showSettings && (
        <div className="settings">
          <label htmlFor="jwt">Bearer JWT</label>
          <textarea
            id="jwt"
            value={jwt}
            onChange={(e) => setJwt(e.target.value.trim())}
            placeholder="eyJhbGciOi..."
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <p className="note">
            הטוקן נשמר רק בדפדפן שלך (localStorage). לכל בקשה הוא נשלח בכותרת{' '}
            <code>Authorization: Bearer …</code>.
          </p>
        </div>
      )}

      <header>
        <span className="eyebrow">01 — תמלול חי</span>
        <h1 className="h1">
          <span className="accent">הקלטה</span> מיידית
        </h1>
        <p className="lede">
          לחץ על הכפתור, דבר, ועצור כשסיימת. ההקלטה נשלחת לשרת ומוחזרת אליך כתמלול בעברית
          בתוך שניות.
        </p>
      </header>

      <section className="recorder">
        <button
          className={btnClass}
          onClick={handleClick}
          disabled={buttonDisabled}
          aria-pressed={isRecording}
        >
          {transcribing ? (
            <div className="spinner" />
          ) : (
            <span className="rec-icon" aria-hidden>
              {btnIcon}
            </span>
          )}
          <span className="rec-label">{btnLabel}</span>
        </button>

        {isRecording ? (
          <div className="timer">{formatTime(elapsedMs)}</div>
        ) : transcribing ? (
          <div className="processing-row">
            <span>שולח לשרת</span>
          </div>
        ) : (
          <div className="timer muted">00:00</div>
        )}

        <span className="hint">
          {supported ? 'לחץ כדי להתחיל · לחץ שוב כדי לסיים' : 'הדפדפן לא תומך בהקלטה'}
        </span>
      </section>

      {errorMessage && (
        <div className="card error">
          <div className="card-head">
            <span className="card-title">שגיאה</span>
          </div>
          <p className="transcript">{errorMessage}</p>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">02 — תמלול</span>
            <span className="card-lang">{(result.language || '—').toUpperCase()}</span>
          </div>
          <p className={`transcript${result.text ? '' : ' empty'}`}>
            {result.text || '— ללא טקסט —'}
          </p>
        </div>
      )}
    </div>
  );
}
