import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitize(value) {
  if (value === null || value === undefined) return '—';
  const text = String(value);
  return text.trim() ? text : '—';
}

function buildMatrixText(matrix) {
  const rows = matrix.map((row) => row.map((cell) => sanitize(cell)));
  const maxCols = Math.max(0, ...rows.map((row) => row.length));
  const widths = Array.from({ length: maxCols }, (_, colIdx) =>
    Math.max(1, ...rows.map((row) => (row[colIdx] ? row[colIdx].length : 1)))
  );
  return rows.map((row) => row.map((cell, i) => cell.padStart(widths[i], ' ')).join('   ')).join('\n');
}

function createReport({ filename, title, analysis, matrix, timelines = [], outputs = {}, history = [], inputs = {} }) {
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

  const timestamp = new Date().toLocaleString();

  const drawPageFrame = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 150);
    doc.text('Numerical Methods Suite — Professional Report', left, margin - 7);
    doc.text(`Page ${pageNo}`, pageWidth - margin, margin - 7, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.line(left, margin - 3, pageWidth - margin, margin - 3);

    doc.setDrawColor(226, 232, 240);
    doc.line(left, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 150);
    doc.text(`Generated ${timestamp}`, left, pageHeight - 8);
    doc.text('Maths Calculator Suite', pageWidth - margin, pageHeight - 8, { align: 'right' });
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

  const drawSectionTitle = (titleText) => {
    ensureSpace(12);
    doc.setDrawColor(226, 232, 240);
    doc.line(left, y, pageWidth - margin, y);
    y += 2.5;

    doc.setFillColor(239, 246, 255);
    doc.rect(left, y, contentWidth, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(30, 64, 175);
    doc.text(titleText, left + 2, y + 4.2);
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
    const { mono = false, size = 10, lineHeight = 4.7, color = [45, 55, 72], spaceAfter = 2.5 } = options;
    const lines = doc.splitTextToSize(sanitize(text), contentWidth);
    ensureSpace(lines.length * lineHeight + spaceAfter);
    doc.setFont(mono ? 'courier' : 'helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(lines, left, y);
    y += lines.length * lineHeight + spaceAfter;
  };

  const drawCodeBlock = (text, options = {}) => {
    const { size = 9.3, lineHeight = 4.2, spaceAfter = 3, fill = [248, 250, 252], border = [226, 232, 240], color = [30, 41, 59] } = options;

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
    // roundedRect not present on all builds; fallback to rect
    try {
      doc.roundedRect(left, y - 2.2, contentWidth, height, 1.3, 1.3, 'FD');
    } catch (e) {
      doc.rect(left, y - 2.2, contentWidth, height, 'FD');
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(chunks, left + 2, y + 1.5);
    y += height + spaceAfter;
  };

  // header
  drawPageFrame();
  doc.setFillColor(241, 245, 249);
  doc.rect(left - 2, y - 2, contentWidth + 4, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(title, left, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Computation Report', left, y + 12);
  doc.text(`Generated: ${timestamp}`, pageWidth - margin, y + 12, { align: 'right' });
  y += 24;

  drawSectionTitle('Summary');
  drawLabelValue('System Status', analysis.status);
  drawLabelValue('Determinant', analysis.determinant);
  drawLabelValue('Rank(A)', analysis.rankA);
  drawLabelValue('Rank([A|B])', analysis.rankAug);
  drawLabelValue('Matrix Size', `${matrix.length} × ${matrix[0]?.length ?? ''}`);
  drawLabelValue('History Entries', history.length);
  y += 3;

  if (Object.keys(inputs).length) {
    drawSectionTitle('Method Inputs');
    Object.entries(inputs).forEach(([k, v]) => drawLabelValue(k, v));
    y += 2;
  }

  drawSectionTitle('Input Matrix (Current State)');
  drawCodeBlock(buildMatrixText(matrix), { size: 9 });

  drawSectionTitle('Gauss-Jordan Solution');
  drawCodeBlock(outputs.gauss || 'No output generated.');

  if (timelines?.length) {
    drawSectionTitle('Gauss-Jordan Step Timeline');
    timelines.forEach((entry, index) => {
      drawParagraph(`${index + 1}. ${sanitize(entry.phase)} — ${sanitize(entry.title)}`, { size: 10, color: [30, 64, 175], spaceAfter: 1 });
      if (entry.matrix) drawCodeBlock(entry.matrix, { size: 8.6, lineHeight: 4 });
    });
  }

  drawSectionTitle('Newton Backward Solution');
  drawCodeBlock(outputs.newton || 'No output generated.');

  drawSectionTitle('Taylor Series Solution');
  drawCodeBlock(outputs.taylor || 'No output generated.');

  drawSectionTitle('Recent History');
  if (history.length) {
    history.slice(0, 12).forEach((item, index) => {
      drawParagraph(`${index + 1}. ${sanitize(item.method)} | ${sanitize(item.result)} | ${sanitize(item.time)}`, { size: 9.5, color: [51, 65, 85], spaceAfter: 1.5 });
    });
  } else {
    drawParagraph('No history entries available.', { size: 10, color: [100, 116, 139] });
  }

  ensureDir(path.dirname(filename));
  const out = doc.output();
  fs.writeFileSync(filename, out, 'binary');
  console.log('Wrote', filename);
}

// Sample data sets
const exportsDir = path.resolve('exports');
ensureDir(exportsDir);

const now = new Date();
const sampleTime = now.toLocaleTimeString();

// Small: Newton sample
createReport({
  filename: path.join(exportsDir, `report-newton-sample.pdf`),
  title: 'Newton Backward — Sample Report',
  analysis: { status: 'OK', determinant: '—', rankA: 3, rankAug: 3 },
  matrix: [[ '1891', '46' ], [ '1901', '66' ], [ '1911', '81' ], [ '1921', '93' ], [ '1931', '101' ]],
  outputs: {
    newton: `Newton Backward Interpolation\nh = 10, s = 0.4\nTerm 0: 101\nTerm 1: (0.4) * delta y_n = 2\nTerm 2: (0.08) * delta square y_n = 0.5\n...\nf(1925) ≈ 95.12345678`
  },
  history: [{ method: 'Newton Backward', result: 'f(1925)=95.1234', time: sampleTime }],
  inputs: { 'Newton x values': '1891,1901,1911,1921,1931', 'Newton y values': '46,66,81,93,101', 'Newton target x': '1925' }
});

// Medium: Gauss sample with timeline
createReport({
  filename: path.join(exportsDir, `report-gauss-sample.pdf`),
  title: 'Gauss-Jordan — Sample Report',
  analysis: { status: 'Unique solution', determinant: '14', rankA: 3, rankAug: 3 },
  matrix: [ ['2','1','-1','8'], ['-3','-1','2','-11'], ['-2','1','2','-3'] ],
  timelines: [
    { phase: 'Step 1 — Pivot normalization', title: 'Normalize row 1', matrix: '1 0.5 -0.5 4\n0 -0.5 0.5 1\n0 2 1 5' },
    { phase: 'Step 2 — Eliminate below', title: 'Zero out col 1', matrix: '1 0.5 -0.5 4\n0 1 0 -2\n0 0 1 3' }
  ],
  outputs: { gauss: 'x1=1\nx2=2\nx3=3' },
  history: [{ method: 'Gauss-Jordan', result: 'x1=1,x2=2,x3=3', time: sampleTime }]
});

// Large: Taylor sample with long outputs
const longTerms = Array.from({ length: 20 }, (_, i) => `Term ${i + 1}: ${Math.random().toFixed(8)}`).join('\n');
createReport({
  filename: path.join(exportsDir, `report-taylor-large.pdf`),
  title: 'Taylor Series — Large Output Report',
  analysis: { status: 'Computed', determinant: '—', rankA: '—', rankAug: '—' },
  matrix: [ ['0','1'] ],
  outputs: { taylor: `Taylor Series Method\n${longTerms}\nResult: ${Math.PI.toFixed(12)}` },
  history: [{ method: 'Taylor Series', result: 'y(0.1)=3.14159', time: sampleTime }],
  inputs: { 'Taylor equation': "y' = x + y", 'Taylor x0': '0', 'Taylor y0': '1', 'Taylor h': '0.1', 'Taylor order': '20' }
});

console.log('Sample PDF generation done. Files in exports/');
