import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { useSolverStore } from '../state/useSolverStore.js';

const SystemAnalysisPanel = React.lazy(() => import('./SystemAnalysisPanel.jsx'));
const HistoryPanel = React.lazy(() => import('./HistoryPanel.jsx'));

function CollapsibleCard({ title, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="side-card">
      <button className="side-card-header" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className={`chevron ${open ? 'open' : ''}`}>›</span>
      </button>
      <motion.div
        className="side-card-body"
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      >
        <div className="side-card-inner">{children}</div>
      </motion.div>
    </section>
  );
}

export default function Sidebar() {
  const activeMethod = useSolverStore((s) => s.activeMethod);
  const getWorkflowProgress = useSolverStore((s) => s.getWorkflowProgress);
  const progress = getWorkflowProgress();
  const setShortcutsOpen = useSolverStore((s) => s.setShortcutsOpen);
  const setClearConfirmOpen = useSolverStore((s) => s.setClearConfirmOpen);
  const exportPdf = useSolverStore((s) => s.exportPdf);

  return (
    <aside className="sidebar">
      <CollapsibleCard title="Quick Actions">
        <button className="btn btn-ghost block" onClick={exportPdf}>Export PDF</button>
        <button className="btn btn-ghost block" onClick={() => setShortcutsOpen(true)}>Keyboard Shortcuts</button>
        <button className="btn btn-ghost block" onClick={() => setClearConfirmOpen(true)}>Reset Workspace</button>
      </CollapsibleCard>

      <CollapsibleCard title="Session Status">
        <div className="status-grid">
          <div><span>Method</span><strong>{activeMethod}</strong></div>
          <div><span>Workflow</span><strong>{progress}%</strong></div>
        </div>
        <div className="progress-track"><motion.div className="progress-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.15 }} /></div>
      </CollapsibleCard>

      <CollapsibleCard title="System Analysis">
        <Suspense fallback={<div className="history-empty">Loading panel…</div>}>
          <SystemAnalysisPanel />
        </Suspense>
      </CollapsibleCard>

      <CollapsibleCard title="History">
        <Suspense fallback={<div className="history-empty">Loading panel…</div>}>
          <HistoryPanel />
        </Suspense>
      </CollapsibleCard>
    </aside>
  );
}
