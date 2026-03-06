// Taylor Series standalone script (uses global `math` from mathjs CDN)
function $(id) { return document.getElementById(id); }

function factorial(n) {
  if (n <= 1) return 1;
  let p = 1;
  for (let i = 2; i <= n; i++) p *= i;
  return p;
}

async function computeTaylor() {
  const eq = $('equation').value.trim();
  const x0 = parseFloat($('x0').value);
  const y0 = parseFloat($('y0').value);
  const h = parseFloat($('h').value);
  const order = Math.max(0, Math.min(60, parseInt($('order').value, 10) || 3));

  $('warn').textContent = '';
  if (!eq) { alert("Please enter an equation for y' = f(x,y)."); return; }
  if (![x0, y0, h].every((v) => Number.isFinite(v))) { alert('Enter valid numeric x0, y0, and h.'); return; }
  if (order > 15) $('warn').textContent = 'Warning: high order requested — computation may be slow or inaccurate.';

  try {
    // derivatives[0] = y0
    const derivatives = [];
    derivatives[0] = y0;

    // prevExpr starts as 'y' so total derivative gives f(x,y) for k=1
    let prevExpr = 'y';
    const fExpr = eq;

    for (let k = 1; k <= order; k++) {
      // total derivative: d/dx(prev) + d/dy(prev) * f
      const dxNode = math.derivative(prevExpr, 'x');
      const dyNode = math.derivative(prevExpr, 'y');
      const totalStr = `(${dxNode.toString()}) + (${dyNode.toString()})*(${fExpr})`;
      const val = Number(math.evaluate(totalStr, { x: x0, y: y0 }));
      derivatives[k] = Number.isFinite(val) ? val : 0;
      prevExpr = totalStr;
    }

    // compute Taylor polynomial sum_{k=0..order} (h^k / k!) * derivatives[k]
    let yNext = 0;
    const lines = [];
    for (let k = 0; k <= order; k++) {
      const dk = derivatives[k] === undefined ? 0 : derivatives[k];
      const term = (Math.pow(h, k) / factorial(k)) * dk;
      yNext += term;
      lines.push(`k=${k}  (h^${k}/${k}!) * ${dk.toPrecision(10)}  =  ${term.toPrecision(12)}`);
    }

    $('output').textContent = `y(${(x0 + h)}) ≈ ${yNext}`;
    $('terms').textContent = lines.join('\n');
  } catch (err) {
    console.error(err);
    alert('Computation error: see console for details.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const btn = $('compute');
  if (btn) btn.addEventListener('click', computeTaylor);
});
