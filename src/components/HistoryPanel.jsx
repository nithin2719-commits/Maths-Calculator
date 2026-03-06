import React from 'react';
import { useSolverStore } from '../state/useSolverStore.js';

export default function HistoryPanel() {
  const history = useSolverStore((s) => s.history);

  if (!history.length) {
    return <div className="history-empty">No calculations yet.</div>;
  }

  return (
    <ul className="history-list">
      {history.map((entry, idx) => (
        <li key={`${entry.time}-${idx}`} className="history-item">
          <div className="history-method">{entry.method}</div>
          <div className="history-result">{entry.result}</div>
          <div className="history-time">{entry.time}</div>
        </li>
      ))}
    </ul>
  );
}
