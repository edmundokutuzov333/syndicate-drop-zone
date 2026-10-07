import { z } from "zod";

export const PartnershipRequestSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome.").max(120, "Nome demasiado longo."),
  company: z.string().trim().min(2, "Indique a empresa.").max(160, "Nome da empresa demasiado longo."),
  contact: z.string().trim().min(3, "Indique um contacto.").max(160, "Contacto demasiado longo."),
  partnershipType: z.string().trim().min(2, "Seleccione o tipo de parceria.").max(80),
  budget: z.string().trim().min(1, "Indique o orçamento.").max(80),
  message: z.string().trim().min(10, "Explique brevemente a proposta.").max(4000, "Mensagem demasiado longa."),
});

export type PartnershipRequest = z.infer<typeof PartnershipRequestSchema>;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export async function submitPartnershipRequest(input: PartnershipRequest): Promise<void> {
  const parsed = PartnershipRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("O serviço de propostas não está configurado.");
  }

  const response = await fetch(SUPABASE_URL + "/rest/v1/partnership_requests", {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: parsed.data.name,
      company: parsed.data.company,
      contact: parsed.data.contact,
      partnership_type: parsed.data.partnershipType,
      budget: parsed.data.budget,
      message: parsed.data.message,
    }),
  });

  if (!response.ok) {
    let message = "Não foi possível enviar a proposta.";
    try {
      const payload = (await response.json()) as { message?: string; hint?: string };
      message = payload.message ?? payload.hint ?? message;
    } catch {
      // Keep the safe generic message.
    }
    throw new Error(message);
  }
}
