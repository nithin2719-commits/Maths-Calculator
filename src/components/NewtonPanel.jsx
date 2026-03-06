import React from 'react';
import { useSolverStore } from '../state/useSolverStore.js';
import OutputConsole from './OutputConsole.jsx';

export default function NewtonPanel() {
  const inputs = useSolverStore((s) => s.newtonInputs);
  const setNewtonField = useSolverStore((s) => s.setNewtonField);
  const solveNewton = useSolverStore((s) => s.solveNewton);
  const loadNewtonSample = useSolverStore((s) => s.loadNewtonSample);
  const clearNewton = useSolverStore((s) => s.clearNewton);
  const isSolving = useSolverStore((s) => s.isSolving);

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      solveNewton();
    }
  };

  return (
    <section className="method-panel">
      <h2 className="panel-title-static">Numerical and Statistics Method</h2>
      <p className="panel-sub">Enter equally spaced x-values and corresponding y-values, then evaluate at target x.</p>

      <div className="field-stack">
        <div className="field-col">
          <label className="field-label">x values (comma separated)</label>
          <input
            className="field-input full"
            value={inputs.x}
            onChange={(event) => setNewtonField('x', event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. 1891, 1901, 1911, 1921"
          />
        </div>
        <div className="field-col">
          <label className="field-label">y values (comma separated)</label>
          <input
            className="field-input full"
            value={inputs.y}
            onChange={(event) => setNewtonField('y', event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. 46, 66, 81, 93"
          />
        </div>
        <div className="field-col compact">
          <label className="field-label">Target x</label>
          <input
            className="field-input"
            value={inputs.target}
            onChange={(event) => setNewtonField('target', event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. 1925"
          />
        </div>
      </div>

      <div className="action-row">
        <button className="btn btn-ghost" onClick={loadNewtonSample}>Load Sample</button>
        <button className="btn btn-ghost" onClick={clearNewton}>Clear</button>
        <button className={`btn btn-primary ${isSolving ? 'is-loading' : ''}`} onClick={solveNewton}>
          <span className="btn-label">Interpolate</span>
          <span className="btn-spinner" aria-hidden="true" />
        </button>
      </div>

      <OutputConsole method="newton" />
    </section>
  );
}
