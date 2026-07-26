'use client';

import { useMaxHeight, useTheme, useWidgetSDK } from '@nitrostack/widgets';

type Quality = 'useful_signal' | 'weak_signal' | 'no_demonstrated_signal';
type Coverage = { outsideNumericRanges: string[]; unseenCategoricalValues: string[] };

interface CommonResult {
  question: string;
  targetColumn: string;
  quality: Quality;
  model: { name: string };
  baseline: { name: string };
  datasetCoverage: { trainingRows: number; testRows: number };
  warnings: string[];
}

interface RegressionResult extends CommonResult {
  taskType: 'regression';
  metrics: { model: { mae: number; rmse: number; r2: number }; baseline: { mae: number; rmse: number; r2: number }; improvement: { maePercent: number; rmsePercent: number; r2Absolute: number } };
  predictions: Array<{ input: Record<string, string | number | boolean>; estimatedValue: number; coverage: Coverage }>;
  charts: { actualVsPredicted: Array<{ actual: number; predicted: number }>; residualVsPredicted: Array<{ predicted: number; residual: number }> };
}

interface ClassificationResult extends CommonResult {
  taskType: 'classification';
  metrics: { model: ClassificationMetric; baseline: ClassificationMetric; improvement: { f1Absolute: number; f1Percent: number } };
  predictions: Array<{ input: Record<string, string | number | boolean>; predictedClass: string; predictedProbability: number; coverage: Coverage }>;
  charts: { confusionMatrix: { labels: string[]; values: number[][] }; classDistribution: Array<{ classLabel: string; count: number; percentage: number }> };
  perClassMetrics: Array<{ classLabel: string; precision: number; recall: number; f1: number; support: number }>;
}

interface ClassificationMetric { accuracy: number; precision: number; recall: number; f1: number }
type ResultData = RegressionResult | ClassificationResult;

export const dynamic = 'force-dynamic';

