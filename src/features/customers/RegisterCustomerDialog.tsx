import { useState } from "react";
import type { FormEvent } from "react";

import {
  CUSTOMER_CATEGORIES,
  isCustomerCategory,
  type CustomerCategory,
} from "./customerCategory";
import type { RegisterCustomerResult } from "./registerCustomerService";
import { useRegisterCustomer } from "./useRegisterCustomer";

type RegisterCustomerDialogProps = {
  onClose: () => void;
};

const MIN_PASSWORD_LENGTH = 8;
const GENERATED_PASSWORD_LENGTH = 12;

/*
 * Senza caratteri ambigui (0/O, 1/l/I), così
 * la password si può dettare o trascrivere.
 */
const PASSWORD_ALPHABET =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generatePassword(): string {
  const randomValues = new Uint32Array(
    GENERATED_PASSWORD_LENGTH,
  );

  window.crypto.getRandomValues(randomValues);

  return Array.from(
    randomValues,
    (value) =>
      PASSWORD_ALPHABET[
        value % PASSWORD_ALPHABET.length
      ],
  ).join("");
}

export function RegisterCustomerDialog({
  onClose,
}: RegisterCustomerDialogProps) {
  const [displayName, setDisplayName] =
    useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState(
    generatePassword,
  );

  const [websiteUrl, setWebsiteUrl] = useState("");

  const [category, setCategory] =
    useState<CustomerCategory | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [result, setResult] =
    useState<RegisterCustomerResult | null>(null);

  const [copied, setCopied] = useState(false);

  const registerMutation = useRegisterCustomer();

  const isSaving = registerMutation.isPending;

  function handleClose() {
    if (isSaving) {
      return;
    }

    onClose();
  }

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

      setResult(
        await registerMutation.mutateAsync({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          websiteUrl: websiteUrl.trim(),
          category,
        }),
      );
    } catch (registerError) {
      setErrorMessage(
        registerError instanceof Error
          ? registerError.message
          : "Impossibile registrare il cliente.",
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
          aria-labelledby="register-customer-title"
        >
          <h2 id="register-customer-title">
            Cliente registrato
          </h2>

          <p>
            Comunica al cliente queste credenziali:
            la password non sarà più visibile dopo
            la chiusura.
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

          {result.warnings.length > 0 && (
            <p className="customer-category-dialog__error">
              Account creato, ma con qualche
              problema: {result.warnings.join("; ")}.
            </p>
          )}

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
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <form
        className="customer-category-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-customer-title"
        onSubmit={(event) =>
          void handleSubmit(event)
        }
      >
        <h2 id="register-customer-title">
          Registra cliente
        </h2>

        <label htmlFor="register-customer-name">
          Nome del cliente
        </label>

        <input
          id="register-customer-name"
          type="text"
          value={displayName}
          onChange={(event) =>
            setDisplayName(event.target.value)
          }
          autoComplete="off"
          required
          autoFocus
          disabled={isSaving}
        />

        <label htmlFor="register-customer-email">
          Email
        </label>

        <input
          id="register-customer-email"
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          autoComplete="off"
          required
          disabled={isSaving}
        />

        <label htmlFor="register-customer-password">
          Password
        </label>

        <div className="register-customer__password">
          <input
            id="register-customer-password"
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

        <label htmlFor="register-customer-website">
          Sito web (facoltativo)
        </label>

        <input
          id="register-customer-website"
          type="text"
          inputMode="url"
          value={websiteUrl}
          onChange={(event) =>
            setWebsiteUrl(event.target.value)
          }
          placeholder="esempio.it"
          autoComplete="off"
          disabled={isSaving}
        />

        <label htmlFor="register-customer-category">
          Categoria (facoltativa)
        </label>

        <select
          id="register-customer-category"
          value={category ?? ""}
          onChange={(event) =>
            setCategory(
              isCustomerCategory(event.target.value)
                ? event.target.value
                : null,
            )
          }
          disabled={isSaving}
        >
          <option value="">Nessuna categoria</option>

          {CUSTOMER_CATEGORIES.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        {errorMessage && (
          <p className="customer-category-dialog__error">
            {errorMessage}
          </p>
        )}

        <div className="customer-category-dialog__actions">
          <button
            type="button"
            className="customer-category-dialog__cancel"
            onClick={handleClose}
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
              ? "Registrazione..."
              : "Registra cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
