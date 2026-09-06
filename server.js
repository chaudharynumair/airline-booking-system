/* =========================================================
   AIRFLOW AIRLINE BOOKING SYSTEM
   SERVER + SQLITE + SOCKET.IO
   BOOKING MANAGEMENT BACKEND
========================================================= */

const express = require("express");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");
const Database = require("better-sqlite3");
let turso = null;
console.log("ENV TEST:", {
  slack: !!process.env.SLACK_WEBHOOK_URL,
  tursoUrl: !!process.env.TURSO_DATABASE_URL,
  tursoToken: !!process.env.TURSO_AUTH_TOKEN
});

async function connectTurso() {
    async function initializeTursoDatabase() {
    if (!isTurso) {
        return;
    }

    await connectTurso();
    await turso.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id TEXT UNIQUE NOT NULL,
        pnr TEXT,
        passenger TEXT NOT NULL,
        customer_id INTEGER,
        phone TEXT,
        email TEXT,
        airline TEXT NOT NULL,
        flight_number TEXT,
        route TEXT NOT NULL,
        travel_date TEXT NOT NULL,
        cabin_class TEXT NOT NULL,
        passengers INTEGER NOT NULL DEFAULT 1,
        cost_price REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        profit REAL NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL DEFAULT 'Unpaid',
        amount_paid REAL NOT NULL DEFAULT 0,
        balance REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Confirmed',
        created_by INTEGER,
        approved_by INTEGER,
        approved_at TEXT,
        payment_proof TEXT,
        payment_proof_uploaded_by INTEGER,
        payment_proof_uploaded_at TEXT,
        created_at TEXT NOT NULL
    )
`);
await turso.exec(`
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
`);

await turso.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'worker',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    )
`);

await turso.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
`);

    console.log("☁️ Connected to Turso database");
}
    function usingTurso() {
    return Boolean(
        process.env.TURSO_DATABASE_URL &&
        process.env.TURSO_AUTH_TOKEN
    );
}
    if (
        !process.env.TURSO_DATABASE_URL ||
        !process.env.TURSO_AUTH_TOKEN
    ) {
        return null;
    }

    const { connect } =
        await import("@tursodatabase/serverless");

    turso = connect({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    return turso;
}
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const paymentProofDirectory =
    path.join(
        __dirname,
        "uploads",
        "payment-proofs"
    );

if (
    !fs.existsSync(
        paymentProofDirectory
    )
) {
    fs.mkdirSync(
        paymentProofDirectory,
        {
            recursive: true
        }
    );
}
const paymentProofStorage = multer.diskStorage({

    destination: function (
    req,
    file,
    cb
) {
    cb(
        null,
        paymentProofDirectory
    );
},

    filename: function (
        req,
        file,
        cb
    ) {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(
                Math.random() * 1e9
            );

        cb(
            null,
            uniqueName +
            path.extname(
                file.originalname
            ).toLowerCase()
        );
    }
});


const uploadPaymentProof = multer({

    storage:
        paymentProofStorage,

    limits: {
        fileSize:
            5 * 1024 * 1024
    },

    fileFilter: function (
        req,
        file,
        cb
    ) {

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
        ];

        if (
            allowedTypes.includes(
                file.mimetype
            )
        ) {
            cb(
                null,
                true
            );

        } else {

            cb(
                new Error(
                    "Only JPG, PNG, WEBP or PDF payment proofs are allowed"
                )
            );
        }
    }
});

/* =========================================================
   DATABASE
========================================================= */

const dbPath = path.join(__dirname, "airflow.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

const isTurso =
    !!process.env.TURSO_DATABASE_URL &&
    !!process.env.TURSO_AUTH_TOKEN;
db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        booking_id TEXT UNIQUE NOT NULL,
        pnr TEXT,

        passenger TEXT NOT NULL,
        customer_id INTEGER,
        phone TEXT,
        email TEXT,

        airline TEXT NOT NULL,
        flight_number TEXT,

        route TEXT NOT NULL,
        travel_date TEXT NOT NULL,

        cabin_class TEXT NOT NULL,
        passengers INTEGER NOT NULL DEFAULT 1,

        cost_price REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        profit REAL NOT NULL DEFAULT 0,

        payment_status TEXT NOT NULL DEFAULT 'Unpaid',
        amount_paid REAL NOT NULL DEFAULT 0,
        balance REAL NOT NULL DEFAULT 0,

        status TEXT NOT NULL DEFAULT 'Confirmed',

created_by INTEGER,
approved_by INTEGER,
approved_at TEXT,

created_at TEXT NOT NULL
    )
`);

function addColumnIfMissing(
    tableName,
    columnName,
    columnDefinition
) {

    const columns =
        db.prepare(
            `PRAGMA table_info(${tableName})`
        ).all();

    const exists =
        columns.some(
            column =>
                column.name ===
                columnName
        );

    if (!exists) {

        db.prepare(
            `ALTER TABLE ${tableName}
             ADD COLUMN ${columnName}
             ${columnDefinition}`
        ).run();

        console.log(
            `✅ Added column ${columnName} to ${tableName}`
        );
    }
}


addColumnIfMissing(
    "bookings",
    "created_by",
    "INTEGER"
);

addColumnIfMissing(
    "bookings",
    "approved_by",
    "INTEGER"
);

addColumnIfMissing(
    "bookings",
    "approved_at",
    "TEXT"
);

addColumnIfMissing(
    "bookings",
    "payment_proof",
    "TEXT"
);

addColumnIfMissing(
    "bookings",
    "payment_proof_uploaded_by",
    "INTEGER"
);

addColumnIfMissing(
    "bookings",
    "payment_proof_uploaded_at",
    "TEXT"
);

db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
`);

/* =========================================================
   USERS + LOGIN SESSIONS
========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,

        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'worker',

        active INTEGER NOT NULL DEFAULT 1,

        created_at TEXT NOT NULL
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,

        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,

        FOREIGN KEY (user_id)
            REFERENCES users(id)
    )
`);

/* =========================================================
   DATABASE MIGRATION
========================================================= */

const existingColumns = db
    .prepare("PRAGMA table_info(bookings)")
    .all()
    .map(column => column.name);

const columnsToAdd = [
    ["pnr", "TEXT"],
    ["customer_id", "INTEGER"],
    ["phone", "TEXT"],
    ["email", "TEXT"],
    ["flight_number", "TEXT"],
    ["cost_price", "REAL NOT NULL DEFAULT 0"],
    ["selling_price", "REAL NOT NULL DEFAULT 0"],
    ["profit", "REAL NOT NULL DEFAULT 0"],
    ["payment_status", "TEXT NOT NULL DEFAULT 'Unpaid'"],
    ["amount_paid", "REAL NOT NULL DEFAULT 0"],
    ["balance", "REAL NOT NULL DEFAULT 0"]
];

for (const [columnName, definition] of columnsToAdd) {
    if (!existingColumns.includes(columnName)) {
        db.exec(
            `ALTER TABLE bookings ADD COLUMN ${columnName} ${definition}`
        );
    }
}

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);
app.use(
    "/uploads",
    express.static(
        path.join(
            __dirname,
            "uploads"
        )
    )
);
/* =========================================================
   AUTHENTICATION HELPERS
========================================================= */

function hashPassword(
    password,
    salt
) {

    return crypto
        .scryptSync(
            password,
            salt,
            64
        )
        .toString("hex");
}


function createPassword(
    password
) {

    const salt =
        crypto
            .randomBytes(16)
            .toString("hex");


    const hash =
        hashPassword(
            password,
            salt
        );


    return {
        salt,
        hash
    };
}


function verifyPassword(
    password,
    salt,
    storedHash
) {

    try {

        const suppliedHash =
            hashPassword(
                password,
                salt
            );


        const storedBuffer =
            Buffer.from(
                storedHash,
                "hex"
            );


        const suppliedBuffer =
            Buffer.from(
                suppliedHash,
                "hex"
            );


        if (
            storedBuffer.length !==
            suppliedBuffer.length
        ) {

            return false;
        }


        return crypto.timingSafeEqual(
            storedBuffer,
            suppliedBuffer
        );


    } catch (error) {

        return false;
    }
}


