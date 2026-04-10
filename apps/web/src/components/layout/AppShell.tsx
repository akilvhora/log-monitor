import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useUIStore } from "@/stores/uiStore";
import { LogDetailDrawer } from "../logs/LogDetailDrawer";

export function AppShell() {
  const { isDrawerOpen, selectedLog } = useUIStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
      {isDrawerOpen && selectedLog && <LogDetailDrawer log={selectedLog} />}
    </div>
  );
}
