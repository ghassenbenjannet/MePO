import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Ticket, TicketCreate } from "../types/domain";

export function useTickets(opts: { spaceId?: string; topicId?: string } = {}) {
  const { spaceId, topicId } = opts;
  const params = topicId
    ? `?topic_id=${topicId}`
    : spaceId
      ? `?space_id=${spaceId}`
      : "";
  const queryKey = topicId ? ["tickets", "topic", topicId] : spaceId ? ["tickets", "space", spaceId] : ["tickets"];
  return useQuery<Ticket[]>({
    queryKey,
    queryFn: () => api.get<Ticket[]>(`/api/tickets${params}`),
    enabled: !!(spaceId || topicId),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TicketCreate) => api.post<Ticket>("/api/tickets", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Ticket> & { id: string }) =>
      api.patch<Ticket>(`/api/tickets/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/tickets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}