/* =========================================================
   CREATE FIRST ADMIN AUTOMATICALLY
========================================================= */

async function createInitialAdmin() {

    const existingAdmin = isTurso
    ? await turso.prepare(`
        SELECT id
        FROM users
        WHERE role = 'admin'
        LIMIT 1
    `).get()
    : db.prepare(`
        SELECT id
        FROM users
        WHERE role = 'admin'
        LIMIT 1
    `).get();


    if (existingAdmin) {

        return;
    }


    const temporaryPassword = "admin";


    const password =
        createPassword(
            temporaryPassword
        );


   const adminParams = [
    "admin",
    password.hash,
    password.salt,
    "Administrator",
    "admin",
    1,
    new Date().toISOString()
];

if (isTurso) {
    await turso.prepare(`
        INSERT INTO users (
            username,
            password_hash,
            password_salt,
            name,
            role,
            active,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(adminParams);
} else {
    db.prepare(`
        INSERT INTO users (
            username,
            password_hash,
            password_salt,
            name,
            role,
            active,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(...adminParams);
}


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "🔐 FIRST ADMIN ACCOUNT CREATED"
    );

    console.log(
        "Username: admin"
    );

    console.log(
        `Password: ${temporaryPassword}`
    );

    console.log(
        "SAVE THIS PASSWORD NOW."
    );

    console.log(
        "========================================"
    );

    console.log("");
}


createInitialAdmin();


/* =========================================================
   SESSION HELPERS
========================================================= */

function hashAuthToken(
    token
) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


async function createAuthSession(userId) {

    const token =
        crypto
            .randomBytes(48)
            .toString("hex");


    const tokenHash =
        hashAuthToken(
            token
        );


    const createdAt =
        new Date();


    const expiresAt =
        new Date(
            createdAt.getTime() +
            1000 *
            60 *
            60 *
            24 *
            7
        );


   const sessionParams = [
    userId,
    tokenHash,
    createdAt.toISOString(),
    expiresAt.toISOString()
];

if (isTurso) {
    await turso.prepare(`
        INSERT INTO auth_sessions (
            user_id,
            token_hash,
            created_at,
            expires_at
        )
        VALUES (?, ?, ?, ?)
    `).run(sessionParams);
} else {
    db.prepare(`
        INSERT INTO auth_sessions (
            user_id,
            token_hash,
            created_at,
            expires_at
        )
        VALUES (?, ?, ?, ?)
    `).run(...sessionParams);
}


    return token;
}


function getTokenFromRequest(
    req
) {

    const header =
        req.headers.authorization ||
        "";


    if (
        !header.startsWith(
            "Bearer "
        )
    ) {

        return null;
    }


    return header
        .slice(7)
        .trim();
}


async function getLoggedInUser(
    req
) {

    const token =
        getTokenFromRequest(
            req
        );


    if (!token) {

        return null;
    }


    const tokenHash =
        hashAuthToken(
            token
        );


    const session = isTurso
    ? await turso.prepare(`
        SELECT
            auth_sessions.id AS session_id,
            auth_sessions.expires_at,
            users.id,
            users.username,
            users.name,
            users.role,
            users.active
        FROM auth_sessions
        JOIN users
            ON users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ?
        LIMIT 1
    `).get([tokenHash])
    : db.prepare(`
        SELECT
            auth_sessions.id AS session_id,
            auth_sessions.expires_at,
            users.id,
            users.username,
            users.name,
            users.role,
            users.active
        FROM auth_sessions
        JOIN users
            ON users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ?
        LIMIT 1
    `).get(tokenHash);


    if (!session) {

        return null;
    }


    if (
        Number(session.active) !==
        1
    ) {

        return null;
    }


    const expiresAt =
        new Date(
            session.expires_at
        );


    if (
        expiresAt.getTime() <=
        Date.now()
    ) {

        if (isTurso) {
    await turso.prepare(`
        DELETE FROM auth_sessions
        WHERE id = ?
    `).run([session.session_id]);
} else {
    db.prepare(`
        DELETE FROM auth_sessions
        WHERE id = ?
    `).run(session.session_id);
}

        return null;
    }


    return {
        id:
            session.id,

        username:
            session.username,

        name:
            session.name,

        role:
            session.role
    };
}


async function requireLogin(
    req,
    res,
    next
) {
    const user =
    await getLoggedInUser(req);


    if (!user) {

        return res
            .status(401)
            .json({
                error:
                    "Login required"
            });
    }


    req.user =
        user;


    next();
}


async function requireAdmin(
    req,
    res,
    next
) {

    const user =
    await getLoggedInUser(req);


    if (!user) {

        return res
            .status(401)
            .json({
                error:
                    "Login required"
            });
    }


    if (
        user.role !==
        "admin"
    ) {

        return res
            .status(403)
            .json({
                error:
                    "Admin access required"
            });
    }


    req.user =
        user;


    next();
}


/* =========================================================
   LOGIN
========================================================= */

app.post(
    "/api/auth/login",
    async (req, res) => {



        try {

            const username =
                String(
                    req.body.username ||
                    ""
                )
                .trim()
                .toLowerCase();


            const password =
                String(
                    req.body.password ||
                    ""
                );


            if (
                !username ||
                !password
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Username and password are required"
                    });
            }


            const user = isTurso
    ? await turso.prepare(`
        SELECT *
        FROM users
        WHERE LOWER(username) = ?
        LIMIT 1
    `).get([username])
    : db.prepare(`
        SELECT *
        FROM users
        WHERE LOWER(username) = ?
        LIMIT 1
    `).get(username);


            if (
                !user ||
                Number(user.active) !==
                    1
            ) {

                return res
                    .status(401)
                    .json({
                        error:
                            "Invalid username or password"
                    });
            }


            const validPassword =
                verifyPassword(
                    password,
                    user.password_salt,
                    user.password_hash
                );


            if (!validPassword) {

                return res
                    .status(401)
                    .json({
                        error:
                            "Invalid username or password"
                    });
            }
    


            const token =
    await createAuthSession(
        user.id
    );


            res.json({

                success:
                    true,

                token,

                user: {

                    id:
                        user.id,

                    username:
                        user.username,

                    name:
                        user.name,

                    role:
                        user.role

                }

            });


        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );


            res
                .status(500)
                .json({
                    error:
                        "Login failed"
                });
        }
    }
);


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/auth/me",
    requireLogin,
    (req, res) => {

        res.json({
            user:
                req.user
        });
    }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    requireLogin,
    async (req, res) => {

        const token =
            getTokenFromRequest(
                req
            );


      if (token) {

    if (isTurso) {

        await turso.prepare(`
            DELETE FROM auth_sessions
            WHERE token_hash = ?
        `).run([
            hashAuthToken(token)
        ]);

    } else {

        db.prepare(`
            DELETE FROM auth_sessions
            WHERE token_hash = ?
        `)
        .run(
            hashAuthToken(token)
        );
    }
}


        res.json({
            success:
                true
        });
    }
);
/* =========================================================
   CONSTANTS
========================================================= */

const VALID_STATUSES = [
    "Confirmed",
    "Pending",
    "Cancelled"
];

const VALID_PAYMENT_STATUSES = [
    "Unpaid",
    "Partial",
    "Paid"
];

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}

function numberValue(value, fallback = 0) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return number;
}

function generateBookingId() {
    let bookingId;

    do {
        bookingId =
            "AF" +
            Math.floor(
                100000 +
                Math.random() * 900000
            );
    } while (
        db
            .prepare(
                "SELECT id FROM bookings WHERE booking_id = ?"
            )
            .get(bookingId)
    );

    return bookingId;
}

