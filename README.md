# ZakatTrack

ZakatTrack connects donors with verified organizations and lets them follow a donation from payment to the person who received it.
Secure Software Development semester project. Prototype only, no real payments.

- **Frontend:** HTML, CSS, JavaScript (top-level folder)
- **Backend:** Node.js + Express (`server/` folder)
- **Database:** SQLite (`server/data/zakattrack.db`, created automatically; setup script in `server/database/schema.sql`)
- **Security:** bcrypt password hashes, signed JWT (HS256, 1 hour), role-based authorization, server-side validation, parameterised SQL

---

## Run the project (Activity 6)

Requires **Node.js 22.13 or newer** (LTS from https://nodejs.org). Check with `node -v`.

```bash
cd server
npm install
copy .env.example .env      # Windows   (macOS/Linux: cp .env.example .env)
# open server/.env and set JWT_SECRET to a long random value (see the comment in the file)
npm start
```

Then open **http://localhost:3000**. The same server shows the pages and runs the API.
Do not open the HTML files by double-clicking them, because the pages need the server.

| Command | What it does |
|---|---|
| `npm start` | Starts the server. The database and sample data are created on the first start. |
| `npm test` | Runs 57 automated security tests on a temporary database (Task 6 evidence). |
| `npm run reset-db` | Deletes the database and uploads so the next start begins fresh. |

### Demo accounts (test data only)

| Role | Email | Password | Organization |
|---|---|---|---|
| Donor | amna@zakattrack.pk | Donor@1234 | - |
| Donor | usman@zakattrack.pk | Donor@5678 | - |
| NGO Representative | bilal@zakattrack.pk | Ngo@12345 | Noor Zakat Committee |
| NGO Representative | hamza@zakattrack.pk | Ngo@12345 | Al-Khidmat Welfare |
| NGO Representative | sara@zakattrack.pk | Ngo@12345 | Sehat Care Trust |

New donor accounts can be created on the **Create Account** page.

---

## Individual modules

| | Module 1: Beneficiary Registration | Module 2: Donations |
|---|---|---|
| Used by | NGO Representative | Donor (NGO receives and distributes) |
| Frontend | `register-beneficiary.html`, `beneficiary.js`, dashboard "Beneficiaries" | `donate.html`, `track-donations.html`, `donations.js`, dashboard donor views, "Donations Received", "Record Aid Distribution" |
| Backend | `server/routes/beneficiaries.js` | `server/routes/donations.js` |
| Table | `beneficiaries` | `donations` |
| Insert | `POST /api/beneficiaries` (with optional file) | `POST /api/donations` |
| Retrieve | `GET /api/beneficiaries`, `/:ref/cnic`, `/:ref/document` | `GET /api/donations/mine`, `GET /api/donations/received` |
| Update | - | `PATCH /api/donations/:ref/status` |

Both modules use the same server, database, login (`server/routes/auth.js`) and JWT middleware (`server/middleware/auth.js`).

---

## API endpoints

All requests and responses are JSON, except the beneficiary upload (multipart form) and document download.
Protected endpoints need the header `Authorization: Bearer <token>`.
Errors always look like `{ "error": "message", "fields": { "field": "message" } }` with no technical details.

### Authentication

| Method | Endpoint | Access | Description | Responses |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public | Create a donor account. Body: `name, email, password`. Role is always donor. | 201, 400 invalid/weak, 409 email exists |
| POST | `/api/auth/login` | Public | Body: `email, password`. Returns `{ token, user }`. | 200, 400, 401 wrong details, 429 too many attempts |
| GET | `/api/auth/me` | Logged in | Who the token belongs to. | 200, 401 |
| POST | `/api/auth/logout` | Logged in | Revokes the token immediately. | 200, 401 |

### Organizations

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/organizations` | Public | Verified organizations for the Donate page. |

### Module 2: Donations

| Method | Endpoint | Access | Description | Responses |
|---|---|---|---|---|
| POST | `/api/donations` | Donor | Body: `orgId, type, amount, note?, anonymous?` | 201, 400, 401, 403 |
| GET | `/api/donations/mine` | Donor | The logged-in donor's own donations only. | 200, 401, 403 |
| GET | `/api/donations/received` | NGO | Donations to the representative's own organization (anonymous donors hidden). | 200, 401, 403 |
| PATCH | `/api/donations/:ref/status` | NGO (own org) | `{ "status": "Received by NGO" }` or `{ "status": "Distributed", "beneficiaryRef": "B-001" }` | 200, 400, 401, 403, 404, 409 |

### Module 1: Beneficiaries

| Method | Endpoint | Access | Description | Responses |
|---|---|---|---|---|
| POST | `/api/beneficiaries` | NGO | Multipart: `name, cnic, city, need, reason, doc?` (PDF/JPG/PNG, max 2 MB) | 201, 400, 401, 403, 409 duplicate CNIC |
| GET | `/api/beneficiaries` | NGO (own org) | List with masked CNIC. | 200, 401, 403 |
| GET | `/api/beneficiaries/:ref/cnic` | NGO (own org) | Full CNIC, only when asked. | 200, 401, 403, 404 |
| GET | `/api/beneficiaries/:ref/document` | NGO (own org) | Download the supporting document. | 200, 401, 403, 404 |

---

## Security controls (Activity 6)

| Requirement | Where | How |
|---|---|---|
| Server-side login | `routes/auth.js` | The password is checked with `bcrypt.compare` on the server. Wrong email and wrong password get the same message and take the same time. Five failed attempts in 15 minutes are blocked (429). |
| Password hashing | `routes/auth.js`, `db.js` | bcrypt with cost 12. Plain-text passwords are never stored or logged. |
| Signed JWT | `middleware/auth.js` | HS256, expires in 1 hour, issuer and audience checked. Holds only the user id and role. The secret is in `server/.env`, not in the code or on GitHub. |
| Token verification | `middleware/auth.js` | Missing, malformed, modified, expired, wrong-secret, `alg:none` and logged-out tokens all get 401. The user is reloaded from the database on every request. |
| Role-based authorization | `requireRole()` | Donor-only and NGO-only routes return 403 to the other role. NGOs can only touch their own organization's records (otherwise 404). |
| Server-side validation | `validation.js` | Required fields, lengths, formats, allowed lists, whole-number amounts, password strength. The browser checks cannot be bypassed. |
| SQL injection | all routes | Every query uses prepared statements with `?` placeholders. User input is never joined into SQL text. |
| Safe file upload | `routes/beneficiaries.js` | Extension list, 2 MB limit, file content (magic bytes) must match, random file name on disk, download only with a token. |
| Safe errors | `server.js` | Users get short messages. Technical details go only to the server console. |
| Data exposure | | Only top-level page files are served (the `server` folder, database and `.env` return 404). CNIC is masked by default. Donors see beneficiaries by initials only. API responses are not cached. |
| XSS (from Activity 5) | frontend | All server data is shown with `textContent`/`createElement`. A Content-Security-Policy header blocks inline scripts. |
| Browser storage (Activity 5 Task 4) | `api.js` | sessionStorage keeps only the JWT and the name/role/organization. Logout revokes the token on the server and clears storage. |

> Frontend checks are for user convenience. The real enforcement is in the backend.

---

## Activity 6 test evidence

Run `cd server && npm test` and take a screenshot. It covers every Task 6 item:

1. Successful login and JWT generation
2. Protected endpoint with a valid token
3. Missing / invalid / modified / expired tokens rejected
4. Role-based restrictions (donor vs NGO, and NGO of another organization)
5. Submit and retrieve data for Module 1 and Module 2
6. Password hashing, SQL injection attempts, file upload rejection, safe errors and logout

Manual browser checks: log in as `amna` and donate, then see it in Donation History. Log in as `bilal`, mark it received, distribute it and register a beneficiary. Then log back in as `amna` and the donation shows "Distributed".
In DevTools (F12) > Network, the login response contains the JWT, and protected requests send `Authorization: Bearer ...`.

---

## Hosting note (GitHub Pages)

GitHub Pages only hosts static files. It cannot run the Node.js backend or the database.
For the class demo, run the server locally (`npm start`) and use http://localhost:3000.

To make the GitHub Pages site work too, deploy the `server` folder to a Node host (for example Render):
1. Set the Root Directory to `server`, the build command to `npm install` and the start command to `npm start`.
2. Add these environment variables: `JWT_SECRET` (a long random value), `ALLOWED_ORIGINS=https://<username>.github.io`, `TRUST_PROXY=1`.
3. Put the backend URL in `config.js` (`BACKEND_FOR_GITHUB_PAGES`).

On free hosting plans, the SQLite file can reset when the service restarts.
