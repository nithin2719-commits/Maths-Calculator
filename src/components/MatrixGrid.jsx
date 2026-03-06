import React, { memo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSolverStore } from '../state/useSolverStore.js';

const MatrixCell = memo(function MatrixCell({ row, col, isB }) {
  const value = useSolverStore((s) => s.matrix[row][col]);
  const setCell = useSolverStore((s) => s.setCell);
  const setActiveCell = useSolverStore((s) => s.setActiveCell);
  const moveCellFocus = useSolverStore((s) => s.moveCellFocus);
  const matrixSize = useSolverStore((s) => s.matrixSize);
  const activeRow = useSolverStore((s) => s.activeRow);
  const pivotRow = useSolverStore((s) => s.pivotRow);
  const targetRow = useSolverStore((s) => s.targetRow);
  const isSolving = useSolverStore((s) => s.isSolving);

  const highlight = row === pivotRow ? 'pivot' : row === targetRow ? 'target' : row === activeRow ? 'active' : '';

  const onKeyDown = useCallback((event) => {
    const nav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'];
    if (nav.includes(event.key)) {
      event.preventDefault();
      const next = { row, col };
      if (event.key === 'ArrowUp') next.row -= 1;
      if (event.key === 'ArrowDown' || event.key === 'Enter') next.row += 1;
      if (event.key === 'ArrowLeft') next.col -= 1;
      if (event.key === 'ArrowRight') next.col += 1;
      if (event.key === 'Tab') {
        next.col += event.shiftKey ? -1 : 1;
        if (next.col > matrixSize) {
          next.col = 0;
          next.row += 1;
        }
        if (next.col < 0) {
          next.col = matrixSize;
          next.row -= 1;
        }
      }
      moveCellFocus(next.row, next.col);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[0-9]$/.test(event.key)) return;
    if (['Backspace', 'Delete', '.', '-', '+', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
  }, [row, col, matrixSize, moveCellFocus]);

  return (
    <motion.input
      className={`matrix-input ${isB ? 'matrix-input-b' : ''} ${highlight}`}
      data-row={row}
      data-col={col}
      value={value}
      onChange={(e) => setCell(row, col, e.target.value)}
      onFocus={(e) => {
        setActiveCell(row, col);
        requestAnimationFrame(() => e.target.select());
      }}
      onClick={(e) => e.target.select()}
      onKeyDown={onKeyDown}
      inputMode="decimal"
      autoComplete="off"
      disabled={isSolving}
      animate={highlight === 'pivot' ? { boxShadow: 'inset 0 0 0 1px rgba(96,165,250,.55)' } : highlight === 'target' ? { boxShadow: 'inset 0 0 0 1px rgba(37,99,235,.32)' } : { boxShadow: 'inset 0 0 0 0 rgba(0,0,0,0)' }}
      transition={{ duration: 0.15 }}
    />
  );
});

const MatrixGrid = memo(function MatrixGrid() {
  const matrixSize = useSolverStore((s) => s.matrixSize);
  const operationText = useSolverStore((s) => s.operationText);
  const activeCell = useSolverStore((s) => s.activeCell);

  useEffect(() => {
    const selector = `.matrix-input[data-row="${activeCell.row}"][data-col="${activeCell.col}"]`;
    const input = document.querySelector(selector);
    if (input && document.activeElement !== input) {
      input.focus();
      input.select();
    }
  }, [activeCell]);

  return (
    <section>
      <div className="matrix-operation">{operationText}</div>
      <div className="matrix-grid">
        <div className="matrix-header">
          {Array.from({ length: matrixSize }).map((_, i) => (
            <span key={`h-${i}`} className="matrix-header-cell">x{i + 1}</span>
          ))}
          <span className="matrix-header-cell matrix-header-b">b</span>
        </div>
        {Array.from({ length: matrixSize }).map((_, row) => (
          <div className="matrix-row" key={`r-${row}`}>
            {Array.from({ length: matrixSize + 1 }).map((__, col) => (
              <MatrixCell key={`c-${row}-${col}`} row={row} col={col} isB={col === matrixSize} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
});

export default MatrixGrid;
