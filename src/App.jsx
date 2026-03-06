import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSolverStore } from './state/useSolverStore.js';
import MethodTabs from './components/MethodTabs.jsx';
import MatrixGrid from './components/MatrixGrid.jsx';
import SolveControls from './components/SolveControls.jsx';
import OutputConsole from './components/OutputConsole.jsx';
import Sidebar from './components/Sidebar.jsx';
import NewtonPanel from './components/NewtonPanel.jsx';
import TaylorPanel from './components/TaylorPanel.jsx';

function ShortcutsModal() {
  const open = useSolverStore((s) => s.shortcutsOpen);
  const setOpen = useSolverStore((s) => s.setShortcutsOpen);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={{ duration: 0.15 }}>
            <header className="modal-header">
              <h3>Keyboard Shortcuts</h3>
              <button className="btn btn-mini" onClick={() => setOpen(false)}>Close</button>
            </header>
            <table className="shortcut-table">
              <tbody>
                <tr><td>Alt + 1</td><td>Gauss-Jordan tab</td></tr>
                <tr><td>Alt + 2</td><td>Newton tab</td></tr>
                <tr><td>Alt + 3</td><td>Taylor tab</td></tr>
                <tr><td>Ctrl + Enter</td><td>Run active method</td></tr>
                <tr><td>?</td><td>Open shortcut modal</td></tr>
              </tbody>
            </table>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ClearConfirmModal() {
  const open = useSolverStore((s) => s.clearConfirmOpen);
  const setOpen = useSolverStore((s) => s.setClearConfirmOpen);
  const resetWorkspace = useSolverStore((s) => s.resetWorkspace);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={{ duration: 0.15 }}>
            <header className="modal-header"><h3>Clear workspace?</h3></header>
            <p className="modal-text">This will clear matrix, outputs, timeline, and history.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={resetWorkspace}>Clear</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const activeMethod = useSolverStore((s) => s.activeMethod);
  const toast = useSolverStore((s) => s.toast);

  const methodContent = useMemo(() => {
    if (activeMethod === 'gauss') {
      return (
        <>
          <SolveControls />
          <MatrixGrid />
          <OutputConsole method="gauss" />
        </>
      );
    }

    if (activeMethod === 'newton') {
      return <NewtonPanel />;
    }

    return <TaylorPanel />;
  }, [activeMethod]);

  React.useEffect(() => {
    function onKeyDown(event) {
      const setActiveMethod = useSolverStore.getState().setActiveMethod;
      const setShortcutsOpen = useSolverStore.getState().setShortcutsOpen;
      const active = useSolverStore.getState().activeMethod;
      if (event.altKey && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        setActiveMethod(event.key === '1' ? 'gauss' : event.key === '2' ? 'newton' : 'taylor');
      }
      if (event.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        if (active === 'gauss') useSolverStore.getState().solveGauss();
        if (active === 'newton') useSolverStore.getState().solveNewton();
        if (active === 'taylor') useSolverStore.getState().solveTaylor();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-toolbar">
        <div className="brand">
          <span className="logo">
            <svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#4f8ef7" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              <rect width="24" height="24" rx="5" fill="url(#lg)" />
              <text x="12" y="16" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="800" fontSize="10" fill="#fff">Σ</text>
            </svg>
          </span>
          <div>
            <h1>SNM Calculator</h1>
            <p>Statistical & Numerical Workspace</p>
          </div>
        </div>
      </header>

      <MethodTabs />

      <main className="workspace-grid">
        <section className="main-panel">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMethod}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {methodContent}
            </motion.div>
          </AnimatePresence>
        </section>
        <Sidebar />
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <ShortcutsModal />
      <ClearConfirmModal />
    </div>
  );
}
