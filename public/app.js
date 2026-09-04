/* =========================================================
   AIRFLOW AIRLINE BOOKING SYSTEM
   COMPLETE FRONTEND
   DASHBOARD + BOOKINGS + EDIT + PAYMENT
   E-TICKET + CUSTOMER INVOICE
========================================================= */

const socket = io();

/* =========================================================
   GLOBAL STATE
========================================================= */

let bookings = [];
let selectedBooking = null;
let editingBookingId = null;
let confirmCallback = null;


/* =========================================================
   SOCKET CONNECTION
========================================================= */

socket.on("connect", () => {

    console.log(
        "🟢 Socket connected:",
        socket.id
    );

    updateConnectionStatus(true);
});


socket.on("disconnect", () => {

    console.log(
        "🔴 Socket disconnected"
    );

    updateConnectionStatus(false);
});


socket.on("bookings", data => {

    bookings =
        Array.isArray(data)
            ? data
            : [];

    renderDashboard();
    renderManagementTable();
});


socket.on("newBooking", booking => {

    if (!booking) return;

    const exists =
        bookings.some(
            item =>
                item.booking_id ===
                booking.booking_id
        );

    if (!exists) {

        bookings.unshift(
            booking
        );

    } else {

        bookings =
            bookings.map(
                item =>
                    item.booking_id ===
                    booking.booking_id
                        ? booking
                        : item
            );
    }

    renderDashboard();
    renderManagementTable();

    showToast(
        `Booking ${booking.booking_id} created successfully`,
        "success"
    );
});


socket.on("bookingUpdated", booking => {

    if (!booking) return;

    bookings =
        bookings.map(
            item =>
                item.booking_id ===
                booking.booking_id
                    ? booking
                    : item
        );

    renderDashboard();
    renderManagementTable();

    if (
        selectedBooking &&
        selectedBooking.booking_id ===
            booking.booking_id
    ) {

        selectedBooking =
            booking;

        renderBookingDetails(
            booking
        );
    }
});


socket.on("bookingDeleted", data => {

    if (
        !data ||
        !data.booking_id
    ) {
        return;
    }

    bookings =
        bookings.filter(
            booking =>
                booking.booking_id !==
                data.booking_id
        );

    renderDashboard();
    renderManagementTable();
});


socket.on("bookingError", data => {

    showToast(
        data?.error ||
            "Booking operation failed",
        "error"
    );
});


/* =========================================================
   CONNECTION STATUS
========================================================= */

function updateConnectionStatus(
    connected
) {

    const dot =
        document.querySelector(
            ".connection .status-dot"
        );

    const strong =
        document.querySelector(
            ".connection strong"
        );

    const small =
        document.querySelector(
            ".connection small"
        );

    if (
        !dot ||
        !strong ||
        !small
    ) {
        return;
    }

    if (connected) {

        dot.style.background =
            "#12b76a";

        dot.style.boxShadow =
            "0 0 0 4px rgba(18,183,106,0.1)";

        strong.textContent =
            "System Online";

        small.textContent =
            "Real-time connected";

    } else {

        dot.style.background =
            "#d92d20";

        dot.style.boxShadow =
            "0 0 0 4px rgba(217,45,32,0.1)";

        strong.textContent =
            "Disconnected";

        small.textContent =
            "Trying to reconnect...";
    }
}


/* =========================================================
   CLOCK
========================================================= */

function updateClock() {

    const now =
        new Date();

    const time =
        now.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );

    document
        .querySelectorAll(".clock")
        .forEach(
            clock => {
                clock.textContent =
                    time;
            }
        );
}

setInterval(
    updateClock,
    1000
);

updateClock();


/* =========================================================
   NAVIGATION
========================================================= */

function hideAllViews() {

    [
        "dashboardView",
        "bookingFormView",
        "bookingManagementView"
    ].forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {

                element.classList.add(
                    "hidden"
                );
            }
        }
    );
}


function setActiveMenu(
    menuId
) {

    document
        .querySelectorAll(
            ".menu-item"
        )
        .forEach(
            item =>
                item.classList.remove(
                    "active"
                )
        );

    const menu =
        document.getElementById(
            menuId
        );

    if (menu) {

        menu.classList.add(
            "active"
        );
    }
}


function showDashboard() {

    hideAllViews();

    const view =
        document.getElementById(
            "dashboardView"
        );

    if (view) {

        view.classList.remove(
            "hidden"
        );
    }

    setActiveMenu(
        "dashboardMenu"
    );

    renderDashboard();
}


function showBookingForm() {

    hideAllViews();

    const view =
        document.getElementById(
            "bookingFormView"
        );

    if (view) {

        view.classList.remove(
            "hidden"
        );
    }

    setActiveMenu(
        "newBookingMenu"
    );

    setMinimumTravelDate();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function showBookingManagement() {

    hideAllViews();

    const view =
        document.getElementById(
            "bookingManagementView"
        );

    if (view) {

        view.classList.remove(
            "hidden"
        );
    }

    setActiveMenu(
        "bookingsMenu"
    );

    renderManagementTable();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   INITIAL LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupNewBookingForm();

        setupEditBookingForm();

        setupFinancialPreview();

        setupRoutePreview();

        setupManagementSearch();

        setMinimumTravelDate();

        loadBookings();

        showDashboard();
    }
);


/* =========================================================
   LOAD BOOKINGS
========================================================= */

async function loadBookings() {

    try {

        const response =
            await authauthFetch(
                "/api/bookings"
            );

        if (!response.ok) {

            throw new Error(
                "Failed to load bookings"
            );
        }

        const data =
            await response.json();

        bookings =
            Array.isArray(data)
                ? data
                : [];

        renderDashboard();

        renderManagementTable();

    } catch (error) {

        console.error(
            error
        );

        showToast(
            "Unable to load bookings",
            "error"
        );
    }
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

    const activeBookings =
        bookings.filter(
            booking =>
                booking.status !==
                "Cancelled"
        );

    const totalBookings =
        activeBookings.length;

    const totalSales =
        activeBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                numberValue(
                    booking.selling_price
                ),
            0
        );

    const totalProfit =
        activeBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                numberValue(
                    booking.profit
                ),
            0
        );

    const totalPassengers =
        activeBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                numberValue(
                    booking.passengers,
                    1
                ),
            0
        );

    setText(
        "totalBookings",
        totalBookings
    );

    setText(
        "totalSales",
        formatCurrency(
            totalSales
        )
    );

    setText(
        "totalProfit",
        formatCurrency(
            totalProfit
        )
    );

    setText(
        "totalPassengers",
        totalPassengers
    );

    renderDashboardTable();
}


/* =========================================================
   DASHBOARD TABLE
========================================================= */

