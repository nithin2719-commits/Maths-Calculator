'use strict';

/* ═══════════════════════════════════════════════════════════
   Numerical Methods Suite — script.js
   Methods: Gauss-Jordan · Newton Backward · Taylor Series
═══════════════════════════════════════════════════════════ */

// ── CONSTANTS & CONFIG ───────────────────────────────────
const EPS = 1e-12;
const MAX_HISTORY = 8;

const METHOD_LABELS = {
  gauss:  'Gauss-Jordan',
  newton: 'Newton Backward',
  taylor: 'Taylor Series'
};

const METHOD_SHORT = {
  gauss:  'GJ',
  newton: 'NB',
  taylor: 'TS'
};

const SYSTEM_STATUS = {
  UNIQUE: 'Unique Solution',
  INFINITE: 'Infinite Solutions',
  NONE: 'No Solution',
  PENDING: 'Awaiting Input'
};

// ── STATE ────────────────────────────────────────────────
let currentPanelKey = 'gauss';
let toastTimer = null;
let historyList = [];

// ── DOM REFERENCES ───────────────────────────────────────
const domCache = {};
function $(id) {
  if (!domCache[id]) domCache[id] = document.getElementById(id);
  return domCache[id];
}

// Outputs
const methodOutputs = {
  gauss:  () => $('gj-output'),
  newton: () => $('nb-output'),
  taylor: () => $('ts-output')
};

const methodMathOutputs = {
  gauss:  () => $('gj-math'),
  newton: () => $('nb-math'),
  taylor: () => $('ts-math')
};

const methodStateEls = {
  gauss:  () => $('state-gauss'),
  newton: () => $('state-newton'),
  taylor: () => $('state-taylor')
};

const outputIdToMethod = {
  'gj-output': 'gauss',
  'nb-output': 'newton',
  'ts-output': 'taylor'
};

// ── UTILITY FUNCTIONS ────────────────────────────────────
function parseNumberListStrict(str) {
  const parts = str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const nums = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  return nums.length ? nums : null;
}

function cleanNumber(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) < EPS && n !== 0) return '0';
  const s = parseFloat(n.toPrecision(10)).toString();
  return s;
}

function formatNum(n, dp = 6) {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) < EPS) return '0';
  return parseFloat(n.toFixed(dp)).toString();
}

function formatDeterminant(n) {
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 1e-4)) {
    return n.toExponential(4);
  }
  return formatNum(n, 6);
}

