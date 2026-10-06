import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  generatePassword,
  MIN_PASSWORD_LENGTH,
  resetCustomerPassword,
  type RegisterCustomerResult,
} from "./registerCustomerService";

type ResetCustomerPasswordDialogProps = {
  customerId: string;
  customerName: string;
  onClose: () => void;
};

export function ResetCustomerPasswordDialog({
  customerId,
  customerName,
  onClose,
}: ResetCustomerPasswordDialogProps) {
  const [password, setPassword] = useState(
    generatePassword,
  );

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [result, setResult] =
    useState<RegisterCustomerResult | null>(null);

  const [copied, setCopied] = useState(false);

  const resetMutation = useMutation({
    mutationFn: () =>
      resetCustomerPassword(customerId, password),
  });

  const isSaving = resetMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri.`,
      );

      return;
    }

    try {
      setErrorMessage(null);
      setResult(await resetMutation.mutateAsync());
    } catch (resetError) {
      setErrorMessage(
        resetError instanceof Error
          ? resetError.message
          : "Impossibile reimpostare la password.",
      );
    }
  }

  async function handleCopyCredentials() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `Email: ${result.email}\nPassword: ${password}`,
      );

      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (result) {
    return (
      <div
        className="customer-category-dialog"
        role="presentation"
      >
        <div
          className="customer-category-dialog__card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-title"
        >
          <h2 id="reset-password-title">
            Password reimpostata
          </h2>

          <p>
            Comunica a{" "}
            <strong>{customerName}</strong> le nuove
            credenziali: la password non sarà più
            visibile dopo la chiusura.
          </p>

          <dl className="register-customer__credentials">
            <div>
              <dt>Email</dt>
              <dd>{result.email}</dd>
            </div>

            <div>
              <dt>Password</dt>
              <dd>{password}</dd>
            </div>
          </dl>

          <div className="customer-category-dialog__actions">
            <button
              type="button"
              className="customer-category-dialog__cancel"
              onClick={() =>
                void handleCopyCredentials()
              }
            >
              {copied
                ? "Copiate ✓"
                : "Copia credenziali"}
            </button>

            <button
              type="button"
              className="customer-category-dialog__confirm"
              onClick={onClose}
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="customer-category-dialog"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSaving
        ) {
          onClose();
        }
      }}
    >
      <form
        className="customer-category-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        onSubmit={(event) =>
          void handleSubmit(event)
        }
      >
        <h2 id="reset-password-title">
          Reimposta password
        </h2>

        <p>
          La password attuale di{" "}
          <strong>{customerName}</strong> smetterà
          di funzionare.
        </p>

        <label htmlFor="reset-password-value">
          Nuova password
        </label>

        <div className="register-customer__password">
          <input
            id="reset-password-value"
            type="text"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete="off"
            minLength={MIN_PASSWORD_LENGTH}
            required
            disabled={isSaving}
          />

          <button
            type="button"
            onClick={() =>
              setPassword(generatePassword())
            }
            disabled={isSaving}
          >
            Genera
          </button>
        </div>

        {errorMessage && (
          <p className="customer-category-dialog__error">
            {errorMessage}
          </p>
        )}

        <div className="customer-category-dialog__actions">
          <button
            type="button"
            className="customer-category-dialog__cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Annulla
          </button>

          <button
            type="submit"
            className="customer-category-dialog__confirm"
            disabled={isSaving}
          >
            {isSaving
              ? "Salvataggio..."
              : "Reimposta password"}
          </button>
        </div>
      </form>
    </div>
  );
}
