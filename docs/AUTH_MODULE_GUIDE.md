# Authentication Module Guide

This guide documents the five backend files responsible for registration, login, session renewal, protected endpoints, profile management, and password reset.

## Module flow

```text
Frontend login form
  -> POST /api/auth/login
  -> AuthService validates password
  -> access token + refresh token returned
  -> frontend stores tokens in localStorage

Protected API request
  -> Authorization: Bearer <access token>
  -> get_current_user verifies token and loads the user

Expired access token
  -> POST /api/auth/refresh
  -> AuthService validates and rotates refresh token
  -> frontend retries the original request
```

## 1. `backend/app/api/auth.py` — API routes

This is the HTTP layer. It accepts requests from the frontend, calls `AuthService`, and returns a response or a proper HTTP error. It should not contain password-hashing or database business logic.

### Helper: `profile_payload(user)`

Builds the safe profile object returned to the frontend. It includes the user's name, email, organization, job title, profile image, role, and selected theme. Password data is never returned.

### `POST /api/auth/register` — `register()`

Accepts `RegisterRequest`, creates an `AuthService`, and calls `register_user()`. It returns HTTP `201` for a new account. A duplicate email becomes HTTP `400`.

### `POST /api/auth/login` — `login()`

Accepts an email and password. It calls `login_user()` and returns the access token, refresh token, and basic user details. Invalid credentials become HTTP `401`.

### `POST /api/auth/refresh` — `refresh_access_token()`

Accepts a saved refresh token from the browser. It calls `refresh_session()` to create a new access token and replace the old refresh token. This is why an active user is not logged out when the short access token expires.

### `GET /api/auth/me` — `me()`

Uses `get_current_user` as a dependency. FastAPI checks the bearer token before this function runs, then this route returns the signed-in user's profile.

### `PUT /api/auth/me` — `update_profile()`

Updates editable profile fields. It first checks that another user does not already own the requested email. Since the email is part of the token identity, it also returns a newly created access token after a successful update.

### `PUT /api/auth/theme` — `update_theme()`

Stores either `light` or `dark` as the user's selected dashboard theme.

### `POST /api/auth/me/avatar` — `upload_profile_avatar()`

Accepts a PNG or JPG profile image up to 2 MB. The image is stored locally in the profile upload folder and its relative path is saved on the user record.

### `DELETE /api/auth/me/avatar` — `delete_profile_avatar()`

Clears the image path from the database and removes the local file if it exists.

### `POST /api/auth/forgot-password` — `forgot_password()`

Always returns a safe success response so an attacker cannot discover whether an email is registered. `AuthService` sends a reset link only when the user exists.

### `POST /api/auth/reset-password` — `reset_password()`

Receives a reset token and a new password, then delegates validation and password replacement to `AuthService`.

## 2. `backend/app/services/auth_service.py` — business logic

This service contains the authentication rules. It works with `UserRepository`, password helpers, JWT helpers, refresh-token records, and the email service.

### `AuthService.__init__(db)`

Receives one SQLAlchemy database session. It creates a `UserRepository` and also keeps the session for refresh-token writes.

### `_create_refresh_token(user_id)`

Creates a cryptographically random refresh token and saves it in the `refresh_tokens` table with an expiry date. It returns the token string to the caller. The frontend stores this token and uses it only to renew an expired access token.

### `_access_token_for(user)`

Creates the short-lived JWT access token. Its payload identifies the user by email and includes the user's role.

### `register_user(request)`

Checks whether the email already exists, hashes the password, creates the `User` entity, and saves it through `UserRepository`.

### `login_user(email, password)`

Loads the user, checks the submitted password against the stored hash, then creates both access and refresh tokens. Invalid credentials always receive the same error message.

### `refresh_session(refresh_token)`

Finds the stored refresh token and verifies that it is not revoked or expired. It loads the user, revokes the old refresh token, creates a replacement, and returns a new access token. This token rotation protects against reuse of an old refresh token.

