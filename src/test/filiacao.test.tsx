import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (route: unknown) => route,
  Link: (props: any) => <a href={String(props.to ?? "/")}>{props.children}</a>,
}));
vi.mock("@/lib/carteira", () => ({ drawCard: vi.fn(), shareCard: vi.fn() }));
vi.mock("@/lib/halftone-canvas", () => ({ renderHalftone: vi.fn() }));
vi.mock("@/lib/track", () => ({ track: vi.fn() }));
vi.mock("@/lib/sfx", () => ({ thud: vi.fn() }));
vi.mock("@/lib/membership", () => ({
  getDelegates: vi.fn().mockResolvedValue([]),
  joinUnion: vi.fn(),
  storeMemberCode: vi.fn(),
}));
vi.mock("@/components/SignaturePad", () => ({
  SignaturePad: (props: { onChange: (canvas: HTMLCanvasElement | null) => void }) => (
    <button type="button" onClick={() => props.onChange(document.createElement("canvas"))}>
      TESTAR ASSINATURA
    </button>
  ),
}));
vi.mock("@/assets/brand/sindicato-selo.png.asset.json", () => ({
  default: { url: "/mock-selo.png" },
}));

import { joinUnion } from "@/lib/membership";
import { Filiacao } from "@/routes/filiar";
import { validateMembershipForm } from "@/lib/membership-validation";

const urlMethods = {
  createObjectURL: Object.getOwnPropertyDescriptor(URL, "createObjectURL"),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, "revokeObjectURL"),
};

const validForm = {
  alias: "TESTE",
  contactType: "whatsapp" as const,
  contactValue: "+258 84 123 4567",
  hasPhoto: true,
  hasSignature: true,
};

function acceptAllClauses() {
  for (let index = 1; index <= 6; index += 1) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp("Carimbar cláusula 0" + index, "i") }));
  }
  fireEvent.click(screen.getByRole("button", { name: /AVANÇAR PARA A FICHA/i }));
}

class ImmediateImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private currentSrc = "";

  set src(value: string) {
    this.currentSrc = value;
    queueMicrotask(() => this.onload?.());
  }

  get src() {
    return this.currentSrc;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(joinUnion).mockResolvedValue({
    alreadyMember: false,
    code: "ABC123",
    memberNumber: 7,
    alias: "TESTE",
    since: "2026-10-09T07:00:00.000Z",
  });
  vi.stubGlobal("Image", ImmediateImage);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:member-photo"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (urlMethods.createObjectURL) Object.defineProperty(URL, "createObjectURL", urlMethods.createObjectURL);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (urlMethods.revokeObjectURL) Object.defineProperty(URL, "revokeObjectURL", urlMethods.revokeObjectURL);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("validação da filiação", () => {
  it("identifica cada requisito em falta antes de chamar o backend", () => {
    expect(validateMembershipForm({
      alias: "",
      contactType: "whatsapp",
      contactValue: "",
      hasPhoto: false,
      hasSignature: false,
    })?.code).toBe("ALIAS");

    expect(validateMembershipForm({
      ...validForm,
      contactType: "email",
      contactValue: "email-invalido",
    })?.code).toBe("CONTACT");

    expect(validateMembershipForm({ ...validForm, hasPhoto: false })?.target).toBe("member-photo-section");
    expect(validateMembershipForm({ ...validForm, hasSignature: false })?.target).toBe("member-signature-section");
    expect(validateMembershipForm(validForm)).toBeNull();
  });

  it("mantém o botão clicável e mostra o que falta em vez de o bloquear", async () => {
    render(<Filiacao />);
    expect(screen.getByText("TERMO DE ADESÃO AO SINDICATO")).toBeTruthy();
    acceptAllClauses();

    const submit = screen.getByRole("button", { name: /ASSINAR E ENTRAR NO SINDICATO/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    expect((await screen.findByRole("alert")).textContent).toMatch(/CODINOME/i);
    expect(joinUnion).not.toHaveBeenCalled();
  });

  it("emite a carteira sem bloqueios de campos ocultos depois de preencher e assinar", async () => {
    const { container } = render(<Filiacao />);
    expect(container.querySelector('input[aria-hidden="true"][tabindex="-1"]')).toBeNull();
    acceptAllClauses();

    fireEvent.change(screen.getByLabelText("CODINOME"), { target: { value: "TESTE" } });
    fireEvent.change(screen.getByPlaceholderText("+258 84 000 0000"), { target: { value: "+258 84 123 4567" } });

    const photoInput = document.getElementById("member-photo-gallery") as HTMLInputElement;
    const file = new File(["image"], "membro.png", { type: "image/png" });
    fireEvent.change(photoInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText("FOTOGRAFIA CARREGADA")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "TESTAR ASSINATURA" }));
    const submit = screen.getByRole("button", { name: /ASSINAR E ENTRAR NO SINDICATO/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    expect(await screen.findByText("CARTEIRA EMITIDA")).toBeTruthy();
    expect(joinUnion).toHaveBeenCalledTimes(1);
  });
});
