import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/*
 * Integrazione Clockify.
 *
 * Tutte le chiamate a Clockify passano da qui:
 * le chiavi API degli operatori restano nel
 * database e non raggiungono mai il browser.
 */

const CLOCKIFY_API_URL =
  "https://api.clockify.me/api/v1";

const MAX_DESCRIPTION_LENGTH = 3000;
const MAX_NOTES_PER_SYNC = 25;

// deno-lint-ignore no-explicit-any
type AdminClient = any;

type OperatorRow = {
  id: string;
  clockify_user_id: string;
  name: string;
  email: string | null;
  workspace_id: string;
  api_key: string;
};

type NoteRow = {
  id: string;
  customer_id: string;
  body: string;
  clockify_user_id: string | null;
  clockify_time_entry_id: string | null;
  timer_started_at: string | null;
  timer_stopped_at: string | null;
};

type ClockifyUser = {
  id: string;
  name: string;
  email: string;
  activeWorkspace: string;
  defaultWorkspace: string;
};

type ClockifyProject = {
  id: string;
  name: string;
  archived?: boolean;
};

type ClockifyTimeEntry = {
  id: string;
  description: string;
  projectId: string | null;
  timeInterval: {
    start: string;
    end: string | null;
  };
};

class HttpError extends Error {
  status: number;
  code: string | null;

