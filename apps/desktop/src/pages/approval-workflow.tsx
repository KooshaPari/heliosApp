/**
 * Approval Workflow Management Page
 */

import { createSignal, onMount } from "solid-js";
import { ApprovalPanel } from "../components/approval/ApprovalPanel.tsx";
import { ApprovalStatus } from "../types/approval.ts";
import type { ApprovalRequest, ApprovalWorkflow } from "../types/approval.ts";

export function ApprovalWorkflowPage() {
  const [requests, setRequests] = createSignal<ApprovalRequest[]>([]);
  const [workflow, setWorkflow] = createSignal<ApprovalWorkflow | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    setRequests([]);
    setWorkflow({
      userId: "current-user",
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
    });
    setLoading(false);
  });

  const handleApprove = (id: string) => {
    setRequests(requests().map(r => (r.id === id ? { ...r, status: ApprovalStatus.Approved } : r)));
  };

  const handleReject = (id: string, reason: string) => {
    setRequests(
      requests().map(r =>
        r.id === id ? { ...r, status: "rejected" as const, rejectedReason: reason } : r
      )
    );
  };

  return (
    <div class="approval-workflow-page">
      <div class="page-header">
        <h1>Approvals</h1>
      </div>
      <ApprovalPanel
        requests={requests()}
        workflow={workflow()}
        loading={loading()}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
