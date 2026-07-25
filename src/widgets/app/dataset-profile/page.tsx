'use client';

import { useMaxHeight, useTheme, useWidgetSDK } from '@nitrostack/widgets';

type ColumnType = 'boolean' | 'numeric' | 'categorical' | 'datetime' | 'text' | 'empty';

interface Frequency {
  value: string;
  count: number;
  percentage: number;
}

interface ProfileData {
  datasetId: string;
  dimensions: { rows: number; columns: number };
  columns: Array<{
    name: string;
    type: ColumnType;
    missingCount: number;
    missingPercent: number;
    uniqueCount: number;
    numericSummary: { min: number; max: number; mean: number; median: number } | null;
    categories: Frequency[];
  }>;
  duplicateRowCount: number;
  targetCandidates: string[];
  identifierCandidates: string[];
  constantColumns: string[];
  unsupportedColumns: Array<{ name: string; reason: string }>;
  warnings: string[];
  charts: {
    numericDistributions: Array<{ column: string; bins: Array<{ start: number; end: number; count: number }> }>;
    categoryFrequencies: Array<{ column: string; values: Frequency[] }>;
  };
}

const typeColor: Record<ColumnType, string> = {
  boolean: '#8b5cf6',
  numeric: '#0ea5e9',
  categorical: '#10b981',
  datetime: '#f59e0b',
  text: '#f97316',
  empty: '#94a3b8',
};

