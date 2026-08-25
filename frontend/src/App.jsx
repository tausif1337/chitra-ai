import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/ui/Toast";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { RegisterPage } from "./features/auth/RegisterPage";
import { GeneratorPage } from "./features/generator/GeneratorPage";
import { HistoryPage } from "./features/history/HistoryPage";
import { NotFoundPage } from "./features/NotFoundPage";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";

function ShellRoute({ children }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/"
                element={
                  <ShellRoute>
                    <GeneratorPage />
                  </ShellRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ShellRoute>
                    <HistoryPage />
                  </ShellRoute>
                }
              />
              <Route
                path="*"
                element={
                  <ShellRoute>
                    <NotFoundPage />
                  </ShellRoute>
                }
              />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
