/**
 * widget-styles.js — global widget-chrome CSS for the split account widget.
 *
 * Contract: widget-core.js must load first (it creates window.AghiWidgetUtil).
 * Registers injectStyles(); core boot() calls it exactly once. The CSS text
 * is byte-identical to the original injectStyles() (only the JS wrapper
 * indentation changed) — component CSS stays with its component file.
 */
if (!window.AghiWidgetUtil || typeof AccountWidget === 'undefined') {
  throw new Error('[widget-styles] widget-core.js must load before this file');
}

window.AghiWidgetUtil.injectStyles = function () {
  if (document.getElementById('aghi-account-widget-styles')) return;
  const style = document.createElement('style');
  style.id = 'aghi-account-widget-styles';
  style.textContent = `
      .aghi-aw { position: relative; font-family: 'Inter', sans-serif; display: inline-block; flex-shrink: 0; }
      .aghi-aw-guest { display: flex; gap: 14px; align-items: center; }
      .aghi-aw-guest a { color: var(--silver); text-decoration: none; font-size: 14px; letter-spacing: 0.03em; }
      .aghi-aw-guest a:hover { color: var(--cyan); }
      .aghi-aw-guest a.aghi-aw-signup { color: var(--cyan); border: 1px solid var(--glass-border-active); border-radius: 6px; padding: 6px 14px; background: var(--glass-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
      .aghi-aw-guest a.aghi-aw-signup:hover { background: var(--glass-bg-hover); }

      #aghi-account-widget { display: flex; flex-shrink: 0; min-width: 0; }
      .aghi-aw-row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; flex-shrink: 0; }

      .aghi-aw-inbox-btn { width: 38px; height: 38px; border-radius: 9px; position: relative; display: flex; align-items: center; justify-content: center; color: var(--silver); text-decoration: none; cursor: pointer; background: var(--glass-bg); border: 1px solid var(--glass-border); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 0; margin: 0; font: inherit; -webkit-appearance: none; appearance: none; transition: all 0.18s ease; }
      .aghi-aw-inbox-btn:hover { color: var(--white); border-color: rgba(85, 241, 248, 0.55); background: var(--glass-bg-hover); }
      .aghi-aw-inbox-btn svg { width: 20px; height: 20px; }
      .aghi-aw-inbox-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 8px; background: #e05260; border: 2px solid var(--charcoal); color: #fff; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 10px; line-height: 12px; text-align: center; box-sizing: border-box; }

      .aghi-aw-avatar-btn { width: 38px; height: 38px; border-radius: 9px; padding: 0; cursor: pointer; border: 1px solid var(--glass-border); background: var(--glass-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; transition: all 0.18s ease; }
      .aghi-aw-monogram { font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--white); user-select: none; }
      .aghi-aw-avatar-btn:hover, .aghi-aw-avatar-btn[aria-expanded="true"] { border-color: var(--glass-border-active); box-shadow: 0 0 10px rgba(85, 241, 248, 0.35); }

      /* (the old .aghi-aw-request-btn squares were replaced by .aghi-aw-pill) */

      /* Shared design tokens for the dropdown panels (same values the DM
        panels set on .aghi-aw-dm-panel — kept in sync by hand). */
      .aghi-aw-popup, .aghi-aw-inbox-panel, .aghi-aw-friends-panel {
        --dm-cyan: var(--cyan, #55F1F8);
        --dm-text: var(--white, #F1F2F5);
        --dm-text-dim: var(--silver, #AEB7C0);
        --dm-text-faint: var(--steel, #767CA1);
        --dm-line: rgba(255, 255, 255, 0.09);
        --dm-line-strong: rgba(85, 241, 248, 0.4);
        --dm-surface-hover: rgba(255, 255, 255, 0.08);
        color: var(--dm-text);
        font-family: 'Inter', sans-serif;
      }

      .aghi-aw-popup { position: absolute; top: calc(100% + 10px); right: 0; width: 316px; max-width: calc(100vw - 24px); max-height: min(660px, 86vh); display: flex; flex-direction: column; background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99)); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%); border: 1px solid rgba(255, 255, 255, 0.11); border-radius: 14px; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06); z-index: 1000; overflow: hidden; }
      .aghi-aw-popup::before { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0; background: repeating-linear-gradient(180deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px), radial-gradient(circle at 50% 0%, rgba(85,241,248,0.05), transparent 60%); }
      .aghi-aw-popup > * { position: relative; z-index: 1; }
      .aghi-aw-main { position: relative; display: flex; flex-direction: column; min-height: 0; }
      .aghi-aw-popup-head-actions { position: absolute; top: 8px; right: 8px; z-index: 6; display: flex; gap: 6px; }
      .aghi-aw-banner { height: 92px; flex-shrink: 0; background: linear-gradient(135deg, rgba(3, 3, 126, 0.5), rgba(21, 22, 28, 0.85)); background-size: cover; background-position: center; position: relative; cursor: pointer; }
      .aghi-aw-banner::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--cyan, #55F1F8), var(--tech, #3096C7), transparent); box-shadow: 0 0 10px rgba(85,241,248,0.6); }
      .aghi-aw-banner-hover { position: absolute; inset: 0; background: rgba(6, 11, 16, 0.65); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.04em; color: var(--white, #F1F2F5); opacity: 0; transition: opacity 0.15s ease; pointer-events: none; }
      .aghi-aw-banner-hover svg { width: 14px; height: 14px; }
      .aghi-aw-banner:hover .aghi-aw-banner-hover { opacity: 1; }
      .aghi-aw-popup-body { padding: 0 14px 14px; margin-top: -30px; position: relative; }

      .aghi-aw-avatar-wrap { width: 64px; height: 64px; border-radius: 50%; position: relative; cursor: pointer; border: 4px solid var(--charcoal); margin-bottom: 8px; box-shadow: 0 0 0 1px rgba(85,241,248,0.4), 0 0 14px rgba(48,150,199,0.35); }
      .aghi-aw-popup-avatar { width: 100%; height: 100%; border-radius: 50%; background-color: var(--charcoal); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .aghi-aw-popup-avatar .aghi-aw-monogram { font-size: 22px; }
      .aghi-aw-avatar-hover { position: absolute; inset: 0; border-radius: 50%; background: rgba(6, 11, 16, 0.7); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.15s; pointer-events: none; }
      .aghi-aw-avatar-wrap:hover .aghi-aw-avatar-hover { opacity: 1; }
      .aghi-aw-avatar-hover svg { width: 20px; height: 20px; }

      /* Main-view status / about rows (click through to Settings) */
      .aghi-aw-status-row { display: flex; align-items: center; gap: 7px; margin: 2px -8px 0; padding: 5px 8px; border-radius: 8px; cursor: pointer; transition: background 0.15s ease; }
      .aghi-aw-status-row:hover { background: rgba(255, 255, 255, 0.05); }
      .aghi-aw-status-text { flex: 1; min-width: 0; font-size: 12.5px; line-height: 1.35; color: var(--dm-text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .aghi-aw-status-text.aghi-aw-empty { color: var(--dm-text-faint); font-style: italic; }
      .aghi-aw-row-pencil { flex-shrink: 0; display: flex; color: var(--dm-text-faint); opacity: 0; transition: opacity 0.15s ease; }
      .aghi-aw-row-pencil svg { width: 12px; height: 12px; }
      .aghi-aw-status-row:hover .aghi-aw-row-pencil, .aghi-aw-main-section:hover .aghi-aw-row-pencil { opacity: 1; }
      .aghi-aw-main-section { margin: 12px 0 4px; padding: 9px 11px; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; }
      .aghi-aw-main-section:hover { border-color: rgba(85, 241, 248, 0.35); background: rgba(255, 255, 255, 0.045); }

      /* Settings view */
      .aghi-aw-settings { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .aghi-aw-settings-head { display: flex; align-items: center; gap: 9px; padding: 10px 12px 9px; border-bottom: var(--dm-line); flex-shrink: 0; }
      .aghi-aw-settings-body { flex: 1; min-height: 0; overflow-y: auto; padding: 2px 14px 14px; scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-aw-settings-body::-webkit-scrollbar { width: 6px; }
      .aghi-aw-settings-body::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-settings-body::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }
      .aghi-aw-settings-section { margin: 14px 0 4px; }
      .aghi-aw-banner-preview { height: 64px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); background: linear-gradient(135deg, rgba(3, 3, 126, 0.35), rgba(21, 22, 28, 0.8)); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--dm-text-faint); margin-bottom: 8px; }

      .aghi-aw-username-row { display: flex; align-items: center; gap: 6px; cursor: pointer; margin-top: 2px; }
      .aghi-aw-username { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: var(--white); margin: 0; text-shadow: 0 0 12px rgba(85,241,248,0.25); }
      .aghi-aw-username-edit-icon { opacity: 0; transition: opacity 0.15s; display: flex; }
      .aghi-aw-username-row:hover .aghi-aw-username-edit-icon { opacity: 1; }
      .aghi-aw-username-edit-icon svg { width: 13px; height: 13px; color: var(--steel); }
      .aghi-aw-username-row.aghi-aw-locked { cursor: default; }
      .aghi-aw-username-row.aghi-aw-locked:hover .aghi-aw-username-edit-icon { opacity: 0.4; }
      .aghi-aw-username-cooldown { font-size: 10px; color: var(--steel); margin: 2px 0 0; }

      .aghi-aw-role { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 4px; padding: 2px 8px; margin: 6px 0 10px; }

      .aghi-aw-presence-btn { display: flex; align-items: center; gap: 8px; width: 100%; background: var(--glass-bg); border: 1px solid var(--glass-border); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; cursor: pointer; color: var(--white); font-size: 13px; font-family: 'Inter', sans-serif; transition: all 0.18s ease; }
      .aghi-aw-presence-btn:hover { border-color: var(--glass-border-active); background: var(--glass-bg-hover); }
      .aghi-aw-presence-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .aghi-aw-presence-btn .aghi-aw-presence-label { flex: 1; text-align: left; }
      .aghi-aw-presence-chevron { color: var(--steel); }

      .aghi-aw-presence-menu { position: absolute; left: 16px; right: 16px; margin-top: -6px; background: var(--glass-bg); backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%); border: 1px solid var(--glass-border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); z-index: 1001; overflow: hidden; }
      .aghi-aw-presence-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; background: none; border: none; color: var(--silver); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; text-align: left; transition: all 0.18s ease; }
      .aghi-aw-presence-option:hover { background: var(--glass-bg-hover); color: var(--white); }
      .aghi-aw-presence-option.aghi-aw-selected { color: var(--cyan); }

      .aghi-aw-input, .aghi-aw-textarea { width: 100%; box-sizing: border-box; background: var(--charcoal); border: 1px solid var(--glass-border); border-radius: 6px; padding: 8px 10px; color: var(--white); font-family: 'Inter', sans-serif; font-size: 13px; resize: vertical; transition: all 0.18s ease; }
      .aghi-aw-input:focus, .aghi-aw-textarea:focus { outline: none; border-color: var(--glass-border-active); box-shadow: 0 0 12px rgba(85,241,248,0.18); }
      .aghi-aw-charcount { font-size: 10px; color: var(--steel); text-align: right; margin-top: 3px; }

      .aghi-aw-edit-actions { display: flex; gap: 8px; margin-top: 8px; }
      .aghi-aw-btn { flex: 1; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.03em; border: none; transition: all 0.18s ease; }
      .aghi-aw-btn-save { background: linear-gradient(180deg, var(--tech), var(--royal)); color: #fff; }
      .aghi-aw-btn-save:hover { filter: brightness(1.15); }
      .aghi-aw-btn-cancel { background: transparent; border: 1px solid var(--glass-border); color: var(--silver); }
      .aghi-aw-btn-cancel:hover { border-color: var(--glass-border-active); color: var(--white); }

      /* (the old glass .aghi-aw-section boxes were replaced by the settings
         view sections above — .aghi-aw-about-label/-text are still shared) */
      .aghi-aw-about-label { display: flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); margin-bottom: 8px; }
      .aghi-aw-about-label::before { content: ''; width: 3px; height: 10px; border-radius: 2px; background: linear-gradient(180deg, var(--cyan), var(--tech)); box-shadow: 0 0 6px rgba(85,241,248,0.6); }
      .aghi-aw-about-text { font-size: 13px; line-height: 1.5; color: var(--silver); white-space: pre-wrap; }
      .aghi-aw-about-text.aghi-aw-empty { color: var(--steel); font-style: italic; }

      .aghi-aw-subroles-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; margin-bottom: 10px; }
      .aghi-aw-subrole-badge { font-size: 10px; font-family: 'JetBrains Mono', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; }

      .aghi-aw-upload-label { display: block; text-align: center; padding: 8px 10px; border-radius: 6px; cursor: pointer; background: rgba(85,241,248,0.08); border: 1px solid var(--glass-border-active); color: var(--cyan); font-size: 12px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.03em; margin-bottom: 8px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
      .aghi-aw-upload-label:hover { background: rgba(85,241,248,0.14); }
      .aghi-aw-upload-hint { font-size: 10px; color: var(--steel); text-align: center; margin: -4px 0 10px; }

      .aghi-aw-reset-link { display: block; width: 100%; text-align: center; background: none; border: none; color: var(--silver); font-size: 11px; cursor: pointer; margin-bottom: 10px; text-decoration: underline; }
      .aghi-aw-reset-link:hover { color: var(--white); }

      .aghi-aw-pfp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .aghi-aw-pfp-option { width: 100%; aspect-ratio: 1; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
      .aghi-aw-pfp-option.aghi-aw-selected { border-color: var(--cyan); box-shadow: 0 0 6px rgba(85,241,248,0.4); }

      .aghi-aw-logout { width: 100%; margin-top: 4px; padding: 8px; background: rgba(217,85,85,0.08); border: 1px solid rgba(217,85,85,0.3); border-radius: 6px; color: #ff8b8b; font-family: 'Space Grotesk', sans-serif; font-size: 12px; letter-spacing: 0.03em; cursor: pointer; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
      .aghi-aw-logout:hover { background: rgba(217,85,85,0.15); }

      .aghi-aw-error { font-size: 11px; color: #ff8b8b; margin-top: 6px; }

      /* Shared animated backdrop for the dropdown panels (mobile sheets) */
      .aghi-aw-backdrop { position: fixed; inset: 0; z-index: 998; background: rgba(8, 10, 15, 0.62); backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%); animation: aghiDmBackdropIn 0.28s ease both; }
      .aghi-aw-backdrop.aghi-aw-leave { animation: aghiDmBackdropOut 0.2s ease both; pointer-events: none; }

      /* Open/close — enter class only on initial mount, like the DM panels */
      .aghi-aw-popup.aghi-aw-enter, .aghi-aw-inbox-panel.aghi-aw-enter, .aghi-aw-friends-panel.aghi-aw-enter { animation: aghiDmPanelIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .aghi-aw-popup.aghi-aw-leave, .aghi-aw-inbox-panel.aghi-aw-leave, .aghi-aw-friends-panel.aghi-aw-leave { animation: aghiDmPanelOut 0.2s cubic-bezier(0.4, 0, 1, 1) both; pointer-events: none; }

      .aghi-aw-dm-icon-btn[disabled] { opacity: 0.4; cursor: default; }

      @media (max-width: 768px) {
        .aghi-aw-popup, .aghi-aw-inbox-panel, .aghi-aw-friends-panel {
          position: fixed; left: 0; right: 0; bottom: 0; top: auto;
          width: auto; max-width: none;
          border-radius: 18px 18px 0 0; border-left: none; border-right: none; border-bottom: none;
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .aghi-aw-popup { max-height: 88vh; }
        .aghi-aw-inbox-panel { height: auto; min-height: 320px; max-height: 80vh; }
        .aghi-aw-friends-panel { height: auto; min-height: 320px; max-height: 84vh; }
        .aghi-aw-popup::after, .aghi-aw-inbox-panel::after, .aghi-aw-friends-panel::after {
          content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
          width: 40px; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.22); z-index: 7; pointer-events: none;
        }
        .aghi-aw-popup.aghi-aw-enter, .aghi-aw-inbox-panel.aghi-aw-enter, .aghi-aw-friends-panel.aghi-aw-enter { animation-name: aghiDmSheetIn; }
        .aghi-aw-popup.aghi-aw-leave, .aghi-aw-inbox-panel.aghi-aw-leave, .aghi-aw-friends-panel.aghi-aw-leave { animation-name: aghiDmSheetOut; }
      }

      @media (prefers-reduced-motion: reduce) {
        .aghi-aw-popup.aghi-aw-enter, .aghi-aw-popup.aghi-aw-leave,
        .aghi-aw-inbox-panel.aghi-aw-enter, .aghi-aw-inbox-panel.aghi-aw-leave,
        .aghi-aw-friends-panel.aghi-aw-enter, .aghi-aw-friends-panel.aghi-aw-leave,
        .aghi-aw-backdrop { animation: none !important; }
      }

      .aghi-aw-inbox-panel { position: absolute; top: calc(100% + 10px); right: 0; width: 340px; max-width: calc(100vw - 24px); height: min(480px, 70vh); display: flex; flex-direction: column; background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99)); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%); border: 1px solid rgba(255, 255, 255, 0.11); border-radius: 14px; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06); z-index: 1000; overflow: hidden; }

      .aghi-aw-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 12px 10px 16px; border-bottom: var(--dm-line); flex-shrink: 0; }
      .aghi-aw-panel-head-actions { display: flex; align-items: center; gap: 6px; }
      .aghi-aw-panel-chip { min-width: 18px; height: 18px; padding: 0 6px; border-radius: 9px; background: rgba(85, 241, 248, 0.12); border: 1px solid rgba(85, 241, 248, 0.4); color: var(--dm-cyan); font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 10.5px; line-height: 16px; text-align: center; }

      .aghi-aw-inbox-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-aw-inbox-list::-webkit-scrollbar { width: 6px; }
      .aghi-aw-inbox-list::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-inbox-list::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }
      .aghi-aw-inbox-section { display: flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dm-cyan); margin: 10px 6px 4px; }
      .aghi-aw-inbox-section::before { content: ''; width: 3px; height: 10px; border-radius: 2px; background: linear-gradient(180deg, var(--dm-cyan), #3096C7); box-shadow: 0 0 6px rgba(85, 241, 248, 0.6); }
      .aghi-aw-inbox-item { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 10px; border: 1px solid transparent; transition: background 0.15s ease, border-color 0.15s ease; }
      .aghi-aw-inbox-item:hover { background: var(--dm-surface-hover); }
      .aghi-aw-inbox-item.aghi-aw-clickable { cursor: pointer; }
      .aghi-aw-inbox-item.aghi-aw-unread { background: rgba(85, 241, 248, 0.05); border-color: rgba(85, 241, 248, 0.18); }
      .aghi-aw-inbox-item.aghi-aw-unread::after { content: ''; position: absolute; top: 12px; right: 10px; width: 7px; height: 7px; border-radius: 50%; background: var(--dm-cyan); box-shadow: 0 0 6px rgba(85, 241, 248, 0.7); }
      .aghi-aw-inbox-avatar-wrap { position: relative; width: 36px; height: 36px; flex-shrink: 0; }
      .aghi-aw-inbox-avatar { width: 100%; height: 100%; border-radius: 50%; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.1); }
      .aghi-aw-inbox-avatar .aghi-aw-monogram { font-size: 13px; }
      .aghi-aw-inbox-kind { position: absolute; right: -5px; bottom: -5px; width: 15px; height: 15px; border-radius: 50%; background: #262c39; border: 1.5px solid #14171e; box-sizing: content-box; display: flex; align-items: center; justify-content: center; color: var(--dm-cyan); }
      .aghi-aw-inbox-kind svg { width: 8px; height: 8px; }
      .aghi-aw-inbox-body { flex: 1; min-width: 0; padding-right: 12px; }
      .aghi-aw-inbox-text { font-size: 12.5px; line-height: 1.45; color: var(--dm-text-dim); }
      .aghi-aw-inbox-text strong { color: var(--dm-text); }
      .aghi-aw-inbox-time { font-size: 10px; color: var(--dm-text-faint); margin-top: 3px; font-family: 'JetBrains Mono', monospace; }
      .aghi-aw-inbox-actions { display: flex; gap: 6px; margin-top: 8px; }

      .aghi-aw-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 999px; border: 1px solid transparent; font-family: 'Space Grotesk', sans-serif; font-size: 11px; letter-spacing: 0.03em; cursor: pointer; transition: background 0.15s ease; }
      .aghi-aw-pill svg { width: 12px; height: 12px; }
      .aghi-aw-pill-accept { background: rgba(61, 220, 132, 0.12); border-color: rgba(61, 220, 132, 0.45); color: #3ddc84; }
      .aghi-aw-pill-accept:hover { background: rgba(61, 220, 132, 0.22); }
      .aghi-aw-pill-decline { background: rgba(224, 82, 96, 0.1); border-color: rgba(224, 82, 96, 0.4); color: #ff9aa4; }
      .aghi-aw-pill-decline:hover { background: rgba(224, 82, 96, 0.2); }

      .aghi-aw-inbox-empty { text-align: center; padding: 36px 16px; color: var(--dm-text-faint); font-size: 12.5px; line-height: 1.5; }
      .aghi-aw-inbox-loading { text-align: center; padding: 24px 16px; color: var(--dm-text-faint); font-size: 12px; }

      .aghi-aw-inbox-loadmore { display: block; width: calc(100% - 12px); margin: 4px 6px 8px; background: none; border: 1px solid rgba(255, 255, 255, 0.12); color: var(--dm-text-dim); padding: 7px; border-radius: 8px; font-size: 11.5px; font-family: 'JetBrains Mono', monospace; cursor: pointer; flex-shrink: 0; transition: all 0.15s ease; }
      .aghi-aw-inbox-loadmore:hover { border-color: var(--dm-line-strong); color: var(--dm-cyan); }
      .aghi-aw-inbox-loadmore[hidden] { display: none; }

      @media (max-width: 768px) {
        .aghi-aw-inbox-panel { position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 1000; width: auto; max-width: none; max-height: 82vh; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 0); }
        .aghi-aw-inbox-panel::after { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.2); z-index: 2; }
      }

      /* --- Friends List --- */
      .aghi-aw-friends-panel {
        position: absolute; top: calc(100% + 10px); right: 0; width: 320px; max-width: calc(100vw - 24px);
        height: min(520px, 72vh); display: flex; flex-direction: column;
        background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99)); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%);
        border: 1px solid rgba(255, 255, 255, 0.11); border-radius: 14px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        z-index: 1000; overflow: hidden;
      }
      .aghi-aw-friends-count { min-width: 18px; height: 18px; padding: 0 7px; border-radius: 9px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: var(--dm-text-dim); font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 600; line-height: 16px; text-align: center; }
      /* Reuses the DM search wrapper/input styles verbatim */
      .aghi-aw-friends-search { position: relative; padding: 8px 12px 8px; flex-shrink: 0; }
      .aghi-aw-friends-search .aghi-aw-dm-search-ic { left: 23px; top: 50%; }

      .aghi-aw-friends-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 2px; scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-aw-friends-list::-webkit-scrollbar { width: 6px; }
      .aghi-aw-friends-list::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-friends-list::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }
      .aghi-aw-friends-item { position: relative; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; transition: background 0.15s ease; }
      .aghi-aw-friends-item:hover { background: var(--dm-surface-hover); }
      .aghi-aw-friends-avatar-wrap { position: relative; flex-shrink: 0; }
      .aghi-aw-friends-avatar { position: relative; width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.1); }
      .aghi-aw-friends-avatar .aghi-aw-monogram { font-size: 13px; }
      .aghi-aw-friends-body { flex: 1; min-width: 0; }
      .aghi-aw-friends-name { font-size: 13px; font-weight: 600; color: var(--dm-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-friends-status { font-size: 11px; color: var(--dm-text-dim); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-friends-status.aghi-aw-friends-online { color: #3ddc84; }
      .aghi-aw-friends-status.aghi-aw-friends-away { color: #f5c542; }
      .aghi-aw-friends-status.aghi-aw-friends-dnd { color: #e05260; }
      .aghi-aw-friends-remove { width: 26px; height: 26px; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 7px; color: var(--dm-text-faint); cursor: pointer; opacity: 0; transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease; }
      .aghi-aw-friends-item:hover .aghi-aw-friends-remove { opacity: 1; }
      .aghi-aw-friends-remove:hover { background: rgba(224, 82, 96, 0.15); color: #ff9aa4; }
      .aghi-aw-friends-remove svg { width: 13px; height: 13px; }
      @media (hover: none) {
        .aghi-aw-friends-remove { opacity: 0.75; }
      }

      .aghi-aw-friends-empty { text-align: center; padding: 36px 16px; color: var(--dm-text-faint); font-size: 12.5px; line-height: 1.5; }
      .aghi-aw-friends-loading { text-align: center; padding: 24px 16px; color: var(--dm-text-faint); font-size: 12px; }

      @media (max-width: 768px) {
        .aghi-aw-friends-panel { position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 1000; width: auto; max-width: none; max-height: 82vh; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 0); }
        .aghi-aw-friends-panel::after { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.2); z-index: 2; }
      }

      /* Confirm modal (message delete etc.) — z-index sits above the
         profile popup (9999) since it's used for unfriend confirms there. */
      .aghi-aw-modal-backdrop { position: fixed; inset: 0; z-index: 11000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(8, 10, 15, 0.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); animation: aghiDmBackdropIn 0.2s ease both; }
      .aghi-aw-modal { width: 100%; max-width: 360px; background: linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(17, 19, 26, 0.99)); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 18px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55); font-family: 'Inter', sans-serif; animation: aghiDmPanelIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .aghi-aw-modal-title { margin: 0 0 6px; font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--white, #F1F2F5); }
      .aghi-aw-modal-msg { margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: var(--silver, #AEB7C0); }
      .aghi-aw-modal-actions { display: flex; gap: 8px; }
      .aghi-aw-modal-btn { flex: 1; padding: 8px 10px; border-radius: 8px; font-size: 12.5px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.03em; cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; }
      .aghi-aw-modal-cancel { background: transparent; border-color: rgba(255, 255, 255, 0.14); color: var(--silver, #AEB7C0); }
      .aghi-aw-modal-cancel:hover { color: var(--white, #F1F2F5); border-color: rgba(255, 255, 255, 0.3); }
      .aghi-aw-modal-confirm { background: linear-gradient(135deg, #e05260, #b23448); border: none; color: #fff; font-weight: 600; }
      .aghi-aw-modal-confirm:hover { filter: brightness(1.12); }

      /* Discord-style avatar/banner crop editor */
      .aghi-aw-modal.aghi-aw-adjust { max-width: 320px; }
      .aghi-aw-adjust-frame { position: relative; overflow: hidden; margin-bottom: 10px; background: #0d0f14; touch-action: none; }
      .aghi-aw-adjust-frame.is-avatar { width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 10px; }
      .aghi-aw-adjust-frame.is-banner { width: 100%; height: 71px; border-radius: 8px; }
      .aghi-aw-adjust-frame img { position: absolute; top: 0; left: 0; transform-origin: 0 0; max-width: none; user-select: none; -webkit-user-drag: none; cursor: grab; }
      .aghi-aw-adjust-frame img.is-dragging { cursor: grabbing; }
      .aghi-aw-adjust-hint { font-size: 11px; color: var(--silver, #AEB7C0); text-align: center; margin: 0 0 10px; }
      .aghi-aw-adjust-zoom { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
      .aghi-aw-adjust-zoom span { color: var(--steel, #767CA1); font-family: 'JetBrains Mono', monospace; font-size: 12px; flex-shrink: 0; }
      .aghi-aw-adjust-zoom input[type="range"] { flex: 1; accent-color: #3096C7; cursor: pointer; }

      /* --- Direct Messages -------------------------------------------------
        Both shells are near-opaque on purpose: raw 3.5%-white glass behind
        text made the panels unreadable over busy pages. The glass feel comes
        from the blur, hairline borders and a faint cyan tint instead. ------ */
      .aghi-aw-dm-panel {
        --dm-cyan: var(--cyan, #55F1F8);
        --dm-text: var(--white, #F1F2F5);
        --dm-text-dim: var(--silver, #AEB7C0);
        --dm-text-faint: var(--steel, #767CA1);
        --dm-line: rgba(255, 255, 255, 0.09);
        --dm-line-strong: rgba(85, 241, 248, 0.4);
        --dm-surface-hover: rgba(255, 255, 255, 0.08);
        color: var(--dm-text);
        font-family: 'Inter', sans-serif;
      }

      .aghi-aw-dm-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 8px; background: #e05260; border: 2px solid var(--charcoal, #15161C); color: #fff; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 10px; line-height: 12px; text-align: center; box-sizing: border-box; }

      /* Quick dropdown (desktop) / bottom sheet (mobile) */
      .aghi-aw-dm-panel-quick {
        position: absolute; top: calc(100% + 10px); right: 0;
        width: 380px; max-width: calc(100vw - 24px);
        height: min(560px, 76vh);
        display: flex; flex-direction: column;
        background:
          radial-gradient(130% 60% at 50% 0%, rgba(48, 150, 199, 0.1), transparent 62%),
          linear-gradient(180deg, rgba(28, 31, 41, 0.99), rgba(15, 17, 23, 0.99));
        backdrop-filter: blur(28px) saturate(150%);
        -webkit-backdrop-filter: blur(28px) saturate(150%);
        border: 1px solid rgba(255, 255, 255, 0.11);
        border-radius: 14px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        z-index: 1000; overflow: hidden;
      }

      /* Full messaging window (desktop) / fullscreen (mobile) */
      .aghi-aw-dm-panel-full {
        position: fixed; inset: 0; margin: auto;
        width: min(1080px, calc(100vw - 40px));
        height: min(720px, calc(100vh - 56px));
        display: flex;
        background:
          radial-gradient(90% 55% at 15% 0%, rgba(3, 3, 126, 0.22), transparent 60%),
          radial-gradient(90% 55% at 88% 100%, rgba(48, 150, 199, 0.08), transparent 60%),
          linear-gradient(180deg, rgba(24, 27, 35, 0.99), rgba(14, 16, 22, 0.99));
        backdrop-filter: blur(28px) saturate(150%);
        -webkit-backdrop-filter: blur(28px) saturate(150%);
        border: 1px solid rgba(255, 255, 255, 0.11);
        border-radius: 18px;
        box-shadow: 0 32px 90px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        z-index: 1000; overflow: hidden;
      }

      /* Open/close — the enter class is only added on the initial mount, so
        poll-driven rebuilds of the panel never replay the animation. */
      .aghi-aw-dm-panel.aghi-aw-dm-enter { animation: aghiDmPanelIn 0.34s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .aghi-aw-dm-panel.aghi-aw-dm-leave { animation: aghiDmPanelOut 0.2s cubic-bezier(0.4, 0, 1, 1) both; pointer-events: none; }
      @keyframes aghiDmPanelIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
      @keyframes aghiDmPanelOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(10px) scale(0.98); } }
      @keyframes aghiDmSheetIn { from { transform: translateY(100%); } to { transform: none; } }
      @keyframes aghiDmSheetOut { from { transform: none; } to { transform: translateY(100%); } }

      .aghi-aw-dm-backdrop { position: fixed; inset: 0; z-index: 998; background: rgba(8, 10, 15, 0.62); backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%); animation: aghiDmBackdropIn 0.28s ease both; }
      .aghi-aw-dm-backdrop.aghi-aw-dm-leave { animation: aghiDmBackdropOut 0.2s ease both; pointer-events: none; }
      @keyframes aghiDmBackdropIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes aghiDmBackdropOut { from { opacity: 1; } to { opacity: 0; } }

      @media (prefers-reduced-motion: reduce) {
        .aghi-aw-dm-panel.aghi-aw-dm-enter, .aghi-aw-dm-panel.aghi-aw-dm-leave,
        .aghi-aw-dm-backdrop, .aghi-aw-dm-msg-enter, .aghi-aw-modal { animation: none !important; }
      }

      /* Sidebar (full window) */
      .aghi-aw-dm-full-sidebar { width: 320px; min-width: 320px; flex-shrink: 0; display: flex; flex-direction: column; background: rgba(10, 12, 17, 0.5); border-right: 1px solid var(--dm-line); }
      .aghi-aw-dm-full-sidebar-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 16px 14px 12px 16px; }
      .aghi-aw-dm-panel-title { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dm-cyan); margin: 0; text-shadow: 0 0 14px rgba(85, 241, 248, 0.3); }
      .aghi-aw-dm-icon-btn { width: 30px; height: 30px; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--dm-text-dim); cursor: pointer; border-radius: 8px; transition: all 0.18s ease; }
      .aghi-aw-dm-icon-btn:hover { color: var(--dm-text); border-color: var(--dm-line-strong); background: rgba(85, 241, 248, 0.1); }
      .aghi-aw-dm-icon-btn svg { width: 15px; height: 15px; }

      .aghi-aw-dm-full-search { position: relative; padding: 2px 14px 10px; }
      .aghi-aw-dm-search-ic { position: absolute; left: 25px; top: 21px; transform: translateY(-50%); width: 14px; height: 14px; color: var(--dm-text-faint); pointer-events: none; }
      .aghi-aw-dm-search-input { width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 9px; padding: 8px 12px 8px 32px; color: var(--dm-text); font-family: 'Inter', sans-serif; font-size: 13px; transition: border-color 0.18s ease, box-shadow 0.18s ease; }
      .aghi-aw-dm-search-input:focus { outline: none; border-color: var(--dm-line-strong); box-shadow: 0 0 0 3px rgba(85, 241, 248, 0.12); }
      .aghi-aw-dm-search-input::placeholder { color: var(--dm-text-faint); }

      /* Conversation list */
      .aghi-aw-dm-threads { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 10px 12px; display: flex; flex-direction: column; gap: 2px; }
      .aghi-aw-dm-thread-item { display: flex; align-items: center; gap: 11px; padding: 10px; border-radius: 11px; cursor: pointer; border: 1px solid transparent; transition: background 0.15s ease, border-color 0.15s ease; }
      .aghi-aw-dm-thread-item:hover { background: var(--dm-surface-hover); }
      .aghi-aw-dm-thread-item.aghi-aw-dm-thread-active { background: rgba(85, 241, 248, 0.08); border-color: rgba(85, 241, 248, 0.22); }
      .aghi-aw-dm-thread-avatar { position: relative; width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.1); }
      .aghi-aw-dm-thread-avatar .aghi-aw-monogram { font-size: 15px; }
      .aghi-aw-dm-thread-body { flex: 1; min-width: 0; }
      .aghi-aw-dm-thread-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
      .aghi-aw-dm-thread-name { font-size: 13.5px; font-weight: 600; color: var(--dm-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-dm-thread-time { font-size: 10px; color: var(--dm-text-faint); flex-shrink: 0; font-family: 'JetBrains Mono', monospace; }
      .aghi-aw-dm-thread-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
      .aghi-aw-dm-thread-preview { font-size: 12.5px; color: var(--dm-text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .aghi-aw-dm-thread-item.aghi-aw-dm-thread-unread .aghi-aw-dm-thread-preview { color: var(--dm-text); }
      .aghi-aw-dm-thread-unread-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; flex-shrink: 0; background: var(--dm-cyan); color: #062027; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 10.5px; line-height: 18px; text-align: center; box-shadow: 0 0 10px rgba(85, 241, 248, 0.45); }
      .aghi-aw-dm-presence-dot { position: absolute; right: -2px; bottom: -2px; width: 11px; height: 11px; border-radius: 50%; border: 2.5px solid #14171e; box-sizing: content-box; }

      /* Chat column */
      .aghi-aw-dm-chat-area { flex: 1; min-width: 0; display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.015); }
      .aghi-aw-dm-chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--dm-text-faint); padding: 24px; text-align: center; }
      .aghi-aw-dm-chat-empty-icon { width: 54px; height: 54px; opacity: 0.35; margin-bottom: 8px; }
      .aghi-aw-dm-chat-empty-icon svg { width: 100%; height: 100%; }
      .aghi-aw-dm-chat-empty-title { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: var(--dm-text-dim); }
      .aghi-aw-dm-chat-empty-sub { font-size: 12.5px; max-width: 260px; line-height: 1.5; }

      .aghi-aw-dm-header { display: flex; align-items: center; gap: 10px; min-height: 58px; padding: 9px 14px; border-bottom: 1px solid var(--dm-line); background: rgba(255, 255, 255, 0.02); flex-shrink: 0; }
      .aghi-aw-dm-back { width: 30px; height: 30px; padding: 0; flex-shrink: 0; display: none; align-items: center; justify-content: center; background: transparent; border: none; color: var(--dm-text-dim); cursor: pointer; border-radius: 8px; transition: all 0.15s ease; }
      .aghi-aw-dm-back:hover { color: var(--dm-text); background: rgba(255, 255, 255, 0.06); }
      .aghi-aw-dm-back svg { width: 18px; height: 18px; }
      .aghi-aw-dm-panel-quick .aghi-aw-dm-back { display: flex; }
      .aghi-aw-dm-header-avatar-wrap { position: relative; width: 38px; height: 38px; flex-shrink: 0; }
      .aghi-aw-dm-header-avatar { width: 100%; height: 100%; border-radius: 50%; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.12); }
      .aghi-aw-dm-header-avatar .aghi-aw-monogram { font-size: 14px; }
      .aghi-aw-dm-header-info { flex: 1; min-width: 0; }
      .aghi-aw-dm-header-name { font-family: 'Space Grotesk', sans-serif; font-size: 14.5px; font-weight: 600; color: var(--dm-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-dm-header-status { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--dm-text-faint); margin-top: 2px; }
      .aghi-aw-dm-header-status[hidden] { display: none; }
      .aghi-aw-dm-header-actions { display: flex; align-items: center; gap: 6px; }
      .aghi-aw-dm-typing-dots { display: inline-flex; align-items: center; gap: 3px; }
      .aghi-aw-dm-typing-dots span { width: 4px; height: 4px; border-radius: 50%; background: var(--dm-cyan); animation: aghiDmTypingBounce 1.2s infinite ease-in-out; }
      .aghi-aw-dm-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
      .aghi-aw-dm-typing-dots span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes aghiDmTypingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-3px); opacity: 1; } }
      .aghi-aw-dm-typing-label { color: var(--dm-cyan); font-style: italic; }

      /* Messages */
      .aghi-aw-dm-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 14px 10px; display: flex; flex-direction: column; gap: 2px; }
      .aghi-aw-dm-loading, .aghi-aw-dm-empty { margin: auto; text-align: center; padding: 24px 12px; color: var(--dm-text-faint); font-size: 13px; line-height: 1.5; }
      .aghi-aw-dm-msg { position: relative; display: flex; flex-direction: column; max-width: min(78%, 560px); padding-top: 7px; }
      .aghi-aw-dm-msg:not(.aghi-aw-dm-msg-mine) { align-self: flex-start; align-items: flex-start; }
      .aghi-aw-dm-msg-mine { align-self: flex-end; align-items: flex-end; }
      .aghi-aw-dm-msg-enter { animation: aghiDmMsgIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) both; }
      @keyframes aghiDmMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .aghi-aw-dm-bubble { padding: 9px 13px; border-radius: 16px; font-size: 13.5px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
      .aghi-aw-dm-msg:not(.aghi-aw-dm-msg-mine) .aghi-aw-dm-bubble { background: #262c39; border: 1px solid rgba(255, 255, 255, 0.08); color: var(--dm-text); border-bottom-left-radius: 6px; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-bubble { background: linear-gradient(135deg, var(--tech, #3096C7), var(--royal, #2B438E)); border: 1px solid rgba(85, 241, 248, 0.28); color: #fff; border-bottom-right-radius: 6px; }
      .aghi-aw-dm-deleted { background: transparent !important; border: 1px dashed rgba(255, 255, 255, 0.16) !important; color: var(--dm-text-faint) !important; font-style: italic; box-shadow: none !important; }
      .aghi-aw-dm-bubble-reply { display: block; border-left: 2px solid rgba(85, 241, 248, 0.55); background: rgba(8, 10, 14, 0.28); border-radius: 6px; padding: 5px 8px; margin-bottom: 6px; overflow: hidden; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-bubble-reply { border-left-color: rgba(255, 255, 255, 0.6); background: rgba(0, 0, 0, 0.18); }
      .aghi-aw-dm-bubble-reply-label { display: block; font-size: 10.5px; font-weight: 600; color: var(--dm-cyan); margin-bottom: 1px; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-bubble-reply-label { color: #d4ecff; }
      .aghi-aw-dm-bubble-reply-text { display: block; font-size: 12px; color: var(--dm-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-dm-msg-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; padding: 0 4px; font-size: 10px; color: var(--dm-text-faint); font-family: 'JetBrains Mono', monospace; }
      .aghi-aw-dm-msg-edited { font-style: italic; }
      .aghi-aw-dm-ticks { display: flex; align-items: center; color: var(--dm-text-faint); }
      .aghi-aw-dm-ticks svg { width: 13px; height: 13px; }
      .aghi-aw-dm-ticks.aghi-aw-dm-seen { color: var(--dm-cyan); }

      /* Hover actions (react / reply / edit / delete) — anchored to the
        bubble's inner edge so they grow toward the panel center and never
        clip against the panel boundary on short messages. */
      .aghi-aw-dm-msg-actions { position: absolute; top: -16px; z-index: 3; display: flex; gap: 1px; padding: 3px; background: rgba(20, 23, 31, 0.96); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
      .aghi-aw-dm-msg:not(.aghi-aw-dm-msg-mine) .aghi-aw-dm-msg-actions { left: -6px; }
      .aghi-aw-dm-msg-mine .aghi-aw-dm-msg-actions { right: -6px; }
      .aghi-aw-dm-msg:hover .aghi-aw-dm-msg-actions, .aghi-aw-dm-msg-actions:focus-within { opacity: 1; pointer-events: auto; }
      .aghi-aw-dm-msg-action-btn { width: 24px; height: 24px; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 6px; color: var(--dm-text-faint); cursor: pointer; transition: all 0.15s ease; }
      .aghi-aw-dm-msg-action-btn:hover { background: rgba(255, 255, 255, 0.08); color: var(--dm-text); }
      .aghi-aw-dm-msg-action-btn svg { width: 13px; height: 13px; }
      .aghi-aw-dm-action-danger:hover { background: rgba(224, 82, 96, 0.15); color: #ff9aa4; }
      @media (hover: none) {
        .aghi-aw-dm-msg-actions { position: static; opacity: 0.85; pointer-events: auto; margin: 0 0 2px; padding: 0; background: transparent; border: none; box-shadow: none; }
      }

      /* Reaction pills */
      .aghi-aw-dm-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
      .aghi-aw-dm-reaction-pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px 2px 4px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
      .aghi-aw-dm-reaction-pill:hover { background: rgba(255, 255, 255, 0.1); }
      .aghi-aw-dm-reaction-pill.aghi-aw-dm-reaction-active { background: rgba(85, 241, 248, 0.12); border-color: rgba(85, 241, 248, 0.5); }
      .aghi-aw-dm-reaction-emoji { width: 15px; height: 15px; display: block; }
      .aghi-aw-dm-reaction-count { font-size: 11px; color: var(--dm-text-dim); font-family: 'JetBrains Mono', monospace; }

      /* Inline edit */
      .aghi-aw-dm-edit-box { width: 100%; }
      .aghi-aw-dm-edit-input { width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); color: var(--dm-text); border: 1px solid var(--dm-line-strong); border-radius: 12px; padding: 9px 12px; font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.5; resize: vertical; min-height: 60px; }
      .aghi-aw-dm-edit-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(85, 241, 248, 0.12); }
      .aghi-aw-dm-edit-actions { display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end; }
      .aghi-aw-dm-edit-actions button { padding: 5px 12px; border-radius: 7px; font-size: 11.5px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.03em; cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; }
      .aghi-aw-dm-edit-actions [data-action="save-edit"] { background: linear-gradient(135deg, var(--tech, #3096C7), var(--royal, #2B438E)); border: none; color: #fff; }
      .aghi-aw-dm-edit-actions [data-action="save-edit"]:hover { filter: brightness(1.15); }
      .aghi-aw-dm-edit-actions [data-action="cancel-edit"] { background: transparent; border-color: rgba(255, 255, 255, 0.14); color: var(--dm-text-dim); }
      .aghi-aw-dm-edit-actions [data-action="cancel-edit"]:hover { color: var(--dm-text); border-color: rgba(255, 255, 255, 0.3); }

      /* Composer */
      .aghi-aw-dm-composer { padding: 10px 12px 12px; border-top: 1px solid var(--dm-line); background: rgba(255, 255, 255, 0.02); flex-shrink: 0; }
      .aghi-aw-dm-reply-preview { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; background: rgba(85, 241, 248, 0.06); border: 1px solid rgba(85, 241, 248, 0.2); border-radius: 10px; padding: 6px 8px; }
      .aghi-aw-dm-reply-preview[hidden] { display: none; }
      .aghi-aw-dm-reply-avatar { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; background-color: #1a2030; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
      .aghi-aw-dm-reply-avatar .aghi-aw-monogram { font-size: 10px; }
      .aghi-aw-dm-reply-texts { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .aghi-aw-dm-reply-name { font-size: 11px; font-weight: 600; color: var(--dm-cyan); }
      .aghi-aw-dm-reply-text { font-size: 12px; color: var(--dm-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aghi-aw-dm-reply-cancel { width: 22px; height: 22px; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--dm-text-faint); cursor: pointer; border-radius: 6px; transition: all 0.15s ease; }
      .aghi-aw-dm-reply-cancel:hover { color: var(--dm-text); background: rgba(255, 255, 255, 0.08); }
      .aghi-aw-dm-reply-cancel svg { width: 13px; height: 13px; }
      .aghi-aw-dm-composer-row { display: flex; gap: 8px; align-items: flex-end; }
      .aghi-aw-dm-input { flex: 1; resize: none; height: auto; min-height: 42px; max-height: 120px; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 11px 14px; color: var(--dm-text); font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.4; transition: border-color 0.18s ease, box-shadow 0.18s ease; }
      .aghi-aw-dm-input:focus { outline: none; border-color: var(--dm-line-strong); box-shadow: 0 0 0 3px rgba(85, 241, 248, 0.1); }
      .aghi-aw-dm-input::placeholder { color: var(--dm-text-faint); }
      .aghi-aw-dm-input:disabled { opacity: 0.6; }
      .aghi-aw-dm-send { width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; border: 1px solid rgba(85, 241, 248, 0.3); background: linear-gradient(135deg, var(--tech, #3096C7), var(--royal, #2B438E)); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 14px rgba(21, 145, 196, 0.3); transition: transform 0.15s ease, filter 0.15s ease; }
      .aghi-aw-dm-send:hover { transform: translateY(-1px); filter: brightness(1.12); }
      .aghi-aw-dm-send:active { transform: scale(0.94); }
      .aghi-aw-dm-emoji { width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(0, 0, 0, 0.35); color: var(--dm-text-dim); font-size: 19px; line-height: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease; }
      .aghi-aw-dm-emoji:hover { color: #fff; border-color: rgba(255, 255, 255, 0.3); transform: translateY(-1px); }
      .aghi-aw-dm-send svg { width: 16px; height: 16px; }

      /* Quick panel head (conversation list state) */
      .aghi-aw-dm-quick-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 12px 10px 16px; border-bottom: 1px solid var(--dm-line); flex-shrink: 0; }
      .aghi-aw-dm-quick-actions { display: flex; align-items: center; gap: 6px; }

      /* Shared scrollbars */
      .aghi-aw-dm-threads, .aghi-aw-dm-messages { scrollbar-width: thin; scrollbar-color: rgba(85, 241, 248, 0.35) transparent; }
      .aghi-aw-dm-threads::-webkit-scrollbar, .aghi-aw-dm-messages::-webkit-scrollbar { width: 6px; }
      .aghi-aw-dm-threads::-webkit-scrollbar-track, .aghi-aw-dm-messages::-webkit-scrollbar-track { background: transparent; }
      .aghi-aw-dm-threads::-webkit-scrollbar-thumb, .aghi-aw-dm-messages::-webkit-scrollbar-thumb { background: rgba(85, 241, 248, 0.35); border-radius: 999px; }
      .aghi-aw-dm-threads::-webkit-scrollbar-thumb:hover, .aghi-aw-dm-messages::-webkit-scrollbar-thumb:hover { background: rgba(85, 241, 248, 0.55); }

      @media (max-width: 1000px) {
        .aghi-aw-dm-full-sidebar { width: 272px; min-width: 272px; }
      }

      @media (max-width: 768px) {
        .aghi-aw-dm-panel-quick {
          position: fixed; left: 0; right: 0; bottom: 0; top: auto;
          width: auto; max-width: none; height: auto; max-height: 84vh;
          border-radius: 18px 18px 0 0; border-left: none; border-right: none; border-bottom: none;
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .aghi-aw-dm-panel-full { width: 100vw; height: 100vh; height: 100dvh; border-radius: 0; border: none; padding-bottom: env(safe-area-inset-bottom, 0); }
        .aghi-aw-dm-panel::after { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.22); z-index: 5; pointer-events: none; }
        .aghi-aw-dm-panel.aghi-aw-dm-enter { animation-name: aghiDmSheetIn; }
        .aghi-aw-dm-panel.aghi-aw-dm-leave { animation-name: aghiDmSheetOut; }
        .aghi-aw-dm-panel-full .aghi-aw-dm-back { display: flex; }
        .aghi-aw-dm-panel-full.aghi-aw-dm-has-thread .aghi-aw-dm-full-sidebar { display: none; }
        .aghi-aw-dm-panel-full:not(.aghi-aw-dm-has-thread) .aghi-aw-dm-chat-area { display: none; }
        .aghi-aw-dm-msg { max-width: 86%; }
      }

      /* Compact topbar row on small screens: shrink the icon buttons
         uniformly so the row stays on one line instead of wrapping. */
      @media (max-width: 480px) {
        .aghi-aw-row { gap: 6px; }
        .aghi-aw-inbox-btn, .aghi-aw-avatar-btn { width: 33px; height: 33px; border-radius: 8px; }
        .aghi-aw-inbox-btn svg { width: 17px; height: 17px; }
        .aghi-aw-monogram { font-size: 12px; }
        .aghi-aw-guest { gap: 10px; }
        .aghi-aw-guest a { font-size: 13px; }
        .aghi-aw-guest a.aghi-aw-signup { padding: 5px 11px; }
      }
      @media (max-width: 360px) {
        .aghi-aw-row { gap: 5px; }
        .aghi-aw-inbox-btn, .aghi-aw-avatar-btn { width: 30px; height: 30px; border-radius: 7px; }
        .aghi-aw-inbox-btn svg { width: 15px; height: 15px; }
      }
    `;
  document.head.appendChild(style);
};