function renderDashboardTable() {

    const tbody =
        document.getElementById(
            "bookingTableBody"
        );

    if (!tbody) return;

    const recent =
        bookings.slice(
            0,
            10
        );

    if (!recent.length) {

        tbody.innerHTML = `
            <tr class="empty">
                <td colspan="9">
                    No bookings found
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        recent
            .map(
                booking => `

                <tr>

                    <td>
                        <span class="booking-id">
                            ${escapeHTML(
                                booking.booking_id
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="pnr">
                            ${escapeHTML(
                                booking.pnr ||
                                    "-"
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="passenger-name">
                            ${escapeHTML(
                                booking.passenger ||
                                    "-"
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="airline-cell">
                            ${escapeHTML(
                                booking.airline ||
                                    "-"
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="route-cell">
                            ${escapeHTML(
                                booking.route ||
                                    "-"
                            )}
                        </span>
                    </td>

                    <td>
                        ${formatDate(
                            booking.travel_date
                        )}
                    </td>

                    <td>
                        <span class="amount-cell">
                            ${formatCurrency(
                                booking.selling_price
                            )}
                        </span>
                    </td>

                    <td>
                        ${statusBadge(
                            booking.status
                        )}
                    </td>

                    <td>

                        <button
                            class="view-button table-action"
                            onclick="openBookingDetails('${safeAttribute(
                                booking.booking_id
                            )}')"
                        >
                            View
                        </button>

                    </td>

                </tr>

            `
            )
            .join("");
}


/* =========================================================
   MANAGEMENT SEARCH
========================================================= */

function setupManagementSearch() {

    const search =
        document.getElementById(
            "bookingSearch"
        );

    const filter =
        document.getElementById(
            "bookingStatusFilter"
        );

    if (search) {

        search.addEventListener(
            "input",
            renderManagementTable
        );
    }

    if (filter) {

        filter.addEventListener(
            "change",
            renderManagementTable
        );
    }
}


/* =========================================================
   MANAGEMENT TABLE
========================================================= */

function renderManagementTable() {

    const tbody =
        document.getElementById(
            "managementTableBody"
        );

    if (!tbody) return;

    const searchInput =
        document.getElementById(
            "bookingSearch"
        );

    const filter =
        document.getElementById(
            "bookingStatusFilter"
        );

    const search =
        searchInput
            ? searchInput.value
                  .trim()
                  .toLowerCase()
            : "";

    const status =
        filter
            ? filter.value
            : "";

    const filtered =
        bookings.filter(
            booking => {

                const searchable = [

                    booking.booking_id,
                    booking.pnr,
                    booking.passenger,
                    booking.phone,
                    booking.email,
                    booking.airline,
                    booking.flight_number,
                    booking.route

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !search ||
                    searchable.includes(
                        search
                    );

                const matchesStatus =
                    !status ||
                    booking.status ===
                        status;

                return (
                    matchesSearch &&
                    matchesStatus
                );
            }
        );

    const count =
        document.getElementById(
            "resultsCount"
        );

    if (count) {

        count.textContent =
            `${filtered.length} ${
                filtered.length === 1
                    ? "booking"
                    : "bookings"
            }`;
    }

    if (!filtered.length) {

        tbody.innerHTML = `
            <tr class="empty">
                <td colspan="11">
                    No bookings match your search
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        filtered
            .map(
                booking => `

                <tr>

                    <td>
                        <span class="booking-id">
                            ${escapeHTML(
                                booking.booking_id
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="pnr">
                            ${escapeHTML(
                                booking.pnr ||
                                    "-"
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="passenger-name">
                            ${escapeHTML(
                                booking.passenger ||
                                    "-"
                            )}
                        </span>
                    </td>

                    <td>

                        <span class="airline-cell">
                            ${escapeHTML(
                                booking.airline ||
                                    "-"
                            )}
                        </span>

                        ${
                            booking.flight_number
                                ? `
                                    <br>
                                    <small>
                                        ${escapeHTML(
                                            booking.flight_number
                                        )}
                                    </small>
                                  `
                                : ""
                        }

                    </td>

                    <td>
                        <span class="route-cell">
                            ${escapeHTML(
                                booking.route ||
                                    "-"
                            )}
                        </span>
                    </td>

                    <td>
                        ${formatDate(
                            booking.travel_date
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            booking.selling_price
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            booking.profit
                        )}
                    </td>

                    <td>
                        ${paymentBadge(
                            booking.payment_status
                        )}
                    </td>

                    <td>
                        ${statusBadge(
                            booking.status
                        )}
                    </td>

                    <td>

                        <div class="action-buttons">

                            <button
                                class="view-button"
                                onclick="openBookingDetails('${safeAttribute(
                                    booking.booking_id
                                )}')"
                            >
                                View
                            </button>

                            <button
                                class="edit-button"
                                onclick="openEditBooking('${safeAttribute(
                                    booking.booking_id
                                )}')"
                            >
                                Edit
                            </button>

                        </div>

                    </td>

                </tr>

            `
            )
            .join("");
}


/* =========================================================
   NEW BOOKING
========================================================= */

function setupNewBookingForm() {

    const form =
        document.getElementById(
            "bookingForm"
        );

    if (!form) return;

    form.addEventListener(
        "submit",
        createNewBooking
    );
}


async function createNewBooking(
    event
) {

    event.preventDefault();

    const passenger =
        getValue(
            "passengerName"
        );

    const phone =
        getValue(
            "phone"
        );

    const email =
        getValue(
            "email"
        );

    const airline =
        getValue(
            "airlineName"
        );

    const flightNumber =
        getValue(
            "flightNumber"
        );

    const from =
        getValue(
            "fromAirport"
        ).toUpperCase();

    const to =
        getValue(
            "toAirport"
        ).toUpperCase();

    const date =
        getValue(
            "travelDate"
        );

    const cabinClass =
        getValue(
            "cabinClass"
        );

    const passengers =
        numberValue(
            getValue(
                "passengerCount"
            ),
            1
        );

    const costPrice =
        numberValue(
            getValue(
                "costPrice"
            )
        );

    const sellingPrice =
        numberValue(
            getValue(
                "sellingPrice"
            )
        );

    const amountPaid =
        numberValue(
            getValue(
                "amountPaid"
            )
        );

    const status =
        getValue(
            "bookingStatus"
        ) ||
        "Confirmed";

    if (
        !passenger ||
        !airline ||
        !from ||
        !to ||
        !date ||
        !cabinClass
    ) {

        showToast(
            "Please fill all required fields",
            "error"
        );

        return;
    }

    if (
        from.length !== 3 ||
        to.length !== 3
    ) {

        showToast(
            "Airport codes must contain 3 letters",
            "error"
        );

        return;
    }

    if (
        amountPaid >
        sellingPrice
    ) {

        showToast(
            "Amount paid cannot be greater than selling price",
            "error"
        );

        return;
    }

    if (
        sellingPrice <
        costPrice
    ) {

        if (
            !confirm(
                "Selling price is lower than airline cost. Continue?"
            )
        ) {
            return;
        }
    }

    const bookingData = {

        passenger,
        phone,
        email,

        airline,
        flightNumber,

        route:
            `${from} → ${to}`,

        date,

        cabinClass,

        passengers,

        costPrice,
        sellingPrice,
        amountPaid,

        paymentStatus:
            getPaymentStatus(
                sellingPrice,
                amountPaid
            ),

        status
    };

    setFormLoading(
        true,
        "createBookingButton",
        "Creating..."
    );

    try {

        const response =
            await authauthFetch(
                "/api/bookings",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            bookingData
                        )
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.error ||
                    "Failed to create booking"
            );
        }

        showToast(
            `Booking ${result.booking_id} created • PNR ${result.pnr}`,
            "success"
        );

        resetNewBookingForm();

        setTimeout(
            () => {
                showBookingManagement();
            },
            500
        );

    } catch (error) {

        console.error(
            error
        );

        showToast(
            error.message ||
                "Failed to create booking",
            "error"
        );

    } finally {

        setFormLoading(
            false,
            "createBookingButton",
            "Create Booking"
        );
    }
}


/* =========================================================
   RESET FORM
========================================================= */

function resetNewBookingForm() {

    const form =
        document.getElementById(
            "bookingForm"
        );

    if (form) {
        form.reset();
    }

    setValue(
        "passengerCount",
        "1"
    );

    setValue(
        "paymentStatus",
        "Unpaid"
    );

    setValue(
        "bookingStatus",
        "Confirmed"
    );

    setText(
        "previewFrom",
        "---"
    );

    setText(
        "previewTo",
        "---"
    );

    updateFinancialPreview();
}


/* =========================================================
   ROUTE PREVIEW
========================================================= */

function setupRoutePreview() {

    const from =
        document.getElementById(
            "fromAirport"
        );

    const to =
        document.getElementById(
            "toAirport"
        );

    if (from) {

        from.addEventListener(
            "input",
            updateRoutePreview
        );
    }

    if (to) {

        to.addEventListener(
            "input",
            updateRoutePreview
        );
    }
}


function updateRoutePreview() {

    const from =
        getValue(
            "fromAirport"
        ).toUpperCase();

    const to =
        getValue(
            "toAirport"
        ).toUpperCase();

    setText(
        "previewFrom",
        from || "---"
    );

    setText(
        "previewTo",
        to || "---"
    );
}


/* =========================================================
   FINANCIAL PREVIEW
========================================================= */

function setupFinancialPreview() {

    [
        "costPrice",
        "sellingPrice",
        "amountPaid"
    ].forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {

                element.addEventListener(
                    "input",
                    updateFinancialPreview
                );
            }
        }
    );
}


function updateFinancialPreview() {

    const cost =
        numberValue(
            getValue(
                "costPrice"
            )
        );

    const selling =
        numberValue(
            getValue(
                "sellingPrice"
            )
        );

    const paid =
        numberValue(
            getValue(
                "amountPaid"
            )
        );

    const profit =
        selling -
        cost;

    const balance =
        Math.max(
            selling -
                paid,
            0
        );

    setText(
        "previewCost",
        formatCurrency(
            cost
        )
    );

    setText(
        "previewSelling",
        formatCurrency(
            selling
        )
    );

    setText(
        "previewProfit",
        formatCurrency(
            profit
        )
    );

    setText(
        "previewBalance",
        formatCurrency(
            balance
        )
    );

    setValue(
        "paymentStatus",
        getPaymentStatus(
            selling,
            paid
        )
    );
}


/* =========================================================
   BOOKING DETAILS
========================================================= */

function openBookingDetails(
    bookingId
) {

    const booking =
        bookings.find(
            item =>
                item.booking_id ===
                bookingId
        );

    if (!booking) {

        showToast(
            "Booking not found",
            "error"
        );

        return;
    }

    selectedBooking =
        booking;

    renderBookingDetails(
        booking
    );

    const modal =
        document.getElementById(
            "bookingDetailsModal"
        );

    if (modal) {

        modal.classList.remove(
            "hidden"
        );

        document.body.style.overflow =
            "hidden";
    }
}


function renderBookingDetails(
    booking
) {

    const container =
        document.getElementById(
            "bookingDetailsContent"
        );

    if (!container) return;

    const isCancelled =
        booking.status ===
        "Cancelled";

    const isPaid =
        booking.payment_status ===
        "Paid";
        const isAdmin =
    currentUser &&
    currentUser.role ===
        "admin";

    container.innerHTML = `

        <div class="booking-identity">

            <div class="identity-item">

                <span>
                    Booking ID
                </span>

                <strong>
                    ${escapeHTML(
                        booking.booking_id
                    )}
                </strong>

            </div>


            <div class="identity-item">

                <span>
                    PNR
                </span>

                <strong>
                    ${escapeHTML(
                        booking.pnr ||
                            "-"
                    )}
                </strong>

            </div>


            <div class="identity-item">

                <span>
                    Status
                </span>

                <strong>
                    ${statusBadge(
                        booking.status
                    )}
                </strong>

            </div>

        </div>


        <div class="details-body">

            <div class="details-grid">


                <div class="detail-section">

                    <div class="detail-section-title">
                        Passenger Information
                    </div>

                    <div class="detail-list">

                        <div class="detail-row">

                            <span>
                                Passenger
                            </span>

                            <strong>
                                ${escapeHTML(
                                    booking.passenger ||
                                        "-"
                                )}
                            </strong>

                        </div>


                        <div class="detail-row">

                            <span>
                                Phone
                            </span>

                            <strong>
                                ${escapeHTML(
                                    booking.phone ||
                                        "-"
                                )}
                            </strong>

                        </div>


                        <div class="detail-row">

                            <span>
                                Email
                            </span>

                            <strong>
                                ${escapeHTML(
                                    booking.email ||
                                        "-"
                                )}
                            </strong>

                        </div>

                    </div>

                </div>


                <div class="detail-section">

                    <div class="detail-section-title">
                        Flight Information
                    </div>

                    <div class="detail-list">

                        <div class="detail-row">

                            <span>
                                Airline
                            </span>

                            <strong>
                                ${escapeHTML(
                                    booking.airline ||
                                        "-"
                                )}
                            </strong>

                        </div>


                        <div class="detail-row">

                            <span>
                                Flight Number
                            </span>

                            <strong>
                                ${escapeHTML(
                                    booking.flight_number ||
                                        "-"
                                )}
                            </strong>

                        </div>


                        <div class="detail-row">

                            <span>
                                Route
                            </span>

                            <strong>
                                ${escapeHTML(
                                    booking.route ||
                                        "-"
                                )}
                            </strong>

                        </div>


                        <div class="detail-row">

                            <span>
                                Travel Date
                            </span>

                            <strong>
                                ${formatDate(
                                    booking.travel_date
                                )}
                            </strong>

                        </div>

                    </div>

                </div>


                <div class="detail-section">

                    <div class="detail-section-title">
                        Passenger / Cabin
                    </div>

                    <div class="detail-list">

                        <div class="detail-row">

                            <span>
                                Cabin Class
                            </span>

                            <strong>
                                ${escapeHTML(
                                    booking.cabin_class ||
                                        "-"
                                )}
                            </strong>

                        </div>


                        <div class="detail-row">

                            <span>
                                Passengers
                            </span>

                            <strong>
                                ${numberValue(
                                    booking.passengers,
                                    1
                                )}
                            </strong>

                        </div>

                    </div>

                </div>


                <div class="detail-section">

                    <div class="detail-section-title">
                        Payment
                    </div>

                    <div class="detail-list">

                        <div class="detail-row">

                            <span>
                                Payment Status
                            </span>

                            <strong>
                                ${paymentBadge(
                                    booking.payment_status
                                )}
                            </strong>

                        </div>


                        <div class="detail-row">

                            <span>
                                Amount Paid
                            </span>

                            <strong>
                                ${formatCurrency(
                                    booking.amount_paid
                                )}
                            </strong>

                        </div>


                        <div class="detail-row">

                            <span>
                                Balance
                            </span>

                            <strong>
                                ${formatCurrency(
                                    booking.balance
                                )}
                            </strong>

                        </div>

                    </div>

                </div>

<div class="detail-section">

    <div class="detail-section-title">
        Booking Activity
    </div>

    <div class="detail-list">

        <div class="detail-row">
            <span>
                Created By
            </span>

            <strong>
                ${escapeHTML(
                    booking.created_by_name ||
                    booking.created_by_username ||
                    "-"
                )}
            </strong>
        </div>


        <div class="detail-row">
            <span>
                Approved By
            </span>

            <strong>
                ${escapeHTML(
                    booking.approved_by_name ||
                    booking.approved_by_username ||
                    (
                        booking.status === "Pending"
                            ? "Pending Approval"
                            : "-"
                    )
                )}
            </strong>
        </div>


        <div class="detail-row">
            <span>
                Approved At
            </span>

            <strong>
                ${
                    booking.approved_at
                        ? new Date(
                            booking.approved_at
                        ).toLocaleString()
                        : "-"
                }
            </strong>
        </div>

    </div>

</div>
${
    booking.payment_proof
        ? `
            <div class="detail-section full-width">

                <div class="detail-section-title">
                    Payment Proof
                </div>

                <div class="detail-list">

                    <div class="detail-row">
                        <span>
                            Uploaded By
                        </span>

                        <strong>
                            ${escapeHTML(
                                booking.payment_proof_uploaded_by_name ||
                                booking.payment_proof_uploaded_by_username ||
                                "-"
                            )}
                        </strong>
                    </div>


                    <div class="detail-row">
                        <span>
                            Uploaded At
                        </span>

                        <strong>
                            ${
                                booking.payment_proof_uploaded_at
                                    ? new Date(
                                        booking.payment_proof_uploaded_at
                                    ).toLocaleString()
                                    : "-"
                            }
                        </strong>
                    </div>


                    <div class="detail-row">
                        <span>
                            Proof
                        </span>

                        <strong>
                            <a
                                href="${safeAttribute(
                                    booking.payment_proof
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="primary-button"
                            >
                                View Payment Proof
                            </a>
                            
                        </strong>
                        <div class="detail-row">
...
View Payment Proof
...
</div>
                    </div>

                </div>

            </div>
        `
        : ""
}

                <div class="detail-section full-width">

                    <div class="detail-section-title">
                        Financial Summary
                    </div>

                    <div class="financial-details">


                        <div class="financial-detail-box">

                            <span>
                                Airline Cost
                            </span>

                            <strong>
                                ${formatCurrency(
                                    booking.cost_price
                                )}
                            </strong>

                        </div>


                        <div class="financial-detail-box">

                            <span>
                                Selling Price
                            </span>

                            <strong>
                                ${formatCurrency(
                                    booking.selling_price
                                )}
                            </strong>

                        </div>


                        <div class="financial-detail-box profit">

                            <span>
                                Profit
                            </span>

                            <strong>
                                ${formatCurrency(
                                    booking.profit
                                )}
                            </strong>

                        </div>


                        <div class="financial-detail-box balance">

                            <span>
                                Balance
                            </span>

                            <strong>
                                ${formatCurrency(
                                    booking.balance
                                )}
                            </strong>

                        </div>

                    </div>

                </div>

            </div>

        </div>


        <div class="modal-footer">

            <button
                type="button"
                class="secondary-button"
                onclick="closeBookingDetails()"
            >
                Close
            </button>


            <button
                type="button"
                class="primary-button"
                onclick="openTicket('${safeAttribute(
                    booking.booking_id
                )}')"
            >
                🎫 E-Ticket
            </button>


            <button
                type="button"
                class="secondary-button"
                onclick="openInvoice('${safeAttribute(
                    booking.booking_id
                )}')"
            >
                🧾 Invoice
            </button>


            <button
                type="button"
                class="edit-button"
                onclick="openEditBooking('${safeAttribute(
                    booking.booking_id
                )}')"
            >
                ✏ Edit
            </button>


            ${
    isAdmin &&
    booking.status === "Pending"
        ? `
            <button
                type="button"
                class="success-button"
                onclick="confirmBooking('${safeAttribute(
                    booking.booking_id
                )}')"
            >
                ✓ Confirm Booking
            </button>
        `
        : ""
}
${
    isAdmin &&
    booking.status === "Confirmed"
        ? `
            <button
                type="button"
                class="primary-button"
                onclick="uploadPaymentProof('${safeAttribute(
                    booking.booking_id
                )}')"
            >
               ${
    booking.payment_proof
        ? "📎 Replace Payment Proof"
        : "📎 Upload Payment Proof"
}
            </button>
        `
        : ""
}



${
    isAdmin &&
!isPaid &&
!isCancelled &&
booking.payment_proof
        ? `
            <button
                type="button"
                class="success-button"
                onclick="markBookingPaid('${safeAttribute(
                    booking.booking_id
                )}')"
            >
                ✓ Mark Paid
            </button>
        `
        : ""
}


${
    isAdmin &&
    !isCancelled
        ? `
            <button
                type="button"
                class="danger-button"
                onclick="requestCancelBooking('${safeAttribute(
                    booking.booking_id
                )}')"
            >
                ✕ Cancel
            </button>
        `
        : ""
}
        </div>
    `;
}


