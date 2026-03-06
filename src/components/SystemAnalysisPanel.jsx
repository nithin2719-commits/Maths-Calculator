import React from 'react';
import { useSolverStore } from '../state/useSolverStore.js';

const BADGES = ['Unique Solution', 'Infinite Solutions', 'No Solution'];

export default function SystemAnalysisPanel() {
  const analysis = useSolverStore((s) => s.analysis);

  return (
    <div className="analysis-panel">
      <div className="badge-row">
        {BADGES.map((badge) => (
          <span
            key={badge}
            className={`analysis-badge ${analysis.status === badge ? 'active' : ''} ${badge.includes('No') ? 'error' : badge.includes('Infinite') ? 'warn' : 'success'}`}
          >
            {badge}
          </span>
        ))}
      </div>

      <dl className="analysis-grid">
        <div><dt>Status</dt><dd>{analysis.valid ? analysis.status : 'Awaiting Input'}</dd></div>
        <div><dt>Determinant</dt><dd>{analysis.valid ? analysis.determinant : '—'}</dd></div>
        <div><dt>Singular</dt><dd>{analysis.valid ? (analysis.singular ? 'Yes' : 'No') : '—'}</dd></div>
        <div><dt>Rank(A)</dt><dd>{analysis.valid ? analysis.rankA : '—'}</dd></div>
        <div><dt>Rank([A|B])</dt><dd>{analysis.valid ? analysis.rankAug : '—'}</dd></div>
      </dl>
    </div>
  );
}
