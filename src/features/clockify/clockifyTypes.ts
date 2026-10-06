export type ClockifyOperator = {
  id: string;
  name: string;
  email: string | null;
};

export type ClockifyProject = {
  id: string;
  name: string;
};

export type CustomerClockifyProject = {
  customer_id: string;
  project_id: string;
  project_name: string;
};

export type StartClockifyTimerInput = {
  noteId: string;
  operatorId: string;

  /*
   * Da indicare solo quando il progetto non
   * viene trovato in automatico dal nome cliente.
   */
  projectId?: string | null;
};

export type StartClockifyTimerResult = {
  projectName: string;
  stoppedPreviousDescription: string | null;
};

/*
 * Errore restituito dalla edge function, con
 * un codice utile per gestire i casi previsti
 * (ad esempio "project-not-found").
 */
export class ClockifyError extends Error {
  code: string | null;

  constructor(
    message: string,
    code: string | null = null,
  ) {
    super(message);
    this.name = "ClockifyError";
    this.code = code;
  }
}

export const CLOCKIFY_TRACKER_URL =
  "https://app.clockify.me/tracker";

export function getClockifyProjectUrl(
  projectId: string,
): string {
  return `https://app.clockify.me/projects/${projectId}/edit`;
}

export function formatDuration(
  totalSeconds: number,
): string {
  const totalMinutes = Math.round(
    totalSeconds / 60,
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0
    ? `${hours}h`
    : `${hours}h ${minutes}m`;
}
