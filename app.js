// ---------------------------------------------------------------------------
// Silnik formularza zapisów na larpy.
// Krok 1: ocena preferencji (-2..2). Krok 2: triggery (tak/nie).
// Krok 3: wybór priorytetów w każdym slocie, z wyliczanym dopasowaniem.
// Dane gier i słowniki pochodzą z larps.json.
// ---------------------------------------------------------------------------
const cfg = window.CONFIG || {};
const $ = (sel) => document.querySelector(sel);

let data = null; // larps.json
const selections = {}; // { slotId: [larpName w kolejności priorytetu] }

const SCALE = [
  { v: -2, label: "Nie znoszę" },
  { v: -1, label: "Raczej nie" },
  { v: 0, label: "Obojętne" },
  { v: 1, label: "Lubię" },
  { v: 2, label: "Uwielbiam" },
];

init();

async function init() {
  $("#event-name").textContent = cfg.eventName || "Zapisy na larpy";
  $("#footer-contact").textContent = cfg.controller
    ? `Pytania i prośby o usunięcie danych: ${cfg.controller.email}`
    : "";
  renderPrivacy();

  try {
    data = await fetch("larps.json", { cache: "no-store" }).then((r) => r.json());
  } catch (e) {
    setStatus("Nie udało się wczytać danych gier. Odśwież stronę.", "err");
    return;
  }

  data.timeslots.forEach((s) => (selections[s.id] = []));
  renderLegend();
  renderPrefs();
  renderTriggers();
  renderSlots();

  const form = $("#signon-form");
  form.addEventListener("submit", onSubmit);
  form.addEventListener("change", (e) => {
    // zmiana preferencji/triggerów przelicza sloty
    if (e.target.matches('[name^="pref_"], [name="trigger"]')) renderSlots();
  });
  $("#slots").addEventListener("click", onSlotAction);
  $("#download-btn").addEventListener("click", () => download(collect()));
}

function renderPrivacy() {
  const c = cfg.controller || {};
  $("#privacy-notice").innerHTML = `
    <p><strong>Kto przechowuje dane:</strong> ${esc(c.name || "organizatorzy")}
       (<a href="mailto:${esc(c.email || "")}">${esc(c.email || "")}</a>),
       administrator danych.</p>
    <p><strong>Po co:</strong> aby przydzielić Ci pasującą rolę i bezpiecznie poprowadzić gry.</p>
    <p><strong>Jak długo:</strong> ${esc(cfg.retention || "do końca wydarzenia, potem usuwane")}.</p>
    <p><strong>Gdzie:</strong> ${esc(cfg.processorNote || "")}</p>`;
}

// --- render: legenda + preferencje -----------------------------------------

function renderLegend() {
  $("#pref-legend").innerHTML = SCALE.map(
    (s) => `<span><b>${s.v > 0 ? "+" + s.v : s.v}</b> ${esc(s.label)}</span>`
  ).join("");
}

function renderPrefs() {
  $("#prefs").innerHTML = data.preferenceTags
    .map(
      (t) => `<div class="pref-row">
        <span class="pref-label">${esc(t.label)}</span>
        <div class="seg">${SCALE.map(
          (s) => `<label title="${esc(s.label)}">
            <input type="radio" name="pref_${t.id}" value="${s.v}" ${s.v === 0 ? "checked" : ""}/>
            <span>${s.v > 0 ? "+" + s.v : s.v}</span>
          </label>`
        ).join("")}</div>
      </div>`
    )
    .join("");
}

function renderTriggers() {
  $("#triggers").innerHTML = data.triggers
    .map(
      (t) => `<label class="checkline"><input type="checkbox" name="trigger" value="${esc(t)}"/>
        <span>${esc(t)}</span></label>`
    )
    .join("");
}

// --- liczenie dopasowania ---------------------------------------------------

function getRatings() {
  const r = {};
  data.preferenceTags.forEach((t) => {
    const hit = document.querySelector(`[name="pref_${t.id}"]:checked`);
    r[t.id] = hit ? Number(hit.value) : 0;
  });
  return r;
}

function getTriggers() {
  return [...document.querySelectorAll('[name="trigger"]:checked')].map((n) => n.value);
}

// 0..100 — średnia ocen tagów larpa, przeskalowana z [-2,2] na [0,100].
function likeliness(larp, ratings) {
  const tags = larp.tags || [];
  if (!tags.length) return 50;
  const sum = tags.reduce((a, id) => a + (ratings[id] || 0), 0);
  return Math.round(((sum / tags.length + 2) / 4) * 100);
}