### `forgot_password(email)`

Looks up the user. If found, it creates a short reset JWT and sends the reset link through `send_reset_email`. If not found, it still returns the same generic success message.

### `reset_password(token, new_password)`

Validates the reset JWT, finds the linked user, hashes the new password, and commits the new password hash to PostgreSQL.

## 3. `backend/app/schemas/auth.py` — request and response validation

This file defines Pydantic models. FastAPI uses them to validate request JSON before route logic executes.

### `RegisterRequest`

Requires a full name from 3 to 100 characters, a valid email address, and a password from 8 to 128 characters.

### `LoginRequest`

Requires a valid email address and a password for login.

### `RefreshTokenRequest`

Requires the refresh token sent by the frontend when the access token has expired.

### `ProfileUpdateRequest`

Defines the editable profile fields: name, email, organization, and job title. Optional fields have maximum lengths to keep database input safe.

### `ForgotPasswordRequest` and `ResetPasswordRequest`

Define the email for a reset request, then the reset token and replacement password for completion.

### `TokenResponse`, `UserResponse`, and `MessageResponse`

Reusable response shapes for token, user, and generic success-message endpoints. These keep API responses predictable for the frontend.

## 4. `backend/app/security/jwt.py` — JSON Web Token helpers

This file creates and validates signed JWT tokens. It reads the signing key, algorithm, and expiry values from `app.config.settings`.

### `create_access_token(data)`

Copies the supplied identity data, adds an expiration timestamp using `ACCESS_TOKEN_EXPIRE_MINUTES`, signs it, and returns the JWT string. This token is used in the `Authorization` header.

### `verify_token(token)`

Verifies the signature and expiry of an access token. It returns the decoded payload when valid, or `None` for a bad, modified, or expired token.

### `create_reset_token(email)`

Creates a separate JWT for password reset. It includes `type: password_reset` and uses the shorter 15-minute reset-token expiry.

### `verify_reset_token(token)`

Verifies the reset JWT and confirms its `type` is `password_reset`. It returns the email only for a valid reset token.

## 5. `backend/app/security/oauth.py` — protected-route guard

This file is used by every backend route that requires a signed-in user.

### `oauth2_scheme`

Tells FastAPI where the bearer token is expected. It reads `Authorization: Bearer <token>` from incoming protected requests.

### `get_current_user(token, db)`

This is a FastAPI dependency. It verifies the access token, reads the email from its `sub` claim, loads the actual user record from PostgreSQL, and returns that user to the protected route. Invalid tokens return HTTP `401`; a token pointing to a deleted user returns HTTP `404`.

## Files used by this module

The five files above rely on a few supporting files:

- `app/models/user.py` stores user fields and password hashes.
- `app/models/refresh_token.py` stores refresh-token sessions.
- `app/repositories/user_repository.py` performs user database queries.
- `app/security/hashing.py` hashes and verifies passwords.
- `app/services/email_service.py` sends password-reset email.
- `frontend/lib/api.ts` stores tokens, refreshes expired access tokens, and redirects to login only when no usable session remains.

---

# Application Modules and LLM Analysis Guide

## 6. Dashboard module

### Main files

- `backend/app/api/dashboard.py`
- `backend/app/services/dashboard_service.py`
- `backend/app/repositories/dashboard_repository.py`
- `backend/app/schemas/dashboard.py`
- `frontend/app/dashboard/page.tsx`

### Purpose

The dashboard is a read-only overview of the signed-in user's document library. It does not call the LLM. It reads information that was already saved after upload, analysis, and report generation.

### API routes

- `GET /api/dashboard/` returns the complete dashboard payload in one request: overview cards, risk distribution, and monthly report history.
- `GET /api/dashboard/overview` returns only the four top metrics.
- `GET /api/dashboard/risk-distribution` returns safe, moderate, and high clause percentages.
- `GET /api/dashboard/analysis-history` returns month-by-month report totals and average risk score.

