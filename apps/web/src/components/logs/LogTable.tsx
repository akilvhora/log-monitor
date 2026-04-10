import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { useRef } from "react";
import type { LogEntry } from "@log-monitor/shared";
import { LogLevelBadge } from "./LogLevelBadge";
import { useUIStore } from "@/stores/uiStore";
import { useLogs } from "@/hooks/useLogs";
import { Loader2 } from "lucide-react";

const columnHelper = createColumnHelper<LogEntry>();

const columns = [
  columnHelper.accessor("timestamp", {
    header: "Time",
    size: 155,
    cell: (info) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {format(new Date(info.getValue()), "MM-dd HH:mm:ss")}
      </span>
    ),
  }),
  columnHelper.accessor("level", {
    header: "Level",
    size: 72,
    cell: (info) => <LogLevelBadge level={info.getValue()} />,
  }),
  columnHelper.accessor("service", {
    header: "Service",
    size: 155,
    cell: (info) => <span className="text-primary">{info.getValue()}</span>,
  }),
  columnHelper.accessor("message", {
    header: "Message",
    cell: (info) => (
      <span className="truncate block max-w-[560px]">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("host", {
    header: "Host",
    size: 90,
    cell: (info) => <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>,
  }),
];

const ROW_HEIGHT = 34;

export function LogTable() {
  const { data, isLoading, isFetching, isError } = useLogs(500);
  const { openDrawer } = useUIStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? totalHeight - virtualRows[virtualRows.length - 1].end
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" /> Loading logs...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        Failed to load logs. Is the API server running?
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {isFetching && !isLoading && (
        <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground bg-muted/40 border-b border-border">
          <Loader2 size={11} className="animate-spin" /> Updating…
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-card border-b border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    style={{ width: h.getSize() }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && <tr><td style={{ height: paddingTop }} /></tr>}
            {virtualRows.map((vr) => {
              const row = rows[vr.index];
              return (
                <tr
                  key={row.id}
                  style={{ height: ROW_HEIGHT }}
                  className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => openDrawer(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1.5 overflow-hidden" style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && <tr><td style={{ height: paddingBottom }} /></tr>}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No logs match the current filters.
          </div>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border shrink-0">
          Showing {data.data.length.toLocaleString()} of {data.total.toLocaleString()} logs
        </div>
      )}
    </div>
  );
}