  constructor(
    status: number,
    message: string,
    code: string | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function requireString(
  value: unknown,
  name: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new HttpError(
      400,
      `${name} è obbligatorio`,
    );
  }

  return value.trim();
}

function optionalString(
  value: unknown,
): string | null {
  return typeof value === "string" &&
    value.trim().length > 0
    ? value.trim()
    : null;
}

async function clockifyRequest<T>(
  apiKey: string,
  path: string,
  init: {
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(
    `${CLOCKIFY_API_URL}${path}`,
    {
      method: init.method ?? "GET",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body:
        init.body === undefined
          ? undefined
          : JSON.stringify(init.body),
    },
  );

  if (!response.ok) {
    const details = await response
      .text()
      .catch(() => "");

    console.error("Clockify request failed", {
      path,
      status: response.status,
      details: details.slice(0, 500),
    });

    throw new HttpError(
      response.status === 401 ||
        response.status === 403
        ? 401
        : response.status === 404
          ? 404
          : 502,
      response.status === 401 ||
        response.status === 403
        ? "Clockify ha rifiutato la chiave API"
        : `Errore Clockify (${response.status})`,
      "clockify-error",
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

async function getOperator(
  admin: AdminClient,
  filter: {
    id?: string;
    clockifyUserId?: string;
  },
): Promise<OperatorRow> {
  let query = admin
    .from("clockify_operators")
    .select(
      "id,clockify_user_id,name,email,workspace_id,api_key",
    );

  query = filter.id
    ? query.eq("id", filter.id)
    : query.eq(
        "clockify_user_id",
        filter.clockifyUserId,
      );

  const { data, error } =
    await query.maybeSingle();

  if (error) {
    throw new HttpError(
      500,
      "Impossibile leggere l'operatore Clockify",
    );
  }

  if (!data) {
    throw new HttpError(
      404,
      "Operatore Clockify non trovato: ricollegalo dalle impostazioni",
      "operator-not-found",
    );
  }

  return data as OperatorRow;
}

async function getAnyOperator(
  admin: AdminClient,
): Promise<OperatorRow> {
  const { data, error } = await admin
    .from("clockify_operators")
    .select(
      "id,clockify_user_id,name,email,workspace_id,api_key",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new HttpError(
      500,
      "Impossibile leggere gli operatori Clockify",
    );
  }

  if (!data) {
    throw new HttpError(
      409,
      "Nessun operatore Clockify collegato",
      "no-operators",
    );
  }

  return data as OperatorRow;
}

async function getNote(
  admin: AdminClient,
  noteId: string,
): Promise<NoteRow> {
  const { data, error } = await admin
    .from("customer_notes")
    .select(
      "id,customer_id,body,clockify_user_id,clockify_time_entry_id,timer_started_at,timer_stopped_at",
    )
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    throw new HttpError(
      500,
      "Impossibile leggere la nota",
    );
  }

  if (!data) {
    throw new HttpError(404, "Nota non trovata");
  }

  return data as NoteRow;
}

function getDurationSeconds(
  start: string,
  end: string,
): number {
  return Math.max(
    0,
    Math.round(
      (new Date(end).getTime() -
        new Date(start).getTime()) /
        1000,
    ),
  );
}

/*
 * Registra sulla nota la chiusura del timer.
 */
async function finalizeNotesForEntry(
  admin: AdminClient,
  timeEntryId: string,
  start: string,
  end: string,
): Promise<void> {
  const { error } = await admin
    .from("customer_notes")
    .update({
      timer_started_at: start,
      timer_stopped_at: end,
      duration_seconds: getDurationSeconds(
        start,
        end,
      ),
    })
    .eq("clockify_time_entry_id", timeEntryId);

  if (error) {
    throw new HttpError(
      500,
      "Timer fermato, ma impossibile aggiornare la nota",
    );
  }
}

/*
 * Allinea una nota con timer aperto allo stato
 * reale su Clockify. Restituisce true se il
 * timer risulta chiuso.
 */
async function syncNoteTimer(
  admin: AdminClient,
  note: NoteRow,
  operator: OperatorRow,
): Promise<boolean> {
  if (!note.clockify_time_entry_id) {
    return true;
  }

  let entry: ClockifyTimeEntry;

  try {
    entry =
      await clockifyRequest<ClockifyTimeEntry>(
        operator.api_key,
        `/workspaces/${operator.workspace_id}/time-entries/${note.clockify_time_entry_id}`,
      );
  } catch (error) {
    /*
     * Registrazione eliminata su Clockify:
     * il timer viene chiuso senza durata.
     */
    if (
      error instanceof HttpError &&
      error.status === 404
    ) {
      const { error: updateError } = await admin
        .from("customer_notes")
        .update({
          timer_stopped_at:
            new Date().toISOString(),
          duration_seconds: 0,
        })
        .eq("id", note.id);

      if (updateError) {
        throw new HttpError(
          500,
          "Impossibile aggiornare la nota",
        );
      }

      return true;
    }

    throw error;
  }

  if (!entry.timeInterval.end) {
    return false;
  }

  await finalizeNotesForEntry(
    admin,
    entry.id,
    entry.timeInterval.start,
    entry.timeInterval.end,
  );

  return true;
}

async function stopRunningTimer(
  admin: AdminClient,
  operator: OperatorRow,
): Promise<ClockifyTimeEntry | null> {
  const running = await clockifyRequest<
    ClockifyTimeEntry[]
  >(
    operator.api_key,
    `/workspaces/${operator.workspace_id}/user/${operator.clockify_user_id}/time-entries?in-progress=true`,
  );

  const entry = running?.[0];

  if (!entry) {
    return null;
  }

  const end = new Date().toISOString();

  await clockifyRequest(
    operator.api_key,
    `/workspaces/${operator.workspace_id}/user/${operator.clockify_user_id}/time-entries`,
    {
      method: "PATCH",
      body: { end },
    },
  );

  await finalizeNotesForEntry(
    admin,
    entry.id,
    entry.timeInterval.start,
    end,
  );

  return entry;
}

async function listOperators(
  admin: AdminClient,
) {
  const { data, error } = await admin
    .from("clockify_operators")
    .select("id,name,email")
    .order("name", { ascending: true });

  if (error) {
    throw new HttpError(
      500,
      "Impossibile leggere gli operatori Clockify",
    );
  }

  return { operators: data ?? [] };
}

async function addOperator(
  admin: AdminClient,
  input: Record<string, unknown>,
) {
  const apiKey = requireString(
    input.apiKey,
    "apiKey",
  );

  const user =
    await clockifyRequest<ClockifyUser>(
      apiKey,
      "/user",
    );

  const workspaceId =
    user.activeWorkspace ||
    user.defaultWorkspace;

  if (!workspaceId) {
    throw new HttpError(
      409,
      "L'utente Clockify non appartiene a nessun workspace",
    );
  }

  /*
   * Tutti gli operatori devono lavorare
   * sullo stesso workspace.
   */
  const { data: existing } = await admin
    .from("clockify_operators")
    .select("workspace_id,clockify_user_id")
    .neq("clockify_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (
    existing &&
    existing.workspace_id !== workspaceId
  ) {
    throw new HttpError(
      409,
      "Questa chiave appartiene a un workspace Clockify diverso da quello già collegato",
    );
  }

  const { error } = await admin
    .from("clockify_operators")
    .upsert(
      {
        clockify_user_id: user.id,
        name: user.name || user.email,
        email: user.email ?? null,
        workspace_id: workspaceId,
        api_key: apiKey,
      },
      {
        onConflict: "clockify_user_id",
      },
    );

  if (error) {
    throw new HttpError(
      500,
      "Impossibile salvare l'operatore Clockify",
    );
  }

  return listOperators(admin);
}

async function removeOperator(
  admin: AdminClient,
  input: Record<string, unknown>,
) {
  const operatorId = requireString(
    input.operatorId,
    "operatorId",
  );

  const { error } = await admin
    .from("clockify_operators")
    .delete()
    .eq("id", operatorId);

  if (error) {
    throw new HttpError(
      500,
      "Impossibile rimuovere l'operatore Clockify",
    );
  }

  return listOperators(admin);
}

async function listProjects(
  admin: AdminClient,
) {
  const operator = await getAnyOperator(admin);

  const projects = await clockifyRequest<
    ClockifyProject[]
  >(
    operator.api_key,
    `/workspaces/${operator.workspace_id}/projects?archived=false&page-size=1000&sort-column=NAME&sort-order=ASCENDING`,
  );

  return {
    projects: (projects ?? []).map((project) => ({
      id: project.id,
      name: project.name,
    })),
  };
}

/*
 * Trova il progetto Clockify del cliente:
 * abbinamento salvato, oppure progetto con
 * lo stesso nome del cliente.
 */
async function resolveProject(
  admin: AdminClient,
  operator: OperatorRow,
  customerId: string,
  requestedProjectId: string | null,
): Promise<{ id: string; name: string }> {
  let project: { id: string; name: string } | null =
    null;

  if (requestedProjectId) {
    const found =
      await clockifyRequest<ClockifyProject>(
        operator.api_key,
        `/workspaces/${operator.workspace_id}/projects/${requestedProjectId}`,
      );

    project = { id: found.id, name: found.name };
  } else {
    const { data: mapping } = await admin
      .from("customer_clockify_projects")
      .select("project_id,project_name")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (mapping) {
      return {
        id: mapping.project_id,
        name: mapping.project_name,
      };
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", customerId)
      .maybeSingle();

    const customerName =
      typeof profile?.display_name === "string"
        ? profile.display_name.trim()
        : "";

    if (customerName) {
      const candidates = await clockifyRequest<
        ClockifyProject[]
      >(
        operator.api_key,
        `/workspaces/${operator.workspace_id}/projects?archived=false&page-size=50&name=${encodeURIComponent(customerName)}`,
      );

      const match = (candidates ?? []).find(
        (candidate) =>
          candidate.name.trim().toLowerCase() ===
          customerName.toLowerCase(),
      );

      if (match) {
        project = {
          id: match.id,
          name: match.name,
        };
      }
    }
  }

  if (!project) {
    throw new HttpError(
      409,
      "Nessun progetto Clockify corrisponde a questo cliente: sceglilo dall'elenco",
      "project-not-found",
    );
  }

  const { error } = await admin
    .from("customer_clockify_projects")
    .upsert(
      {
        customer_id: customerId,
        project_id: project.id,
        project_name: project.name,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "customer_id",
      },
    );

  if (error) {
    console.warn(
      "Clockify project mapping not saved",
      { message: error.message },
    );
  }

  return project;
}

async function startTimer(
  admin: AdminClient,
  input: Record<string, unknown>,
) {
  const noteId = requireString(
    input.noteId,
    "noteId",
  );

  const operatorId = requireString(
    input.operatorId,
    "operatorId",
  );

  const note = await getNote(admin, noteId);

  if (note.clockify_time_entry_id) {
    throw new HttpError(
      409,
      "Per questa nota il timer è già stato avviato",
    );
  }

  const operator = await getOperator(admin, {
    id: operatorId,
  });

  const project = await resolveProject(
    admin,
    operator,
    note.customer_id,
    optionalString(input.projectId),
  );

  /*
   * Clockify ammette un solo timer attivo
   * per utente: quello precedente viene chiuso.
   */
  const stoppedEntry = await stopRunningTimer(
    admin,
    operator,
  );

  const start = new Date().toISOString();

  const entry =
    await clockifyRequest<ClockifyTimeEntry>(
      operator.api_key,
      `/workspaces/${operator.workspace_id}/time-entries`,
      {
        method: "POST",
        body: {
          start,
          description: note.body.slice(
            0,
            MAX_DESCRIPTION_LENGTH,
          ),
          projectId: project.id,
        },
      },
    );

  const { error } = await admin
    .from("customer_notes")
    .update({
      operator_name: operator.name,
      clockify_user_id:
        operator.clockify_user_id,
      clockify_time_entry_id: entry.id,
      clockify_project_id: project.id,
      timer_started_at: start,
      timer_stopped_at: null,
      duration_seconds: null,
    })
    .eq("id", note.id);

  if (error) {
    throw new HttpError(
      500,
      "Timer avviato su Clockify, ma impossibile aggiornare la nota",
    );
  }

  return {
    projectName: project.name,
    stoppedPreviousDescription: stoppedEntry
      ? stoppedEntry.description ||
        "senza descrizione"
      : null,
  };
}

async function stopTimer(
  admin: AdminClient,
  input: Record<string, unknown>,
) {
  const noteId = requireString(
    input.noteId,
    "noteId",
  );

  const note = await getNote(admin, noteId);

  if (
    !note.clockify_time_entry_id ||
    !note.clockify_user_id
  ) {
    throw new HttpError(
      409,
      "Questa nota non ha un timer",
    );
  }

  if (note.timer_stopped_at) {
    return { stopped: true };
  }

  const operator = await getOperator(admin, {
    clockifyUserId: note.clockify_user_id,
  });

  /*
   * Se il timer è già stato fermato da
   * Clockify basta allineare la nota.
   */
  const alreadyClosed = await syncNoteTimer(
    admin,
    note,
    operator,
  );

  if (!alreadyClosed) {
    await stopRunningTimer(admin, operator);
  }

  return { stopped: true };
}

/*
 * Chiude nell'app i timer che sono stati
 * fermati direttamente da Clockify.
 */
async function syncTimers(admin: AdminClient) {
  const { data, error } = await admin
    .from("customer_notes")
    .select(
      "id,customer_id,body,clockify_user_id,clockify_time_entry_id,timer_started_at,timer_stopped_at",
    )
    .not("clockify_time_entry_id", "is", null)
    .is("timer_stopped_at", null)
    .limit(MAX_NOTES_PER_SYNC);

  if (error) {
    throw new HttpError(
      500,
      "Impossibile leggere i timer aperti",
    );
  }

  let updated = 0;

  for (const note of (data ?? []) as NoteRow[]) {
    if (!note.clockify_user_id) {
      continue;
    }

    try {
      const operator = await getOperator(admin, {
        clockifyUserId: note.clockify_user_id,
      });

      if (
        await syncNoteTimer(admin, note, operator)
      ) {
        updated += 1;
      }
    } catch (syncError) {
      console.warn("Clockify timer sync failed", {
        noteId: note.id,
        message:
          syncError instanceof Error
            ? syncError.message
            : "unknown",
      });
    }
  }

  return { updated };
}

export default {
  fetch: withSupabase(
    {
      auth: ["user"],
    },

    async (req, ctx) => {
      if (req.method !== "POST") {
        return jsonResponse(
          { error: "Method not allowed" },
          405,
        );
      }

      try {
        const callerUserId =
          typeof ctx.userClaims?.id === "string"
            ? ctx.userClaims.id
            : typeof ctx.jwtClaims?.sub ===
                "string"
              ? ctx.jwtClaims.sub
              : null;

        if (!callerUserId) {
          throw new HttpError(
            401,
            "Utente autenticato non riconosciuto",
          );
        }

        const admin = ctx.supabaseAdmin;

        const { data: profile } = await admin
          .from("profiles")
          .select("role")
          .eq("id", callerUserId)
          .maybeSingle();

        if (profile?.role !== "company") {
          throw new HttpError(
            403,
            "Operazione riservata all'azienda",
          );
        }

        let input: Record<string, unknown>;

        try {
          input = (await req.json()) as Record<
            string,
            unknown
          >;
        } catch {
          throw new HttpError(
            400,
            "Il corpo della richiesta non è JSON valido",
          );
        }

        const action = requireString(
          input?.action,
          "action",
        );

        switch (action) {
          case "list-operators":
            return jsonResponse(
              await listOperators(admin),
            );

          case "add-operator":
            return jsonResponse(
              await addOperator(admin, input),
            );

          case "remove-operator":
            return jsonResponse(
              await removeOperator(admin, input),
            );

          case "list-projects":
            return jsonResponse(
              await listProjects(admin),
            );

          case "start-timer":
            return jsonResponse(
              await startTimer(admin, input),
            );

          case "stop-timer":
            return jsonResponse(
              await stopTimer(admin, input),
            );

          case "sync-timers":
            return jsonResponse(
              await syncTimers(admin),
            );

          default:
            throw new HttpError(
              400,
              "Azione non riconosciuta",
            );
        }
      } catch (error) {
        if (error instanceof HttpError) {
          return jsonResponse(
            {
              error: error.message,
              code: error.code,
            },
            error.status,
          );
        }

        console.error("clockify failed", {
          message:
            error instanceof Error
              ? error.message
              : "unknown",
        });

        return jsonResponse(
          {
            error:
              "Errore imprevisto dell'integrazione Clockify",
          },
          500,
        );
      }
    },
  ),
};