const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${number(value)}%`;

export default function AnalysisResultsWidget() {
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const { isReady, getToolOutput } = useWidgetSDK();
  const data = getToolOutput<ResultData>();
  const dark = theme === 'dark';
  const colors = palette(dark);
  if (!isReady || !data) return <div style={{ padding: 24, color: colors.ink }}>Preparing analysis results…</div>;

  const quality = qualityLabel(data.quality);
  return <main style={{ background: colors.canvas, color: colors.ink, minHeight: 400, maxHeight: maxHeight || 700, overflow: 'auto', padding: 16, boxSizing: 'border-box', fontFamily: 'Georgia, serif' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: `2px solid ${colors.border}`, paddingBottom: 14 }}>
      <div>
        <p style={{ color: colors.accent, fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', margin: 0 }}>SEER / {data.taskType.toUpperCase()} REPORT</p>
        <h1 style={{ fontSize: 24, margin: '5px 0 3px', letterSpacing: '-0.03em' }}>{data.taskType === 'regression' ? `${pretty(data.targetColumn)} estimate` : `${pretty(data.targetColumn)} category estimate`}</h1>
        <p style={{ color: colors.muted, fontSize: 13, margin: 0 }}>{data.question}</p>
      </div>
      <span style={{ color: quality.tone, border: `1px solid ${quality.tone}`, borderRadius: 999, padding: '6px 9px', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{quality.label}</span>
    </header>

    <section style={panel(colors)}><strong>{quality.description}</strong><p style={{ color: colors.muted, fontSize: 13, margin: '6px 0 0' }}>We checked this estimate on {data.datasetCoverage.testRows} rows it had not seen before, and compared it with a simple answer based on the usual result.</p></section>
    {data.taskType === 'regression' ? <RegressionView data={data} colors={colors} /> : <ClassificationView data={data} colors={colors} />}
    <Warnings warnings={data.warnings} colors={colors} />
  </main>;
}

function RegressionView({ data, colors }: { data: RegressionResult; colors: Colors }) {
  return <>
    <section style={panel(colors)}><h2 style={heading}>Predicted values</h2><div style={cards}>{data.predictions.map((prediction, index) => <PredictionCard key={index} title={`ROW ${index + 1}`} value={number(prediction.estimatedValue)} input={prediction.input} coverage={prediction.coverage} colors={colors} />)}</div></section>
    <section style={panel(colors)}><h2 style={heading}>How close the estimates were</h2><MetricTable rows={[
      ['Typical difference from what happened', number(data.metrics.model.mae), number(data.metrics.baseline.mae), signedPct(data.metrics.improvement.maePercent)],
      ['Difference when larger misses matter more', number(data.metrics.model.rmse), number(data.metrics.baseline.rmse), signedPct(data.metrics.improvement.rmsePercent)],
      ['How much of the pattern was captured', number(data.metrics.model.r2), number(data.metrics.baseline.r2), `${data.metrics.improvement.r2Absolute >= 0 ? '+' : ''}${number(data.metrics.improvement.r2Absolute)}`],
    ]} colors={colors} /></section>
    <div style={twoUp}><Scatter title="What happened vs what Seer estimated" points={data.charts.actualVsPredicted.map((point) => ({ x: point.actual, y: point.predicted }))} xLabel="What happened" yLabel="Seer estimate" diagonal colors={colors} /><Scatter title="Difference by estimated value" points={data.charts.residualVsPredicted.map((point) => ({ x: point.predicted, y: point.residual }))} xLabel="Seer estimate" yLabel="Difference" horizontalZero colors={colors} /></div>
  </>;
}

function ClassificationView({ data, colors }: { data: ClassificationResult; colors: Colors }) {
  return <>
    <section style={panel(colors)}><h2 style={heading}>Estimated categories</h2><div style={cards}>{data.predictions.map((prediction, index) => <PredictionCard key={index} title={`ROW ${index + 1}`} value={prediction.predictedClass} detail={`${pct(prediction.predictedProbability)} confidence in this estimate`} input={prediction.input} coverage={prediction.coverage} colors={colors} />)}</div></section>
    <section style={panel(colors)}><h2 style={heading}>How often the category estimates were right</h2><MetricTable rows={[
      ['Correct overall', pct(data.metrics.model.accuracy), pct(data.metrics.baseline.accuracy), '—'],
      ['Right when it chose a category', pct(data.metrics.model.precision), pct(data.metrics.baseline.precision), '—'],
      ['Found the cases it was looking for', pct(data.metrics.model.recall), pct(data.metrics.baseline.recall), '—'],
      ['Balance of those two checks', pct(data.metrics.model.f1), pct(data.metrics.baseline.f1), signedPct(data.metrics.improvement.f1Percent)],
    ]} colors={colors} /></section>
    <div style={twoUp}><ConfusionMatrix chart={data.charts.confusionMatrix} colors={colors} /><Distribution values={data.charts.classDistribution} colors={colors} /></div>
    <details style={panel(colors)}><summary style={{ cursor: 'pointer', fontWeight: 800 }}>Details for each category</summary><div style={{ overflowX: 'auto', marginTop: 10 }}><table style={table}><thead><tr><th style={cell}>Category</th><th style={cell}>Right when chosen</th><th style={cell}>Cases found</th><th style={cell}>Balance</th><th style={cell}>Rows checked</th></tr></thead><tbody>{data.perClassMetrics.map((metric) => <tr key={metric.classLabel} style={{ borderTop: `1px solid ${colors.border}` }}><td style={{ ...cell, fontWeight: 800 }}>{metric.classLabel}</td><td style={cell}>{pct(metric.precision)}</td><td style={cell}>{pct(metric.recall)}</td><td style={cell}>{pct(metric.f1)}</td><td style={cell}>{metric.support}</td></tr>)}</tbody></table></div></details>
  </>;
}

function PredictionCard({ title, value, detail, input, coverage, colors }: { title: string; value: string; detail?: string; input: Record<string, string | number | boolean>; coverage: Coverage; colors: Colors }) {
  return <article style={{ background: colors.canvas, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 11 }}><p style={{ color: colors.muted, fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 800, margin: 0 }}>{title}</p><strong style={{ fontSize: 24, display: 'block', margin: '4px 0' }}>{value}</strong>{detail && <p style={{ color: colors.accent, fontSize: 12, fontWeight: 700, margin: '0 0 8px' }}>{detail}</p>}<div style={{ fontSize: 12, display: 'grid', gap: 3 }}>{Object.entries(input).map(([name, item]) => <span key={name}><span style={{ color: colors.muted }}>{pretty(name)}: </span>{String(item)}</span>)}</div>{coverage.outsideNumericRanges.length > 0 && <p style={caution}>Outside training range: {coverage.outsideNumericRanges.join(', ')}</p>}{coverage.unseenCategoricalValues.length > 0 && <p style={caution}>Unseen category: {coverage.unseenCategoricalValues.join(', ')}</p>}</article>;
}

function MetricTable({ rows, colors }: { rows: string[][]; colors: Colors }) {
  return <div style={{ overflowX: 'auto' }}><table style={table}><thead><tr><th style={cell}>Check</th><th style={cell}>Seer</th><th style={cell}>Simple comparison</th><th style={cell}>Change</th></tr></thead><tbody>{rows.map(([label, current, reference, change]) => <tr key={label} style={{ borderTop: `1px solid ${colors.border}` }}><td style={{ ...cell, fontWeight: 800 }}>{label}</td><td style={cell}>{current}</td><td style={cell}>{reference}</td><td style={{ ...cell, color: change.startsWith('+') ? '#059669' : change.startsWith('-') ? '#dc2626' : colors.muted }}>{change}</td></tr>)}</tbody></table></div>;
}

function ConfusionMatrix({ chart, colors }: { chart: ClassificationResult['charts']['confusionMatrix']; colors: Colors }) {
  const maximum = Math.max(...chart.values.flat(), 1);
  return <section style={panel(colors)}><h2 style={heading}>Where Seer agreed or disagreed</h2><p style={{ color: colors.muted, fontSize: 12, marginTop: -4 }}>Rows show what happened. Columns show what Seer estimated.</p><div style={{ display: 'grid', gridTemplateColumns: `72px repeat(${chart.labels.length}, minmax(45px, 1fr))`, gap: 3, fontSize: 12, textAlign: 'center' }}><span /><>{chart.labels.map((label) => <strong key={`head-${label}`} style={{ padding: 5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</strong>)}</>{chart.values.map((row, rowIndex) => <div key={chart.labels[rowIndex]} style={{ display: 'contents' }}><strong style={{ alignSelf: 'center', textAlign: 'right', paddingRight: 5 }}>{chart.labels[rowIndex]}</strong>{row.map((count, columnIndex) => <span key={`${rowIndex}-${columnIndex}`} style={{ background: `rgba(14, 165, 233, ${0.12 + 0.72 * count / maximum})`, borderRadius: 5, padding: 9, fontWeight: 800 }}>{count}</span>)}</div>)}</div></section>;
}

function Distribution({ values, colors }: { values: ClassificationResult['charts']['classDistribution']; colors: Colors }) {
  return <section style={panel(colors)}><h2 style={heading}>Class distribution</h2><div style={{ display: 'grid', gap: 12 }}>{values.map((value) => <div key={value.classLabel}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><strong>{value.classLabel}</strong><span style={{ color: colors.muted }}>{value.count} · {number(value.percentage)}%</span></div><div style={{ height: 10, background: colors.canvas, borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${value.percentage}%`, background: colors.accent, borderRadius: 999 }} /></div></div>)}</div></section>;
}

