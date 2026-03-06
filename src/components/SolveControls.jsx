import React from 'react';
import { useSolverStore } from '../state/useSolverStore.js';

export default function SolveControls() {
  const matrixSize = useSolverStore((s) => s.matrixSize);
  const setMatrixSize = useSolverStore((s) => s.setMatrixSize);
  const solveGauss = useSolverStore((s) => s.solveGauss);
  const loadGaussSample = useSolverStore((s) => s.loadGaussSample);
  const clearGauss = useSolverStore((s) => s.clearGauss);
  const animateSolve = useSolverStore((s) => s.animateSolve);
  const toggleAnimateSolve = useSolverStore((s) => s.toggleAnimateSolve);
  const isSolving = useSolverStore((s) => s.isSolving);

  return (
    <section className="control-stack">
      <div className="field-row">
        <label className="field-label" htmlFor="matrix-size">System size</label>
        <input id="matrix-size" className="field-input size-input" type="number" min={2} max={8} value={matrixSize} onChange={(e) => setMatrixSize(e.target.value)} />
      </div>

      <div className="toggle-row">
        <label className="toggle-wrap">
          <input type="checkbox" checked={animateSolve} onChange={toggleAnimateSolve} />
          <span>Animated Solve</span>
        </label>
        <span className="toggle-hint">Instant mode disables row-step delays</span>
      </div>

      <div className="action-row">
        <button className="btn btn-ghost" onClick={loadGaussSample}>Load Sample</button>
        <button className="btn btn-ghost" onClick={clearGauss}>Clear</button>
        <button className={`btn btn-primary ${isSolving ? 'is-loading' : ''}`} onClick={solveGauss}>
          <span className="btn-label">Solve System</span>
          <span className="btn-spinner" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
