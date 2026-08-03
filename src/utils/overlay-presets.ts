/**
 * Built-in presets for the major cookie/consent management platforms (CMPs).
 *
 * Each preset identifies the banner's container and the buttons for each consent
 * action. `preparePage()` (src/crawler/prepare.ts) tries `reject` first, falling back
 * to `accept`, then `close`, per `PrepareConsentPreference` ordering — never clicking a
 * button that isn't present for a given provider.
 *
 * Selectors are intentionally scoped to well-known CMP DOM signatures (ids/classes
 * documented by each vendor) rather than generic text matching, so they don't
 * misfire on unrelated page content. The generic heuristic fallback (see prepare.ts)
 * handles banners not covered here.
 */

export interface OverlayPreset {
  /** Human-readable provider name, surfaced in PrepareResult/reports */
  provider: string;
  /** Selector(s) identifying the banner container. First match wins. */
  container: string[];
  /** Selector(s) for a "reject/necessary only" action, in preference order */
  reject?: string[];
  /** Selector(s) for an "accept all" action, in preference order */
  accept?: string[];
  /** Selector(s) for a plain close/dismiss (✕) action, in preference order */
  close?: string[];
}

export const OVERLAY_PRESETS: readonly OverlayPreset[] = [
  {
    provider: "OneTrust",
    container: ["#onetrust-banner-sdk", "#onetrust-consent-sdk"],
    reject: ["#onetrust-reject-all-handler", ".ot-pc-refuse-all-handler"],
    accept: ["#onetrust-accept-btn-handler"],
    close: ["#onetrust-close-btn-container button", ".onetrust-close-btn-handler"],
  },
  {
    provider: "Cookiebot",
    container: ["#CybotCookiebotDialog"],
    reject: ["#CybotCookiebotDialogBodyButtonDecline"],
    accept: [
      "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
      "#CybotCookiebotDialogBodyButtonAccept",
    ],
    close: ["#CybotCookiebotDialogBodyButtonClose"],
  },
  {
    provider: "Usercentrics",
    container: ["#usercentrics-root", "#uc-central-modal"],
    reject: [
      "[data-testid='uc-deny-all-button']",
      "button[aria-label='Deny']",
    ],
    accept: [
      "[data-testid='uc-accept-all-button']",
      "button[aria-label='Accept All']",
    ],
    close: ["[data-testid='uc-close-button']"],
  },
  {
    provider: "Didomi",
    container: ["#didomi-host", "#didomi-notice"],
    reject: [
      "#didomi-notice-disagree-button",
      "button.didomi-components-button--color-secondary",
    ],
    accept: ["#didomi-notice-agree-button"],
    close: ["#didomi-notice-x-button"],
  },
  {
    provider: "TrustArc",
    container: ["#truste-consent-track", "#trustarc-banner-container"],
    reject: ["#truste-consent-required", ".required"],
    accept: ["#truste-consent-button"],
    close: ["#truste-consent-close", ".trustarc-close-icon"],
  },
  {
    provider: "Quantcast",
    container: ["#qc-cmp2-container"],
    reject: ["button[mode='secondary']", ".qc-cmp2-summary-buttons button:first-child"],
    accept: ["button[mode='primary']"],
    close: [],
  },
  {
    provider: "Osano",
    container: [".osano-cm-window", "#osano-cm-window"],
    reject: [".osano-cm-denyAll", ".osano-cm-manage"],
    accept: [".osano-cm-acceptAll"],
    close: [".osano-cm-dialog__close"],
  },
  {
    provider: "CookieYes",
    container: ["#cookie-law-info-bar", ".cky-consent-container"],
    reject: [".cky-btn-reject", "#cookie_action_close_header_reject"],
    accept: [".cky-btn-accept", "#cookie_action_close_header"],
    close: [".cky-btn-close"],
  },
  {
    provider: "Termly",
    container: ["#termly-code-snippet-support", ".t-consent-banner"],
    reject: [".t-decline-button", ".t-reject-button"],
    accept: [".t-acceptbtn", ".t-accept-button"],
    close: [".t-close-button"],
  },
  {
    provider: "Klaro",
    container: [".klaro .cookie-notice"],
    reject: [".cn-decline", ".cm-btn-decline"],
    accept: [".cn-ok", ".cm-btn-accept"],
    close: [],
  },
  {
    provider: "Complianz",
    container: ["#cmplz-cookiebanner-container", ".cmplz-cookiebanner"],
    reject: [".cmplz-deny", ".cmplz-btn.cmplz-deny"],
    accept: [".cmplz-accept", ".cmplz-btn.cmplz-accept"],
    close: [".cmplz-close"],
  },
  {
    provider: "Iubenda",
    container: ["#iubenda-cs-banner", ".iubenda-cs-container"],
    reject: [".iubenda-cs-reject-btn"],
    accept: [".iubenda-cs-accept-btn"],
    close: [".iubenda-cs-close-btn"],
  },
  {
    provider: "HubSpot",
    container: ["#hs-eu-cookie-confirmation"],
    reject: ["#hs-eu-decline-button"],
    accept: ["#hs-eu-confirmation-button"],
    close: [],
  },
  {
    provider: "Sourcepoint",
    container: ["#sp_message_container", "div[class^='message-container']"],
    reject: ["button[title='Reject All']", "button[aria-label='Reject All']"],
    accept: ["button[title='Accept All']", "button[aria-label='Accept All']"],
    close: ["button.message-close"],
  },
  {
    provider: "Axeptio",
    container: ["#axeptio_overlay", "#axeptio_main_button"],
    reject: ["#axeptio_btn_dismiss"],
    accept: ["#axeptio_btn_acceptAll"],
    close: [],
  },
];