function generatePNR() {
    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let pnr;

    do {
        pnr = "";

        for (let i = 0; i < 6; i++) {
            pnr += characters.charAt(
                Math.floor(
                    Math.random() *
                    characters.length
                )
            );
        }
    } while (
        db
            .prepare(
                "SELECT id FROM bookings WHERE pnr = ?"
            )
            .get(pnr)
    );

    return pnr;
}

function calculatePaymentStatus(
    sellingPrice,
    amountPaid
) {
    if (sellingPrice <= 0 || amountPaid <= 0) {
        return "Unpaid";
    }

    if (amountPaid >= sellingPrice) {
        return "Paid";
    }

    return "Partial";
}

function getAllBookings() {

    return db
        .prepare(`
            SELECT
                bookings.*,

                creator.name AS created_by_name,
                creator.username AS created_by_username,

                approver.name AS approved_by_name,
                approver.username AS approved_by_username

            FROM bookings

            LEFT JOIN users AS creator
                ON creator.id = bookings.created_by

            LEFT JOIN users AS approver
                ON approver.id = bookings.approved_by

            ORDER BY bookings.id DESC
        `)
        .all();
}

function getBooking(bookingId) {

    return db
        .prepare(`
            SELECT
                bookings.*,

                creator.name AS created_by_name,
                creator.username AS created_by_username,

                approver.name AS approved_by_name,
approver.username AS approved_by_username,

proofUploader.name AS payment_proof_uploaded_by_name,
proofUploader.username AS payment_proof_uploaded_by_username

            FROM bookings

            LEFT JOIN users AS creator
                ON creator.id = bookings.created_by

            LEFT JOIN users AS approver
                ON approver.id = bookings.approved_by
                LEFT JOIN users AS proofUploader
    ON proofUploader.id = bookings.payment_proof_uploaded_by

            WHERE bookings.booking_id = ?
        `)
        .get(bookingId);
}

function emitBookingUpdate(booking) {
    io.emit("bookingUpdated", booking);
}

/* =========================================================
   CUSTOMER HELPERS
========================================================= */

function generateCustomerCode() {
    let code;

    do {
        code =
            "CUS" +
            String(
                Math.floor(
                    100000 +
                    Math.random() * 900000
                )
            );
    } while (
        db
            .prepare(
                "SELECT id FROM customers WHERE customer_code = ?"
            )
            .get(code)
    );

    return code;
}

function findCustomer(
    name,
    phone,
    email
) {
    const cleanName =
        cleanString(name);

    const cleanPhone =
        cleanString(phone);

    const cleanEmail =
        cleanString(email).toLowerCase();

    if (cleanPhone) {

        const byPhone =
            db
                .prepare(`
                    SELECT *
                    FROM customers
                    WHERE phone = ?
                    ORDER BY id
                    LIMIT 1
                `)
                .get(cleanPhone);

        if (byPhone) {
            return byPhone;
        }
    }

    if (cleanEmail) {

        const byEmail =
            db
                .prepare(`
                    SELECT *
                    FROM customers
                    WHERE lower(email) = ?
                    ORDER BY id
                    LIMIT 1
                `)
                .get(cleanEmail);

        if (byEmail) {
            return byEmail;
        }
    }

    if (cleanName) {

        const byName =
            db
                .prepare(`
                    SELECT *
                    FROM customers
                    WHERE lower(name) = ?
                    AND (
                        phone IS NULL
                        OR phone = ''
                    )
                    AND (
                        email IS NULL
                        OR email = ''
                    )
                    ORDER BY id
                    LIMIT 1
                `)
                .get(
                    cleanName.toLowerCase()
                );

        if (byName) {
            return byName;
        }
    }

    return null;
}

function upsertCustomer(
    name,
    phone,
    email
) {

    const cleanName =
        cleanString(name);

    const cleanPhone =
        cleanString(phone);

    const cleanEmail =
        cleanString(email).toLowerCase();

    if (!cleanName) {
        return null;
    }

    const existing =
        findCustomer(
            cleanName,
            cleanPhone,
            cleanEmail
        );

    const now =
        new Date().toISOString();

    if (existing) {

        db.prepare(`
            UPDATE customers
            SET
                name = @name,
                phone = @phone,
                email = @email,
                updated_at = @updated_at
            WHERE id = @id
        `).run({
            id: existing.id,
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            updated_at: now
        });

        return db
            .prepare(
                "SELECT * FROM customers WHERE id = ?"
            )
            .get(existing.id);
    }

    const result =
        db.prepare(`
            INSERT INTO customers (
                customer_code,
                name,
                phone,
                email,
                created_at,
                updated_at
            )
            VALUES (
                @customer_code,
                @name,
                @phone,
                @email,
                @created_at,
                @updated_at
            )
        `).run({

            customer_code:
                generateCustomerCode(),

            name: cleanName,

            phone: cleanPhone,

            email: cleanEmail,

            created_at: now,

            updated_at: now
        });

    return db
        .prepare(
            "SELECT * FROM customers WHERE id = ?"
        )
        .get(
            result.lastInsertRowid
        );
}

function backfillBookingCustomers() {

    const rows =
        db.prepare(`
            SELECT
                id,
                passenger,
                phone,
                email
            FROM bookings
            WHERE
                customer_id IS NULL
                OR customer_id = 0
            ORDER BY id ASC
        `).all();

    const update =
        db.prepare(`
            UPDATE bookings
            SET customer_id = ?
            WHERE id = ?
        `);

    const transaction =
        db.transaction(() => {

            for (const row of rows) {

                const customer =
                    upsertCustomer(
                        row.passenger,
                        row.phone,
                        row.email
                    );

                if (customer) {

                    update.run(
                        customer.id,
                        row.id
                    );
                }
            }
        });

    transaction();
}

function getCustomer(customerId) {
    return db
        .prepare(
            "SELECT * FROM customers WHERE id = ?"
        )
        .get(customerId);
}

function getCustomerBookings(customerId) {
    return db
        .prepare(`
            SELECT *
            FROM bookings
            WHERE customer_id = ?
            ORDER BY id DESC
        `)
        .all(customerId);
}

/*
   Link old bookings to customer records.
*/
backfillBookingCustomers();

/* =========================================================
   CREATE BOOKING
========================================================= */

function createBooking(data, createdBy = null) {
    const passenger =
        cleanString(
            data.passenger
        );

    const phone =
        cleanString(
            data.phone
        );

    const email =
        cleanString(
            data.email
        );

    const airline =
        cleanString(
            data.airline
        );

    const flightNumber =
        cleanString(
            data.flightNumber
        );

    const route =
        cleanString(
            data.route
        );

    const date =
        cleanString(
            data.date ||
            data.travel_date
        );

    const cabinClass =
        cleanString(
            data.cabinClass ||
            data.cabin_class
        );

    const passengers =
        Math.max(
            1,
            Math.floor(
                numberValue(
                    data.passengers,
                    1
                )
            )
        );

    const cost =
        Math.max(
            0,
            numberValue(
                data.costPrice ??
                data.cost_price,
                0
            )
        );

    const selling =
        Math.max(
            0,
            numberValue(
                data.sellingPrice ??
                data.selling_price,
                0
            )
        );

    let paid =
        Math.max(
            0,
            numberValue(
                data.amountPaid ??
                data.amount_paid,
                0
            )
        );

    if (!passenger) {
        throw new Error(
            "Passenger name is required"
        );
    }

    if (!airline) {
        throw new Error(
            "Airline is required"
        );
    }

    if (!route) {
        throw new Error(
            "Route is required"
        );
    }

    if (!date) {
        throw new Error(
            "Travel date is required"
        );
    }

    if (!cabinClass) {
        throw new Error(
            "Cabin class is required"
        );
    }

    if (paid > selling) {
        paid = selling;
    }

    const profit =
        selling - cost;

    const balance =
        Math.max(
            selling - paid,
            0
        );

    const paymentStatus =
        calculatePaymentStatus(
            selling,
            paid
        );

    const status =
        VALID_STATUSES.includes(
            data.status
        )
            ? data.status
            : "Confirmed";

    const customer =
        upsertCustomer(
            passenger,
            phone,
            email
        );

    const bookingId =
        generateBookingId();

    const pnr =
        generatePNR();

    const createdAt =
        new Date().toISOString();

    const booking = {

        booking_id:
            bookingId,

        pnr,

        customer_id:
            customer
                ? customer.id
                : null,

        passenger,

        phone,

        email,

        airline,

        flight_number:
            flightNumber,

        route,

        travel_date:
            date,

        cabin_class:
            cabinClass,

        passengers,

        cost_price:
            cost,

        selling_price:
            selling,

        profit,

        payment_status:
            paymentStatus,

        amount_paid:
            paid,

        balance,

        status,
        
        created_by:
            createdBy,

        created_at:
            createdAt
    };

    db.prepare(`
        INSERT INTO bookings (
            booking_id,
            pnr,
            passenger,
            customer_id,
            phone,
            email,
            airline,
            flight_number,
            route,
            travel_date,
            cabin_class,
            passengers,
            cost_price,
            selling_price,
            profit,
            payment_status,
            amount_paid,
            balance,
            status,
            created_by,
            created_at
        )
        VALUES (
            @booking_id,
            @pnr,
            @passenger,
            @customer_id,
            @phone,
            @email,
            @airline,
            @flight_number,
            @route,
            @travel_date,
            @cabin_class,
            @passengers,
            @cost_price,
            @selling_price,
            @profit,
            @payment_status,
            @amount_paid,
            @balance,
            @status,
            @created_by,
            @created_at
        )
    `).run(booking);

    return getBooking(
        bookingId
    );
}

