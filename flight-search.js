/* =========================================================
   AIRFLOW FLIGHT SEARCH & AVAILABILITY
   Demo mode works without API credentials.
   Live mode uses the Airflow server as a secure Amadeus proxy.
========================================================= */

(function () {
    "use strict";

    const state = {
        results: [],
        sort: "cheapest",
        mode: "demo",
        lastSearch: null
    };

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
        const local = new Date(
            d.getTime() - d.getTimezoneOffset() * 60000
        );

        return local.toISOString().slice(0, 10);
    }

    function addDaysISO(days) {
        const d = new Date(
            todayISO() + "T00:00:00"
        );

        d.setDate(d.getDate() + days);

        const local = new Date(
            d.getTime() - d.getTimezoneOffset() * 60000
        );

        return local.toISOString().slice(0, 10);
    }

    /* =========================================================
       STYLES
    ========================================================= */

    function injectStyles() {
        if (
            document.getElementById(
                "airflowFlightSearchStyles"
            )
        ) {
            return;
        }

        const style = document.createElement("style");

        style.id =
            "airflowFlightSearchStyles";

        style.textContent = `
            #flightSearchView {
                display: none;
            }

            .flight-page-head {
                display: flex;
                justify-content: space-between;
                gap: 20px;
                align-items: flex-start;
                margin-bottom: 24px;
            }

            .flight-mode {
                padding: 9px 13px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 800;
                background: #eef2ff;
                color: #3730a3;
                white-space: nowrap;
            }

            .flight-search-card {
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 20px;
                padding: 22px;
                box-shadow:
                    0 8px 30px
                    rgba(15, 23, 42, 0.05);
            }

            .flight-trip-tabs {
                display: flex;
                gap: 8px;
                margin-bottom: 18px;
            }

            .flight-trip-tab {
                border: 1px solid #dbe1ea;
                background: #fff;
                padding: 10px 16px;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 700;
            }

            .flight-trip-tab.active {
                background: #111827;
                color: #fff;
                border-color: #111827;
            }

            .flight-fields {
                display: grid;
                grid-template-columns:
                    1.1fr
                    1.1fr
                    1fr
                    1fr
                    0.75fr
                    0.9fr;
                gap: 12px;
                align-items: end;
            }

            .flight-field label {
                display: block;
                font-size: 12px;
                font-weight: 800;
                color: #667085;
                margin-bottom: 7px;
            }

            .flight-field input,
            .flight-field select {
                width: 100%;
                height: 46px;
                border: 1px solid #d9dee8;
                border-radius: 10px;
                padding: 0 12px;
                font: inherit;
                background: #fff;
                outline: none;
            }

            .flight-field input:focus,
            .flight-field select:focus {
                border-color: #6366f1;
                box-shadow:
                    0 0 0 3px
                    rgba(99, 102, 241, 0.1);
            }

            .flight-swap {
                height: 46px;
                width: 46px;
                border: 1px solid #d9dee8;
                background: #f8fafc;
                border-radius: 10px;
                cursor: pointer;
                font-size: 18px;
            }

            .flight-swap:hover {
                background: #eef2ff;
            }

            .flight-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 16px;
            }

            .flight-search-btn {
                border: 0;
                border-radius: 11px;
                padding: 12px 20px;
                font-weight: 800;
                cursor: pointer;
                background: #111827;
                color: #fff;
            }

            .flight-search-btn:hover {
                background: #1f2937;
            }

            .flight-search-btn:disabled {
                opacity: 0.6;
                cursor: wait;
            }

            .flight-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                margin: 22px 0 14px;
            }

            .flight-sort {
                display: flex;
                gap: 7px;
            }

            .flight-sort button {
                border: 1px solid #dbe1ea;
                background: #fff;
                border-radius: 9px;
                padding: 9px 13px;
                cursor: pointer;
                font-weight: 700;
            }

            .flight-sort button:hover {
                background: #f8fafc;
            }

            .flight-sort button.active {
                background: #eef2ff;
                border-color: #6366f1;
                color: #3730a3;
            }

            .flight-results {
                display: grid;
                gap: 12px;
            }

            .flight-result {
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 17px;
                padding: 18px;
                display: grid;
                grid-template-columns:
                    1.1fr
                    1.7fr
                    1fr
                    0.8fr;
                gap: 18px;
                align-items: center;
                box-shadow:
                    0 6px 24px
                    rgba(15, 23, 42, 0.04);
            }

            .flight-airline {
                display: flex;
                gap: 11px;
                align-items: center;
                min-width: 0;
            }

            .airline-badge {
                width: 42px;
                height: 42px;
                border-radius: 12px;
                display: grid;
                place-items: center;
                background: #f1f5f9;
                font-size: 12px;
                font-weight: 900;
                flex-shrink: 0;
            }

            .flight-airline strong {
                display: block;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .flight-airline small {
                color: #667085;
            }

            .flight-route-line {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .flight-time {
                font-size: 19px;
                font-weight: 900;
            }

            .flight-airport {
                font-size: 12px;
                color: #667085;
                font-weight: 700;
            }

            .flight-line {
                flex: 1;
                height: 1px;
                background: #dbe1ea;
                position: relative;
            }

            .flight-line::after {
                content: "✈";
                position: absolute;
                left: 50%;
                top: -10px;
                transform: translateX(-50%);
                color: #6366f1;
                background: #fff;
                padding: 0 5px;
            }

            .flight-meta {
                text-align: center;
                color: #667085;
                font-size: 12px;
                margin-top: 5px;
            }

            .flight-price {
                text-align: right;
            }

            .flight-price strong {
                display: block;
                font-size: 21px;
            }

            .flight-price small {
                color: #667085;
            }

            .select-flight {
                margin-top: 8px;
                border: 0;
                background: #111827;
                color: #fff;
                border-radius: 9px;
                padding: 10px 14px;
                font-weight: 800;
                cursor: pointer;
            }

            .select-flight:hover {
                background: #1f2937;
            }

            .flight-empty {
                padding: 40px 20px;
                text-align: center;
                background: #fff;
                border: 1px dashed #cbd5e1;
                border-radius: 16px;
                color: #667085;
            }

            .flight-error {
                padding: 14px 16px;
                background: #fff1f2;
                color: #9f1239;
                border: 1px solid #fecdd3;
                border-radius: 12px;
                margin-top: 14px;
            }

            .flight-note {
                margin-top: 10px;
                font-size: 12px;
                color: #667085;
            }

            @media (max-width: 1050px) {
                .flight-fields {
                    grid-template-columns:
                        repeat(3, 1fr);
                }

                .flight-result {
                    grid-template-columns: 1fr;
                }

                .flight-price {
                    text-align: left;
                }
            }

            @media (max-width: 650px) {
                .flight-fields {
                    grid-template-columns: 1fr;
                }

                .flight-page-head,
                .flight-toolbar {
                    flex-direction: column;
                    align-items: stretch;
                }

                .flight-sort {
                    overflow: auto;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =========================================================
       CREATE FLIGHT SEARCH UI
    ========================================================= */

    function injectUI() {
        const sidebar =
            document.querySelector(
                ".sidebar-menu"
            );

        if (
            sidebar &&
            !document.getElementById(
                "flightSearchMenu"
            )
        ) {
            const btn =
                document.createElement("button");

            btn.className = "menu-item";
            btn.id = "flightSearchMenu";
            btn.type = "button";

            btn.innerHTML =
                '<span class="menu-icon">✈</span> Flight Search';

            btn.addEventListener(
                "click",
                showFlightSearch
            );

            sidebar.appendChild(btn);
        }

        const main =
            document.querySelector(
                ".main-content"
            );

        if (
            !main ||
            document.getElementById(
                "flightSearchView"
            )
        ) {
            return;
        }

        const section =
            document.createElement("section");

        section.id =
            "flightSearchView";

        section.innerHTML = `
            <div class="flight-page-head">

                <div>
                    <div class="eyebrow">
                        AirFlow Operations
                    </div>

                    <h1 class="page-title">
                        Flight Search & Availability
                    </h1>

                    <p class="page-description">
                        Search airline schedules and fares,
                        then send the selected flight directly
                        into a new booking.
                    </p>
                </div>

                <div
                    class="flight-mode"
                    id="flightModeBadge"
                >
                    DEMO AVAILABILITY
                </div>

            </div>

            <div class="flight-search-card">

                <div class="flight-trip-tabs">

                    <button
                        class="flight-trip-tab active"
                        id="flightOneWayTab"
                        type="button"
                    >
                        One Way
                    </button>

                    <button
                        class="flight-trip-tab"
                        id="flightRoundTripTab"
                        type="button"
                    >
                        Round Trip
                    </button>

                </div>

                <div class="flight-fields">

                    <div class="flight-field">
                        <label>From (IATA)</label>

                        <input
                            id="flightFrom"
                            maxlength="3"
                            placeholder="LHE"
                            autocomplete="off"
                        >
                    </div>

                    <button
                        class="flight-swap"
                        id="flightSwap"
                        type="button"
                        title="Swap airports"
                    >
                        ⇄
                    </button>

                    <div class="flight-field">
                        <label>To (IATA)</label>

                        <input
                            id="flightTo"
                            maxlength="3"
                            placeholder="DXB"
                            autocomplete="off"
                        >
                    </div>

                    <div class="flight-field">
                        <label>Departure</label>

                        <input
                            id="flightDeparture"
                            type="date"
                        >
                    </div>

                    <div
                        class="flight-field"
                        id="flightReturnField"
                        style="display:none"
                    >
                        <label>Return</label>

                        <input
                            id="flightReturn"
                            type="date"
                        >
                    </div>

                    <div class="flight-field">
                        <label>Passengers</label>

                        <input
                            id="flightAdults"
                            type="number"
                            min="1"
                            max="9"
                            value="1"
                        >
                    </div>

                    <div class="flight-field">
                        <label>Cabin</label>

                        <select id="flightCabin">

                            <option value="ECONOMY">
                                Economy
                            </option>

                            <option value="PREMIUM_ECONOMY">
                                Premium Economy
                            </option>

                            <option value="BUSINESS">
                                Business
                            </option>

                            <option value="FIRST">
                                First
                            </option>

                        </select>
                    </div>

                    <div class="flight-field">
                        <label>Airline (optional)</label>

                        <input
                            id="flightAirline"
                            maxlength="2"
                            placeholder="EK"
                            autocomplete="off"
                        >
                    </div>

                    <div class="flight-field">
                        <label>Max results</label>

                        <select id="flightMax">

                            <option value="10">
                                10
                            </option>

                            <option
                                value="20"
                                selected
                            >
                                20
                            </option>

                            <option value="50">
                                50
                            </option>

                        </select>
                    </div>

                </div>

                <div class="flight-actions">

                    <button
                        class="flight-search-btn"
                        id="flightSearchButton"
                        type="button"
                    >
                        🔎 Search Flights
                    </button>

                </div>

                <div class="flight-note">
                    Live mode keeps Amadeus credentials on
                    the AirFlow server. If credentials are not
                    configured, AirFlow automatically uses
                    clearly-labelled demo availability.
                </div>

            </div>

            <div id="flightSearchError"></div>

            <div
                class="flight-toolbar"
                id="flightToolbar"
                style="display:none"
            >

                <strong id="flightResultSummary">
                    0 flights
                </strong>

                <div class="flight-sort">

                    <button
                        type="button"
                        data-sort="cheapest"
                        class="active"
                    >
                        Cheapest
                    </button>

                    <button
                        type="button"
                        data-sort="fastest"
                    >
                        Fastest
                    </button>

                    <button
                        type="button"
                        data-sort="departure"
                    >
                        Departure
                    </button>

                </div>

            </div>

            <div
                class="flight-results"
                id="flightResults"
            >

                <div class="flight-empty">
                    Enter your route and dates, then search
                    for available flights.
                </div>

            </div>
        `;

        main.appendChild(section);

        document
            .getElementById(
                "flightOneWayTab"
            )
            .addEventListener(
                "click",
                function () {
                    setTripType("oneway");
                }
            );

        document
            .getElementById(
                "flightRoundTripTab"
            )
            .addEventListener(
                "click",
                function () {
                    setTripType("roundtrip");
                }
            );

        document
            .getElementById(
                "flightSwap"
            )
            .addEventListener(
                "click",
                swapAirports
            );

        document
            .getElementById(
                "flightSearchButton"
            )
            .addEventListener(
                "click",
                searchFlights
            );

        document
            .querySelectorAll(
                "[data-sort]"
            )
            .forEach(
                function (btn) {
                    btn.addEventListener(
                        "click",
                        function () {
                            state.sort =
                                btn.dataset.sort;

                            document
                                .querySelectorAll(
                                    "[data-sort]"
                                )
                                .forEach(
                                    function (b) {
                                        b.classList.toggle(
                                            "active",
                                            b === btn
                                        );
                                    }
                                );

                            renderResults();
                        }
                    );
                }
            );

        const departure =
            document.getElementById(
                "flightDeparture"
            );

        const returnDate =
            document.getElementById(
                "flightReturn"
            );

        if (departure) {
            departure.min =
                todayISO();

            departure.value =
                addDaysISO(7);
        }

        if (returnDate) {
            returnDate.min =
                addDaysISO(7);

            returnDate.value =
                addDaysISO(14);
        }
    }

    /* =========================================================
       TRIP TYPE
    ========================================================= */

    function setTripType(type) {
        const round =
            type === "roundtrip";

        document
            .getElementById(
                "flightOneWayTab"
            )
            .classList.toggle(
                "active",
                !round
            );

        document
            .getElementById(
                "flightRoundTripTab"
            )
            .classList.toggle(
                "active",
                round
            );

        document
            .getElementById(
                "flightReturnField"
            )
            .style.display =
                round
                    ? "block"
                    : "none";
    }

    /* =========================================================
       SWAP AIRPORTS
    ========================================================= */

    function swapAirports() {
        const from =
            document.getElementById(
                "flightFrom"
            );

        const to =
            document.getElementById(
                "flightTo"
            );

        if (!from || !to) {
            return;
        }

        const temporary =
            from.value;

        from.value =
            to.value;

        to.value =
            temporary;
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

        if (view) {
            view.style.display =
                "block";
        }

        document
            .querySelectorAll(
                ".menu-item"
            )
            .forEach(
                function (element) {
                    element.classList.remove(
                        "active"
                    );
                }
            );

        const menu =
            document.getElementById(
                "flightSearchMenu"
            );

        if (menu) {
            menu.classList.add(
                "active"
            );
        }

        loadFlightMode();
    }

    /* =========================================================
       CHECK LIVE / DEMO MODE
    ========================================================= */

    async function loadFlightMode() {
        try {
            const response =
                await fetch(
                    "/api/flights/status"
                );

            if (!response.ok) {
                return;
            }

            const data =
                await response.json();

            state.mode =
                data.mode || "demo";

            const badge =
                document.getElementById(
                    "flightModeBadge"
                );

            if (badge) {
                badge.textContent =
                    state.mode === "live"
                        ? "LIVE AVAILABILITY"
                        : "DEMO AVAILABILITY";
            }

        } catch (error) {
            state.mode =
                "demo";
        }
    }

    /* =========================================================
       SEARCH FLIGHTS
    ========================================================= */

    async function searchFlights() {
        const button =
            document.getElementById(
                "flightSearchButton"
            );

        const error =
            document.getElementById(
                "flightSearchError"
            );

        const resultsContainer =
            document.getElementById(
                "flightResults"
            );

        if (
            !button ||
            !error ||
            !resultsContainer
        ) {
            return;
        }

        error.innerHTML =
            "";

        const from =
            document
                .getElementById(
                    "flightFrom"
                )
                .value
                .trim()
                .toUpperCase();

        const to =
            document
                .getElementById(
                    "flightTo"
                )
                .value
                .trim()
                .toUpperCase();

        const departure =
            document.getElementById(
                "flightDeparture"
            ).value;

        const returnDate =
            document.getElementById(
                "flightReturn"
            ).value;

        const adults =
            Number(
                document.getElementById(
                    "flightAdults"
                ).value || 1
            );

        const cabin =
            document.getElementById(
                "flightCabin"
            ).value;

        const airline =
            document
                .getElementById(
                    "flightAirline"
                )
                .value
                .trim()
                .toUpperCase();

        const max =
            Number(
                document.getElementById(
                    "flightMax"
                ).value || 20
            );

        const roundTrip =
            document
                .getElementById(
                    "flightRoundTripTab"
                )
                .classList
                .contains("active");

        /* =====================================================
           VALIDATION
        ===================================================== */

        if (
            !/^[A-Z]{3}$/.test(from) ||
            !/^[A-Z]{3}$/.test(to)
        ) {
            error.innerHTML =
                '<div class="flight-error">' +
                "Please enter valid 3-letter IATA airport " +
                "codes, for example LHE and DXB." +
                "</div>";

            return;
        }

        if (from === to) {
            error.innerHTML =
                '<div class="flight-error">' +
                "Departure and arrival airports must be different." +
                "</div>";

            return;
        }

        if (!departure) {
            error.innerHTML =
                '<div class="flight-error">' +
                "Please select a departure date." +
                "</div>";

            return;
        }

        if (
            roundTrip &&
            (
                !returnDate ||
                returnDate <= departure
            )
        ) {
            error.innerHTML =
                '<div class="flight-error">' +
                "For a round trip, the return date must be " +
                "after the departure date." +
                "</div>";

            return;
        }

        if (
            !Number.isInteger(adults) ||
            adults < 1 ||
            adults > 9
        ) {
            error.innerHTML =
                '<div class="flight-error">' +
                "Passengers must be between 1 and 9." +
                "</div>";

            return;
        }

        if (
            airline &&
            !/^[A-Z0-9]{2}$/.test(
                airline
            )
        ) {
            error.innerHTML =
                '<div class="flight-error">' +
                "Airline code must be a valid 2-character code, " +
                "for example EK." +
                "</div>";

            return;
        }

        /* =====================================================
           LOADING
        ===================================================== */

        button.disabled =
            true;

        button.textContent =
            "Searching…";

        resultsContainer.innerHTML =
            '<div class="flight-empty">' +
            "Searching airline availability…" +
            "</div>";

        const params =
            new URLSearchParams({
                origin: from,
                destination: to,
                departureDate: departure,
                adults: String(adults),
                cabin: cabin,
                max: String(max)
            });

        if (roundTrip) {
            params.set(
                "returnDate",
                returnDate
            );
        }

        if (airline) {
            params.set(
                "airline",
                airline
            );
        }

        try {
            const response =
                await fetch(
                    "/api/flights/search?" +
                    params.toString()
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Flight search failed."
                );
            }

            state.results =
                Array.isArray(
                    data.results
                )
                    ? data.results
                    : [];

            state.mode =
                data.mode ||
                state.mode;

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
                    state.mode === "live"
                        ? "LIVE AVAILABILITY"
                        : "DEMO AVAILABILITY";
            }

            renderResults();

        } catch (err) {
            state.results =
                [];

            resultsContainer.innerHTML =
                '<div class="flight-empty">' +
                "No results to display." +
                "</div>";

            error.innerHTML =
                '<div class="flight-error">' +
                esc(
                    err.message ||
                    "Flight search failed."
                ) +
                "</div>";

        } finally {
            button.disabled =
                false;

            button.textContent =
                "🔎 Search Flights";
        }
    }

    /* =========================================================
       SORT
    ========================================================= */

    function sortedResults() {
        const results =
            [...state.results];

        if (
            state.sort ===
            "fastest"
        ) {
            return results.sort(
                function (a, b) {
                    return (
                        Number(
                            a.durationMinutes ||
                            9999
                        ) -
                        Number(
                            b.durationMinutes ||
                            9999
                        )
                    );
                }
            );
        }

        if (
            state.sort ===
            "departure"
        ) {
            return results.sort(
                function (a, b) {
                    return String(
                        a.departureTime ||
                        ""
                    ).localeCompare(
                        String(
                            b.departureTime ||
                            ""
                        )
                    );
                }
            );
        }

        return results.sort(
            function (a, b) {
                return (
                    Number(
                        a.price || 0
                    ) -
                    Number(
                        b.price || 0
                    )
                );
            }
        );
    }

    /* =========================================================
       RENDER RESULTS
    ========================================================= */

    function renderResults() {
        const container =
            document.getElementById(
                "flightResults"
            );

        const toolbar =
            document.getElementById(
                "flightToolbar"
            );

        const summary =
            document.getElementById(
                "flightResultSummary"
            );

        if (
            !container ||
            !toolbar
        ) {
            return;
        }

        if (
            !state.results.length
        ) {
            toolbar.style.display =
                "none";

            container.innerHTML =
                '<div class="flight-empty">' +
                "No flights found for this search. " +
                "Try another date, airport, cabin, or airline." +
                "</div>";

            return;
        }

        toolbar.style.display =
            "flex";

        if (summary) {
            summary.textContent =
                state.results.length +
                " flight option" +
                (
                    state.results.length ===
                    1
                        ? ""
                        : "s"
                );
        }

        const results =
            sortedResults();

        container.innerHTML =
            results
                .map(
                    function (
                        flight,
                        index
                    ) {
                        const stops =
                            Number(
                                flight.stops ||
                                0
                            ) === 0
                                ? "Non-stop"
                                : (
                                    Number(
                                        flight.stops
                                    ) +
                                    " stop" +
                                    (
                                        Number(
                                            flight.stops
                                        ) === 1
                                            ? ""
                                            : "s"
                                    )
                                );

                        const airlineName =
                            flight.airlineName ||
                            airlines[
                                flight.airline
                            ] ||
                            flight.airline ||
                            "Airline";

                        const price =
                            Number(
                                flight.price ||
                                0
                            ).toLocaleString(
                                undefined,
                                {
                                    minimumFractionDigits:
                                        2,
                                    maximumFractionDigits:
                                        2
                                }
                            );

                        const seats =
                            Number(
                                flight.seatsAvailable ||
                                0
                            );

                        const seatText =
                            seats > 0
                                ? seats +
                                  " seats left"
                                : "Availability shown by provider";

                        return `
                            <article class="flight-result">

                                <div class="flight-airline">

                                    <div class="airline-badge">
                                        ${esc(
                                            flight.airline ||
                                            "✈"
                                        )}
                                    </div>

                                    <div>
                                        <strong>
                                            ${esc(
                                                airlineName
                                            )}
                                        </strong>

                                        <small>
                                            ${esc(
                                                flight.flightNumber ||
                                                "Flight"
                                            )}
                                        </small>
                                    </div>

                                </div>

                                <div>

                                    <div class="flight-route-line">

                                        <div>
                                            <div class="flight-time">
                                                ${esc(
                                                    flight.departureLocal ||
                                                    flight.departureTime ||
                                                    "—"
                                                )}
                                            </div>

                                            <div class="flight-airport">
                                                ${esc(
                                                    flight.origin ||
                                                    "—"
                                                )}
                                            </div>
                                        </div>

                                        <div class="flight-line"></div>

                                        <div>
                                            <div class="flight-time">
                                                ${esc(
                                                    flight.arrivalLocal ||
                                                    flight.arrivalTime ||
                                                    "—"
                                                )}
                                            </div>

                                            <div class="flight-airport">
                                                ${esc(
                                                    flight.destination ||
                                                    "—"
                                                )}
                                            </div>
                                        </div>

                                    </div>

                                    <div class="flight-meta">
                                        ${esc(
                                            flight.duration ||
                                            "—"
                                        )}
                                        ·
                                        ${esc(stops)}
                                        ·
                                        ${esc(seatText)}
                                    </div>

                                </div>

                                <div>

                                    <strong>
                                        ${esc(
                                            flight.cabinLabel ||
                                            flight.cabin ||
                                            "Economy"
                                        )}
                                    </strong>

                                    <div class="flight-meta">
                                        ${esc(
                                            flight.aircraft ||
                                            "Aircraft not specified"
                                        )}
                                    </div>

                                </div>

                                <div class="flight-price">

                                    <strong>
                                        ${esc(
                                            flight.currency ||
                                            "USD"
                                        )}
                                        ${esc(price)}
                                    </strong>

                                    <small>
                                        provider fare
                                    </small>

                                    <br>

                                    <button
                                        class="select-flight"
                                        type="button"
                                        data-flight-index="${index}"
                                        data-flight-id="${esc(
                                            flight.id ||
                                            ""
                                        )}"
                                    >
                                        Select Flight
                                    </button>

                                </div>

                            </article>
                        `;
                    }
                )
                .join("");

        container
            .querySelectorAll(
                ".select-flight"
            )
            .forEach(
                function (btn) {
                    btn.addEventListener(
                        "click",
                        function () {
                            const id =
                                btn.dataset
                                    .flightId;

                            const index =
                                Number(
                                    btn.dataset
                                        .flightIndex
                                );

                            let flight =
                                state.results.find(
                                    function (
                                        item
                                    ) {
                                        return (
                                            String(
                                                item.id
                                            ) ===
                                            String(
                                                id
                                            )
                                        );
                                    }
                                );

                            if (!flight) {
                                flight =
                                    results[
                                        index
                                    ];
                            }

                            if (flight) {
                                selectFlight(
                                    flight
                                );
                            }
                        }
                    );
                }
            );
    }

    /* =========================================================
       SELECT FLIGHT → NEW BOOKING
    ========================================================= */

    function selectFlight(flight) {
        const search =
            state.lastSearch ||
            {};

        const airlineName =
            flight.airlineName ||
            airlines[
                flight.airline
            ] ||
            flight.airline ||
            "Selected Airline";

        const cost =
            Number(
                flight.price ||
                0
            );

        if (
            typeof window.showBookingForm ===
            "function"
        ) {
            window.showBookingForm();
        }

        function set(
            id,
            value
        ) {
            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.value =
                    value ?? "";
            }
        }

        set(
            "airlineName",
            airlineName
        );

        set(
            "flightNumber",
            flight.flightNumber ||
            ""
        );

        set(
            "travelDate",
            search.departure ||
            ""
        );

        set(
            "fromAirport",
            flight.origin ||
            search.from ||
            ""
        );

        set(
            "toAirport",
            flight.destination ||
            search.to ||
            ""
        );

        /* =====================================================
           IMPORTANT CABIN FIX

           Flight search uses:
           ECONOMY
           PREMIUM_ECONOMY
           BUSINESS
           FIRST

           New Booking uses:
           Economy
           Premium Economy
           Business
           First

           Convert between them here.
        ===================================================== */

        const cabinMap = {
            ECONOMY:
                "Economy",

            PREMIUM_ECONOMY:
                "Premium Economy",

            BUSINESS:
                "Business",

            FIRST:
                "First"
        };

        const selectedCabin =
            cabinMap[
                flight.cabin
            ] ||
            cabinMap[
                search.cabin
            ] ||
            flight.cabin ||
            search.cabin ||
            "Economy";

        set(
            "cabinClass",
            selectedCabin
        );

        set(
            "passengerCount",
            search.adults ||
            1
        );

        set(
            "costPrice",
            cost.toFixed(2)
        );

        set(
            "sellingPrice",
            cost.toFixed(2)
        );

        set(
            "amountPaid",
            "0"
        );

        /* =====================================================
           TRIGGER EXISTING BOOKING FORM CALCULATIONS
        ===================================================== */

        [
            "airlineName",
            "flightNumber",
            "travelDate",
            "fromAirport",
            "toAirport",
            "cabinClass",
            "passengerCount",
            "costPrice",
            "sellingPrice",
            "amountPaid"
        ].forEach(
            function (id) {
                const element =
                    document.getElementById(
                        id
                    );

                if (element) {
                    element.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                    element.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );
                }
            }
        );

        /* =====================================================
           ROUTE PREVIEW
        ===================================================== */

        const routePreview =
            document.getElementById(
                "previewFrom"
            );

        if (routePreview) {
            routePreview.textContent =
                flight.origin ||
                search.from ||
                "—";
        }

        const routeTo =
            document.getElementById(
                "previewTo"
            );

        if (routeTo) {
            routeTo.textContent =
                flight.destination ||
                search.to ||
                "—";
        }

        /* =====================================================
           SUCCESS MESSAGE
        ===================================================== */

        if (
            typeof window.showToast ===
            "function"
        ) {
            window.showToast(
                "Flight " +
                (
                    flight.flightNumber ||
                    "selected"
                ) +
                " added to New Booking",
                "success"
            );
        }
    }

    /* =========================================================
       STARTUP
    ========================================================= */

    function boot() {
        injectStyles();
        injectUI();
        loadFlightMode();
    }

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

    window.showFlightSearch =
        showFlightSearch;

})();
