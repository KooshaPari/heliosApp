/**
 * ApprovalPanel.tsx
 * Displays pending approval requests and handles approval/rejection.
 */

import { For, createSignal } from "solid-js";
import type { ApprovalRequest } from "../../types/approval.ts";

interface ApprovalPanelProps {
  requests: ApprovalRequest[];
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, reason: string) => Promise<void>;
}

export const ApprovalPanel = (props: ApprovalPanelProps) => {
  const [rejectingId, setRejectingId] = createSignal<string | null>(null);
  const [rejectReason, setRejectReason] = createSignal("");

  const handleApprove = async (id: string) => {
    await props.onApprove(id);
  };

  const handleReject = async (id: string) => {
    if (!rejectReason()) return;
    await props.onReject(id, rejectReason());
    setRejectingId(null);
    setRejectReason("");
  };

  return (
    <div class="approval-panel p-4 bg-gray-900 text-white rounded-lg shadow-xl">
      <h2 class="text-xl font-bold mb-4">Pending Approvals</h2>
      <div class="space-y-4">
        <For each={props.requests}>
          {(request) => (
            <div class="p-3 border border-gray-700 rounded bg-gray-800">
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-medium">{request.title}</div>
                  <div class="text-sm text-gray-400">{request.description}</div>
                  <div class="mt-1 text-xs text-gray-500">
                    From: {request.requester} • {new Date(request.timestamp).toLocaleString()}
                  </div>
                </div>
                <div class="flex space-x-2">
                  <button
                    onClick={() => handleApprove(request.id)}
                    class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingId(request.id)}
                    class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {rejectingId() === request.id && (
                <div class="mt-3 pt-3 border-t border-gray-700">
                  <textarea
                    value={rejectReason()}
                    onInput={(e) => setRejectReason(e.currentTarget.value)}
                    placeholder="Reason for rejection..."
                    class="w-full p-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                    rows={2}
                  />
                  <div class="flex justify-end space-x-2 mt-2">
                    <button
                      onClick={() => setRejectingId(null)}
                      class="px-2 py-1 text-xs text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      disabled={!rejectReason()}
                      class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs disabled:opacity-50"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </For>
        {props.requests.length === 0 && (
          <div class="text-center py-8 text-gray-500">No pending approval requests</div>
        )}
      </div>
    </div>
  );
};