/* =========================================================
   UPDATE BOOKING
========================================================= */

function updateBooking(
    bookingId,
    data
) {

    const existing =
        getBooking(
            bookingId
        );

    if (!existing) {
        throw new Error(
            "Booking not found"
        );
    }

    const passenger =
        data.passenger !== undefined
            ? cleanString(
                data.passenger
            )
            : existing.passenger;

    const phone =
        data.phone !== undefined
            ? cleanString(
                data.phone
            )
            : existing.phone;

    const email =
        data.email !== undefined
            ? cleanString(
                data.email
            )
            : existing.email;

    const airline =
        data.airline !== undefined
            ? cleanString(
                data.airline
            )
            : existing.airline;

    const flightNumber =
        data.flightNumber !== undefined
            ? cleanString(
                data.flightNumber
            )
            : existing.flight_number;

    const route =
        data.route !== undefined
            ? cleanString(
                data.route
            )
            : existing.route;

    const date =
        data.date !== undefined
            ? cleanString(
                data.date
            )
            : existing.travel_date;

    const cabinClass =
        data.cabinClass !== undefined
            ? cleanString(
                data.cabinClass
            )
            : existing.cabin_class;

    const passengers =
        data.passengers !== undefined
            ? Math.max(
                1,
                Math.floor(
                    numberValue(
                        data.passengers,
                        1
                    )
                )
            )
            : existing.passengers;

    const cost =
        data.costPrice !== undefined
            ? Math.max(
                0,
                numberValue(
                    data.costPrice,
                    0
                )
            )
            : existing.cost_price;

    const selling =
        data.sellingPrice !== undefined
            ? Math.max(
                0,
                numberValue(
                    data.sellingPrice,
                    0
                )
            )
            : existing.selling_price;

    let paid =
        data.amountPaid !== undefined
            ? Math.max(
                0,
                numberValue(
                    data.amountPaid,
                    0
                )
            )
            : existing.amount_paid;

    if (paid > selling) {
        paid = selling;
    }

    const profit =
        selling - cost;

    const balance =
        Math.max(
            selling - paid,
            0
        );

    const paymentStatus =
        calculatePaymentStatus(
            selling,
            paid
        );

    const status =
        data.status !== undefined &&
        VALID_STATUSES.includes(
            data.status
        )
            ? data.status
            : existing.status;

            const approvedBy =
    data.approved_by !== undefined
        ? data.approved_by
        : existing.approved_by;

const approvedAt =
    data.approved_at !== undefined
        ? data.approved_at
        : existing.approved_at;

    if (!passenger) {
        throw new Error(
            "Passenger name is required"
        );
    }

    if (!airline) {
        throw new Error(
            "Airline is required"
        );
    }

    if (!route) {
        throw new Error(
            "Route is required"
        );
    }

    if (!date) {
        throw new Error(
            "Travel date is required"
        );
    }

    if (!cabinClass) {
        throw new Error(
            "Cabin class is required"
        );
    }

    const customer =
        upsertCustomer(
            passenger,
            phone,
            email
        );

    db.prepare(`
        UPDATE bookings
        SET
            passenger = @passenger,
            customer_id = @customer_id,
            phone = @phone,
            email = @email,

            airline = @airline,
            flight_number = @flight_number,

            route = @route,
            travel_date = @travel_date,

            cabin_class = @cabin_class,
            passengers = @passengers,

            cost_price = @cost_price,
            selling_price = @selling_price,
            profit = @profit,

            payment_status = @payment_status,
            amount_paid = @amount_paid,
            balance = @balance,

            status = @status,
approved_by = @approved_by,
approved_at = @approved_at

        WHERE booking_id = @booking_id
    `).run({

        booking_id:
            bookingId,

        passenger,

        customer_id:
            customer
                ? customer.id
                : existing.customer_id,

        phone,

        email,

        airline,

        flight_number:
            flightNumber,

        route,

        travel_date:
            date,

        cabin_class:
            cabinClass,

        passengers,

        cost_price:
            cost,

        selling_price:
            selling,

        profit,

        payment_status:
            paymentStatus,

        amount_paid:
            paid,

        balance,

status,

approved_by:
    approvedBy,

approved_at:
    approvedAt
    });

    return getBooking(
        bookingId
    );
}

/* =========================================================
   GET ALL BOOKINGS
   WITH SEARCH
========================================================= */

app.get(
    "/api/bookings",
    requireLogin,
    (req, res) => {

        try {

            const search =
                cleanString(
                    req.query.search
                );

            const status =
                cleanString(
                    req.query.status
                );

            let bookings;

            if (
                search &&
                status &&
                VALID_STATUSES.includes(
                    status
                )
            ) {

                const term =
                    `%${search}%`;

                bookings =
                    db.prepare(`
                        SELECT
    bookings.*,

    creator.name AS created_by_name,
    creator.username AS created_by_username,

    approver.name AS approved_by_name,
    approver.username AS approved_by_username

FROM bookings

LEFT JOIN users AS creator
    ON creator.id = bookings.created_by

LEFT JOIN users AS approver
    ON approver.id = bookings.approved_by

WHERE
    (
        bookings.booking_id LIKE ?
        OR bookings.pnr LIKE ?
        OR bookings.passenger LIKE ?
        OR bookings.phone LIKE ?
        OR bookings.email LIKE ?
        OR bookings.airline LIKE ?
        OR bookings.flight_number LIKE ?
        OR bookings.route LIKE ?
    )
    AND bookings.status = ?

ORDER BY bookings.id DESC
                    `).all(
                        term,
                        term,
                        term,
                        term,
                        term,
                        term,
                        term,
                        term,
                        status
                    );

            } else if (search) {

                const term =
                    `%${search}%`;

                bookings =
                    db.prepare(`
                        SELECT
    bookings.*,

    creator.name AS created_by_name,
    creator.username AS created_by_username,

    approver.name AS approved_by_name,
    approver.username AS approved_by_username

FROM bookings

LEFT JOIN users AS creator
    ON creator.id = bookings.created_by

LEFT JOIN users AS approver
    ON approver.id = bookings.approved_by

WHERE
    bookings.booking_id LIKE ?
    OR bookings.pnr LIKE ?
    OR bookings.passenger LIKE ?
    OR bookings.phone LIKE ?
    OR bookings.email LIKE ?
    OR bookings.airline LIKE ?
    OR bookings.flight_number LIKE ?
    OR bookings.route LIKE ?

ORDER BY bookings.id DESC
                    `).all(
                        term,
                        term,
                        term,
                        term,
                        term,
                        term,
                        term,
                        term
                    );

            } else if (
                status &&
                VALID_STATUSES.includes(
                    status
                )
            ) {

                bookings =
                    db.prepare(`
                        SELECT
    bookings.*,

    creator.name AS created_by_name,
    creator.username AS created_by_username,

    approver.name AS approved_by_name,
    approver.username AS approved_by_username

FROM bookings

LEFT JOIN users AS creator
    ON creator.id = bookings.created_by

LEFT JOIN users AS approver
    ON approver.id = bookings.approved_by

WHERE bookings.status = ?

ORDER BY bookings.id DESC
                    `).all(
                        status
                    );

            } else {

                bookings =
                    getAllBookings();
            }

            res.json(
                bookings
            );

        } catch (error) {

            console.error(
                "GET BOOKINGS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to load bookings"
            });
        }
    }
);

