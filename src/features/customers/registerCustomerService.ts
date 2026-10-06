import { supabase } from "../../lib/supabase";

import type { CustomerCategory } from "./customerCategory";

export type RegisterCustomerInput = {
  displayName: string;
  email: string;
  password: string;
  websiteUrl: string;
  category: CustomerCategory | null;
};

export type RegisterCustomerResult = {
  customerId: string;
  email: string;

  /* Passaggi secondari non riusciti. */
  warnings: string[];
};

const GENERATED_PASSWORD_LENGTH = 12;

/*
 * Senza caratteri ambigui (0/O, 1/l/I), così
 * la password si può dettare o trascrivere.
 */
const PASSWORD_ALPHABET =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export const MIN_PASSWORD_LENGTH = 8;

export function generatePassword(): string {
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

export function registerCustomer(
  input: RegisterCustomerInput,
): Promise<RegisterCustomerResult> {
  return invokeCreateCustomer(input);
}

export function resetCustomerPassword(
  customerId: string,
  password: string,
): Promise<RegisterCustomerResult> {
  return invokeCreateCustomer({
    action: "reset-password",
    customerId,
    password,
  });
}

async function invokeCreateCustomer(
  body: Record<string, unknown>,
): Promise<RegisterCustomerResult> {
  const { data, error } =
    await supabase.functions.invoke<RegisterCustomerResult>(
      "create-customer",
      { body },
    );

  if (error) {
    let message = error.message;

    if (
      "context" in error &&
      error.context instanceof Response
    ) {
      try {
        const payload = (await error.context
          .clone()
          .json()) as { error?: string };

        message = payload.error ?? message;
      } catch {
        // Manteniamo il messaggio originale.
      }
    }

    throw new Error(message);
  }

  if (!data) {
    throw new Error(
      "La registrazione non ha restituito una risposta.",
    );
  }

  return data;
}
