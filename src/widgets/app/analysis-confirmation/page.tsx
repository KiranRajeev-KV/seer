'use client';

import { useMaxHeight, useWidgetSDK } from '@nitrostack/widgets';
import { Field, Frame, Loading, Masthead, Panel, Tag } from '@/design/primitives';

interface ConfirmationData {
  approved: true;
  expiresAt: string;
  plan: {
    datasetId: string;
    question: string;
    targetColumn: string;
    taskType: 'regression' | 'classification';
    rows: {
      usable: number;
    };
  };
}

export const dynamic = 'force-dynamic';

export default function AnalysisConfirmationWidget() {
  const maxHeight = useMaxHeight();
  const { isReady, getToolOutput } = useWidgetSDK();
  const data = getToolOutput<ConfirmationData>();

  if (!isReady || !data) {
    return <Loading>Checking your approval…</Loading>;
  }

  const { plan } = data;

  return (
    <Frame maxHeight={maxHeight}>
      <Masthead
        label="Approval recorded"
        title="This exact plan is ready to run"
        subtitle="Seer checked that the plan and its dataset have not changed since you reviewed them."
        aside={<Tag tone="signal">approved</Tag>}
      />

      <Panel accent="signal" title={plan.question}>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Dataset" value={plan.datasetId.replace(/-/g, ' ')} />
          <Field label="Estimating" value={plan.targetColumn.replace(/_/g, ' ')} />
          <Field label="Usable examples" value={String(plan.rows.usable)} />
        </div>
        <p className="text-small text-muted mt-3 mb-0">
          The analysis may now run using only the choices shown in the plan you approved.
        </p>
      </Panel>
    </Frame>
  );
}
