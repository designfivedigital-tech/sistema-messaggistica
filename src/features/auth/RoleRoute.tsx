import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";
import type { AppRole } from "./profileTypes";

type RoleRouteProps = {
  allowedRole: AppRole;
  children: ReactNode;
};

export default function RoleRoute({
  allowedRole,
  children,
}: RoleRouteProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError,
  } = useProfile(isAuthenticated);

  if (isAuthLoading || isProfileLoading) {
    return (
      <main className="loading-page">
        <p>Caricamento...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isError || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== allowedRole) {
    return <Navigate to="/accesso" replace />;
  }

  return children;
}