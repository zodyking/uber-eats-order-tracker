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
    this._pastOrders = [];
    this._pastOrdersLoading = false;
    this._accountStats = null;
    this._langEnabled = false;  // Temp flag for language toggle
    this._optEnabled = false;   // Temp flag for options toggle
    this._playerLangEnabled = {};  // Per-player language toggle
    this._playerOptsEnabled = {};  // Per-player options toggle
    this._expandedPlayers = {};  // Track which media player cards are expanded
    this._userProfile = null;  // User profile from getUserV1 API
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
        this._fetchUserProfile(entryId),
      ]);
      this._render();
      // Fetch past orders in background (non-blocking)
      this._fetchPastOrders(entryId);
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
        tts_media_player_volumes: {},
        tts_media_player_settings: {},
        tts_cache: true,
        tts_language: "",
        tts_options: {},
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
      if (settings.tts_media_player_volumes != null) payload.tts_media_player_volumes = settings.tts_media_player_volumes;
      if (settings.tts_media_player_settings != null) payload.tts_media_player_settings = settings.tts_media_player_settings;
      if (settings.tts_cache != null) payload.tts_cache = settings.tts_cache;
      if (settings.tts_language != null) payload.tts_language = settings.tts_language;
      if (settings.tts_options != null) payload.tts_options = settings.tts_options;
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
    this._pastOrders = [];
    this._pastOrdersLoading = false;
    this._accountStats = null;
    this._langEnabled = false;
    this._optEnabled = false;
    this._playerLangEnabled = {};
    this._playerOptsEnabled = {};
    this._expandedPlayers = {};
    this._userProfile = null;
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
          padding: 16px;
          max-width: 1000px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
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
        
        /* ===== ACCOUNT CARD ===== */
        .account-card {
          background: #1a1a1a;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.2s ease;
          border: 1px solid #2a2a2a;
          cursor: pointer;
        }
        
        .account-card:hover {
          border-color: #06C167;
          box-shadow: 0 8px 32px rgba(6, 193, 103, 0.15);
        }
        
        .account-card.has-order {
          border-color: #06C167;
          box-shadow: 0 4px 24px rgba(6, 193, 103, 0.1);
        }
        
        /* Card main: 3-column layout (account pic | info | map) - fluid, same on all screens */
        .card-main {
          display: flex;
          min-height: 140px;
          overflow: hidden;
        }
        
        /* Account Picture - Left side rounded square - fluid width */
        .card-account-pic {
          width: 25%;
          min-width: 80px;
          max-width: 140px;
          min-height: 140px;
          position: relative;
          flex-shrink: 0;
          overflow: hidden;
          background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
        }
        
        .card-account-pic img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .card-account-pic .account-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(28px, 8vw, 48px);
          font-weight: 700;
          color: #444;
          background: linear-gradient(135deg, #2a2a2a 0%, #222 100%);
        }
        
        .card-account-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px 10px 10px;
          background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, transparent 100%);
        }
        
        .card-account-overlay .account-name {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          text-align: center;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        /* Card Info Section - Middle */
        .card-info {
          flex: 1;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          overflow: hidden;
        }
        
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        /* Driver block - square avatar with name below */
        .driver-block {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .driver-avatar {
          width: clamp(36px, 10vw, 48px);
          height: clamp(36px, 10vw, 48px);
          border-radius: 8px;
          overflow: hidden;
          background: #2a2a2a;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid rgba(6, 193, 103, 0.4);
          flex-shrink: 0;
        }
        
        .driver-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .driver-avatar .driver-fallback {
          font-size: clamp(16px, 5vw, 22px);
        }
        
        .driver-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        
        .driver-name {
          font-size: clamp(11px, 3vw, 14px);
          font-weight: 600;
          color: #06C167;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .driver-label {
          font-size: clamp(9px, 2.5vw, 11px);
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-badge {
          padding: 4px 10px;
          border-radius: 100px;
          font-size: clamp(9px, 2.5vw, 11px);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        
        .status-active {
          background: #06C167;
          color: #000;
        }
        
        .status-inactive {
          background: rgba(255,255,255,0.08);
          color: #666;
        }
        
        .status-error {
          background: #dc3545;
          color: #fff;
        }
        
        /* One-line info row */
        .card-oneline {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px 8px;
          font-size: clamp(11px, 3vw, 14px);
          line-height: 1.5;
          margin-bottom: 8px;
        }
        
        .card-oneline-label {
          color: #666;
        }
        .card-oneline-value {
          color: #fff;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }
        .card-oneline-sep {
          color: #444;
        }
        
        /* Timeline message */
        .card-timeline {
          font-size: clamp(12px, 3.5vw, 15px);
          color: #999;
          line-height: 1.4;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .card-timeline.waiting {
          color: #555;
          font-style: italic;
        }
        
        /* No order card - centered waiting message */
        .card-info-noorder {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        
        .card-waiting-message {
          font-size: clamp(14px, 4vw, 22px);
          font-weight: 500;
          color: #555;
          font-style: italic;
          letter-spacing: 0.3px;
        }
        .card-waiting-message::after {
          content: '.';
          animation: dots 1.5s steps(3, end) infinite;
        }
        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }
        
        .card-error-message {
          font-size: 22px;
          font-weight: 600;
          color: #dc3545;
        }
        
        /* Progress bar */
        .card-stage-progress {
          display: flex;
          gap: 4px;
          margin-top: 12px;
        }
        
        .card-stage-bar {
          flex: 1;
          height: 5px;
          background: #2a2a2a;
          border-radius: 3px;
          transition: background 0.3s ease;
        }
        
        .card-stage-bar.active {
          background: #06C167;
        }
        
        .card-stage-bar.current {
          background: linear-gradient(90deg, #06C167 60%, #2a2a2a 60%);
          animation: progress-pulse 1.8s ease-in-out infinite;
        }
        
        @keyframes progress-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
        
        /* Card Map Section - fluid width */
        .card-map {
          width: 35%;
          min-width: 120px;
          max-width: 280px;
          min-height: 140px;
          background: #111;
          position: relative;
          flex-shrink: 0;
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
          top: 12px;
          right: 12px;
          z-index: 2;
          background: rgba(0,0,0,0.85);
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #06C167;
          backdrop-filter: blur(4px);
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
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .details-grid {
          display: grid;
          grid-template-columns: 1fr;
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
        .media-players-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
        }
        .media-player-item {
          background: #111;
          border-radius: 10px;
          border: 1px solid #333;
          overflow: hidden;
        }
        .media-player-item.expanded {
          border-color: #06C167;
        }
        .media-player-header {
          display: flex;
          align-items: center;
          padding: 12px 14px;
          cursor: pointer;
          user-select: none;
          transition: background 0.15s ease;
        }
        .media-player-header:hover {
          background: #1a1a1a;
        }
        .media-player-expand-icon {
          width: 20px;
          height: 20px;
          margin-right: 10px;
          color: #888;
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
        .media-player-item.expanded .media-player-expand-icon {
          transform: rotate(90deg);
          color: #06C167;
        }
        .media-player-name {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .media-player-remove {
          background: none;
          border: none;
          color: #666;
          font-size: 18px;
          cursor: pointer;
          padding: 4px 8px;
          margin-left: 8px;
          border-radius: 4px;
          transition: all 0.15s ease;
        }
        .media-player-remove:hover {
          background: rgba(220, 53, 69, 0.2);
          color: #dc3545;
        }
        .media-player-body {
          display: none;
          padding: 0 14px 14px 14px;
          border-top: 1px solid #222;
          background: #0a0a0a;
        }
        .media-player-item.expanded .media-player-body {
          display: block;
        }
        .media-player-setting {
          padding: 12px 0;
          border-bottom: 1px solid #222;
        }
        .media-player-setting:last-child {
          border-bottom: none;
        }
        .media-player-setting label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          margin-bottom: 8px;
          display: block;
        }
        .player-setting-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          overflow: hidden;
        }
        .player-setting-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          flex: 1;
          min-width: 0;
        }
        .tts-toggle.small {
          width: 36px;
          height: 20px;
          min-width: 36px;
          flex-shrink: 0;
        }
        .tts-toggle.small .tts-toggle-knob {
          width: 14px;
          height: 14px;
          left: 3px;
          top: 3px;
          transform: translateX(0);
        }
        .tts-toggle.small.enabled .tts-toggle-knob {
          transform: translateX(16px);
        }
        .player-lang-input,
        .player-opts-editor {
          width: 100%;
          margin-top: 8px;
          padding: 10px 12px;
          border: 1px solid #333;
          border-radius: 8px;
          background: #111;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
        }
        .player-opts-editor {
          min-height: 60px;
          resize: vertical;
          font-family: monospace;
          font-size: 12px;
        }
        .player-lang-input:focus,
        .player-opts-editor:focus {
          border-color: #06C167;
          outline: none;
        }
        .media-player-volume label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          margin-bottom: 4px;
          display: block;
        }
        /* Checkbox-style enable field (matching HA dev tools) */
        .tts-checkbox-field {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid #333;
        }
        .tts-checkbox {
          width: 18px;
          height: 18px;
          min-width: 18px;
          margin-top: 2px;
          accent-color: #06C167;
          cursor: pointer;
        }
        .tts-checkbox-label {
          flex: 1;
        }
        .tts-checkbox-label strong {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 2px;
        }
        .tts-checkbox-label span {
          font-size: 12px;
          color: #888;
          line-height: 1.4;
        }
        .tts-checkbox-content {
          padding-left: 30px;
          padding-bottom: 4px;
        }
        /* Toggle input content - shown below toggle fields */
        .tts-toggle-input-content {
          padding: 0 0 16px 0;
        }
        .tts-toggle-input-content input[type="text"] {
          width: 100%;
          padding: 12px 14px;
          background: #111;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          box-sizing: border-box;
        }
        .tts-toggle-input-content input[type="text"]:focus {
          outline: none;
          border-color: #06C167;
        }
        .tts-toggle-input-content.disabled input[type="text"] {
          opacity: 0.5;
          cursor: not-allowed;
        }
        /* Options code editor area */
        .tts-options-editor {
          width: 100%;
          min-height: 80px;
          background: #0d1117;
          color: #c9d1d9;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px;
          font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 1.5;
          resize: vertical;
          box-sizing: border-box;
          tab-size: 2;
        }
        .tts-options-editor:focus {
          outline: none;
          border-color: #06C167;
        }
        .tts-options-editor::placeholder {
          color: #555;
        }
        .tts-options-editor:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        /* Test TTS button */
        .tts-test-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #333;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .tts-test-msg {
          flex: 1;
          min-width: 200px;
          padding: 10px 14px;
          background: #111;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
        }
        .tts-test-msg:focus {
          outline: none;
          border-color: #06C167;
        }
        .tts-test-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #06C167;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease;
          white-space: nowrap;
        }
        .tts-test-btn:hover {
          background: #05a357;
        }
        .tts-test-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tts-test-btn svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }
        .tts-test-status {
          font-size: 12px;
          color: #888;
          width: 100%;
        }
        .tts-test-status.success { color: #06C167; }
        .tts-test-status.error { color: #dc3545; }

        /* Per-player test button */
        .media-player-setting.test-row {
          padding-top: 8px;
          border-top: 1px solid #333;
          margin-top: 8px;
        }
        .player-test-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #06C167;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .player-test-btn:hover {
          background: #05a357;
        }
        .player-test-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .player-test-btn svg {
          width: 14px;
          height: 14px;
          fill: currentColor;
        }
        .player-tts-engine-select {
          width: 100%;
          padding: 10px 12px;
          background: #111;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
        }
        .player-tts-engine-select:focus {
          outline: none;
          border-color: #06C167;
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
          color: #666;
          cursor: pointer;
          padding: 2px 6px;
          font-size: 18px;
          border-radius: 4px;
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

        /* Two-column layout for Account Details + Statistics */
        .details-two-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 768px) {
          .details-two-column {
            grid-template-columns: 1fr;
          }
        }
        .details-two-column .details-section {
          height: 100%;
          box-sizing: border-box;
        }

        /* Statistics Card */
        .stats-section {
          background: #1a1a1a;
          border-radius: 16px;
          padding: 24px;
        }
        .stats-loading, .stats-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 30px 20px;
          color: #888;
          font-size: 14px;
        }
        .stats-overview {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        @media (max-width: 480px) {
          .stats-overview {
            grid-template-columns: 1fr;
          }
        }
        .stat-item {
          background: #111;
          border-radius: 10px;
          padding: 16px 12px;
          text-align: center;
          border: 1px solid #333;
        }
        .stat-value {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: #06C167;
          margin-bottom: 4px;
        }
        .stat-label {
          display: block;
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .top-restaurants {
          margin-top: 16px;
        }
        .top-restaurants-title {
          font-size: 13px;
          font-weight: 600;
          color: #888;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .top-restaurant-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: #111;
          border-radius: 8px;
          margin-bottom: 8px;
          border: 1px solid #222;
        }
        .top-restaurant-row:last-child {
          margin-bottom: 0;
        }
        .top-restaurant-rank {
          font-size: 20px;
          line-height: 1;
        }
        .top-restaurant-info {
          flex: 1;
          min-width: 0;
        }
        .top-restaurant-name {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .top-restaurant-stats {
          display: block;
          font-size: 12px;
          color: #888;
          margin-top: 2px;
        }

        /* Past Orders Section */
        .past-orders-section {
          padding: 24px;
          background: #1a1a1a;
          border-radius: 16px;
          box-sizing: border-box;
        }
        .past-orders-section .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #fff;
        }
        .past-orders-loading, .past-orders-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 20px;
          color: #888;
          font-size: 14px;
        }
        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #333;
          border-top-color: #06C167;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .past-orders-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .past-order-card {
          background: #111;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #333;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .past-order-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .past-order-card.cancelled {
          opacity: 0.7;
        }
        .past-order-image-container {
          width: 100%;
          height: 140px;
          overflow: hidden;
          background: #222;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .past-order-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .past-order-image-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          background: #222;
          color: #444;
        }
        .past-order-name {
          padding: 12px 14px 4px;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .past-order-date {
          padding: 0 14px 12px;
          font-size: 12px;
          color: #888;
        }
        .order-cancelled-badge {
          background: #dc3545;
          color: #fff;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 6px;
          text-transform: uppercase;
          font-weight: 600;
        }
        .past-order-details {
          padding: 0 14px 14px;
          border-top: 1px solid #222;
        }
        .past-order-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 8px 0;
          border-bottom: 1px solid #222;
        }
        .past-order-row:last-child {
          border-bottom: none;
        }
        .past-order-row.total {
          font-weight: 600;
        }
        .past-order-row.total .past-order-value {
          color: #06C167;
        }
        .past-order-label {
          font-size: 12px;
          color: #888;
          flex-shrink: 0;
          margin-right: 12px;
        }
        .past-order-value {
          font-size: 13px;
          color: #fff;
          text-align: right;
          word-break: break-word;
        }
        .past-order-value.address {
          font-size: 11px;
          color: #aaa;
          max-width: 150px;
        }
        .past-order-value.rating {
          color: #ffc107;
        }
      </style>
    `;
  }

  _renderMainPage() {
    let accountCards = "";
    
    if (this._accounts.length > 0) {
      // For each account, render one card per active order, or a "no order" card if none
      for (const acc of this._accounts) {
        const orders = acc.orders || [];
        if (orders.length > 0) {
          // Render one card per order
          for (let i = 0; i < orders.length; i++) {
            accountCards += this._renderOrderCard(acc, orders[i], i);
          }
        } else {
          // No active orders - render a "no order" card
          accountCards += this._renderNoOrderCard(acc);
        }
      }
    } else {
      accountCards = this._renderEmptyState();
    }

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

  /** Format phone for display: (XXX) XXX-XXXX */
  _formatDriverPhone(phone) {
    if (!phone || typeof phone !== "string") return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === "1") return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return phone;
  }

  /** Render a card for a specific order */
  _renderOrderCard(account, order, orderIndex) {
    const esc = (s) => this._escapeHtml(s ?? "");
    const hasError = account.connection_status === "error";
    const cardClass = "account-card has-order";
    const noDriver =
      !order.driver_name ||
      order.driver_name === "No Driver Assigned" ||
      order.driver_name === "Unknown";

    // Get driver coordinates or fall back to home
    const driverCoords = order.driver_location_coords || {};
    const lat = driverCoords.lat || order.driver_location_lat || (this._hass?.config?.latitude || 0);
    const lon = driverCoords.lon || order.driver_location_lon || (this._hass?.config?.longitude || 0);
    const mapUrl = this._getMapUrl(lat, lon, 0.001);
    const mapLabel = !noDriver ? "📍 Driver" : "🏠 Home";

    const timelineSummary = (order.order_status || order.order_status_description || "").trim();
    const timelineDisplay = timelineSummary && timelineSummary !== "Unknown" && timelineSummary !== "No Active Order"
      ? timelineSummary
      : `Order ${orderIndex + 1}`;
    const driverDisplay = noDriver ? "" : order.driver_name;
    const etaDisplay =
      order.driver_eta_str && order.driver_eta_str !== "No ETA" && order.driver_eta_str !== "No ETA Available"
        ? order.driver_eta_str
        : "—";

    const userPic = order.user_picture_url || account.user_picture_url;
    const driverPic = order.driver_picture_url;
    const accountInitial = (account.account_name || "?").charAt(0).toUpperCase();

    const cardStages = ["preparing", "picked up", "en route", "arriving"];
    const cardStageIdx = cardStages.findIndex(s => (order.order_stage || "").toLowerCase().includes(s));
    const safeStageIdx = cardStageIdx >= 0 ? cardStageIdx : 0;

    return `
      <div class="${cardClass}" data-entry-id="${account.entry_id}" data-order-index="${orderIndex}">
        <div class="card-main">
          <div class="card-account-pic">
            ${userPic ? `<img src="${esc(userPic)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />` : ""}
            <div class="account-fallback" style="${userPic ? "display:none" : ""}">${accountInitial}</div>
            <div class="card-account-overlay">
              <span class="account-name">${esc(account.account_name)}</span>
            </div>
          </div>
          <div class="card-info">
            <div class="card-header">
              ${!noDriver ? `
              <div class="driver-block">
                <div class="driver-avatar">
                  ${driverPic ? `<img src="${esc(driverPic)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />` : ""}
                  <span class="driver-fallback" style="${driverPic ? "display:none" : ""}">🚗</span>
                </div>
                <div class="driver-info">
                  <span class="driver-label">Driver</span>
                  <span class="driver-name">${esc(driverDisplay)}</span>
                </div>
              </div>
              ` : `<div></div>`}
              <span class="status-badge ${hasError ? 'status-error' : 'status-active'}">
                ${hasError ? 'Error' : 'Active Order'}
              </span>
            </div>
            <div class="card-oneline">
              <span class="card-oneline-label">Restaurant:</span>
              <span class="card-oneline-value">${esc(order.restaurant_name || "—")}</span>
              <span class="card-oneline-sep">·</span>
              <span class="card-oneline-label">ETA:</span>
              <span class="card-oneline-value">${esc(etaDisplay)}</span>
            </div>
            <div class="card-timeline">${esc(timelineDisplay)}</div>
            <div class="card-stage-progress" title="Preparing → Picked up → En route → Arriving">
              ${cardStages.map((_, i) => {
                const completed = i < safeStageIdx;
                const current = i === safeStageIdx;
                return `<div class="card-stage-bar ${completed ? "active" : ""} ${current ? "current" : ""}"></div>`;
              }).join("")}
            </div>
          </div>
          <div class="card-map">
            ${mapUrl ? `
              <iframe src="${mapUrl}" title="Location Map"></iframe>
              <div class="card-map-click-overlay" aria-hidden="true"></div>
              <div class="map-overlay">${mapLabel}</div>
            ` : `
              <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:13px;">
                Map unavailable
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  /** Render a "no order" card for an account */
  _renderNoOrderCard(account) {
    const esc = (s) => this._escapeHtml(s ?? "");
    const hasError = account.connection_status === "error";
    const cardClass = "account-card";

    const lat = this._hass?.config?.latitude || 0;
    const lon = this._hass?.config?.longitude || 0;
    const mapUrl = this._getMapUrl(lat, lon, 0.001);

    const userPic = account.user_picture_url;
    const accountInitial = (account.account_name || "?").charAt(0).toUpperCase();

    return `
      <div class="${cardClass}" data-entry-id="${account.entry_id}">
        <div class="card-main">
          <div class="card-account-pic">
            ${userPic ? `<img src="${esc(userPic)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />` : ""}
            <div class="account-fallback" style="${userPic ? "display:none" : ""}">${accountInitial}</div>
            <div class="card-account-overlay">
              <span class="account-name">${esc(account.account_name)}</span>
            </div>
          </div>
          <div class="card-info card-info-noorder">
            ${hasError ? `
              <div class="card-error-message">Connection Error</div>
            ` : `
              <div class="card-waiting-message">Waiting for orders</div>
            `}
          </div>
          <div class="card-map">
            ${mapUrl ? `
              <iframe src="${mapUrl}" title="Location Map"></iframe>
              <div class="card-map-click-overlay" aria-hidden="true"></div>
              <div class="map-overlay">🏠 Home</div>
            ` : `
              <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:13px;">
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

    const isConnected = acc.connection_status !== "error";

    return `
      <div class="details-page">
        <div class="details-header">
          <button class="menu-btn" id="menu-btn" title="Menu">
            <svg viewBox="0 0 24 24"><path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"/></svg>
          </button>
          <button class="btn-icon" id="back-btn">←</button>
          <h2>${this._escapeHtml(acc.account_name)}</h2>
          <div class="connection-indicator">
            <span class="status-dot ${isConnected ? 'connected' : 'disconnected'}"></span>
            <span style="font-size:13px;color:${isConnected ? '#06C167' : '#dc3545'}">
              ${isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div class="details-content">
          <div class="details-two-column">
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
            </div>
            
            ${this._renderStatisticsCard()}
          </div>
          
          ${this._renderTtsSection(acc)}
          
          ${this._renderPastOrdersSection(acc)}
          
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
      tts_media_player_volumes: {},
      tts_media_player_settings: {},
      tts_cache: true,
      tts_language: "",
      tts_options: {},
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
    const defaultVol = typeof settings.tts_volume === "number" ? settings.tts_volume : 0.5;
    const perPlayerVols = settings.tts_media_player_volumes || {};
    const ttsCache = settings.tts_cache !== false;
    const ttsLanguage = settings.tts_language || "";
    const ttsOptions = settings.tts_options || {};
    const ttsOptionsYaml = Object.keys(ttsOptions).length > 0
      ? Object.entries(ttsOptions).map(([k, v]) => `${k}: ${v}`).join("\n")
      : "";
    // langEnabled/optionsEnabled: true if has value OR if user just toggled on
    const langEnabled = !!ttsLanguage || this._langEnabled;
    const optionsEnabled = Object.keys(ttsOptions).length > 0 || this._optEnabled;
    const intervalEnabled = !!settings.tts_interval_enabled;
    const intervalMinutes = Math.max(5, Math.min(15, parseInt(settings.tts_interval_minutes, 10) || 10));
    const driverNearbyEnabled = !!settings.driver_nearby_automation_enabled;
    const driverAutomationEntity = settings.driver_nearby_automation_entity || "";
    const driverNearbyDistance = Math.max(50, Math.min(2000, parseInt(settings.driver_nearby_distance_feet, 10) || 200));
    const automations = this._automations || [];
    const collapsed = this._advancedSettingsCollapsed;

    const ttsSelectOptions = ttsList.map((e) =>
      `<option value="${e.entity_id}" ${e.entity_id === settings.tts_entity_id ? "selected" : ""}>${e.name || e.entity_id}</option>`
    ).join("");

    const mediaAvailableToAdd = mediaList.filter((e) => !selectedMedia.includes(e.entity_id));
    const mediaAddOptions = mediaAvailableToAdd.map((e) =>
      `<option value="${e.entity_id}">${e.name || e.entity_id}</option>`
    ).join("");

    // Per-player settings (stored in tts_media_player_settings or derived from global)
    const perPlayerSettings = settings.tts_media_player_settings || {};

    // Each media player: collapsible sub-card with full settings (including TTS engine and test button)
    const mediaPlayersHtml = selectedMedia.map((entityId) => {
      const ent = mediaList.find((e) => e.entity_id === entityId);
      const name = ent ? (ent.name || entityId) : entityId;
      const playerSettings = perPlayerSettings[entityId] || {};
      const vol = typeof perPlayerVols[entityId] === "number" ? perPlayerVols[entityId] : defaultVol;
      const playerCache = playerSettings.cache !== undefined ? playerSettings.cache : ttsCache;
      const playerLang = playerSettings.language || "";
      const playerOpts = playerSettings.options || {};
      const playerOptsYaml = Object.keys(playerOpts).length > 0
        ? Object.entries(playerOpts).map(([k, v]) => `${k}: ${v}`).join("\n")
        : "";
      const playerLangEnabled = !!playerLang || (this._playerLangEnabled || {})[entityId];
      const playerOptsEnabled = Object.keys(playerOpts).length > 0 || (this._playerOptsEnabled || {})[entityId];
      const isExpanded = !!(this._expandedPlayers || {})[entityId];
      // Per-player TTS engine - show what's actually saved (not global fallback for display)
      const playerTtsEntitySaved = playerSettings.tts_entity_id || "";
      // But for test button and actual use, fall back to global
      const playerTtsEntityEffective = playerTtsEntitySaved || settings.tts_entity_id || "";

      return `
        <div class="media-player-item${isExpanded ? " expanded" : ""}" data-entity-id="${entityId}">
          <div class="media-player-header" data-toggle-player="${entityId}">
            <svg class="media-player-expand-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            <span class="media-player-name">${esc(name)}</span>
            <button type="button" class="media-player-remove" data-entity-id="${entityId}" data-entry-id="${acc.entry_id}" aria-label="Remove" title="Remove">×</button>
          </div>
          <div class="media-player-body">
            <div class="media-player-setting">
              <label>Volume Level</label>
              <div class="volume-slider-row">
                <input type="range" class="player-volume-slider" data-entity-id="${entityId}" data-entry-id="${acc.entry_id}" min="0" max="1" step="0.05" value="${vol}" ${enabled ? "" : "disabled"} />
                <span class="volume-value player-volume-value" data-entity-id="${entityId}">${Math.round(vol * 100)}%</span>
              </div>
            </div>
            <div class="media-player-setting">
              <label>TTS Engine</label>
              <select class="player-tts-engine-select" data-entity-id="${entityId}" data-entry-id="${acc.entry_id}" ${enabled ? "" : "disabled"}>
                <option value="">—</option>
                ${ttsList.map((e) =>
                  `<option value="${e.entity_id}" ${e.entity_id === playerTtsEntitySaved ? "selected" : ""}>${e.name || e.entity_id}</option>`
                ).join("")}
              </select>
            </div>
            <div class="media-player-setting">
              <div class="player-setting-toggle-row">
                <span class="player-setting-label">Cache</span>
                <div class="tts-toggle small${playerCache ? " enabled" : ""}" data-player-cache="${entityId}" data-entry-id="${acc.entry_id}" role="button" tabindex="0"><span class="tts-toggle-knob"></span></div>
              </div>
            </div>
            <div class="media-player-setting">
              <div class="player-setting-toggle-row">
                <span class="player-setting-label">Language</span>
                <div class="tts-toggle small${playerLangEnabled ? " enabled" : ""}" data-player-lang-toggle="${entityId}" data-entry-id="${acc.entry_id}" role="button" tabindex="0"><span class="tts-toggle-knob"></span></div>
              </div>
              ${playerLangEnabled ? `<input type="text" class="player-lang-input" data-entity-id="${entityId}" data-entry-id="${acc.entry_id}" value="${esc(playerLang)}" placeholder="e.g. en, es, fr" ${enabled ? "" : "disabled"} />` : ""}
            </div>
            <div class="media-player-setting">
              <div class="player-setting-toggle-row">
                <span class="player-setting-label">Options</span>
                <div class="tts-toggle small${playerOptsEnabled ? " enabled" : ""}" data-player-opts-toggle="${entityId}" data-entry-id="${acc.entry_id}" role="button" tabindex="0"><span class="tts-toggle-knob"></span></div>
              </div>
              ${playerOptsEnabled ? `<textarea class="player-opts-editor" data-entity-id="${entityId}" data-entry-id="${acc.entry_id}" placeholder="voice: en_US-trump-high" ${enabled ? "" : "disabled"}>${esc(playerOptsYaml)}</textarea>` : ""}
            </div>
            <div class="media-player-setting test-row">
              <button type="button" class="player-test-btn" data-entity-id="${entityId}" data-entry-id="${acc.entry_id}" ${enabled && playerTtsEntityEffective ? "" : "disabled"}>
                <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                Test
              </button>
            </div>
          </div>
        </div>`;
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
              <label>Media Players</label>
              <div class="media-players-list" id="media-players-list">${mediaPlayersHtml}</div>
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

  /** Parse simple YAML-like key: value lines into a dict. */
  _parseYamlOptions(text) {
    const result = {};
    if (!text || !text.trim()) return result;
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx <= 0) continue;
      const key = trimmed.substring(0, colonIdx).trim();
      let val = trimmed.substring(colonIdx + 1).trim();
      // Try to parse booleans and numbers
      if (val === "true") val = true;
      else if (val === "false") val = false;
      else if (val !== "" && !isNaN(Number(val))) val = Number(val);
      if (key) result[key] = val;
    }
    return result;
  }

  _renderStatisticsCard() {
    const stats = this._accountStats;
    const isLoading = this._pastOrdersLoading;

    if (isLoading) {
      return `
        <div class="details-section stats-section">
          <div class="section-title">Statistics (${new Date().getFullYear()})</div>
          <div class="stats-loading">
            <div class="loading-spinner"></div>
            <span>Calculating...</span>
          </div>
        </div>
      `;
    }

    if (!stats) {
      return `
        <div class="details-section stats-section">
          <div class="section-title">Statistics (${new Date().getFullYear()})</div>
          <div class="stats-empty">No data available</div>
        </div>
      `;
    }

    const year = stats.year || new Date().getFullYear();
    const totalOrders = stats.total_orders || 0;
    const totalSpent = typeof stats.total_spent === "number" ? `$${stats.total_spent.toFixed(2)}` : "$0.00";
    const totalDeliveryFees = typeof stats.total_delivery_fees === "number" ? `$${stats.total_delivery_fees.toFixed(2)}` : "$0.00";
    const topRestaurants = stats.top_restaurants || [];

    const topRestaurantsHtml = topRestaurants.length > 0 
      ? topRestaurants.map((r, idx) => {
          const name = this._escapeHtml(r.name || "Unknown");
          const orderCount = r.order_count || 0;
          const spent = typeof r.total_spent === "number" ? `$${r.total_spent.toFixed(2)}` : "$0.00";
          const medals = ["🥇", "🥈", "🥉"];
          return `
            <div class="top-restaurant-row">
              <span class="top-restaurant-rank">${medals[idx] || (idx + 1)}</span>
              <div class="top-restaurant-info">
                <span class="top-restaurant-name">${name}</span>
                <span class="top-restaurant-stats">${orderCount} order${orderCount !== 1 ? "s" : ""} · ${spent}</span>
              </div>
            </div>
          `;
        }).join("")
      : `<div class="stats-empty">No orders yet</div>`;

    return `
      <div class="details-section stats-section">
        <div class="section-title">Statistics (${year})</div>
        
        <div class="stats-overview">
          <div class="stat-item">
            <span class="stat-value">${totalOrders}</span>
            <span class="stat-label">Total Deliveries</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${totalSpent}</span>
            <span class="stat-label">Total Spent</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${totalDeliveryFees}</span>
            <span class="stat-label">Delivery Fees</span>
          </div>
        </div>
        
        <div class="top-restaurants">
          <div class="top-restaurants-title">Top Restaurants</div>
          ${topRestaurantsHtml}
        </div>
      </div>
    `;
  }

  _renderPastOrdersSection(acc) {
    const isLoading = this._pastOrdersLoading;
    const orders = this._pastOrders || [];
    const stats = this._accountStats;
    const year = stats?.year || new Date().getFullYear();

    if (isLoading) {
      return `
        <div class="past-orders-section">
          <div class="section-title">Past Orders (${year})</div>
          <div class="past-orders-loading">
            <div class="loading-spinner"></div>
            <span>Loading past orders...</span>
          </div>
        </div>
      `;
    }

    if (orders.length === 0) {
      return `
        <div class="past-orders-section">
          <div class="section-title">Past Orders (${year})</div>
          <div class="past-orders-empty">
            <span>No past orders found for ${year}</span>
          </div>
        </div>
      `;
    }

    const orderCardsHtml = orders.map((order) => {
      const imgUrl = order.hero_image_url || "";
      const name = this._escapeHtml(order.restaurant_name || "Unknown");
      const date = this._escapeHtml(order.date || "");
      const subtotal = typeof order.subtotal === "number" ? `$${order.subtotal.toFixed(2)}` : "—";
      const deliveryFee = typeof order.delivery_fee === "number" ? `$${order.delivery_fee.toFixed(2)}` : "—";
      const tax = typeof order.tax === "number" ? `$${order.tax.toFixed(2)}` : null;
      const promotions = typeof order.promotions === "number" && order.promotions < 0 ? `-$${Math.abs(order.promotions).toFixed(2)}` : null;
      const total = typeof order.total === "number" ? `$${order.total.toFixed(2)}` : "—";
      // Clean address: remove empty fields (double commas, leading/trailing commas)
      const rawAddress = order.store_address || "—";
      const cleanAddress = rawAddress
        .replace(/,\s*,/g, ",")  // Remove double commas
        .replace(/^,\s*/, "")    // Remove leading comma
        .replace(/,\s*$/, "")    // Remove trailing comma
        .replace(/,\s+/g, ", ") // Normalize spacing after commas
        .trim();
      const storeAddress = this._escapeHtml(cleanAddress || "—");
      const isCancelled = order.is_cancelled;

      return `
        <div class="past-order-card${isCancelled ? " cancelled" : ""}">
          <div class="past-order-image-container">
            ${imgUrl ? `<img src="${imgUrl}" alt="${name}" class="past-order-image" loading="lazy" crossorigin="anonymous" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="past-order-image-fallback" style="display:none">🍔</div>` : `<div class="past-order-image-fallback">🍔</div>`}
          </div>
          <div class="past-order-name">${name}</div>
          <div class="past-order-date">${date}${isCancelled ? ` <span class="order-cancelled-badge">Cancelled</span>` : ""}</div>
          <div class="past-order-details">
            <div class="past-order-row">
              <span class="past-order-label">Subtotal</span>
              <span class="past-order-value">${subtotal}</span>
            </div>
            <div class="past-order-row">
              <span class="past-order-label">Delivery Fee</span>
              <span class="past-order-value">${deliveryFee}</span>
            </div>
            ${tax ? `
            <div class="past-order-row">
              <span class="past-order-label">Tax</span>
              <span class="past-order-value">${tax}</span>
            </div>
            ` : ""}
            ${promotions ? `
            <div class="past-order-row">
              <span class="past-order-label">Promotions</span>
              <span class="past-order-value">${promotions}</span>
            </div>
            ` : ""}
            <div class="past-order-row total">
              <span class="past-order-label">Total</span>
              <span class="past-order-value">${total}</span>
            </div>
            <div class="past-order-row">
              <span class="past-order-label">Address</span>
              <span class="past-order-value address">${storeAddress}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="past-orders-section">
        <div class="section-title">Past Orders (${year})</div>
        <div class="past-orders-grid">
          ${orderCardsHtml}
        </div>
      </div>
    `;
  }

  async _fetchPastOrders(entryId) {
    if (!this._hass || !entryId) return;
    
    // Backend handles caching - returns cached data instantly if available
    // Show loading indicator only briefly (backend may return cached data immediately)
    this._pastOrdersLoading = true;
    this._render();
    
    try {
      const result = await this._hass.callWS({
        type: "uber_eats/get_past_orders",
        entry_id: entryId,
      });
      
      this._pastOrders = result.orders || [];
      this._accountStats = result.statistics || null;
      
      // If from_cache is true, backend is refreshing in background
      // Data will be fresh on next fetch
      if (result.from_cache) {
        console.debug("Loaded past orders from server cache, background refresh in progress");
      }
    } catch (err) {
      console.error("Failed to fetch past orders:", err);
      this._pastOrders = [];
      this._accountStats = null;
    } finally {
      this._pastOrdersLoading = false;
      this._render();
    }
  }

  async _fetchUserProfile(entryId) {
    if (!this._hass || !entryId) return;
    try {
      const result = await this._hass.callWS({
        type: "uber_eats/get_user_profile",
        entry_id: entryId,
      });
      this._userProfile = result || null;
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      this._userProfile = null;
    }
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

    // Toggle media player card expansion
    this.shadowRoot.querySelectorAll(".media-player-header[data-toggle-player]").forEach((header) => {
      header.addEventListener("click", (e) => {
        // Don't toggle if clicking the remove button
        if (e.target.closest(".media-player-remove")) return;
        const entityId = header.dataset.togglePlayer;
        const item = header.closest(".media-player-item");
        if (item && entityId) {
          const wasExpanded = item.classList.contains("expanded");
          item.classList.toggle("expanded");
          // Persist state so re-render doesn't lose it
          this._expandedPlayers = { ...this._expandedPlayers, [entityId]: !wasExpanded };
        }
      });
    });

    // Remove media player buttons
    this.shadowRoot.querySelectorAll(".media-player-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const entityId = btn.dataset.entityId;
        const entryId = btn.dataset.entryId;
        const current = Array.isArray(this._ttsSettings?.tts_media_players) ? this._ttsSettings.tts_media_players : [];
        const vols = { ...(this._ttsSettings?.tts_media_player_volumes || {}) };
        delete vols[entityId];
        const settings = { ...this._ttsSettings, tts_media_players: current.filter((id) => id !== entityId), tts_media_player_volumes: vols };
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

    // Per-media-player volume sliders
    this.shadowRoot.querySelectorAll(".player-volume-slider").forEach((slider) => {
      const entityId = slider.dataset.entityId;
      const entryId = slider.dataset.entryId;
      const valueSpan = this.shadowRoot.querySelector(`.player-volume-value[data-entity-id="${entityId}"]`);
      slider.addEventListener("input", () => {
        if (valueSpan) valueSpan.textContent = Math.round(parseFloat(slider.value) * 100) + "%";
      });
      slider.addEventListener("change", () => {
        const v = parseFloat(slider.value);
        const vols = { ...(this._ttsSettings?.tts_media_player_volumes || {}) };
        vols[entityId] = v;
        const settings = { ...this._ttsSettings, tts_media_player_volumes: vols };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      });
    });

    // Per-player cache toggles
    this.shadowRoot.querySelectorAll("[data-player-cache]").forEach((toggle) => {
      const entityId = toggle.dataset.playerCache;
      const entryId = toggle.dataset.entryId;
      const handler = () => {
        const perPlayerSettings = { ...(this._ttsSettings?.tts_media_player_settings || {}) };
        const playerSettings = { ...(perPlayerSettings[entityId] || {}) };
        playerSettings.cache = !(playerSettings.cache !== false);
        perPlayerSettings[entityId] = playerSettings;
        const settings = { ...this._ttsSettings, tts_media_player_settings: perPlayerSettings };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      };
      toggle.addEventListener("click", handler);
    });

    // Per-player language toggles
    this.shadowRoot.querySelectorAll("[data-player-lang-toggle]").forEach((toggle) => {
      const entityId = toggle.dataset.playerLangToggle;
      const entryId = toggle.dataset.entryId;
      const handler = () => {
        const perPlayerSettings = { ...(this._ttsSettings?.tts_media_player_settings || {}) };
        const playerSettings = { ...(perPlayerSettings[entityId] || {}) };
        const hasLang = !!playerSettings.language;
        const isUiEnabled = !!(this._playerLangEnabled || {})[entityId];
        // Currently enabled = has saved lang OR UI toggled on
        const currentlyEnabled = hasLang || isUiEnabled;
        if (currentlyEnabled) {
          // Disable - clear language and UI state
          playerSettings.language = "";
          perPlayerSettings[entityId] = playerSettings;
          this._playerLangEnabled = { ...this._playerLangEnabled, [entityId]: false };
          const settings = { ...this._ttsSettings, tts_media_player_settings: perPlayerSettings };
          this._saveTtsSettings(entryId, settings).then(() => this._render());
        } else {
          // Enable - show input
          this._playerLangEnabled = { ...this._playerLangEnabled, [entityId]: true };
          this._render();
        }
      };
      toggle.addEventListener("click", handler);
    });

    // Per-player language inputs
    this.shadowRoot.querySelectorAll(".player-lang-input").forEach((input) => {
      const entityId = input.dataset.entityId;
      const entryId = input.dataset.entryId;
      let debounceTimer;
      input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const perPlayerSettings = { ...(this._ttsSettings?.tts_media_player_settings || {}) };
          const playerSettings = { ...(perPlayerSettings[entityId] || {}) };
          playerSettings.language = input.value || "";
          perPlayerSettings[entityId] = playerSettings;
          const settings = { ...this._ttsSettings, tts_media_player_settings: perPlayerSettings };
          this._saveTtsSettings(entryId, settings);
        }, 600);
      });
    });

    // Per-player options toggles
    this.shadowRoot.querySelectorAll("[data-player-opts-toggle]").forEach((toggle) => {
      const entityId = toggle.dataset.playerOptsToggle;
      const entryId = toggle.dataset.entryId;
      const handler = () => {
        const perPlayerSettings = { ...(this._ttsSettings?.tts_media_player_settings || {}) };
        const playerSettings = { ...(perPlayerSettings[entityId] || {}) };
        const hasOpts = playerSettings.options && Object.keys(playerSettings.options).length > 0;
        const isUiEnabled = !!(this._playerOptsEnabled || {})[entityId];
        // Currently enabled = has saved options OR UI toggled on
        const currentlyEnabled = hasOpts || isUiEnabled;
        if (currentlyEnabled) {
          // Disable - clear options and UI state
          playerSettings.options = {};
          perPlayerSettings[entityId] = playerSettings;
          this._playerOptsEnabled = { ...this._playerOptsEnabled, [entityId]: false };
          const settings = { ...this._ttsSettings, tts_media_player_settings: perPlayerSettings };
          this._saveTtsSettings(entryId, settings).then(() => this._render());
        } else {
          // Enable - show editor
          this._playerOptsEnabled = { ...this._playerOptsEnabled, [entityId]: true };
          this._render();
        }
      };
      toggle.addEventListener("click", handler);
    });

    // Per-player options editors
    this.shadowRoot.querySelectorAll(".player-opts-editor").forEach((editor) => {
      const entityId = editor.dataset.entityId;
      const entryId = editor.dataset.entryId;
      let debounceTimer;
      editor.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.value = editor.value.substring(0, start) + "  " + editor.value.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
        }
      });
      editor.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const perPlayerSettings = { ...(this._ttsSettings?.tts_media_player_settings || {}) };
          const playerSettings = { ...(perPlayerSettings[entityId] || {}) };
          playerSettings.options = this._parseYamlOptions(editor.value);
          perPlayerSettings[entityId] = playerSettings;
          const settings = { ...this._ttsSettings, tts_media_player_settings: perPlayerSettings };
          this._saveTtsSettings(entryId, settings);
        }, 800);
      });
    });

    // Per-player TTS engine select
    this.shadowRoot.querySelectorAll(".player-tts-engine-select").forEach((select) => {
      const entityId = select.dataset.entityId;
      const entryId = select.dataset.entryId;
      select.addEventListener("change", () => {
        const perPlayerSettings = { ...(this._ttsSettings?.tts_media_player_settings || {}) };
        const playerSettings = { ...(perPlayerSettings[entityId] || {}) };
        playerSettings.tts_entity_id = select.value || "";
        perPlayerSettings[entityId] = playerSettings;
        const settings = { ...this._ttsSettings, tts_media_player_settings: perPlayerSettings };
        this._saveTtsSettings(entryId, settings).then(() => this._render());
      });
    });

    // Per-player test buttons
    this.shadowRoot.querySelectorAll(".player-test-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const entityId = btn.dataset.entityId;
        const entryId = btn.dataset.entryId;
        const settings = this._ttsSettings || {};
        const perPlayerSettings = settings.tts_media_player_settings || {};
        const playerSettings = perPlayerSettings[entityId] || {};
        const perPlayerVols = settings.tts_media_player_volumes || {};
        const defaultVol = typeof settings.tts_volume === "number" ? settings.tts_volume : 0.5;
        const vol = typeof perPlayerVols[entityId] === "number" ? perPlayerVols[entityId] : defaultVol;
        const ttsEntity = playerSettings.tts_entity_id || settings.tts_entity_id || "";
        const playerCache = playerSettings.cache !== undefined ? playerSettings.cache : (settings.tts_cache !== false);
        const playerLang = playerSettings.language || settings.tts_language || "";
        const playerOpts = (playerSettings.options && Object.keys(playerSettings.options).length > 0)
          ? playerSettings.options : (settings.tts_options || {});

        if (!ttsEntity) {
          alert("Please select a TTS engine first.");
          return;
        }

        btn.disabled = true;
        try {
          await this._hass.callWS({
            type: "uber_eats/test_tts",
            tts_entity_id: ttsEntity,
            media_player_id: entityId,
            message: "uber eats",
            volume_level: vol,
            cache: playerCache,
            language: playerLang,
            options: playerOpts,
          });
        } catch (err) {
          alert("Test failed: " + (err.message || err));
        } finally {
          btn.disabled = false;
        }
      });
    });

    // Test TTS button (legacy global - now removed from UI but kept for compat)
    const testBtn = this.shadowRoot.querySelector("#tts-test-btn");
    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        const statusEl = this.shadowRoot.querySelector("#tts-test-status");
        const msgInput = this.shadowRoot.querySelector("#tts-test-message");
        const message = (msgInput?.value || "").trim() || "This is a test from Uber Eats";
        const settings = this._ttsSettings || {};
        const selectedMedia = Array.isArray(settings.tts_media_players) ? settings.tts_media_players : [];
        const ttsEntity = settings.tts_entity_id || "";
        const perPlayerVols = settings.tts_media_player_volumes || {};
        const perPlayerSettings = settings.tts_media_player_settings || {};
        const defaultVol = typeof settings.tts_volume === "number" ? settings.tts_volume : 0.5;
        // Fallback to global settings (if per-player not set)
        const globalCache = settings.tts_cache !== false;
        const globalLanguage = (settings.tts_language || "").trim() || undefined;
        const globalOptions = settings.tts_options && Object.keys(settings.tts_options).length > 0 ? settings.tts_options : undefined;

        if (!ttsEntity) {
          if (statusEl) { statusEl.textContent = "No TTS engine selected."; statusEl.className = "tts-test-status error"; }
          return;
        }
        if (selectedMedia.length === 0) {
          if (statusEl) { statusEl.textContent = "No media players added."; statusEl.className = "tts-test-status error"; }
          return;
        }

        testBtn.disabled = true;
        if (statusEl) { statusEl.textContent = "Sending..."; statusEl.className = "tts-test-status"; }

        // Send test to each selected media player using per-player settings
        let allOk = true;
        for (const mp of selectedMedia) {
          const vol = typeof perPlayerVols[mp] === "number" ? perPlayerVols[mp] : defaultVol;
          const playerSettings = perPlayerSettings[mp] || {};
          const playerCache = playerSettings.cache !== undefined ? playerSettings.cache : globalCache;
          const playerLang = playerSettings.language || globalLanguage || "";
          const playerOpts = (playerSettings.options && Object.keys(playerSettings.options).length > 0)
            ? playerSettings.options : (globalOptions || {});
          try {
            await this._hass.callWS({
              type: "uber_eats/test_tts",
              tts_entity_id: ttsEntity,
              media_player_id: mp,
              message,
              volume_level: vol,
              cache: playerCache,
              language: playerLang,
              options: playerOpts,
            });
          } catch (err) {
            allOk = false;
            if (statusEl) { statusEl.textContent = "Error: " + (err.message || err); statusEl.className = "tts-test-status error"; }
          }
        }
        if (allOk && statusEl) {
          statusEl.textContent = "Test sent successfully!";
          statusEl.className = "tts-test-status success";
        }
        testBtn.disabled = false;
      });
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
        const minutes = Math.max(5, Math.min(15, parseInt(intervalMinutesSelect.value, 10) || 10));
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
