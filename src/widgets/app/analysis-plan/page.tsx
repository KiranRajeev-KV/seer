'use client';

import { useState } from 'react';
import { useMaxHeight, useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface PlanData {
  planToken: string;
  expiresAt: string;
  plan: {
    datasetId: string;
    question: string;
    targetColumn: string;
    featureColumns: string[];
    taskType: 'regression' | 'classification';
    predictionRows: Array<Record<string, string | number | boolean>>;
    preprocessing: {
      numeric: string[];
      categorical: string[];
      numericImputer: string;
      numericScaler: string;
      categoricalImputer: string;
      categoricalEncoder: string;
    };
    rows: { dataset: number; missingTarget: number; usable: number };
    excludedColumns: Array<{ name: string; reason: string }>;
    assumptions: string[];
    warnings: string[];
    split: { trainingPercent: number; testPercent: number; randomState: number };
  };
}

export const dynamic = 'force-dynamic';

export default function AnalysisPlanWidget() {
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const { isReady, getToolOutput, callTool, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<PlanData>();
  const [status, setStatus] = useState<'ready' | 'approving' | 'approved' | 'error'>('ready');
  const [rejectionReason, setRejectionReason] = useState('');
  const dark = theme === 'dark';
  const colors = {
    canvas: dark ? '#07111f' : '#f5f8fc',
    panel: dark ? '#0e1c2f' : '#ffffff',
    ink: dark ? '#e7eef8' : '#132238',
    muted: dark ? '#9db0c8' : '#64748b',
    border: dark ? '#20354f' : '#dbe5ef',
    warning: dark ? '#44240c' : '#fff4df',
    success: dark ? '#113a2d' : '#e8f8ef',
  };

  if (!isReady || !data) {
    return <div style={{ padding: 24, color: colors.ink }}>Preparing analysis plan…</div>;
  }

  const approve = async () => {
    setStatus('approving');
    try {
      await callTool('run_analysis', { planToken: data.planToken });
      setStatus('approved');
    } catch {
      setStatus('error');
    }
  };

  const reject = () => {
    const reason = rejectionReason.trim() || 'Please revise the proposed target, features, task type, or prediction inputs.';
    sendFollowUpMessage(`I do not approve this Seer analysis plan. ${reason}`);
  };

  return (
    <main style={{ background: colors.canvas, color: colors.ink, minHeight: 400, maxHeight: maxHeight || 680, overflow: 'auto', padding: 16, boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div>
          <p style={{ color: '#0ea5e9', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', margin: 0 }}>SEER / ANALYSIS PLAN</p>
          <h1 style={{ fontSize: 22, margin: '5px 0 3px' }}>Review before execution</h1>
          <p style={{ color: colors.muted, margin: 0, fontSize: 13 }}>This signed plan expires {new Date(data.expiresAt).toLocaleTimeString()}.</p>
        </div>
        <Badge text={data.plan.taskType} tone={data.plan.taskType === 'regression' ? '#0ea5e9' : '#8b5cf6'} />
      </header>

      <Section title="Question and selected data" colors={colors}>
        <p style={{ margin: '0 0 10px', fontWeight: 650 }}>{data.plan.question}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
          <Fact label="Dataset" value={data.plan.datasetId.replace(/-/g, ' ')} colors={colors} />
          <Fact label="Target" value={data.plan.targetColumn} colors={colors} />
          <Fact label="Split" value={`${data.plan.split.trainingPercent}/${data.plan.split.testPercent} · seed ${data.plan.split.randomState}`} colors={colors} />
          <Fact label="Usable rows" value={`${data.plan.rows.usable} of ${data.plan.rows.dataset}`} colors={colors} />
        </div>
        <LabelledList label="Features" values={data.plan.featureColumns} colors={colors} />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
        <Section title="Preprocessing" colors={colors}>
          <LabelledList label="Numeric" values={data.plan.preprocessing.numeric} colors={colors} />
          <p style={{ color: colors.muted, fontSize: 12, margin: '8px 0 12px' }}>{data.plan.preprocessing.numericImputer} imputation → {data.plan.preprocessing.numericScaler} scaling</p>
          <LabelledList label="Categorical" values={data.plan.preprocessing.categorical} colors={colors} />
          <p style={{ color: colors.muted, fontSize: 12, margin: '8px 0 0' }}>{data.plan.preprocessing.categoricalImputer} imputation → {data.plan.preprocessing.categoricalEncoder} encoding</p>
        </Section>
        <Section title="Prediction inputs" colors={colors}>
          {data.plan.predictionRows.map((row, index) => <div key={index} style={{ borderTop: index ? `1px solid ${colors.border}` : undefined, paddingTop: index ? 9 : 0, marginTop: index ? 9 : 0 }}>
            <strong style={{ fontSize: 12 }}>Row {index + 1}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '5px 10px', marginTop: 6, fontSize: 12 }}>
              {Object.entries(row).map(([key, value]) => <span key={key} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${key}: ${value}`}><span style={{ color: colors.muted }}>{key}: </span>{String(value)}</span>)}
            </div>
          </div>)}
        </Section>
      </div>

      {data.plan.excludedColumns.length > 0 && <Section title="Excluded columns" colors={colors}>
        {data.plan.excludedColumns.map((column) => <p key={column.name} style={{ fontSize: 13, margin: '7px 0' }}><strong>{column.name}</strong><span style={{ color: colors.muted }}> — {column.reason}</span></p>)}
      </Section>}

      {[...data.plan.assumptions, ...data.plan.warnings].map((message) => <div key={message} style={{ background: colors.warning, border: `1px solid ${dark ? '#6b3b12' : '#fed7aa'}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, marginTop: 10 }}>{message}</div>)}

      {status === 'approved' ? <div style={{ background: colors.success, border: `1px solid ${dark ? '#1c7053' : '#86efac'}`, borderRadius: 9, padding: 12, marginTop: 12, fontWeight: 700 }}>Analysis completed. Review the results widget for model quality, predictions, and limitations.</div> : <Section title="Your approval" colors={colors}>
        <p style={{ color: colors.muted, fontSize: 13, marginTop: 0 }}>Approval verifies the signed plan, confirms the packaged dataset is unchanged, then trains and evaluates the selected model.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={approve} disabled={status === 'approving'} style={buttonStyle('#0284c7', '#ffffff')}>{status === 'approving' ? 'Running analysis…' : 'Approve and run analysis'}</button>
          <button type="button" onClick={reject} style={buttonStyle(dark ? '#253b55' : '#e2e8f0', colors.ink)}>Request changes</button>
        </div>
        {status === 'error' && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 0 }}>Approval could not be verified. Create a new plan and try again.</p>}
        <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Optional: say what should change" style={{ marginTop: 10, width: '100%', minHeight: 52, resize: 'vertical', border: `1px solid ${colors.border}`, borderRadius: 7, background: colors.canvas, color: colors.ink, padding: 8, boxSizing: 'border-box', font: 'inherit', fontSize: 13 }} />
      </Section>}
    </main>
  );
}

function Section({ title, colors, children }: { title: string; colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning' | 'success', string>; children: React.ReactNode }) {
  return <section style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 13, marginTop: 12 }}><h2 style={{ fontSize: 14, margin: '0 0 11px' }}>{title}</h2>{children}</section>;
}

function Fact({ label, value, colors }: { label: string; value: string; colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning' | 'success', string> }) {
  return <div style={{ background: colors.canvas, borderRadius: 8, padding: 8 }}><div style={{ color: colors.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div><div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div></div>;
}

function LabelledList({ label, values, colors }: { label: string; values: string[]; colors: Record<'canvas' | 'panel' | 'ink' | 'muted' | 'border' | 'warning' | 'success', string> }) {
  return <div style={{ marginTop: 11 }}><div style={{ color: colors.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{values.map((value) => <span key={value} style={{ border: `1px solid ${colors.border}`, borderRadius: 999, padding: '3px 7px', fontSize: 12 }}>{value}</span>)}</div></div>;
}

function Badge({ text, tone }: { text: string; tone: string }) {
  return <span style={{ color: tone, background: `${tone}1c`, borderRadius: 999, padding: '5px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{text}</span>;
}

function buttonStyle(background: string, color: string) {
  return { background, color, border: 'none', borderRadius: 7, padding: '8px 11px', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as const;
}
