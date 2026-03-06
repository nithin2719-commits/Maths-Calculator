import React from 'react';
import { motion } from 'framer-motion';
import { useSolverStore } from '../state/useSolverStore.js';
import StepTimeline from './StepTimeline.jsx';

const TITLES = {
  gauss: 'OUTPUT — GAUSS-JORDAN ELIMINATION',
  newton: 'OUTPUT — NEWTON BACKWARD INTERPOLATION',
  taylor: 'OUTPUT — TAYLOR SERIES METHOD',
};

export default function OutputConsole({ method }) {
  const output = useSolverStore((s) => s.outputs[method]);
  const showSteps = useSolverStore((s) => s.showSteps[method]);
  const timeline = useSolverStore((s) => s.timelines.gauss);
  const toggleShowSteps = useSolverStore((s) => s.toggleShowSteps);
  const copyOutput = useSolverStore((s) => s.copyOutput);

  return (
    <section className="output-console">
      <header className="output-header">
        <span>{TITLES[method]}</span>
        <div className="output-actions">
          <button className="btn btn-mini" onClick={() => toggleShowSteps(method)}>{showSteps ? 'Hide Steps' : 'Show Steps'}</button>
          <button className="btn btn-mini" onClick={() => copyOutput(method)}>Copy</button>
        </div>
      </header>

      {method === 'gauss' && showSteps && <StepTimeline items={timeline} />}

      <motion.pre
        className={`output-body ${showSteps ? 'show' : ''}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {output || 'No output generated yet.'}
      </motion.pre>
    </section>
  );
}
