/*
 * Tipologie di cliente assegnabili dalla dashboard
 * aziendale. Per aggiungere, rimuovere o rinominare
 * una categoria basta modificare questo elenco.
 */
export const CUSTOMER_CATEGORIES = [
  { value: "lead", label: "Potenziale cliente" },
  { value: "new", label: "Nuovo cliente" },
  { value: "active", label: "Cliente attivo" },
  { value: "vip", label: "Cliente VIP" },
  { value: "partner", label: "Partner" },
  { value: "former", label: "Ex cliente" },
] as const;

export type CustomerCategory =
  (typeof CUSTOMER_CATEGORIES)[number]["value"];

export type CustomerCategoryOption = {
  value: CustomerCategory;
  label: string;
};

export type CustomerCategoryAssignment = {
  customer_id: string;
  category: CustomerCategory;
};

export function isCustomerCategory(
  value: unknown,
): value is CustomerCategory {
  return CUSTOMER_CATEGORIES.some(
    (category) => category.value === value,
  );
}

export function getCustomerCategoryLabel(
  category: CustomerCategory,
): string {
  return (
    CUSTOMER_CATEGORIES.find(
      (option) => option.value === category,
    )?.label ?? category
  );
}
