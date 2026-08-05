"use client";

import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";
import BulkConfirmAccessoryBar from "@/components/BulkConfirmAccessoryBar";

export default function AccessoryConfirmTable({
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
      emptyText="目前沒有待確認案件"
      minWidth={720}
      selectable
      renderBulkActions={(selectedIds, clearSelection) => (
        <BulkConfirmAccessoryBar selectedIds={selectedIds} onDone={clearSelection} />
      )}
    />
  );
}
