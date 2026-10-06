import { supabase } from "../../lib/supabase";

import {
  ClockifyError,
  type ClockifyOperator,
  type ClockifyProject,
  type CustomerClockifyProject,
  type StartClockifyTimerInput,
  type StartClockifyTimerResult,
} from "./clockifyTypes";

async function invokeClockify<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } =
    await supabase.functions.invoke<T>(
      "clockify",
      { body },
    );

  if (error) {
    let message = error.message;
    let code: string | null = null;

    /*
     * La risposta della funzione contiene il
     * messaggio leggibile e l'eventuale codice.
     */
    if (
      "context" in error &&
      error.context instanceof Response
    ) {
      try {
        const payload = (await error.context
          .clone()
          .json()) as {
          error?: string;
          code?: string | null;
        };

        message = payload.error ?? message;
        code = payload.code ?? null;
      } catch {
        // Manteniamo il messaggio originale.
      }
    }

    throw new ClockifyError(message, code);
  }

  if (!data) {
    throw new ClockifyError(
      "L'integrazione Clockify non ha restituito una risposta.",
    );
  }

  return data;
}

export async function getClockifyOperators(): Promise<
  ClockifyOperator[]
> {
  const { operators } = await invokeClockify<{
    operators: ClockifyOperator[];
  }>({
    action: "list-operators",
  });

  return operators;
}

export async function addClockifyOperator(
  apiKey: string,
): Promise<ClockifyOperator[]> {
  const { operators } = await invokeClockify<{
    operators: ClockifyOperator[];
  }>({
    action: "add-operator",
    apiKey,
  });

  return operators;
}

export async function removeClockifyOperator(
  operatorId: string,
): Promise<ClockifyOperator[]> {
  const { operators } = await invokeClockify<{
    operators: ClockifyOperator[];
  }>({
    action: "remove-operator",
    operatorId,
  });

  return operators;
}

export async function getClockifyProjects(): Promise<
  ClockifyProject[]
> {
  const { projects } = await invokeClockify<{
    projects: ClockifyProject[];
  }>({
    action: "list-projects",
  });

  return projects;
}

export function startClockifyTimer(
  input: StartClockifyTimerInput,
): Promise<StartClockifyTimerResult> {
  return invokeClockify<StartClockifyTimerResult>({
    action: "start-timer",
    ...input,
  });
}

export async function stopClockifyTimer(
  noteId: string,
): Promise<void> {
  await invokeClockify<{ stopped: boolean }>({
    action: "stop-timer",
    noteId,
  });
}

export async function syncClockifyTimers(): Promise<number> {
  const { updated } = await invokeClockify<{
    updated: number;
  }>({
    action: "sync-timers",
  });

  return updated;
}

export async function getCustomerClockifyProjects(): Promise<
  CustomerClockifyProject[]
> {
  const { data, error } = await supabase
    .from("customer_clockify_projects")
    .select("customer_id, project_id, project_name");

  if (error) {
    console.error(
      "Errore recupero progetti Clockify dei clienti:",
      error,
    );

    throw error;
  }

  return (
    (data as CustomerClockifyProject[] | null) ?? []
  );
}

export async function setCustomerClockifyProject(
  customerId: string,
  project: ClockifyProject | null,
): Promise<void> {
  const { error } =
    project === null
      ? await supabase
          .from("customer_clockify_projects")
          .delete()
          .eq("customer_id", customerId)
      : await supabase
          .from("customer_clockify_projects")
          .upsert(
            {
              customer_id: customerId,
              project_id: project.id,
              project_name: project.name,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: "customer_id",
            },
          );

  if (error) {
    console.error(
      "Errore aggiornamento progetto Clockify del cliente:",
      error,
    );

    throw error;
  }
}