function likeLabel(pct) {
  if (pct >= 80) return "Świetnie pasuje";
  if (pct >= 60) return "Pasuje";
  if (pct >= 40) return "Może być";
  return "Raczej nie dla Ciebie";
}

// --- render: sloty ----------------------------------------------------------

const MAX_PICKS = 4;
const larpByName = (slot, name) => slot.larps.find((l) => l.name === name);

function triggersHTML(larp, myTriggers) {
  const t = (larp.triggers || [])
    .map((tr) => {
      const hit = myTriggers.includes(tr);
      return `<strong class="${hit ? "trig hit" : "trig"}">${hit ? "⚠ " : ""}${esc(tr)}</strong>`;
    })
    .join(" ");
  return t ? `<div class="lc-trig">${t}</div>` : "";
}

function tagLabel(id) {
  const t = data.preferenceTags.find((p) => p.id === id);
  return t ? t.label : id;
}

// Tagi tego larpa, których gracz wyraźnie nie lubi (-2) — „to może Ci nie pasować”.
function dislikesFor(larp, ratings) {
  return (larp.tags || []).filter((id) => (ratings[id] || 0) <= -2).map(tagLabel);
}

function dislikesHTML(larp, ratings) {
  const labels = dislikesFor(larp, ratings);
  if (!labels.length) return "";
  return `<div class="lc-warn">👎 Możesz nie polubić: ${labels.map(esc).join(", ")}</div>`;
}

function renderSlots() {
  const ratings = getRatings();
  const myTriggers = getTriggers();

  $("#slots").innerHTML = data.timeslots
    .map((slot) => {
      const picks = selections[slot.id];
      const full = picks.length >= MAX_PICKS;

      // Strefa „Twoje wybory” — w kolejności priorytetu.
      const tray = picks.length
        ? picks
            .map((name, i) => {
              const larp = larpByName(slot, name);
              const pct = likeliness(larp, ratings);
              return `<li class="tray-item">
                <span class="prio">${i + 1}</span>
                <div class="ti-main">
                  <div class="lc-head">
                    <span class="lc-name">${esc(name)}</span>
                    <span class="lc-pct">${pct}% · ${likeLabel(pct)}</span>
                  </div>
                  ${dislikesHTML(larp, ratings)}
                  ${triggersHTML(larp, myTriggers)}
                </div>
                <div class="ti-ctl">
                  <button type="button" aria-label="W górę" data-action="up" data-slot="${slot.id}" data-name="${esc(name)}" ${i === 0 ? "disabled" : ""}>▲</button>
                  <button type="button" aria-label="W dół" data-action="down" data-slot="${slot.id}" data-name="${esc(name)}" ${i === picks.length - 1 ? "disabled" : ""}>▼</button>
                  <button type="button" aria-label="Usuń" class="rm" data-action="remove" data-slot="${slot.id}" data-name="${esc(name)}">✕</button>
                </div>
              </li>`;
            })
            .join("")
        : `<li class="tray-empty">Nic jeszcze nie wybrano — dodaj larpy z listy poniżej.</li>`;

      // Strefa „Pozostałe” — niewybrane, wg dopasowania.
      const available = slot.larps
        .filter((l) => !picks.includes(l.name))
        .map((l) => ({ larp: l, pct: likeliness(l, ratings) }))
        .sort((a, b) => b.pct - a.pct)
        .map(
          ({ larp, pct }) => `<div class="larp-card">
            <div class="lc-body">
              <div class="lc-head">
                <span class="lc-name">${esc(larp.name)}</span>
                <span class="lc-pct">${pct}% · ${likeLabel(pct)}</span>
              </div>
              <div class="bar"><i style="width:${pct}%"></i></div>
              ${dislikesHTML(larp, ratings)}
              ${triggersHTML(larp, myTriggers)}
            </div>
            <button type="button" class="add" data-action="add" data-slot="${slot.id}" data-name="${esc(larp.name)}" ${full ? "disabled" : ""}>+ Dodaj</button>
          </div>`
        )
        .join("");

      return `<div class="slot">
        <div class="slot-head">
          <h3>${esc(slot.name)} <span class="slot-time">${esc(slot.time)}</span></h3>
          <span class="slot-hint">wybierz do ${MAX_PICKS} • kolejność = priorytet</span>
        </div>
        <ol class="tray">${tray}</ol>
        ${full ? `<p class="full-note">Masz już ${MAX_PICKS} wybory. Usuń coś, by dodać inny larp.</p>` : ""}
        <div class="avail-label">Pozostałe (wg dopasowania)</div>
        <div class="avail">${available || `<p class="tray-empty">Wszystkie larpy z tego slotu są na Twojej liście.</p>`}</div>
      </div>`;
    })
    .join("");
}

