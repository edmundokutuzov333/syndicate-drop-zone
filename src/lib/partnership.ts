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

export async function submitPartnershipRequest(input: PartnershipRequest): Promise<void> {
  const parsed = PartnershipRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const { url, key } = getPublicSupabaseConfig();

  const response = await fetch(url + "/rest/v1/partnership_requests", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: parsed.data.name,
      company: parsed.data.company,
      contact: parsed.data.contact,
      partnership_type: parsed.data.partnershipType,
      budget: parsed.data.budget ?? "",
      message: parsed.data.message,
    }),
  });

  if (!response.ok) {
    console.error("Partnership proposal submission failed:", response.status);
    throw new Error("Não foi possível enviar a proposta. Tente novamente.");
  }
}
