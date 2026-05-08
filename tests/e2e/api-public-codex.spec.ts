import { test, expect } from "@playwright/test";

test("public codex API returns expected fields", async ({ request }) => {
  const resp = await request.get("/api/person-mv/persons/confucius/codex");
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  // Tolerate {ok,data:{}} envelope and flat shapes.
  const codex = json && (json.data || json.codex || json);
  expect(codex).toBeTruthy();
  expect(typeof codex).toBe("object");
  // At least one well-known field should appear.
  const keys = Object.keys(codex || {});
  expect(
    keys.some((k) => /name|bio|hero|timeline|person/i.test(k)),
  ).toBeTruthy();
});