function Scatter({ title, points, xLabel, yLabel, diagonal = false, horizontalZero = false, colors }: { title: string; points: Array<{ x: number; y: number }>; xLabel: string; yLabel: string; diagonal?: boolean; horizontalZero?: boolean; colors: Colors }) {
  const width = 300; const height = 185; const pad = 30; const xs = points.map((point) => point.x); const ys = points.map((point) => point.y); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys, horizontalZero ? 0 : Infinity); const maxY = Math.max(...ys, horizontalZero ? 0 : -Infinity); const scale = (value: number, low: number, high: number, size: number) => low === high ? size / 2 : ((value - low) / (high - low)) * size; const pointX = (value: number) => pad + scale(value, minX, maxX, width - pad * 2); const pointY = (value: number) => height - pad - scale(value, minY, maxY, height - pad * 2);
  return <section style={panel(colors)}><h2 style={heading}>{title}</h2><svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title}><line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={colors.border} /><line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke={colors.border} />{diagonal && <line x1={pointX(Math.max(minX, minY))} y1={pointY(Math.max(minX, minY))} x2={pointX(Math.min(maxX, maxY))} y2={pointY(Math.min(maxX, maxY))} stroke={colors.muted} strokeDasharray="4 4" />}{horizontalZero && <line x1={pad} y1={pointY(0)} x2={width - pad} y2={pointY(0)} stroke={colors.muted} strokeDasharray="4 4" />}{points.map((point, index) => <circle key={index} cx={pointX(point.x)} cy={pointY(point.y)} r="2.5" fill={colors.accent} opacity="0.75" />)}<text x={width / 2} y={height - 5} fill={colors.muted} fontSize="10" textAnchor="middle">{xLabel}</text><text x="10" y={height / 2} fill={colors.muted} fontSize="10" textAnchor="middle" transform={`rotate(-90 10 ${height / 2})`}>{yLabel}</text></svg></section>;
}

