const EPS = 1e-10;

export function toNum(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

export function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

export function determinant(A) {
  const n = A.length;
  const M = cloneMatrix(A);
  let sign = 1;
  let det = 1;

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < EPS) return 0;

    if (pivot !== col) {
      [M[pivot], M[col]] = [M[col], M[pivot]];
      sign *= -1;
    }

    const pv = M[col][col];
    det *= pv;

    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pv;
      for (let c = col; c < n; c++) M[r][c] -= factor * M[col][c];
    }
  }

  return det * sign;
}

export function rank(matrix) {
  const M = cloneMatrix(matrix);
  const rows = M.length;
  const cols = M[0]?.length ?? 0;
  if (!rows || !cols) return 0;

  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let pivot = r;
    for (let i = r + 1; i < rows; i++) {
      if (Math.abs(M[i][c]) > Math.abs(M[pivot][c])) pivot = i;
    }
    if (Math.abs(M[pivot][c]) < EPS) continue;

    [M[r], M[pivot]] = [M[pivot], M[r]];
    const pv = M[r][c];

    for (let j = c; j < cols; j++) M[r][j] /= pv;

    for (let i = 0; i < rows; i++) {
      if (i === r) continue;
      const factor = M[i][c];
      if (Math.abs(factor) < EPS) continue;
      for (let j = c; j < cols; j++) M[i][j] -= factor * M[r][j];
    }
    r++;
  }
  return r;
}

export function classifySystem(augmented) {
  const n = augmented.length;
  const A = augmented.map((row) => row.slice(0, n));
  const det = determinant(A);
  const rankA = rank(A);
  const rankAug = rank(augmented);

  let status = 'Unique Solution';
  if (rankA < rankAug) status = 'No Solution';
  else if (rankA === rankAug && rankA < n) status = 'Infinite Solutions';

  return {
    determinant: det,
    singular: Math.abs(det) < EPS,
    rankA,
    rankAug,
    status,
  };
}

export function parseMatrixStringMatrix(stringMatrix) {
  return stringMatrix.map((row) => row.map((value) => toNum(value)));
}

export function formatNum(value, digits = 6) {
  if (!Number.isFinite(value)) return 'NaN';
  if (Math.abs(value) < EPS) return '0';
  return Number.parseFloat(value.toFixed(digits)).toString();
}

export function formatMatrix(matrix) {
  const n = matrix.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const left = matrix[i].slice(0, n).map((v) => formatNum(v, 4).padStart(10)).join('');
    const b = formatNum(matrix[i][n], 4).padStart(10);
    lines.push(`  [${left}  |${b}]`);
  }
  return lines.join('\n');
}

export function getGaussJordanOperations(input) {
  const n = input.length;
  const M = cloneMatrix(input);
  const operations = [];

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    }

    if (Math.abs(M[pivotRow][col]) < EPS) {
      return { ok: false, operations, finalMatrix: M };
    }

    if (pivotRow !== col) {
      const before = cloneMatrix(M);
      [M[pivotRow], M[col]] = [M[col], M[pivotRow]];
      operations.push({
        phase: 'Step 1 — Pivot normalization',
        op: `R${col + 1} ↔ R${pivotRow + 1}`,
        pivotRow: col,
        targetRow: pivotRow,
        before,
        after: cloneMatrix(M),
      });
    }

    const pivot = M[col][col];
    if (Math.abs(pivot - 1) > EPS) {
      const before = cloneMatrix(M);
      for (let j = col; j <= n; j++) M[col][j] /= pivot;
      operations.push({
        phase: 'Step 1 — Pivot normalization',
        op: `R${col + 1} = R${col + 1} / ${formatNum(pivot, 4)}`,
        pivotRow: col,
        targetRow: col,
        before,
        after: cloneMatrix(M),
      });
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      if (Math.abs(factor) < EPS) continue;

      const before = cloneMatrix(M);
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
      operations.push({
        phase: 'Step 2 — Row elimination',
        op: `R${row + 1} = R${row + 1} ${factor >= 0 ? '-' : '+'} ${formatNum(Math.abs(factor), 4)}R${col + 1}`,
        pivotRow: col,
        targetRow: row,
        before,
        after: cloneMatrix(M),
      });
    }
  }

  return { ok: true, operations, finalMatrix: M };
}

export function buildGaussSummary(original, finalMatrix) {
  const n = original.length;
  const solution = finalMatrix.map((row) => row[n]);

  const lines = [];
  lines.push(`Gauss-Jordan Elimination — ${n}×${n}`);
  lines.push('='.repeat(52));
  lines.push('\nInitial [A|B]:');
  lines.push(formatMatrix(original));
  lines.push('\nReduced [RREF]:');
  lines.push(formatMatrix(finalMatrix));
  lines.push('\nSolution:');
  solution.forEach((value, idx) => lines.push(`  x${idx + 1} = ${formatNum(value, 6)}`));

  return { solution, text: lines.join('\n') };
}

export function emptyMatrix(size) {
  return Array.from({ length: size }, () => Array.from({ length: size + 1 }, () => '0'));
}
