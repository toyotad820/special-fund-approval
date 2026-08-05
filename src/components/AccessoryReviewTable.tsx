"use client";

import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";
import BulkApproveAccessoryBar from "@/components/BulkApproveAccessoryBar";

export default function AccessoryReviewTable({
  columns,
  rows,
}: {
  columns: SortCol[];
  rows: SortRow[];
}) {
  return (
    <SortableTable
      columns={columns}
      rows={rows}
      emptyText="目前沒有待審核案件"
      minWidth={720}
      selectable
      renderBulkActions={(selectedIds, clearSelection) => (
        <BulkApproveAccessoryBar selectedIds={selectedIds} onDone={clearSelection} />
      )}
    />
  );
}
