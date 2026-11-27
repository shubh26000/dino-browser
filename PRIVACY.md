# Privacy notes

- Shield rules are bundled with the application. The browser does not fetch
  filter lists or send browsing data to a browser-operated service.
- Shield decisions are made locally for requests in the browser session.
- Users can disable Shields globally or add individual host exceptions.
- HTTPS-first upgrades typed `http:` addresses. If the HTTPS connection is
  refused, the browser presents an explicit HTTP fallback action. Certificate
  failures are not bypassed.
- URL cleaning removes a defined set of common tracking query parameters
  before a typed URL is opened. It does not rewrite links found within pages.
- Shields statistics are aggregate counters stored locally with encrypted
  browser data; blocked domain details exist only in the current tab's memory.
- Bandwidth and time savings shown on the start page are estimates, not
  measurements. The estimate assumes 50 KiB and 100 ms per blocked request.
- Start-page preferences, shortcuts, tasks, and notes are encrypted with the
  browser library. A selected wallpaper is read from its local file path; the
  browser stores that path, does not upload or copy the image, and does not
  encrypt the original image file.
- The start-page widgets are offline and read only local browser data or bundled
  text. Submitting a search sends its query to the selected search engine.
- Browser library data is encrypted with Windows DPAPI. Website storage and
  cookies are temporary unless the user explicitly enables extension support.
  Electron requires a persistent session to load extensions. Enabling that
  option retains cookies and website data between launches. Disabling extension
  support removes the installed extensions and clears that persistent profile's
  cookies, site data, extension data, and cache before returning to a temporary
  session. Website passwords are not saved by the browser.
- The startup setting defaults to the start page. If the user chooses
  "Continue where you left off", the browser stores up to 20 HTTP/HTTPS tab
  URLs in the encrypted browser library and navigates to them on the next
  launch. Closed-tab restore is held in memory for the current run.
- Extensions are local unpacked folders selected by the user. The browser does
  not download extensions or update them. Extension code can contact network
  services or access sites according to its own code and permissions; those
  requests are outside the browser's bundled Shields statistics. The browser's
  request hook takes precedence over conflicting `chrome.webRequest` extension
  handlers, and Electron does not list Declarative Net Request as supported.

The bundled blocking rules are a small starter set. They do not provide the
coverage of EasyList or uBlock Origin, cosmetic filtering, scriptlets, or
fingerprint randomization. Custom rules accept hostnames only; ABP/uBlock
syntax, remote list subscriptions, cross-site cookie controls, and per-site
script controls are not implemented. Page code and resources served directly
by a site can still observe activity within that site.