/* =========================================================
   CLOSE DETAILS
========================================================= */

function closeBookingDetails(
    event
) {

    if (
        event &&
        event.target &&
        event.target.id !==
            "bookingDetailsModal"
    ) {
        return;
    }

    const modal =
        document.getElementById(
            "bookingDetailsModal"
        );

    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }

    document.body.style.overflow =
        "";

    selectedBooking =
        null;
}


/* =========================================================
   EDIT BOOKING
========================================================= */

function openEditBooking(
    bookingId
) {

    const booking =
        bookings.find(
            item =>
                item.booking_id ===
                bookingId
        );

    if (!booking) {

        showToast(
            "Booking not found",
            "error"
        );

        return;
    }

    editingBookingId =
        bookingId;

    closeBookingDetails();

    setValue(
        "editPassengerName",
        booking.passenger
    );

    setValue(
        "editPhone",
        booking.phone
    );

    setValue(
        "editEmail",
        booking.email
    );

    setValue(
        "editAirline",
        booking.airline
    );

    setValue(
        "editFlightNumber",
        booking.flight_number
    );

    const route =
        splitRoute(
            booking.route
        );

    setValue(
        "editFrom",
        route.from
    );

    setValue(
        "editTo",
        route.to
    );

    setValue(
        "editTravelDate",
        booking.travel_date
    );

    setValue(
        "editCabinClass",
        booking.cabin_class
    );

    setValue(
        "editPassengers",
        booking.passengers
    );

    setValue(
        "editCostPrice",
        booking.cost_price
    );

    setValue(
        "editSellingPrice",
        booking.selling_price
    );

    setValue(
        "editAmountPaid",
        booking.amount_paid
    );

    setValue(
        "editStatus",
        booking.status
    );

    const modal =
        document.getElementById(
            "editBookingModal"
        );

    if (modal) {

        modal.classList.remove(
            "hidden"
        );

        document.body.style.overflow =
            "hidden";
    }
}


function closeEditBooking(
    event
) {

    if (
        event &&
        event.target &&
        event.target.id !==
            "editBookingModal"
    ) {
        return;
    }

    const modal =
        document.getElementById(
            "editBookingModal"
        );

    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }

    document.body.style.overflow =
        "";

    editingBookingId =
        null;
}


/* =========================================================
   SAVE EDIT
========================================================= */

function setupEditBookingForm() {

    const form =
        document.getElementById(
            "editBookingForm"
        );

    if (!form) return;

    form.addEventListener(
        "submit",
        saveEditedBooking
    );
}