Every route uses `get_current_user`, so one user can see only their own documents, clauses, reports, and statistics.

### `DashboardService`

- `get_overview(user_id)` calculates document count, analyzed-document count, clause count, report count, and average overall risk score.
- `get_risk_distribution(user_id)` converts stored clause levels into safe/moderate/high percentages.
- `get_analysis_history(user_id)` groups generated reports by `YYYY-MM`, calculates the number of reports and the average risk score per month, and returns ordered graph data.

### `DashboardRepository`

The repository contains the PostgreSQL queries. It joins `documents` with `document_analyses`, `clauses`, and `reports` but always filters by `documents.user_id`. This is the layer that enforces per-user dashboard data.

### Frontend dashboard

`frontend/app/dashboard/page.tsx` makes two authenticated calls:

1. `/api/dashboard/` for cards, chart, and distribution.
2. `/api/upload/` for the five most recent documents.

The chart uses Recharts. It fills all months from January through the current month with zero values where no report exists, then draws the report-count line from actual report data.

## 7. Upload and Documents module

### Main files

- `backend/app/api/upload.py`
- `backend/app/services/upload_service.py`
- `backend/app/models/document.py`
- `frontend/app/upload/page.tsx`
- `frontend/app/documents/page.tsx`

### Upload API routes

- `POST /api/upload/` validates and stores a PDF or DOCX file.
- `GET /api/upload/` returns all documents owned by the signed-in user.
- `DELETE /api/upload/{document_id}` removes the database record and local file.
- `GET /api/upload/{document_id}/preview` returns the file inline for browser preview; it does not force a download.
- `POST /api/upload/{document_id}/analysis-jobs` creates an analysis job and immediately returns progress information.
- `GET /api/upload/{document_id}/analysis-jobs/{job_id}` lets the frontend poll the current job status.

### `UploadService.save_document()`

This is the upload pipeline:

1. verifies file type and maximum size;
2. reads text from the PDF or DOCX;
3. checks whether the file looks like a legal document;
4. checks the SHA-256 hash to prevent duplicate uploads for the same user;
5. saves the original file locally using a generated stored filename;
6. stores document metadata, path, hash, page count, and status in PostgreSQL;
7. creates a PDF preview for DOCX files so both formats can be viewed in the same frontend component.

### Legal-document guard

`_ensure_is_legal_document()` calls the LLM classifier when it is available. If that call is unavailable, it falls back to local legal-keyword signals. A non-legal file is rejected before it is stored in the database or local storage.

### Document list UI

The Documents page displays stored metadata from `GET /api/upload/`: filename, upload date, clause count, overall risk level, analysis state, and links to analysis/report pages. The document card uses the saved overall analysis score; it does not calculate a new risk score in the browser.

## 8. Analysis module

### Main files

- `backend/app/services/upload_service.py`
- `backend/app/models/document_analysis.py`
- `backend/app/models/analysis_job.py`
- `backend/app/models/clause.py`
- `backend/app/workflows/extraction_workflow.py`
- `frontend/app/analysis/[documentId]/page.tsx`

### Analysis-job lifecycle

1. The user presses **Analyze** on an uploaded document.
2. `create_analysis_job()` creates an `analysis_jobs` record and a queued `document_analyses` record.
3. FastAPI starts `process_analysis_job()` as a background task.
4. The task marks the job as running and calls `analyze_pdf()`.
5. `analyze_pdf()` extracts text, asks the LLM for clause/risk data, saves clauses and report data, and completes the original queued analysis row.
6. The frontend polls the job endpoint until it is completed, then redirects to the Analysis page.

### `analyze_pdf()`

This is the main analysis coordinator. It:

- loads the stored file only after confirming ownership;
- extracts text and page count;
- runs legal-document validation again as a defensive check;
- calls `extract_clause_risks()`;
- clamps AI-estimated page numbers to a real page number;
- creates or completes a `document_analyses` row;
- saves every clause in the `clauses` table;
- saves an initial report in the `reports` table;
- updates the parent `documents` row to `analyzed`.