/* =========================================================
   GET SINGLE BOOKING
========================================================= */

app.get(
    "/api/bookings/:id",
    requireLogin,
    (req, res) => {

        try {

            const booking =
                getBooking(
                    req.params.id
                );

            if (!booking) {

                return res.status(
                    404
                ).json({
                    error:
                        "Booking not found"
                });
            }

            res.json(
                booking
            );

        } catch (error) {

            console.error(
                "GET BOOKING ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to load booking"
            });
        }
    }
);
/* =========================================================
   SLACK NOTIFICATION
========================================================= */

async function sendSlackBookingNotification(booking) {

    const webhookUrl =
        process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
        console.log(
            "⚠️ SLACK_WEBHOOK_URL not found"
        );
        return;
    }

    try {

        const message = {
            text:
`✈️ *NEW BOOKING RECEIVED*

🆔 *Booking ID:* ${booking.booking_id || "-"}
🎫 *PNR:* ${booking.pnr || "-"}
👤 *Passenger:* ${booking.passenger || "-"}
📞 *Phone:* ${booking.phone || "-"}
📧 *Email:* ${booking.email || "-"}

✈️ *Airline:* ${booking.airline || "-"}
🔢 *Flight:* ${booking.flight_number || "-"}
🌍 *Route:* ${booking.route || "-"}
📅 *Travel Date:* ${booking.travel_date || "-"}
💺 *Cabin:* ${booking.cabin_class || "-"}
👥 *Passengers:* ${booking.passengers || 1}

💰 *Selling Price:* ${Number(
    booking.selling_price || 0
).toLocaleString()}

💳 *Payment:* ${booking.payment_status || "Unpaid"}
📌 *Status:* ${booking.status || "-"}

👨‍💻 *Created By:* ${
    booking.created_by_name ||
    booking.created_by_username ||
    "Unknown"
}`
        };

        const response =
            await fetch(
                webhookUrl,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            message
                        )
                }
            );

        if (!response.ok) {

            const errorText =
                await response.text();

            throw new Error(
                `Slack ${response.status}: ${errorText}`
            );
        }

        console.log(
            `✅ Slack sent for ${booking.booking_id}`
        );

    } catch (error) {

        console.error(
            "❌ SLACK ERROR:",
            error.message
        );
    }
}
/* =========================================================
   CREATE BOOKING API
========================================================= */

app.post(
    "/api/bookings",
    requireLogin,
    (req, res) => {

        try {

            const bookingData = {
                ...req.body
            };

            // Worker can NEVER create a confirmed/paid booking.
// Every worker-created booking requires admin approval.
if (req.user.role === "worker") {

    bookingData.status = "Pending";

    // Worker cannot record payment while creating booking
    bookingData.amountPaid = 0;
    bookingData.amount_paid = 0;

    delete bookingData.paymentStatus;
    delete bookingData.payment_status;
}

            const booking =
                createBooking(
                    bookingData,
                    req.user.id
                );

            io.emit(
                "newBooking",
                booking
            );
            io.emit(
    "newBooking",
    booking
);

sendSlackBookingNotification(
    booking
).catch(error => {

    console.error(
        "Slack notification failed:",
        error
    );

});

            res.status(
                201
            ).json(
                booking
            );

        } catch (error) {

            console.error(
                "CREATE BOOKING ERROR:",
                error
            );

            res.status(400).json({
                error:
                    error.message ||
                    "Failed to create booking"
            });
        }
    }
);

/* =========================================================
   UPDATE BOOKING API
========================================================= */

app.put(
    "/api/bookings/:id",
    requireLogin,
    (req, res) => {

        try {

            const updateData = {
                ...req.body
            };

            /*
                WORKER SECURITY

                Workers may edit normal booking information,
                but they cannot change:

                - Booking status
                - Amount paid
                - Payment status

                Confirm / Cancel / Payment remains admin-only.
            */

            if (req.user.role === "worker") {

                delete updateData.status;

                delete updateData.amountPaid;
                delete updateData.amount_paid;

                delete updateData.paymentStatus;
                delete updateData.payment_status;
            }

            const booking =
                updateBooking(
                    req.params.id,
                    updateData
                );

            emitBookingUpdate(
                booking
            );

            res.json(
                booking
            );

        } catch (error) {

            console.error(
                "UPDATE BOOKING ERROR:",
                error
            );

            const statusCode =
                error.message ===
                "Booking not found"
                    ? 404
                    : 400;

            res.status(
                statusCode
            ).json({
                error:
                    error.message ||
                    "Failed to update booking"
            });
        }
    }
);

/* =========================================================
   MARK PAYMENT AS PAID
========================================================= */

app.patch(
    "/api/bookings/:id/payment",
    requireAdmin,
    (req, res) => {

        try {

            const existing =
                getBooking(
                    req.params.id
                );

            if (!existing) {

                return res.status(
                    404
                ).json({
                    error:
                        "Booking not found"
                });
            }
if (!existing.payment_proof) {

    return res.status(
        400
    ).json({
        error:
            "Payment proof is required before marking booking as paid"
    });
}
            const selling =
                numberValue(
                    existing.selling_price,
                    0
                );

            const updated =
                updateBooking(
                    req.params.id,
                    {
                        amountPaid:
                            selling
                    }
                );

            emitBookingUpdate(
                updated
            );

            res.json(
                updated
            );

        } catch (error) {

            console.error(
                "PAYMENT UPDATE ERROR:",
                error
            );

            res.status(400).json({
                error:
                    error.message ||
                    "Failed to update payment"
            });
        }
    }
);
app.post(
    "/api/bookings/:id/payment-proof",
    requireAdmin,
    uploadPaymentProof.single("paymentProof"),
    (req, res) => {

        try {

            const existing =
                getBooking(
                    req.params.id
                );

            if (!existing) {

                return res.status(
                    404
                ).json({
                    error:
                        "Booking not found"
                });
            }

            if (
                existing.status !==
                "Confirmed"
            ) {

                return res.status(
                    400
                ).json({
                    error:
                        "Payment proof can only be uploaded for confirmed bookings"
                });
            }

            if (!req.file) {

                return res.status(
                    400
                ).json({
                    error:
                        "Payment proof file is required"
                });
            }

            const proofPath =
                `/uploads/payment-proofs/${req.file.filename}`;

            const uploadedAt =
                new Date().toISOString();

            db.prepare(`
                UPDATE bookings
                SET
                    payment_proof = ?,
                    payment_proof_uploaded_by = ?,
                    payment_proof_uploaded_at = ?
                WHERE booking_id = ?
            `).run(
                proofPath,
                req.user.id,
                uploadedAt,
                req.params.id
            );

            const updated =
                getBooking(
                    req.params.id
                );

            emitBookingUpdate(
                updated
            );

            res.json(
                updated
            );

        } catch (error) {

            console.error(
                "PAYMENT PROOF UPLOAD ERROR:",
                error
            );

            res.status(
                400
            ).json({
                error:
                    error.message ||
                    "Failed to upload payment proof"
            });
        }
    }
);
/* =========================================================
   CANCEL BOOKING
========================================================= */

