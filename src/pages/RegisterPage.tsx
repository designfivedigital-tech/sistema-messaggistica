import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../features/auth/authService";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!displayName.trim()) {
      setErrorMessage("Inserisci il tuo nome.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("La password deve contenere almeno 8 caratteri.");
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage("Le password non coincidono.");
      return;
    }

    try {
      setIsSubmitting(true);

      await registerUser({
        displayName,
        email,
        password,
      });

      navigate("/accesso", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Registrazione non riuscita.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card__header">
          <span className="auth-card__eyebrow">Sistema Messaggistica</span>
          <h1>Crea il tuo account</h1>
          <p>Registrati per comunicare direttamente con l'azienda.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nome e cognome
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label>
            Conferma password
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(event) =>
                setPasswordConfirmation(event.target.value)
              }
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {errorMessage && (
            <p className="auth-message auth-message--error">
              {errorMessage}
            </p>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registrazione..." : "Registrati"}
          </button>
        </form>

        <p className="auth-card__footer">
          Hai già un account? <Link to="/login">Accedi</Link>
        </p>
      </section>
    </main>
  );
}