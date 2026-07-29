import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../features/auth/ProtectedRoute";
import RoleRoute from "../features/auth/RoleRoute";
import ProfilePage from "../pages/ProfilePage";
import AuthRedirectPage from "../pages/AuthRedirectPage";
import CompanyDashboardPage from "../pages/CompanyDashboardPage";
import CustomerChatPage from "../pages/CustomerChatPage";
import LoginPage from "../pages/LoginPage";
import NotFoundPage from "../pages/NotFoundPage";
import RegisterPage from "../pages/RegisterPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/accesso" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/registrazione" element={<RegisterPage />} />

      <Route
        path="/accesso"
        element={
          <ProtectedRoute>
            <AuthRedirectPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <RoleRoute allowedRole="customer">
            <CustomerChatPage />
          </RoleRoute>
        }
      />

      <Route
        path="/azienda"
        element={
          <RoleRoute allowedRole="company">
            <CompanyDashboardPage />
          </RoleRoute>
        }
      />
      <Route
        path="/profilo"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}