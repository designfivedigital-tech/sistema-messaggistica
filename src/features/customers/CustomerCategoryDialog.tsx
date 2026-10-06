import { useState } from "react";

import {
  CUSTOMER_CATEGORIES,
  isCustomerCategory,
  type CustomerCategory,
} from "./customerCategory";
import { useSetCustomerCategory } from "./useCustomerCategories";

type CustomerCategoryDialogProps = {
  customerId: string;
  customerName: string;
  currentCategory: CustomerCategory | null;
  onClose: () => void;
};

export function CustomerCategoryDialog({
  customerId,
  customerName,
  currentCategory,
  onClose,
}: CustomerCategoryDialogProps) {
  const [search, setSearch] = useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<CustomerCategory | null>(
      currentCategory,
    );

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const setCategoryMutation =
    useSetCustomerCategory();

  const isSaving = setCategoryMutation.isPending;

  function filterCategories(value: string) {
    const normalizedSearch = value
      .trim()
      .toLocaleLowerCase("it-IT");

    if (normalizedSearch.length === 0) {
      return CUSTOMER_CATEGORIES;
    }

    return CUSTOMER_CATEGORIES.filter(
      (category) =>
        category.label
          .toLocaleLowerCase("it-IT")
          .includes(normalizedSearch),
    );
  }

  const filteredCategories =
    filterCategories(search);

  function handleSearchChange(value: string) {
    setSearch(value);

    /*
     * Se la categoria selezionata non rientra
     * più nei risultati, viene proposta la
     * prima categoria trovata.
     */
    const matches = filterCategories(value);

    const selectionIsVisible = matches.some(
      (category) =>
        category.value === selectedCategory,
    );

    if (
      value.trim().length > 0 &&
      !selectionIsVisible &&
      matches.length > 0
    ) {
      setSelectedCategory(matches[0].value);
    }
  }

  function handleClose() {
    if (isSaving) {
      return;
    }

    onClose();
  }

  async function handleSave() {
    try {
      setErrorMessage(null);

      await setCategoryMutation.mutateAsync({
        customerId,
        category: selectedCategory,
      });

      onClose();
    } catch (saveError) {
      console.error(
        "Impossibile assegnare la categoria:",
        saveError,
      );

      setErrorMessage(
        typeof saveError === "object" &&
          saveError !== null &&
          "message" in saveError
          ? String(saveError.message)
          : "Impossibile assegnare la categoria.",
      );
    }
  }

  const selectedIsVisible =
    selectedCategory === null ||
    filteredCategories.some(
      (category) =>
        category.value === selectedCategory,
    );

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
      <div
        className="customer-category-dialog__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-category-title"
      >
        <h2 id="customer-category-title">
          Associa a categoria
        </h2>

        <p>
          Scegli la tipologia di cliente per{" "}
          <strong>{customerName}</strong>.
        </p>

        <label htmlFor="customer-category-search">
          Cerca categoria
        </label>

        <input
          id="customer-category-search"
          type="search"
          value={search}
          onChange={(event) =>
            handleSearchChange(event.target.value)
          }
          placeholder="Cerca categoria..."
          autoComplete="off"
          disabled={isSaving}
        />

        <label htmlFor="customer-category-select">
          Categoria
        </label>

        <select
          id="customer-category-select"
          value={
            selectedIsVisible
              ? (selectedCategory ?? "")
              : ""
          }
          onChange={(event) =>
            setSelectedCategory(
              isCustomerCategory(event.target.value)
                ? event.target.value
                : null,
            )
          }
          disabled={isSaving}
        >
          <option value="">Nessuna categoria</option>

          {filteredCategories.map((category) => (
            <option
              key={category.value}
              value={category.value}
            >
              {category.label}
            </option>
          ))}
        </select>

        {filteredCategories.length === 0 && (
          <p className="customer-category-dialog__empty">
            Nessuna categoria trovata.
          </p>
        )}

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
            type="button"
            className="customer-category-dialog__confirm"
            onClick={() => void handleSave()}
            disabled={
              isSaving ||
              !selectedIsVisible ||
              selectedCategory === currentCategory
            }
          >
            {isSaving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
