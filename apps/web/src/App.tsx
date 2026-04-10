import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PermissionGate } from "./components/auth/PermissionGate";
import { DashboardPage } from "./pages/DashboardPage";
import { LogsPage } from "./pages/LogsPage";
import { AIPage } from "./pages/AIPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ImportPage } from "./pages/ImportPage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <PermissionGate page="dashboard">
              <DashboardPage />
            </PermissionGate>
          }
        />
        <Route
          path="logs"
          element={
            <PermissionGate page="logs">
              <LogsPage />
            </PermissionGate>
          }
        />
        <Route
          path="ai"
          element={
            <PermissionGate page="ai">
              <AIPage />
            </PermissionGate>
          }
        />
        <Route
          path="settings"
          element={
            <PermissionGate page="settings">
              <SettingsPage />
            </PermissionGate>
          }
        />
        <Route path="admin/users" element={<UsersPage />} />
        <Route path="import" element={
          <PermissionGate page="import"><ImportPage /></PermissionGate>
        } />
        <Route path="403" element={<ForbiddenPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
