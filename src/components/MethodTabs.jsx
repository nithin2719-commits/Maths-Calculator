import React from 'react';
import { useSolverStore } from '../state/useSolverStore.js';

const METHODS = [
  { key: 'gauss', title: 'Gauss-Jordan', type: 'Linear System' },
  { key: 'newton', title: 'Newton Backward', type: 'Interpolation' },
  { key: 'taylor', title: 'Taylor Series', type: 'ODE Approx.' },
];

export default function MethodTabs() {
  const activeMethod = useSolverStore((s) => s.activeMethod);
  const setActiveMethod = useSolverStore((s) => s.setActiveMethod);

  return (
    <nav className="method-nav" role="tablist" aria-label="Method selector">
      {METHODS.map((method) => (
        <button
          key={method.key}
          className={`method-tab ${activeMethod === method.key ? 'is-active' : ''}`}
          onClick={() => setActiveMethod(method.key)}
          role="tab"
          aria-selected={activeMethod === method.key}
        >
          <span className="method-tab-name">{method.title}</span>
          <span className="method-tab-type">{method.type}</span>
        </button>
      ))}
    </nav>
  );
}