function Warnings({ warnings, colors }: { warnings: string[]; colors: Colors }) { return warnings.length === 0 ? null : <section style={panel(colors)}><h2 style={heading}>Important limits</h2>{warnings.map((warning) => <p key={warning} style={{ background: colors.warning, borderRadius: 6, padding: '8px 10px', fontSize: 13, margin: '7px 0 0' }}>{warning}</p>)}</section>; }
function qualityLabel(quality: Quality) { return { useful_signal: { label: 'Useful signal', tone: '#059669', description: 'This estimate was meaningfully better than a simple answer based on the usual result.' }, weak_signal: { label: 'Some useful signal', tone: '#b45309', description: 'This estimate was a little better than the simple comparison, but the improvement is modest.' }, no_demonstrated_signal: { label: 'No clear signal', tone: '#dc2626', description: 'This estimate was not better than the simple comparison on the data we checked.' } }[quality]; }
function pretty(value: string) { return value.replace(/_/g, ' '); }
function palette(dark: boolean) { return { canvas: dark ? '#07111f' : '#f6f7f2', panel: dark ? '#0d1c2e' : '#ffffff', ink: dark ? '#e8eef8' : '#182333', muted: dark ? '#9aadc5' : '#627185', border: dark ? '#263c57' : '#d8dfd7', warning: dark ? '#40280d' : '#fff3dd', accent: dark ? '#38bdf8' : '#087ea4' }; }
type Colors = ReturnType<typeof palette>;
const heading = { fontSize: 15, margin: '0 0 10px', letterSpacing: '-0.01em' } as const;
const cell = { padding: '8px 6px', textAlign: 'left' } as const;
const table = { width: '100%', minWidth: 440, borderCollapse: 'collapse', fontSize: 13 } as const;
const cards = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 } as const;
const twoUp = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 } as const;
const caution = { color: '#b45309', fontSize: 12, margin: '8px 0 0' } as const;
function panel(colors: Colors) { return { background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 13, marginTop: 12 }; }