The completed analysis contains the overall score, risk level, summary, raw report payload, selected model name, prompt version, and timestamps. Each clause contains its source excerpt, simple-English version, risk reason, suggested negotiation language, and source page.

### Analysis page UI

`frontend/app/analysis/[documentId]/page.tsx` loads the saved analysis and PDF preview. It renders the whole document with `react-pdf`, keeps scrolling inside the preview panel, and displays saved clauses in the right panel. Selecting a clause:

- opens its detail card;
- switches between Original, Plain English, Risk, and Negotiate views;
- searches text-layer spans in the PDF;
- highlights matching source text in red/pink for high risk, yellow for moderate risk, or green for safe clauses.

The page is a viewer for saved analysis data. It does not call the LLM again.

## 9. Report module

### Main files

- `backend/app/workflows/report_workflow.py`
- `backend/app/schemas/report.py`
- `backend/app/models/report.py`
- `backend/app/services/upload_service.py`
- `frontend/app/reports/[documentId]/page.tsx`

### `build_report()`

Builds the structured report from extracted `ClauseRisk` objects. It calculates:

- overall risk score: average of clause risk scores;
- risk label: Safe below 45, Moderate from 45 to 74, High Risk from 75 upward;
- high, moderate, safe, and negotiable clause totals;
- top five clauses ordered by risk score;
- negotiation terms for every clause marked negotiable;
- a seven-line plain-English contract summary.

### `generate_narratives()`

Calls the LLM to create a short natural title and a 2–3 sentence plain-English explanation for every extracted clause. The narrative prompt directs the model to explain what the clause means, why it matters, and a negotiation suggestion when appropriate. It supports English, Hindi, Gujarati, Spanish, and French.

### Report API behavior

`GET /api/upload/{document_id}/report?language=en` first checks whether a completed report already exists in PostgreSQL. If it does, the saved report is returned. If another supported language is requested and no saved version exists, the system uses the stored clause findings to build that language's report, then saves it for future use.

### Report page UI

The report page displays a score ring whose color matches the risk label: green for Safe, yellow for Moderate, and red for High Risk. It also shows the risk counters, ranked risks, every negotiable term, and the full contract summary. It reads saved report data and does not re-analyze the PDF on every page visit.

## 10. LLM and multi-agent design

### LLM client

`backend/app/services/llm_providers/groq_client.py` is the one place that communicates with Groq. It:

- reads the API key and model name from environment variables;
- sends a chat-completions request;
- supports plain text and JSON-only replies;
- retries a rate-limited or timed-out request once;
- raises `GroqClassificationError` for connection, provider, or JSON parsing errors.

No API key is sent to the frontend or stored in the database.

### LLM tasks used today

1. **Legal-document classifier** — `classify_document()` decides whether an uploaded file is a legal document and returns a confidence score and document type.
2. **Clause/risk extractor** — `extract_clause_risks()` returns structured JSON for each meaningful clause: risk level, risk score, source excerpt, estimated page, and whether it is negotiable.
3. **Plain-English narrative writer** — `generate_narratives()` writes human-friendly clause titles and explanations in the requested language.

### Current multi-agent behavior

The backend now runs a structural extraction agent followed by three focused specialist agents using separate prompts and LLM calls: Plain Language, Risk, and Negotiation. All three receive the same original clause facts, produce only their assigned output, and the coordinator merges them into the saved clause record. They use the selected report language, while the original document excerpt remains unchanged.

### Recommended next improvement

For true parallel multi-agent execution, split the extraction work into separate specialist tasks (for example: liability, payment, termination, employment, privacy, and dispute-resolution reviewers), run them concurrently through a job queue, merge and de-duplicate their clause findings, then send the merged result to the report narrator. Save each specialist's status and raw output in `document_analyses.raw_analysis` or a dedicated agent-runs table.
