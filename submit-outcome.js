// ---------------------------------------------------------------------------
// Pure decision logic for what the submit response means to the player.
// No fetch(), no DOM — kept separate from app.js so it's testable on its own
// and shared with tests via the Node export guard below (Apps Script Web
// Apps always answer HTTP 200, so success/failure has to come from the body).
// ---------------------------------------------------------------------------

const ERROR_MESSAGES = {
  invalid_json: "serwer nie zrozumiał zgłoszenia",
  consent_required: "brak zgody w zgłoszeniu",
  github_write_failed: "zapis po stronie serwera nie powiódł się",
};

function interpretSubmitOutcome(parsedBody) {
  if (parsedBody && parsedBody.ok === true) return { ok: true };
  const code = parsedBody && parsedBody.error;
  return { ok: false, message: ERROR_MESSAGES[code] || "nieznany błąd serwera" };
}

if (typeof module !== "undefined") {
  module.exports = { interpretSubmitOutcome, ERROR_MESSAGES };
}
