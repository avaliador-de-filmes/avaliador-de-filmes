import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { server } from "./mocks/server";

expect.extend(toHaveNoViolations);

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => server.close());
