/**
 * Uber Eats Panel for Home Assistant
 * Displays accounts, order status, and driver location on map
 */

// Uber Eats Logo SVG (official style)
const UBER_EATS_LOGO = `
<svg viewBox="0 0 134 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="uber-eats-logo">
  <path d="M5.24 17.76C2.08 17.76 0 15.48 0 12.16V5.2H2.72V12.04C2.72 14 3.6 15.28 5.24 15.28C6.88 15.28 7.76 14 7.76 12.04V5.2H10.48V12.16C10.48 15.48 8.4 17.76 5.24 17.76ZM18.52 17.52H15.8V16.56C15.08 17.28 14.04 17.76 12.76 17.76C11.08 17.76 9.64 16.64 9.64 14.96C9.64 13.04 11.24 12.24 13.44 12.24H15.56V12C15.56 10.96 14.96 10.28 13.68 10.28C12.68 10.28 11.88 10.64 11.12 11.2L10 9.36C11.08 8.52 12.48 8 14 8C16.84 8 18.28 9.52 18.28 12.08V17.52H18.52ZM15.56 14.92V13.88H13.8C12.76 13.88 12.2 14.24 12.2 14.88C12.2 15.52 12.76 15.92 13.6 15.92C14.52 15.92 15.24 15.52 15.56 14.92ZM25.4 17.76C22.52 17.76 20.28 15.68 20.28 12.88C20.28 10.08 22.52 8 25.4 8C27.56 8 29.08 9.12 29.76 10.72L27.4 11.84C27.08 11.04 26.36 10.48 25.4 10.48C23.96 10.48 22.92 11.52 22.92 12.88C22.92 14.24 23.96 15.28 25.4 15.28C26.36 15.28 27.08 14.72 27.4 13.92L29.76 15.04C29.08 16.64 27.56 17.76 25.4 17.76ZM36.68 17.52H33.96V16.4C33.24 17.2 32.2 17.76 30.92 17.76C28.68 17.76 27.24 16.2 27.24 13.68V8.24H29.96V13.12C29.96 14.52 30.6 15.28 31.8 15.28C32.92 15.28 33.72 14.52 33.72 13.12V8.24H36.68V17.52ZM44.04 17.52H38.28V5.2H48.04V7.68H41V10.08H47.44V12.56H41V15.04H48.04V17.52H44.04Z" fill="white"/>
  <path d="M56.24 17.76C53.08 17.76 51 15.48 51 12.16V5.2H53.72V12.04C53.72 14 54.6 15.28 56.24 15.28C57.88 15.28 58.76 14 58.76 12.04V5.2H61.48V12.16C61.48 15.48 59.4 17.76 56.24 17.76Z" fill="#06C167"/>
  <path d="M69.52 17.52H66.8V16.56C66.08 17.28 65.04 17.76 63.76 17.76C62.08 17.76 60.64 16.64 60.64 14.96C60.64 13.04 62.24 12.24 64.44 12.24H66.56V12C66.56 10.96 65.96 10.28 64.68 10.28C63.68 10.28 62.88 10.64 62.12 11.2L61 9.36C62.08 8.52 63.48 8 65 8C67.84 8 69.28 9.52 69.28 12.08V17.52H69.52ZM66.56 14.92V13.88H64.8C63.76 13.88 63.2 14.24 63.2 14.88C63.2 15.52 63.76 15.92 64.6 15.92C65.52 15.92 66.24 15.52 66.56 14.92Z" fill="#06C167"/>
  <path d="M77.16 17.52H74.44V16.52C73.8 17.28 72.84 17.76 71.68 17.76C69.6 17.76 68.08 16.24 68.08 13.68V8.24H70.8V13.12C70.8 14.52 71.48 15.24 72.6 15.24C73.64 15.24 74.44 14.52 74.44 13.12V8.24H77.16V17.52Z" fill="#06C167"/>
  <path d="M84.6 17.52H78.84V15.36L82.2 11.68C82.8 11.04 83.16 10.56 83.16 10.04C83.16 9.36 82.6 8.92 81.8 8.92C80.96 8.92 80.28 9.4 79.68 10.12L77.88 8.64C78.84 7.44 80.28 6.64 82.04 6.64C84.36 6.64 85.92 8.04 85.92 9.92C85.92 11.04 85.4 11.96 84.28 13.16L82.36 15.2H86.04V17.52H84.6Z" fill="#06C167"/>
</svg>
`;

// Alternative simpler logo using emoji + text
const UBER_EATS_LOGO_SIMPLE = `
<span class="logo-container">
  <span class="logo-icon">🍔</span>
  <span class="logo-text">Uber<span class="logo-eats">Eats</span></span>
</span>
`;

class UberEatsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._accounts = [];
    this._selectedAccount = null;
    this._currentView = "main"; // main, instructions, account-details
    this._refreshInterval = null;
    this._ttsEntities = { tts_entities: [], media_player_entities: [] };
    this._ttsSettings = null;
    this._automations = [];
    this._advancedSettingsCollapsed = true;
    this._integrationVersion = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._loadAccounts();
      this._startAutoRefresh();
    }
  }

  set panel(panel) {
    this._config = panel.config;
  }

  connectedCallback() {
    this._render();
    this._attachCardClickDelegation();
  }

  disconnectedCallback() {
    this._stopAutoRefresh();
  }

  _startAutoRefresh() {
    this._refreshInterval = setInterval(async () => {
      await this._loadAccounts();
      if (this._currentView === "account-details" && this._selectedAccount?.entry_id) {
        const details = await this._loadAccountDetails(this._selectedAccount.entry_id);
        if (details) {
          this._selectedAccount = details;
          this._render();
        }
      }
    }, 15000);
  }

  _stopAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  _attachCardClickDelegation() {
    if (this._cardClickHandler) {
      this.shadowRoot.removeEventListener("click", this._cardClickHandler);
    }
    this._cardClickHandler = (e) => {
      // Account cards only - advanced settings handled by direct listener in _attachEventListeners
      const card = e.target.closest(".account-card");
      if (!card) return;
      const entryId = card.getAttribute("data-entry-id") || card.dataset.entryId;
      if (!entryId || !this._hass) return;
      e.preventDefault();
      this._selectAccount(entryId);
    };
    this.shadowRoot.addEventListener("click", this._cardClickHandler);
  }

  async _loadAccounts() {
    if (!this._hass) return;
    
    try {
      const result = await this._hass.callWS({
        type: "uber_eats/get_accounts",
      });
      this._accounts = result.accounts || [];
      if (result.version != null) this._integrationVersion = result.version;
      this._render();
    } catch (e) {
      console.error("Failed to load Uber Eats accounts:", e);
    }
  }

  async _loadAccountDetails(entryId) {
    if (!this._hass) return null;
    
    try {
      const result = await this._hass.callWS({
        type: "uber_eats/get_account_data",
        entry_id: entryId,
      });
      return result;
    } catch (e) {
      console.error("Failed to load account details:", e);
      return null;
    }
  }

  async _deleteAccount(entryId) {
    if (!this._hass) return;
    
    if (!confirm("Are you sure you want to delete this account? This cannot be undone.")) {
      return;
    }
    
    try {
      await this._hass.callWS({
        type: "uber_eats/delete_account",
        entry_id: entryId,
      });
      this._selectedAccount = null;
      this._currentView = "main";
      await this._loadAccounts();
    } catch (e) {
      console.error("Failed to delete account:", e);
      alert("Failed to delete account: " + e.message);
    }
  }

  _showInstructions() {
    this._currentView = "instructions";
    this._render();
  }

  _continueToAddAccount() {
    // Navigate to config flow
    window.location.href = "/config/integrations/integration/uber_eats";
  }

  _reconfigureAccount(entryId) {
    window.location.href = `/config/integrations/integration/uber_eats#config_entry=${entryId}`;
  }

  async _selectAccount(entryId) {
    const listAccount = this._accounts.find((a) => a.entry_id === entryId);
    const homeLat = this._hass?.config?.latitude;
    const homeLon = this._hass?.config?.longitude;
    const homeLocation = homeLat != null && homeLon != null ? { lat: homeLat, lon: homeLon } : null;
    const fallbackAccount = listAccount
      ? {
          ...listAccount,
          tracking_active: listAccount.active && listAccount.driver_name && listAccount.driver_name !== "No Driver Assigned" && listAccount.driver_name !== "Unknown",
          driver_assigned: listAccount.driver_name && listAccount.driver_name !== "No Driver Assigned" && listAccount.driver_name !== "Unknown",
          order_status_description: listAccount.order_status,
          home_location: homeLocation,
        }
      : {
          entry_id: entryId,
          account_name: "Loading…",
          time_zone: "UTC",
          active: false,
          tracking_active: false,
          driver_assigned: false,
          connection_status: "unknown",
          order_stage: "No Active Order",
          order_status: "No Active Order",
          order_status_description: "No Active Order",
          restaurant_name: "—",
          driver_name: "No Driver Assigned",
          driver_eta: "No ETA",
          minutes_remaining: null,
          order_id: "—",
          latest_arrival: "—",
          driver_location: homeLocation ? { lat: homeLat, lon: homeLon, street: "—", suburb: "—", address: "—" } : null,
          home_location: homeLocation,
        };

    this._selectedAccount = fallbackAccount;
    this._currentView = "account-details";
    this._render();

    const details = await this._loadAccountDetails(entryId);
    if (details) {
      this._selectedAccount = details;
      await Promise.all([
        this._loadTtsSettings(entryId),
        this._loadTtsEntities(),
        this._loadAutomations(),
      ]);
      this._render();
    }
  }

  async _loadTtsEntities() {
    if (!this._hass) return;
    try {
      const result = await this._hass.callWS({ type: "uber_eats/get_tts_entities" });
      this._ttsEntities = result;
    } catch (e) {
      console.error("Failed to load TTS entities:", e);
    }
  }

  async _loadTtsSettings(entryId) {
    if (!this._hass) return;
    try {
      const result = await this._hass.callWS({
        type: "uber_eats/get_tts_settings",
        entry_id: entryId,
      });
      this._ttsSettings = result;
    } catch (e) {
      console.error("Failed to load TTS settings:", e);
      this._ttsSettings = {
        tts_enabled: false,
        tts_entity_id: "",
        tts_media_players: [],
        tts_message_prefix: "Message from Uber Eats",
        tts_volume: 0.5,
        tts_interval_enabled: false,
        tts_interval_minutes: 10,
        driver_nearby_automation_enabled: false,
        driver_nearby_automation_entity: "",
        driver_nearby_distance_feet: 200,
      };
    }
  }

  async _loadAutomations() {
    if (!this._hass) return;
    try {
      const result = await this._hass.callWS({ type: "uber_eats/get_automations" });
      this._automations = result.automations || [];
    } catch (e) {
      console.error("Failed to load automations:", e);
      this._automations = [];
    }
  }

  async _saveTtsSettings(entryId, settings) {
    if (!this._hass) return;
    try {
      const payload = {
        type: "uber_eats/update_tts_settings",
        entry_id: entryId,
        tts_enabled: settings.tts_enabled,
        tts_entity_id: settings.tts_entity_id || "",
        tts_media_players: Array.isArray(settings.tts_media_players) ? settings.tts_media_players : [],
        tts_message_prefix: settings.tts_message_prefix || "Message from Uber Eats",
      };
      if (settings.tts_volume != null) payload.tts_volume = settings.tts_volume;
      if (settings.tts_interval_enabled != null) payload.tts_interval_enabled = settings.tts_interval_enabled;
      if (settings.tts_interval_minutes != null) payload.tts_interval_minutes = settings.tts_interval_minutes;
      if (settings.driver_nearby_automation_enabled != null) payload.driver_nearby_automation_enabled = settings.driver_nearby_automation_enabled;
      if (settings.driver_nearby_automation_entity != null) payload.driver_nearby_automation_entity = settings.driver_nearby_automation_entity || "";
      if (settings.driver_nearby_distance_feet != null) payload.driver_nearby_distance_feet = settings.driver_nearby_distance_feet;
      await this._hass.callWS(payload);
      this._ttsSettings = settings;
    } catch (e) {
      console.error("Failed to save TTS settings:", e);
      alert("Failed to save settings: " + (e.message || e));
    }
  }

  _goBack() {
    this._selectedAccount = null;
    this._currentView = "main";
    this._render();
  }

  _getMapUrl(lat, lon, zoomOrDelta = 15) {
    if (!lat || !lon) return null;
    const delta = typeof zoomOrDelta === "number" && zoomOrDelta < 1 ? zoomOrDelta : (zoomOrDelta >= 17 ? 0.001 : zoomOrDelta >= 16 ? 0.0015 : 0.003);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lon}`;
  }

  /** Distance in feet between two lat/lon points (Haversine). */
  _distanceFeet(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371000; // Earth radius in meters
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = R * c;
    return meters * 3.28084; // meters to feet
  }

  /** Display order status: preparing when no driver; arriving/arrived by distance; else sensor order_stage. */
  _displayOrderStatus(account) {
    if (!account.active) return "No Active Order";
    const noDriver =
      !account.driver_name ||
      account.driver_name === "No Driver Assigned" ||
      account.driver_name === "Unknown";
    if (noDriver) return "Preparing order";
    const homeLat = this._hass?.config?.latitude;
    const homeLon = this._hass?.config?.longitude;
    const driverLat = account.driver_location?.lat;
    const driverLon = account.driver_location?.lon;
    const distFeet = this._distanceFeet(driverLat, driverLon, homeLat, homeLon);
    if (distFeet != null) {
      if (distFeet <= 300) return "Arrived";
      if (distFeet <= 1000) return "Arriving";
    }
    const stage = (account.order_stage || "").toLowerCase();
    const labels = {
      preparing: "Preparing",
      "picked up": "Picked up",
      "en route": "En route",
      arriving: "Arriving",
      delivered: "Delivered",
      complete: "Complete",
    };
    return labels[stage] || (account.order_stage ? String(account.order_stage) : "—");
  }

  _render() {
    const styles = this._getStyles();
    let content = "";
    
    switch (this._currentView) {
      case "instructions":
        content = this._renderInstructionsPage();
        break;
      case "account-details":
        content = this._renderAccountDetails();
        break;
      default:
        content = this._renderMainPage();
    }

    const versionLabel = this._integrationVersion != null ? `Uber Eats (v${this._integrationVersion})` : "Uber Eats";

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="panel-container">
        ${content}
        <div class="panel-footer" aria-label="Integration version">${this._escapeHtml(versionLabel)}</div>
      </div>
    `;

    this._attachEventListeners();
    this._attachCardClickDelegation();
  }

  _getStyles() {
    return `
      <style>
        :host {
          display: block;
          height: 100%;
          background: #0f0f0f;
          color: #ffffff;
          font-family: 'UberMove', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow-y: auto;
        }
        
        * {
          box-sizing: border-box;
        }
        
        .panel-container {
          display: flex;
          flex-direction: column;
          min-height: 100%;
          padding: 0;
        }
        
        .panel-container > .main-page,
        .panel-container > .details-page,
        .panel-container > .instructions-page {
          flex: 1;
        }
        
        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          background: #000000;
          border-bottom: 1px solid #222;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .logo-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .logo-icon {
          font-size: 32px;
        }
        
        .logo-text {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        
        .logo-eats {
          color: #06C167;
        }
        
        .uber-eats-logo {
          height: 28px;
          width: auto;
        }
        
        /* Buttons */
        .btn {
          padding: 12px 24px;
          border-radius: 500px;
          border: none;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        
        .btn-primary {
          background: #06C167;
          color: #000;
        }
        
        .btn-primary:hover {
          background: #05a858;
          transform: scale(1.02);
        }
        
        .btn-secondary {
          background: #222;
          color: #fff;
        }
        
        .btn-secondary:hover {
          background: #333;
        }
        
        .btn-outline {
          background: transparent;
          border: 2px solid #333;
          color: #fff;
        }
        
        .btn-outline:hover {
          border-color: #06C167;
          color: #06C167;
        }
        
        .btn-danger {
          background: transparent;
          border: 2px solid #dc3545;
          color: #dc3545;
        }
        
        .btn-danger:hover {
          background: #dc3545;
          color: #fff;
        }
        
        .btn-icon {
          padding: 10px;
          border-radius: 50%;
          background: #222;
          border: none;
          color: #fff;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }
        
        .btn-icon:hover {
          background: #333;
        }
        
        /* Main Content */
        .content {
          padding: 24px;
          max-width: 1000px;
          margin: 0 auto;
        }
        
        /* Main page: flex layout so footer sits at bottom */
        .main-page {
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }
        
        .main-page .content {
          flex: 1;
        }
        
        .panel-footer {
          text-align: center;
          padding: 16px;
          font-size: 12px;
          color: #06C167;
        }
        
        /* Account Cards */
        .account-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .account-card {
          background: #1a1a1a;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.2s ease;
          border: 2px solid transparent;
          cursor: pointer;
        }
        
        .account-card:hover {
          border-color: #06C167;
          transform: translateY(-2px);
        }
        
        .account-card.has-order {
          border-color: #06C167;
        }
        
        .card-main {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 0;
        }
        
        @media (max-width: 768px) {
          .card-main {
            grid-template-columns: 1fr;
          }
          .card-map {
            height: 200px;
          }
        }
        
        .card-info {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          cursor: pointer;
        }
        
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        
        .account-name {
          font-size: 15px;
          font-weight: 500;
          color: #fff;
        }
        
        button.account-name {
          background: transparent;
          border: none;
          padding: 0;
          margin: 0;
          font: inherit;
          color: inherit;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
        }
        button.account-name:hover,
        button.account-name:focus {
          background: transparent;
        }
        button.account-name:focus-visible {
          outline: 2px solid #06C167;
          outline-offset: 2px;
        }
        
        .status-badge {
          padding: 6px 14px;
          border-radius: 500px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-active {
          background: #06C167;
          color: #000;
        }
        
        .status-inactive {
          background: #333;
          color: #888;
        }
        
        .status-error {
          background: #dc3545;
          color: #fff;
        }
        
        .card-details {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .card-oneline {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #ccc;
        }
        
        .card-oneline .card-oneline-label {
          color: #888;
          flex-shrink: 0;
        }
        .card-oneline .card-oneline-sep {
          color: #555;
          flex-shrink: 0;
        }
        .card-oneline .card-oneline-value {
          color: #ccc;
        }
        
        .card-timeline {
          font-size: 15px;
          color: #fff;
          font-weight: 500;
          line-height: 1.4;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        /* Card stage progress bar - full width of info column */
        .card-stage-progress {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #2a2a2a;
        }
        
        .card-stage-bar {
          flex: 1;
          height: 6px;
          background: #2a2a2a;
          border-radius: 3px;
          overflow: hidden;
          transition: background 0.25s ease;
        }
        
        .card-stage-bar.active {
          background: #06C167;
        }
        
        .card-stage-bar.current {
          background: linear-gradient(90deg, #06C167 50%, #2a2a2a 50%);
          animation: card-progress-pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes card-progress-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.75; }
        }
        
        .detail-item {
          display: flex;
          flex-direction: column;
        }
        
        .detail-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .detail-value {
          font-size: 15px;
          color: #fff;
          font-weight: 500;
        }
        
        .detail-value.highlight {
          color: #06C167;
          font-size: 18px;
        }
        
        .card-map {
          height: 180px;
          background: #111;
          position: relative;
        }
        
        .card-map iframe {
          width: 100%;
          height: 100%;
          border: none;
          filter: grayscale(100%) invert(100%) contrast(90%);
        }
        
        .card-map-click-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          cursor: pointer;
        }
        .map-overlay {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 2;
          background: rgba(0,0,0,0.8);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #06C167;
          pointer-events: none;
        }
        
        /* Instructions Page */
        .instructions-page {
          display: flex;
          flex-direction: column;
        }
        
        .instructions-content {
          flex: 1;
          padding: 40px 24px;
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        
        .instructions-header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .instructions-header h1 {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 12px 0;
        }
        
        .instructions-header p {
          color: #888;
          font-size: 16px;
          margin: 0;
        }
        
        .steps-container {
          background: #1a1a1a;
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 32px;
        }
        
        .step {
          display: flex;
          gap: 20px;
          margin-bottom: 28px;
        }
        
        .step:last-child {
          margin-bottom: 0;
        }
        
        .step-number {
          width: 36px;
          height: 36px;
          background: #06C167;
          color: #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          flex-shrink: 0;
        }
        
        .step-content h3 {
          margin: 0 0 8px 0;
          font-size: 17px;
          font-weight: 600;
        }
        
        .step-content p {
          margin: 0;
          color: #888;
          font-size: 14px;
          line-height: 1.6;
        }
        
        .step-content code {
          background: #333;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 13px;
          color: #06C167;
        }
        
        .cookie-visual {
          background: #111;
          border-radius: 8px;
          padding: 16px;
          margin-top: 12px;
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 12px;
          color: #666;
          word-break: break-all;
          line-height: 1.5;
        }
        
        .cookie-visual .highlight {
          color: #06C167;
          background: rgba(6, 193, 103, 0.1);
          padding: 1px 4px;
          border-radius: 3px;
        }
        
        .instructions-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        
        /* Account Details Page */
        .details-page {
          padding: 0;
        }
        
        .details-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: #000;
          border-bottom: 1px solid #222;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .details-header h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          flex-grow: 1;
        }
        
        .details-content {
          padding: 24px;
          max-width: 1000px;
          margin: 0 auto;
        }
        
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        
        @media (max-width: 768px) {
          .details-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .details-section {
          background: #1a1a1a;
          border-radius: 16px;
          padding: 24px;
        }
        
        .section-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .section-title::before {
          content: '';
          width: 4px;
          height: 16px;
          background: #06C167;
          border-radius: 2px;
        }
        
        .info-grid {
          display: grid;
          gap: 16px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .info-label {
          color: #888;
          font-size: 14px;
        }
        
        .info-value {
          color: #fff;
          font-weight: 500;
          font-size: 14px;
          text-align: right;
        }
        
        .info-value.success {
          color: #06C167;
        }
        
        .info-value.error {
          color: #dc3545;
        }
        
        .info-value.warning {
          color: #ffc107;
        }
        
        .big-map {
          height: 350px;
          border-radius: 16px;
          overflow: hidden;
          background: #111;
          margin-bottom: 24px;
        }
        
        .big-map iframe {
          width: 100%;
          height: 100%;
          border: none;
          filter: grayscale(100%) invert(100%) contrast(90%);
        }
        
        .actions-row {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        
        /* Connection Status */
        .connection-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        .status-dot.connected {
          background: #06C167;
        }
        
        .status-dot.disconnected {
          background: #dc3545;
          animation: none;
        }
        
        .menu-btn {
          display: none;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--primary-text-color, #fff);
          cursor: pointer;
          align-items: center;
          justify-content: center;
          margin-right: 8px;
          flex-shrink: 0;
        }
        
        .menu-btn svg {
          width: 24px;
          height: 24px;
          fill: currentColor;
        }
        
        .menu-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        
        @media (max-width: 870px) {
          .menu-btn {
            display: flex;
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 24px;
        }
        
        .empty-icon {
          font-size: 64px;
          margin-bottom: 24px;
        }
        
        .empty-state h2 {
          font-size: 24px;
          margin: 0 0 12px 0;
        }
        
        .empty-state p {
          color: #888;
          margin: 0 0 32px 0;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        
        /* Order Stage Progress */
        .stage-progress {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 12px;
        }
        
        .stage-bar {
          flex: 1;
          height: 4px;
          background: #333;
          border-radius: 2px;
          overflow: hidden;
        }
        
        .stage-bar.active {
          background: #06C167;
        }
        
        .stage-bar.current {
          background: linear-gradient(90deg, #06C167 50%, #333 50%);
          animation: progress-pulse 1s infinite;
        }
        
        @keyframes progress-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        /* Driver Info */
        .driver-card {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #111;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 16px;
        }
        
        .driver-avatar {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #06C167, #04a054);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        
        .driver-details h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
        }
        
        .driver-details p {
          margin: 0;
          color: #888;
          font-size: 13px;
        }
        
        .driver-eta {
          margin-left: auto;
          text-align: right;
        }
        
        .driver-eta .time {
          font-size: 24px;
          font-weight: 700;
          color: #06C167;
        }
        
        .driver-eta .label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
        }
        
        /* TTS Notification Settings */
        .tts-section {
          background: #1a1a1a;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .tts-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .tts-toggle-row label {
          font-size: 15px;
          font-weight: 500;
        }
        .tts-toggle {
          position: relative;
          width: 48px;
          height: 26px;
          background: #333;
          border-radius: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .tts-toggle.enabled {
          background: #06C167;
        }
        .tts-toggle.disabled {
          cursor: not-allowed;
        }
        .tts-toggle-knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s;
        }
        .tts-toggle.enabled .tts-toggle-knob {
          transform: translateX(22px);
        }
        .tts-fields {
          display: grid;
          gap: 16px;
        }
        .tts-field.disabled {
          opacity: 0.5;
          pointer-events: none;
        }
        .tts-field label {
          display: block;
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .tts-field select,
        .tts-field input {
          width: 100%;
          padding: 12px 16px;
          background: #111;
          border: 2px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
        }
        .tts-field select:focus,
        .tts-field input:focus {
          outline: none;
          border-color: #06C167;
        }
        .tts-multi-select {
          min-height: 80px;
          max-height: 120px;
        }
        /* Advanced settings card (collapsible) */
        .advanced-settings-section {
          background: #1a1a1a;
          border-radius: 16px;
          margin-bottom: 24px;
          overflow: hidden;
        }
        .advanced-settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        .advanced-settings-header:hover {
          background: rgba(255,255,255,0.03);
        }
        .advanced-settings-header .section-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        .advanced-settings-header .collapse-icon {
          width: 24px;
          height: 24px;
          color: #888;
          transition: transform 0.2s;
        }
        .advanced-settings-section.collapsed .collapse-icon {
          transform: rotate(-90deg);
        }
        .advanced-settings-body {
          padding: 0 24px 24px;
        }
        .advanced-settings-section.collapsed .advanced-settings-body {
          display: none;
        }
        .advanced-settings-body .tts-toggle-row {
          margin-bottom: 20px;
        }
        .advanced-settings-body .tts-fields {
          display: grid;
          gap: 16px;
        }
        .media-players-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          min-height: 44px;
          padding: 8px 0;
        }
        .media-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #333;
          border-radius: 8px;
          font-size: 13px;
          color: #fff;
        }
        .media-chip-remove {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 0 2px;
          font-size: 16px;
          line-height: 1;
          -webkit-tap-highlight-color: transparent;
        }
        .media-chip-remove:hover {
          color: #fff;
        }
        .add-media-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .add-media-row select {
          flex: 1;
          min-width: 160px;
          padding: 10px 14px;
          background: #111;
          border: 2px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
        }
        .volume-slider-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .volume-slider-row input[type="range"] {
          flex: 1;
          height: 8px;
          -webkit-appearance: none;
          appearance: none;
          background: #333;
          border-radius: 4px;
        }
        .volume-slider-row input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: #06C167;
          border-radius: 50%;
          cursor: pointer;
        }
        .volume-value {
          min-width: 48px;
          font-size: 14px;
          color: #888;
          text-align: right;
        }
        .driver-nearby-block {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #333;
        }
        .driver-nearby-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #fff;
        }
        .driver-nearby-block .tts-field {
          margin-bottom: 12px;
        }
        .driver-nearby-block input[type="number"] {
          width: 100%;
          max-width: 120px;
          padding: 10px 14px;
          background: #111;
          border: 2px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
        }
      </style>
    `;
  }

  _renderMainPage() {
    const accountCards = this._accounts.length > 0
      ? this._accounts.map(acc => this._renderAccountCard(acc)).join("")
      : this._renderEmptyState();

    return `
      <div class="main-page">
        <div class="header">
          <button class="menu-btn" id="menu-btn" title="Menu">
            <svg viewBox="0 0 24 24"><path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"/></svg>
          </button>
          ${UBER_EATS_LOGO_SIMPLE}
          <button class="btn btn-primary" id="add-account-btn">
            <span>+</span> Add Account
          </button>
        </div>
        
        <div class="content">
          <div class="account-list">
            ${accountCards}
          </div>
        </div>
      </div>
    `;
  }

  _renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🍔</div>
        <h2>No Accounts Connected</h2>
        <p>Connect your Uber Eats account to start tracking your orders in real-time.</p>
        <button class="btn btn-primary" id="add-account-empty-btn">Get Started</button>
      </div>
    `;
  }

  _renderAccountCard(account) {
    const esc = (s) => this._escapeHtml(s ?? "");
    const isActive = account.active;
    const hasError = account.connection_status === "error";
    const cardClass = isActive ? "account-card has-order" : "account-card";
    const noDriver =
      !account.driver_name ||
      account.driver_name === "No Driver Assigned" ||
      account.driver_name === "Unknown";

    // Get map coordinates - always show map (home location if no order)
    const lat = account.driver_location?.lat || (this._hass?.config?.latitude || 0);
    const lon = account.driver_location?.lon || (this._hass?.config?.longitude || 0);
    const mapUrl = this._getMapUrl(lat, lon, 0.001);
    const mapLabel = isActive && !noDriver ? "📍 Driver Location" : "🏠 Home";

    // One-line: Restaurant Name, Driver name, ETA (with inline labels). Timeline summary below.
    const timelineSummary = (account.order_status || account.order_status_description || "").trim();
    const timelineDisplay = timelineSummary && timelineSummary !== "Unknown" && timelineSummary !== "No Active Order"
      ? timelineSummary
      : this._displayOrderStatus(account);
    const driverDisplay = noDriver ? "Not assigned" : account.driver_name;
    const etaDisplay =
      account.driver_eta && account.driver_eta !== "No ETA" && account.driver_eta !== "No ETA Available"
        ? account.driver_eta
        : "—";

    // Stage progress (4 segments: preparing → picked up → en route → arriving)
    const cardStages = ["preparing", "picked up", "en route", "arriving"];
    const cardStageIdx = cardStages.findIndex(s => (account.order_stage || "").toLowerCase().includes(s));
    const safeStageIdx = cardStageIdx >= 0 ? cardStageIdx : (isActive ? 0 : -1);

    return `
      <div class="${cardClass}" data-entry-id="${account.entry_id}">
        <div class="card-main">
          <div class="card-info">
            <div class="card-header">
              <button type="button" class="account-name" data-entry-id="${account.entry_id}" aria-label="View details for ${esc(account.account_name)}">${esc(account.account_name)}</button>
              <span class="status-badge ${hasError ? 'status-error' : (isActive ? 'status-active' : 'status-inactive')}">
                ${hasError ? 'Error' : (isActive ? 'Active Order' : 'No Order')}
              </span>
            </div>
            
            <div class="card-details">
              ${isActive ? `
                <div class="card-oneline">
                  <span class="card-oneline-label">Restaurant Name:</span>
                  <span class="card-oneline-value">${account.restaurant_name || "—"}</span>
                  <span class="card-oneline-sep">·</span>
                  <span class="card-oneline-label">Driver name:</span>
                  <span class="card-oneline-value">${driverDisplay}</span>
                  <span class="card-oneline-sep">·</span>
                  <span class="card-oneline-label">ETA:</span>
                  <span class="card-oneline-value">${etaDisplay}</span>
                </div>
                <div class="card-timeline">${timelineDisplay}</div>
                <div class="card-stage-progress" title="Preparing → Picked up → En route → Arriving">
                  ${cardStages.map((_, i) => {
                    const completed = i < safeStageIdx;
                    const current = i === safeStageIdx;
                    return `<div class="card-stage-bar ${completed ? "active" : ""} ${current ? "current" : ""}"></div>`;
                  }).join("")}
                </div>
              ` : `
                <div class="card-timeline" style="color: #888;">Waiting for orders...</div>
              `}
            </div>
          </div>
          
          <div class="card-map">
            ${mapUrl ? `
              <iframe src="${mapUrl}" title="Location Map"></iframe>
              <div class="card-map-click-overlay" aria-hidden="true"></div>
              <div class="map-overlay">${mapLabel}</div>
            ` : `
              <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">
                Map unavailable
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  _renderInstructionsPage() {
    return `
      <div class="instructions-page">
        <div class="header">
          <button class="menu-btn" id="menu-btn" title="Menu">
            <svg viewBox="0 0 24 24"><path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"/></svg>
          </button>
          <button class="btn-icon" id="back-btn">←</button>
          ${UBER_EATS_LOGO_SIMPLE}
          <div></div>
        </div>
      
        <div class="instructions-content">
        <div class="instructions-header">
          <h1>Add Uber Eats Account</h1>
          <p>Follow these steps to connect your Uber Eats account</p>
        </div>
        
        <div class="steps-container">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Open Uber Eats in your browser</h3>
              <p>Go to <code>www.ubereats.com</code> and make sure you're logged in to your account.</p>
            </div>
          </div>
          
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Open Developer Tools</h3>
              <p>Press <code>F12</code> on your keyboard (or right-click anywhere and select "Inspect"). This opens the browser's developer tools.</p>
            </div>
          </div>
          
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Go to the Network tab</h3>
              <p>Click on the <code>Network</code> tab at the top of the developer tools panel.</p>
            </div>
          </div>
          
          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Refresh the page</h3>
              <p>Press <code>F5</code> or click the refresh button. You'll see network requests appear in the list.</p>
            </div>
          </div>
          
          <div class="step">
            <div class="step-number">5</div>
            <div class="step-content">
              <h3>Find and copy the Cookie</h3>
              <p>Click on any request in the list (like <code>getActiveOrdersV1</code>). In the "Headers" tab on the right, scroll down to "Request Headers" and find <code>Cookie</code>. Copy the <strong>entire</strong> value.</p>
              <div class="cookie-visual">
                <span class="highlight">sid=QA.CAES...</span>; dId=358b9db7...; 
                <span class="highlight">uev2.id.session=8e031537...</span>; jwt-session=eyJhb...
              </div>
            </div>
          </div>
          
          <div class="step">
            <div class="step-number">6</div>
            <div class="step-content">
              <h3>Enter your account details</h3>
              <p>Click "Continue" below to open the configuration form. Paste your cookie string and give your account a nickname (e.g., "Personal" or "Work").</p>
            </div>
          </div>
        </div>
        
        <div class="instructions-actions">
          <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="continue-btn">Continue to Setup →</button>
        </div>
        </div>
      </div>
    `;
  }

  _renderAccountDetails() {
    const acc = this._selectedAccount;
    if (!acc) return "";

    const isActive = acc.active;
    const trackingActive = acc.tracking_active;
    const driverAssigned = acc.driver_assigned;
    const noDriver =
      !acc.driver_name ||
      acc.driver_name === "No Driver Assigned" ||
      acc.driver_name === "Unknown";

    const orderStatusDisplay = this._displayOrderStatus(acc);
    const driverDisplay = noDriver ? "Not assigned" : acc.driver_name;
    const locationStreet = noDriver ? "None yet" : (acc.driver_location?.street || "—");
    const locationSuburb = noDriver ? "—" : (acc.driver_location?.suburb || "—");
    const etaDisplay =
      acc.driver_eta && acc.driver_eta !== "No ETA" && acc.driver_eta !== "No ETA Available"
        ? acc.driver_eta
        : "—";
    const ettDisplay =
      acc.minutes_remaining != null && acc.minutes_remaining !== ""
        ? `${acc.minutes_remaining} min`
        : "—";

    // Get map coordinates
    const lat = acc.driver_location?.lat || acc.home_location?.lat || 0;
    const lon = acc.driver_location?.lon || acc.home_location?.lon || 0;
    const mapUrl = this._getMapUrl(lat, lon, 16);
    
    // Stage progress
    const stages = ["preparing", "picked up", "en route", "arriving"];
    const currentStage = (acc.order_stage || "").toLowerCase();
    const currentStageIndex = stages.findIndex(s => currentStage.includes(s));

    // Connection status
    const isConnected = acc.connection_status !== "error";

    return `
      <div class="details-page">
        <div class="details-header">
          <button class="menu-btn" id="menu-btn" title="Menu">
            <svg viewBox="0 0 24 24"><path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"/></svg>
          </button>
          <button class="btn-icon" id="back-btn">←</button>
          <h2>${acc.account_name}</h2>
          <div class="connection-indicator">
            <span class="status-dot ${isConnected ? 'connected' : 'disconnected'}"></span>
            <span style="font-size:13px;color:${isConnected ? '#06C167' : '#dc3545'}">
              ${isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div class="details-content">
          <!-- Map Always Visible -->
          <div class="big-map">
            ${mapUrl ? `
              <iframe src="${mapUrl}" title="Location Map"></iframe>
            ` : `
              <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">
                Map unavailable
              </div>
            `}
          </div>
          
          ${isActive && driverAssigned ? `
            <div class="driver-card">
              <div class="driver-avatar">🚗</div>
              <div class="driver-details">
                <h4>${acc.driver_name}</h4>
                <p>${acc.driver_location?.street || "On the way"}</p>
              </div>
              <div class="driver-eta">
                <div class="time">${acc.minutes_remaining || "—"} min</div>
                <div class="label">Estimated</div>
              </div>
            </div>
          ` : ""}
          
          <div class="details-grid">
            <!-- Order Information -->
            <div class="details-section">
              <div class="section-title">Order Information</div>
              <div class="info-grid">
                <div class="info-row">
                  <span class="info-label">Status</span>
                  <span class="info-value ${isActive ? 'success' : ''}">${isActive ? "Active Order" : "No Active Order"}</span>
                </div>
                ${isActive ? `
                  <div class="info-row">
                    <span class="info-label">Restaurant</span>
                    <span class="info-value">${acc.restaurant_name}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Order Stage</span>
                    <span class="info-value">${acc.order_stage}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Order Status</span>
                    <span class="info-value">${orderStatusDisplay}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Driver</span>
                    <span class="info-value">${driverDisplay}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">ETA</span>
                    <span class="info-value success">${etaDisplay}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">ETT</span>
                    <span class="info-value">${ettDisplay}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Latest Arrival</span>
                    <span class="info-value">${acc.latest_arrival}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Order ID</span>
                    <span class="info-value" style="font-family:monospace;font-size:12px;">${acc.order_id?.substring(0, 16) || "N/A"}...</span>
                  </div>
                ` : ""}
              </div>
              
              ${isActive ? `
                <div class="stage-progress">
                  ${stages.map((stage, i) => {
                    const isCompleted = i < currentStageIndex;
                    const isCurrent = i === currentStageIndex;
                    return `<div class="stage-bar ${isCompleted ? 'active' : ''} ${isCurrent ? 'current' : ''}"></div>`;
                  }).join("")}
                </div>
              ` : ""}
            </div>
            
            <!-- Account & Connection Info -->
            <div class="details-section">
              <div class="section-title">Account Details</div>
              <div class="info-grid">
                <div class="info-row">
                  <span class="info-label">Account Name</span>
                  <span class="info-value">${acc.account_name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Time Zone</span>
                  <span class="info-value">${acc.time_zone}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">API Connection</span>
                  <span class="info-value ${isConnected ? 'success' : 'error'}">${isConnected ? 'Connected' : 'Error'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Entry ID</span>
                  <span class="info-value" style="font-family:monospace;font-size:11px;">${acc.entry_id?.substring(0, 12)}...</span>
                </div>
              </div>
              
              ${isActive ? `
                <div style="margin-top:20px;">
                  <div class="section-title">Driver Location</div>
                  <div class="info-grid">
                    <div class="info-row">
                      <span class="info-label">Street</span>
                      <span class="info-value">${locationStreet}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Suburb</span>
                      <span class="info-value">${locationSuburb}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Coordinates</span>
                      <span class="info-value" style="font-family:monospace;font-size:12px;">${noDriver ? "—" : `${lat.toFixed(5)}, ${lon.toFixed(5)}`}</span>
                    </div>
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
          
          ${this._renderTtsSection(acc)}
          
          <div class="actions-row">
            <button class="btn btn-outline" id="reconfigure-btn" data-entry-id="${acc.entry_id}">Edit Account</button>
            <button class="btn btn-danger" id="delete-btn" data-entry-id="${acc.entry_id}">Delete Account</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderTtsSection(acc) {
    const esc = (s) => this._escapeHtml(s);
    const settings = this._ttsSettings || {
      tts_enabled: false,
      tts_entity_id: "",
      tts_media_players: [],
      tts_message_prefix: "Message from Uber Eats",
      tts_volume: 0.5,
      tts_interval_enabled: false,
      tts_interval_minutes: 10,
      driver_nearby_automation_enabled: false,
      driver_nearby_automation_entity: "",
      driver_nearby_distance_feet: 200,
    };
    const enabled = !!settings.tts_enabled;
    const ttsList = this._ttsEntities?.tts_entities || [];
    const mediaList = this._ttsEntities?.media_player_entities || [];
    const selectedMedia = Array.isArray(settings.tts_media_players) ? settings.tts_media_players : [];
    const prefix = settings.tts_message_prefix || "Message from Uber Eats";
    const volume = typeof settings.tts_volume === "number" ? settings.tts_volume : 0.5;
    const intervalEnabled = !!settings.tts_interval_enabled;
    const intervalMinutes = Math.max(5, Math.min(15, parseInt(settings.tts_interval_minutes, 10) || 10));
    const driverNearbyEnabled = !!settings.driver_nearby_automation_enabled;
    const driverAutomationEntity = settings.driver_nearby_automation_entity || "";
    const driverNearbyDistance = Math.max(50, Math.min(2000, parseInt(settings.driver_nearby_distance_feet, 10) || 200));
    const automations = this._automations || [];
    const collapsed = this._advancedSettingsCollapsed;

    const ttsOptions = ttsList.map((e) =>
      `<option value="${e.entity_id}" ${e.entity_id === settings.tts_entity_id ? "selected" : ""}>${e.name || e.entity_id}</option>`
    ).join("");

    const mediaAvailableToAdd = mediaList.filter((e) => !selectedMedia.includes(e.entity_id));
    const mediaAddOptions = mediaAvailableToAdd.map((e) =>
      `<option value="${e.entity_id}">${e.name || e.entity_id}</option>`
    ).join("");

    const chipsHtml = selectedMedia.map((entityId) => {
      const ent = mediaList.find((e) => e.entity_id === entityId);
      const name = ent ? (ent.name || entityId) : entityId;
      return `<span class="media-chip" data-entity-id="${entityId}">${esc(name)}<button type="button" class="media-chip-remove" data-entity-id="${entityId}" data-entry-id="${acc.entry_id}" aria-label="Remove">×</button></span>`;
    }).join("");

    const intervalMinOptions = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((m) =>
      `<option value="${m}" ${m === intervalMinutes ? "selected" : ""}>${m} min</option>`
    ).join("");

    const automationOptions = automations.map((a) =>
      `<option value="${a.entity_id}" ${a.entity_id === driverAutomationEntity ? "selected" : ""}>${this._escapeHtml(a.name || a.entity_id)}</option>`
    ).join("");

    return `
      <div class="advanced-settings-section tts-section ${collapsed ? "collapsed" : ""}" id="advanced-settings-card">
        <div class="advanced-settings-header" id="advanced-settings-header" role="button" tabindex="0" aria-expanded="${!collapsed}">
          <span class="section-title">Advanced settings</span>
          <svg class="collapse-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
        </div>
        <div class="advanced-settings-body">
          <div class="tts-toggle-row">
            <label>Enable TTS notifications</label>
            <div class="tts-toggle ${enabled ? "enabled" : ""}" id="tts-toggle" data-entry-id="${acc.entry_id}" role="button" tabindex="0" aria-pressed="${enabled}"><span class="tts-toggle-knob"></span></div>
          </div>
          <div class="tts-fields">
            <div class="tts-field ${enabled ? "" : "disabled"}">
              <label>TTS Engine</label>
              <select id="tts-entity-select" data-entry-id="${acc.entry_id}" ${enabled ? "" : "disabled"}>
                <option value="">Select TTS engine...</option>
                ${ttsOptions}
              </select>
            </div>
            <div class="tts-field ${enabled ? "" : "disabled"}">
              <label>Media Players</label>
              <div class="media-players-chips" id="media-players-chips">${chipsHtml}</div>
              <div class="add-media-row">
                <select id="tts-media-add-select" data-entry-id="${acc.entry_id}" ${enabled ? "" : "disabled"}>
                  <option value="">Add media player...</option>
                  ${mediaAddOptions}
                </select>
              </div>
            </div>
            <div class="tts-field ${enabled ? "" : "disabled"}">
              <label>Message Prefix</label>
              <input type="text" id="tts-prefix-input" value="${esc(prefix)}" placeholder="Message from Uber Eats" data-entry-id="${acc.entry_id}" ${enabled ? "" : "disabled"} />
            </div>
            <div class="tts-field ${enabled ? "" : "disabled"}">
              <label>TTS Volume</label>
              <div class="volume-slider-row">
                <input type="range" id="tts-volume-slider" min="0" max="1" step="0.05" value="${volume}" data-entry-id="${acc.entry_id}" ${enabled ? "" : "disabled"} />
                <span class="volume-value" id="tts-volume-value">${Math.round(volume * 100)}%</span>
              </div>
            </div>
            <div class="tts-toggle-row">
              <label>Send interval updates (every N minutes)</label>
              <div class="tts-toggle ${intervalEnabled ? "enabled" : ""}" id="tts-interval-toggle" data-entry-id="${acc.entry_id}" role="button" tabindex="0" aria-pressed="${intervalEnabled}"><span class="tts-toggle-knob"></span></div>
            </div>
            <div class="tts-field ${intervalEnabled ? "" : "disabled"}">
              <label>Interval (minutes)</label>
              <select id="tts-interval-minutes" data-entry-id="${acc.entry_id}" ${intervalEnabled ? "" : "disabled"}>
                ${intervalMinOptions}
              </select>
            </div>
            <div class="driver-nearby-block">
              <div class="driver-nearby-title">Driver nearby action</div>
              <div class="tts-toggle-row">
                <label>Trigger automation when driver is within distance</label>
                <div class="tts-toggle ${driverNearbyEnabled ? "enabled" : ""}" id="driver-nearby-toggle" data-entry-id="${acc.entry_id}" role="button" tabindex="0" aria-pressed="${driverNearbyEnabled}"><span class="tts-toggle-knob"></span></div>
              </div>
              <div class="tts-field ${driverNearbyEnabled ? "" : "disabled"}">
                <label>Distance (feet)</label>
                <input type="number" id="driver-nearby-distance" min="50" max="2000" value="${driverNearbyDistance}" data-entry-id="${acc.entry_id}" ${driverNearbyEnabled ? "" : "disabled"} />
              </div>
              <div class="tts-field ${driverNearbyEnabled ? "" : "disabled"}">
                <label>Automation</label>
                <select id="driver-nearby-automation" data-entry-id="${acc.entry_id}" ${driverNearbyEnabled ? "" : "disabled"}>
                  <option value="">Select automation...</option>
                  ${automationOptions}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  _toggleSidebar() {
    const event = new Event("hass-toggle-menu", { bubbles: true, composed: true });
    this.dispatchEvent(event);
  }

  _attachMenuButton() {
    const menuBtn = this.shadowRoot.querySelector("#menu-btn");
    if (menuBtn) {
      menuBtn.addEventListener("click", () => this._toggleSidebar());
    }
  }

  _attachEventListeners() {
    this._attachMenuButton();
    // Add account buttons
    const addBtn = this.shadowRoot.querySelector("#add-account-btn");
    const addBtnEmpty = this.shadowRoot.querySelector("#add-account-empty-btn");
    
    if (addBtn) {
      addBtn.addEventListener("click", () => this._showInstructions());
    }
    if (addBtnEmpty) {
      addBtnEmpty.addEventListener("click", () => this._showInstructions());
    }

    // Continue button (instructions page)
    const continueBtn = this.shadowRoot.querySelector("#continue-btn");
    if (continueBtn) {
      continueBtn.addEventListener("click", () => this._continueToAddAccount());
    }

    // Cancel button
    const cancelBtn = this.shadowRoot.querySelector("#cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this._goBack());
    }

    // Back button
    const backBtn = this.shadowRoot.querySelector("#back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => this._goBack());
    }

    // Whole card click (main page) – open account details; direct attach so it works after go-back
    this.shadowRoot.querySelectorAll(".account-card").forEach((card) => {
      const entryId = card.getAttribute("data-entry-id") || card.dataset.entryId;
      if (!entryId || !this._hass) return;
      card.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._selectAccount(entryId);
      });
    });

    // Account name buttons (main page) – same action, in case card listener is missed
    this.shadowRoot.querySelectorAll("button.account-name").forEach((btn) => {
      const entryId = btn.getAttribute("data-entry-id") || btn.dataset.entryId;
      if (!entryId) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this._hass) this._selectAccount(entryId);
      });
    });

    // Advanced settings dropdown (details page) – direct attach so it works after every render
    const advancedHeader = this.shadowRoot.querySelector("#advanced-settings-header");
    if (advancedHeader) {
      advancedHeader.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._advancedSettingsCollapsed = !this._advancedSettingsCollapsed;
        this._render();
      });
      advancedHeader.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          this._advancedSettingsCollapsed = !this._advancedSettingsCollapsed;
          this._render();
        }
      });
    }

    // Reconfigure button
    const reconfigureBtn = this.shadowRoot.querySelector("#reconfigure-btn");
    if (reconfigureBtn) {
      reconfigureBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const entryId = reconfigureBtn.dataset.entryId;
        this._reconfigureAccount(entryId);
      });
    }

    // Delete button
    const deleteBtn = this.shadowRoot.querySelector("#delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const entryId = deleteBtn.dataset.entryId;
        this._deleteAccount(entryId);
      });
    }

    // TTS toggle
    const ttsToggle = this.shadowRoot.querySelector("#tts-toggle");
    if (ttsToggle) {
      const entryId = ttsToggle.dataset.entryId;
      const toggleHandler = () => {
        const nextEnabled = !this._ttsSettings?.tts_enabled;
        const settings = { ...this._ttsSettings, tts_enabled: nextEnabled };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      };
      ttsToggle.addEventListener("click", toggleHandler);
      ttsToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleHandler();
        }
      });
    }

    // TTS entity select
    const ttsEntitySelect = this.shadowRoot.querySelector("#tts-entity-select");
    if (ttsEntitySelect) {
      ttsEntitySelect.addEventListener("change", () => {
        const entryId = ttsEntitySelect.dataset.entryId;
        const settings = { ...this._ttsSettings, tts_entity_id: ttsEntitySelect.value || "" };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      });
    }

    // Add media player (single select)
    const ttsMediaAddSelect = this.shadowRoot.querySelector("#tts-media-add-select");
    if (ttsMediaAddSelect) {
      ttsMediaAddSelect.addEventListener("change", () => {
        const val = ttsMediaAddSelect.value;
        if (!val) return;
        const entryId = ttsMediaAddSelect.dataset.entryId;
        const current = Array.isArray(this._ttsSettings?.tts_media_players) ? this._ttsSettings.tts_media_players : [];
        if (current.includes(val)) return;
        const settings = { ...this._ttsSettings, tts_media_players: [...current, val] };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      });
    }

    // Remove media player (chip remove buttons)
    this.shadowRoot.querySelectorAll(".media-chip-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const entityId = btn.dataset.entityId;
        const entryId = btn.dataset.entryId;
        const current = Array.isArray(this._ttsSettings?.tts_media_players) ? this._ttsSettings.tts_media_players : [];
        const settings = { ...this._ttsSettings, tts_media_players: current.filter((id) => id !== entityId) };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      });
    });

    // TTS prefix input
    const ttsPrefixInput = this.shadowRoot.querySelector("#tts-prefix-input");
    if (ttsPrefixInput) {
      let debounceTimer;
      ttsPrefixInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const entryId = ttsPrefixInput.dataset.entryId;
          const settings = { ...this._ttsSettings, tts_message_prefix: ttsPrefixInput.value || "Message from Uber Eats" };
          this._saveTtsSettings(entryId, settings).then(() => this._render());
        }, 400);
      });
    }

    // TTS volume slider
    const ttsVolumeSlider = this.shadowRoot.querySelector("#tts-volume-slider");
    const ttsVolumeValue = this.shadowRoot.querySelector("#tts-volume-value");
    if (ttsVolumeSlider) {
      const saveVolume = () => {
        const v = parseFloat(ttsVolumeSlider.value, 10);
        const entryId = ttsVolumeSlider.dataset.entryId;
        const settings = { ...this._ttsSettings, tts_volume: v };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      };
      ttsVolumeSlider.addEventListener("input", () => {
        if (ttsVolumeValue) ttsVolumeValue.textContent = Math.round(parseFloat(ttsVolumeSlider.value, 10) * 100) + "%";
      });
      ttsVolumeSlider.addEventListener("change", saveVolume);
    }

    // Interval toggle
    const intervalToggle = this.shadowRoot.querySelector("#tts-interval-toggle");
    if (intervalToggle) {
      const entryId = intervalToggle.dataset.entryId;
      const toggleHandler = () => {
        const next = !this._ttsSettings?.tts_interval_enabled;
        const settings = { ...this._ttsSettings, tts_interval_enabled: next };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      };
      intervalToggle.addEventListener("click", toggleHandler);
      intervalToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleHandler();
        }
      });
    }

    // Interval minutes
    const intervalMinutesSelect = this.shadowRoot.querySelector("#tts-interval-minutes");
    if (intervalMinutesSelect) {
      intervalMinutesSelect.addEventListener("change", () => {
        const entryId = intervalMinutesSelect.dataset.entryId;
        const minutes = parseInt(intervalMinutesSelect.value, 10) || 10;
        const settings = { ...this._ttsSettings, tts_interval_minutes: minutes };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      });
    }

    // Driver nearby toggle
    const driverNearbyToggle = this.shadowRoot.querySelector("#driver-nearby-toggle");
    if (driverNearbyToggle) {
      const entryId = driverNearbyToggle.dataset.entryId;
      const toggleHandler = () => {
        const next = !this._ttsSettings?.driver_nearby_automation_enabled;
        const settings = { ...this._ttsSettings, driver_nearby_automation_enabled: next };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      };
      driverNearbyToggle.addEventListener("click", toggleHandler);
      driverNearbyToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleHandler();
        }
      });
    }

    // Driver nearby automation select
    const driverNearbyAutomation = this.shadowRoot.querySelector("#driver-nearby-automation");
    if (driverNearbyAutomation) {
      driverNearbyAutomation.addEventListener("change", () => {
        const entryId = driverNearbyAutomation.dataset.entryId;
        const settings = { ...this._ttsSettings, driver_nearby_automation_entity: driverNearbyAutomation.value || "" };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      });
    }

    // Driver nearby distance (feet)
    const driverNearbyDistanceInput = this.shadowRoot.querySelector("#driver-nearby-distance");
    if (driverNearbyDistanceInput) {
      const saveDistance = () => {
        const v = parseInt(driverNearbyDistanceInput.value, 10);
        if (Number.isNaN(v)) return;
        const clamped = Math.max(50, Math.min(2000, v));
        const entryId = driverNearbyDistanceInput.dataset.entryId;
        const settings = { ...this._ttsSettings, driver_nearby_distance_feet: clamped };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      };
      driverNearbyDistanceInput.addEventListener("change", saveDistance);
      driverNearbyDistanceInput.addEventListener("blur", saveDistance);
    }
  }
}

// Register the custom element
customElements.define("uber-eats-panel", UberEatsPanel);
