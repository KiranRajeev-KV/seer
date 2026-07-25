'use client';

import { useMaxHeight, useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface ResultData {
  analysisId: string;
  question: string;
  targetColumn: string;
  quality: 'useful_signal' | 'weak_signal' | 'no_demonstrated_signal';
  model: { name: string };
  baseline: { name: string };
  metrics: {
    model: { mae: number; rmse: number; r2: number };
    baseline: { mae: number; rmse: number; r2: number };
    improvement: { maeAbsolute: number; maePercent: number; rmseAbsolute: number; rmsePercent: number; r2Absolute: number };
  };
  predictions: Array<{
    input: Record<string, string | number | boolean>;
    estimatedValue: number;
    coverage: { outsideNumericRanges: string[]; unseenCategoricalValues: string[] };
  }>;
  charts: {
    actualVsPredicted: Array<{ actual: number; predicted: number }>;
    residualVsPredicted: Array<{ predicted: number; residual: number }>;
  };
  datasetCoverage: { trainingRows: number; testRows: number };
  warnings: string[];
}

export const dynamic = 'force-dynamic';

const format = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const percent = (value: number) => `${value >= 0 ? '+' : ''}${format(value)}%`;

export default function RegressionResultsWidget() {
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const { isReady, getToolOutput } = useWidgetSDK();
  const data = getToolOutput<ResultData>();
  const dark = theme === 'dark';
  const colors = {
    canvas: dark ? '#07111f' : '#f5f8fc', panel: dark ? '#0e1c2f' : '#ffffff', ink: dark ? '#e7eef8' : '#132238',
    muted: dark ? '#9db0c8' : '#64748b', border: dark ? '#20354f' : '#dbe5ef', warning: dark ? '#44240c' : '#fff4df',
  };
  if (!isReady || !data) return <div style={{ padding: 24, color: colors.ink }}>Preparing regression results…</div>;

  const quality = {
    useful_signal: { label: 'Useful signal', tone: '#10b981', text: 'The model clearly beats the mean baseline on MAE.' },
    weak_signal: { label: 'Weak signal', tone: '#f59e0b', text: 'The model improves on the baseline, but only modestly.' },
    no_demonstrated_signal: { label: 'No demonstrated signal', tone: '#ef4444', text: 'The model did not beat the mean baseline on this split.' },
  }[data.quality];

  return <main style={{ background: colors.canvas, color: colors.ink, minHeight: 400, maxHeight: maxHeight || 700, overflow: 'auto', padding: 16, boxSizing: 'border-box' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
      <div><p style={{ color: '#0ea5e9', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', margin: 0 }}>SEER / REGRESSION RESULT</p><h1 style={{ fontSize: 22, margin: '5px 0 3px' }}>{data.targetColumn.replace(/_/g, ' ')} estimate</h1><p style={{ color: colors.muted, fontSize: 13, margin: 0 }}>{data.question}</p></div>
      <span style={{ color: quality.tone, background: `${quality.tone}20`, borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{quality.label}</span>
    </header>

    <section style={panel(colors)}><strong>{quality.text}</strong><p style={{ color: colors.muted, fontSize: 13, margin: '6px 0 0' }}>{data.model.name} evaluated against {data.baseline.name} on {data.datasetCoverage.testRows} held-out rows.</p></section>
    <section style={panel(colors)}><h2 style={heading}>Predictions</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>{data.predictions.map((prediction, index) => <div key={index} style={{ background: colors.canvas, border: `1px solid ${colors.border}`, borderRadius: 9, padding: 11 }}><div style={{ color: colors.muted, fontSize: 11, fontWeight: 800 }}>ROW {index + 1}</div><div style={{ fontSize: 25, fontWeight: 800, margin: '3px 0 8px' }}>{format(prediction.estimatedValue)}</div><div style={{ fontSize: 12, display: 'grid', gap: 3 }}>{Object.entries(prediction.input).map(([name, value]) => <span key={name}><span style={{ color: colors.muted }}>{name}: </span>{String(value)}</span>)}</div>{prediction.coverage.outsideNumericRanges.length > 0 && <p style={caution}>Outside training range: {prediction.coverage.outsideNumericRanges.join(', ')}</p>}{prediction.coverage.unseenCategoricalValues.length > 0 && <p style={caution}>Unseen category: {prediction.coverage.unseenCategoricalValues.join(', ')}</p>}</div>)}</div></section>
    <section style={panel(colors)}><h2 style={heading}>Model versus baseline</h2><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse', fontSize: 13 }}><thead style={{ color: colors.muted, textAlign: 'left' }}><tr><th style={cell}>Metric</th><th style={cell}>{data.model.name}</th><th style={cell}>{data.baseline.name}</th><th style={cell}>Change</th></tr></thead><tbody><MetricRow label="MAE" model={data.metrics.model.mae} baseline={data.metrics.baseline.mae} change={percent(data.metrics.improvement.maePercent)} colors={colors} /><MetricRow label="RMSE" model={data.metrics.model.rmse} baseline={data.metrics.baseline.rmse} change={percent(data.metrics.improvement.rmsePercent)} colors={colors} /><MetricRow label="R²" model={data.metrics.model.r2} baseline={data.metrics.baseline.r2} change={`${data.metrics.improvement.r2Absolute >= 0 ? '+' : ''}${format(data.metrics.improvement.r2Absolute)}`} colors={colors} /></tbody></table></div><p style={{ color: colors.muted, fontSize: 12, marginBottom: 0 }}>MAE is the typical absolute error. RMSE gives more weight to larger errors. R² below zero means worse than predicting the training mean.</p></section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 }}><Chart title="Actual vs predicted" points={data.charts.actualVsPredicted.map((point) => ({ x: point.actual, y: point.predicted }))} xLabel="Actual" yLabel="Predicted" colors={colors} diagonal /><Chart title="Residual vs predicted" points={data.charts.residualVsPredicted.map((point) => ({ x: point.predicted, y: point.residual }))} xLabel="Predicted" yLabel="Residual" colors={colors} horizontalZero /></div>
    {data.warnings.length > 0 && <section style={panel(colors)}><h2 style={heading}>Warnings and limitations</h2>{data.warnings.map((warning) => <p key={warning} style={{ background: colors.warning, borderRadius: 7, padding: '8px 10px', fontSize: 13, margin: '7px 0 0' }}>{warning}</p>)}</section>}
  </main>;
}

const heading = { fontSize: 14, margin: '0 0 10px' } as const;
const cell = { padding: '8px 6px' } as const;
const caution = { color: '#b45309', fontSize: 12, margin: '8px 0 0' } as const;
function panel(colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning', string>) { return { background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 13, marginTop: 12 }; }
function MetricRow({ label, model, baseline, change, colors }: { label: string; model: number; baseline: number; change: string; colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning', string> }) { return <tr style={{ borderTop: `1px solid ${colors.border}` }}><td style={{ ...cell, fontWeight: 700 }}>{label}</td><td style={cell}>{format(model)}</td><td style={cell}>{format(baseline)}</td><td style={cell}>{change}</td></tr>; }
function Chart({ title, points, xLabel, yLabel, colors, diagonal = false, horizontalZero = false }: { title: string; points: Array<{ x: number; y: number }>; xLabel: string; yLabel: string; colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning', string>; diagonal?: boolean; horizontalZero?: boolean }) {
  const width = 300; const height = 185; const pad = 30; const xs = points.map((point) => point.x); const ys = points.map((point) => point.y); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys, horizontalZero ? 0 : Infinity); const maxY = Math.max(...ys, horizontalZero ? 0 : -Infinity); const scale = (value: number, low: number, high: number, size: number) => low === high ? size / 2 : ((value - low) / (high - low)) * size;
  const pointX = (value: number) => pad + scale(value, minX, maxX, width - pad * 2); const pointY = (value: number) => height - pad - scale(value, minY, maxY, height - pad * 2);
  return <section style={panel(colors)}><h2 style={heading}>{title}</h2><svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title}><line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={colors.border} /><line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke={colors.border} />{diagonal && <line x1={pointX(Math.max(minX, minY))} y1={pointY(Math.max(minX, minY))} x2={pointX(Math.min(maxX, maxY))} y2={pointY(Math.min(maxX, maxY))} stroke="#94a3b8" strokeDasharray="4 4" />}{horizontalZero && <line x1={pad} y1={pointY(0)} x2={width - pad} y2={pointY(0)} stroke="#94a3b8" strokeDasharray="4 4" />}{points.map((point, index) => <circle key={index} cx={pointX(point.x)} cy={pointY(point.y)} r="2.5" fill="#0ea5e9" opacity="0.72" />)}<text x={width / 2} y={height - 5} fill={colors.muted} fontSize="10" textAnchor="middle">{xLabel}</text><text x="10" y={height / 2} fill={colors.muted} fontSize="10" textAnchor="middle" transform={`rotate(-90 10 ${height / 2})`}>{yLabel}</text></svg></section>;
}