function factorial(n) {
  n = Math.floor(n);
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function setOutput(el, text, tone) {
  if (!el) return;
  el.textContent = text;
  el.className = 'output-text steps-pane';
  if (tone) el.classList.add(tone);
  void el.offsetWidth;
  el.classList.add('output-appear');
}

function clearOutput(methodKey) {
  const out  = methodOutputs[methodKey]?.();
  const math = methodMathOutputs[methodKey]?.();
  if (out)  { out.textContent  = ''; out.className = 'output-text steps-pane'; }
  if (math) { math.textContent = ''; }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderGaussTimeline(entries = []) {
  const container = $('gj-timeline');
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = '<div class="timeline-empty">No steps yet. Run solve to generate timeline.</div>';
    return;
  }

  container.innerHTML = entries.map((entry, idx) => `
    <article class="timeline-item${entry.open ? ' is-open' : ''}" data-index="${idx}">
      <button class="timeline-toggle" type="button" aria-expanded="${entry.open ? 'true' : 'false'}">
        <span class="timeline-left">
          <span class="timeline-phase">${escapeHtml(entry.phase)}</span>
          <span class="timeline-title">${escapeHtml(entry.title)}</span>
        </span>
        <span class="timeline-chevron">›</span>
      </button>
      <div class="timeline-panel"${entry.open ? '' : ' style="max-height:0"'}>
        <pre class="timeline-matrix">${escapeHtml(entry.matrix)}</pre>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('.timeline-item').forEach(item => {
    const panel = item.querySelector('.timeline-panel');
    if (item.classList.contains('is-open') && panel) {
      panel.style.maxHeight = `${panel.scrollHeight}px`;
    }
  });
}

function clearGaussTimeline() {
  renderGaussTimeline([]);
}

function toggleTimelineItem(itemEl) {
  if (!itemEl) return;
  const panel = itemEl.querySelector('.timeline-panel');
  const button = itemEl.querySelector('.timeline-toggle');
  if (!panel || !button) return;

  const opening = !itemEl.classList.contains('is-open');
  itemEl.classList.toggle('is-open', opening);
  button.setAttribute('aria-expanded', opening ? 'true' : 'false');
  panel.style.maxHeight = opening ? `${panel.scrollHeight}px` : '0px';
}

function setRunButtonLoading(methodKey, isLoading) {
  const btnIdMap = { gauss: 'gj-solve', newton: 'nb-calc', taylor: 'ts-calc' };
  const btn = $(btnIdMap[methodKey]);
  if (!btn) return;
  btn.classList.toggle('is-loading', isLoading);
}

function publishSystemAnalysis(payload) {
  try {
    window.SystemAnalysisBridge?.update?.(payload);
  } catch {
  }
}

function determinantOfMatrix(matrix) {
  const n = matrix.length;
  if (n === 0) return 0;
  const M = matrix.map(row => row.map(v => Number(v)));
  let sign = 1;
  let det = 1;

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let pivotAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(M[r][col]);
      if (val > pivotAbs) {
        pivotAbs = val;
        pivotRow = r;
      }
    }

    if (pivotAbs < EPS) return 0;
    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      sign *= -1;
    }

    const pivot = M[col][col];
    det *= pivot;

    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivot;
      for (let c = col; c < n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  return det * sign;
}

function rankOfMatrix(matrix) {
  const rows = matrix.length;
  const cols = rows > 0 ? matrix[0].length : 0;
  if (!rows || !cols) return 0;

  const M = matrix.map(row => row.map(v => Number(v)));
  let rank = 0;
  let row = 0;

  for (let col = 0; col < cols && row < rows; col++) {
    let pivotRow = row;
    let pivotAbs = Math.abs(M[row][col]);
    for (let r = row + 1; r < rows; r++) {
      const val = Math.abs(M[r][col]);
      if (val > pivotAbs) {
        pivotAbs = val;
        pivotRow = r;
      }
    }

    if (pivotAbs < EPS) continue;
    if (pivotRow !== row) {
      [M[row], M[pivotRow]] = [M[pivotRow], M[row]];
    }

    const pivot = M[row][col];
    for (let c = col; c < cols; c++) {
      M[row][c] /= pivot;
    }

    for (let r = 0; r < rows; r++) {
      if (r === row) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < EPS) continue;
      for (let c = col; c < cols; c++) {
        M[r][c] -= factor * M[row][c];
      }
    }

    rank++;
    row++;
  }

  return rank;
}

function readGaussMatrixModel() {
  const n = Math.max(2, Math.min(8, Number.parseInt($('gj-size')?.value, 10) || 3));
  const inputs = Array.from(document.querySelectorAll('#gj-matrix .matrix-cell-input'));
  if (inputs.length !== n * (n + 1)) {
    return { valid: false, n, matrix: [], reason: 'incomplete-grid' };
  }

  const matrix = [];
  let cursor = 0;
  let valid = true;

  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n + 1; j++) {
      const input = inputs[cursor++];
      const raw = String(input?.value ?? '').trim();
      if (!isMatrixNumericValue(raw)) {
        valid = false;
      }
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) {
        valid = false;
      }
      row.push(num);
    }
    matrix.push(row);
  }

  return { valid, n, matrix };
}

function analyzeCurrentSystem() {
  const model = readGaussMatrixModel();
  if (!model.valid) {
    publishSystemAnalysis({
      status: SYSTEM_STATUS.PENDING,
      determinant: null,
      singular: null,
      rankA: null,
      rankAug: null,
      valid: false
    });
    return;
  }

  const { n, matrix } = model;
  const A = matrix.map(row => row.slice(0, n));
  const det = determinantOfMatrix(A);
  const rankA = rankOfMatrix(A);
  const rankAug = rankOfMatrix(matrix);
  const singular = Math.abs(det) < EPS;

  let status = SYSTEM_STATUS.UNIQUE;
  if (rankA < rankAug) {
    status = SYSTEM_STATUS.NONE;
  } else if (rankA === rankAug && rankA < n) {
    status = SYSTEM_STATUS.INFINITE;
  }

  publishSystemAnalysis({
    status,
    determinant: formatDeterminant(det),
    singular,
    rankA,
    rankAug,
    valid: true
  });
}

// ── TOAST ────────────────────────────────────────────────
function showToast(message, duration = 2200) {
  const toast = $('app-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── MATHJAX / LATEX ──────────────────────────────────────
function setMathOutput(methodKey, latex) {
  const el = methodMathOutputs[methodKey]?.();
  if (!el) return;
  if (!latex) { el.innerHTML = ''; return; }
  el.innerHTML = `\\(${latex}\\)`;
  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise([el]).catch(() => {});
  }
}

function extractValueByRegex(text, regex) {
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}

function getLatexForMethod(methodKey, outputText) {
  if (!outputText) return '';
  switch (methodKey) {
    case 'gauss': {
      // Extract solution line: "x1 = val, x2 = val ..."
      const solutionLine = outputText.split('\n').find(ln => ln.includes('Solution:'));
      if (!solutionLine) return '';
      const vars = [];
      const pattern = /x_?(\d+)\s*=\s*([\d.eE+\-]+)/g;
      let m;
      while ((m = pattern.exec(solutionLine)) !== null) {
        vars.push(`x_{${m[1]}} = ${formatNum(parseFloat(m[2]))}`);
      }
      // Try simpler extraction
      const simpleLine = outputText.split('\n').find(ln => /x\d\s*=/.test(ln));
      if (vars.length) return vars.join(', \\quad ');
      if (simpleLine) {
        return simpleLine.replace(/x(\d+)/g, 'x_{$1}').replace(/\s*=\s*/g, ' = ');
      }
      return '';
    }
    case 'newton': {
      const resLine = outputText.split('\n').find(ln => ln.match(/f\([\d.]+\)\s*[≈=]/));
      if (resLine) {
        const m2 = resLine.match(/f\(([\d.eE+\-]+)\)\s*[≈=]\s*([\d.eE+\-]+)/);
        if (m2) return `f(${m2[1]}) \\approx ${formatNum(parseFloat(m2[2]))}`;
      }
      const approx = extractValueByRegex(outputText, /Result[:\s]+([\d.eE+\-]+)/);
      if (approx) return `f(x) \\approx ${approx}`;
      return '';
    }
    case 'taylor': {
      const resLine = outputText.split('\n').find(ln => ln.match(/y\([\d.]+\)/));
      if (resLine) {
        const m3 = resLine.match(/y\(([\d.eE+\-]+)\)\s*[≈=]\s*([\d.eE+\-]+)/);
        if (m3) return `y(${m3[1]}) \\approx ${formatNum(parseFloat(m3[2]))}`;
      }
      const approx = extractValueByRegex(outputText, /Result[:\s]+([\d.eE+\-]+)/);
      if (approx) return `y(x_0+h) \\approx ${approx}`;
      return '';
    }
  }
  return '';
}

// ── METHOD STATE ─────────────────────────────────────────
function setMethodState(methodKey, labelText, tone) {
  const el = methodStateEls[methodKey]?.();
  if (!el) return;
  el.textContent = labelText;
  el.dataset.tone = tone || 'info';
}

// ── DASHBOARD UPDATE ─────────────────────────────────────
function updateDashboard(methodKey, action, resultSummary) {
  const mEl   = $('dashboard-active-method');
  const aEl   = $('dashboard-last-action');
  const rEl   = $('dashboard-last-result');
  if (mEl) mEl.textContent = METHOD_LABELS[methodKey] || methodKey;
  if (aEl) aEl.textContent = action || '—';
  if (rEl) rEl.textContent = resultSummary ? String(resultSummary).slice(0, 30) : '—';
}

// ── WORKFLOW PROGRESS ────────────────────────────────────
function getProgressPhase(pct) {
  if (pct === 0)   return 'idle';
  if (pct <= 33)   return 'input';
  if (pct <= 66)   return 'partial';
  if (pct < 100)   return 'compute';
  return 'complete';
}

function updateWorkflowProgress() {
  const methods = ['gauss','newton','taylor'];
  let done = 0;
  for (const key of methods) {
    const outEl = methodOutputs[key]?.();
    if (outEl && outEl.textContent.trim().length > 0) done++;
  }
  const prog = Math.round((done / methods.length) * 100);
  const bar  = $('workflow-progress');
  const cap  = $('workflow-caption');
  if (bar) bar.style.width = prog + '%';
  if (cap) cap.textContent = prog + '%';
}

// ── EMIT METHOD MESSAGE ──────────────────────────────────
function emitMethodMessage(methodKey, message, tone, actionLabel) {
  hidePanelLoading(methodKey);
  setOutput(methodOutputs[methodKey]?.(), message, tone);
  setMethodState(methodKey, actionLabel || (tone === 'error' ? 'Error' : 'Done'), tone || 'info');
  const latex = getLatexForMethod(methodKey, message);
  setMathOutput(methodKey, latex);
  updateDashboard(methodKey, actionLabel || 'Calculated', extractFirstResultForHistory(methodKey, message));
  updateWorkflowProgress();

  // Auto-show steps pane if there's output
  if (message && tone !== 'error') {
    const panel = document.getElementById(`panel-${methodKey}`);
    const consoleEl = panel?.querySelector('.output-console');
    const toggleBtn = $(`${methodKey === 'gauss' ? 'gj' : methodKey === 'newton' ? 'nb' : 'ts'}-steps-toggle`);
    if (consoleEl && !consoleEl.classList.contains('steps-visible')) {
      consoleEl.classList.add('steps-visible');
      if (toggleBtn) toggleBtn.textContent = 'Hide Steps';
    }
  }

  addToHistory(methodKey, message, tone);
}

function extractFirstResultForHistory(methodKey, text) {
  if (!text) return '—';
  switch (methodKey) {
    case 'gauss': {
      const ln = text.split('\n').find(l => l.trim().startsWith('x'));
      return ln ? ln.trim().slice(0, 25) : text.trim().slice(0, 25);
    }
    case 'newton':
    case 'taylor': {
      const m = text.match(/([\d.eE+\-]+)\s*$/) || text.match(/([\d.]+)/);
      return m ? m[1] : text.trim().slice(0, 20);
    }
  }
  return text.trim().slice(0, 20);
}

// ── CALCULATION HISTORY ──────────────────────────────────
function addToHistory(methodKey, text, tone) {
  if (!text || tone === 'error') return;
  const resultStr = extractFirstResultForHistory(methodKey, text);
  const entry = {
    method: METHOD_LABELS[methodKey],
    short:  METHOD_SHORT[methodKey],
    result: resultStr,
    time:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  historyList.unshift(entry);
  if (historyList.length > MAX_HISTORY) historyList.pop();
  renderHistory();
}

function renderHistory() {
  const ul = $('last-calculated-list');
  if (!ul) return;
  if (historyList.length === 0) {
    ul.innerHTML = '<li class="calc-empty">No calculations yet.</li>';
    return;
  }
  ul.innerHTML = historyList.map(e => `
    <li class="calc-item">
      <span class="calc-item-method">${e.short} — ${e.method}</span>
      <span class="calc-item-result">${e.result}</span>
      <span class="calc-item-time">${e.time}</span>
    </li>
  `).join('');
}

function clearHistoryList() {
  historyList = [];
  renderHistory();
}

// ── RESET METHOD OUTPUT ──────────────────────────────────
function resetMethodOutput(methodKey) {
  clearOutput(methodKey);
  setMethodState(methodKey, 'Awaiting input', 'info');
  hidePanelLoading(methodKey);
  if (methodKey === 'gauss') {
    resetGaussVisualState();
  }
  const prefixMap = { gauss: 'gj', newton: 'nb', taylor: 'ts' };
  const p = prefixMap[methodKey];
  const panel = document.getElementById(`panel-${methodKey}`);
  const consoleEl = panel?.querySelector('.output-console');
  if (consoleEl) consoleEl.classList.remove('steps-visible');
  const toggleBtn = $(`${p}-steps-toggle`);
  if (toggleBtn) toggleBtn.textContent = 'Show Steps';
}

function markInputsUpdated(methodKey) {
  setMethodState(methodKey, 'Inputs updated', 'info');
}

// ── PANEL SWITCHING ──────────────────────────────────────
function activatePanel(panelKey, focusFirst = true) {
  if (panelKey === currentPanelKey && !focusFirst) return;
  currentPanelKey = panelKey;

  // Update tabs
  document.querySelectorAll('.panel-tab').forEach(btn => {
    const target = btn.dataset.panelTarget;
    const isActive = target === panelKey;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Show/hide panels
  document.querySelectorAll('.calculator-panel').forEach(section => {
    const isActive = section.dataset.panel === panelKey;
    section.classList.toggle('is-active', isActive);
    section.hidden = !isActive;
  });

  // Update dashboard method
  const mEl = $('dashboard-active-method');
  if (mEl) mEl.textContent = METHOD_LABELS[panelKey];

  if (focusFirst) focusFirstFieldForMethod(panelKey);
}

function focusFirstFieldForMethod(methodKey) {
  const panel = document.getElementById(`panel-${methodKey}`);
  if (!panel) return;
  const first = panel.querySelector('input:not([type="number"]), select, input[type="number"]');
  if (first) setTimeout(() => first.focus(), 80);
}

function focusMatrixCell(row, col) {
  const cell = document.querySelector(`.matrix-cell-input[data-row="${row}"][data-col="${col}"]`);
  if (cell) cell.focus();
}

// ── CLIPBOARD ────────────────────────────────────────────
function copyTextToClipboard(text) {
  if (!text.trim()) { showToast('Nothing to copy.'); return; }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Copied to clipboard ✓'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Copied to clipboard ✓');
  } catch {
    showToast('Copy failed.');
  }
  document.body.removeChild(ta);
}

function copyMethodOutput(methodKey) {
  const out  = methodOutputs[methodKey]?.();
  const math = methodMathOutputs[methodKey]?.();
  const parts = [];
  if (math?.textContent.trim()) parts.push(math.textContent.trim());
  if (out?.textContent.trim())  parts.push(out.textContent.trim());
  copyTextToClipboard(parts.join('\n\n') || '');
}

function copyActiveResult() {
  copyMethodOutput(currentPanelKey);
}

// ═══════════════════════════════════════════════════════
// GAUSS-JORDAN ELIMINATION
// ═══════════════════════════════════════════════════════

function buildGaussJordanInputs() {
  const sizeInput = $('gj-size');
  const container = $('gj-matrix');
  if (!sizeInput || !container) return;
  const n = Math.max(2, Math.min(8, parseInt(sizeInput.value) || 3));
  sizeInput.value = n;

  // Header row
  let headerHtml = '<div class="matrix-header">';
  for (let j = 1; j <= n; j++) {
    headerHtml += `<div class="matrix-header-cell">x${j}</div>`;
  }
  headerHtml += '<div class="matrix-header-cell" style="border-left:2px solid var(--border)">b</div>';
  headerHtml += '</div>';

  // Input rows
  let rowsHtml = '';
  for (let i = 0; i < n; i++) {
    rowsHtml += '<div class="matrix-row">';
    for (let j = 0; j < n + 1; j++) {
      const isAugment = j === n;
      rowsHtml += `<div class="matrix-cell${isAugment ? ' matrix-cell--augment' : ''}">
        <input
          class="matrix-cell-input"
          type="number"
          step="any"
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          data-row="${i}"
          data-col="${j}"
          value="0"
          aria-label="Row ${i+1} Column ${j+1}"
          tabindex="0"
        />
      </div>`;
    }
    rowsHtml += '</div>';
  }

  container.innerHTML = headerHtml + rowsHtml;
  resetGaussVisualState();
  markInputsUpdated('gauss');
  analyzeCurrentSystem();
}

function clearGaussJordan() {
  const inputs = document.querySelectorAll('.matrix-cell-input');
  inputs.forEach(inp => {
    inp.value = '0';
    inp.classList.remove('matrix-cell-input--invalid');
  });
  resetGaussVisualState();
  resetMethodOutput('gauss');
  analyzeCurrentSystem();
}

function loadGaussJordanExample() {
  const sizeInput = $('gj-size');
  if (sizeInput) sizeInput.value = 3;
  buildGaussJordanInputs();
  const exampleMatrix = [
    [2, 1, -1, 8],
    [-3, -1, 2, -11],
    [-2, 1, 2, -3]
  ];
  const inputs = document.querySelectorAll('.matrix-cell-input');
  let idx = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      if (inputs[idx]) inputs[idx].value = exampleMatrix[i][j];
      idx++;
    }
  }
  resetGaussVisualState();
  markInputsUpdated('gauss');
  analyzeCurrentSystem();
  showToast('Sample loaded — 3×3 system');
}

function formatAugmentedMatrix(mat, n) {
  const lines = [];
  const colW = 10;
  for (let i = 0; i < n; i++) {
    let row = '  [ ';
    for (let j = 0; j < n; j++) {
      row += String(formatNum(mat[i][j], 4)).padStart(colW);
    }
    row += '  |';
    row += String(formatNum(mat[i][n], 4)).padStart(colW);
    row += '  ]';
    lines.push(row);
  }
  return lines.join('\n');
}

const GAUSS_OPERATION_DELAY_MS = 500;
const GAUSS_VALUE_ANIM_MS = 320;
let gaussAnimating = false;
const MATRIX_INTERMEDIATE_VALUES = new Set(['', '-', '+', '.', '-.', '+.']);

function isMatrixNumericValue(raw) {
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw);
}

function validateMatrixInput(inputEl, finalMode = false) {
  if (!inputEl) return false;
  const raw = String(inputEl.value ?? '').trim();
  const valid = finalMode
    ? isMatrixNumericValue(raw)
    : (MATRIX_INTERMEDIATE_VALUES.has(raw) || isMatrixNumericValue(raw));
  inputEl.classList.toggle('matrix-cell-input--invalid', !valid);
  return valid;
}

function selectMatrixCellValue(inputEl) {
  if (!inputEl?.classList.contains('matrix-cell-input')) return;
  requestAnimationFrame(() => inputEl.select());
}

function sanitizeMatrixPasteText(text) {
  return text.replace(/,/g, '.').trim();
}

function isAllowedMatrixKey(event, inputEl) {
  const key = event.key;
  if (event.ctrlKey || event.metaKey || event.altKey) return true;

  const navKeys = new Set([
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Tab', 'Enter', 'Home', 'End', 'Escape'
  ]);
  if (navKeys.has(key)) return true;

  if (/^\d$/.test(key)) return true;
  if (key === '.') return !inputEl.value.includes('.');

  if (key === '-' || key === '+') {
    const selectionStart = inputEl.selectionStart ?? 0;
    const selectionEnd = inputEl.selectionEnd ?? 0;
    const hasSign = /^[+-]/.test(inputEl.value);
    const replacingAll = selectionStart === 0 && selectionEnd === inputEl.value.length;
    return (selectionStart === 0 && !hasSign) || replacingAll;
  }

  return false;
}

function moveMatrixFocus(nextRow, nextCol, n) {
  const boundedRow = Math.max(0, Math.min(n - 1, nextRow));
  const boundedCol = Math.max(0, Math.min(n, nextCol));
  const next = getGaussMatrixInput(boundedRow, boundedCol);
  if (next) {
    next.focus();
    next.select();
  }
}

function handleMatrixNavigation(event, inputEl) {
  const row = Number.parseInt(inputEl.dataset.row, 10);
  const col = Number.parseInt(inputEl.dataset.col, 10);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return;

  const n = Math.max(2, Math.min(8, Number.parseInt($('gj-size')?.value, 10) || 3));
  let nextRow = row;
  let nextCol = col;

  switch (event.key) {
    case 'ArrowUp':
      nextRow = row - 1;
      event.preventDefault();
      moveMatrixFocus(nextRow, nextCol, n);
      return;
    case 'ArrowDown':
      nextRow = row + 1;
      event.preventDefault();
      moveMatrixFocus(nextRow, nextCol, n);
      return;
    case 'ArrowLeft':
      nextCol = col - 1;
      event.preventDefault();
      moveMatrixFocus(nextRow, nextCol, n);
      return;
    case 'ArrowRight':
      nextCol = col + 1;
      event.preventDefault();
      moveMatrixFocus(nextRow, nextCol, n);
      return;
    case 'Enter':
      nextRow = row + 1;
      event.preventDefault();
      moveMatrixFocus(nextRow, nextCol, n);
      return;
    case 'Tab':
      nextCol = col + (event.shiftKey ? -1 : 1);
      if (nextCol > n) {
        nextCol = 0;
        nextRow = row + 1;
      }
      if (nextCol < 0) {
        nextCol = n;
        nextRow = row - 1;
      }
      event.preventDefault();
      moveMatrixFocus(nextRow, nextCol, n);
      return;
    default:
      return;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureFramerAnimator() {
  if (typeof window.__framerAnimate === 'function') return window.__framerAnimate;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm');
    if (typeof mod.animate === 'function') {
      window.__framerAnimate = mod.animate;
      return mod.animate;
    }
  } catch {
    return null;
  }
  return null;
}

function setGaussOperation(description, active = true) {
  const opEl = $('gj-operation');
  if (!opEl) return;
  opEl.textContent = description;
  opEl.classList.toggle('is-active', active);
}

function clearGaussRowHighlights() {
  document.querySelectorAll('#gj-matrix .matrix-row').forEach(rowEl => {
    rowEl.classList.remove('matrix-row--pivot', 'matrix-row--target');
  });
}

function highlightGaussRows(pivotRow, targetRow) {
  clearGaussRowHighlights();
  const rows = document.querySelectorAll('#gj-matrix .matrix-row');
  if (rows[pivotRow]) rows[pivotRow].classList.add('matrix-row--pivot');
  if (targetRow !== null && targetRow !== undefined && rows[targetRow]) {
    rows[targetRow].classList.add('matrix-row--target');
  }
}

function getGaussMatrixInput(row, col) {
  return document.querySelector(`#gj-matrix .matrix-cell-input[data-row="${row}"][data-col="${col}"]`);
}

function setGaussRowValues(row, values) {
  for (let col = 0; col < values.length; col++) {
    const input = getGaussMatrixInput(row, col);
    if (input) input.value = cleanNumber(values[col]);
  }
}

async function animateNumericInput(input, fromValue, toValue, durationMs) {
  if (!input) return;
  if (!Number.isFinite(fromValue) || !Number.isFinite(toValue) || Math.abs(fromValue - toValue) < EPS) {
    input.value = cleanNumber(toValue);
    return;
  }

  input.classList.add('matrix-cell-input--animating');
  const framerAnimate = await ensureFramerAnimator();

  if (typeof framerAnimate === 'function') {
    try {
      const controls = framerAnimate(fromValue, toValue, {
        duration: durationMs / 1000,
        ease: 'easeInOut',
        onUpdate: latest => {
          input.value = cleanNumber(latest);
        }
      });
      if (controls?.finished) {
        await controls.finished;
      } else {
        await delay(durationMs);
      }
    } catch {
      input.value = cleanNumber(toValue);
    }
  } else {
    const start = performance.now();
    await new Promise(resolve => {
      function tick(now) {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const current = fromValue + (toValue - fromValue) * eased;
        input.value = cleanNumber(current);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  input.value = cleanNumber(toValue);
  input.classList.remove('matrix-cell-input--animating');
}

async function animateGaussRowTransition(row, fromValues, toValues, durationMs) {
  const anims = [];
  for (let col = 0; col < toValues.length; col++) {
    const input = getGaussMatrixInput(row, col);
    if (!input) continue;
    anims.push(animateNumericInput(input, fromValues[col], toValues[col], durationMs));
  }
  await Promise.all(anims);
}

function resetGaussVisualState() {
  clearGaussRowHighlights();
  setGaussOperation('Awaiting operation', false);
  clearGaussTimeline();
}

async function playGaussOperation(description, pivotRow, targetRow, rowTransitions) {
  setGaussOperation(description, true);
  highlightGaussRows(pivotRow, targetRow);
  await Promise.all(
    rowTransitions.map(transition =>
      animateGaussRowTransition(transition.row, transition.from, transition.to, GAUSS_VALUE_ANIM_MS)
    )
  );
  const remaining = Math.max(0, GAUSS_OPERATION_DELAY_MS - GAUSS_VALUE_ANIM_MS);
  if (remaining > 0) await delay(remaining);
}

async function solveGaussJordan() {
  if (gaussAnimating) {
    showToast('Gauss-Jordan animation is already running.');
    return;
  }

  const sizeInput = $('gj-size');
  if (!sizeInput) return;
  const n = Math.max(2, Math.min(8, parseInt(sizeInput.value) || 3));

  // Read matrix
  const mat = [];
  const inputs = document.querySelectorAll('.matrix-cell-input');
  let valid = true;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    mat.push([]);
    for (let j = 0; j < n + 1; j++) {
      const cellInput = inputs[idx];
      if (!validateMatrixInput(cellInput, true)) {
        valid = false;
        idx++;
        continue;
      }
      const v = Number.parseFloat(cellInput?.value);
      if (!Number.isFinite(v)) {
        valid = false;
        idx++;
        continue;
      }
      mat[i].push(v);
      idx++;
    }
    if (!valid) break;
  }

  if (!valid) {
    emitMethodMessage('gauss', 'Error: All matrix entries must be valid numbers.', 'error', 'Input error');
    return;
  }

  gaussAnimating = true;
  const solveBtn = $('gj-solve');
  if (solveBtn) solveBtn.disabled = true;

  showPanelLoading('gauss');
  clearGaussTimeline();
  const steps = [];
  const timelineEntries = [];
  let opCounter = 0;
  const addTimelineStep = (phase, title, matrix, open = false) => {
    timelineEntries.push({ phase, title, matrix, open });
  };

  steps.push(`Gauss-Jordan Elimination — ${n}×${n} Augmented Matrix`);
  steps.push('═'.repeat(52));
  steps.push('\nInitial augmented matrix [A|b]:');
  steps.push(formatAugmentedMatrix(mat, n));
  addTimelineStep('Initial State', 'Input augmented matrix', formatAugmentedMatrix(mat, n), true);

  try {
    const M = mat.map(r => [...r]);
    await ensureFramerAnimator();
    setGaussOperation('Preparing row operations…', true);

    for (let col = 0; col < n; col++) {
      let maxRow = -1;
      let maxVal = 0;
      for (let row = col; row < n; row++) {
        if (Math.abs(M[row][col]) > maxVal) {
          maxVal = Math.abs(M[row][col]);
          maxRow = row;
        }
      }

      if (maxVal < EPS) {
        addTimelineStep('Step 1 — Pivot normalization', 'Pivot not found (singular/inconsistent system)', formatAugmentedMatrix(M, n), true);
        renderGaussTimeline(timelineEntries);
        emitMethodMessage(
          'gauss',
          'Error: System has no unique solution (singular or inconsistent matrix).',
          'error',
          'No unique solution'
        );
        return;
      }

      if (maxRow !== col) {
        const beforePivot = [...M[col]];
        const beforeSwap = [...M[maxRow]];
        [M[col], M[maxRow]] = [M[maxRow], M[col]];
        const op = `R${col + 1} ↔ R${maxRow + 1}`;
        steps.push(`\n${op}`);
        const matrixState = formatAugmentedMatrix(M, n);
        steps.push(matrixState);
        opCounter += 1;
        addTimelineStep('Step 1 — Pivot normalization', `${opCounter}. ${op}`, matrixState);
        await playGaussOperation(op, col, maxRow, [
          { row: col, from: beforePivot, to: [...M[col]] },
          { row: maxRow, from: beforeSwap, to: [...M[maxRow]] }
        ]);
      }

      const scale = M[col][col];
      if (Math.abs(scale - 1) > EPS) {
        const beforeScale = [...M[col]];
        for (let j = col; j <= n; j++) M[col][j] /= scale;
        const op = `R${col + 1} = R${col + 1} / ${formatNum(scale, 4)}`;
        steps.push(`\n${op}`);
        const matrixState = formatAugmentedMatrix(M, n);
        steps.push(matrixState);
        opCounter += 1;
        addTimelineStep('Step 1 — Pivot normalization', `${opCounter}. ${op}`, matrixState);
        await playGaussOperation(op, col, null, [
          { row: col, from: beforeScale, to: [...M[col]] }
        ]);
      }

      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = M[row][col];
        if (Math.abs(factor) < EPS) continue;

        const beforeTarget = [...M[row]];
        for (let j = col; j <= n; j++) {
          M[row][j] -= factor * M[col][j];
        }

        const opSign = factor >= 0 ? '-' : '+';
        const op = `R${row + 1} = R${row + 1} ${opSign} ${formatNum(Math.abs(factor), 4)}R${col + 1}`;
        steps.push(`\n${op}`);
        const matrixState = formatAugmentedMatrix(M, n);
        steps.push(matrixState);
        opCounter += 1;
        addTimelineStep('Step 2 — Row elimination', `${opCounter}. ${op}`, matrixState);
        await playGaussOperation(op, col, row, [
          { row, from: beforeTarget, to: [...M[row]] }
        ]);
      }
    }

    clearGaussRowHighlights();
    setGaussOperation('Row operations completed.', false);

    const solution = M.map(row => row[n]);
    addTimelineStep(
      'Step 3 — Back substitution',
      'Read solution from RREF',
      `${formatAugmentedMatrix(M, n)}\n\n${solution.map((v, i) => `x${i + 1} = ${formatNum(v, 6)}`).join('\n')}`,
      true
    );
    renderGaussTimeline(timelineEntries);

    steps.push('\n' + '═'.repeat(52));
    steps.push('Solution:');
    const solutionParts = solution.map((v, i) => `  x${i + 1} = ${formatNum(v, 6)}`);
    steps.push(solutionParts.join('\n'));

    steps.push('\nVerification [A · x = b]:');
    let verified = true;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += mat[i][j] * solution[j];
      const err = Math.abs(sum - mat[i][n]);
      if (err > 1e-6) verified = false;
      steps.push(`  Row ${i + 1}: ${formatNum(sum, 6)} ≈ ${formatNum(mat[i][n], 6)}  (err = ${err.toExponential(2)})`);
    }
    steps.push(verified ? '\n✓ Solution verified successfully.' : '\n⚠ Verification residual is large — check inputs.');

    const solutionLabel = solution.map((v, i) => `x${i + 1} = ${formatNum(v, 4)}`).join(', ');
    emitMethodMessage('gauss', steps.join('\n'), 'success', `Solved: ${solutionLabel}`);
  } finally {
    gaussAnimating = false;
    if (solveBtn) solveBtn.disabled = false;
    hidePanelLoading('gauss');
  }
}

// ═══════════════════════════════════════════════════════
// NEWTON'S BACKWARD INTERPOLATION
// ═══════════════════════════════════════════════════════

function clearNewtonInputs() {
  const fields = ['nb-x','nb-y','nb-target'];
  fields.forEach(id => { const el = $(id); if (el) el.value = ''; });
  resetMethodOutput('newton');
}

function loadNewtonExample() {
  const ex = {
    'nb-x': '1891, 1901, 1911, 1921, 1931',
    'nb-y': '46, 66, 81, 93, 101',
    'nb-target': '1925'
  };
  Object.entries(ex).forEach(([id, val]) => {
    const el = $(id);
    if (el) el.value = val;
  });
  markInputsUpdated('newton');
  showToast('Sample data loaded — population data');
}

function newtonBackwardInterpolation() {
  const xRaw = $('nb-x')?.value.trim();
  const yRaw = $('nb-y')?.value.trim();
  const targetRaw = $('nb-target')?.value.trim();

  if (!xRaw || !yRaw || !targetRaw) {
    emitMethodMessage('newton', 'Error: All fields are required.', 'error', 'Missing input');
    return;
  }

  const xArr = parseNumberListStrict(xRaw);
  const yArr = parseNumberListStrict(yRaw);
  const xTarget = parseFloat(targetRaw);

  if (!xArr) { emitMethodMessage('newton', 'Error: Invalid x values — use comma-separated numbers.', 'error', 'Input error'); return; }
  if (!yArr) { emitMethodMessage('newton', 'Error: Invalid y values — use comma-separated numbers.', 'error', 'Input error'); return; }
  if (!Number.isFinite(xTarget)) { emitMethodMessage('newton', 'Error: Target x must be a finite number.', 'error', 'Input error'); return; }
  if (xArr.length !== yArr.length) { emitMethodMessage('newton', `Error: x has ${xArr.length} values but y has ${yArr.length}. They must match.`, 'error', 'Length mismatch'); return; }
  if (xArr.length < 2) { emitMethodMessage('newton', 'Error: At least 2 data points are required.', 'error', 'Too few points'); return; }

  // Check equally spaced
  const n = xArr.length;
  const h = xArr[1] - xArr[0];
  if (Math.abs(h) < EPS) { emitMethodMessage('newton', 'Error: x values must be distinct.', 'error', 'Degenerate x'); return; }
  for (let i = 1; i < n - 1; i++) {
    const diff = xArr[i+1] - xArr[i];
    if (Math.abs(diff - h) > EPS * 1000) {
      emitMethodMessage('newton', 'Error: x values must be equally spaced for Newton\'s backward formula.', 'error', 'Not equally spaced');
      return;
    }
  }

  showPanelLoading('newton');
  const steps = [];
  steps.push(`Newton's Backward Interpolation`);
  steps.push('═'.repeat(52));
  steps.push(`\nData points (n = ${n}):`);

  // Print data table
  steps.push('  ' + ['i', 'x', 'y'].map(s => s.padStart(10)).join(''));
  for (let i = 0; i < n; i++) {
    steps.push('  ' + [i, formatNum(xArr[i],4), formatNum(yArr[i],4)].map(v => String(v).padStart(10)).join(''));
  }

  steps.push(`\nStep size h = ${formatNum(h, 4)}`);

  // Build difference table
  const diff = [];
  diff.push([...yArr]);
  for (let order = 1; order < n; order++) {
    const prev = diff[order - 1];
    const curr = [];
    for (let i = order; i < n; i++) {
      curr.push(prev[i] - prev[i-1]);
    }
    diff.push(curr);
  }

  // Print difference table
  steps.push('\nBackward Difference Table:');
  const header = ['y(x)'];
  for (let k = 1; k < n; k++) header.push(`Δ${k === 1 ? '' : k}y`);
  steps.push('  ' + header.map(h2 => h2.padStart(12)).join(''));
  for (let i = 0; i < n; i++) {
    let row = '  ' + formatNum(xArr[i],4).padStart(6) + '  ';
    for (let k = 0; k <= n - 1 - 0; k++) {
      if (k < diff.length && i >= k && (i - k + k) < diff[k].length + k) {
        if (diff[k][i - k + (k > 0 ? k : 0)] !== undefined && i - k >= 0 && diff[k][i-k] !== undefined) {
          row += formatNum(diff[k][i >= k ? i : -1] ?? diff[k][i - 0], 4).padStart(12);
        } else {
          row += ''.padStart(12);
        }
      } else {
        row += ''.padStart(12);
      }
    }
    steps.push(row);
  }

  // Rebuild difference table correctly for display
  steps.pop(); // remove bad table
  steps.pop();
  steps.pop();
  steps.pop();
  steps.push('\nBackward Difference Table:');

  const maxCols = Math.min(n, 6);
  const tableHeader = 'i'.padEnd(4) + 'x'.padStart(10) + 'y'.padStart(12);
  for (let k = 1; k < maxCols; k++) {
    const label = `Δ^${k === 1 ? '' : k}y`;
  }
  // Proper table
  const colW2 = 11;
  let hdr = '  ' + 'i'.padStart(3) + 'x'.padStart(9) + 'y(=Δ⁰)'.padStart(colW2);
  for (let k = 1; k < n; k++) {
    hdr += `Δ^${k}y`.padStart(colW2);
    if (k >= 5) { hdr += '...'; break; }
  }
  steps.push(hdr);

  for (let i = 0; i < n; i++) {
    let rowStr = '  ' + String(i).padStart(3) + formatNum(xArr[i],2).padStart(9);
    for (let k = 0; k < n; k++) {
      if (k < diff.length) {
        const idx2 = i - k;
        if (idx2 >= 0 && idx2 < diff[k].length) {
          rowStr += formatNum(diff[k][idx2], 4).padStart(colW2);
        } else {
          rowStr += ''.padStart(colW2);
        }
      }
      if (k >= 5) { rowStr += '...'; break; }
    }
    steps.push(rowStr);
  }

  // s value (backward from xn)
  const xn = xArr[n-1];
  const s = (xTarget - xn) / h;
  steps.push(`\nBackward variable s = (x − xₙ) / h = (${xTarget} − ${formatNum(xn,4)}) / ${formatNum(h,4)} = ${formatNum(s,6)}`);

  // Newton backward formula
  steps.push('\nNewton Backward Interpolation Formula:');
  steps.push('  f(x) = y_n + s·Δy_n + [s(s+1)/2!]·Δ²y_n + [s(s+1)(s+2)/3!]·Δ³y_n + ...');

  let result = diff[0][n-1]; // y_n
  steps.push(`\nTerm 0: y_n = ${formatNum(diff[0][n-1],6)}`);

  let sFactor = 1;
  for (let k = 1; k < n; k++) {
    if (diff[k].length === 0) break;
    const dkVal = diff[k][n-1-k];
    if (dkVal === undefined) break;

    sFactor *= (s + k - 1);
    const termCoeff = sFactor / factorial(k);
    const term = termCoeff * dkVal;
    result += term;
    steps.push(`Term ${k}: [s(s+1)...(s+${k-1}) / ${k}!] × Δ^${k}y_n = ${formatNum(termCoeff,6)} × ${formatNum(dkVal,6)} = ${formatNum(term,6)}`);
  }

  steps.push('\n' + '═'.repeat(52));
  steps.push(`f(${xTarget}) ≈ ${formatNum(result, 6)}`);

  emitMethodMessage('newton', steps.join('\n'), 'success', `f(${xTarget}) ≈ ${formatNum(result,4)}`);
}

// ═══════════════════════════════════════════════════════
// TAYLOR SERIES ODE METHOD
// ═══════════════════════════════════════════════════════

// ODE definitions: y' = f(x, y)
// Returns [f, f', f'', f''', f'''''] where primes are total derivatives w.r.t. x
function evalDerivatives(equationType, x0, y0, order) {
  let f, fx, fy, fxx, fxy, fyy, fxxx, fxxy, fxyy, fyyy;
  switch (equationType) {
    case 'x_plus_y': {
      // y' = x + y -> y'' = 1 + y' = 1 + x + y
      // y''' = 0 + y'' = 1 + x + y = same pattern
      // y^(n) = y^(n-1) + 1 (but also adds the x term derivative)
      // y' = x + y
      // y'' = 1 + y' = 1 + x + y
      // y''' = 1 + y'' = 1 + (1 + x + y) = 2 + x + y
      // y'''' = 1 + y''' = 3 + x + y
      const base = x0 + y0;
      const derivs = [y0]; // y at x0
      const yp1 = base;         // y' = x + y
      const yp2 = 1 + yp1;      // y'' = 1 + y'
      const yp3 = 1 + yp2;      // y''' = 1 + y''
      const yp4 = 1 + yp3;      // y'''' = 1 + y'''
      return [yp1, yp2, yp3, yp4];
    }
    case 'x2_plus_y': {
      // y' = x^2 + y
      const yp1 = x0*x0 + y0;
      const yp2 = 2*x0 + yp1;          // y'' = 2x + y'
      const yp3 = 2 + yp2;              // y''' = 2 + y''
      const yp4 = yp3;                  // y'''' = y'''
      return [yp1, yp2, yp3, yp4];
    }
    case 'x_plus_y2': {
      // y' = x + y^2
      const yp1 = x0 + y0*y0;
      const yp2 = 1 + 2*y0*yp1;        // y'' = 1 + 2y·y'
      const yp3 = 2*yp1*yp1 + 2*y0*yp2; // y''' = 2(y')^2 + 2y·y''
      const yp4 = 6*yp1*yp2 + 2*y0*yp3; // y'''' = 6y'y'' + 2y·y'''
      return [yp1, yp2, yp3, yp4];
    }
    case 'xy': {
      // y' = x·y
      const yp1 = x0 * y0;
      const yp2 = y0 + x0 * yp1;           // y'' = y + x·y'
      const yp3 = 2*yp1 + x0*yp2;          // y''' = 2y' + x·y''
      const yp4 = 3*yp2 + x0*yp3;          // y'''' = 3y'' + x·y'''
      return [yp1, yp2, yp3, yp4];
    }
    default:
      return [0, 0, 0, 0];
  }
}

function clearTaylorInputs() {
  const defaults = { 'ts-x0': '0', 'ts-y0': '1', 'ts-h': '0.1', 'ts-order': '3' };
  Object.entries(defaults).forEach(([id, val]) => {
    const el = $(id); if (el) el.value = val;
  });
  resetMethodOutput('taylor');
}

function loadTaylorExample() {
  const ex = { 'ts-x0': '0', 'ts-y0': '1', 'ts-h': '0.1', 'ts-order': '4' };
  const sel = $('ts-equation');
  if (sel) sel.value = 'x_plus_y';
  Object.entries(ex).forEach(([id, val]) => {
    const el = $(id); if (el) el.value = val;
  });
  markInputsUpdated('taylor');
  showToast('Sample loaded — y\' = x + y, x₀=0, y₀=1');
}

function taylorSeries() {
  const eqType = $('ts-equation')?.value;
  const x0     = parseFloat($('ts-x0')?.value);
  const y0     = parseFloat($('ts-y0')?.value);
  const h      = parseFloat($('ts-h')?.value);
  const order  = Math.max(1, Math.min(4, parseInt($('ts-order')?.value) || 3));

  if (!Number.isFinite(x0))   { emitMethodMessage('taylor', 'Error: Initial x₀ must be a number.', 'error', 'Input error'); return; }
  if (!Number.isFinite(y0))   { emitMethodMessage('taylor', 'Error: Initial y₀ must be a number.', 'error', 'Input error'); return; }
  if (!Number.isFinite(h) || Math.abs(h) < EPS) {
    emitMethodMessage('taylor', 'Error: Step size h must be a non-zero finite number.', 'error', 'Input error'); return;
  }

  showPanelLoading('taylor');

  const eqLabels = {
    x_plus_y:  "y' = x + y",
    x2_plus_y: "y' = x² + y",
    x_plus_y2: "y' = x + y²",
    xy:        "y' = x · y"
  };

  const steps = [];
  steps.push("Taylor's Series Method — 1st Order ODE");
  steps.push('═'.repeat(52));
  steps.push(`\nEquation : ${eqLabels[eqType] || eqType}`);
  steps.push(`x₀       = ${formatNum(x0,6)}`);
  steps.push(`y₀       = ${formatNum(y0,6)}`);
  steps.push(`h        = ${formatNum(h,6)}`);
  steps.push(`Order    = ${order}`);
  steps.push(`\nTarget   x₁ = x₀ + h = ${formatNum(x0+h, 6)}`);

  const derivs = evalDerivatives(eqType, x0, y0, order);
  steps.push('\nDerivatives at (x₀, y₀):');
  const derivLabels = ["y'", "y''", "y'''", "y''''"];
  for (let k = 0; k < order; k++) {
    steps.push(`  ${derivLabels[k].padEnd(6)} = ${formatNum(derivs[k], 8)}`);
  }

  // Taylor expansion: y1 = y0 + h*y' + h²/2!*y'' + ...
  steps.push('\nTaylor expansion:');
  steps.push('  y(x₀+h) = y₀ + h·y\' + (h²/2!)·y\'\' + (h³/3!)·y\'\'\' + (h⁴/4!)·y\'\'\'\'');

  let y1 = y0;
  let hpow = 1;
  for (let k = 0; k < order; k++) {
    hpow *= h;
    const fact = factorial(k + 1);
    const term = (hpow / fact) * derivs[k];
    y1 += term;
    const sign = term >= 0 ? '+' : '-';
    steps.push(`  ${k === 0 ? '  ' : sign} ${formatNum(Math.abs(hpow/fact), 8)} × ${formatNum(derivs[k], 8)} = ${formatNum(term, 8)}`);
  }

  steps.push('\n' + '─'.repeat(52));
  steps.push(`  y₁ = y(${formatNum(x0,4)} + ${formatNum(h,4)}) = y(${formatNum(x0+h,6)})`);
  steps.push('═'.repeat(52));
  steps.push(`y(${formatNum(x0+h,6)}) ≈ ${formatNum(y1, 8)}`);

  emitMethodMessage('taylor', steps.join('\n'), 'success', `y(${formatNum(x0+h,4)}) ≈ ${formatNum(y1,6)}`);
}

// ── RUN ACTIVE PANEL ─────────────────────────────────────
function runCurrentMethod() {
  switch (currentPanelKey) {
    case 'gauss':  solveGaussJordan(); break;
    case 'newton': newtonBackwardInterpolation(); break;
    case 'taylor': taylorSeries(); break;
  }
}

// ── RESET WORKSPACE ──────────────────────────────────────
function resetWorkspace() {
  ['gauss','newton','taylor'].forEach(resetMethodOutput);
  clearHistoryList();
  clearNewtonInputs();
  clearTaylorInputs();
  clearGaussJordan();
  updateWorkflowProgress();
  showToast('Workspace reset.');
}

// ═══════════════════════════════════════════════════════
// LOADING STATE
// ═══════════════════════════════════════════════════════
function showPanelLoading(methodKey) {
  const el = $(`loading-${methodKey}`);
  if (el) el.removeAttribute('aria-hidden');
  setRunButtonLoading(methodKey, true);
}

function hidePanelLoading(methodKey) {
  const el = $(`loading-${methodKey}`);
  if (el) el.setAttribute('aria-hidden', 'true');
  setRunButtonLoading(methodKey, false);
}

// ═══════════════════════════════════════════════════════
// KEYBOARD SHORTCUT MODAL
// ═══════════════════════════════════════════════════════
function openShortcutModal() {
  const modal = $('shortcut-modal');
  if (!modal) return;
  modal.hidden = false;
  const closeBtn = $('modal-close');
  if (closeBtn) closeBtn.focus();
}

function closeShortcutModal() {
  const modal = $('shortcut-modal');
  if (modal) modal.hidden = true;
}

// ═══════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════

// Panel Tab switching
document.querySelectorAll('.panel-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.panelTarget;
    if (target) activatePanel(target, true);
  });
});