app.patch(
    "/api/bookings/:id/status",
    requireAdmin,
    (req, res) => {

        try {

            const newStatus =
                cleanString(
                    req.body.status
                );

            if (
                !VALID_STATUSES.includes(
                    newStatus
                )
            ) {

                return res.status(
                    400
                ).json({
                    error:
                        "Invalid booking status"
                });
            }

            const existing =
                getBooking(
                    req.params.id
                );

            if (!existing) {

                return res.status(
                    404
                ).json({
                    error:
                        "Booking not found"
                });
            }

            const updateData = {
    status:
        newStatus
};

if (newStatus === "Confirmed") {

    updateData.approved_by =
        req.user.id;

    updateData.approved_at =
        new Date().toISOString();
}

const updated =
    updateBooking(
        req.params.id,
        updateData
    );

            emitBookingUpdate(
                updated
            );

            res.json(
                updated
            );

        } catch (error) {

            console.error(
                "STATUS UPDATE ERROR:",
                error
            );

            res.status(400).json({
                error:
                    error.message ||
                    "Failed to update booking status"
            });
        }
    }
);

/* =========================================================
   DELETE BOOKING
   OPTIONAL / ADMIN USE
========================================================= */

app.delete(
    "/api/bookings/:id",
    requireAdmin,
    (req, res) => {

        try {

            const existing =
                getBooking(
                    req.params.id
                );

            if (!existing) {

                return res.status(
                    404
                ).json({
                    error:
                        "Booking not found"
                });
            }

            db.prepare(
                "DELETE FROM bookings WHERE booking_id = ?"
            ).run(
                req.params.id
            );

            io.emit(
                "bookingDeleted",
                {
                    booking_id:
                        req.params.id
                }
            );

            res.json({
                success:
                    true,

                booking_id:
                    req.params.id
            });

        } catch (error) {

            console.error(
                "DELETE BOOKING ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to delete booking"
            });
        }
    }
);

/* =========================================================
   CUSTOMER MANAGEMENT API
========================================================= */

/* GET ALL CUSTOMERS + SEARCH */

app.get(
    "/api/customers",
    requireLogin,
    (req, res) => {

        try {

            const search =
                cleanString(
                    req.query.search
                );

            let customers;

            if (search) {

                const term =
                    `%${search}%`;

                customers =
                    db.prepare(`
                        SELECT
                            c.*,
                            COUNT(b.id)
                                AS booking_count
                        FROM customers c
                        LEFT JOIN bookings b
                            ON b.customer_id = c.id
                        WHERE
                            c.customer_code LIKE ?
                            OR c.name LIKE ?
                            OR c.phone LIKE ?
                            OR c.email LIKE ?
                        GROUP BY c.id
                        ORDER BY c.id DESC
                    `).all(
                        term,
                        term,
                        term,
                        term
                    );

            } else {

                customers =
                    db.prepare(`
                        SELECT
                            c.*,
                            COUNT(b.id)
                                AS booking_count
                        FROM customers c
                        LEFT JOIN bookings b
                            ON b.customer_id = c.id
                        GROUP BY c.id
                        ORDER BY c.id DESC
                    `).all();
            }

            res.json(
                customers
            );

        } catch (error) {

            console.error(
                "GET CUSTOMERS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to load customers"
            });
        }
    }
);

/* GET SINGLE CUSTOMER + BOOKING HISTORY */

app.get(
    "/api/customers/:id",
    requireLogin,
    (req, res) => {

        try {

            const customer =
                getCustomer(
                    req.params.id
                );

            if (!customer) {

                return res.status(
                    404
                ).json({
                    error:
                        "Customer not found"
                });
            }

            const bookings =
                getCustomerBookings(
                    customer.id
                );

            res.json({
                ...customer,

                booking_count:
                    bookings.length,

                bookings
            });

        } catch (error) {

            console.error(
                "GET CUSTOMER ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to load customer"
            });
        }
    }
);

/* CREATE CUSTOMER */

app.post(
    "/api/customers",
    requireLogin,
    (req, res) => {

        try {

            const name =
                cleanString(
                    req.body.name
                );

            const phone =
                cleanString(
                    req.body.phone
                );

            const email =
                cleanString(
                    req.body.email
                );

            if (!name) {

                return res.status(
                    400
                ).json({
                    error:
                        "Customer name is required"
                });
            }

            const customer =
                upsertCustomer(
                    name,
                    phone,
                    email
                );

            res.status(
                201
            ).json(
                customer
            );

        } catch (error) {

            console.error(
                "CREATE CUSTOMER ERROR:",
                error
            );

            res.status(400).json({
                error:
                    error.message ||
                    "Failed to create customer"
            });
        }
    }
);

/* UPDATE CUSTOMER */

app.put(
    "/api/customers/:id",
    requireLogin,
    (req, res) => {

        try {

            const existing =
                getCustomer(
                    req.params.id
                );

            if (!existing) {

                return res.status(
                    404
                ).json({
                    error:
                        "Customer not found"
                });
            }

            const name =
                cleanString(
                    req.body.name
                );

            const phone =
                cleanString(
                    req.body.phone
                );

            const email =
                cleanString(
                    req.body.email
                ).toLowerCase();

            if (!name) {

                return res.status(
                    400
                ).json({
                    error:
                        "Customer name is required"
                });
            }

            db.prepare(`
                UPDATE customers
                SET
                    name = @name,
                    phone = @phone,
                    email = @email,
                    updated_at = @updated_at
                WHERE id = @id
            `).run({

                id:
                    req.params.id,

                name,

                phone,

                email,

                updated_at:
                    new Date().toISOString()
            });

            const customer =
                getCustomer(
                    req.params.id
                );

            /*
                Keep all linked bookings synchronized
                with the updated customer information.
            */

            db.prepare(`
                UPDATE bookings
                SET
                    passenger = @name,
                    phone = @phone,
                    email = @email
                WHERE customer_id = @customer_id
            `).run({

                customer_id:
                    req.params.id,

                name,

                phone,

                email
            });

            /*
                Notify connected clients.
            */

            io.emit(
                "customerUpdated",
                customer
            );

            /*
                Also notify clients that bookings changed.
            */

            const updatedBookings =
                getCustomerBookings(
                    customer.id
                );

            for (
                const booking
                of updatedBookings
            ) {

                io.emit(
                    "bookingUpdated",
                    booking
                );
            }

            res.json({

                ...customer,

                booking_count:
                    updatedBookings.length,

                bookings:
                    updatedBookings
            });

        } catch (error) {

            console.error(
                "UPDATE CUSTOMER ERROR:",
                error
            );

            res.status(400).json({
                error:
                    error.message ||
                    "Failed to update customer"
            });
        }
    }
);
/* =========================================================
   FLIGHT SEARCH + AVAILABILITY
   Secure Amadeus proxy with automatic Demo mode.
========================================================= */

const AMADEUS_API_KEY =
    process.env.AMADEUS_API_KEY || "";

const AMADEUS_API_SECRET =
    process.env.AMADEUS_API_SECRET || "";

const AMADEUS_ENV =
    String(
        process.env.AMADEUS_ENV || "test"
    ).toLowerCase() === "prod"
        ? "prod"
        : "test";

const AMADEUS_BASE_URL =
    AMADEUS_ENV === "prod"
        ? "https://api.amadeus.com"
        : "https://test.api.amadeus.com";

let amadeusToken = null;
let amadeusTokenExpiresAt = 0;


/* =========================================================
   FLIGHT HELPERS
========================================================= */

function flightClean(value) {
    return String(value ?? "").trim();
}


