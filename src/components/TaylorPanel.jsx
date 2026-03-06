import React, { useState } from 'react';
import { useSolverStore } from '../state/useSolverStore.js';
import OutputConsole from './OutputConsole.jsx';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function TaylorPanel() {
  const inputs = useSolverStore((s) => s.taylorInputs);
  const setTaylorField = useSolverStore((s) => s.setTaylorField);
  const solveTaylor = useSolverStore((s) => s.solveTaylor);
  const loadTaylorSample = useSolverStore((s) => s.loadTaylorSample);
  const clearTaylor = useSolverStore((s) => s.clearTaylor);
  const isSolving = useSolverStore((s) => s.isSolving);

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      solveTaylor();
    }
  };

  const getTaylorDerivatives = useSolverStore((s) => s.getTaylorDerivatives);
  const [plotData, setPlotData] = useState(null);

  const handlePlot = async () => {
    const { equation, custom, x0, y0, h, order } = inputs;
    const isCustom = custom && custom.trim();
    const exprParam = isCustom ? 'CUSTOM:' + custom.trim() : equation;
    const x0Num = Number.parseFloat(x0);
    const y0Num = Number.parseFloat(y0);
    const hNum = Number.parseFloat(h);
    const orderNum = Math.max(0, Math.min(60, Number.parseInt(order, 10) || 3));
    if (!Number.isFinite(x0Num) || !Number.isFinite(y0Num) || !Number.isFinite(hNum)) {
      alert('Enter valid x0, y0 and h to plot.');
      return;
    }

    const derivs = await getTaylorDerivatives(exprParam, x0Num, y0Num, orderNum);

    // build polynomial P(x) = sum_{k=0..n} derivatives[k] * (x-x0)^k / k!
    const samples = 200;
    const range = Math.max(Math.abs(hNum) * 4, 1e-3);
    const xmin = x0Num - range;
    const xmax = x0Num + range;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const x = xmin + (i / samples) * (xmax - xmin);
      let px = 0;
      for (let k = 0; k <= orderNum; k++) {
        const dk = derivs[k] === undefined ? 0 : derivs[k];
        px += (Math.pow(x - x0Num, k) / factorial(k)) * dk;
      }
      pts.push({ x, y: px });
    }
    setPlotData(pts);
  };

  return (
    <section className="method-panel">
      <h2 className="panel-title-static">Numerical and Statistics Method</h2>
      <p className="panel-sub">Choose an equation model and compute y(x₀+h) up to order 4.</p>

      <div className="field-stack">
        <div className="field-col">
          <label className="field-label">Equation</label>
          <select
            className="field-input full"
            value={inputs.equation}
            onChange={(event) => setTaylorField('equation', event.target.value)}
            disabled={!!(inputs.custom && inputs.custom.trim())}
          >
            <option value="x_plus_y">y' = x + y</option>
            <option value="x2_plus_y">y' = x² + y</option>
            <option value="x_plus_y2">y' = x + y²</option>
            <option value="xy">y' = x · y</option>
          </select>
          {inputs.custom && inputs.custom.trim() ? <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Using custom expression — presets ignored</div> : null}
        </div>
        <div className="field-col">
          <label className="field-label">Custom (optional)</label>
          <input
            className="field-input full"
            placeholder="e.g. x + y or sin(x) + y"
            value={inputs.custom || ''}
            onChange={(event) => setTaylorField('custom', event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        <div className="field-grid-4">
          <div className="field-col">
            <label className="field-label">x₀</label>
            <input className="field-input" value={inputs.x0} onChange={(event) => setTaylorField('x0', event.target.value)} onKeyDown={onKeyDown} />
          </div>
          <div className="field-col">
            <label className="field-label">y₀</label>
            <input className="field-input" value={inputs.y0} onChange={(event) => setTaylorField('y0', event.target.value)} onKeyDown={onKeyDown} />
          </div>
          <div className="field-col">
            <label className="field-label">h</label>
            <input className="field-input" value={inputs.h} onChange={(event) => setTaylorField('h', event.target.value)} onKeyDown={onKeyDown} />
          </div>
          <div className="field-col">
            <label className="field-label">Order</label>
            <input className="field-input" value={inputs.order} onChange={(event) => setTaylorField('order', event.target.value)} onKeyDown={onKeyDown} />
          </div>
        </div>
      </div>

      <div className="action-row">
        <button className="btn btn-ghost" onClick={loadTaylorSample}>Load Sample</button>
        <button className="btn btn-ghost" onClick={clearTaylor}>Clear</button>
        <button className={`btn btn-outline ${isSolving ? 'is-loading' : ''}`} onClick={handlePlot}>
          Plot
        </button>
        <button className={`btn btn-primary ${isSolving ? 'is-loading' : ''}`} onClick={solveTaylor}>
          <span className="btn-label">Compute</span>
          <span className="btn-spinner" aria-hidden="true" />
        </button>
      </div>

      {plotData && (
        <div style={{ height: 300, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={plotData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tickFormatter={(v) => v.toFixed(2)} />
              <YAxis />
              <Tooltip formatter={(value) => Number(value).toPrecision(6)} />
              <Line type="monotone" dataKey="y" stroke="#1f77b4" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <OutputConsole method="taylor" />
    </section>
  );
}
