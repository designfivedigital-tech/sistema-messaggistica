import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import { useProfile } from "../features/auth/useProfile";

export default function AuthRedirectPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError,
    error,
  } = useProfile(isAuthenticated);

  if (isAuthLoading || isProfileLoading) {
    return (
      <main className="loading-page">
        <p>Caricamento account...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isError) {
    return (
      <main>
        <h1>Errore account</h1>
        <p>
          {error instanceof Error
            ? error.message
            : "Impossibile recuperare il profilo."}
        </p>
      </main>
    );
  }

  if (profile?.role === "company") {
    return <Navigate to="/azienda" replace />;
  }

  return <Navigate to="/chat" replace />;
}