function flightMinutes(isoDuration) {

    const match =
        String(isoDuration || "")
            .match(
                /PT(?:(\d+)H)?(?:(\d+)M)?/i
            );

    if (!match) {
        return 0;
    }

    return (
        Number(match[1] || 0) * 60 +
        Number(match[2] || 0)
    );
}


function flightDurationLabel(minutes) {

    if (!minutes) {
        return "—";
    }

    const hours =
        Math.floor(minutes / 60);

    const minutesRemaining =
        minutes % 60;

    return `${hours}h ${minutesRemaining}m`;
}


function flightLocalTime(iso) {

    if (!iso) {
        return "—";
    }

    const text = String(iso);

    const match =
        text.match(
            /T(\d{2}:\d{2})/
        );

    return match
        ? match[1]
        : text;
}


/* =========================================================
   AMADEUS AUTHENTICATION
========================================================= */

async function getAmadeusToken() {

    if (
        !AMADEUS_API_KEY ||
        !AMADEUS_API_SECRET
    ) {
        return null;
    }

    if (
        amadeusToken &&
        Date.now() <
            amadeusTokenExpiresAt
    ) {
        return amadeusToken;
    }

    const body =
        new URLSearchParams({
            grant_type:
                "client_credentials",

            client_id:
                AMADEUS_API_KEY,

            client_secret:
                AMADEUS_API_SECRET
        });

    const response =
        await fetch(
            `${AMADEUS_BASE_URL}/v1/security/oauth2/token`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body
            }
        );

    const data =
        await response
            .json()
            .catch(() => ({}));

    if (
        !response.ok ||
        !data.access_token
    ) {

        throw new Error(
            data.error_description ||
            data.error ||
            "Unable to authenticate with Amadeus"
        );
    }

    amadeusToken =
        data.access_token;

    amadeusTokenExpiresAt =
        Date.now() +
        Math.max(
            60,
            Number(
                data.expires_in || 1799
            ) - 60
        ) *
            1000;

    return amadeusToken;
}


/* =========================================================
   DEMO FLIGHTS
   Used automatically when Amadeus keys
   are not configured.
========================================================= */

function demoFlights(query) {

    const route =
        `${query.origin}-${query.destination}`;

    const date =
        query.departureDate;

    const carriers = [

        [
            "EK",
            "Emirates",
            "EK622",
            0,
            515
        ],

        [
            "QR",
            "Qatar Airways",
            "QR621",
            1,
            430
        ],

        [
            "TK",
            "Turkish Airlines",
            "TK711",
            1,
            455
        ],

        [
            "EY",
            "Etihad Airways",
            "EY241",
            1,
            470
        ]
    ];

    const baseTimes = [
        "02:55",
        "03:35",
        "06:20",
        "20:35"
    ];

    return carriers
        .map((carrier, index) => {

            const [
                code,
                name,
                flightNumber,
                stops,
                price
            ] = carrier;

            const departure =
                `${date}T${baseTimes[index]}:00`;

            const minutes =
                310 + index * 25;

            const arrivalDate =
                new Date(departure);

            arrivalDate.setMinutes(
                arrivalDate.getMinutes() +
                minutes
            );

            const pad =
                number =>
                    String(number)
                        .padStart(2, "0");

            const arrival =
                `${arrivalDate.getFullYear()}-` +
                `${pad(
                    arrivalDate.getMonth() + 1
                )}-` +
                `${pad(
                    arrivalDate.getDate()
                )}T` +
                `${pad(
                    arrivalDate.getHours()
                )}:` +
                `${pad(
                    arrivalDate.getMinutes()
                )}:00`;

            return {

                id:
                    `demo-${route}-${index}-${Date.now()}`,

                airline:
                    code,

                airlineName:
                    name,

                flightNumber,

                origin:
                    query.origin,

                destination:
                    query.destination,

                departureTime:
                    departure,

                arrivalTime:
                    arrival,

                departureLocal:
                    baseTimes[index],

                arrivalLocal:
                    flightLocalTime(arrival),

                durationMinutes:
                    minutes,

                duration:
                    flightDurationLabel(
                        minutes
                    ),

                stops,

                seatsAvailable:
                    Math.max(
                        3,
                        14 - index * 3
                    ),

                aircraft:
                    [
                        "Boeing 777",
                        "Airbus A350",
                        "Boeing 787",
                        "Airbus A320"
                    ][index],

                cabin:
                    query.cabin,

                cabinLabel:
                    query.cabin
                        .replaceAll(
                            "_",
                            " "
                        )
                        .replace(
                            /\b\w/g,
                            letter =>
                                letter.toUpperCase()
                        ),

                price,

                currency:
                    "USD"
            };
        })
        .filter(
            flight =>
                !query.airline ||
                flight.airline ===
                    query.airline
        )
        .slice(
            0,
            query.max
        );
}


/* =========================================================
   LIVE AMADEUS FLIGHT SEARCH
========================================================= */

