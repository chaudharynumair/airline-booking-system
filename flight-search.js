(() => {
    "use strict";

    /* =========================================================
       AIRFLOW FLIGHT SEARCH
       Professional Flight Search Module
       ========================================================= */

    const state = {
        results: [],
        filteredResults: [],
        sort: "cheapest",
        mode: "demo",
        lastSearch: null,
        tripType: "oneway"
    };

    /* =========================================================
       AIRLINES
    ========================================================= */

    const airlines = {
        EK: "Emirates",
        QR: "Qatar Airways",
        TK: "Turkish Airlines",
        EY: "Etihad Airways",
        SV: "Saudia",
        PK: "Pakistan International Airlines",
        GF: "Gulf Air",
        WY: "Oman Air",
        FZ: "flydubai",
        G9: "Air Arabia",
        AI: "Air India",
        "6E": "IndiGo",
        BA: "British Airways",
        LH: "Lufthansa",
        SQ: "Singapore Airlines"
    };

    /* =========================================================
       HELPERS
    ========================================================= */

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function todayISO() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function addDaysISO(days) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + Number(days || 0));

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatDate(date) {
        if (!date) return "";

        const d = new Date(`${date}T12:00:00`);

        if (Number.isNaN(d.getTime())) {
            return date;
        }

        return d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function formatMoney(amount, currency = "PKR") {
        const value = Number(amount);

        if (!Number.isFinite(value)) {
            return `${currency} 0`;
        }

        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency,
                maximumFractionDigits: 0
            }).format(value);
        } catch {
            return `${currency} ${Math.round(value).toLocaleString()}`;
        }
    }

    function getAirlineName(code, fallback = "") {
        const key = String(code || "").toUpperCase();

        return airlines[key] || fallback || key || "Airline";
    }

    function getStopsText(stops) {
        const count = Number(stops);

        if (!Number.isFinite(count) || count <= 0) {
            return "Non-stop";
        }

        if (count === 1) {
            return "1 stop";
        }

        return `${count} stops`;
    }

    function getStopsClass(stops) {
        const count = Number(stops);

        if (!Number.isFinite(count) || count <= 0) {
            return "nonstop";
        }

        if (count === 1) {
            return "one-stop";
        }

        return "multi-stop";
    }

    function normalizeTime(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    }

    function durationToMinutes(value) {
        if (typeof value === "number") {
            return value;
        }

        if (!value) return 999999;

        const text = String(value).toLowerCase();

        const hours = text.match(/(\d+)\s*h/);
        const minutes = text.match(/(\d+)\s*m/);

        return (
            (hours ? Number(hours[1]) * 60 : 0) +
            (minutes ? Number(minutes[1]) : 0)
        ) || 999999;
    }

    function getDurationText(flight) {
        if (flight.duration) {
            return String(flight.duration);
        }

        if (flight.durationMinutes) {
            const mins = Number(flight.durationMinutes);

            if (Number.isFinite(mins)) {
                const h = Math.floor(mins / 60);
                const m = mins % 60;

                return `${h}h ${m}m`;
            }
        }

        return "—";
    }

    function getPrice(flight) {
        const price = Number(
            flight.price ??
            flight.sellingPrice ??
            flight.fare ??
            0
        );

        return Number.isFinite(price) ? price : 0;
    }

    function getCurrency(flight) {
        return String(
            flight.currency ||
            flight.currencyCode ||
            "PKR"
        ).toUpperCase();
    }

    function getSeats(flight) {
        const seats = Number(
            flight.seatsAvailable ??
            flight.availableSeats ??
            flight.seats ??
            0
        );

        return Number.isFinite(seats) ? seats : 0;
    }

    function showError(message) {
        const error = document.getElementById("flightSearchError");

        if (!error) return;

        error.innerHTML = message
            ? `<div class="flight-error">${esc(message)}</div>`
            : "";
    }

    function clearError() {
        showError("");
    }

    function showToast(message, type = "success") {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
            return;
        }

        console.log(`[${type}] ${message}`);
    }

    /* =========================================================
       FLIGHT SEARCH STYLES
    ========================================================= */

    function injectStyles() {
        if (document.getElementById("airflowFlightSearchStyles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "airflowFlightSearchStyles";

        style.textContent = `
            #flightSearchView {
                display: none;
                width: 100%;
            }

            #flightSearchView.active {
                display: block;
            }

            .flight-page-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 20px;
            }

            .flight-page-head h1 {
                margin: 0;
            }

            .flight-mode {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 7px 12px;
                border-radius: 999px;
                background: #f2f4f7;
                color: #475467;
                font-size: 12px;
                font-weight: 800;
            }

            .flight-mode::before {
                content: "";
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: currentColor;
            }

            .flight-search-card {
                background: #fff;
                border: 1px solid #e4e7ec;
                border-radius: 18px;
                padding: 20px;
                box-shadow: 0 8px 25px rgba(16, 24, 40, .05);
            }

            .flight-trip-tabs {
                display: flex;
                gap: 8px;
                margin-bottom: 18px;
            }

            .flight-trip-tab {
                border: 1px solid #d0d5dd;
                background: #fff;
                color: #475467;
                padding: 9px 16px;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 800;
            }

            .flight-trip-tab.active {
                background: #111827;
                color: #fff;
                border-color: #111827;
            }

            .flight-fields {
                display: grid;
                grid-template-columns: 1fr 42px 1fr 1fr 1fr 1fr;
                gap: 12px;
                align-items: end;
            }

            .flight-field {
                min-width: 0;
            }

            .flight-field label {
                display: block;
                margin-bottom: 7px;
                font-size: 12px;
                font-weight: 800;
                color: #475467;
            }

            .flight-field input,
            .flight-field select {
                width: 100%;
                height: 46px;
                padding: 0 12px;
                border: 1px solid #d0d5dd;
                border-radius: 10px;
                background: #fff;
                color: #101828;
                outline: none;
                font-size: 14px;
            }

            .flight-field input:focus,
            .flight-field select:focus {
                border-color: #6366f1;
                box-shadow: 0 0 0 3px rgba(99, 102, 241, .1);
            }

            .flight-swap {
                width: 42px;
                height: 42px;
                border-radius: 50%;
                border: 1px solid #d0d5dd;
                background: #fff;
                cursor: pointer;
                font-size: 18px;
                font-weight: 900;
                margin-bottom: 2px;
            }

            .flight-swap:hover {
                background: #f9fafb;
                transform: rotate(180deg);
            }

            .flight-actions {
                display: flex;
                justify-content: flex-end;
                margin-top: 16px;
            }

            .flight-search-btn {
                height: 46px;
                padding: 0 22px;
                border: 0;
                border-radius: 10px;
                background: #111827;
                color: #fff;
                cursor: pointer;
                font-weight: 900;
            }

            .flight-search-btn:disabled {
                opacity: .6;
                cursor: not-allowed;
            }

            .flight-toolbar {
                display: none;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin: 20px 0 12px;
                padding: 12px 14px;
                background: #fff;
                border: 1px solid #e4e7ec;
                border-radius: 12px;
            }

            .flight-result-summary {
                font-size: 13px;
                font-weight: 800;
                color: #475467;
            }

            .flight-sort {
                display: flex;
                gap: 6px;
            }

            .flight-sort button {
                border: 1px solid #d0d5dd;
                background: #fff;
                color: #475467;
                padding: 7px 10px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 800;
            }

            .flight-sort button.active {
                background: #111827;
                color: #fff;
                border-color: #111827;
            }

            .flight-results {
                display: grid;
                gap: 12px;
            }

            .flight-result {
                display: grid;
                grid-template-columns: 180px 1fr 150px;
                gap: 18px;
                align-items: center;
                background: #fff;
                border: 1px solid #e4e7ec;
                border-radius: 16px;
                padding: 18px;
                box-shadow: 0 5px 18px rgba(16, 24, 40, .04);
            }

            .flight-airline {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .airline-badge {
                width: 42px;
                height: 42px;
                display: grid;
                place-items: center;
                border-radius: 11px;
                background: #f2f4f7;
                font-size: 12px;
                font-weight: 900;
                color: #111827;
            }

            .flight-airline-name {
                font-size: 13px;
                font-weight: 900;
                color: #101828;
            }

            .flight-number {
                margin-top: 3px;
                font-size: 11px;
                color: #667085;
            }

            .flight-route-line {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: 12px;
                align-items: center;
            }

            .flight-time {
                font-size: 20px;
                font-weight: 900;
                color: #101828;
            }

            .flight-airport {
                font-size: 12px;
                color: #667085;
                margin-top: 3px;
            }

            .flight-route-middle {
                text-align: center;
                min-width: 120px;
            }

            .flight-duration {
                font-size: 11px;
                color: #667085;
                margin-bottom: 5px;
            }

            .flight-line {
                height: 1px;
                background: #d0d5dd;
                position: relative;
            }

            .flight-line::after {
                content: "✈";
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                background: #fff;
                padding: 0 5px;
                font-size: 12px;
                color: #667085;
            }

            .flight-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 12px;
            }

            .flight-meta span {
                padding: 5px 8px;
                border-radius: 7px;
                background: #f2f4f7;
                color: #475467;
                font-size: 10px;
                font-weight: 800;
            }

            .flight-price {
                text-align: right;
            }

            .flight-price-value {
                font-size: 20px;
                font-weight: 950;
                color: #101828;
            }

            .flight-price-note {
                font-size: 10px;
                color: #667085;
                margin: 3px 0 10px;
            }

            .select-flight {
                width: 100%;
                border: 0;
                border-radius: 9px;
                background: #111827;
                color: #fff;
                padding: 10px 12px;
                cursor: pointer;
                font-weight: 900;
            }

            .select-flight:hover {
                opacity: .9;
            }

            .flight-empty {
                text-align: center;
                padding: 40px 20px;
                background: #fff;
                border: 1px dashed #d0d5dd;
                border-radius: 16px;
                color: #667085;
                font-size: 14px;
            }

            .flight-error {
                margin-top: 12px;
                padding: 11px 13px;
                border-radius: 10px;
                background: #fff1f2;
                border: 1px solid #fecdd3;
                color: #be123c;
                font-size: 13px;
                font-weight: 700;
            }

            .flight-note {
                margin-top: 12px;
                color: #667085;
                font-size: 11px;
            }

            .flight-enhance-bar {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 14px;
                padding-top: 14px;
                border-top: 1px solid #eef2f7;
            }

            .flight-quick-title {
                font-size: 11px;
                font-weight: 900;
                color: #667085;
                white-space: nowrap;
            }

            .flight-quick-routes {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                flex: 1;
            }

            .flight-quick-route,
            .flight-clear-btn {
                border: 1px solid #d0d5dd;
                background: #fff;
                color: #344054;
                border-radius: 999px;
                padding: 6px 10px;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
            }

            .flight-quick-route:hover {
                border-color: #6366f1;
                color: #3730a3;
                background: #f8faff;
            }

            .flight-clear-btn:hover {
                background: #fff1f2;
                color: #be123c;
                border-color: #fecdd3;
            }

            .flight-passenger-wrap {
                display: flex;
                width: 100%;
            }

            .flight-passenger-wrap input {
                border-radius: 0 !important;
                text-align: center;
            }

            .flight-passenger-btn {
                width: 36px;
                min-width: 36px;
                height: 46px;
                border: 1px solid #d0d5dd;
                background: #f9fafb;
                cursor: pointer;
                font-size: 17px;
                font-weight: 900;
            }

            .flight-passenger-btn.minus {
                border-radius: 10px 0 0 10px;
                border-right: 0;
            }

            .flight-passenger-btn.plus {
                border-radius: 0 10px 10px 0;
                border-left: 0;
            }

            .flight-passenger-btn:hover {
                background: #eef2ff;
            }

            @media (max-width: 1100px) {
                .flight-fields {
                    grid-template-columns: 1fr 42px 1fr 1fr;
                }

                .flight-result {
                    grid-template-columns: 160px 1fr;
                }

                .flight-price {
                    grid-column: 2;
                    text-align: left;
                }
            }

            @media (max-width: 700px) {
                .flight-page-head {
                    align-items: flex-start;
                    flex-direction: column;
                }

                .flight-fields {
                    grid-template-columns: 1fr;
                }

                .flight-swap {
                    transform: rotate(90deg);
                    margin: -4px auto;
                }

                .flight-swap:hover {
                    transform: rotate(270deg);
                }

                .flight-result {
                    grid-template-columns: 1fr;
                    gap: 14px;
                }

                .flight-price {
                    grid-column: auto;
                    text-align: left;
                }

                .flight-route-line {
                    grid-template-columns: 1fr;
                    text-align: center;
                }

                .flight-route-middle {
                    margin: 4px auto;
                }

                .flight-toolbar {
                    align-items: flex-start;
                    flex-direction: column;
                }

                .flight-sort {
                    width: 100%;
                    overflow-x: auto;
                }

                .flight-enhance-bar {
                    align-items: flex-start;
                    flex-direction: column;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =========================================================
       UI
    ========================================================= */

    function injectUI() {
        if (!document.querySelector(".sidebar") &&
            !document.querySelector(".sidebar-menu")) {
            return;
        }

        if (!document.getElementById("flightSearchMenu")) {
            const menuContainer =
                document.querySelector(".sidebar-menu") ||
                document.querySelector(".sidebar");

            if (menuContainer) {
                const button = document.createElement("button");

                button.type = "button";
                button.id = "flightSearchMenu";
                button.className = "menu-item";
                button.innerHTML = `
                    <span>✈️</span>
                    <span>Flight Search</span>
                `;

                menuContainer.appendChild(button);

                button.addEventListener("click", () => {
                    showFlightSearch();
                });
            }
        }

        if (document.getElementById("flightSearchView")) {
            return;
        }

        const main =
            document.querySelector(".main-content") ||
            document.querySelector("main");

        if (!main) return;

        const view = document.createElement("section");

        view.id = "flightSearchView";

        view.innerHTML = `
            <div class="flight-page-head">
                <div>
                    <h1>Flight Search</h1>
                    <p style="margin:5px 0 0;color:#667085;font-size:13px;">
                        Search available flights and add them directly to a new booking.
                    </p>
                </div>

                <div class="flight-mode" id="flightModeBadge">
                    Checking system...
                </div>
            </div>

            <div class="flight-search-card">

                <div class="flight-trip-tabs">
                    <button
                        type="button"
                        class="flight-trip-tab active"
                        id="flightOneWayTab">
                        One Way
                    </button>

                    <button
                        type="button"
                        class="flight-trip-tab"
                        id="flightRoundTripTab">
                        Round Trip
                    </button>
                </div>

                <div class="flight-fields">

                    <div class="flight-field">
                        <label for="flightFrom">From</label>
                        <input
                            id="flightFrom"
                            type="text"
                            maxlength="3"
                            placeholder="LHE"
                            autocomplete="off"
                            list="flightAirportList">
                    </div>

                    <button
                        type="button"
                        class="flight-swap"
                        id="flightSwap"
                        title="Swap airports">
                        ⇄
                    </button>

                    <div class="flight-field">
                        <label for="flightTo">To</label>
                        <input
                            id="flightTo"
                            type="text"
                            maxlength="3"
                            placeholder="DXB"
                            autocomplete="off"
                            list="flightAirportList">
                    </div>

                    <div class="flight-field">
                        <label for="flightDeparture">Departure</label>
                        <input
                            id="flightDeparture"
                            type="date"
                            min="${todayISO()}"
                            value="${addDaysISO(7)}">
                    </div>

                    <div
                        class="flight-field"
                        id="flightReturnField"
                        style="display:none;">
                        <label for="flightReturn">Return</label>
                        <input
                            id="flightReturn"
                            type="date"
                            min="${addDaysISO(8)}"
                            value="${addDaysISO(14)}">
                    </div>

                    <div class="flight-field">
                        <label for="flightAdults">Passengers</label>

                        <div class="flight-passenger-wrap">
                            <button
                                type="button"
                                class="flight-passenger-btn minus"
                                id="flightAdultsMinus">
                                −
                            </button>

                            <input
                                id="flightAdults"
                                type="number"
                                min="1"
                                max="9"
                                value="1">

                            <button
                                type="button"
                                class="flight-passenger-btn plus"
                                id="flightAdultsPlus">
                                +
                            </button>
                        </div>
                    </div>

                    <div class="flight-field">
                        <label for="flightCabin">Cabin</label>
                        <select id="flightCabin">
                            <option value="ECONOMY">Economy</option>
                            <option value="PREMIUM_ECONOMY">
                                Premium Economy
                            </option>
                            <option value="BUSINESS">Business</option>
                            <option value="FIRST">First</option>
                        </select>
                    </div>

                    <div class="flight-field">
                        <label for="flightAirline">Airline</label>
                        <input
                            id="flightAirline"
                            type="text"
                            maxlength="2"
                            placeholder="Optional">
                    </div>

                    <div class="flight-field">
                        <label for="flightMax">Max Results</label>
                        <select id="flightMax">
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                        </select>
                    </div>

                </div>

                <datalist id="flightAirportList">
                    <option value="LHE">Lahore</option>
                    <option value="ISB">Islamabad</option>
                    <option value="KHI">Karachi</option>
                    <option value="PEW">Peshawar</option>
                    <option value="MUX">Multan</option>
                    <option value="DXB">Dubai</option>
                    <option value="AUH">Abu Dhabi</option>
                    <option value="DOH">Doha</option>
                    <option value="JED">Jeddah</option>
                    <option value="RUH">Riyadh</option>
                    <option value="MED">Madinah</option>
                    <option value="IST">Istanbul</option>
                    <option value="LHR">London</option>
                    <option value="JFK">New York</option>
                    <option value="BKK">Bangkok</option>
                    <option value="KUL">Kuala Lumpur</option>
                </datalist>

                <div class="flight-actions">
                    <button
                        type="button"
                        class="flight-search-btn"
                        id="flightSearchButton">
                        🔎 Search Flights
                    </button>
                </div>

                <div id="flightSearchError"></div>

                <div class="flight-note">
                    Tip: Use 3-letter IATA airport codes, for example
                    LHE → DXB.
                </div>

                <div class="flight-enhance-bar" id="flightQuickRoutes">
                    <div class="flight-quick-title">
                        Popular routes
                    </div>

                    <div class="flight-quick-routes">
                        <button
                            type="button"
                            class="flight-quick-route"
                            data-route="LHE-DXB">
                            LHE → DXB
                        </button>

                        <button
                            type="button"
                            class="flight-quick-route"
                            data-route="LHE-JED">
                            LHE → JED
                        </button>

                        <button
                            type="button"
                            class="flight-quick-route"
                            data-route="LHE-DOH">
                            LHE → DOH
                        </button>

                        <button
                            type="button"
                            class="flight-quick-route"
                            data-route="ISB-DXB">
                            ISB → DXB
                        </button>

                        <button
                            type="button"
                            class="flight-quick-route"
                            data-route="KHI-DXB">
                            KHI → DXB
                        </button>
                    </div>

                    <button
                        type="button"
                        class="flight-clear-btn"
                        id="flightClearSearch">
                        Clear
                    </button>
                </div>
            </div>

            <div
                class="flight-toolbar"
                id="flightToolbar">

                <div
                    class="flight-result-summary"
                    id="flightResultSummary">
                    0 flights
                </div>

                <div class="flight-sort">
                    <button
                        type="button"
                        data-sort="cheapest"
                        class="active">
                        Cheapest
                    </button>

                    <button
                        type="button"
                        data-sort="fastest">
                        Fastest
                    </button>

                    <button
                        type="button"
                        data-sort="departure">
                        Departure
                    </button>
                </div>
            </div>

            <div
                class="flight-results"
                id="flightResults">

                <div class="flight-empty">
                    Enter your route and dates, then search for available flights.
                </div>

            </div>
        `;

        main.appendChild(view);

        bindUIEvents();
    }

    /* =========================================================
       UI EVENTS
    ========================================================= */

    function bindUIEvents() {
        const oneWayTab =
            document.getElementById("flightOneWayTab");

        const roundTripTab =
            document.getElementById("flightRoundTripTab");

        const returnField =
            document.getElementById("flightReturnField");

        const departure =
            document.getElementById("flightDeparture");

        const returnInput =
            document.getElementById("flightReturn");

        if (oneWayTab) {
            oneWayTab.addEventListener("click", () => {
                state.tripType = "oneway";

                oneWayTab.classList.add("active");

                if (roundTripTab) {
                    roundTripTab.classList.remove("active");
                }

                if (returnField) {
                    returnField.style.display = "none";
                }
            });
        }

        if (roundTripTab) {
            roundTripTab.addEventListener("click", () => {
                state.tripType = "roundtrip";

                roundTripTab.classList.add("active");

                if (oneWayTab) {
                    oneWayTab.classList.remove("active");
                }

                if (returnField) {
                    returnField.style.display = "";
                }

                if (departure && returnInput) {
                    returnInput.min =
                        departure.value
                            ? addOneDay(departure.value)
                            : addDaysISO(8);
                }
            });
        }

        if (departure && returnInput) {
            departure.addEventListener("change", () => {
                if (!departure.value) return;

                const minimumReturn =
                    addOneDay(departure.value);

                returnInput.min = minimumReturn;

                if (
                    returnInput.value &&
                    returnInput.value <= departure.value
                ) {
                    returnInput.value = minimumReturn;
                }
            });
        }

        const swap = document.getElementById("flightSwap");

        if (swap) {
            swap.addEventListener("click", () => {
                const from =
                    document.getElementById("flightFrom");

                const to =
                    document.getElementById("flightTo");

                if (!from || !to) return;

                const oldFrom = from.value;
                from.value = to.value;
                to.value = oldFrom;

                showToast(
                    `${from.value || "Origin"} → ${to.value || "Destination"}`,
                    "success"
                );
            });
        }

        const adults =
            document.getElementById("flightAdults");

        const adultsMinus =
            document.getElementById("flightAdultsMinus");

        const adultsPlus =
            document.getElementById("flightAdultsPlus");

        function setAdults(value) {
            if (!adults) return;

            const next =
                Math.max(
                    1,
                    Math.min(9, Number(value) || 1)
                );

            adults.value = String(next);
        }

        if (adultsMinus) {
            adultsMinus.addEventListener("click", () => {
                setAdults(Number(adults.value) - 1);
            });
        }

        if (adultsPlus) {
            adultsPlus.addEventListener("click", () => {
                setAdults(Number(adults.value) + 1);
            });
        }

        [document.getElementById("flightFrom"),
         document.getElementById("flightTo"),
         document.getElementById("flightAirline")]
            .forEach(input => {
                if (!input) return;

                input.addEventListener("input", () => {
                    input.value =
                        input.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "");
                });
            });

        const searchButton =
            document.getElementById("flightSearchButton");

        if (searchButton) {
            searchButton.addEventListener(
                "click",
                searchFlights
            );
        }

        const clearButton =
            document.getElementById("flightClearSearch");

        if (clearButton) {
            clearButton.addEventListener("click", clearSearch);
        }

        document
            .querySelectorAll("#flightSearchView .flight-quick-route")
            .forEach(button => {
                button.addEventListener("click", () => {
                    const route =
                        String(button.dataset.route || "");

                    const parts = route.split("-");

                    if (parts.length !== 2) return;

                    const from =
                        document.getElementById("flightFrom");

                    const to =
                        document.getElementById("flightTo");

                    const departure =
                        document.getElementById(
                            "flightDeparture"
                        );

                    if (from) from.value = parts[0];
                    if (to) to.value = parts[1];

                    if (departure && !departure.value) {
                        departure.value = addDaysISO(7);
                    }

                    showToast(
                        `${parts[0]} → ${parts[1]} selected`,
                        "success"
                    );
                });
            });

        document
            .querySelectorAll("#flightSearchView .flight-sort button")
            .forEach(button => {
                button.addEventListener("click", () => {
                    state.sort =
                        button.dataset.sort || "cheapest";

                    document
                        .querySelectorAll(
                            "#flightSearchView .flight-sort button"
                        )
                        .forEach(btn => {
                            btn.classList.toggle(
                                "active",
                                btn === button
                            );
                        });

                    applySortAndRender();
                });
            });

        document
            .getElementById("flightSearchView")
            ?.addEventListener("keydown", event => {
                if (event.key !== "Enter") return;

                const target = event.target;

                if (
                    target &&
                    (
                        target.tagName === "INPUT" ||
                        target.tagName === "SELECT"
                    )
                ) {
                    event.preventDefault();

                    if (searchButton && !searchButton.disabled) {
                        searchButton.click();
                    }
                }
            });
    }

    function addOneDay(dateString) {
        const d = new Date(`${dateString}T12:00:00`);

        if (Number.isNaN(d.getTime())) {
            return addDaysISO(1);
        }

        d.setDate(d.getDate() + 1);

        const year = d.getFullYear();
        const month = String(
            d.getMonth() + 1
        ).padStart(2, "0");
        const day = String(
            d.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    /* =========================================================
       CLEAR SEARCH
    ========================================================= */

    function clearSearch() {
        const from =
            document.getElementById("flightFrom");

        const to =
            document.getElementById("flightTo");

        const departure =
            document.getElementById("flightDeparture");

        const returnInput =
            document.getElementById("flightReturn");

        const adults =
            document.getElementById("flightAdults");

        const cabin =
            document.getElementById("flightCabin");

        const airline =
            document.getElementById("flightAirline");

        const toolbar =
            document.getElementById("flightToolbar");

        const results =
            document.getElementById("flightResults");

        if (from) from.value = "";
        if (to) to.value = "";

        if (departure) {
            departure.value = addDaysISO(7);
        }

        if (returnInput) {
            returnInput.value = addDaysISO(14);
        }

        if (adults) {
            adults.value = "1";
        }

        if (cabin) {
            cabin.value = "ECONOMY";
        }

        if (airline) {
            airline.value = "";
        }

        state.results = [];
        state.filteredResults = [];
        state.lastSearch = null;
        state.sort = "cheapest";

        clearError();

        if (toolbar) {
            toolbar.style.display = "none";
        }

        if (results) {
            results.innerHTML = `
                <div class="flight-empty">
                    Enter your route and dates, then search for available flights.
                </div>
            `;
        }
    }

    /* =========================================================
       VALIDATION
    ========================================================= */

    function validateSearch() {
        const from =
            String(
                document.getElementById("flightFrom")?.value || ""
            )
                .trim()
                .toUpperCase();

        const to =
            String(
                document.getElementById("flightTo")?.value || ""
            )
                .trim()
                .toUpperCase();

        const departure =
            document.getElementById("flightDeparture")?.value || "";

        const returnDate =
            document.getElementById("flightReturn")?.value || "";

        const adults =
            Number(
                document.getElementById("flightAdults")?.value || 1
            );

        const airline =
            String(
                document.getElementById("flightAirline")?.value || ""
            )
                .trim()
                .toUpperCase();

        if (!/^[A-Z]{3}$/.test(from)) {
            return {
                valid: false,
                message: "Please enter a valid 3-letter From airport code."
            };
        }

        if (!/^[A-Z]{3}$/.test(to)) {
            return {
                valid: false,
                message: "Please enter a valid 3-letter To airport code."
            };
        }

        if (from === to) {
            return {
                valid: false,
                message: "From and To airports cannot be the same."
            };
        }

        if (!departure) {
            return {
                valid: false,
                message: "Please select a departure date."
            };
        }

        if (departure < todayISO()) {
            return {
                valid: false,
                message: "Departure date cannot be in the past."
            };
        }

        if (state.tripType === "roundtrip") {
            if (!returnDate) {
                return {
                    valid: false,
                    message: "Please select a return date."
                };
            }

            if (returnDate <= departure) {
                return {
                    valid: false,
                    message: "Return date must be after departure date."
                };
            }
        }

        if (
            !Number.isInteger(adults) ||
            adults < 1 ||
            adults > 9
        ) {
            return {
                valid: false,
                message: "Passengers must be between 1 and 9."
            };
        }

        if (airline && !/^[A-Z0-9]{2}$/.test(airline)) {
            return {
                valid: false,
                message: "Airline code must be 2 characters, for example EK."
            };
        }

        return {
            valid: true,
            data: {
                origin: from,
                destination: to,
                departureDate: departure,
                returnDate:
                    state.tripType === "roundtrip"
                        ? returnDate
                        : "",
                adults,
                cabin:
                    document.getElementById("flightCabin")?.value ||
                    "ECONOMY",
                airline,
                max:
                    document.getElementById("flightMax")?.value ||
                    "10"
            }
        };
    }

    /* =========================================================
       SEARCH
    ========================================================= */

    async function searchFlights() {
        clearError();

        const validation = validateSearch();

        if (!validation.valid) {
            showError(validation.message);
            return;
        }

        const params = validation.data;

        const button =
            document.getElementById("flightSearchButton");

        const toolbar =
            document.getElementById("flightToolbar");

        const results =
            document.getElementById("flightResults");

        const summary =
            document.getElementById("flightResultSummary");

        if (button) {
            button.disabled = true;
            button.dataset.originalText =
                button.textContent;

            button.textContent = "Searching...";
        }

        if (toolbar) {
            toolbar.style.display = "none";
        }

        if (results) {
            results.innerHTML = `
                <div class="flight-empty">
                    ✈️ Searching available flights...
                </div>
            `;
        }

        state.lastSearch = params;

        try {
            const query = new URLSearchParams();

            query.set("origin", params.origin);
            query.set("destination", params.destination);
            query.set("departureDate", params.departureDate);
            query.set("adults", String(params.adults));
            query.set("cabin", params.cabin);
            query.set("max", String(params.max));

            if (params.returnDate) {
                query.set(
                    "returnDate",
                    params.returnDate
                );
            }

            if (params.airline) {
                query.set(
                    "airline",
                    params.airline
                );
            }

            const response = await fetch(
                `/api/flights/search?${query.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json"
                    }
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Flight search failed (${response.status})`
                );
            }

            const payload = await response.json();

            const flights =
                Array.isArray(payload)
                    ? payload
                    : (
                        payload.flights ||
                        payload.results ||
                        payload.data ||
                        []
                    );

            state.results = flights;
            state.filteredResults = flights.slice();

            if (
                payload &&
                payload.mode
            ) {
                state.mode = payload.mode;
            }

            updateModeBadge();
            applySortAndRender();

            if (!flights.length) {
                showToast(
                    "No flights found for this search.",
                    "info"
                );
            }

        } catch (error) {
            console.error(
                "Flight search error:",
                error
            );

            if (results) {
                results.innerHTML = `
                    <div class="flight-empty">
                        Unable to load flights right now.
                    </div>
                `;
            }

            showError(
                error?.message ||
                "Unable to search flights. Please try again."
            );

        } finally {
            if (button) {
                button.disabled = false;

                button.textContent =
                    button.dataset.originalText ||
                    "🔎 Search Flights";
            }
        }
    }

    /* =========================================================
       MODE
    ========================================================= */

    async function loadFlightMode() {
        try {

    // ==========================================
    // AIRFLOW DEMO FLIGHT AVAILABILITY
    // No backend required
    // ==========================================

    const demoFlights = [
        {
            id: "demo-ek-001",
            airline: "EK",
            airlineName: "Emirates",
            flightNumber: "EK-603",
            origin: from,
            destination: to,
            departureLocal: "09:30",
            arrivalLocal: "11:45",
            duration: "3h 15m",
            durationMinutes: 195,
            stops: 0,
            seatsAvailable: 8,
            cabin: cabin,
            cabinLabel: cabin.replace("_", " "),
            aircraft: "Boeing 777",
            price: 285,
            currency: "USD"
        },

        {
            id: "demo-qr-002",
            airline: "QR",
            airlineName: "Qatar Airways",
            flightNumber: "QR-629",
            origin: from,
            destination: to,
            departureLocal: "16:20",
            arrivalLocal: "18:50",
            duration: "3h 30m",
            durationMinutes: 210,
            stops: 0,
            seatsAvailable: 12,
            cabin: cabin,
            cabinLabel: cabin.replace("_", " "),
            aircraft: "Airbus A350",
            price: 310,
            currency: "USD"
        },

        {
            id: "demo-tk-003",
            airline: "TK",
            airlineName: "Turkish Airlines",
            flightNumber: "TK-715",
            origin: from,
            destination: to,
            departureLocal: "21:10",
            arrivalLocal: "23:40",
            duration: "3h 30m",
            durationMinutes: 210,
            stops: 0,
            seatsAvailable: 6,
            cabin: cabin,
            cabinLabel: cabin.replace("_", " "),
            aircraft: "Airbus A330",
            price: 335,
            currency: "USD"
        },

        {
            id: "demo-ey-004",
            airline: "EY",
            airlineName: "Etihad Airways",
            flightNumber: "EY-242",
            origin: from,
            destination: to,
            departureLocal: "07:15",
            arrivalLocal: "09:40",
            duration: "3h 25m",
            durationMinutes: 205,
            stops: 0,
            seatsAvailable: 9,
            cabin: cabin,
            cabinLabel: cabin.replace("_", " "),
            aircraft: "Boeing 787",
            price: 325,
            currency: "USD"
        },

        {
            id: "demo-pk-005",
            airline: "PK",
            airlineName: "Pakistan International Airlines",
            flightNumber: "PK-211",
            origin: from,
            destination: to,
            departureLocal: "13:45",
            arrivalLocal: "16:05",
            duration: "3h 20m",
            durationMinutes: 200,
            stops: 0,
            seatsAvailable: 14,
            cabin: cabin,
            cabinLabel: cabin.replace("_", " "),
            aircraft: "Airbus A320",
            price: 245,
            currency: "USD"
        },

        {
            id: "demo-sv-006",
            airline: "SV",
            airlineName: "Saudia",
            flightNumber: "SV-725",
            origin: from,
            destination: to,
            departureLocal: "18:30",
            arrivalLocal: "21:00",
            duration: "3h 30m",
            durationMinutes: 210,
            stops: 0,
            seatsAvailable: 10,
            cabin: cabin,
            cabinLabel: cabin.replace("_", " "),
            aircraft: "Airbus A320",
            price: 270,
            currency: "USD"
        },

        {
            id: "demo-gf-007",
            airline: "GF",
            airlineName: "Gulf Air",
            flightNumber: "GF-771",
            origin: from,
            destination: to,
            departureLocal: "11:20",
            arrivalLocal: "13:50",
            duration: "3h 30m",
            durationMinutes: 210,
            stops: 0,
            seatsAvailable: 7,
            cabin: cabin,
            cabinLabel: cabin.replace("_", " "),
            aircraft: "Airbus A321",
            price: 255,
            currency: "USD"
        },

        {
            id: "demo-fz-008",
            airline: "FZ",
            airlineName: "flydubai",
            flightNumber: "FZ-334",
            origin: from,
            destination: to,
            departureLocal: "20:40",
            arrivalLocal: "23:05",
            duration: "3h 25m",
            durationMinutes: 205,
            stops: 0,
            seatsAvailable: 11,
            cabin: cabin,
            cabinLabel: cabin.replace("_", " "),
            aircraft: "Boeing 737 MAX",
            price: 235,
            currency: "USD"
        }
    ];

    // Airline filter
    let filteredFlights = demoFlights;

    if (airline) {
        filteredFlights =
            filteredFlights.filter(
                function (flight) {
                    return flight.airline === airline;
                }
            );
    }

    // Maximum results
    filteredFlights =
        filteredFlights.slice(
            0,
            max
        );

    state.results =
        filteredFlights;

    state.mode =
        "demo";

    state.lastSearch = {
        from: from,
        to: to,
        departure: departure,
        returnDate: returnDate,
        adults: adults,
        cabin: cabin
    };

    const badge =
        document.getElementById(
            "flightModeBadge"
        );

    if (badge) {
        badge.textContent =
            "DEMO AVAILABILITY";
    }

    renderResults();

} catch (err) { catch (error) {
            console.warn(
                "Could not load flight mode:",
                error
            );

            state.mode = "demo";
        }

        updateModeBadge();
    }

    function updateModeBadge() {
        const badge =
            document.getElementById("flightModeBadge");

        if (!badge) return;

        const mode =
            String(state.mode || "demo")
                .toLowerCase();

        if (
            mode === "live" ||
            mode === "production"
        ) {
            badge.textContent = "Live Flight Search";
            return;
        }

        badge.textContent = "Demo Flight Search";
    }

    /* =========================================================
       SORT
    ========================================================= */

    function applySortAndRender() {
        let flights =
            Array.isArray(state.results)
                ? state.results.slice()
                : [];

        if (state.sort === "fastest") {
            flights.sort((a, b) => {
                const aMinutes =
                    Number(a.durationMinutes) ||
                    durationToMinutes(a.duration);

                const bMinutes =
                    Number(b.durationMinutes) ||
                    durationToMinutes(b.duration);

                return aMinutes - bMinutes;
            });
        } else if (state.sort === "departure") {
            flights.sort((a, b) => {
                const aTime =
                    new Date(
                        a.departureTime ||
                        a.departureLocal ||
                        0
                    ).getTime();

                const bTime =
                    new Date(
                        b.departureTime ||
                        b.departureLocal ||
                        0
                    ).getTime();

                return (
                    (Number.isFinite(aTime) ? aTime : 0) -
                    (Number.isFinite(bTime) ? bTime : 0)
                );
            });
        } else {
            flights.sort((a, b) => {
                return getPrice(a) - getPrice(b);
            });
        }

        state.filteredResults = flights;

        renderResults(flights);
    }

    /* =========================================================
       RESULTS
    ========================================================= */

    function renderResults(flights) {
        const container =
            document.getElementById("flightResults");

        const toolbar =
            document.getElementById("flightToolbar");

        const summary =
            document.getElementById("flightResultSummary");

        if (!container) return;

        if (toolbar) {
            toolbar.style.display =
                flights.length ? "flex" : "none";
        }

        if (summary) {
            summary.textContent =
                `${flights.length} flight${flights.length === 1 ? "" : "s"} found`;
        }

        if (!flights.length) {
            container.innerHTML = `
                <div class="flight-empty">
                    No flights found. Try another date, route or airline.
                </div>
            `;

            return;
        }

        container.innerHTML =
            flights
                .map((flight, index) =>
                    renderFlightCard(
                        flight,
                        index
                    )
                )
                .join("");

        container
            .querySelectorAll(".select-flight")
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        const index =
                            Number(
                                button.dataset.flightIndex
                            );

                        const flight =
                            state.filteredResults[index];

                        if (flight) {
                            selectFlight(flight);
                        }
                    }
                );
            });
    }

    function renderFlightCard(flight, index) {
        const airlineCode =
            String(
                flight.airline ||
                flight.airlineCode ||
                ""
            ).toUpperCase();

        const airlineName =
            flight.airlineName ||
            getAirlineName(
                airlineCode
            );

        const flightNumber =
            flight.flightNumber ||
            flight.number ||
            `${airlineCode || ""} —`;

        const origin =
            flight.origin ||
            flight.originCode ||
            state.lastSearch?.origin ||
            "";

        const destination =
            flight.destination ||
            flight.destinationCode ||
            state.lastSearch?.destination ||
            "";

        const departureTime =
            normalizeTime(
                flight.departureLocal ||
                flight.departureTime
            );

        const arrivalTime =
            normalizeTime(
                flight.arrivalLocal ||
                flight.arrivalTime
            );

        const duration =
            getDurationText(flight);

        const price =
            getPrice(flight);

        const currency =
            getCurrency(flight);

        const seats =
            getSeats(flight);

        const stops =
            Number(flight.stops || 0);

        const cabin =
            flight.cabinLabel ||
            flight.cabin ||
            "Economy";

        const aircraft =
            flight.aircraft ||
            "";

        const stopsText =
            getStopsText(stops);

        const seatText =
            seats > 0
                ? `${seats} seats left`
                : "Availability on request";

        return `
            <article class="flight-result">

                <div class="flight-airline">
                    <div class="airline-badge">
                        ${esc(airlineCode || "✈")}
                    </div>

                    <div>
                        <div class="flight-airline-name">
                            ${esc(airlineName)}
                        </div>

                        <div class="flight-number">
                            ${esc(flightNumber)}
                        </div>
                    </div>
                </div>

                <div>

                    <div class="flight-route-line">

                        <div>
                            <div class="flight-time">
                                ${esc(departureTime || "—")}
                            </div>

                            <div class="flight-airport">
                                ${esc(origin)}
                            </div>
                        </div>

                        <div class="flight-route-middle">
                            <div class="flight-duration">
                                ${esc(duration)}
                            </div>

                            <div class="flight-line"></div>

                            <div
                                style="
                                    margin-top:5px;
                                    font-size:10px;
                                    color:#667085;
                                ">
                                ${esc(stopsText)}
                            </div>
                        </div>

                        <div style="text-align:right;">
                            <div class="flight-time">
                                ${esc(arrivalTime || "—")}
                            </div>

                            <div class="flight-airport">
                                ${esc(destination)}
                            </div>
                        </div>

                    </div>

                    <div class="flight-meta">
                        <span>${esc(cabin)}</span>
                        <span>${esc(seatText)}</span>
                        ${
                            aircraft
                                ? `<span>${esc(aircraft)}</span>`
                                : ""
                        }
                    </div>

                </div>

                <div class="flight-price">

                    <div class="flight-price-value">
                        ${esc(
                            formatMoney(
                                price,
                                currency
                            )
                        )}
                    </div>

                    <div class="flight-price-note">
                        per passenger
                    </div>

                    <button
                        type="button"
                        class="select-flight"
                        data-flight-index="${index}">
                        Select Flight
                    </button>

                </div>

            </article>
        `;
    }

    /* =========================================================
       SELECT FLIGHT
    ========================================================= */

    function selectFlight(flight) {
        if (!flight) return;

        if (
            typeof window.showBookingForm ===
            "function"
        ) {
            window.showBookingForm();
        }

        const airlineCode =
            String(
                flight.airline ||
                flight.airlineCode ||
                ""
            ).toUpperCase();

        const airlineName =
            flight.airlineName ||
            getAirlineName(
                airlineCode
            );

        const flightNumber =
            flight.flightNumber ||
            flight.number ||
            "";

        const travelDate =
            flight.travelDate ||
            flight.departureDate ||
            state.lastSearch?.departureDate ||
            "";

        const fromAirport =
            flight.origin ||
            flight.originCode ||
            state.lastSearch?.origin ||
            "";

        const toAirport =
            flight.destination ||
            flight.destinationCode ||
            state.lastSearch?.destination ||
            "";

        const cabin =
            mapCabinToBooking(
                flight.cabin ||
                flight.cabinLabel ||
                state.lastSearch?.cabin
            );

        const passengerCount =
            Number(
                state.lastSearch?.adults ||
                1
            );

        const costPrice =
            Number(
                flight.costPrice ??
                flight.cost ??
                getPrice(flight)
            );

        const sellingPrice =
            Number(
                flight.sellingPrice ??
                getPrice(flight)
            );

        setBookingField(
            "airlineName",
            airlineName
        );

        setBookingField(
            "flightNumber",
            flightNumber
        );

        setBookingField(
            "travelDate",
            travelDate
        );

        setBookingField(
            "fromAirport",
            fromAirport
        );

        setBookingField(
            "toAirport",
            toAirport
        );

        setBookingField(
            "cabinClass",
            cabin
        );

        setBookingField(
            "passengerCount",
            passengerCount
        );

        setBookingField(
            "costPrice",
            costPrice
        );

        setBookingField(
            "sellingPrice",
            sellingPrice
        );

        setBookingField(
            "amountPaid",
            0
        );

        setBookingField(
            "previewFrom",
            fromAirport
        );

        setBookingField(
            "previewTo",
            toAirport
        );

        showToast(
            `Flight ${flightNumber || ""} added to New Booking`,
            "success"
        );
    }

    function setBookingField(id, value) {
        const field =
            document.getElementById(id);

        if (!field) return;

        field.value =
            value == null
                ? ""
                : String(value);

        field.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles: true
                }
            )
        );

        field.dispatchEvent(
            new Event(
                "change",
                {
                    bubbles: true
                }
            )
        );
    }

    function mapCabinToBooking(value) {
        const cabin =
            String(
                value || ""
            )
                .toUpperCase()
                .replace(/\s+/g, "_");

        const map = {
            ECONOMY: "Economy",
            PREMIUM_ECONOMY: "Premium Economy",
            BUSINESS: "Business",
            FIRST: "First"
        };

        return (
            map[cabin] ||
            "Economy"
        );
    }

    /* =========================================================
       SHOW FLIGHT SEARCH
    ========================================================= */

    function showFlightSearch() {
        if (
            typeof window.hideAllViews ===
            "function"
        ) {
            window.hideAllViews();
        }

        const view =
            document.getElementById(
                "flightSearchView"
            );

        if (!view) return;

        view.classList.add("active");
        view.style.display = "block";

        const menu =
            document.getElementById(
                "flightSearchMenu"
            );

        if (menu) {
            document
                .querySelectorAll(".menu-item")
                .forEach(item => {
                    item.classList.remove("active");
                });

            menu.classList.add("active");
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    /* =========================================================
       STARTUP
    ========================================================= */

    function boot() {
        injectStyles();
        injectUI();
        loadFlightMode();
    }

    window.showFlightSearch =
        showFlightSearch;

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            boot
        );
    } else {
        boot();
    }

})();
