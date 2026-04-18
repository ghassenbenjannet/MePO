import { Skeleton } from "../ui/skeleton";
import { KANBAN_COLS } from "./kanban-types";

export function LoadingState() {
  return (
    <div className="kanban-board" aria-busy="true" aria-live="polite">
      {KANBAN_COLS.map((column) => (
        <section key={column.id} className="kanban-column">
          <div className="kanban-status-header">
            <div className="flex items-center gap-3">
              <Skeleton variant="circle" width={32} height={32} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="h-4 w-24" />
                <Skeleton variant="text" className="h-3 w-36" />
              </div>
            </div>
          </div>
          <div className="kanban-column-body">
            {[0, 1].map((index) => (
              <div key={index} className="kanban-card">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton variant="text" className="h-4 w-16" />
                    <Skeleton variant="text" className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton variant="title" className="h-5 w-11/12" />
                  <Skeleton variant="text" className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton variant="text" className="h-5 w-20 rounded-full" />
                    <Skeleton variant="text" className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton variant="text" className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