async function searchAmadeusFlights(
    query
) {

    const token =
        await getAmadeusToken();

    const params =
        new URLSearchParams({

            originLocationCode:
                query.origin,

            destinationLocationCode:
                query.destination,

            departureDate:
                query.departureDate,

            adults:
                String(query.adults),

            travelClass:
                query.cabin,

            max:
                String(query.max)
        });

    if (query.returnDate) {

        params.set(
            "returnDate",
            query.returnDate
        );
    }

    if (query.airline) {

        params.set(
            "includedAirlineCodes",
            query.airline
        );
    }

    const response =
        await fetch(
            `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${params.toString()}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

    const data =
        await response
            .json()
            .catch(() => ({}));

    if (!response.ok) {

        const detail =
            data?.errors?.[0]?.detail ||
            data?.error_description ||
            "Amadeus flight search failed";

        throw new Error(detail);
    }

    const dictionaries =
        data.dictionaries || {};

    return (data.data || [])
        .map(
            (offer, index) => {

                const itinerary =
                    offer.itineraries?.[0] ||
                    {};

                const segments =
                    itinerary.segments ||
                    [];

                const first =
                    segments[0] || {};

                const last =
                    segments[
                        segments.length - 1
                    ] || {};

                const carrier =
                    first.carrierCode ||
                    offer
                        .validatingAirlineCodes?.[0] ||
                    "";

                const minutes =
                    flightMinutes(
                        itinerary.duration
                    );

                const fare =
                    Number(
                        offer.price?.grandTotal ||
                        offer.price?.total ||
                        0
                    );

                const cabin =
                    offer
                        .travelerPricings?.[0]
                        ?.fareDetailsBySegment?.[0]
                        ?.cabin ||
                    query.cabin;

                return {

                    id:
                        offer.id ||
                        `amadeus-${index}`,

                    airline:
                        carrier,

                    airlineName:
                        dictionaries
                            .carriers?.[carrier] ||
                        carrier,

                    flightNumber:
                        `${carrier}${first.number || ""}`,

                    origin:
                        first.departure
                            ?.iataCode ||
                        query.origin,

                    destination:
                        last.arrival
                            ?.iataCode ||
                        query.destination,

                    departureTime:
                        first.departure?.at ||
                        "",

                    arrivalTime:
                        last.arrival?.at ||
                        "",

                    departureLocal:
                        flightLocalTime(
                            first.departure?.at
                        ),

                    arrivalLocal:
                        flightLocalTime(
                            last.arrival?.at
                        ),

                    durationMinutes:
                        minutes,

                    duration:
                        flightDurationLabel(
                            minutes
                        ),

                    stops:
                        Math.max(
                            0,
                            segments.length - 1
                        ),

                    seatsAvailable:
                        offer
                            .numberOfBookableSeats ||
                        null,

                    aircraft:
                        dictionaries
                            .aircraft?.[
                                first.aircraft?.code
                            ] ||
                        first.aircraft?.code ||
                        "",

                    cabin,

                    cabinLabel:
                        cabin
                            .replaceAll(
                                "_",
                                " "
                            )
                            .replace(
                                /\b\w/g,
                                letter =>
                                    letter.toUpperCase()
                            ),

                    price:
                        fare,

                    currency:
                        offer.price?.currency ||
                        "EUR"
                };
            }
        );
}


/* =========================================================
   FLIGHT API STATUS
========================================================= */

app.get(
    "/api/flights/status",
    (req, res) => {

        res.json({

            mode:
                AMADEUS_API_KEY &&
                AMADEUS_API_SECRET
                    ? "live"
                    : "demo",

            environment:
                AMADEUS_ENV
        });
    }
);


/* =========================================================
   FLIGHT SEARCH API
========================================================= */

app.get(
    "/api/flights/search",
    async (req, res) => {

        try {

            const origin =
                flightClean(
                    req.query.origin
                ).toUpperCase();

            const destination =
                flightClean(
                    req.query.destination
                ).toUpperCase();

            const departureDate =
                flightClean(
                    req.query.departureDate
                );

            const returnDate =
                flightClean(
                    req.query.returnDate
                );

            const adults =
                Math.min(
                    9,
                    Math.max(
                        1,
                        Math.floor(
                            Number(
                                req.query.adults ||
                                1
                            )
                        )
                    )
                );

            const cabin =
                flightClean(
                    req.query.cabin ||
                    "ECONOMY"
                ).toUpperCase();

            const airline =
                flightClean(
                    req.query.airline
                ).toUpperCase();

            const max =
                Math.min(
                    50,
                    Math.max(
                        1,
                        Math.floor(
                            Number(
                                req.query.max ||
                                20
                            )
                        )
                    )
                );


            /* =========================
               VALIDATION
            ========================= */

            if (
                !/^[A-Z]{3}$/.test(
                    origin
                ) ||
                !/^[A-Z]{3}$/.test(
                    destination
                )
            ) {

                return res.status(400).json({

                    error:
                        "Origin and destination must be valid 3-letter IATA codes."
                });
            }


            if (
                origin === destination
            ) {

                return res.status(400).json({

                    error:
                        "Origin and destination must be different."
                });
            }


            if (
                !/^\d{4}-\d{2}-\d{2}$/.test(
                    departureDate
                )
            ) {

                return res.status(400).json({

                    error:
                        "A valid departure date is required."
                });
            }


            if (
                returnDate &&
                (
                    !/^\d{4}-\d{2}-\d{2}$/.test(
                        returnDate
                    ) ||
                    returnDate <=
                        departureDate
                )
            ) {

                return res.status(400).json({

                    error:
                        "Return date must be after departure date."
                });
            }


            if (
                ![
                    "ECONOMY",
                    "PREMIUM_ECONOMY",
                    "BUSINESS",
                    "FIRST"
                ].includes(cabin)
            ) {

                return res.status(400).json({

                    error:
                        "Invalid cabin class."
                });
            }


            if (
                airline &&
                !/^[A-Z0-9]{2}$/.test(
                    airline
                )
            ) {

                return res.status(400).json({

                    error:
                        "Airline code must be 2 characters."
                });
            }


            /* =========================
               SEARCH
            ========================= */

            const query = {

                origin,

                destination,

                departureDate,

                returnDate,

                adults,

                cabin,

                airline,

                max
            };


            const live =
                Boolean(
                    AMADEUS_API_KEY &&
                    AMADEUS_API_SECRET
                );


            const results =
                live
                    ? await searchAmadeusFlights(
                        query
                    )
                    : demoFlights(
                        query
                    );


            res.json({

                mode:
                    live
                        ? "live"
                        : "demo",

                results
            });

        } catch (error) {

            console.error(
                "FLIGHT SEARCH ERROR:",
                error
            );

            res.status(502).json({

                error:
                    error.message ||
                    "Flight search failed"
            });
        }
    }
);

/* =========================================================
   SOCKET.IO
========================================================= */

/* =========================================================
   SOCKET.IO
   REAL-TIME CONNECTION ONLY

   IMPORTANT:
   Client is NOT allowed to directly create or update
   bookings through Socket.IO.

   All database changes must pass through authenticated
   HTTP API routes.
========================================================= */

io.on(
    "connection",
    socket => {

        console.log(
            "🔌 Client connected:",
            socket.id
        );

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "🔌 Client disconnected:",
                    socket.id
                );
            }
        );
    }
);
/* =========================================================
   ERROR HANDLING
========================================================= */

process.on(
    "SIGINT",
    () => {

        console.log(
            "\n🛑 Shutting down AirFlow..."
        );

        db.close();

        server.close(
            () => {
                process.exit(0);
            }
        );
    }
);

process.on(
    "SIGTERM",
    () => {

        db.close();

        server.close(
            () => {
                process.exit(0);
            }
        );
    }
);

/* =========================================================
   START SERVER
========================================================= */

// ============================================================
// ADMIN - STAFF / USER MANAGEMENT
// ============================================================

// Get all staff users
app.get("/api/admin/users", requireAdmin, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT
                id,
                username,
                name,
                role,
                active,
                created_at
            FROM users
            ORDER BY id DESC
        `).all();

        res.json(users);
    } catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({
            error: "Could not load staff users"
        });
    }
});

// Create new staff user
app.post("/api/admin/users", requireAdmin, (req, res) => {
    try {
        let { username, password, name, role } = req.body;

        username = String(username || "").trim().toLowerCase();
        name = String(name || "").trim();
        password = String(password || "");
        role = String(role || "worker").trim().toLowerCase();

        if (!username || !password || !name) {
            return res.status(400).json({
                error: "Name, username and password are required"
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                error: "Username must be at least 3 characters"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: "Password must be at least 6 characters"
            });
        }

        if (!["admin", "worker"].includes(role)) {
            return res.status(400).json({
                error: "Invalid role"
            });
        }

        const existingUser = db.prepare(`
            SELECT id
            FROM users
            WHERE LOWER(username) = LOWER(?)
        `).get(username);

        if (existingUser) {
            return res.status(409).json({
                error: "Username already exists"
            });
        }

        const { salt, hash } = createPassword(password);

        const result = db.prepare(`
            INSERT INTO users (
                username,
                password_hash,
                password_salt,
                name,
                role,
                active,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(
            username,
            hash,
            salt,
            name,
            role,
            new Date().toISOString()
        );

        const newUser = db.prepare(`
            SELECT
                id,
                username,
                name,
                role,
                active,
                created_at
            FROM users
            WHERE id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: "Staff account created successfully",
            user: newUser
        });

    } catch (error) {
        console.error("Create user error:", error);

        res.status(500).json({
            error: "Could not create staff account"
        });
    }
});
const NEW_ADMIN_PASSWORD = "admin"; // Apna password likho

if (process.env.RESET_ADMIN_PASSWORD === "true") {
    const password = createPassword(NEW_ADMIN_PASSWORD);

    db.prepare(`
        UPDATE users
        SET
            password_hash = ?,
            password_salt = ?
        WHERE username = 'admin'
    `).run(
        password.hash,
        password.salt
    );

    console.log("✅ Admin password updated successfully.");
    process.exit(0);
}

server.listen(
    PORT,
    () => {

        console.log(
            "======================================"
        );

        console.log(
            `✈️ AirFlow server running on port ${PORT}`
        );

        console.log(
            `🌐 http://localhost:${PORT}`
        );

        console.log(
            `💾 Database: ${isTurso ? "Turso Cloud" : path.join(__dirname, "airflow.db")}`
        );

        console.log(
            "📋 Booking Management API: READY"
        );

        console.log(
            "👤 Customer Management API: READY"
        );

        console.log(
            "🔎 Search API: READY"
        );

        console.log(
            "✏️ Edit Booking API: READY"
        );

        console.log(
            "💰 Payment API: READY"
        );

        console.log(
            "❌ Cancellation API: READY"
        );

        console.log(
            "🔌 Socket.IO: READY"
        );

        console.log(
            "======================================"
        );
    }
);