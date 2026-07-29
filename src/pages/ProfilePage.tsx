import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  uploadCurrentUserAvatar,
} from "../features/auth/profileService";
import { useAuth } from "../features/auth/useAuth";
import { useProfile } from "../features/auth/useProfile";
import { useUpdateProfile } from "../features/auth/useUpdateProfile";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

function normalizeWebsiteUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue =
    /^https?:\/\//i.test(trimmedValue)
      ? trimmedValue
      : `https://${trimmedValue}`;

  try {
    return new URL(normalizedValue).toString();
  } catch {
    throw new Error(
      "Inserisci un indirizzo web valido.",
    );
  }
}

export default function ProfilePage() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useProfile(Boolean(user));

  const updateProfileMutation =
    useUpdateProfile();

  const [displayName, setDisplayName] =
    useState("");

  const [websiteUrl, setWebsiteUrl] =
    useState("");

  const [selectedAvatar, setSelectedAvatar] =
    useState<File | null>(null);

  const [avatarPreview, setAvatarPreview] =
    useState<string | null>(null);

  const [formError, setFormError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setDisplayName(profile.display_name);
    setWebsiteUrl(profile.website_url ?? "");
    setAvatarPreview(profile.avatar_url);
  }, [profile]);

  useEffect(() => {
    return () => {
      if (
        avatarPreview &&
        avatarPreview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function handleBack() {
    if (profile?.role === "company") {
      navigate("/azienda");
      return;
    }

    navigate("/chat");
  }

  function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ?? null;

    event.target.value = "";

    if (!file) {
      return;
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setFormError(
        "Puoi caricare soltanto immagini JPG, PNG o WebP.",
      );
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setFormError(
        "L’immagine non può superare 2 MB.",
      );
      return;
    }

    if (
      avatarPreview &&
      avatarPreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(avatarPreview);
    }

    setSelectedAvatar(file);
    setAvatarPreview(
      URL.createObjectURL(file),
    );
    setFormError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedDisplayName =
      displayName.trim();

    if (!normalizedDisplayName) {
      setFormError(
        "Inserisci un nome visualizzato.",
      );
      return;
    }

    if (normalizedDisplayName.length > 80) {
      setFormError(
        "Il nome non può superare 80 caratteri.",
      );
      return;
    }

    try {
      setFormError(null);
      setSuccessMessage(null);

      const normalizedWebsiteUrl =
        normalizeWebsiteUrl(websiteUrl);

      let uploadedAvatarUrl:
        | string
        | undefined;

      if (selectedAvatar) {
        uploadedAvatarUrl =
          await uploadCurrentUserAvatar(
            selectedAvatar,
          );
      }

      await updateProfileMutation.mutateAsync({
        displayName: normalizedDisplayName,
        websiteUrl: normalizedWebsiteUrl,
        avatarUrl: uploadedAvatarUrl,
      });

      setSelectedAvatar(null);

      if (uploadedAvatarUrl) {
        setAvatarPreview(uploadedAvatarUrl);
      }

      setWebsiteUrl(
        normalizedWebsiteUrl ?? "",
      );

      setSuccessMessage(
        "Profilo aggiornato correttamente.",
      );
    } catch (submitError) {
      console.error(
        "Errore aggiornamento profilo:",
        submitError,
      );

      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Impossibile aggiornare il profilo.",
      );
    }
  }

  if (isLoading) {
    return (
      <main className="profile-page profile-page--state">
        <p>Caricamento profilo...</p>
      </main>
    );
  }

  if (isError || !profile) {
    return (
      <main className="profile-page profile-page--state">
        <h1>Profilo non disponibile</h1>

        <p>
          {error instanceof Error
            ? error.message
            : "Impossibile recuperare il profilo."}
        </p>

        <button
          type="button"
          onClick={handleBack}
        >
          Torna indietro
        </button>
      </main>
    );
  }

  const isSaving =
    updateProfileMutation.isPending;

  const profileInitial =
    displayName
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  return (
    <main className="profile-page">
      <section className="profile-card">
        <header className="profile-card__header">
          <button
            type="button"
            className="profile-card__back"
            onClick={handleBack}
            aria-label="Torna alla chat"
          >
            ←
          </button>

          <div>
            <span className="profile-card__eyebrow">
              Account
            </span>

            <h1>Il tuo profilo</h1>

            <p>
              Personalizza il nome, l’avatar e il
              riferimento al tuo sito web.
            </p>
          </div>
        </header>

        <form
          className="profile-form"
          onSubmit={handleSubmit}
        >
          <div className="profile-avatar">
            <div className="profile-avatar__image">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar del profilo"
                />
              ) : (
                <span>{profileInitial}</span>
              )}
            </div>

            <div className="profile-avatar__content">
              <strong>Immagine profilo</strong>

              <span>
                JPG, PNG o WebP. Massimo 2 MB.
              </span>

              <label className="profile-avatar__button">
                Scegli immagine

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={isSaving}
                />
              </label>

              {selectedAvatar && (
                <small>
                  Immagine selezionata:{" "}
                  {selectedAvatar.name}
                </small>
              )}
            </div>
          </div>

          <div className="profile-form__fields">
            <label>
              <span>Nome visualizzato</span>

              <input
                type="text"
                value={displayName}
                onChange={(event) =>
                  setDisplayName(
                    event.target.value,
                  )
                }
                maxLength={80}
                autoComplete="name"
                disabled={isSaving}
                required
              />

              <small>
                Questo nome verrà mostrato nella
                chat.
              </small>
            </label>

            <label>
              <span>Sito web</span>

              <input
                type="text"
                value={websiteUrl}
                onChange={(event) =>
                  setWebsiteUrl(
                    event.target.value,
                  )
                }
                placeholder="https://nomesito.it"
                autoComplete="url"
                disabled={isSaving}
              />

              <small>
                Sarà visibile all’azienda nella
                conversazione.
              </small>
            </label>
          </div>

          <div className="profile-form__protected">
            <strong>
              Email e password
            </strong>

            <p>
              Non vengono modificate da questa
              pagina.
            </p>
          </div>

          {formError && (
            <p
              className="profile-form__message profile-form__message--error"
              role="alert"
            >
              {formError}
            </p>
          )}

          {successMessage && (
            <p
              className="profile-form__message profile-form__message--success"
              role="status"
            >
              {successMessage}
            </p>
          )}

          <div className="profile-form__actions">
            <button
              type="button"
              className="profile-form__cancel"
              onClick={handleBack}
              disabled={isSaving}
            >
              Annulla
            </button>

            <button
              type="submit"
              className="profile-form__save"
              disabled={isSaving}
            >
              {isSaving
                ? "Salvataggio..."
                : "Salva modifiche"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}