function number(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export const dynamic = 'force-dynamic';

export default function DatasetProfileWidget() {
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const { isReady, getToolOutput } = useWidgetSDK();
  const data = getToolOutput<ProfileData>();
  const dark = theme === 'dark';
  const colors = {
    canvas: dark ? '#07111f' : '#f5f8fc',
    panel: dark ? '#0e1c2f' : '#ffffff',
    ink: dark ? '#e7eef8' : '#132238',
    muted: dark ? '#9db0c8' : '#64748b',
    border: dark ? '#20354f' : '#dbe5ef',
    warning: dark ? '#44240c' : '#fff4df',
  };

  if (!isReady || !data) {
    return <div style={{ padding: 24, color: colors.ink }}>Preparing dataset profile…</div>;
  }

  const maxMissing = Math.max(1, ...data.columns.map((column) => column.missingCount));

  return (
    <main style={{
      background: colors.canvas,
      color: colors.ink,
      minHeight: 400,
      maxHeight: maxHeight || 680,
      overflow: 'auto',
      padding: 16,
      boxSizing: 'border-box',
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <p style={{ color: '#0ea5e9', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', margin: 0 }}>SEER / DATASET PROFILE</p>
          <h1 style={{ fontSize: 22, margin: '5px 0 3px' }}>{data.datasetId.replace(/-/g, ' ')}</h1>
          <p style={{ color: colors.muted, margin: 0, fontSize: 13 }}>Complete-file scan before an analysis plan is created.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Stat label="Rows" value={number(data.dimensions.rows)} colors={colors} />
          <Stat label="Columns" value={number(data.dimensions.columns)} colors={colors} />
          <Stat label="Duplicates" value={number(data.duplicateRowCount)} colors={colors} />
        </div>
      </header>

      {data.warnings.map((warning) => (
        <div key={warning} style={{ background: colors.warning, border: `1px solid ${dark ? '#6b3b12' : '#fed7aa'}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, marginBottom: 8 }}>
          {warning}
        </div>
      ))}

      <Section title="Column quality" colors={colors}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 660, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ color: colors.muted, textAlign: 'left' }}>
              <tr><th style={cellStyle}>Column</th><th style={cellStyle}>Type</th><th style={cellStyle}>Missing</th><th style={cellStyle}>Unique</th><th style={cellStyle}>Missing-value share</th></tr>
            </thead>
            <tbody>
              {data.columns.map((column) => (
                <tr key={column.name} style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>{column.name}</td>
                  <td style={cellStyle}><span style={{ background: `${typeColor[column.type]}22`, color: typeColor[column.type], borderRadius: 999, padding: '3px 7px', fontWeight: 700 }}>{column.type}</span></td>
                  <td style={cellStyle}>{number(column.missingCount)} · {column.missingPercent}%</td>
                  <td style={cellStyle}>{number(column.uniqueCount)}</td>
                  <td style={cellStyle}><div style={{ background: colors.border, borderRadius: 999, height: 7, width: 130 }}><div style={{ background: '#ef4444', borderRadius: 999, height: 7, width: `${(column.missingCount / maxMissing) * 100}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginTop: 12 }}>
        <CandidateList title="Eligible target candidates" values={data.targetCandidates} empty="No eligible targets found." colors={colors} />
        <CandidateList title="Identifier candidates" values={data.identifierCandidates} empty="No identifier-like columns found." colors={colors} />
        <CandidateList title="Excluded columns" values={[...data.constantColumns, ...data.unsupportedColumns.map((column) => column.name)]} empty="No columns excluded by profiling." colors={colors} />
      </div>

      <Section title="Numeric distributions" colors={colors}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {data.charts.numericDistributions.map((distribution) => {
            const maximum = Math.max(1, ...distribution.bins.map((bin) => bin.count));
            const summary = data.columns.find((column) => column.name === distribution.column)?.numericSummary;
            return <div key={distribution.column} style={{ border: `1px solid ${colors.border}`, borderRadius: 9, padding: 11 }}>
              <strong style={{ fontSize: 13 }}>{distribution.column}</strong>
              {summary && <p style={{ color: colors.muted, fontSize: 12, margin: '4px 0 10px' }}>median {number(summary.median)} · range {number(summary.min)}–{number(summary.max)}</p>}
              <div style={{ height: 76, display: 'flex', gap: 3, alignItems: 'end' }}>
                {distribution.bins.map((bin, index) => <div key={`${bin.start}-${index}`} title={`${number(bin.start)}–${number(bin.end)}: ${bin.count}`} style={{ background: '#0ea5e9', borderRadius: '3px 3px 0 0', flex: 1, minHeight: bin.count ? 4 : 0, height: `${(bin.count / maximum) * 100}%` }} />)}
              </div>
            </div>;
          })}
        </div>
      </Section>

      <Section title="Category frequencies" colors={colors}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {data.charts.categoryFrequencies.map((distribution) => <div key={distribution.column} style={{ border: `1px solid ${colors.border}`, borderRadius: 9, padding: 11 }}>
            <strong style={{ fontSize: 13 }}>{distribution.column}</strong>
            {distribution.values.slice(0, 5).map((value) => <div key={value.value} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 34px', gap: 7, alignItems: 'center', marginTop: 8, fontSize: 12 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.value}</span>
              <div style={{ background: colors.border, borderRadius: 999, height: 7 }}><div style={{ background: '#10b981', borderRadius: 999, height: 7, width: `${value.percentage}%` }} /></div>
              <span style={{ color: colors.muted, textAlign: 'right' }}>{value.percentage}%</span>
            </div>)}
          </div>)}
        </div>
      </Section>
    </main>
  );
}

const cellStyle = { padding: '9px 7px' } as const;

function Stat({ label, value, colors }: { label: string; value: string; colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning', string> }) {
  return <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 9, padding: '7px 9px', minWidth: 55 }}><div style={{ color: colors.muted, fontSize: 10, fontWeight: 700 }}>{label.toUpperCase()}</div><div style={{ fontWeight: 800, fontSize: 16 }}>{value}</div></div>;
}

function Section({ title, colors, children }: { title: string; colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning', string>; children: React.ReactNode }) {
  return <section style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 13, marginTop: 12 }}><h2 style={{ fontSize: 14, margin: '0 0 11px' }}>{title}</h2>{children}</section>;
}

function CandidateList({ title, values, empty, colors }: { title: string; values: string[]; empty: string; colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning', string> }) {
  return <section style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 13 }}><h2 style={{ fontSize: 13, margin: '0 0 8px' }}>{title}</h2>{values.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{values.map((value) => <span key={value} style={{ border: `1px solid ${colors.border}`, borderRadius: 999, padding: '4px 7px', fontSize: 12 }}>{value}</span>)}</div> : <p style={{ color: colors.muted, fontSize: 12, margin: 0 }}>{empty}</p>}</section>;
}
