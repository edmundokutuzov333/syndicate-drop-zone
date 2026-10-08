import { z } from "zod";
import { getPublicSupabaseConfig } from "@/lib/supabase-public";

export const PartnershipRequestSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome.").max(120, "Nome demasiado longo."),
  company: z.string().trim().min(2, "Indique a empresa.").max(160, "Nome da empresa demasiado longo."),
  contact: z.string().trim().min(3, "Indique um contacto.").max(160, "Contacto demasiado longo."),
  partnershipType: z.string().trim().min(2, "Seleccione o tipo de parceria.").max(80),
  budget: z.string().trim().max(80).optional().default(""),
  message: z.string().trim().min(10, "Explique brevemente a proposta.").max(4000, "Mensagem demasiado longa."),
});

export type PartnershipRequest = z.infer<typeof PartnershipRequestSchema>;

type PartnershipInsertResult = { id: string };

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { url, key } = getPublicSupabaseConfig();
  const response = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || "Serviço de parcerias indisponível.");
  }

  return (await response.json()) as T;
}

export async function submitPartnershipRequest(input: PartnershipRequest): Promise<void> {
  const parsed = PartnershipRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  await rpc<PartnershipInsertResult>("submit_partnership_request", {
    p_name: parsed.data.name,
    p_company: parsed.data.company,
    p_contact: parsed.data.contact,
    p_partnership_type: parsed.data.partnershipType,
    p_budget: parsed.data.budget ?? "",
    p_message: parsed.data.message,
  });
}
