import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSolverStore } from '../state/useSolverStore.js';
import MethodTabs from '../components/MethodTabs.jsx';
import MatrixGrid from '../components/MatrixGrid.jsx';
import SolveControls from '../components/SolveControls.jsx';
import OutputConsole from '../components/OutputConsole.jsx';
import NewtonPanel from '../components/NewtonPanel.jsx';
import TaylorPanel from '../components/TaylorPanel.jsx';

export default function PremiumWorkspace() {
  const [theme, setTheme] = useState('dark');
  const activeMethod = useSolverStore((s) => s.activeMethod);
  const exportPdf = useSolverStore((s) => s.exportPdf);

  React.useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <div className="min-h-screen relative">
      <div className="particles" />

      <header className="max-w-7xl mx-auto px-6 pt-8 pb-6 relative z-10">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-400 flex items-center justify-center text-white font-bold shadow-lg">PS</div>
            <div>
              <h1 className="text-2xl font-semibold">Premium Scientific Computing Workspace</h1>
              <p className="text-sm text-gray-300">Advanced Numerical Methods Suite</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn-toggle px-3 py-2 rounded-lg card-glass">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
            <button onClick={exportPdf} className="px-3 py-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow">Export PDF</button>
          </div>
        </div>

        <nav className="mt-6">
          <ul className="flex gap-4 items-end">
            <li className={`pb-2 ${activeMethod === 'gauss' ? 'border-b-2 border-blue-400' : 'opacity-70'}`}><button onClick={() => useSolverStore.getState().setActiveMethod('gauss')} className="px-3 py-2">Gauss-Jordan <span className="text-xs uppercase ml-2">Linear System</span></button></li>
            <li className={`pb-2 ${activeMethod === 'newton' ? 'border-b-2 border-blue-400' : 'opacity-70'}`}><button onClick={() => useSolverStore.getState().setActiveMethod('newton')} className="px-3 py-2">Newton Backward <span className="text-xs uppercase ml-2">Interpolation</span></button></li>
            <li className={`pb-2 ${activeMethod === 'taylor' ? 'border-b-2 border-blue-400' : 'opacity-70'}`}><button onClick={() => useSolverStore.getState().setActiveMethod('taylor')} className="px-3 py-2">Taylor Series <span className="text-xs uppercase ml-2">ODE Approx.</span></button></li>
          </ul>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-12 relative z-10 grid grid-cols-12 gap-6">
        <section className="col-span-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-glass p-6 card-2xl shadow-lg">
            {activeMethod === 'gauss' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Gauss-Jordan Elimination</h2>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded bg-gray-800 text-gray-200" onClick={() => useSolverStore.getState().clearGauss()}>Clear</button>
                    <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={() => useSolverStore.getState().solveGauss()}>Compute</button>
                  </div>
                </div>
                <SolveControls />
                <div className="mt-4">
                  <MatrixGrid />
                </div>
              </>
            )}

            {activeMethod === 'newton' && <NewtonPanel />}
            {activeMethod === 'taylor' && <TaylorPanel />}
          </motion.div>

          <div className="mt-6">
            <OutputConsole method={activeMethod} />
          </div>
        </section>

        <aside className="col-span-4">
          <div className="card-glass p-4 card-2xl shadow-lg">
            <h3 className="font-semibold">Session</h3>
            <p className="text-sm text-gray-300">Quick actions and status</p>
            <div className="mt-4 flex flex-col gap-2">
              <button className="px-3 py-2 rounded bg-gray-800 text-gray-200" onClick={() => useSolverStore.getState().loadGaussSample()}>Load Gauss Sample</button>
              <button className="px-3 py-2 rounded bg-gray-800 text-gray-200" onClick={() => useSolverStore.getState().loadNewtonSample()}>Load Newton Sample</button>
              <button className="px-3 py-2 rounded bg-gray-800 text-gray-200" onClick={() => useSolverStore.getState().loadTaylorSample()}>Load Taylor Sample</button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
