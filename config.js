// ---------------------------------------------------------------------------
// Konfiguracja wdrożenia — edytuj ten plik, nie ruszaj reszty kodu.
// Plik jest PUBLICZNY (serwuje go GitHub Pages). Nie wpisuj tu sekretów.
// Token zapisu do GitHuba żyje wyłącznie w Cloudflare Workerze (worker.js).
// ---------------------------------------------------------------------------
window.CONFIG = {
  // Tytuł w nagłówku strony.
  eventName: "Zapisy na larpy — festiwal",

  // Dokąd trafiają zgłoszenia — adres Twojego Cloudflare Workera.
  // Przy testach lokalnych zostaw "" — formularz pozwoli pobrać odpowiedzi
  // jako plik JSON zamiast je wysyłać.
  submitEndpoint: "", // np. "https://larp-signon.twojnick.workers.dev"

  // RODO — administrator danych (czyli Wy / ekipa organizacyjna).
  controller: {
    name: "Ekipa festiwalowa",
    email: "zapisy@example.org", // tu trafiają prośby o usunięcie danych
  },

  // RODO — jak długo trzymacie dane, zanim je usuniecie.
  retention: "do 60 dni po festiwalu, potem trwale usuwane",

  // RODO — gdzie fizycznie leżą dane (informacja o procesorze).
  processorNote:
    "Odpowiedzi są zapisywane jako pliki w prywatnym repozytorium GitHub " +
    "(GitHub Inc., USA) i dostępne wyłącznie dla ekipy organizacyjnej.",
};
