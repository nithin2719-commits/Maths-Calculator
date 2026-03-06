import { create } from 'zustand';
import {
  emptyMatrix,
  parseMatrixStringMatrix,
  classifySystem,
  getGaussJordanOperations,
  buildGaussSummary,
  formatMatrix,
  formatNum,
} from '../lib/linearAlgebra.js';

const METHODS = ['gauss', 'newton', 'taylor'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseNumberListStrict(raw) {
  const items = String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.length) return null;
  const values = items.map((item) => Number(item));
  return values.every((value) => Number.isFinite(value)) ? values : null;
}

function factorial(n) {
  if (n <= 1) return 1;
  let product = 1;
  for (let index = 2; index <= n; index++) product *= index;
  return product;
}

function formatDeltaLabel(order) {
  if (order === 1) return 'delta y_n';
  if (order === 2) return 'delta square y_n';
  if (order === 3) return 'delta cube y_n';
  if (order === 4) return 'delta fourth y_n';
  return `delta order ${order} y_n`;
}

async function evalTaylorDerivatives(equationExpr, x0, y0, order) {
  // If equationExpr is prefixed with 'CUSTOM:' we must treat it strictly as a custom expression
  const isCustom = typeof equationExpr === 'string' && equationExpr.startsWith('CUSTOM:');
  const expr = isCustom ? equationExpr.slice(7) : equationExpr;
  // returns an array derivatives[0..order] where derivatives[0] = y0, derivatives[1] = f(x0,y0), etc.
  const maxOrder = Math.max(0, Math.min(200, order));

  // quick presets (fast path) only when NOT a forced custom
  if (!isCustom && ['x_plus_y', 'x2_plus_y', 'x_plus_y2', 'xy'].includes(expr)) {
    const vals = (() => {
      switch (expr) {
        case 'x_plus_y': {
          const yp1 = x0 + y0;
          const yp2 = 1 + yp1;
          const yp3 = 1 + yp2;
          const yp4 = 1 + yp3;
          return [y0, yp1, yp2, yp3, yp4].slice(0, maxOrder + 1);
        }
        case 'x2_plus_y': {
          const yp1 = x0 * x0 + y0;
          const yp2 = 2 * x0 + yp1;
          const yp3 = 2 + yp2;
          const yp4 = yp3;
          return [y0, yp1, yp2, yp3, yp4].slice(0, maxOrder + 1);
        }
        case 'x_plus_y2': {
          const yp1 = x0 + y0 * y0;
          const yp2 = 1 + 2 * y0 * yp1;
          const yp3 = 2 * yp1 * yp1 + 2 * y0 * yp2;
          const yp4 = 6 * yp1 * yp2 + 2 * y0 * yp3;
          return [y0, yp1, yp2, yp3, yp4].slice(0, maxOrder + 1);
        }
        case 'xy': {
          const yp1 = x0 * y0;
          const yp2 = y0 + x0 * yp1;
          const yp3 = 2 * yp1 + x0 * yp2;
          const yp4 = 3 * yp2 + x0 * yp3;
          return [y0, yp1, yp2, yp3, yp4].slice(0, maxOrder + 1);
        }
        default:
          return [y0];
      }
    })();
    if (vals.length > maxOrder || vals.length === maxOrder + 1) return vals;
  }

  // symbolic path using mathjs. Falls back to numeric approximations if mathjs not available.
  try {
    const math = await import('mathjs');
    const fExpr = String(expr || '0');

    const derivatives = [];
    derivatives[0] = y0;

    let prevExpr = 'y';

    for (let k = 1; k <= maxOrder; k++) {
      const dxNode = math.derivative(prevExpr, 'x');
      const dyNode = math.derivative(prevExpr, 'y');

      const totalStr = `(${dxNode.toString()}) + (${dyNode.toString()})*(${fExpr})`;

      const value = Number(math.evaluate(totalStr, { x: x0, y: y0 }));
      derivatives[k] = Number.isFinite(value) ? value : 0;

      prevExpr = totalStr;
    }

    return derivatives;
  } catch (err) {
    console.warn('mathjs unavailable or symbolic differentiation failed — falling back to numeric approx', err);

    try {
      const fn = new Function('x', 'y', 'with (Math) { return ' + expr + ' }');
      const derivatives = [y0];
      const dt = Math.max(1e-6, Math.abs(x0) * 1e-6);
      const f0 = Number(fn(x0, y0));
      derivatives[1] = f0;
      for (let k = 2; k <= maxOrder; k++) {
        const shift = dt * k;
        const yPlus = y0 + f0 * shift;
        const valPlus = Number(fn(x0 + shift, yPlus));
        const yMinus = y0 - f0 * shift;
        const valMinus = Number(fn(x0 - shift, yMinus));
        const deriv = (valPlus - valMinus) / (2 * shift);
        derivatives[k] = Number.isFinite(deriv) ? deriv : 0;
      }
      return derivatives;
    } catch (err2) {
      console.warn('Numeric fallback failed for Taylor derivatives', err2);
      return Array.from({ length: maxOrder + 1 }, (_, i) => (i === 0 ? y0 : 0));
    }
  }
}

