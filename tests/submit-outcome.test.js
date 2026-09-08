const { test } = require("node:test");
const assert = require("node:assert/strict");
const { interpretSubmitOutcome } = require("../submit-outcome.js");

test("ok:true body is a success", () => {
  assert.deepEqual(interpretSubmitOutcome({ ok: true, path: "submissions/x.json" }), {
    ok: true,
  });
});

test("known error code maps to a Polish message", () => {
  assert.deepEqual(interpretSubmitOutcome({ ok: false, error: "consent_required" }), {
    ok: false,
    message: "brak zgody w zgłoszeniu",
  });
});

test("unauthorized (bad shared secret) maps to a Polish message", () => {
  assert.deepEqual(interpretSubmitOutcome({ ok: false, error: "unauthorized" }), {
    ok: false,
    message: "formularz jest błędnie skonfigurowany (nieprawidłowy klucz) — zgłoś to organizatorom",
  });
});

test("unrecognised error code falls back to a generic message", () => {
  assert.deepEqual(interpretSubmitOutcome({ ok: false, error: "something_new" }), {
    ok: false,
    message: "nieznany błąd serwera",
  });
});

test("unparseable/empty body is treated as a generic failure, not a crash", () => {
  assert.deepEqual(interpretSubmitOutcome(null), { ok: false, message: "nieznany błąd serwera" });
});
