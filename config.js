// ---------------------------------------------------------------------------
// Konfiguracja wdrożenia — edytuj ten plik, nie ruszaj reszty kodu.
// Plik jest PUBLICZNY (serwuje go GitHub Pages). Nie wpisuj tu sekretów.
// Token zapisu do GitHuba żyje wyłącznie w Google Apps Script (repo larpsign-backend,
// plik Code.gs), jako Script Property — nigdy w tym pliku.
// ---------------------------------------------------------------------------
window.CONFIG = {
  // Tytuł w nagłówku strony.
  eventName: "Zapisy na Krak-ON 2026",

  // Link do strony z pełnymi opisami larpów i harmonogramem wydarzenia.
  // Zostaw "", jeśli nie masz jeszcze takiej strony — formularz pokaże
  // ogólny tekst zamiast linku.
  programUrl: "https://krak-on.info/#harmonogram",

  // Dokąd trafiają zgłoszenia — adres Twojego wdrożenia Google Apps Script.
  // Przy testach lokalnych zostaw "" — formularz pozwoli pobrać odpowiedzi
  // jako plik JSON zamiast je wysyłać.
  submitEndpoint: "https://script.google.com/macros/s/AKfycbwPydStEFqP53ADCyAevqTUzXyN4C5XXJSeT2B7mLMC1CnxiskRY4T8LV7VNIQL9sud5A/exec",

  // Ten sam ciąg znaków co SUBMIT_SECRET w Twoim Apps Script — musi się zgadzać.
  // WAŻNE: to NIE jest prawdziwy sekret. Plik jest publiczny, więc każdy kto
  // go otworzy, ten "sekret" zobaczy. Odstrasza tylko przypadkowe/automatyczne
  // trafienia na adres Web Appki, nie chroni przed kimś, kto celowo czyta ten
  // plik. W sam raz na krótkotrwałe zapisy na festiwal; jeśli potrzebujesz
  // realnej ochrony (np. przed spamem), to inny temat (patrz DESIGN.md).
  submitSecret: "cRA5VFM3q4IHo0IpOTpZfOOSeqAOtZQV",

  // RODO — administrator danych. Nazwa dokładnie jak w zgodzie ogólnej
  // oficjalnego formularza zapisów Krak-ON ("Wyrażam zgodę na przetwarzanie
  // moich danych osobowych... przez Stowarzyszenie Terra Futura oraz
  // Centrum Kultury Podgórza") — nie z §1 regulaminu (ta lista organizatorów
  // Festiwalu jest szersza niż administrator danych osobowych) ani z
  // regulaminu's samej klauzuli RODO (ta jest zawężona do zdjęć).
  controller: {
    name: "Stowarzyszenie Terra Futura oraz Centrum Kultury Podgórza",
    email: "festiwalkrakon@gmail.com", // tu trafiają prośby o usunięcie danych
  },

  // Link do regulaminu wydarzenia, pokazywany przy zgodzie "zapoznałam się
  // z regulaminem". Zostaw "", jeśli nie masz jeszcze regulaminu online —
  // zgoda i tak się pojawi, tylko bez linku.
  rulesUrl: "https://krak-on.info/regulamin",
};
