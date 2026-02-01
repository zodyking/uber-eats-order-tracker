/**
 * Uber Eats Panel for Home Assistant
 * Displays accounts, order status, and driver location on map
 */
class UberEatsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._accounts = [];
    this._selectedAccount = null;
    this._refreshInterval = null;
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
  }

  disconnectedCallback() {
    this._stopAutoRefresh();
  }

  _startAutoRefresh() {
    this._refreshInterval = setInterval(() => {
      this._loadAccounts();
    }, 15000); // Refresh every 15 seconds
  }

  _stopAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  async _loadAccounts() {
    if (!this._hass) return;
    
    try {
      const result = await this._hass.callWS({
        type: "uber_eats/get_accounts",
      });
      this._accounts = result.accounts || [];
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
    
    if (!confirm("Are you sure you want to delete this account?")) {
      return;
    }
    
    try {
      await this._hass.callWS({
        type: "uber_eats/delete_account",
        entry_id: entryId,
      });
      this._selectedAccount = null;
      await this._loadAccounts();
    } catch (e) {
      console.error("Failed to delete account:", e);
      alert("Failed to delete account: " + e.message);
    }
  }

  _addAccount() {
    // Navigate to config flow
    window.location.href = "/config/integrations/integration/uber_eats";
  }

  _reconfigureAccount(entryId) {
    // Navigate to reconfigure flow
    window.location.href = `/config/integrations/integration/uber_eats#config_entry=${entryId}`;
  }

  async _selectAccount(entryId) {
    const details = await this._loadAccountDetails(entryId);
    if (details) {
      this._selectedAccount = details;
      this._render();
    }
  }

  _render() {
    const styles = `
      <style>
        :host {
          display: block;
          height: 100%;
          background: var(--primary-background-color, #111);
          color: var(--primary-text-color, #fff);
          font-family: var(--paper-font-body1_-_font-family, 'Roboto', sans-serif);
          overflow-y: auto;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px;
        }
        
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: linear-gradient(135deg, #06C167 0%, #05a558 100%);
          border-radius: 12px;
          margin-bottom: 24px;
        }
        
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: white;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .header-icon {
          font-size: 32px;
        }
        
        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .btn-primary {
          background: white;
          color: #06C167;
        }
        
        .btn-primary:hover {
          background: #f0f0f0;
          transform: translateY(-1px);
        }
        
        .btn-danger {
          background: #dc3545;
          color: white;
        }
        
        .btn-danger:hover {
          background: #c82333;
        }
        
        .btn-secondary {
          background: var(--secondary-background-color, #333);
          color: var(--primary-text-color, #fff);
        }
        
        .btn-secondary:hover {
          background: var(--primary-color, #03a9f4);
        }
        
        .accounts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .account-card {
          background: var(--card-background-color, #1e1e1e);
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 2px solid transparent;
        }
        
        .account-card:hover {
          border-color: #06C167;
          transform: translateY(-2px);
        }
        
        .account-card.active-order {
          border-color: #06C167;
          background: linear-gradient(135deg, rgba(6, 193, 103, 0.1) 0%, var(--card-background-color, #1e1e1e) 100%);
        }
        
        .account-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        
        .account-name {
          font-size: 18px;
          font-weight: 600;
          color: var(--primary-text-color, #fff);
        }
        
        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
        }
        
        .status-active {
          background: #06C167;
          color: white;
        }
        
        .status-inactive {
          background: var(--secondary-background-color, #333);
          color: var(--secondary-text-color, #888);
        }
        
        .account-details {
          display: grid;
          gap: 8px;
        }
        
        .detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }
        
        .detail-label {
          color: var(--secondary-text-color, #888);
        }
        
        .detail-value {
          color: var(--primary-text-color, #fff);
          font-weight: 500;
        }
        
        .order-details-panel {
          background: var(--card-background-color, #1e1e1e);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        
        .order-details-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--divider-color, #333);
        }
        
        .order-details-title {
          font-size: 20px;
          font-weight: 600;
        }
        
        .order-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        
        @media (max-width: 768px) {
          .order-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .order-info {
          display: grid;
          gap: 16px;
        }
        
        .info-group {
          background: var(--primary-background-color, #111);
          border-radius: 8px;
          padding: 16px;
        }
        
        .info-group-title {
          font-size: 12px;
          text-transform: uppercase;
          color: var(--secondary-text-color, #888);
          margin-bottom: 8px;
        }
        
        .info-group-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--primary-text-color, #fff);
        }
        
        .info-group-subtitle {
          font-size: 14px;
          color: var(--secondary-text-color, #888);
          margin-top: 4px;
        }
        
        .map-container {
          border-radius: 8px;
          overflow: hidden;
          height: 300px;
          background: var(--primary-background-color, #111);
        }
        
        .map-container iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        
        .map-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--secondary-text-color, #888);
          font-size: 14px;
        }
        
        .stage-indicator {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        
        .stage-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--secondary-background-color, #333);
        }
        
        .stage-dot.active {
          background: #06C167;
        }
        
        .stage-dot.completed {
          background: #06C167;
        }
        
        .actions-row {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        
        .no-accounts {
          text-align: center;
          padding: 60px 20px;
          color: var(--secondary-text-color, #888);
        }
        
        .no-accounts h2 {
          color: var(--primary-text-color, #fff);
          margin-bottom: 16px;
        }
        
        .eta-highlight {
          color: #06C167;
          font-size: 24px;
        }
        
        .back-btn {
          background: none;
          border: none;
          color: var(--primary-text-color, #fff);
          cursor: pointer;
          padding: 8px;
          margin-right: 8px;
          font-size: 20px;
        }
        
        .driver-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .driver-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #06C167;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: white;
        }
      </style>
    `;

    let content = "";
    
    if (this._selectedAccount) {
      content = this._renderOrderDetails();
    } else {
      content = this._renderAccountsList();
    }

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="container">
        ${content}
      </div>
    `;

    this._attachEventListeners();
  }

  _renderAccountsList() {
    const accountCards = this._accounts.length > 0
      ? this._accounts.map(account => this._renderAccountCard(account)).join("")
      : `
        <div class="no-accounts">
          <h2>No Uber Eats Accounts</h2>
          <p>Add an account to start tracking your orders</p>
        </div>
      `;

    return `
      <div class="header">
        <h1>
          <span class="header-icon">🍔</span>
          Uber Eats Order Tracker
        </h1>
        <button class="btn btn-primary" id="add-account-btn">+ Add Account</button>
      </div>
      
      <div class="accounts-grid">
        ${accountCards}
      </div>
    `;
  }

  _renderAccountCard(account) {
    const isActive = account.active;
    const statusClass = isActive ? "status-active" : "status-inactive";
    const statusText = isActive ? "Active Order" : "No Order";
    const cardClass = isActive ? "account-card active-order" : "account-card";

    return `
      <div class="${cardClass}" data-entry-id="${account.entry_id}">
        <div class="account-header">
          <span class="account-name">${account.account_name}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        
        <div class="account-details">
          ${isActive ? `
            <div class="detail-row">
              <span class="detail-label">Restaurant</span>
              <span class="detail-value">${account.restaurant_name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status</span>
              <span class="detail-value">${account.order_stage}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Driver</span>
              <span class="detail-value">${account.driver_name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">ETA</span>
              <span class="detail-value" style="color: #06C167;">${account.driver_eta}</span>
            </div>
          ` : `
            <div class="detail-row">
              <span class="detail-label">Time Zone</span>
              <span class="detail-value">${account.time_zone}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status</span>
              <span class="detail-value">Waiting for orders...</span>
            </div>
          `}
        </div>
      </div>
    `;
  }

  _renderOrderDetails() {
    const acc = this._selectedAccount;
    const isActive = acc.active;
    const trackingActive = acc.tracking_active;
    
    const stages = ["preparing", "picked up", "en route", "arriving", "delivered"];
    const currentStageIndex = stages.indexOf(acc.order_stage?.toLowerCase()) || 0;

    const mapUrl = trackingActive && acc.driver_location?.lat && acc.driver_location?.lon
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${acc.driver_location.lon - 0.005}%2C${acc.driver_location.lat - 0.005}%2C${acc.driver_location.lon + 0.005}%2C${acc.driver_location.lat + 0.005}&layer=mapnik&marker=${acc.driver_location.lat}%2C${acc.driver_location.lon}`
      : null;

    return `
      <div class="header">
        <h1>
          <button class="back-btn" id="back-btn">←</button>
          ${acc.account_name}
        </h1>
        <div>
          <button class="btn btn-secondary" id="reconfigure-btn" data-entry-id="${acc.entry_id}">Edit</button>
          <button class="btn btn-danger" id="delete-btn" data-entry-id="${acc.entry_id}">Delete</button>
        </div>
      </div>
      
      <div class="order-details-panel">
        <div class="order-details-header">
          <span class="order-details-title">
            ${isActive ? `Order from ${acc.restaurant_name}` : "No Active Order"}
          </span>
          <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">
            ${isActive ? acc.order_stage : "Waiting"}
          </span>
        </div>
        
        ${isActive ? `
          <div class="stage-indicator">
            ${stages.map((stage, i) => `
              <div class="stage-dot ${i <= currentStageIndex ? 'completed' : ''}"></div>
            `).join("")}
          </div>
          
          <div class="order-grid" style="margin-top: 24px;">
            <div class="order-info">
              <div class="info-group">
                <div class="info-group-title">Restaurant</div>
                <div class="info-group-value">${acc.restaurant_name}</div>
                <div class="info-group-subtitle">Order #${acc.order_id?.substring(0, 8) || "N/A"}</div>
              </div>
              
              ${acc.driver_assigned ? `
                <div class="info-group">
                  <div class="info-group-title">Driver</div>
                  <div class="driver-info">
                    <div class="driver-avatar">🚗</div>
                    <div>
                      <div class="info-group-value">${acc.driver_name}</div>
                      <div class="info-group-subtitle">${acc.driver_location?.street || "En route"}</div>
                    </div>
                  </div>
                </div>
              ` : `
                <div class="info-group">
                  <div class="info-group-title">Driver</div>
                  <div class="info-group-value">Waiting for driver...</div>
                </div>
              `}
              
              <div class="info-group">
                <div class="info-group-title">Estimated Arrival</div>
                <div class="info-group-value eta-highlight">${acc.driver_eta}</div>
                ${acc.minutes_remaining ? `
                  <div class="info-group-subtitle">${acc.minutes_remaining} minutes remaining</div>
                ` : ""}
              </div>
              
              <div class="info-group">
                <div class="info-group-title">Status</div>
                <div class="info-group-value">${acc.order_status}</div>
                <div class="info-group-subtitle">${acc.latest_arrival}</div>
              </div>
            </div>
            
            <div class="map-container">
              ${mapUrl ? `
                <iframe src="${mapUrl}" title="Driver Location"></iframe>
              ` : `
                <div class="map-placeholder">
                  ${acc.driver_assigned ? "Loading map..." : "Map will appear when driver is assigned"}
                </div>
              `}
            </div>
          </div>
        ` : `
          <div class="no-accounts" style="padding: 40px 0;">
            <p>No active orders for this account.</p>
            <p style="font-size: 14px; margin-top: 8px;">Orders will appear here when you place one on Uber Eats.</p>
          </div>
        `}
      </div>
    `;
  }

  _attachEventListeners() {
    // Add account button
    const addBtn = this.shadowRoot.querySelector("#add-account-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => this._addAccount());
    }

    // Account cards
    const cards = this.shadowRoot.querySelectorAll(".account-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        const entryId = card.dataset.entryId;
        this._selectAccount(entryId);
      });
    });

    // Back button
    const backBtn = this.shadowRoot.querySelector("#back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        this._selectedAccount = null;
        this._render();
      });
    }

    // Reconfigure button
    const reconfigureBtn = this.shadowRoot.querySelector("#reconfigure-btn");
    if (reconfigureBtn) {
      reconfigureBtn.addEventListener("click", () => {
        const entryId = reconfigureBtn.dataset.entryId;
        this._reconfigureAccount(entryId);
      });
    }

    // Delete button
    const deleteBtn = this.shadowRoot.querySelector("#delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        const entryId = deleteBtn.dataset.entryId;
        this._deleteAccount(entryId);
      });
    }
  }
}

// Register the custom element
customElements.define("uber-eats-panel", UberEatsPanel);
