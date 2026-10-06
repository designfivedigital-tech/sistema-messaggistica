/*
 * Tipologie di cliente assegnabili dalla dashboard
 * aziendale. Per aggiungere, rimuovere o rinominare
 * una categoria basta modificare questo elenco.
 */
export const CUSTOMER_CATEGORIES = [
  { value: "property_manager", label: "Property Manager" },
  { value: "extralberghiero", label: "Extralberghiero" },
  { value: "agriturismi", label: "Agriturismi" },
  { value: "industria", label: "Industria" },
  { value: "professioni", label: "Professioni" },
  { value: "motori", label: "Motori" },
  { value: "altro", label: "Altro" },
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