// Gauss-Jordan
$('gj-generate')?.addEventListener('click', buildGaussJordanInputs);
$('gj-solve')?.addEventListener('click', solveGaussJordan);
$('gj-clear')?.addEventListener('click', clearGaussJordan);
$('gj-example')?.addEventListener('click', loadGaussJordanExample);

// Newton
$('nb-calc')?.addEventListener('click', newtonBackwardInterpolation);
$('nb-clear')?.addEventListener('click', clearNewtonInputs);
$('nb-example')?.addEventListener('click', loadNewtonExample);

// Taylor
$('ts-calc')?.addEventListener('click', taylorSeries);
$('ts-clear')?.addEventListener('click', clearTaylorInputs);
$('ts-example')?.addEventListener('click', loadTaylorExample);

// Mark inputs changed
['gj-size'].forEach(id => {
  $(`${id}`)?.addEventListener('input', () => markInputsUpdated('gauss'));
});
$('gj-matrix')?.addEventListener('input', () => markInputsUpdated('gauss'));
$('gj-matrix')?.addEventListener('focusin', event => {
  const target = event.target;
  if (!target?.classList?.contains('matrix-cell-input')) return;
  selectMatrixCellValue(target);
});
$('gj-matrix')?.addEventListener('click', event => {
  const target = event.target;
  if (!target?.classList?.contains('matrix-cell-input')) return;
  if (target.value.length > 0) selectMatrixCellValue(target);
});
$('gj-matrix')?.addEventListener('input', event => {
  const target = event.target;
  if (!target?.classList?.contains('matrix-cell-input')) return;
  validateMatrixInput(target, false);
  analyzeCurrentSystem();
});
$('gj-matrix')?.addEventListener('blur', event => {
  const target = event.target;
  if (!target?.classList?.contains('matrix-cell-input')) return;
  validateMatrixInput(target, true);
  analyzeCurrentSystem();
}, true);
$('gj-matrix')?.addEventListener('keydown', event => {
  const target = event.target;
  if (!target?.classList?.contains('matrix-cell-input')) return;
  handleMatrixNavigation(event, target);
  if (!isAllowedMatrixKey(event, target)) {
    event.preventDefault();
  }
});
$('gj-matrix')?.addEventListener('paste', event => {
  const target = event.target;
  if (!target?.classList?.contains('matrix-cell-input')) return;
  const pasted = sanitizeMatrixPasteText(event.clipboardData?.getData('text') || '');
  if (!MATRIX_INTERMEDIATE_VALUES.has(pasted) && !isMatrixNumericValue(pasted)) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  target.value = pasted;
  validateMatrixInput(target, false);
  analyzeCurrentSystem();
});
['nb-x','nb-y','nb-target'].forEach(id => {
  $(id)?.addEventListener('input', () => markInputsUpdated('newton'));
});
['ts-equation','ts-x0','ts-y0','ts-h','ts-order'].forEach(id => {
  $(id)?.addEventListener('input', () => markInputsUpdated('taylor'));
});

