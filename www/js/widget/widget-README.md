/**
 * widget-README.md — how the split account widget fits together.
 *
 * WHAT: the old 3.4k-line www/js/account-widget.js is now 10 small files
 * here. Same code, same behavior — just organized by feature so a fix in
 * DMs can't break profiles, and two people can work without colliding.
 *
 * LOAD ORDER (every page lists these in this exact order; deferred scripts
 * run top-to-bottom):
 *   widget-core.js → widget-utils.js → widget-styles.js → widget-session.js
 *   → widget-inbox.js → widget-dm.js → widget-dm-poll.js
 *   → widget-dm-reactions.js → widget-friends.js → widget-profile.js
 * Rule: core MUST be first (it defines AccountWidget + AghiWidgetUtil).
 * boot() lives in widget-profile.js (LAST) on purpose: deferred scripts run
 * while document.readyState is already 'interactive', so booting from core
 * would execute before the other files arrive. Everything else only ADDS
 * methods, so relative order among feature files does not matter.
 *
 * SHARING RULES (why it works without a bundler):
 * - State fields: ONLY in core's constructor. Modules add methods, never state.
 * - Helpers/constants: ONLY via window.AghiWidgetUtil (defined in core).
 *   Never declare a page-level function/const in a module file — index.html
 *   and creation.html already define top-level escapeHtml/presetColor/
 *   PFP_PRESETS, and a second copy is either a fatal const redeclare or a
 *   silent function override.
 * - Optional deps (AghiEmojiPicker, AghiImgFallback) stay guarded with
 *   `if (window.X)` — half the pages don't load them.
 *
 * ADDING A METHOD: put it in the owning feature file as
 *   AccountWidget.prototype.myFeature = function () { ... };
 * use AghiWidgetUtil.* for shared helpers, this.* for state (add new state
 * fields in core with a comment naming the owner). Validate with:
 *   node --check on the file + the inventory command in the plan report.
 */
