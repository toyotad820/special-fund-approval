"use client";

import SortableCaseTable, { type CaseRowData } from "@/components/SortableCaseTable";
import BulkApproveBar from "@/components/BulkApproveBar";

export default function QueueTable({ rows }: { rows: CaseRowData[] }) {
  return (
    <SortableCaseTable
      rows={rows}
      emptyText="沒有案件"
      selectable
      renderBulkActions={(selectedIds, clearSelection) => (
        <BulkApproveBar selectedIds={selectedIds} onDone={clearSelection} />
      )}
    />
  );
}