// Copy buttons (output-bar)
document.querySelectorAll('[data-copy-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.copyTarget;
    const method = outputIdToMethod[targetId];
    if (method) copyMethodOutput(method);
  });
});

// Sidebar actions
$('action-copy-active')?.addEventListener('click', copyActiveResult);
$('action-reset-all')?.addEventListener('click', () => {
  if (confirm('Reset the entire workspace? All inputs and results will be cleared.')) {
    resetWorkspace();
  }
});

// Steps toggle (per panel)
[
  { prefix: 'gj', methodKey: 'gauss'  },
  { prefix: 'nb', methodKey: 'newton' },
  { prefix: 'ts', methodKey: 'taylor' }
].forEach(({ prefix, methodKey }) => {
  const btn = $(`${prefix}-steps-toggle`);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const panel = document.getElementById(`panel-${methodKey}`);
    const consoleEl = panel?.querySelector('.output-console');
    if (!consoleEl) return;
    const visible = consoleEl.classList.toggle('steps-visible');
    btn.textContent = visible ? 'Hide Steps' : 'Show Steps';
  });
});

$('gj-timeline')?.addEventListener('click', event => {
  const btn = event.target.closest('.timeline-toggle');
  if (!btn) return;
  const item = btn.closest('.timeline-item');
  toggleTimelineItem(item);
});