async function saveEditedBooking(
    event
) {

    event.preventDefault();

    if (!editingBookingId) {

        showToast(
            "No booking selected",
            "error"
        );

        return;
    }

    const passenger =
        getValue(
            "editPassengerName"
        );

    const phone =
        getValue(
            "editPhone"
        );

    const email =
        getValue(
            "editEmail"
        );

    const airline =
        getValue(
            "editAirline"
        );

    const flightNumber =
        getValue(
            "editFlightNumber"
        );

    const from =
        getValue(
            "editFrom"
        ).toUpperCase();

    const to =
        getValue(
            "editTo"
        ).toUpperCase();

    const date =
        getValue(
            "editTravelDate"
        );

    const cabinClass =
        getValue(
            "editCabinClass"
        );

    const passengers =
        numberValue(
            getValue(
                "editPassengers"
            ),
            1
        );

    const costPrice =
        numberValue(
            getValue(
                "editCostPrice"
            )
        );

    const sellingPrice =
        numberValue(
            getValue(
                "editSellingPrice"
            )
        );

    const amountPaid =
        numberValue(
            getValue(
                "editAmountPaid"
            )
        );

    const status =
        getValue(
            "editStatus"
        );

    if (
        !passenger ||
        !airline ||
        !from ||
        !to ||
        !date ||
        !cabinClass
    ) {

        showToast(
            "Please fill all required fields",
            "error"
        );

        return;
    }

    if (
        from.length !== 3 ||
        to.length !== 3
    ) {

        showToast(
            "Airport codes must contain 3 letters",
            "error"
        );

        return;
    }

    if (
        amountPaid >
        sellingPrice
    ) {

        showToast(
            "Amount paid cannot exceed selling price",
            "error"
        );

        return;
    }

    if (
        sellingPrice <
        costPrice
    ) {

        if (
            !confirm(
                "Selling price is lower than airline cost. Continue?"
            )
        ) {
            return;
        }
    }

    setFormLoading(
        true,
        "saveEditButton",
        "Saving..."
    );

    try {

        const response =
            await authFetch(
                `/api/bookings/${encodeURIComponent(
                    editingBookingId
                )}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            passenger,
                            phone,
                            email,

                            airline,
                            flightNumber,

                            route:
                                `${from} → ${to}`,

                            date,

                            cabinClass,

                            passengers,

                            costPrice,
                            sellingPrice,
                            amountPaid,

                            status

                        })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.error ||
                    "Failed to update booking"
            );
        }

        showToast(
            `Booking ${result.booking_id} updated successfully`,
            "success"
        );

        closeEditBooking();

    } catch (error) {

        console.error(
            error
        );

        showToast(
            error.message ||
                "Failed to update booking",
            "error"
        );

    } finally {

        setFormLoading(
            false,
            "saveEditButton",
            "Save Changes"
        );
    }
}
async function uploadPaymentProof(
    bookingId
) {

    if (
        !currentUser ||
        currentUser.role !== "admin"
    ) {
        showToast(
            "Admin access required",
            "error"
        );
        return;
    }

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "file";

    input.accept =
        ".jpg,.jpeg,.png,.webp,.pdf";

    input.onchange =
        async function () {

            const file =
                input.files &&
                input.files[0];

            if (!file) {
                return;
            }

            const maxSize =
                5 * 1024 * 1024;

            if (
                file.size >
                maxSize
            ) {
                showToast(
                    "File must be 5 MB or smaller",
                    "error"
                );
                return;
            }

            const formData =
                new FormData();

            formData.append(
                "paymentProof",
                file
            );

            try {

                showToast(
                    "Uploading payment proof...",
                    "info"
                );

                const response =
                    await authFetch(
                        `/api/bookings/${encodeURIComponent(
                            bookingId
                        )}/payment-proof`,
                        {
                            method:
                                "POST",

                            body:
                                formData
                        }
                    );

                const result =
                    await response.json();

                if (!response.ok) {

                    throw new Error(
                        result.error ||
                        "Failed to upload payment proof"
                    );
                }

                selectedBooking =
                    result;

                renderBookingDetails(
                    result
                );

                await loadBookings();

                showToast(
                    "Payment proof uploaded successfully",
                    "success"
                );

            } catch (error) {

                console.error(
                    "PAYMENT PROOF ERROR:",
                    error
                );

                showToast(
                    error.message ||
                    "Payment proof upload failed",
                    "error"
                );
            }
        };

    input.click();
}

/* =========================================================
   MARK PAID
========================================================= */
async function confirmBooking(
    bookingId
) {

    if (
        !currentUser ||
        currentUser.role !== "admin"
    ) {
        showToast(
            "Admin access required",
            "error"
        );
        return;
    }

    try {

        const response =
            await authauthFetch(
                `/api/bookings/${encodeURIComponent(
                    bookingId
                )}/status`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        status:
                            "Confirmed"
                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                    "Failed to confirm booking"
            );
        }

        selectedBooking =
            result;

        renderBookingDetails(
            result
        );

        await loadBookings();

        showToast(
            `Booking ${bookingId} confirmed`,
            "success"
        );

    } catch (error) {

        console.error(
            error
        );

        showToast(
            error.message ||
                "Booking confirmation failed",
            "error"
        );
    }
}

async function markBookingPaid(
    bookingId
) {

    try {

        const response =
            await authFetch(
                `/api/bookings/${encodeURIComponent(
                    bookingId
                )}/payment`,
                {
                    method: "PATCH"
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.error ||
                    "Failed to mark payment as paid"
            );
        }

        selectedBooking =
            result;

        renderBookingDetails(
            result
        );

        showToast(
            `Payment marked as PAID for ${bookingId}`,
            "success"
        );

    } catch (error) {

        console.error(
            error
        );

        showToast(
            error.message ||
                "Payment update failed",
            "error"
        );
    }
}


/* =========================================================
   CANCEL BOOKING
========================================================= */

function requestCancelBooking(
    bookingId
) {

    const booking =
        bookings.find(
            item =>
                item.booking_id ===
                bookingId
        );

    if (!booking) return;

    openConfirmModal(
        "Cancel Booking?",
        `Are you sure you want to cancel booking ${booking.booking_id}? The booking will remain in the database for record keeping.`,
        async () => {

            await cancelBooking(
                bookingId
            );
        }
    );
}


async function cancelBooking(
    bookingId
) {

    closeConfirmModal();

    try {

        const response =
            await authauthFetch(
                `/api/bookings/${encodeURIComponent(
                    bookingId
                )}/status`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status:
                                "Cancelled"
                        })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.error ||
                    "Failed to cancel booking"
            );
        }

        showToast(
            `Booking ${bookingId} cancelled`,
            "success"
        );

        closeBookingDetails();

    } catch (error) {

        console.error(
            error
        );

        showToast(
            error.message ||
                "Failed to cancel booking",
            "error"
        );
    }
}


/* =========================================================
   CONFIRM MODAL
========================================================= */

function openConfirmModal(
    title,
    message,
    callback
) {

    const modal =
        document.getElementById(
            "confirmModal"
        );

    const titleElement =
        document.getElementById(
            "confirmTitle"
        );

    const messageElement =
        document.getElementById(
            "confirmMessage"
        );

    const actionButton =
        document.getElementById(
            "confirmActionButton"
        );

    if (
        !modal ||
        !titleElement ||
        !messageElement ||
        !actionButton
    ) {
        return;
    }

    titleElement.textContent =
        title;

    messageElement.textContent =
        message;

    confirmCallback =
        callback;

    actionButton.onclick =
        async () => {

            if (
                typeof confirmCallback ===
                "function"
            ) {

                await confirmCallback();
            }
        };

    modal.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";
}


function closeConfirmModal(
    event
) {

    if (
        event &&
        event.target &&
        event.target.id !==
            "confirmModal"
    ) {
        return;
    }

    const modal =
        document.getElementById(
            "confirmModal"
        );

    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }

    document.body.style.overflow =
        "";

    confirmCallback =
        null;
}


/* =========================================================
   TEST BOOKING
========================================================= */

function addTestBooking() {

    const testBooking = {

        passenger:
            "Test Passenger",

        phone:
            "+92 300 0000000",

        email:
            "test@airflow.local",

        airline:
            "PIA",

        flightNumber:
            "PK-203",

        route:
            "LHE → DXB",

        date:
            getLocalDate(),

        cabinClass:
            "Economy",

        passengers:
            1,

        costPrice:
            400,

        sellingPrice:
            550,

        amountPaid:
            550,

        paymentStatus:
            "Paid",

        status:
            "Confirmed"
    };

    socket.emit(
        "createBooking",
        testBooking
    );
}


/* =========================================================
   =========================================================
   E-TICKET SYSTEM
   =========================================================
========================================================= */

function openTicket(
    bookingId
) {

    const booking =
        bookings.find(
            item =>
                item.booking_id ===
                bookingId
        );

    if (!booking) {

        showToast(
            "Booking not found",
            "error"
        );

        return;
    }

    const ticketWindow =
        window.open(
            "",
            "_blank",
            "width=1000,height=850"
        );

    if (!ticketWindow) {

        showToast(
            "Please allow pop-ups to open the ticket",
            "warning"
        );

        return;
    }

    ticketWindow.document.open();

    ticketWindow.document.write(
        buildTicketHTML(
            booking
        )
    );

    ticketWindow.document.close();
}


function buildTicketHTML(
    booking
) {

    const route =
        splitRoute(
            booking.route
        );

    return `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    AirFlow E-Ticket - ${escapeHTML(
        booking.booking_id
    )}
</title>


<style>

* {
    box-sizing: border-box;
}

body {

    margin: 0;

    padding: 40px;

    background: #f4f6f8;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    color: #101828;
}


.ticket {

    max-width: 900px;

    margin: auto;

    background: white;

    border-radius: 20px;

    overflow: hidden;

    box-shadow:
        0 15px 45px
        rgba(16,24,40,0.12);
}


.ticket-header {

    padding: 28px 35px;

    background: #101828;

    color: white;

    display: flex;

    justify-content: space-between;

    align-items: center;
}


.brand {

    display: flex;

    align-items: center;

    gap: 14px;
}


.logo {

    width: 48px;

    height: 48px;

    border-radius: 12px;

    background: white;

    color: #101828;

    display: flex;

    align-items: center;

    justify-content: center;

    font-size: 25px;
}


.brand h1 {

    margin: 0;

    font-size: 25px;
}


.brand span {

    font-size: 12px;

    opacity: .7;
}


.ticket-title {

    text-align: right;
}


.ticket-title strong {

    display: block;

    font-size: 18px;
}


.ticket-title span {

    font-size: 12px;

    opacity: .7;
}


.pnr-section {

    padding: 25px 35px;

    display: flex;

    justify-content: space-between;

    border-bottom: 1px solid #eaecf0;
}


.pnr {

    font-size: 12px;

    color: #667085;

    text-transform: uppercase;
}


.pnr strong {

    display: block;

    color: #101828;

    font-size: 26px;

    margin-top: 4px;

    letter-spacing: 2px;
}


.status {

    padding: 8px 14px;

    border-radius: 999px;

    background: #ecfdf3;

    color: #027a48;

    font-size: 13px;

    font-weight: 700;
}


.route {

    padding: 35px;

    display: grid;

    grid-template-columns:
        1fr
        100px
        1fr;

    align-items: center;

    border-bottom:
        1px solid #eaecf0;
}


.airport {

    text-align: center;
}


.airport:first-child {

    text-align: left;
}


.airport:last-child {

    text-align: right;
}


.airport-code {

    font-size: 42px;

    font-weight: 800;

    letter-spacing: -1px;
}


.airport-name {

    color: #667085;

    font-size: 13px;

    margin-top: 5px;
}


.flight-line {

    text-align: center;

    color: #98a2b3;

    font-size: 28px;
}


.flight-number {

    display: block;

    font-size: 11px;

    color: #667085;

    margin-top: 7px;
}


.details {

    padding: 30px 35px;

    display: grid;

    grid-template-columns:
        repeat(4, 1fr);

    gap: 24px;
}


.detail span {

    display: block;

    color: #667085;

    font-size: 11px;

    text-transform: uppercase;

    margin-bottom: 7px;
}


.detail strong {

    font-size: 14px;
}


.passenger {

    margin: 0 35px;

    padding: 22px;

    background: #f8fafc;

    border-radius: 12px;
}


.passenger span {

    display: block;

    font-size: 11px;

    color: #667085;

    text-transform: uppercase;

    margin-bottom: 6px;
}


.passenger strong {

    font-size: 18px;
}


.footer {

    margin-top: 30px;

    padding: 22px 35px;

    border-top: 1px dashed #d0d5dd;

    display: flex;

    justify-content: space-between;

    color: #667085;

    font-size: 11px;
}


.actions {

    max-width: 900px;

    margin: 20px auto 0;

    display: flex;

    justify-content: center;

    gap: 10px;
}


button {

    border: 0;

    padding: 12px 22px;

    border-radius: 9px;

    cursor: pointer;

    background: #101828;

    color: white;

    font-weight: 600;
}


@media print {

    body {

        padding: 0;

        background: white;
    }


    .actions {

        display: none;
    }


    .ticket {

        box-shadow: none;

        border-radius: 0;

        max-width: none;
    }

}

</style>

</head>


<body>


<div class="ticket">


    <div class="ticket-header">

        <div class="brand">

            <div class="logo">
                ✈
            </div>

            <div>

                <h1>
                    AirFlow
                </h1>

                <span>
                    Airline Booking System
                </span>

            </div>

        </div>


        <div class="ticket-title">

            <strong>
                E-TICKET
            </strong>

            <span>
                Passenger Itinerary
            </span>

        </div>

    </div>



    <div class="pnr-section">

        <div>

            <span class="pnr">
                Booking ID
            </span>

            <strong class="pnr">
                ${escapeHTML(
                    booking.booking_id
                )}
            </strong>

        </div>


        <div>

            <span class="pnr">
                PNR
            </span>

            <strong class="pnr">
                ${escapeHTML(
                    booking.pnr ||
                        "-"
                )}
            </strong>

        </div>


        <div>

            <span class="status">
                ${escapeHTML(
                    booking.status ||
                        "Confirmed"
                )}
            </span>

        </div>

    </div>



    <div class="route">

        <div class="airport">

            <div class="airport-code">
                ${escapeHTML(
                    route.from ||
                        "---"
                )}
            </div>

            <div class="airport-name">
                Departure
            </div>

        </div>


        <div class="flight-line">

            ✈

            <span class="flight-number">
                ${escapeHTML(
                    booking.flight_number ||
                        "Flight"
                )}
            </span>

        </div>


        <div class="airport">

            <div class="airport-code">
                ${escapeHTML(
                    route.to ||
                        "---"
                )}
            </div>

            <div class="airport-name">
                Arrival
            </div>

        </div>

    </div>



    <div class="details">


        <div class="detail">

            <span>
                Airline
            </span>

            <strong>
                ${escapeHTML(
                    booking.airline ||
                        "-"
                )}
            </strong>

        </div>


        <div class="detail">

            <span>
                Travel Date
            </span>

            <strong>
                ${formatDate(
                    booking.travel_date
                )}
            </strong>

        </div>


        <div class="detail">

            <span>
                Cabin
            </span>

            <strong>
                ${escapeHTML(
                    booking.cabin_class ||
                        "-"
                )}
            </strong>

        </div>


        <div class="detail">

            <span>
                Passengers
            </span>

            <strong>
                ${numberValue(
                    booking.passengers,
                    1
                )}
            </strong>

        </div>

    </div>



    <div class="passenger">

        <span>
            Passenger Name
        </span>

        <strong>
            ${escapeHTML(
                booking.passenger ||
                    "-"
            )}
        </strong>

    </div>



    <div class="footer">

        <span>
            Issued by AirFlow
        </span>

        <span>
            Booking ID:
            ${escapeHTML(
                booking.booking_id
            )}
        </span>

    </div>

</div>



<div class="actions">

    <button onclick="window.print()">
        🖨 Print E-Ticket
    </button>

    <button onclick="window.close()">
        Close
    </button>

</div>


</body>

</html>

`;
}


/* =========================================================
   =========================================================
   CUSTOMER INVOICE
   =========================================================
========================================================= */

function openInvoice(
    bookingId
) {

    const booking =
        bookings.find(
            item =>
                item.booking_id ===
                bookingId
        );

    if (!booking) {

        showToast(
            "Booking not found",
            "error"
        );

        return;
    }

    const invoiceWindow =
        window.open(
            "",
            "_blank",
            "width=950,height=850"
        );

    if (!invoiceWindow) {

        showToast(
            "Please allow pop-ups to open the invoice",
            "warning"
        );

        return;
    }

    invoiceWindow.document.open();

    invoiceWindow.document.write(
        buildInvoiceHTML(
            booking
        )
    );

    invoiceWindow.document.close();
}


function buildInvoiceHTML(
    booking
) {

    const invoiceNumber =
        `INV-${booking.booking_id}`;

    const route =
        splitRoute(
            booking.route
        );

    const selling =
        numberValue(
            booking.selling_price
        );

    const paid =
        numberValue(
            booking.amount_paid
        );

    const balance =
        Math.max(
            selling -
                paid,
            0
        );

    const issueDate =
        new Date()
            .toLocaleDateString(
                "en-US",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );

    return `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    AirFlow Invoice - ${escapeHTML(
        invoiceNumber
    )}
</title>


<style>

* {
    box-sizing: border-box;
}


body {

    margin: 0;

    padding: 40px;

    background: #f4f6f8;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    color: #101828;
}


.invoice {

    max-width: 850px;

    margin: auto;

    background: white;

    padding: 45px;

    border-radius: 18px;

    box-shadow:
        0 15px 45px
        rgba(16,24,40,0.10);
}


.header {

    display: flex;

    justify-content: space-between;

    align-items: flex-start;

    padding-bottom: 30px;

    border-bottom:
        2px solid #101828;
}


.brand {

    display: flex;

    align-items: center;

    gap: 12px;
}


.logo {

    width: 46px;

    height: 46px;

    background: #101828;

    color: white;

    border-radius: 11px;

    display: flex;

    align-items: center;

    justify-content: center;

    font-size: 23px;
}


.brand h1 {

    margin: 0;

    font-size: 26px;
}


.brand span {

    color: #667085;

    font-size: 12px;
}


.invoice-title {

    text-align: right;
}


.invoice-title h2 {

    margin: 0;

    font-size: 28px;
}


.invoice-title span {

    color: #667085;

    font-size: 12px;
}


.meta {

    display: flex;

    justify-content: space-between;

    padding: 25px 0;

    border-bottom:
        1px solid #eaecf0;
}


.meta-item span {

    display: block;

    color: #667085;

    font-size: 11px;

    text-transform: uppercase;

    margin-bottom: 6px;
}


.meta-item strong {

    font-size: 14px;
}


.customer {

    margin-top: 28px;

    padding: 20px;

    background: #f8fafc;

    border-radius: 12px;
}


.customer-label {

    font-size: 11px;

    color: #667085;

    text-transform: uppercase;

    margin-bottom: 7px;
}


.customer-name {

    font-size: 18px;

    font-weight: 700;
}


.customer-contact {

    color: #667085;

    font-size: 13px;

    margin-top: 6px;
}


table {

    width: 100%;

    border-collapse: collapse;

    margin-top: 30px;
}


th {

    text-align: left;

    background: #f8fafc;

    padding: 13px;

    font-size: 11px;

    text-transform: uppercase;

    color: #667085;
}


td {

    padding: 16px 13px;

    border-bottom:
        1px solid #eaecf0;

    font-size: 13px;
}


.amount {

    text-align: right;
}


.total-area {

    margin-top: 25px;

    margin-left: auto;

    width: 300px;
}


.total-row {

    display: flex;

    justify-content: space-between;

    padding: 8px 0;

    font-size: 14px;
}


.total-row.final {

    margin-top: 8px;

    padding-top: 15px;

    border-top:
        2px solid #101828;

    font-size: 19px;

    font-weight: 800;
}


.paid {

    color: #027a48;
}


.balance {

    color: #b54708;
}


.payment {

    margin-top: 25px;

    padding: 15px;

    border-radius: 10px;

    background: #ecfdf3;

    color: #027a48;

    font-weight: 600;

    font-size: 13px;
}


.notes {

    margin-top: 35px;

    padding-top: 20px;

    border-top:
        1px solid #eaecf0;

    color: #667085;

    font-size: 11px;

    line-height: 1.6;
}


.actions {

    max-width: 850px;

    margin: 20px auto 0;

    display: flex;

    justify-content: center;

    gap: 10px;
}


button {

    border: 0;

    padding: 12px 22px;

    border-radius: 9px;

    cursor: pointer;

    background: #101828;

    color: white;

    font-weight: 600;
}


@media print {

    body {

        padding: 0;

        background: white;
    }


    .invoice {

        box-shadow: none;

        border-radius: 0;

        max-width: none;
    }


    .actions {

        display: none;
    }

}

</style>

</head>


<body>


<div class="invoice">


    <div class="header">

        <div class="brand">

            <div class="logo">
                ✈
            </div>

            <div>

                <h1>
                    AirFlow
                </h1>

                <span>
                    Airline Booking System
                </span>

            </div>

        </div>


        <div class="invoice-title">

            <h2>
                INVOICE
            </h2>

            <span>
                Customer Copy
            </span>

        </div>

    </div>



    <div class="meta">


        <div class="meta-item">

            <span>
                Invoice Number
            </span>

            <strong>
                ${escapeHTML(
                    invoiceNumber
                )}
            </strong>

        </div>


        <div class="meta-item">

            <span>
                Booking ID
            </span>

            <strong>
                ${escapeHTML(
                    booking.booking_id
                )}
            </strong>

        </div>


        <div class="meta-item">

            <span>
                PNR
            </span>

            <strong>
                ${escapeHTML(
                    booking.pnr ||
                        "-"
                )}
            </strong>

        </div>


        <div class="meta-item">

            <span>
                Invoice Date
            </span>

            <strong>
                ${issueDate}
            </strong>

        </div>

    </div>



    <div class="customer">

        <div class="customer-label">
            Billed To
        </div>

        <div class="customer-name">
            ${escapeHTML(
                booking.passenger ||
                    "-"
            )}
        </div>

        <div class="customer-contact">

            ${escapeHTML(
                booking.phone ||
                    ""
            )}

            ${
                booking.email
                    ? `
                        &nbsp; • &nbsp;
                        ${escapeHTML(
                            booking.email
                        )}
                      `
                    : ""
            }

        </div>

    </div>



    <table>

        <thead>

            <tr>

                <th>
                    Description
                </th>

                <th>
                    Travel
                </th>

                <th>
                    Details
                </th>

                <th class="amount">
                    Amount
                </th>

            </tr>

        </thead>


        <tbody>

            <tr>

                <td>

                    <strong>
                        Airline Ticket
                    </strong>

                    <br>

                    <span>
                        ${escapeHTML(
                            booking.airline ||
                                "-"
                        )}
                    </span>

                </td>


                <td>

                    ${escapeHTML(
                        route.from ||
                            "-"
                    )}

                    →

                    ${escapeHTML(
                        route.to ||
                            "-"
                    )}

                    <br>

                    ${formatDate(
                        booking.travel_date
                    )}

                </td>


                <td>

                    ${escapeHTML(
                        booking.flight_number ||
                            "-"
                    )}

                    <br>

                    ${escapeHTML(
                        booking.cabin_class ||
                            "-"
                    )}

                    <br>

                    ${numberValue(
                        booking.passengers,
                        1
                    )}
                    Passenger(s)

                </td>


                <td class="amount">

                    ${formatCurrency(
                        selling
                    )}

                </td>

            </tr>

        </tbody>

    </table>



    <div class="total-area">


        <div class="total-row">

            <span>
                Total
            </span>

            <strong>
                ${formatCurrency(
                    selling
                )}
            </strong>

        </div>


        <div class="total-row paid">

            <span>
                Amount Paid
            </span>

            <strong>
                ${formatCurrency(
                    paid
                )}
            </strong>

        </div>


        <div class="total-row balance">

            <span>
                Balance Due
            </span>

            <strong>
                ${formatCurrency(
                    balance
                )}
            </strong>

        </div>


        <div class="total-row final">

            <span>
                Status
            </span>

            <strong>
                ${escapeHTML(
                    booking.payment_status ||
                        "Unpaid"
                )}
            </strong>

        </div>

    </div>



    <div class="payment">

        Payment Status:
        ${escapeHTML(
            booking.payment_status ||
                "Unpaid"
        )}

    </div>



    <div class="notes">

        <strong>
            Important:
        </strong>

        This invoice is a customer payment document
        generated by AirFlow. Internal airline cost
        and company profit are not displayed.

        <br><br>

        Please retain this invoice with your travel
        documents and booking confirmation.

    </div>

</div>



<div class="actions">

    <button onclick="window.print()">
        🖨 Print Invoice
    </button>

    <button onclick="window.close()">
        Close
    </button>

</div>


</body>

</html>

`;
}


/* =========================================================
   PAYMENT STATUS
========================================================= */

function getPaymentStatus(
    selling,
    paid
) {

    if (
        selling <= 0 ||
        paid <= 0
    ) {

        return "Unpaid";
    }

    if (
        paid >= selling
    ) {

        return "Paid";
    }

    return "Partial";
}


/* =========================================================
   BADGES
========================================================= */

function statusBadge(
    status
) {

    const value =
        status ||
        "Pending";

    const className =
        value
            .toLowerCase()
            .replace(
                /\s+/g,
                "-"
            );

    return `
        <span class="status ${className}">
            ${escapeHTML(
                value
            )}
        </span>
    `;
}


function paymentBadge(
    status
) {

    const value =
        status ||
        "Unpaid";

    const className =
        value
            .toLowerCase()
            .replace(
                /\s+/g,
                "-"
            );

    return `
        <span class="payment-status ${className}">
            ${escapeHTML(
                value
            )}
        </span>
    `;
}


/* =========================================================
   UTILITIES
========================================================= */

function formatCurrency(
    value
) {

    const number =
        numberValue(
            value
        );

    return (
        "$" +
        number.toLocaleString(
            "en-US",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )
    );
}


function formatDate(
    value
) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(
            `${value}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return escapeHTML(
            value
        );
    }

    return date.toLocaleDateString(
        "en-US",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function getLocalDate() {

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-${day}`;
}


function setMinimumTravelDate() {

    const input =
        document.getElementById(
            "travelDate"
        );

    if (input) {

        input.min =
            getLocalDate();
    }

    const editInput =
        document.getElementById(
            "editTravelDate"
        );

    if (editInput) {

        editInput.min =
            getLocalDate();
    }
}


function getValue(
    id
) {

    const element =
        document.getElementById(
            id
        );

    if (!element) {
        return "";
    }

    return element.value.trim();
}


function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (!element) {
        return;
    }

    element.value =
        value === undefined ||
        value === null
            ? ""
            : value;
}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (element) {

        element.textContent =
            value;
    }
}


function numberValue(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(
        number
    )
        ? number
        : fallback;
}


function splitRoute(
    route
) {

    if (!route) {

        return {
            from: "",
            to: ""
        };
    }

    const parts =
        route.split(
            "→"
        );

    if (parts.length < 2) {

        const alternative =
            route.split(
                "->"
            );

        return {

            from:
                (
                    alternative[0] ||
                    ""
                ).trim(),

            to:
                (
                    alternative[1] ||
                    ""
                ).trim()
        };
    }

    return {

        from:
            (
                parts[0] ||
                ""
            ).trim(),

        to:
            (
                parts[1] ||
                ""
            ).trim()
    };
}


function setFormLoading(
    loading,
    buttonId,
    text
) {

    const button =
        document.getElementById(
            buttonId
        );

    if (!button) return;

    if (loading) {

        button.disabled =
            true;

        button.innerHTML =
            `<span class="spinner"></span>${escapeHTML(
                text
            )}`;

    } else {

        button.disabled =
            false;

        button.textContent =
            text;
    }
}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "success"
) {

    const container =
        document.getElementById(
            "toastContainer"
        );

    if (!container) return;

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast ${type}`;

    toast.textContent =
        message;

    container.appendChild(
        toast
    );

    setTimeout(
        () => {

            toast.style.opacity =
                "0";

            toast.style.transform =
                "translateY(10px)";

            setTimeout(
                () => {
                    toast.remove();
                },
                250
            );

        },
        3500
    );
}


/* =========================================================
   HTML SECURITY
========================================================= */

function escapeHTML(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


function safeAttribute(
    value
) {

    return String(
        value || ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );
}


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            closeBookingDetails();

            closeEditBooking();

            closeConfirmModal();
        }
    }
);
/* =========================================================
   =========================================================
   FINANCE DASHBOARD
   =========================================================
   LIVE FINANCIAL REPORTING FROM BOOKINGS
========================================================= */


/* =========================================================
   FINANCE INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupFinanceDashboard();

    }
);


/* =========================================================
   CREATE FINANCE MENU + VIEW
========================================================= */

function setupFinanceDashboard() {

    createFinanceMenu();

    createFinanceView();

    renderFinanceDashboard();

}


/* =========================================================
   FINANCE MENU
========================================================= */

function createFinanceMenu() {

    const sidebarMenu =
        document.querySelector(
            ".sidebar-menu"
        );

    if (!sidebarMenu) return;

    if (
        document.getElementById(
            "financeMenu"
        )
    ) {
        return;
    }

    const menu =
        document.createElement(
            "div"
        );

    menu.id =
        "financeMenu";

    menu.className =
        "menu-item";

    menu.innerHTML = `
        <span class="menu-icon">💰</span>
        <span>Finance</span>
    `;

    menu.onclick =
        showFinanceDashboard;

    /*
        Put Finance after Booking Management
        when possible.
    */

    const bookingsMenu =
        document.getElementById(
            "bookingsMenu"
        );

    if (
        bookingsMenu &&
        bookingsMenu.parentNode ===
            sidebarMenu
    ) {

        bookingsMenu.insertAdjacentElement(
            "afterend",
            menu
        );

    } else {

        sidebarMenu.appendChild(
            menu
        );
    }


    /*
        When another menu item is clicked,
        hide Finance view.
    */

    sidebarMenu
        .querySelectorAll(
            ".menu-item"
        )
        .forEach(
            item => {

                if (
                    item.id ===
                    "financeMenu"
                ) {
                    return;
                }

                item.addEventListener(
                    "click",
                    () => {

                        const financeView =
                            document.getElementById(
                                "financeView"
                            );

                        if (
                            financeView
                        ) {

                            financeView.classList.add(
                                "hidden"
                            );
                        }

                    }
                );

            }
        );
}


/* =========================================================
   CREATE FINANCE VIEW
========================================================= */

function createFinanceView() {

    if (
        document.getElementById(
            "financeView"
        )
    ) {
        return;
    }

    const main =
        document.querySelector(
            ".main"
        );

    if (!main) return;

    const view =
        document.createElement(
            "section"
        );

    view.id =
        "financeView";

    view.className =
        "content-view finance-view hidden";


    view.innerHTML = `

        <div class="finance-header">

            <div>

                <span class="finance-eyebrow">
                    FINANCIAL OVERVIEW
                </span>

                <h1>
                    Finance Dashboard
                </h1>

                <p>
                    Track sales, costs, profit,
                    collections and outstanding balances.
                </p>

            </div>


            <div class="finance-date">

                <span>
                    Report Date
                </span>

                <strong id="financeReportDate">
                    -
                </strong>

            </div>

        </div>


        <div class="finance-cards">


            <!-- TOTAL SALES -->

            <div class="finance-card sales-card">

                <div class="finance-card-top">

                    <div class="finance-card-icon">
                        💰
                    </div>

                    <span>
                        TOTAL SALES
                    </span>

                </div>

                <strong
                    id="financeTotalSales"
                    class="finance-card-value"
                >
                    $0.00
                </strong>

                <small>
                    Active bookings
                </small>

            </div>


            <!-- TOTAL COST -->

            <div class="finance-card cost-card">

                <div class="finance-card-top">

                    <div class="finance-card-icon">
                        💳
                    </div>

                    <span>
                        TOTAL COST
                    </span>

                </div>

                <strong
                    id="financeTotalCost"
                    class="finance-card-value"
                >
                    $0.00
                </strong>

                <small>
                    Airline / ticket cost
                </small>

            </div>


            <!-- TOTAL PROFIT -->

            <div class="finance-card profit-card">

                <div class="finance-card-top">

                    <div class="finance-card-icon">
                        📈
                    </div>

                    <span>
                        TOTAL PROFIT
                    </span>

                </div>

                <strong
                    id="financeTotalProfit"
                    class="finance-card-value"
                >
                    $0.00
                </strong>

                <small>
                    Gross booking profit
                </small>

            </div>


            <!-- COLLECTED -->

            <div class="finance-card collected-card">

                <div class="finance-card-top">

                    <div class="finance-card-icon">
                        ✅
                    </div>

                    <span>
                        COLLECTED
                    </span>

                </div>

                <strong
                    id="financeTotalCollected"
                    class="finance-card-value"
                >
                    $0.00
                </strong>

                <small>
                    Customer payments received
                </small>

            </div>


            <!-- OUTSTANDING -->

            <div class="finance-card outstanding-card">

                <div class="finance-card-top">

                    <div class="finance-card-icon">
                        ⏳
                    </div>

                    <span>
                        OUTSTANDING
                    </span>

                </div>

                <strong
                    id="financeTotalOutstanding"
                    class="finance-card-value"
                >
                    $0.00
                </strong>

                <small>
                    Customer balances due
                </small>

            </div>


            <!-- PROFIT MARGIN -->

            <div class="finance-card margin-card">

                <div class="finance-card-top">

                    <div class="finance-card-icon">
                        📊
                    </div>

                    <span>
                        PROFIT MARGIN
                    </span>

                </div>

                <strong
                    id="financeProfitMargin"
                    class="finance-card-value"
                >
                    0.00%
                </strong>

                <small>
                    Profit ÷ sales
                </small>

            </div>

        </div>


        <!-- =================================================
             PERIOD SUMMARY
        ================================================= -->

        <div class="finance-period-grid">


            <div class="finance-period-card">

                <div class="finance-period-icon">
                    📅
                </div>

                <div>

                    <span>
                        TODAY'S SALES
                    </span>

                    <strong
                        id="financeTodaySales"
                    >
                        $0.00
                    </strong>

                </div>

            </div>


            <div class="finance-period-card">

                <div class="finance-period-icon">
                    📆
                </div>

                <div>

                    <span>
                        THIS MONTH
                    </span>

                    <strong
                        id="financeMonthSales"
                    >
                        $0.00
                    </strong>

                </div>

            </div>


            <div class="finance-period-card">

                <div class="finance-period-icon">
                    🧾
                </div>

                <div>

                    <span>
                        AVERAGE BOOKING
                    </span>

                    <strong
                        id="financeAverageBooking"
                    >
                        $0.00
                    </strong>

                </div>

            </div>


            <div class="finance-period-card">

                <div class="finance-period-icon">
                    👥
                </div>

                <div>

                    <span>
                        ACTIVE BOOKINGS
                    </span>

                    <strong
                        id="financeActiveBookings"
                    >
                        0
                    </strong>

                </div>

            </div>

        </div>


        <!-- =================================================
             PAYMENT SUMMARY
        ================================================= -->

        <div class="finance-two-column">


            <div class="finance-panel">

                <div class="finance-panel-header">

                    <div>

                        <h2>
                            Payment Summary
                        </h2>

                        <span>
                            Current customer payment status
                        </span>

                    </div>

                </div>


                <div class="payment-summary-grid">


                    <div class="payment-summary-item paid">

                        <div class="payment-summary-icon">
                            ✓
                        </div>

                        <div>

                            <span>
                                PAID
                            </span>

                            <strong
                                id="financePaidCount"
                            >
                                0
                            </strong>

                            <small
                                id="financePaidAmount"
                            >
                                $0.00
                            </small>

                        </div>

                    </div>


                    <div class="payment-summary-item partial">

                        <div class="payment-summary-icon">
                            ◐
                        </div>

                        <div>

                            <span>
                                PARTIAL
                            </span>

                            <strong
                                id="financePartialCount"
                            >
                                0
                            </strong>

                            <small
                                id="financePartialAmount"
                            >
                                $0.00
                            </small>

                        </div>

                    </div>


                    <div class="payment-summary-item unpaid">

                        <div class="payment-summary-icon">
                            !
                        </div>

                        <div>

                            <span>
                                UNPAID
                            </span>

                            <strong
                                id="financeUnpaidCount"
                            >
                                0
                            </strong>

                            <small
                                id="financeUnpaidAmount"
                            >
                                $0.00
                            </small>

                        </div>

                    </div>

                </div>

            </div>


            <!-- PROFIT OVERVIEW -->

            <div class="finance-panel">

                <div class="finance-panel-header">

                    <div>

                        <h2>
                            Profit Overview
                        </h2>

                        <span>
                            Sales compared with ticket cost
                        </span>

                    </div>

                </div>


                <div class="finance-profit-overview">


                    <div class="profit-overview-row">

                        <span>
                            Sales
                        </span>

                        <strong
                            id="financeOverviewSales"
                        >
                            $0.00
                        </strong>

                    </div>


                    <div class="profit-overview-row">

                        <span>
                            Airline Cost
                        </span>

                        <strong
                            id="financeOverviewCost"
                        >
                            $0.00
                        </strong>

                    </div>


                    <div class="profit-overview-row profit-row">

                        <span>
                            Net Profit
                        </span>

                        <strong
                            id="financeOverviewProfit"
                        >
                            $0.00
                        </strong>

                    </div>


                    <div class="profit-overview-bar">

                        <div
                            id="financeProfitBar"
                            class="finance-profit-bar-fill"
                        ></div>

                    </div>


                    <div class="profit-overview-footer">

                        <span>
                            Profit margin
                        </span>

                        <strong
                            id="financeOverviewMargin"
                        >
                            0.00%
                        </strong>

                    </div>

                </div>

            </div>

        </div>


        <!-- =================================================
             RECENT FINANCIAL ACTIVITY
        ================================================= -->

        <div class="finance-panel finance-activity-panel">

            <div class="finance-panel-header">

                <div>

                    <h2>
                        Recent Financial Activity
                    </h2>

                    <span>
                        Latest bookings and financial transactions
                    </span>

                </div>

                <div
                    id="financeActivityCount"
                    class="finance-results-count"
                >
                    0 records
                </div>

            </div>


            <div class="finance-table-wrapper">

                <table class="finance-table">

                    <thead>

                        <tr>

                            <th>
                                Booking
                            </th>

                            <th>
                                Passenger
                            </th>

                            <th>
                                Travel
                            </th>

                            <th>
                                Sales
                            </th>

                            <th>
                                Cost
                            </th>

                            <th>
                                Profit
                            </th>

                            <th>
                                Paid
                            </th>

                            <th>
                                Balance
                            </th>

                            <th>
                                Payment
                            </th>

                        </tr>

                    </thead>


                    <tbody
                        id="financeActivityBody"
                    >

                        <tr class="empty">

                            <td colspan="9">
                                No financial activity found
                            </td>

                        </tr>

                    </tbody>

                </table>

            </div>

        </div>

    `;


    /*
        Add Finance view after existing content.
    */

    main.appendChild(
        view
    );
}


/* =========================================================
   SHOW FINANCE DASHBOARD
========================================================= */

function showFinanceDashboard() {

    hideAllViews();

    const financeView =
        document.getElementById(
            "financeView"
        );

    if (!financeView) {

        createFinanceView();
    }


    const view =
        document.getElementById(
            "financeView"
        );

    if (view) {

        view.classList.remove(
            "hidden"
        );
    }


    setActiveMenu(
        "financeMenu"
    );


    renderFinanceDashboard();


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   FINANCE DATA HELPERS
========================================================= */

function getFinanceCreatedDate(
    booking
) {

    if (!booking) {
        return null;
    }

    const value =
        booking.created_at ||
        booking.createdAt ||
        booking.created ||
        booking.date_created ||
        booking.created_on ||
        null;

    if (!value) {
        return null;
    }

    let date;

    /*
        SQLite commonly returns:
        YYYY-MM-DD HH:mm:ss

        Convert it safely for browser parsing.
    */

    if (
        typeof value ===
            "string" &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
            value
        )
    ) {

        date =
            new Date(
                value.replace(
                    " ",
                    "T"
                )
            );

    } else {

        date =
            new Date(
                value
            );
    }

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;
    }

    return date;
}


