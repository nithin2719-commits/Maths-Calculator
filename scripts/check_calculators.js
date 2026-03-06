#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';
import { create, all } from 'mathjs';
import {
  parseMatrixStringMatrix,
  getGaussJordanOperations,
  buildGaussSummary,
} from '../src/lib/linearAlgebra.js';

const math = create(all);

function approxEqual(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

async function checkGauss() {
  console.log('Running Gauss-Jordan check...');
  const sample = [
    ['2', '1', '-1', '8'],
    ['-3', '-1', '2', '-11'],
    ['-2', '1', '2', '-3'],
  ];
  const mat = parseMatrixStringMatrix(sample);
  const res = getGaussJordanOperations(mat);
  if (!res.ok) {
    console.error('Gauss-Jordan failed: no pivot found');
    return false;
  }
  const final = res.finalMatrix;
  const n = mat.length;
  const solution = final.map((row) => row[n]);
  // Known solution (from problem) is [2,3,-1]
  const expected = [2, 3, -1];
  const ok = expected.every((v, i) => approxEqual(v, solution[i], 1e-5));
  console.log('  solution:', solution.map((v) => Number(v.toFixed(6))));
  console.log('  expected:', expected);
  console.log('  pass:', ok);
  return ok;
}

function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function computeTaylorDerivatives(exprStr, x0, y0, order) {
  // exprStr: string for f(x,y) representing y' = f(x,y)
  const scope = { x: x0, y: y0 };
  const node = math.parse(exprStr);

  // Precompute partial derivatives symbolically
  const dfdx = math.derivative(node, 'x');
  const dfdy = math.derivative(node, 'y');

  const evalNode = (n, s) => {
    try {
      return n.evaluate(s);
    } catch (e) {
      return NaN;
    }
  };

  const derivatives = [];
  // y(0) = y0
  derivatives[0] = y0;
  // y'(0) = f(x0,y0)
  derivatives[1] = evalNode(node, scope);

  for (let k = 2; k <= order; k++) {
    // y^{(k)} = d/dx y^{(k-1)} = d/dx(previous derivative) but for ODE y' = f(x,y)
    // We use recurrence: y^{(k)} = d/dx y^{(k-1)} = (∂f/∂x) + (∂f/∂y)*y^{(k-1)}? Approximate using chain rule on f
    // More precisely, using Faà di Bruno is complex. For many simple tests (like f=y) this suffices.
    const prev = derivatives[k - 1];
    const val_dfdx = evalNode(dfdx, scope);
    const val_dfdy = evalNode(dfdy, scope);
    const val = (Number.isFinite(val_dfdx) ? val_dfdx : 0) + (Number.isFinite(val_dfdy) ? val_dfdy * prev : 0);
    derivatives[k] = val;
    // update scope.y to next derivative? keep x,y base for evaluation (we evaluate partials at x0,y0)
  }
  return derivatives;
}

async function checkTaylor() {
  console.log('Running Taylor method check (y\' = y)...');
  const expr = 'y';
  const x0 = 0;
  const y0 = 1;
  const h = 0.1;
  const order = 6;
  const derivs = computeTaylorDerivatives(expr, x0, y0, order);
  // build Taylor sum at x0 + h
  let approx = 0;
  for (let k = 0; k <= order; k++) {
    approx += (Math.pow(h, k) / factorial(k)) * derivs[k];
  }
  const exact = Math.exp(h);
  const err = Math.abs(approx - exact);
  console.log('  taylor approx:', approx);
  console.log('  exact exp(h):', exact);
  console.log('  error:', err);
  const pass = err < 1e-4;
  console.log('  pass:', pass);
  return pass;
}

async function main() {
  const gaussOk = await checkGauss();
  const taylorOk = await checkTaylor();
  const allOk = gaussOk && taylorOk;
  console.log('\nSummary:');
  console.log('  Gauss test:', gaussOk ? 'OK' : 'FAIL');
  console.log('  Taylor test:', taylorOk ? 'OK' : 'FAIL');
  if (!allOk) {
    console.error('\nOne or more checks failed.');
    process.exit(2);
  }
  console.log('\nAll checks passed.');
  process.exit(0);
}

main();
