import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

vi.mock("@/lib/site-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/site-content")>();
  const site = {
    dropAt: new Date("2026-12-18T00:00:00+02:00").getTime(),
    marquee: null,
    heroTitle: "SINDICATO DO TRAP",
    heroSubtitle: "STUDIO XOYENS",
    social: {},
  };
  return {
    ...actual,
    getLiveSiteConfig: vi.fn(async () => site),
    getLiveHomeContent: vi.fn(async () => ({
      artists: [],
      tapes: [],
      merch: [],
      site,
      memberCount: 0,
    })),
  };
});

function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App routing", () => {
  it("renders the index route", async () => {
    const { container } = renderAt("/");
    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });

  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { container } = renderAt("/this-route-does-not-exist");
    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });

  it("registers the camera route in the generated tree", () => {
    expect(routeTree.children).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "/camera" })]),
    );
  });
});