function getFinanceSale(
    booking
) {

    return numberValue(
        booking?.selling_price
    );
}


function getFinanceCost(
    booking
) {

    return numberValue(
        booking?.cost_price
    );
}


function getFinancePaid(
    booking
) {

    return Math.max(
        numberValue(
            booking?.amount_paid
        ),
        0
    );
}


function getFinanceProfit(
    booking
) {

    const explicitProfit =
        Number(
            booking?.profit
        );

    if (
        Number.isFinite(
            explicitProfit
        )
    ) {

        return explicitProfit;
    }

    return (
        getFinanceSale(
            booking
        ) -
        getFinanceCost(
            booking
        )
    );
}


function getFinanceBalance(
    booking
) {

    const sale =
        getFinanceSale(
            booking
        );

    const paid =
        getFinancePaid(
            booking
        );

    const explicitBalance =
        Number(
            booking?.balance
        );

    if (
        Number.isFinite(
            explicitBalance
        )
    ) {

        return Math.max(
            explicitBalance,
            0
        );
    }

    return Math.max(
        sale -
            paid,
        0
    );
}


function getFinancePaymentStatus(
    booking
) {

    const explicit =
        String(
            booking?.payment_status ||
                ""
        )
        .trim()
        .toLowerCase();


    if (
        explicit ===
            "paid"
    ) {

        return "Paid";
    }


    if (
        explicit ===
            "partial"
    ) {

        return "Partial";
    }


    if (
        explicit ===
            "unpaid"
    ) {

        return "Unpaid";
    }


    return getPaymentStatus(
        getFinanceSale(
            booking
        ),
        getFinancePaid(
            booking
        )
    );
}