function validNumberInput(raw) {
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)?$/.test(raw);
}

function interpolateRows(before, after, durationMs, tick = 4) {
  const start = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
      const blended = after.map((row, i) =>
        row.map((value, j) => {
          const from = before[i][j];
          if (!Number.isFinite(from) || !Number.isFinite(value)) return value;
          return from + (value - from) * eased;
        })
      );
      tick(blended, p);
      if (p < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

export const useSolverStore = create((set, get) => ({
  activeMethod: 'gauss',
  matrixSize: 3,
  matrix: emptyMatrix(3),
  activeCell: { row: 0, col: 0 },
  activeRow: null,
  pivotRow: null,
  targetRow: null,
  operationText: 'Awaiting operation',
  isSolving: false,
  animateSolve: true,
  showSteps: { gauss: true, newton: false, taylor: false },
  outputs: { gauss: '', newton: '', taylor: '' },
  newtonInputs: { x: '', y: '', target: '' },
  taylorInputs: { equation: 'x_plus_y', custom: '', x0: '0', y0: '1', h: '0.1', order: '3' },
  timelines: { gauss: [], newton: [], taylor: [] },
  analysis: {
    determinant: null,
    singular: null,
    rankA: null,
    rankAug: null,
    status: 'Awaiting Input',
    valid: false,
  },
  history: [],
  shortcutsOpen: false,
  clearConfirmOpen: false,
  toast: '',

  setToast: (message) => {
    set({ toast: message });
    setTimeout(() => {
      if (get().toast === message) set({ toast: '' });
    }, 1800);
  },

  setActiveMethod: (method) => set({ activeMethod: method }),
  getOutputByMethod: (method) => get().outputs[method] || '',
  setNewtonField: (field, value) => set((state) => ({ newtonInputs: { ...state.newtonInputs, [field]: value } })),
  setTaylorField: (field, value) => set((state) => ({ taylorInputs: { ...state.taylorInputs, [field]: value } })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setClearConfirmOpen: (open) => set({ clearConfirmOpen: open }),
  toggleAnimateSolve: () => set((state) => ({ animateSolve: !state.animateSolve })),
  toggleShowSteps: (method) => set((state) => ({ showSteps: { ...state.showSteps, [method]: !state.showSteps[method] } })),

  setMatrixSize: (size) => {
    const next = Math.max(2, Math.min(8, Number.parseInt(size, 10) || 3));
    set({ matrixSize: next, matrix: emptyMatrix(next), timelines: { gauss: [], newton: [], taylor: [] }, outputs: { ...get().outputs, gauss: '' } });
    get().analyzeMatrix();
  },

  setCell: (row, col, value) => {
    if (!validNumberInput(value)) return;
    set((state) => {
      const matrix = state.matrix.map((r, rIdx) =>
        rIdx === row ? r.map((c, cIdx) => (cIdx === col ? value : c)) : r
      );
      return { matrix };
    });
    get().analyzeMatrix();
  },

  setActiveCell: (row, col) => set({ activeCell: { row, col }, activeRow: row }),

  moveCellFocus: (row, col) => {
    const size = get().matrixSize;
    const nextRow = Math.max(0, Math.min(size - 1, row));
    const nextCol = Math.max(0, Math.min(size, col));
    set({ activeCell: { row: nextRow, col: nextCol }, activeRow: nextRow });
  },

  loadGaussSample: () => {
    const sample = [
      ['2', '1', '-1', '8'],
      ['-3', '-1', '2', '-11'],
      ['-2', '1', '2', '-3'],
    ];
    set({ matrixSize: 3, matrix: sample, activeMethod: 'gauss' });
    get().analyzeMatrix();
  },

  clearGauss: () => {
    const size = get().matrixSize;
    set((state) => ({
      matrix: emptyMatrix(size),
      operationText: 'Awaiting operation',
      pivotRow: null,
      targetRow: null,
      outputs: { ...state.outputs, gauss: '' },
      timelines: { ...state.timelines, gauss: [] },
    }));
    get().analyzeMatrix();
  },

  analyzeMatrix: () => {
    const matrixNum = parseMatrixStringMatrix(get().matrix);
    const valid = matrixNum.every((row) => row.every((v) => Number.isFinite(v)));

    if (!valid) {
      set({
        analysis: {
          determinant: null,
          singular: null,
          rankA: null,
          rankAug: null,
          status: 'Awaiting Input',
          valid: false,
        },
      });
      return;
    }

    const analysis = classifySystem(matrixNum);
    set({
      analysis: {
        ...analysis,
        determinant: formatNum(analysis.determinant, 6),
        valid: true,
      },
    });
  },

  solveGauss: async () => {
    if (get().isSolving) return;

    const matrixNum = parseMatrixStringMatrix(get().matrix);
    const valid = matrixNum.every((row) => row.every((v) => Number.isFinite(v)));
    if (!valid) {
      get().setToast('Please enter valid numeric matrix values.');
      return;
    }

    set({
      isSolving: true,
      operationText: 'Preparing elimination steps…',
      timelines: { ...get().timelines, gauss: [] },
      pivotRow: null,
      targetRow: null,
    });

    const res = getGaussJordanOperations(matrixNum);
    if (!res.ok) {
      set((state) => ({
        isSolving: false,
        operationText: 'Singular or inconsistent system detected.',
        outputs: { ...state.outputs, gauss: 'No unique solution. Matrix is singular or inconsistent.' },
        timelines: {
          gauss: [{ phase: 'Step 1 — Pivot normalization', title: 'Pivot not found', matrix: formatMatrix(res.finalMatrix), open: true }],
        },
      }));
      return;
    }

    const timelineEntries = [];

    for (const op of res.operations) {
      set({ operationText: op.op, pivotRow: op.pivotRow, targetRow: op.targetRow });

      if (get().animateSolve) {
        await interpolateRows(op.before, op.after, 180, (blended) => {
          set({ matrix: blended.map((row) => row.map((v) => formatNum(v, 6))) });
        });
        await sleep(500);
      } else {
        set({ matrix: op.after.map((row) => row.map((v) => formatNum(v, 6))) });
      }

      timelineEntries.push({
        phase: op.phase,
        title: op.op,
        matrix: formatMatrix(op.after),
        open: false,
      });
      set({ timelines: { gauss: [...timelineEntries] } });
    }

    const summary = buildGaussSummary(matrixNum, res.finalMatrix);
    timelineEntries.push({
      phase: 'Step 3 — Back substitution',
      title: 'Read solution from RREF',
      matrix: `${formatMatrix(res.finalMatrix)}\n\n${summary.solution.map((v, i) => `x${i + 1} = ${formatNum(v, 6)}`).join('\n')}`,
      open: true,
    });

    set((state) => ({
      isSolving: false,
      pivotRow: null,
      targetRow: null,
      operationText: 'Solve complete.',
      outputs: { ...state.outputs, gauss: summary.text },
      timelines: { gauss: timelineEntries },
      history: [
        {
          method: 'Gauss-Jordan',
          result: summary.solution.map((v, i) => `x${i + 1}=${formatNum(v, 3)}`).join(', '),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...state.history,
      ].slice(0, 12),
    }));

    get().analyzeMatrix();
  },

  solveNewton: async () => {
    if (get().isSolving) return;

    set({ isSolving: true, operationText: 'Computing Newton backward...', timelines: { ...get().timelines, newton: [] } });

    const { x, y, target } = get().newtonInputs;
    const xValues = parseNumberListStrict(x);
    const yValues = parseNumberListStrict(y);
    const xTarget = Number.parseFloat(target);

    if (!xValues || !yValues || !Number.isFinite(xTarget)) {
      get().setToast('Enter valid x values, y values, and target x.');
      set({ isSolving: false });
      return;
    }
    if (xValues.length !== yValues.length || xValues.length < 2) {
      get().setToast('x and y lists must have equal length (min 2 points).');
      set({ isSolving: false });
      return;
    }

    const n = xValues.length;
    const h = xValues[1] - xValues[0];
    for (let i = 1; i < n - 1; i++) {
      if (Math.abs((xValues[i + 1] - xValues[i]) - h) > 1e-8) {
        get().setToast('Newton backward requires equally spaced x values.');
        set({ isSolving: false });
        return;
      }
    }

    await sleep(160);

    const diff = [yValues.slice()];
    for (let order = 1; order < n; order++) {
      const prev = diff[order - 1];
      const row = [];
      for (let i = 1; i < prev.length; i++) row.push(prev[i] - prev[i - 1]);
      diff.push(row);
    }

    const xn = xValues[n - 1];
    const s = (xTarget - xn) / h;
    let result = yValues[n - 1];
    let sFactor = 1;

    const lines = [];
    const timelineEntries = [];
    lines.push('Newton Backward Interpolation');
    lines.push('='.repeat(46));
    lines.push(`h = ${formatNum(h, 6)},  s = ${formatNum(s, 6)}`);
    lines.push(`Term 0: ${formatNum(result, 6)}`);

    timelineEntries.push({ phase: 'Init', title: 'Difference table constructed', matrix: diff.map((r) => r.join(', ')).join('\n'), open: true });
    timelineEntries.push({ phase: 'Overview', title: `h = ${formatNum(h, 6)}, s = ${formatNum(s, 6)}`, matrix: `xn = ${xn}`, open: false });

    timelineEntries.push({ phase: 'Term 0', title: `Initial value`, matrix: `Term 0: ${formatNum(result, 6)}`, open: false });

    for (let k = 1; k < n; k++) {
      const backwardIndex = diff[k].length - 1;
      if (backwardIndex < 0) break;
      const delta = diff[k][backwardIndex];
      sFactor *= (s + (k - 1));
      const coeff = sFactor / factorial(k);
      const term = coeff * delta;
      result += term;
      const line = `Term ${k}: (${formatNum(coeff, 6)}) * ${formatDeltaLabel(k)} = ${formatNum(term, 6)}`;
      lines.push(line);
      timelineEntries.push({ phase: `Term ${k}`, title: `Computed term ${k}`, matrix: line, open: false });
    }

    lines.push('='.repeat(46));
    lines.push(`f(${formatNum(xTarget, 6)}) ≈ ${formatNum(result, 8)}`);

    timelineEntries.push({ phase: 'Result', title: 'Final interpolation result', matrix: `f(${formatNum(xTarget, 6)}) ≈ ${formatNum(result, 8)}`, open: true });

    set((state) => ({
      outputs: { ...state.outputs, newton: lines.join('\n') },
      timelines: { ...state.timelines, newton: timelineEntries },
      history: [
        {
          method: 'Newton Backward',
          result: `f(${formatNum(xTarget, 3)})=${formatNum(result, 4)}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...state.history,
      ].slice(0, 12),
    }));

    set({ isSolving: false, operationText: 'Newton complete.' });
  },

  solveTaylor: async () => {
    if (get().isSolving) return;

    set({ isSolving: true, operationText: 'Computing Taylor series...', timelines: { ...get().timelines, taylor: [] } });

    const { equation, custom, x0, y0, h, order } = get().taylorInputs;
    const equationStr = custom && custom.trim() ? custom.trim() : equation;
    const x0Num = Number.parseFloat(x0);
    const y0Num = Number.parseFloat(y0);
    const hNum = Number.parseFloat(h);
    const requested = Number.parseInt(order, 10) || 3;
    const orderNum = Math.max(0, Math.min(60, requested));

    if (requested > 15) {
      get().setToast('Warning: high order requested — computation may be slow.');
    }

    if (![x0Num, y0Num, hNum].every(Number.isFinite) || Math.abs(hNum) < 1e-12) {
      get().setToast('Enter valid x₀, y₀, and non-zero h.');
      set({ isSolving: false });
      return;
    }


    await sleep(160);

    const lines = [];
    const timelineEntries = [];
    lines.push('Taylor Series Method');
    lines.push('='.repeat(46));
    lines.push(`x₀ = ${formatNum(x0Num, 6)}, y₀ = ${formatNum(y0Num, 6)}, h = ${formatNum(hNum, 6)}, order = ${orderNum}`);

    timelineEntries.push({ phase: 'Init', title: 'Taylor inputs', matrix: `x0=${x0Num}, y0=${y0Num}, h=${hNum}`, open: true });

    // compute derivatives symbolically (or fallback)
    const isCustom = custom && custom.trim();
    const param = isCustom ? 'CUSTOM:' + custom.trim() : equation;
    const derivs = await evalTaylorDerivatives(param, x0Num, y0Num, orderNum);

    // compute Taylor sum: y_next = sum_{k=0..order} (h^k / k!) * derivatives[k]
    let yNext = 0;
    for (let k = 0; k <= orderNum; k++) {
      const coeff = Math.pow(hNum, k) / factorial(k);
      const dk = derivs[k] === undefined ? 0 : derivs[k];
      const term = coeff * dk;
      yNext += term;
      const line = `Term ${k}: (h^${k}/${k}!) * ${formatNum(dk, 8)} = ${formatNum(term, 8)}`;
      lines.push(line);
      timelineEntries.push({ phase: `Term ${k}`, title: `Computed term ${k}`, matrix: line, open: false });
    }

    const xNext = x0Num + hNum;
    lines.push('='.repeat(46));
    lines.push(`y(${formatNum(xNext, 6)}) ≈ ${formatNum(yNext, 8)}`);

    timelineEntries.push({ phase: 'Result', title: 'Taylor approximation', matrix: `y(${formatNum(xNext, 6)}) ≈ ${formatNum(yNext, 8)}`, open: true });

    set((state) => ({
      outputs: { ...state.outputs, taylor: lines.join('\n') },
      timelines: { ...state.timelines, taylor: timelineEntries },
      history: [
        {
          method: 'Taylor Series',
          result: `y(${formatNum(xNext, 3)})=${formatNum(yNext, 4)}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...state.history,
      ].slice(0, 12),
    }));

    set({ isSolving: false, operationText: 'Taylor complete.' });
  },

  loadNewtonSample: () => set({ newtonInputs: { x: '1891,1901,1911,1921,1931', y: '46,66,81,93,101', target: '1925' } }),
  clearNewton: () => set((state) => ({ newtonInputs: { x: '', y: '', target: '' }, outputs: { ...state.outputs, newton: '' } })),
  loadTaylorSample: () => set({ taylorInputs: { equation: 'x_plus_y', custom: '', x0: '0', y0: '1', h: '0.1', order: '4' } }),
  clearTaylor: () => set((state) => ({
    taylorInputs: { equation: 'x_plus_y', custom: '', x0: '0', y0: '1', h: '0.1', order: '3' },
    outputs: { ...state.outputs, taylor: '' },
  })),

  copyOutput: async (method) => {
    const text = get().outputs[method] || '';
    if (!text.trim()) {
      get().setToast('No result to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      get().setToast('Copied output to clipboard.');
    } catch {
      get().setToast('Copy failed.');
    }
  },

  exportPdf: async () => {
    get().setToast('Preparing PDF...');

    try {
      const { jsPDF } = await import('jspdf');
      const {
        outputs,
        analysis,
        timelines,
        history,
        matrixSize,
        matrix,
        newtonInputs,
        taylorInputs,
        activeMethod,
        operationText,
      } = get();

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      const contentTop = 24;
      const contentBottom = pageHeight - 16;
      const left = margin;
      let y = contentTop;
      let pageNo = 1;

      const timestamp = new Date().toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const sanitize = (value) => {
        if (value === null || value === undefined) return '—';
        const text = String(value);
        return text.trim() ? text : '—';
      };

      const drawPageFrame = () => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 130, 150);
        doc.text('Statistics & Numerical Methods — Computation Report', left, margin - 7);
        doc.text(`Page ${pageNo}`, pageWidth - margin, margin - 7, { align: 'right' });

        doc.setDrawColor(226, 232, 240);
        doc.line(left, margin - 3, pageWidth - margin, margin - 3);

        doc.setDrawColor(226, 232, 240);
        doc.line(left, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 130, 150);
        doc.text(`Generated ${timestamp}`, left, pageHeight - 8);
        doc.text('SNM Calculator', pageWidth - margin, pageHeight - 8, { align: 'right' });
      };

      const addPage = () => {
        doc.addPage();
        pageNo += 1;
        drawPageFrame();
        y = contentTop;
      };

      const ensureSpace = (heightNeeded) => {
        if (y + heightNeeded > contentBottom) addPage();
      };

      const drawSectionTitle = (title) => {
        ensureSpace(12);
        doc.setDrawColor(226, 232, 240);
        doc.line(left, y, pageWidth - margin, y);
        y += 2.5;

        doc.setFillColor(239, 246, 255);
        doc.rect(left, y, contentWidth, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(30, 64, 175);
        doc.text(title, left + 2, y + 4.2);
        y += 8.5;
      };

      const drawLabelValue = (label, value) => {
        const text = `${label}: ${sanitize(value)}`;
        const lines = doc.splitTextToSize(text, contentWidth);
        ensureSpace(lines.length * 4.8 + 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(45, 55, 72);
        doc.text(`${label}:`, left, y);
        const valueLines = doc.splitTextToSize(sanitize(value), contentWidth - 28);
        doc.setFont('helvetica', 'normal');
        doc.text(valueLines, left + 28, y);
        y += valueLines.length * 4.8;
      };

      const drawParagraph = (text, options = {}) => {
        const {
          mono = false,
          size = 10,
          lineHeight = 4.7,
          color = [45, 55, 72],
          spaceAfter = 2.5,
        } = options;

        const lines = doc.splitTextToSize(sanitize(text), contentWidth);
        ensureSpace(lines.length * lineHeight + spaceAfter);
        doc.setFont(mono ? 'courier' : 'helvetica', 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(lines, left, y);
        y += lines.length * lineHeight + spaceAfter;
      };

      const drawCodeBlock = (text, options = {}) => {
        const {
          size = 9.3,
          lineHeight = 4.2,
          spaceAfter = 3,
          fill = [248, 250, 252],
          border = [226, 232, 240],
          color = [30, 41, 59],
        } = options;

        const chunks = [];
        sanitize(text)
          .split('\n')
          .forEach((line) => {
            const pieces = doc.splitTextToSize(line || ' ', contentWidth - 5);
            pieces.forEach((piece) => chunks.push(piece));
          });

        const height = chunks.length * lineHeight + 4;
        ensureSpace(height + spaceAfter);

        doc.setFillColor(fill[0], fill[1], fill[2]);
        doc.setDrawColor(border[0], border[1], border[2]);
        doc.roundedRect(left, y - 2.2, contentWidth, height, 1.3, 1.3, 'FD');

        doc.setFont('courier', 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(chunks, left + 2, y + 1.5);
        y += height + spaceAfter;
      };

      const drawMethodSection = (title, output) => {
        // Reserve space so the section title and the following code block stay together
        if (output && output.trim()) {
          const raw = sanitize(output);
          const chunks = [];
          raw.split('\n').forEach((line) => {
            const pieces = doc.splitTextToSize(line || ' ', contentWidth - 5);
            pieces.forEach((p) => chunks.push(p));
          });
          const estHeight = chunks.length * 4.2 + 6; // estimated code block height
          ensureSpace(estHeight + 18); // include room for section title
        } else {
          ensureSpace(28);
        }

        drawSectionTitle(title);
        if (output && output.trim()) {
          drawCodeBlock(output);
        } else {
          drawParagraph('No solution generated for this method in the current workspace.', {
            size: 10,
            color: [100, 116, 139],
          });
        }
      };

      const equationLabel = {
        x_plus_y: "y' = x + y",
        x2_plus_y: "y' = x^2 + y",
        x_plus_y2: "y' = x + y^2",
        xy: "y' = x * y",
      };

      const matrixText = (() => {
        const rows = matrix.map((row) => row.map((cell) => sanitize(cell)));
        const maxCols = Math.max(0, ...rows.map((row) => row.length));
        const widths = Array.from({ length: maxCols }, (_, colIdx) =>
          Math.max(1, ...rows.map((row) => (row[colIdx] ? row[colIdx].length : 1)))
        );
        return rows
          .map((row) => row.map((cell, i) => cell.padStart(widths[i], ' ')).join('   '))
          .join('\n');
      })();

      drawPageFrame();

      // Subtle header: no logo, compact title and generated timestamp
      const headerHeight = 18;
      const titleBaseline = y + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Statistics & Numerical Methods', left, titleBaseline);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(94, 106, 129);
      doc.text('SNM Report', left + 2, titleBaseline + 6);
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 150);
      doc.text(`Generated: ${timestamp}`, pageWidth - margin, titleBaseline + 6, { align: 'right' });
      y += headerHeight + 4;

      // Intro paragraph
      const introText = 'This report summarizes the current workspace state, inputs, and computed results for the selected numerical and statistical methods. It includes system analysis, method inputs, computed outputs, and a concise timeline of operations to help you review and reproduce results.';
      drawParagraph(introText, { size: 10, color: [55, 65, 81], spaceAfter: 3 });

      // Key metrics cards
      const cardH = 18;
      const gap = 8;
      const cardCount = 4;
      const cardW = Math.floor((contentWidth - gap * (cardCount - 1)) / cardCount);
      ensureSpace(cardH + 6);
      const metrics = [
        { label: 'System Status', value: sanitize(analysis.status) },
        { label: 'Active Method', value: sanitize(activeMethod) },
        { label: 'Matrix Size', value: `${matrixSize} × ${matrixSize + 1}` },
        { label: 'History', value: String(history.length) },
      ];

      let cx = left;
      for (let i = 0; i < metrics.length; i++) {
        const m = metrics[i];
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(250, 252, 255);
        doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 64, 175);
        doc.text(m.label, cx + 4, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(String(m.value), cx + 4, y + 13);
        cx += cardW + gap;
      }
      y += cardH + 8;

      // Quick Actions & Help removed per user request — keep a compact spacer
      y += 4;

      drawSectionTitle('Summary');
      drawLabelValue('System Status', analysis.status);
      drawLabelValue('Determinant', analysis.determinant);
      drawLabelValue('Rank(A)', analysis.rankA);
      drawLabelValue('Rank([A|B])', analysis.rankAug);
      drawLabelValue('Matrix Size', `${matrixSize} × ${matrixSize + 1} (augmented)`);
      drawLabelValue('Active Method', activeMethod);
      drawLabelValue('Last Operation', operationText);
      drawLabelValue('History Entries', history.length);
      y += 3;

      drawSectionTitle('Method Inputs');
      drawLabelValue('Newton x values', newtonInputs.x || 'Not provided');
      drawLabelValue('Newton y values', newtonInputs.y || 'Not provided');
      drawLabelValue('Newton target x', newtonInputs.target || 'Not provided');
      drawLabelValue('Taylor equation', (taylorInputs.custom && taylorInputs.custom.trim()) ? taylorInputs.custom : (equationLabel[taylorInputs.equation] || taylorInputs.equation));
      drawLabelValue('Taylor x0', taylorInputs.x0);
      drawLabelValue('Taylor y0', taylorInputs.y0);
      drawLabelValue('Taylor h', taylorInputs.h);
      drawLabelValue('Taylor order', taylorInputs.order);
      y += 2;

      drawSectionTitle('Input Matrix (Current State)');
      drawCodeBlock(matrixText, { size: 9 });

      drawMethodSection('Gauss-Jordan Solution', outputs.gauss);

      if (timelines.gauss?.length) {
        drawSectionTitle('Gauss-Jordan Step Timeline');
        timelines.gauss.forEach((entry, index) => {
          drawParagraph(`${index + 1}. ${sanitize(entry.phase)} — ${sanitize(entry.title)}`, {
            size: 10,
            color: [30, 64, 175],
            spaceAfter: 1,
          });
          if (entry.matrix) {
            drawCodeBlock(entry.matrix, {
              size: 8.6,
              lineHeight: 4,
              fill: [250, 250, 252],
              border: [229, 231, 235],
              color: [51, 65, 85],
              spaceAfter: 2,
            });
          }
        });
      }

      drawMethodSection('Newton Backward Solution', outputs.newton);
      drawMethodSection('Taylor Series Solution', outputs.taylor);

      drawSectionTitle('Recent History');
      if (history.length) {
        history.slice(0, 12).forEach((item, index) => {
          drawParagraph(`${index + 1}. ${sanitize(item.method)} | ${sanitize(item.result)} | ${sanitize(item.time)}`, {
            size: 9.5,
            color: [51, 65, 85],
            spaceAfter: 1.5,
          });
        });
      } else {
        drawParagraph('No history entries available.', {
          size: 10,
          color: [100, 116, 139],
        });
      }

      doc.save('snm-report.pdf');
      get().setToast('PDF exported successfully.');
    } catch {
      get().setToast('PDF export failed. Please try again.');
    }
  },

  resetWorkspace: () => {
    const size = 3;
    set({
      activeMethod: 'gauss',
      matrixSize: size,
      matrix: emptyMatrix(size),
      activeCell: { row: 0, col: 0 },
      activeRow: null,
      pivotRow: null,
      targetRow: null,
      operationText: 'Awaiting operation',
      isSolving: false,
      outputs: { gauss: '', newton: '', taylor: '' },
      newtonInputs: { x: '', y: '', target: '' },
      taylorInputs: { equation: 'x_plus_y', custom: '', x0: '0', y0: '1', h: '0.1', order: '3' },
      timelines: { gauss: [], newton: [], taylor: [] },
      history: [],
      clearConfirmOpen: false,
      showSteps: { gauss: true, newton: false, taylor: false },
    });
    get().analyzeMatrix();
  },

  getTaylorDerivatives: async (equationExpr, x0, y0, order) => {
    try {
      const derivs = await evalTaylorDerivatives(equationExpr, x0, y0, order);
      return derivs;
    } catch (err) {
      console.warn('getTaylorDerivatives failed', err);
      return Array.from({ length: Math.max(1, order + 1) }, (_, i) => (i === 0 ? y0 : 0));
    }
  },

  getWorkflowProgress: () => {
    const outputs = get().outputs;
    const solved = METHODS.filter((m) => outputs[m]?.trim()).length;
    return Math.round((solved / METHODS.length) * 100);
  },
}));
