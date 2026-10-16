import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (route: unknown) => route,
  Link: (props: { to?: unknown; children?: import("react").ReactNode }) => <a href={String(props.to ?? "/")}>{props.children}</a>,
}));
vi.mock("@/lib/fan-membership", () => ({
  fanPublic: vi.fn(),
  getStoredFanCode: vi.fn(() => null),
  registerFan: vi.fn(),
  storeFanCode: vi.fn(),
}));
vi.mock("@/lib/fan-card", () => ({
  drawFanCard: vi.fn(),
  downloadFanCard: vi.fn().mockResolvedValue(undefined),
  shareFanCard: vi.fn().mockResolvedValue("shared"),
  downloadVideoBlob: vi.fn(),
}));
vi.mock("@/lib/fan-video", () => ({
  createFanVideo: vi.fn().mockResolvedValue(new Blob(["test-video"], { type: "video/mp4" })),
}));
vi.mock("@/lib/track", () => ({ track: vi.fn() }));

import { fanPublic, registerFan, storeFanCode } from "@/lib/fan-membership";
import { downloadFanCard } from "@/lib/fan-card";
import { createFanVideo } from "@/lib/fan-video";
import { Filiacao } from "@/routes/filiar";

const createdFan = { code: "FAN123", fanNumber: 9, alias: "FÃ TESTE", since: "2026-10-09T08:00:00.000Z" };

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/filiar");
  vi.mocked(fanPublic).mockResolvedValue(null);
  vi.mocked(registerFan).mockResolvedValue(createdFan);
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:fan-photo"),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal("Image", class TestImage {
    naturalWidth = 100;
    naturalHeight = 100;
    width = 100;
    height = 100;
    onload: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    set src(_value: string) { this.onload?.(new Event("load")); }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Código do Fã", () => {
  it("mostra as quatro regras curtas e não exige contacto nem assinatura", () => {
    render(<Filiacao />);
    expect(screen.getByText("RESPEITO")).toBeTruthy();
    expect(screen.getByText("APOIO")).toBeTruthy();
    expect(screen.getByText("CRÉDITO")).toBeTruthy();
    expect(screen.getByText("UNIÃO")).toBeTruthy();
    expect(screen.getByText("SINDIIICALIZADO")).toBeTruthy();
    expect(screen.getByLabelText(/ADICIONAR FOTOGRAFIA OBRIGATÓRIA/i)).toBeTruthy();
    expect(screen.queryByLabelText(/whatsapp|email|assinatura/i)).toBeNull();
  });

  it("só cria o cartão depois de aceitar o código e preencher o nome", async () => {
    render(<Filiacao />);
    fireEvent.change(screen.getByLabelText("NOME OU APELIDO"), { target: { value: "FÃ TESTE" } });
    fireEvent.click(screen.getByRole("button", { name: /CRIAR O MEU CARTÃO/i }));
    expect(registerFan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Aceito o Código do Fã/i));
    fireEvent.click(screen.getByRole("button", { name: /CRIAR O MEU CARTÃO/i }));
    expect(registerFan).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/ADICIONAR FOTOGRAFIA OBRIGATÓRIA/i), {
      target: { files: [new File(["portrait"], "portrait.png", { type: "image/png" })] },
    });
    await screen.findByText("FOTOGRAFIA SELECCIONADA");
    fireEvent.click(screen.getByRole("button", { name: /CRIAR O MEU CARTÃO/i }));
    expect(await screen.findByText("CARTÃO DE FÃ CRIADO")).toBeTruthy();
    expect(registerFan).toHaveBeenCalledWith({ alias: "FÃ TESTE", rulesVersion: "v1", referredBy: null });
    expect(storeFanCode).toHaveBeenCalledWith("FAN123");
    expect(downloadFanCard).not.toHaveBeenCalled();
    expect(createFanVideo).not.toHaveBeenCalled();
  });

  it("mantém o download PNG separado e só chama o motor de vídeo ao clicar", async () => {
    render(<Filiacao />);
    fireEvent.change(screen.getByLabelText("NOME OU APELIDO"), { target: { value: "FÃ TESTE" } });
    fireEvent.click(screen.getByLabelText(/Aceito o Código do Fã/i));
    fireEvent.change(screen.getByLabelText(/ADICIONAR FOTOGRAFIA OBRIGATÓRIA/i), {
      target: { files: [new File(["portrait"], "portrait.png", { type: "image/png" })] },
    });
    await screen.findByText("FOTOGRAFIA SELECCIONADA");
    fireEvent.click(screen.getByRole("button", { name: /CRIAR O MEU CARTÃO/i }));
    await screen.findByText("CARTÃO DE FÃ CRIADO");

    fireEvent.click(screen.getByRole("button", { name: /DESCARREGAR IMAGEM PNG/i }));
    await waitFor(() => expect(downloadFanCard).toHaveBeenCalledTimes(1));
    expect(createFanVideo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^CRIAR VÍDEO$/i }));
    await screen.findByText("VÍDEO PRONTO");
    expect(createFanVideo).toHaveBeenCalledTimes(1);
  });
});
