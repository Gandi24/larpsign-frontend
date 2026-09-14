// ---------------------------------------------------------------------------
// Konfiguracja wdrożenia — edytuj ten plik, nie ruszaj reszty kodu.
// Plik jest PUBLICZNY (serwuje go GitHub Pages). Nie wpisuj tu sekretów.
// Token zapisu do GitHuba żyje wyłącznie w Google Apps Script (repo larpsign-backend,
// plik Code.gs), jako Script Property — nigdy w tym pliku.
// ---------------------------------------------------------------------------
window.CONFIG = {
  // Tytuł w nagłówku strony.
  eventName: "Zapisy na larpy — festiwal",

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

  // RODO — administrator danych (czyli Wy / ekipa organizacyjna).
  controller: {
    name: "Ekipa festiwalowa",
    email: "zapisy@example.org", // tu trafiają prośby o usunięcie danych
  },

  // RODO — jak długo trzymacie dane, zanim je usuniecie.
  retention: "do 60 dni po festiwalu, potem trwale usuwane",

  // RODO — gdzie fizycznie leżą dane (informacja o procesorze).
  processorNote:
    "Zgłoszenie w drodze do zapisu przechodzi przez Google Apps Script " +
    "(Google LLC, USA), a następnie jest zapisywane jako plik w prywatnym " +
    "repozytorium GitHub (GitHub Inc., USA), dostępnym wyłącznie dla ekipy " +
    "organizacyjnej. Google nie przechowuje kopii zgłoszenia.",
};
