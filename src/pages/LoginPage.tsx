import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../features/auth/authService";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    try {
      setIsSubmitting(true);

      await loginUser({
        email,
        password,
      });

      navigate("/accesso", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Accesso non riuscito.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card__header">
          <span className="auth-card__eyebrow">
            Sistema Messaggistica
          </span>

          <h1>Bentornato</h1>

          <p>Accedi per visualizzare la tua conversazione.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              required
            />
          </label>

          {errorMessage && (
            <p className="auth-message auth-message--error">
              {errorMessage}
            </p>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Accesso..." : "Accedi"}
          </button>
        </form>

        <p className="auth-card__footer">
          Non hai un account?{" "}
          <Link to="/registrazione">Registrati</Link>
        </p>
      </section>
    </main>
  );
}