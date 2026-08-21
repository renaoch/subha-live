// File: lib/api/agency.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface Agency {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  commissionRate: number;
  totalHosts: number;
  monthlyRevenue: number;
  createdAt: string;
}

interface RawAgency {
  id: string;
  name: string;
  code: string;
  ownerId?: string;
  owner_id?: string;
  commissionRate?: number | string;
  commission_rate?: number | string;
  totalHosts?: number | string;
  total_hosts?: number | string;
  monthlyRevenue?: number | string;
  monthly_revenue?: number | string;
  createdAt?: string;
  created_at?: string;
}

function normalizeAgency(raw: RawAgency): Agency {
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    ownerId: raw.ownerId ?? raw.owner_id ?? "",
    commissionRate: Number(raw.commissionRate ?? raw.commission_rate ?? 0),
    totalHosts: Number(raw.totalHosts ?? raw.total_hosts ?? 0),
    monthlyRevenue: Number(raw.monthlyRevenue ?? raw.monthly_revenue ?? 0),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

class AgencyApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new AgencyApiError(
      body?.message || body?.error || `Request failed (${res.status})`,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const agencyApi = {
  async list(): Promise<Agency[]> {
    const data = await request<RawAgency[]>("/api/v1/agency");
    return data.map(normalizeAgency);
  },

  async me(): Promise<{ agency: Agency | null }> {
    const data = await request<{ agency: RawAgency | null }>(
      "/api/v1/agency/me",
    );
    return { agency: data.agency ? normalizeAgency(data.agency) : null };
  },

  async get(id: string): Promise<Agency> {
    const data = await request<RawAgency>(`/api/v1/agency/${id}`);
    return normalizeAgency(data);
  },

  async join(agencyId: string): Promise<void> {
    await request<void>(`/api/v1/agency/${agencyId}/join`, {
      method: "POST",
    });
  },

  async leave(): Promise<void> {
    await request<void>("/api/v1/agency/leave", { method: "POST" });
  },
};