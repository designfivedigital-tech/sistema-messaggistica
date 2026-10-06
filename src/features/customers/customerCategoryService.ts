import { supabase } from "../../lib/supabase";

import {
  isCustomerCategory,
  type CustomerCategory,
  type CustomerCategoryAssignment,
} from "./customerCategory";

export async function getCustomerCategories(): Promise<
  CustomerCategoryAssignment[]
> {
  const { data, error } = await supabase
    .from("customer_categories")
    .select("customer_id, category");

  if (error) {
    console.error(
      "Errore recupero categorie clienti:",
      error,
    );

    throw error;
  }

  /*
   * Le categorie non più presenti nell'elenco
   * TypeScript vengono ignorate.
   */
  return (data ?? []).filter(
    (row): row is CustomerCategoryAssignment =>
      isCustomerCategory(row.category),
  );
}

export async function setCustomerCategory(
  customerId: string,
  category: CustomerCategory | null,
): Promise<void> {
  const { error } =
    category === null
      ? await supabase
          .from("customer_categories")
          .delete()
          .eq("customer_id", customerId)
      : await supabase
          .from("customer_categories")
          .upsert(
            {
              customer_id: customerId,
              category,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: "customer_id",
            },
          );

  if (error) {
    console.error(
      "Errore aggiornamento categoria cliente:",
      error,
    );

    throw error;
  }
}
