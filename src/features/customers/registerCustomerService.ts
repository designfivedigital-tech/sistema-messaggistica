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

export async function registerCustomer(
  input: RegisterCustomerInput,
): Promise<RegisterCustomerResult> {
  const { data, error } =
    await supabase.functions.invoke<RegisterCustomerResult>(
      "create-customer",
      { body: input },
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
