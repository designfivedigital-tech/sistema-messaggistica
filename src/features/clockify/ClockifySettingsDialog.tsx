import { useState } from "react";

import {
  useAddClockifyOperator,
  useClockifyOperators,
  useRemoveClockifyOperator,
} from "./useClockify";

type ClockifySettingsDialogProps = {
  onClose: () => void;
};

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  return error instanceof Error
    ? error.message
    : fallback;
}

export function ClockifySettingsDialog({
  onClose,
}: ClockifySettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const {
    data: operators = [],
    isLoading,
    isError,
    error,
  } = useClockifyOperators();

  const addOperatorMutation =
    useAddClockifyOperator();

  const removeOperatorMutation =
    useRemoveClockifyOperator();

  const isBusy =
    addOperatorMutation.isPending ||
    removeOperatorMutation.isPending;

  async function handleAddOperator() {
    try {
      setErrorMessage(null);

      await addOperatorMutation.mutateAsync(
        apiKey.trim(),
      );

      setApiKey("");
    } catch (addError) {
      setErrorMessage(
        getErrorMessage(
          addError,
          "Impossibile collegare l'operatore.",
        ),
      );
    }
  }

  async function handleRemoveOperator(
    operatorId: string,
  ) {
    try {
      setErrorMessage(null);

      await removeOperatorMutation.mutateAsync(
        operatorId,
      );
    } catch (removeError) {
      setErrorMessage(
        getErrorMessage(
          removeError,
          "Impossibile rimuovere l'operatore.",
        ),
      );
    }
  }

  return (
    <div
      className="customer-category-dialog"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isBusy
        ) {
          onClose();
        }
      }}
    >
      <div
        className="customer-category-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clockify-settings-title"
      >
        <h2 id="clockify-settings-title">
          Operatori Clockify
        </h2>

        <p>
          Ogni operatore collega una volta la
          propria chiave API: i timer avviati
          dalle note verranno registrati a suo
          nome.
        </p>

        {isLoading && (
          <p>Caricamento operatori...</p>
        )}

        {isError && (
          <p className="customer-category-dialog__error">
            {getErrorMessage(
              error,
              "Impossibile leggere gli operatori.",
            )}
          </p>
        )}

        {!isLoading &&
          !isError &&
          operators.length === 0 && (
            <p>Nessun operatore collegato.</p>
          )}

        {operators.length > 0 && (
          <ul className="clockify-settings__operators">
            {operators.map((operator) => (
              <li key={operator.id}>
                <span>
                  <strong>{operator.name}</strong>

                  {operator.email && (
                    <small>{operator.email}</small>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    void handleRemoveOperator(
                      operator.id,
                    )
                  }
                  disabled={isBusy}
                >
                  Rimuovi
                </button>
              </li>
            ))}
          </ul>
        )}

        <label htmlFor="clockify-api-key">
          Chiave API dell'operatore
        </label>

        <input
          id="clockify-api-key"
          type="password"
          value={apiKey}
          onChange={(event) =>
            setApiKey(event.target.value)
          }
          placeholder="Incolla la chiave API di Clockify"
          autoComplete="off"
          disabled={isBusy}
        />

        <p className="customer-note-dialog__hint">
          Si trova su Clockify in Preferenze →
          Avanzate → Chiave API.
        </p>

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
            disabled={isBusy}
          >
            Chiudi
          </button>

          <button
            type="button"
            className="customer-category-dialog__confirm"
            onClick={() => void handleAddOperator()}
            disabled={
              isBusy || apiKey.trim().length === 0
            }
          >
            {addOperatorMutation.isPending
              ? "Collegamento..."
              : "Collega operatore"}
          </button>
        </div>
      </div>
    </div>
  );
}
