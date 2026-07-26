'use client';

import { useState } from 'react';
import { useMaxHeight, useWidgetSDK, type CallToolResponse } from '@nitrostack/widgets';
import {
  autoGrid,
  autoGridStyle,
  buttonPrimary,
  buttonQuiet,
  cx,
  Field,
  Frame,
  Loading,
  Masthead,
  Note,
  Panel,
  Tag,
  TagRow,
} from '@/design/primitives';

interface PlanData {
  reviewToken: string;
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
  const maxHeight = useMaxHeight();
  const { isReady, getToolOutput, callTool, sendFollowUpMessage } = useWidgetSDK();
  const data = getToolOutput<PlanData>();
  const [status, setStatus] = useState<'ready' | 'approving' | 'approved' | 'rejected' | 'error'>('ready');
  const [rejectionReason, setRejectionReason] = useState('');

  if (!isReady || !data) {
    return <Loading>Preparing the plan…</Loading>;
  }

  const approve = async () => {
    setStatus('approving');
    try {
      const confirmation = await callTool('confirm_analysis_plan', { reviewToken: data.reviewToken });
      await callTool('run_analysis', { executionToken: executionTokenFrom(confirmation) });
      setStatus('approved');
    } catch {
      setStatus('error');
    }
  };

  const reject = () => {
    const reason = rejectionReason.trim() || 'Please create a new plan. I want to change the question, the information used, or the details for the estimate.';
    setStatus('rejected');
    sendFollowUpMessage(`I reject this Seer analysis plan. ${reason}`);
  };

  const { plan } = data;

  return (
    <Frame maxHeight={maxHeight}>
      <Masthead
        label="Plan awaiting your approval"
        title={plan.question}
        subtitle={`Seer will ${plan.taskType === 'regression' ? 'estimate a number' : 'choose a category'} for ${plan.targetColumn.replace(/_/g, ' ')}. Nothing runs until you approve it.`}
        aside={<Tag tone="signal">expires {new Date(data.expiresAt).toLocaleTimeString()}</Tag>}
      />

      <Panel title="What Seer will use">
        <div className={autoGrid} style={autoGridStyle(160)}>
          <Field label="Dataset" value={plan.datasetId.replace(/-/g, ' ')} />
          <Field label="Estimating" value={plan.targetColumn} />
          <Field label="How we check it" value={`${plan.split.trainingPercent}% learn · ${plan.split.testPercent}% check`} />
          <Field label="Usable rows" value={`${plan.rows.usable} of ${plan.rows.dataset}`} />
        </div>
        <div className="mt-3">
          <TagRow label="Information it will look at" values={plan.featureColumns} />
        </div>
      </Panel>

      <div className={cx(autoGrid, 'mt-3')} style={autoGridStyle(260)}>
        <Panel title="How the data is prepared" flush>
          {plan.preprocessing.numeric.length > 0 && (
            <>
              <TagRow label="Number columns" values={plan.preprocessing.numeric} />
              <p className="text-small text-muted mt-1 mb-3">
                Missing numbers are filled using a typical value, then numbers are put on a comparable scale.
              </p>
            </>
          )}
          {plan.preprocessing.categorical.length > 0 && (
            <>
              <TagRow label="Choice columns" values={plan.preprocessing.categorical} />
              <p className="text-small text-muted mt-1 mb-0">
                Missing choices are filled with the most common choice, then changed into a form Seer can use.
              </p>
            </>
          )}
        </Panel>

        <Panel title="Details for this estimate" flush>
          {plan.predictionRows.map((row, index) => (
            <div key={index} className={cx(index > 0 && 'border-t border-rule pt-2 mt-2')}>
              {plan.predictionRows.length > 1 && (
                <div className="font-mono tabular text-micro text-muted mb-1">Row {index + 1}</div>
              )}
              <div className="grid gap-1">
                {Object.entries(row).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2 text-small">
                    <span className="text-muted truncate">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono tabular font-medium whitespace-nowrap">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Panel>
      </div>

      {plan.excludedColumns.length > 0 && (
        <Panel title="Left out on purpose">
          <div className="grid gap-2">
            {plan.excludedColumns.map((column) => (
              <div key={column.name} className="flex flex-wrap items-baseline gap-2">
                <Tag tone="muted">{column.name}</Tag>
                <span className="text-small text-muted">{column.reason}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {[...plan.assumptions, ...plan.warnings].map((message) => <Note key={message}>{message}</Note>)}

      {status === 'approved' ? (
        <Panel accent="signal">
          <strong className="font-strong">Your estimate is ready.</strong>
          <span className="text-muted"> Review what it means, how reliable it was, and its important limits.</span>
        </Panel>
      ) : status === 'rejected' ? (
        <Panel accent="caution">
          <strong className="font-strong">Plan rejected.</strong>
          <span className="text-muted"> Tell Seer what you want to change, and it will prepare a new plan.</span>
        </Panel>
      ) : (
        <Panel accent="signal" title="Your approval">
          <p className="text-small text-muted mt-0 mb-3">
            If you approve, Seer will first check that this plan and the data have not changed. It will then learn from
            the data and give an explained estimate. It cannot run without your approval.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={approve} disabled={status === 'approving'} className={buttonPrimary}>
              {status === 'approving' ? 'Confirming and running…' : 'Approve and run analysis'}
            </button>
            <button type="button" onClick={reject} className={buttonQuiet}>Reject plan</button>
          </div>
          {status === 'error' && (
            <p className="text-small text-alert mt-2 mb-0">
              Approval could not be verified. Create a new plan and try again.
            </p>
          )}
          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Optional: say why you are rejecting this plan"
            className="mt-3 w-full min-h-[52px] resize-y rounded-md border border-rule bg-sunken text-ink p-2 text-small font-ui"
          />
        </Panel>
      )}
    </Frame>
  );
}

/**
 * A tool call resolves to the host's response envelope, not the tool's payload:
 * the approved plan arrives as structuredContent, or as a JSON result string.
 */
function executionTokenFrom(response: CallToolResponse): string {
  if (response.isError) {
    throw new Error('Seer could not confirm the analysis plan.');
  }
  const payload = (response.structuredContent ?? parseJson(response.result)) as { executionToken?: unknown } | undefined;
  if (typeof payload?.executionToken !== 'string' || !payload.executionToken) {
    throw new Error('Seer did not return an execution token for the approved plan.');
  }
  return payload.executionToken;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