/* =========================================================
   FINANCE DASHBOARD RENDER
========================================================= */

function renderFinanceDashboard() {

    const financeView =
        document.getElementById(
            "financeView"
        );

    /*
        Finance view may not exist yet.
        This is normal during initial socket load.
    */

    if (!financeView) {
        return;
    }


    /*
        Cancelled bookings are excluded
        from financial totals.
    */

    const activeBookings =
        bookings.filter(
            booking =>
                booking &&
                booking.status !==
                    "Cancelled"
        );


    /* =====================================================
       TOTALS
    ===================================================== */

    const totalSales =
        activeBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                getFinanceSale(
                    booking
                ),
            0
        );


    const totalCost =
        activeBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                getFinanceCost(
                    booking
                ),
            0
        );


    const totalProfit =
        activeBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                getFinanceProfit(
                    booking
                ),
            0
        );


    const totalCollected =
        activeBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                getFinancePaid(
                    booking
                ),
            0
        );


    const totalOutstanding =
        activeBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                getFinanceBalance(
                    booking
                ),
            0
        );


    const activeCount =
        activeBookings.length;


    const profitMargin =
        totalSales > 0
            ? (
                totalProfit /
                totalSales
            ) * 100
            : 0;


    const averageBooking =
        activeCount > 0
            ? (
                totalSales /
                activeCount
            )
            : 0;


    /* =====================================================
       TODAY / MONTH
    ===================================================== */

    const now =
        new Date();

    const todayYear =
        now.getFullYear();

    const todayMonth =
        now.getMonth();

    const todayDay =
        now.getDate();


    let todaySales = 0;

    let monthSales = 0;


    activeBookings.forEach(
        booking => {

            const createdDate =
                getFinanceCreatedDate(
                    booking
                );

            if (!createdDate) {
                return;
            }


            const sameYear =
                createdDate.getFullYear() ===
                todayYear;


            const sameMonth =
                createdDate.getMonth() ===
                todayMonth;


            const sameDay =
                createdDate.getDate() ===
                todayDay;


            if (
                sameYear &&
                sameMonth
            ) {

                monthSales +=
                    getFinanceSale(
                        booking
                    );
            }


            if (
                sameYear &&
                sameMonth &&
                sameDay
            ) {

                todaySales +=
                    getFinanceSale(
                        booking
                    );
            }

        }
    );


    /* =====================================================
       PAYMENT BREAKDOWN
    ===================================================== */

    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    let paidAmount = 0;
    let partialAmount = 0;
    let unpaidAmount = 0;


    activeBookings.forEach(
        booking => {

            const status =
                getFinancePaymentStatus(
                    booking
                );

            const sale =
                getFinanceSale(
                    booking
                );


            if (
                status ===
                "Paid"
            ) {

                paidCount++;

                paidAmount +=
                    sale;

            } else if (
                status ===
                "Partial"
            ) {

                partialCount++;

                partialAmount +=
                    getFinancePaid(
                        booking
                    );

            } else {

                unpaidCount++;

                unpaidAmount +=
                    sale;

            }

        }
    );


    /* =====================================================
       UPDATE CARDS
    ===================================================== */

    setText(
        "financeTotalSales",
        formatCurrency(
            totalSales
        )
    );


    setText(
        "financeTotalCost",
        formatCurrency(
            totalCost
        )
    );


    setText(
        "financeTotalProfit",
        formatCurrency(
            totalProfit
        )
    );


    setText(
        "financeTotalCollected",
        formatCurrency(
            totalCollected
        )
    );


    setText(
        "financeTotalOutstanding",
        formatCurrency(
            totalOutstanding
        )
    );


    setText(
        "financeProfitMargin",
        `${profitMargin.toFixed(
            2
        )}%`
    );


    setText(
        "financeTodaySales",
        formatCurrency(
            todaySales
        )
    );


    setText(
        "financeMonthSales",
        formatCurrency(
            monthSales
        )
    );


    setText(
        "financeAverageBooking",
        formatCurrency(
            averageBooking
        )
    );


    setText(
        "financeActiveBookings",
        activeCount
    );


    /* =====================================================
       REPORT DATE
    ===================================================== */

    const reportDate =
        now.toLocaleDateString(
            "en-US",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );


    setText(
        "financeReportDate",
        reportDate
    );


    /* =====================================================
       PAYMENT SUMMARY
    ===================================================== */

    setText(
        "financePaidCount",
        paidCount
    );


    setText(
        "financePartialCount",
        partialCount
    );


    setText(
        "financeUnpaidCount",
        unpaidCount
    );


    setText(
        "financePaidAmount",
        formatCurrency(
            paidAmount
        )
    );


    setText(
        "financePartialAmount",
        formatCurrency(
            partialAmount
        )
    );


    setText(
        "financeUnpaidAmount",
        formatCurrency(
            unpaidAmount
        )
    );


    /* =====================================================
       PROFIT OVERVIEW
    ===================================================== */

    setText(
        "financeOverviewSales",
        formatCurrency(
            totalSales
        )
    );


    setText(
        "financeOverviewCost",
        formatCurrency(
            totalCost
        )
    );


    setText(
        "financeOverviewProfit",
        formatCurrency(
            totalProfit
        )
    );


    setText(
        "financeOverviewMargin",
        `${profitMargin.toFixed(
            2
        )}%`
    );


    const profitBar =
        document.getElementById(
            "financeProfitBar"
        );


    if (profitBar) {

        const barWidth =
            Math.min(
                Math.max(
                    profitMargin,
                    0
                ),
                100
            );

        profitBar.style.width =
            `${barWidth}%`;
    }


    /* =====================================================
       RECENT ACTIVITY
    ===================================================== */

    renderFinanceActivity(
        activeBookings
    );
}