// Shortcut modal
$('btn-shortcuts')?.addEventListener('click', openShortcutModal);
$('modal-close')?.addEventListener('click', closeShortcutModal);
$('shortcut-modal')?.addEventListener('click', e => {
  if (e.target === $('shortcut-modal')) closeShortcutModal();
});

// PDF Export
$('btn-export')?.addEventListener('click', () => {
  // Make all panels visible for printing, then revert
  const panels = document.querySelectorAll('.calculator-panel');
  panels.forEach(p => p.removeAttribute('hidden'));
  window.print();
  // After print, restore
  setTimeout(() => {
    panels.forEach(p => {
      if (p.dataset.panel !== currentPanelKey) p.setAttribute('hidden', '');
    });
  }, 500);
});

// Matrix keyboard navigation (arrow keys)
document.addEventListener('keydown', e => {
  // Ctrl+Enter → run active method
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    runCurrentMethod();
    return;
  }

  // ? → open shortcut modal
  if (e.key === '?' && !['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)) {
    openShortcutModal();
    return;
  }

  // Escape → close shortcut modal
  if (e.key === 'Escape') {
    const modal = $('shortcut-modal');
    if (modal && !modal.hidden) { closeShortcutModal(); return; }
  }

  // Alt+1/2/3 → switch panels
  if (e.altKey) {
    const panelMap = { '1': 'gauss', '2': 'newton', '3': 'taylor' };
    if (panelMap[e.key]) {
      e.preventDefault();
      activatePanel(panelMap[e.key], true);
      return;
    }
  }

  // Matrix keys are handled on #gj-matrix for spreadsheet behavior.
  const target = e.target;
  if (target?.classList.contains('matrix-cell-input')) {
    return;
  }
});

// ── INIT ─────────────────────────────────────────────────
(function init() {
  buildGaussJordanInputs();
  activatePanel('gauss', false);
  updateWorkflowProgress();
  updateDashboard('gauss', 'Ready', '—');
  analyzeCurrentSystem();
  clearGaussTimeline();
})();
