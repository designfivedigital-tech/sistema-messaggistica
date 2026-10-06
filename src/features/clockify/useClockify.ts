import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addClockifyOperator,
  getClockifyOperators,
  getClockifyProjects,
  getCustomerClockifyProjects,
  removeClockifyOperator,
  setCustomerClockifyProject,
  startClockifyTimer,
  stopClockifyTimer,
  syncClockifyTimers,
} from "./clockifyService";
import type { ClockifyProject } from "./clockifyTypes";

const clockifyKeys = {
  operators: ["clockify", "operators"] as const,
  projects: ["clockify", "projects"] as const,
  customerProjects: [
    "clockify",
    "customer-projects",
  ] as const,
  sync: ["clockify", "sync"] as const,
};

const customerNotesKey = ["customer-notes"] as const;

export function useClockifyOperators() {
  return useQuery({
    queryKey: clockifyKeys.operators,
    queryFn: getClockifyOperators,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useAddClockifyOperator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addClockifyOperator,

    onSuccess: (operators) => {
      queryClient.setQueryData(
        clockifyKeys.operators,
        operators,
      );
    },
  });
}

export function useRemoveClockifyOperator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeClockifyOperator,

    onSuccess: (operators) => {
      queryClient.setQueryData(
        clockifyKeys.operators,
        operators,
      );
    },
  });
}

export function useClockifyProjects(
  enabled: boolean,
) {
  return useQuery({
    queryKey: clockifyKeys.projects,
    queryFn: getClockifyProjects,
    staleTime: 5 * 60_000,
    retry: false,
    enabled,
  });
}

export function useCustomerClockifyProjects() {
  return useQuery({
    queryKey: clockifyKeys.customerProjects,
    queryFn: getCustomerClockifyProjects,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useSetCustomerClockifyProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      project,
    }: {
      customerId: string;
      project: ClockifyProject | null;
    }) =>
      setCustomerClockifyProject(
        customerId,
        project,
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: clockifyKeys.customerProjects,
      });
    },
  });
}

export function useStartClockifyTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startClockifyTimer,

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: customerNotesKey,
        }),
        queryClient.invalidateQueries({
          queryKey: clockifyKeys.customerProjects,
        }),
      ]);
    },
  });
}

export function useStopClockifyTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopClockifyTimer,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerNotesKey,
      });
    },
  });
}

/*
 * Allinea i timer fermati direttamente da
 * Clockify. Va attivato solo se nell'app
 * risultano timer ancora in corso.
 */
export function useClockifyTimerSync(
  enabled: boolean,
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: clockifyKeys.sync,

    queryFn: async () => {
      const updated = await syncClockifyTimers();

      if (updated > 0) {
        await queryClient.invalidateQueries({
          queryKey: customerNotesKey,
        });
      }

      return updated;
    },

    enabled,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    retry: false,
  });
}