function onSlotAction(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn || btn.disabled) return;
  const { action, slot: slotId, name } = btn.dataset;
  const picks = selections[slotId];
  const at = picks.indexOf(name);

  switch (action) {
    case "add":
      if (picks.length >= MAX_PICKS || at >= 0) return;
      picks.push(name);
      setStatus("");
      break;
    case "remove":
      if (at >= 0) picks.splice(at, 1);
      break;
    case "up":
      if (at > 0) [picks[at - 1], picks[at]] = [picks[at], picks[at - 1]];
      break;
    case "down":
      if (at >= 0 && at < picks.length - 1) [picks[at + 1], picks[at]] = [picks[at], picks[at + 1]];
      break;
  }
  renderSlots();
}

// --- zbieranie + walidacja --------------------------------------------------

function collect() {
  const ratings = getRatings();
  const myTriggers = getTriggers();
  const choices = {};
  data.timeslots.forEach((slot) => {
    choices[slot.id] = selections[slot.id].map((name, i) => {
      const larp = slot.larps.find((l) => l.name === name);
      const pct = likeliness(larp, ratings);
      return {
        priority: i + 1,
        name,
        likeliness: pct,
        triggerConflicts: (larp.triggers || []).filter((t) => myTriggers.includes(t)),
        dislikes: dislikesFor(larp, ratings),
      };
    });
  });

  return {
    meta: { event: cfg.eventName || "", submittedAt: new Date().toISOString(), schemaVersion: 2 },
    identity: { name: $("#name").value.trim(), email: $("#email").value.trim() },
    consent: { given: $("#consent").checked, timestamp: new Date().toISOString() },
    preferences: ratings,
    triggers: myTriggers,
    choices,
  };
}

function validate() {
  let firstBad = null;
  $("#name").classList.remove("bad");
  $(".consent").classList.remove("invalid");

  if (!$("#name").value.trim()) {
    $("#name").classList.add("bad");
    firstBad = $("#name");
  }
  if (!$("#consent").checked) {
    $(".consent").classList.add("invalid");
    if (!firstBad) firstBad = $(".consent");
  }
  return firstBad;
}

// --- wysyłka ----------------------------------------------------------------

async function onSubmit(e) {
  e.preventDefault();
  const bad = validate();
  if (bad) {
    bad.scrollIntoView({ behavior: "smooth", block: "center" });
    setStatus("Uzupełnij imię/ksywkę i zaznacz zgodę.", "err");
    return;
  }

  const payload = collect();
  const btn = $("#submit-btn");

  if (!cfg.submitEndpoint) {
    download(payload);
    setStatus(
      "Brak skonfigurowanego serwera, więc Twoje odpowiedzi zostały pobrane jako plik. " +
        "Prześlij go organizatorom.",
      "ok"
    );
    return;
  }

  btn.disabled = true;
  setStatus("Wysyłanie…");
  try {
    const res = await fetch(cfg.submitEndpoint, {
      method: "POST",
      // text/plain, not application/json: Apps Script Web Apps can't set
      // custom CORS response headers, so a JSON content type would trigger a
      // failing preflight. The body is still the JSON payload as a string.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      // Envelope, not the bare submission: the backend checks `secret`
      // against its own Script Property before touching `submission` at
      // all. See config.js's submitSecret comment for what this does (and
      // doesn't) protect against.
      body: JSON.stringify({ secret: cfg.submitSecret, submission: payload }),
    });
    const body = await res.json().catch(() => null);
    const outcome = interpretSubmitOutcome(body);
    if (!outcome.ok) throw new Error(outcome.message);
    $("#signon-form").innerHTML = `<section class="card"><h2>Dzięki! 🎭</h2>
      <p>Twoje zgłoszenie dotarło. Ekipa odezwie się w sprawie ról.</p>
      <p class="blurb">Chcesz coś zmienić albo usunąć swoje dane? Napisz na
      <a href="mailto:${esc((cfg.controller || {}).email || "")}">${esc((cfg.controller || {}).email || "")}</a>.</p></section>`;
  } catch (err) {
    btn.disabled = false;
    setStatus(
      "Wysyłka nie powiodła się: " + err.message +
        ". Możesz użyć „Pobierz moje odpowiedzi” i przesłać plik.",
      "err"
    );
  }
}

// --- pomocnicze -------------------------------------------------------------

function download(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const who = (payload.identity.name || "zgloszenie").replace(/[^\w.-]+/g, "_");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `larp-zapis-${who}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function setStatus(msg, kind) {
  const el = $("#status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