/* =========================================================
   FINANCE ACTIVITY TABLE
========================================================= */

function renderFinanceActivity(
    activeBookings
) {

    const tbody =
        document.getElementById(
            "financeActivityBody"
        );

    if (!tbody) {
        return;
    }


    const sorted =
        [...activeBookings]
            .sort(
                (
                    a,
                    b
                ) => {

                    const dateA =
                        getFinanceCreatedDate(
                            a
                        );

                    const dateB =
                        getFinanceCreatedDate(
                            b
                        );


                    if (
                        dateA &&
                        dateB
                    ) {

                        return (
                            dateB.getTime() -
                            dateA.getTime()
                        );
                    }


                    return 0;
                }
            )
            .slice(
                0,
                15
            );


    setText(
        "financeActivityCount",
        `${sorted.length} ${
            sorted.length === 1
                ? "record"
                : "records"
        }`
    );


    if (!sorted.length) {

        tbody.innerHTML = `
            <tr class="empty">
                <td colspan="9">
                    No financial activity found
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        sorted
            .map(
                booking => {

                    const sale =
                        getFinanceSale(
                            booking
                        );

                    const cost =
                        getFinanceCost(
                            booking
                        );

                    const profit =
                        getFinanceProfit(
                            booking
                        );

                    const paid =
                        getFinancePaid(
                            booking
                        );

                    const balance =
                        getFinanceBalance(
                            booking
                        );

                    const paymentStatus =
                        getFinancePaymentStatus(
                            booking
                        );


                    return `

                        <tr>

                            <td>

                                <span class="booking-id">
                                    ${escapeHTML(
                                        booking.booking_id ||
                                            "-"
                                    )}
                                </span>

                                ${
                                    booking.pnr
                                        ? `
                                            <small class="finance-pnr">
                                                PNR:
                                                ${escapeHTML(
                                                    booking.pnr
                                                )}
                                            </small>
                                          `
                                        : ""
                                }

                            </td>


                            <td>

                                <span class="passenger-name">
                                    ${escapeHTML(
                                        booking.passenger ||
                                            "-"
                                    )}
                                </span>

                            </td>


                            <td>

                                ${formatDate(
                                    booking.travel_date
                                )}

                            </td>


                            <td>

                                <span class="finance-money">
                                    ${formatCurrency(
                                        sale
                                    )}
                                </span>

                            </td>


                            <td>

                                <span class="finance-money cost">
                                    ${formatCurrency(
                                        cost
                                    )}
                                </span>

                            </td>


                            <td>

                                <span class="finance-money profit">
                                    ${formatCurrency(
                                        profit
                                    )}
                                </span>

                            </td>


                            <td>

                                <span class="finance-money paid">
                                    ${formatCurrency(
                                        paid
                                    )}
                                </span>

                            </td>


                            <td>

                                <span class="finance-money balance">
                                    ${formatCurrency(
                                        balance
                                    )}
                                </span>

                            </td>


                            <td>

                                ${paymentBadge(
                                    paymentStatus
                                )}

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");
}


/* =========================================================
   REFRESH FINANCE AFTER BOOKING EVENTS
========================================================= */

socket.on(
    "bookings",
    () => {

        /*
            The original bookings listener
            updates the global bookings array.
            This listener runs after it and refreshes Finance.
        */

        renderFinanceDashboard();

    }
);


socket.on(
    "newBooking",
    () => {

        renderFinanceDashboard();

    }
);


socket.on(
    "bookingUpdated",
    () => {

        renderFinanceDashboard();

    }
);


socket.on(
    "bookingDeleted",
    () => {

        renderFinanceDashboard();

    }
);


/* =========================================================
   REFRESH FINANCE WHEN DASHBOARD DATA LOADS
========================================================= */

const originalLoadBookings =
    loadBookings;


/*
    Keep original loading behavior.
    Finance is refreshed after bookings arrive.
*/

loadBookings =
    async function () {

        await originalLoadBookings();

        renderFinanceDashboard();

    };


/* =========================================================
   FINANCE AUTO REFRESH
========================================================= */

/*
    Refresh periodically so the Finance Dashboard
    stays current even if another part of the app
    changes booking data.
*/

setInterval(
    () => {

        if (
            document.getElementById(
                "financeView"
            )
        ) {

            renderFinanceDashboard();

        }

    },
    5000
);/* =========================================================
   CUSTOMER MANAGEMENT
========================================================= */

let customers = [];
let selectedCustomer = null;


/* =========================================================
   SHOW CUSTOMER MANAGEMENT
========================================================= */

function showCustomerManagement() {

    hideAllViews();

    const view =
        document.getElementById(
            "customerManagementView"
        );

    if (view) {
        view.classList.remove(
            "hidden"
        );
    }

    setActiveMenu(
        "customersMenu"
    );

    loadCustomers();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   LOAD CUSTOMERS
========================================================= */

async function loadCustomers() {

    try {

        const response =
            await authFetch(
                "/api/customers"
            );

        if (!response.ok) {
            throw new Error(
                "Failed to load customers"
            );
        }

        const data =
            await response.json();

        customers =
            Array.isArray(data)
                ? data
                : [];

        renderCustomerTable();

    } catch (error) {

        console.error(
            "LOAD CUSTOMERS ERROR:",
            error
        );

        showToast(
            "Unable to load customers",
            "error"
        );
    }
}


/* =========================================================
   CUSTOMER TABLE
========================================================= */

function renderCustomerTable() {

    const tbody =
        document.getElementById(
            "customerTableBody"
        );

    if (!tbody) return;


    const searchInput =
        document.getElementById(
            "customerSearch"
        );


    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const filtered =
        customers.filter(
            customer => {

                const searchable = [

                    customer.customer_code,
                    customer.name,
                    customer.phone,
                    customer.email

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                return (
                    !search ||
                    searchable.includes(
                        search
                    )
                );
            }
        );


    const count =
        document.getElementById(
            "customerResultsCount"
        );


    if (count) {

        count.textContent =
            `${filtered.length} ${
                filtered.length === 1
                    ? "customer"
                    : "customers"
            }`;
    }


    if (!filtered.length) {

        tbody.innerHTML = `
            <tr class="empty">

                <td colspan="6">

                    No customers found

                </td>

            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        filtered
            .map(
                customer => `

                    <tr>

                        <td>
                            <span class="booking-id">
                                ${escapeHTML(
                                    customer.customer_code ||
                                    "-"
                                )}
                            </span>
                        </td>


                        <td>
                            <strong>
                                ${escapeHTML(
                                    customer.name ||
                                    "-"
                                )}
                            </strong>
                        </td>


                        <td>
                            ${escapeHTML(
                                customer.phone ||
                                "-"
                            )}
                        </td>


                        <td>
                            ${escapeHTML(
                                customer.email ||
                                "-"
                            )}
                        </td>


                        <td>
                            ${
                                numberValue(
                                    customer.booking_count,
                                    0
                                )
                            }
                        </td>


                        <td>

                            <div class="action-buttons">

                                <button
                                    class="view-button"
                                    onclick="openCustomerDetails('${safeAttribute(
                                        customer.id
                                    )}')"
                                >
                                    View
                                </button>

                            </div>

                        </td>

                    </tr>

                `
            )
            .join("");
}


/* =========================================================
   CUSTOMER SEARCH
========================================================= */

const customerSearchInput =
    document.getElementById(
        "customerSearch"
    );


if (customerSearchInput) {

    customerSearchInput.addEventListener(
        "input",
        renderCustomerTable
    );
}


/* =========================================================
   OPEN ADD CUSTOMER
========================================================= */

function openAddCustomer() {

    const modal =
        document.getElementById(
            "addCustomerModal"
        );

    if (!modal) return;


    const form =
        document.getElementById(
            "addCustomerForm"
        );

    if (form) {
        form.reset();
    }


    modal.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";
}


/* =========================================================
   CLOSE ADD CUSTOMER
========================================================= */

function closeAddCustomer(
    event
) {

    if (
        event &&
        event.target &&
        event.target.id !==
            "addCustomerModal"
    ) {
        return;
    }


    const modal =
        document.getElementById(
            "addCustomerModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }


    document.body.style.overflow =
        "";
}


/* =========================================================
   ADD CUSTOMER FORM
========================================================= */

const addCustomerForm =
    document.getElementById(
        "addCustomerForm"
    );


if (addCustomerForm) {

    addCustomerForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const name =
                getValue(
                    "addCustomerName"
                );


            const phone =
                getValue(
                    "addCustomerPhone"
                );


            const email =
                getValue(
                    "addCustomerEmail"
                );


            if (!name) {

                showToast(
                    "Customer name is required",
                    "error"
                );

                return;
            }


            try {

                const response =
                    await authFetch(
                        "/api/customers",
                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    name,
                                    phone,
                                    email

                                })

                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.error ||
                        "Failed to create customer"
                    );
                }


                showToast(
                    "Customer created successfully",
                    "success"
                );


                closeAddCustomer();


                await loadCustomers();


            } catch (error) {

                console.error(
                    error
                );


                showToast(
                    error.message ||
                    "Failed to create customer",
                    "error"
                );
            }

        }
    );
}


/* =========================================================
   OPEN CUSTOMER DETAILS
========================================================= */

async function openCustomerDetails(
    customerId
) {

    try {

        const response =
            await authFetch(
                `/api/customers/${encodeURIComponent(
                    customerId
                )}`
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Failed to load customer"
            );
        }


        selectedCustomer =
            result;


        const modal =
            document.getElementById(
                "customerDetailsModal"
            );


        const content =
            document.getElementById(
                "customerDetailsContent"
            );


        if (!modal || !content) {
            return;
        }


        const customer =
            result.customer ||
            result;


        const customerBookings =
            Array.isArray(
                result.bookings
            )
                ? result.bookings
                : [];


        content.innerHTML = `

            <div class="booking-identity">

                <div class="identity-item">

                    <span>
                        Customer ID
                    </span>

                    <strong>
                        ${escapeHTML(
                            customer.customer_code ||
                            "-"
                        )}
                    </strong>

                </div>


                <div class="identity-item">

                    <span>
                        Customer
                    </span>

                    <strong>
                        ${escapeHTML(
                            customer.name ||
                            "-"
                        )}
                    </strong>

                </div>


                <div class="identity-item">

                    <span>
                        Total Bookings
                    </span>

                    <strong>
                        ${customerBookings.length}
                    </strong>

                </div>

            </div>


            <div class="details-body">

                <div class="details-grid">

                    <div class="detail-section">

                        <div class="detail-section-title">
                            Contact Information
                        </div>


                        <div class="detail-list">

                            <div class="detail-row">

                                <span>
                                    Phone
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        customer.phone ||
                                        "-"
                                    )}
                                </strong>

                            </div>


                            <div class="detail-row">

                                <span>
                                    Email
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        customer.email ||
                                        "-"
                                    )}
                                </strong>

                            </div>

                        </div>

                    </div>

                </div>


                <div
                    style="
                        margin-top: 25px;
                    "
                >

                    <h3>
                        Booking History
                    </h3>


                    ${
                        customerBookings.length
                            ? `

                                <div class="table-container">

                                    <table>

                                        <thead>

                                            <tr>

                                                <th>
                                                    Booking ID
                                                </th>

                                                <th>
                                                    PNR
                                                </th>

                                                <th>
                                                    Route
                                                </th>

                                                <th>
                                                    Travel Date
                                                </th>

                                                <th>
                                                    Selling
                                                </th>

                                                <th>
                                                    Status
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            ${
                                                customerBookings
                                                    .map(
                                                        booking => `

                                                            <tr>

                                                                <td>
                                                                    ${escapeHTML(
                                                                        booking.booking_id ||
                                                                        "-"
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    ${escapeHTML(
                                                                        booking.pnr ||
                                                                        "-"
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    ${escapeHTML(
                                                                        booking.route ||
                                                                        "-"
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    ${formatDate(
                                                                        booking.travel_date
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    ${formatCurrency(
                                                                        booking.selling_price
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    ${statusBadge(
                                                                        booking.status
                                                                    )}
                                                                </td>

                                                            </tr>

                                                        `
                                                    )
                                                    .join("")
                                            }

                                        </tbody>

                                    </table>

                                </div>

                            `
                            : `

                                <p
                                    style="
                                        color: #667085;
                                        margin-top: 15px;
                                    "
                                >
                                    No bookings for this customer yet.
                                </p>

                            `
                    }

                </div>

            </div>

        `;


        modal.classList.remove(
            "hidden"
        );


        document.body.style.overflow =
            "hidden";


    } catch (error) {

        console.error(
            error
        );


        showToast(
            error.message ||
            "Unable to load customer",
            "error"
        );
    }
}


/* =========================================================
   CLOSE CUSTOMER DETAILS
========================================================= */

function closeCustomerDetails(
    event
) {

    if (
        event &&
        event.target &&
        event.target.id !==
            "customerDetailsModal"
    ) {
        return;
    }


    const modal =
        document.getElementById(
            "customerDetailsModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }


    document.body.style.overflow =
        "";


    selectedCustomer =
        null;
}/* =========================================================
   =========================================================
   AIRFLOW AUTHENTICATION FRONTEND
   =========================================================
========================================================= */

const AUTH_TOKEN_KEY =
    "airflow_auth_token";

    async function authFetch(url, options = {}) {

    const token =
        localStorage.getItem(
            AUTH_TOKEN_KEY
        );

    const headers = {
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    return fetch(
        url,
        {
            ...options,
            headers
        }
    );
}

let currentUser =
    null;


/* =========================================================
   AUTH TOKEN
========================================================= */

function getAuthToken() {

    return localStorage.getItem(
        AUTH_TOKEN_KEY
    );
}


function saveAuthToken(
    token
) {

    localStorage.setItem(
        AUTH_TOKEN_KEY,
        token
    );
}


function removeAuthToken() {

    localStorage.removeItem(
        AUTH_TOKEN_KEY
    );
}


/* =========================================================
   AUTH FETCH
   Used later for protected booking APIs too.
========================================================= */

async function authauthFetch(
    url,
    options = {}
) {

    const token =
        getAuthToken();


    const headers = {
        ...(options.headers || {})
    };


    if (token) {

        headers.Authorization =
            `Bearer ${token}`;
    }


    return authFetch(
        url,
        {
            ...options,
            headers
        }
    );
}


/* =========================================================
   SHOW LOGIN
========================================================= */

function showLoginScreen() {

    const loginScreen =
        document.getElementById(
            "loginScreen"
        );


    const mainApp =
        document.getElementById(
            "mainApp"
        );


    if (loginScreen) {

        loginScreen.style.display =
            "flex";
    }


    if (mainApp) {

        mainApp.classList.add(
            "auth-locked"
        );
    }


    document.body.style.overflow =
        "hidden";


    setTimeout(
        () => {

            const usernameInput =
                document.getElementById(
                    "loginUsername"
                );


            if (usernameInput) {

                usernameInput.focus();
            }

        },
        100
    );
}


/* =========================================================
   SHOW APPLICATION
========================================================= */

function showAuthenticatedApp(
    user
) {

    currentUser =
        user;


    const loginScreen =
        document.getElementById(
            "loginScreen"
        );


    const mainApp =
        document.getElementById(
            "mainApp"
        );


    if (loginScreen) {

        loginScreen.style.display =
            "none";
    }


    if (mainApp) {

        mainApp.classList.remove(
            "auth-locked"
        );
    }


    document.body.style.overflow =
        "";


    renderAuthUserPanel();
    updateStaffMenuVisibility();
    applyRolePermissions();
}


/* =========================================================
   SIDEBAR USER PANEL
========================================================= */

function renderAuthUserPanel() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    if (
        !sidebar ||
        !currentUser
    ) {

        return;
    }


    const oldPanel =
        document.getElementById(
            "authUserPanel"
        );


    if (oldPanel) {

        oldPanel.remove();
    }


    const panel =
        document.createElement(
            "div"
        );


    panel.id =
        "authUserPanel";


    panel.className =
        "auth-user-panel";


    const displayName =
        String(
            currentUser.name ||
            currentUser.username ||
            "User"
        );


    const firstLetter =
        displayName
            .charAt(0)
            .toUpperCase();


    panel.innerHTML = `

        <div class="auth-user-info">

            <div class="auth-user-avatar">
                ${escapeHTML(
                    firstLetter
                )}
            </div>

            <div class="auth-user-name">

                <strong>
                    ${escapeHTML(
                        displayName
                    )}
                </strong>

                <span class="auth-user-role">
                    ${escapeHTML(
                        currentUser.role ||
                        "worker"
                    )}
                </span>

            </div>

        </div>

        <button
            type="button"
            class="logout-button"
            onclick="logoutAirFlow()"
        >
            ↪ Logout
        </button>

    `;


    const connection =
        sidebar.querySelector(
            ".connection"
        );


    if (connection) {

        sidebar.insertBefore(
            panel,
            connection
        );

    } else {

        sidebar.appendChild(
            panel
        );
    }
}


/* =========================================================
   LOGIN REQUEST
========================================================= */

async function loginAirFlow(
    username,
    password
) {

    const response =
        await fetch(
            "/api/auth/login",
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        username,
                        password
                    })
            }
        );


    const result =
        await response
            .json()
            .catch(
                () => ({})
            );


    if (!response.ok) {

        throw new Error(
            result.error ||
            "Unable to sign in"
        );
    }


    if (
        !result.token ||
        !result.user
    ) {

        throw new Error(
            "Invalid login response"
        );
    }


    saveAuthToken(
        result.token
    );


    showAuthenticatedApp(
        result.user
    );


    return result;
}


/* =========================================================
   CHECK EXISTING LOGIN
========================================================= */

async function restoreAirFlowLogin() {

    const token =
        getAuthToken();


    if (!token) {

        showLoginScreen();

        return;
    }


    try {

        const response =
            await authauthFetch(
                "/api/auth/me"
            );


        if (!response.ok) {

            throw new Error(
                "Session expired"
            );
        }


        const result =
            await response.json();


        if (!result.user) {

            throw new Error(
                "User not found"
            );
        }


        showAuthenticatedApp(
            result.user
        );


    } catch (error) {

        removeAuthToken();

        currentUser =
            null;

        showLoginScreen();
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutAirFlow() {

    try {

        await authauthFetch(
            "/api/auth/logout",
            {
                method:
                    "POST"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );
    }


    removeAuthToken();


    currentUser =
        null;


    const panel =
        document.getElementById(
            "authUserPanel"
        );


    if (panel) {

        panel.remove();
    }


    const passwordInput =
        document.getElementById(
            "loginPassword"
        );


    if (passwordInput) {

        passwordInput.value =
            "";
    }


    showLoginScreen();
}


/* =========================================================
   LOGIN FORM
========================================================= */

const airflowLoginForm =
    document.getElementById(
        "loginForm"
    );


if (airflowLoginForm) {

    airflowLoginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const username =
                document
                    .getElementById(
                        "loginUsername"
                    )
                    ?.value
                    .trim() ||
                "";


            const password =
                document
                    .getElementById(
                        "loginPassword"
                    )
                    ?.value ||
                "";


            const loginButton =
                document.getElementById(
                    "loginButton"
                );


            const buttonText =
                document.getElementById(
                    "loginButtonText"
                );


            const errorBox =
                document.getElementById(
                    "loginError"
                );


            if (errorBox) {

                errorBox.classList.add(
                    "hidden"
                );

                errorBox.textContent =
                    "";
            }


            if (
                !username ||
                !password
            ) {

                if (errorBox) {

                    errorBox.textContent =
                        "Enter your username and password.";

                    errorBox.classList.remove(
                        "hidden"
                    );
                }

                return;
            }


            if (loginButton) {

                loginButton.disabled =
                    true;
            }


            if (buttonText) {

                buttonText.textContent =
                    "Signing In...";
            }


            try {

                await loginAirFlow(
                    username,
                    password
                );


                if (buttonText) {

                    buttonText.textContent =
                        "Sign In";
                }


            } catch (error) {

                if (errorBox) {

                    errorBox.textContent =
                        error.message ||
                        "Login failed.";

                    errorBox.classList.remove(
                        "hidden"
                    );
                }

            } finally {

                if (loginButton) {

                    loginButton.disabled =
                        false;
                }


                if (buttonText) {

                    buttonText.textContent =
                        "Sign In";
                }
            }
        }
    );
}


/* =========================================================
   SHOW / HIDE PASSWORD
========================================================= */

const loginPasswordToggle =
    document.getElementById(
        "toggleLoginPassword"
    );


if (loginPasswordToggle) {

    loginPasswordToggle.addEventListener(
        "click",
        () => {

            const input =
                document.getElementById(
                    "loginPassword"
                );


            if (!input) {

                return;
            }


            const showing =
                input.type ===
                "text";


            input.type =
                showing
                    ? "password"
                    : "text";


            loginPasswordToggle.textContent =
                showing
                    ? "👁"
                    : "🙈";
        }
    );
}


/* =========================================================
   START AUTH
========================================================= */

restoreAirFlowLogin();// ============================================================
// STAFF MANAGEMENT
// ============================================================

function showStaffManagement() {
    if (!currentUser || currentUser.role !== "admin") {
        return;
    }

    if (typeof hideAllViews === "function") {
        hideAllViews();
    }

    const staffView = document.getElementById("staffManagementView");

    if (staffView) {
        staffView.style.display = "block";
    }

    loadStaffUsers();
}

async function loadStaffUsers() {
    const tableBody = document.getElementById("staffTableBody");

    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="5">Loading staff...</td>
        </tr>
    `;

    try {
        const response = await authauthFetch("/api/admin/users");

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not load staff");
        }

        if (!data.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5">No staff accounts found.</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = data.map(user => {
            const createdDate = user.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : "-";

            const statusText = Number(user.active) === 1
                ? "Active"
                : "Disabled";

            return `
                <tr>
                    <td>${escapeHTML(user.name || "-")}</td>

                    <td>
                        <strong>
                            ${escapeHTML(user.username || "-")}
                        </strong>
                    </td>

                    <td>
                        <span class="status-badge">
                            ${escapeHTML(
                                String(user.role || "").toUpperCase()
                            )}
                        </span>
                    </td>

                    <td>
                        ${statusText}
                    </td>

                    <td>
                        ${createdDate}
                    </td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Load staff error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
    }
}

function openAddStaffModal() {
    const modal = document.getElementById("addStaffModal");
    const errorBox = document.getElementById("staffFormError");

    if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }

    if (modal) {
        modal.classList.add("show");
        modal.style.display = "flex";
    }
}

function closeAddStaffModal() {
    const modal = document.getElementById("addStaffModal");
    const form = document.getElementById("addStaffForm");

    if (modal) {
        modal.classList.remove("show");
        modal.style.display = "none";
    }

    if (form) {
        form.reset();
    }
}

const staffMenu = document.getElementById("staffMenu");

if (staffMenu) {
    staffMenu.addEventListener("click", showStaffManagement);
}

const addStaffButton = document.getElementById("addStaffButton");

if (addStaffButton) {
    addStaffButton.addEventListener(
        "click",
        openAddStaffModal
    );
}

const closeAddStaffButton =
    document.getElementById("closeAddStaffModal");

if (closeAddStaffButton) {
    closeAddStaffButton.addEventListener(
        "click",
        closeAddStaffModal
    );
}

const cancelAddStaff =
    document.getElementById("cancelAddStaff");

if (cancelAddStaff) {
    cancelAddStaff.addEventListener(
        "click",
        closeAddStaffModal
    );
}

const addStaffModal =
    document.getElementById("addStaffModal");

if (addStaffModal) {
    addStaffModal.addEventListener("click", event => {
        if (event.target === addStaffModal) {
            closeAddStaffModal();
        }
    });
}

const addStaffForm =
    document.getElementById("addStaffForm");

if (addStaffForm) {
    addStaffForm.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const saveButton =
                document.getElementById("saveStaffButton");

            const errorBox =
                document.getElementById("staffFormError");

            const name =
                document.getElementById("staffName").value.trim();

            const username =
                document.getElementById("staffUsername").value.trim();

            const password =
                document.getElementById("staffPassword").value;

            const role =
                document.getElementById("staffRole").value;

            if (errorBox) {
                errorBox.style.display = "none";
                errorBox.textContent = "";
            }

            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = "Creating...";
            }

            try {
                const response = await authauthFetch(
                    "/api/admin/users",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            name,
                            username,
                            password,
                            role
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        "Could not create staff account"
                    );
                }

                closeAddStaffModal();

                await loadStaffUsers();

                alert("Staff account created successfully.");

            } catch (error) {
                console.error("Create staff error:", error);

                if (errorBox) {
                    errorBox.textContent = error.message;
                    errorBox.style.display = "block";
                }

            } finally {
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = "Create Account";
                }
            }
        }
    );
}

// Only Admin should see Staff menu
function updateStaffMenuVisibility() {
    const menu = document.getElementById("staffMenu");

    if (!menu) return;

    if (currentUser && currentUser.role === "admin") {
        menu.style.display = "";
    } else {
        menu.style.display = "none";
    }
}function applyRolePermissions() {
    const isAdmin = currentUser && currentUser.role === "admin";

    const financeMenu = document.getElementById("financeMenu");
    const staffMenu = document.getElementById("staffMenu");

    if (financeMenu) {
        financeMenu.style.display = isAdmin ? "" : "none";
    }

    if (staffMenu) {
        staffMenu.style.display = isAdmin ? "" : "none";
    }

    // Hide "+ Test Booking" from workers
    document.querySelectorAll("button").forEach(button => {
        if (button.textContent.includes("Test Booking")) {
            button.style.display = isAdmin ? "" : "none";
        }
    });
}