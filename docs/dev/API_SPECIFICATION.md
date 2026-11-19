# GrowHub API Specification

| Item | Detail |
| :--- | :--- |
| Product | GrowHub, a configurable knowledge-sharing and gamification platform for organisations |
| API version | v1 |
| Document version | 1.0 (draft for architecture review) |
| Document date | 19 November 2026 |
| Document status | Awaiting technical lead approval |
| Sources | [SRS v1.2](SRS.md), [System Architecture Document v1.0](ARCHITECTURE.md), [Database Design Document v1.0](DATABASE.md), [Use Case Specification v1.1](USE_CASES.md) |

## How to read this document

This document specifies the GrowHub REST API used by the web and mobile clients. It is the normative source for the OpenAPI 3.1 document (`api/openapi.yaml`) that the delivery team will maintain and use to generate typed clients (architecture Section 7).

- Sections 1 to 5 define rules that apply to every endpoint. Endpoint definitions do not repeat them.
- Sections 6 to 20 define every endpoint, grouped by function. Each group starts with a catalogue table, followed by details for endpoints whose request or behaviour needs explanation.
- IDs such as FR-xx, IR-xx, and QR-xx refer to the SRS. UC-xx refers to the use case specification. SET-xx refers to the BRD.

## Contents

1. [Conventions](#1-conventions)
2. [Authentication and session states](#2-authentication-and-session-states)
3. [Access levels](#3-access-levels)
4. [Errors](#4-errors)
5. [Common objects](#5-common-objects)
6. [Public](#6-public)
7. [Authentication](#7-authentication)
8. [Profile and personal data](#8-profile-and-personal-data)
9. [Home, feed, and content](#9-home-feed-and-content)
10. [Files and uploads](#10-files-and-uploads)
11. [Engagement](#11-engagement)
12. [Review](#12-review)
13. [Communities](#13-communities)
14. [Learning](#14-learning)
15. [Gamification](#15-gamification)
16. [Notifications](#16-notifications)
17. [Help and support tickets](#17-help-and-support-tickets)
18. [Administration: setup and organisation](#18-administration-setup-and-organisation)
19. [Administration: users, moderation, and gamification](#19-administration-users-moderation-and-gamification)
20. [Administration: audit, reports, and privacy](#20-administration-audit-reports-and-privacy)
21. [Operations](#21-operations)
22. [Endpoint index](#22-endpoint-index)

---

## 1. Conventions

### 1.1 Base URL and versioning

| Item | Rule |
| :--- | :--- |
| Base URL | `https://{installation-host}/api/v1` |
| Versioning | The major version is in the path. Breaking changes require `v2`. The previous version is supported for 6 months after a new version is released (IR-08). |
| Non-breaking changes | New endpoints, new optional request fields, new response fields, and new error codes. Clients must ignore unknown response fields. |
| Mobile compatibility | The mobile client reads `min_app_version` from `GET /public/branding` and asks the user to update when it is older (architecture Section 14.3). |

### 1.2 Formats

| Item | Rule |
| :--- | :--- |
| Media type | `application/json; charset=utf-8`, except uploads (`multipart/form-data`) and file downloads |
| Field names | `snake_case` |
| Identifiers | UUIDv7 strings |
| Timestamps | ISO 8601 in UTC with `Z`, for example `2026-11-19T03:15:00Z`. Clients convert to the organisation's time zone for display (IR-04). |
| Organisation dates | `YYYY-MM-DD`, a day in the organisation's time zone, for example holidays and active days |
| Enumerations | Lowercase `snake_case` strings, for example `in_progress` |
| Empty values | Optional fields that have no value are returned as `null`, not omitted |
| Text content | Content bodies, module bodies, FAQ answers, and the data-use notice are Markdown (ADR-09) |

### 1.3 Response envelope

Successful responses with a body use this envelope:

```json
{
  "data": { },
  "meta": { }
}
```

- `data` is an object for single resources and an array for lists.
- `meta` is present on lists and on responses that carry extra information.
- `204 No Content` responses have no body.

### 1.4 Pagination

List endpoints accept `page` (default 1) and `per_page` (default 20, maximum 100) and return:

```json
{
  "data": [ ],
  "meta": { "page": 1, "per_page": 20, "total": 134, "last_page": 7 }
}
```

### 1.5 Filtering, sorting, and search

| Parameter | Form | Example |
| :--- | :--- | :--- |
| Filter | `filter[<field>]=<value>`; repeat or comma-separate for several values | `filter[status]=pending,rejected` |
| Sort | `sort=<field>`; prefix `-` for descending; endpoints list allowed values | `sort=-published_at` |
| Search | `q=<text>`, at least 2 characters | `q=stock count` |

Unknown filter or sort values return `422 validation_failed`.

### 1.6 Language

- The API reads `Accept-Language` (`id` or `en`). Without it, the user's language is used, then the SET-10 default.
- Error messages and server-generated text, such as notification text, are returned in that language.
- The response header `Content-Language` states the language used.

### 1.7 Idempotency

- `POST` endpoints that create resources accept an `Idempotency-Key` header of 8–64 characters.
- A repeated request with the same key and body within 24 hours returns the original response.
- The same key with a different body returns `422 idempotency_key_reused`.
- `PUT` and `DELETE` endpoints are idempotent by design, for example `PUT /contents/{id}/like`.

### 1.8 Rate limiting

| Scope | Limit |
| :--- | :--- |
| Sign-in per employee ID | 5 failures in 15 minutes, then blocked for 15 minutes (FR-AUTH-05) |
| Sign-in per network address | 50 attempts in 15 minutes (FR-AUTH-06) |
| One-time codes per user | Resend wait from SET-09 [60 seconds]; 5 codes per hour (FR-OTP-05) |
| General API per user | 300 requests per minute |
| Uploads per user | 30 per 10 minutes |

Responses include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`. A `429` response also includes `Retry-After` in seconds.

### 1.9 Request tracing

Every response includes `X-Request-Id`. Clients may send their own `X-Request-Id`, which the service keeps if it is a valid UUID. Error bodies repeat it as `request_id`.

## 2. Authentication and session states

### 2.1 Web client

The web SPA uses a cookie session (ADR-06).

1. `GET /sanctum/csrf-cookie` sets the `XSRF-TOKEN` cookie.
2. Every state-changing request sends the cookie value in the `X-XSRF-TOKEN` header.
3. `POST /api/v1/auth/sign-in` with `"client": "web"` creates the session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`).
4. The session expires after the SET-11 idle timeout [30 minutes].

### 2.2 Mobile client

1. `POST /api/v1/auth/sign-in` with `"client": "mobile"` returns a `token` once.
2. The client stores it in secure storage and sends `Authorization: Bearer <token>` on every request.
3. The token expires at the SET-11 mobile validity [30 days] after creation.

### 2.3 Session states

After sign-in, a session moves through these states. The current state is returned by sign-in and by `GET /auth/session`.

| State | Meaning | Allowed endpoints |
| :--- | :--- | :--- |
| `requires_activation` | The account must verify its email and set a new password (FR-AUTH-11) | Section 7 activation endpoints, `GET /auth/session`, `POST /auth/sign-out`, public endpoints |
| `requires_acknowledgement` | The ethics notice must be acknowledged in this session (FR-AUTH-12) | `GET /auth/ethics-notice`, `POST /auth/acknowledgement`, `POST /me/email/verify`, `GET /auth/session`, `POST /auth/sign-out`, public endpoints |
| `ready` | Full access according to role | All endpoints allowed for the role |

A request to an endpoint not allowed in the current state returns `403` with `activation_required` or `acknowledgement_required`.

### 2.4 Request pipeline errors

The service checks every protected request in the order defined in architecture Section 8.2. The first failing check determines the error:

| Order | Check | Error |
| :---: | :--- | :--- |
| 1 | Rate limit | `429 too_many_requests` |
| 2 | Setup complete, unless the user is an administrator | `403 setup_incomplete` |
| 3 | Valid session or token | `401 unauthenticated` |
| 4 | Account active | `403 account_deactivated` |
| 5 | Within rollout scope | `403 outside_rollout_scope` |
| 6 | Activated | `403 activation_required` |
| 7 | Acknowledged in this session | `403 acknowledgement_required` |
| 8 | Role permission | `403 forbidden` |
| 9 | Record visible to the user | `404 not_found` (FR-ACL-02) |

## 3. Access levels

Endpoint tables use these access codes. Each code includes the roles listed. Access follows the permission matrix in SRS Section 8.6.

| Code | Who |
| :--- | :--- |
| **Public** | Anyone, without a session |
| **Session** | Any signed-in user in any session state, for the endpoints listed in Section 2.3 |
| **User** | Any user in state `ready`: Employee, Reviewer, Administrator, Support Agent, and Learning Author |
| **Reviewer** | Reviewer and Administrator |
| **Author** | Administrator, and Learning Author when SET-06 enables that role |
| **Handler** | Administrator, and Support Agent when SET-05 enables that role |
| **Admin** | Administrator |
| **Owner** | The user who owns the record, in addition to the code it is paired with |

All endpoints except **Public** endpoints and `/sanctum/csrf-cookie` require a session.

Endpoints for **Reviewer**, **Author**, **Handler**, and **Admin** are web functions. The mobile client does not call them (FR-ACL-03).

## 4. Errors

### 4.1 Error format

Errors use RFC 9457 Problem Details with GrowHub extensions:

```json
{
  "type": "https://growhub.dev/errors/validation_failed",
  "title": "The given data was invalid.",
  "status": 422,
  "code": "validation_failed",
  "detail": null,
  "errors": {
    "title": [{ "code": "too_long", "message": "Title may not exceed 200 characters.", "max": 200 }]
  },
  "request_id": "01934a2e-7c1b-7f00-9a4e-3b1f0c2d4e5f"
}
```

| Field | Meaning |
| :--- | :--- |
| `type`, `title`, `status`, `detail` | RFC 9457 fields; `title` and `detail` are localised |
| `code` | Stable machine-readable error code from Section 4.2. Clients rely on this, not on text |
| `errors` | Field errors for `validation_failed`, keyed by field path such as `tags.3` |
| Extra members | Some codes add members, listed in Section 4.2 |
| `request_id` | Correlates with server logs |

### 4.2 Error codes

| Status | Code | When | Extra members |
| :---: | :--- | :--- | :--- |
| 400 | `bad_request` | Malformed JSON or unreadable request | |
| 401 | `unauthenticated` | No valid session or token, or the session expired | |
| 401 | `invalid_credentials` | Unknown employee ID or wrong password; same message for both (FR-AUTH-03) | |
| 403 | `setup_incomplete` | Setup is not complete and the user is not an administrator (FR-SET-02) | |
| 403 | `account_deactivated` | The account is deactivated (FR-AUTH-04) | |
| 403 | `outside_rollout_scope` | The user's unit is outside SET-12 (FR-ORG-05) | |
| 403 | `activation_required` | Session state is `requires_activation` | |
| 403 | `acknowledgement_required` | Session state is `requires_acknowledgement` | |
| 403 | `forbidden` | The role does not permit the action | |
| 403 | `self_review_forbidden` | A reviewer acts on their own submission (FR-REV-04) | |
| 404 | `not_found` | The record does not exist or the user may not see it | |
| 409 | `invalid_state` | The action is not allowed in the record's current state, for example approving an item that is no longer Pending (FR-REV-05) | `current_state` |
| 409 | `already_completed` | The module was already completed (FR-LRN-05) | `completed_at` |
| 409 | `last_administrator` | The action would leave no active administrator (FR-USR-10) | |
| 409 | `last_required_item` | The action would remove the last category, department, level, ticket category, or ethics policy (RUL-52) | `item_type` |
| 409 | `confirmation_required` | The action has side effects that need confirmation; repeat with `"confirm": true` (FR-SET-11) | `impact` |
| 409 | `setting_conflict` | A setting change would make existing data invalid (FR-SET-12) | `conflicts` (up to 50) |
| 409 | `file_not_ready` | The file has not passed the malware scan yet | `scan_status` |
| 409 | `community_archived` | The community is archived (FR-COM-04) | |
| 410 | `code_expired` | The one-time code has expired, was used, or was replaced (FR-OTP-04) | |
| 413 | `file_too_large` | The file exceeds its size limit | `max_bytes` |
| 415 | `unsupported_media_type` | The request or file type is not accepted (FR-ATT-02) | `allowed` |
| 422 | `validation_failed` | One or more fields are invalid | `errors` |
| 422 | `employee_id_format` | The employee ID does not match SET-02 (FR-AUTH-02) | `label`, `charset`, `min`, `max` |
| 422 | `code_invalid` | Wrong one-time code | `remaining_attempts` |
| 422 | `code_attempts_exhausted` | The attempt limit is reached; request a new code | |
| 422 | `file_infected` | The malware scan rejected the file | |
| 422 | `import_invalid` | The import file has invalid rows (FR-IMP-04) | `errors` by row |
| 422 | `idempotency_key_reused` | The key was used with a different body | |
| 429 | `too_many_requests` | A rate limit was reached | `retry_after` |
| 429 | `resend_too_soon` | A new code was requested before the resend wait | `resend_available_at` |
| 500 | `server_error` | Unexpected error | |
| 503 | `service_unavailable` | Maintenance or a dependency is down | `retry_after` |

### 4.3 Field error codes

| Code | Meaning | Extra members |
| :--- | :--- | :--- |
| `required` | Missing or empty | |
| `too_short`, `too_long` | Length outside the limit | `min` or `max` |
| `out_of_range` | Number outside the allowed range | `min`, `max` |
| `invalid_format` | Wrong format, for example an email | |
| `invalid_value` | Not one of the allowed values | `allowed` |
| `not_unique` | Value already used | |
| `domain_not_allowed` | Email domain not in SET-16 | `allowed` |
| `inactive_reference` | Refers to a retired or inactive record | |
| `not_member` | The author is not a member of the selected community (FR-CNT-05) | |
| `too_many` | Too many items, for example tags or attachments | `max` |
| `password_too_short` | Shorter than SET-15 | `min` |
| `password_matches_employee_id` | Same as the employee ID (RUL-04) | |
| `confirmation_mismatch` | Confirmation field differs | |

## 5. Common objects

Objects are shown with their fields. Field types use JSON types. `?` marks a field that can be `null`.

### 5.1 UserSummary

Returned wherever another user is shown. Never includes employee ID or email (FR-PRF-06).

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | string | |
| `name` | string | "Former employee" when deactivated with content retained, or anonymised (FR-USR-14) |
| `photo_url` | string? | Authorised file URL |
| `department` | UnitRef? | |
| `location` | UnitRef? | |
| `position` | UnitRef? | |
| `level` | LevelRef? | |
| `is_former_employee` | boolean | |

`UnitRef` is `{ "id", "name" }`. `LevelRef` is `{ "id", "number", "name" }`.

### 5.2 Me

The signed-in user's own profile (FR-PRF-01).

| Field | Type | Notes |
| :--- | :--- | :--- |
| All UserSummary fields | | |
| `employee_id` | string | |
| `email` | string | |
| `pending_email` | string? | New email waiting for verification |
| `role` | string | `employee`, `reviewer`, `administrator`, `support_agent`, `learning_author` |
| `effective_role` | string | Role after SET-05 and SET-06; a disabled optional role becomes `employee` (FR-SET-13) |
| `permissions` | string[] | Permission names, for example `content.review`, `tickets.handle` |
| `language` | string? | `id` or `en`; `null` uses the default |
| `total_points` | integer | |
| `communities` | string[] | IDs of joined communities |

### 5.3 ContentSummary and Content

`ContentSummary` is used in lists:

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | string | |
| `title` | string | |
| `excerpt` | string | First 200 characters of the body as plain text |
| `status` | string | `draft`, `pending`, `published`, `rejected`, `removed` |
| `author` | UserSummary | |
| `category` | CategoryRef? | `{ "id", "name" }` |
| `community` | CommunityRef? | `{ "id", "name" }` |
| `tags` | string[] | |
| `media_types` | string[] | `image`, `video`, `document` |
| `thumbnail_url` | string? | First image attachment |
| `counts` | object | `{ "views", "likes", "saves", "shares", "comments" }` |
| `viewer` | object | `{ "liked": boolean, "saved": boolean }` for the current user |
| `published_at` | string? | |
| `updated_at` | string | |

`Content` adds:

| Field | Type | Notes |
| :--- | :--- | :--- |
| `body` | string | Markdown |
| `attachments` | Attachment[] | |
| `visibility` | string | `all_employees` or `community_members` (FR-CNT-06) |
| `rejection_note` | string? | Latest note; only for the author, reviewers, and administrators (FR-CNT-09) |
| `first_submitted_at`, `last_submitted_at` | string? | Only for the author, reviewers, and administrators |
| `allowed_actions` | string[] | For example `edit`, `submit`, `withdraw`, `remove`, `approve`, `reject`, `comment` |

`allowed_actions` lets clients show only valid actions. The service still enforces every rule.

### 5.4 Attachment

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | string | File ID |
| `name` | string | Original file name |
| `media_type` | string | `image`, `video`, `document` |
| `mime_type` | string | |
| `size_bytes` | integer | |
| `url` | string | `/api/v1/files/{id}`; requires a session (FR-ATT-04) |
| `scan_status` | string | `pending`, `clean`, `infected` |

### 5.5 Comment

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | string | |
| `author` | UserSummary | |
| `body` | string | |
| `parent_id` | string? | |
| `replies` | Comment[] | Only on top-level comments; one level deep (FR-ENG-04) |
| `created_at` | string | |
| `allowed_actions` | string[] | `reply`, `remove`, `remove_for_violation` |

### 5.6 Other objects

| Object | Fields |
| :--- | :--- |
| Community | `id`, `name`, `focus`, `member_count`, `is_member`, `is_archived`, `created_by` (UserSummary?), `created_at` |
| Module | `id`, `title`, `field`, `difficulty`, `duration_minutes`, `description`, `body` (detail only), `media` (Attachment[], detail only), `status`, `completed_at` (current user), `published_at` |
| Level | `id`, `number`, `name`, `description`, `min_points`, `is_active` |
| Badge | `id`, `name`, `description`, `criterion`, `threshold`, `is_active`, `awarded_at` (current user, when earned) |
| PointTransaction | `id`, `amount`, `rule_key` (string?), `reason` (string?), `related` (`{ "type", "id", "title" }`?), `created_at` |
| Notification | `id`, `type`, `text` (localised), `related` (`{ "type", "id" }`?), `read_at`, `created_at` |
| Ticket | `id`, `subject`, `category` (`{ "id", "name" }`), `message`, `status`, `responses` (detail only), `created_at`, `first_response_at`, `resolved_at`, `is_overdue` (handlers only) |
| TicketResponse | `id`, `handler` (UserSummary), `message`, `created_at` |
| Faq | `id`, `topic`, `question`, `answer` (placeholders already replaced) |

## 6. Public

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/public/branding` | Public | Organisation name, logo, time zone, languages, employee ID format, and setup state | IR-02, IR-12 |
| GET | `/public/logo` | Public | Organisation logo image | IR-02 |
| GET | `/sanctum/csrf-cookie` | Public | Sets the CSRF cookie for the web client (outside `/api/v1`) | ADR-06 |

### GET `/public/branding`

`200` response:

```json
{
  "data": {
    "organisation_name": "Acme Retail",
    "logo_url": "/api/v1/public/logo",
    "time_zone": "Asia/Jakarta",
    "default_language": "id",
    "languages": ["id", "en"],
    "user_language_choice": true,
    "employee_id": { "label": "NIP", "charset": "digits", "min": 9, "max": 10 },
    "setup_status": "complete",
    "api_version": "1.4.0",
    "min_app_version": "1.2.0"
  }
}
```

Before setup is complete, `organisation_name` is `"GrowHub"` and `logo_url` is `null`. The mobile client uses this endpoint to validate a server address (IR-12).

## 7. Authentication

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/sign-in` | Public | Sign in and create a session | FR-AUTH-01 to FR-AUTH-08, UC-04 |
| GET | `/auth/session` | Session | Current session state, user, and permissions | FR-AUTH-11, FR-AUTH-12 |
| POST | `/auth/sign-out` | Session | End the current session | FR-AUTH-09, UC-07 |
| POST | `/auth/activation/code` | Session | Send an activation code | FR-OTP, UC-05 |
| POST | `/auth/activation` | Session | Verify the code and set a new password | FR-OTP-07, UC-05 |
| GET | `/auth/ethics-notice` | Session | Active ethics policies and version | FR-ETH-01, UC-06 |
| POST | `/auth/acknowledgement` | Session | Acknowledge the ethics notice | FR-ETH-02, UC-06 |

### POST `/auth/sign-in`

Request:

| Field | Type | Rules |
| :--- | :--- | :--- |
| `employee_id` | string | Required; must match SET-02 |
| `password` | string | Required |
| `client` | string | Required; `web` or `mobile` |
| `device_name` | string | Required when `client` is `mobile`; 1–100 characters |

`200` response:

```json
{
  "data": {
    "state": "requires_activation",
    "token": "8|Qm9…",
    "expires_at": "2026-12-19T03:15:00Z",
    "user": { "id": "…", "name": "Dewi Lestari", "role": "employee" }
  }
}
```

- `token` and `expires_at` are present only for `mobile`.
- `user` contains `id`, `name`, and `role` only. Clients call `GET /auth/session` for the full profile when the state is `ready`.

Errors: `422 employee_id_format`, `401 invalid_credentials`, `403 account_deactivated`, `403 outside_rollout_scope`, `403 setup_incomplete`, `429 too_many_requests`.

### GET `/auth/session`

`200` response: `{ "data": { "state", "expires_at", "user": Me } }`. In states other than `ready`, `user` contains only `id`, `name`, and `role`.

### POST `/auth/activation/code`

No request body. `202` response:

```json
{
  "data": {
    "masked_email": "d***i@acme.co.id",
    "expires_at": "2026-11-19T03:20:00Z",
    "resend_available_at": "2026-11-19T03:16:00Z",
    "max_attempts": 5
  }
}
```

The masked email follows FR-OTP-06. Errors: `429 resend_too_soon`, `429 too_many_requests`, `409 invalid_state` when the account does not require activation.

### POST `/auth/activation`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `code` | string | Required; 6 digits |
| `password` | string | Required; SET-15 minimum [8] to 128 characters; differs from the employee ID |
| `password_confirmation` | string | Required; equals `password` |

`200` response: `{ "data": { "state": "requires_acknowledgement" } }`. The old password stops working.

Errors: `422 code_invalid` with `remaining_attempts`, `422 code_attempts_exhausted`, `410 code_expired`, `422 validation_failed` with password field codes.

### GET `/auth/ethics-notice`

`200` response:

```json
{
  "data": {
    "policy_version": { "id": "…", "number": 4 },
    "violation_points": 1,
    "policies": [
      { "id": "…", "name": "Leakage of confidential data", "description": "…", "severity": "high" }
    ]
  }
}
```

### POST `/auth/acknowledgement`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `policy_version_id` | string | Required; must be the current version |

`200` response: `{ "data": { "state": "ready" } }`. Errors: `409 invalid_state` with `current_state` when the version is no longer current, so that the client reloads the notice.

## 8. Profile and personal data

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/me` | User | Own profile | FR-PRF-01 |
| PATCH | `/me` | User | Change language | FR-PRF-05 |
| PUT | `/me/photo` | User | Set photo from an upload | FR-PRF-02, FR-PRF-03 |
| DELETE | `/me/photo` | User | Remove photo | FR-PRF-02 |
| POST | `/me/email` | User | Request an email change | FR-PRF-04, UC-09 |
| POST | `/me/email/verify` | User or Session | Verify the new email | FR-PRF-04, FR-USR-07 |
| POST | `/me/password/code` | Admin | Send an administrator password change code | FR-USR-12, UC-08 |
| PUT | `/me/password` | Admin | Change own password | FR-USR-12, UC-08 |
| GET | `/me/contents` | User | My Contributions | FR-CNT-14, UC-16 |
| GET | `/me/saved` | User | Saved items | FR-DSC-08, UC-21 |
| GET | `/me/history` | User | Reading history | FR-DSC-08, UC-21 |

### PATCH `/me`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `language` | string? | `id`, `en`, or `null`; refused with `403 forbidden` when SET-10 does not allow user choice |

### PUT `/me/photo`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `upload_id` | string | Required; an upload of kind `photo` that passed the scan (Section 10) |

### POST `/me/email`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `email` | string | Required; valid; unique; allowed domain when SET-16 is set |

`202` response: `{ "data": { "pending_email", "expires_at", "resend_available_at" } }`. A code is sent to the new address. The current email stays in use.

### POST `/me/email/verify`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `code` | string | Required; 6 digits |

`200` response: `{ "data": Me }` with the new email. This endpoint is also allowed in state `requires_acknowledgement`, because an administrator may have changed the email of an activated account, which the user must verify at the next sign-in (FR-USR-07). In that case `GET /auth/session` returns `"pending_email_verification": true`.

### PUT `/me/password`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `code` | string | Required; from `POST /me/password/code` |
| `current_password` | string | Required |
| `password`, `password_confirmation` | string | As in activation |

`204` response. Other sessions of the administrator end (RUL-10). Other roles receive `403 forbidden` (FR-USR-13).

### GET `/me/contents`

Query: `filter[status]` (any content status except `removed`), `sort` (`-updated_at` default, `-published_at`), and pagination. Returns `ContentSummary[]`.

### GET `/me/saved` and GET `/me/history`

Return `ContentSummary[]`, newest first. History entries add `last_opened_at`. Items the user can no longer see are left out (FR-DSC-08).

## 9. Home, feed, and content

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/home` | User | Home page data | FR-DSC-06 |
| GET | `/contents` | User | Knowledge Feed with search, filters, and sorting | FR-DSC-01 to FR-DSC-05 |
| POST | `/contents` | User | Create a draft or submit directly | FR-CNT-01 to FR-CNT-07, UC-13 |
| GET | `/contents/{id}` | User | Content detail; records a view | FR-DSC-07, UC-18 |
| PATCH | `/contents/{id}` | Owner | Edit a Draft or Rejected item | FR-CNT-08, UC-14 |
| POST | `/contents/{id}/submit` | Owner | Draft or Rejected to Pending | FR-CNT-07, UC-13, UC-14 |
| POST | `/contents/{id}/withdraw` | Owner | Pending to Draft | UC-14 |
| POST | `/contents/{id}/remove` | Owner or Admin | Remove content | FR-CNT-10 to FR-CNT-12, UC-15, UC-23 |
| GET | `/categories` | User | Active categories | FR-CNT-05 |
| GET | `/organisation-units` | User | Active departments, locations, and positions for filters | FR-LDB-01 |

### GET `/home`

`200` response:

```json
{
  "data": {
    "progress": { "total_points": 340, "level": { "number": 3, "name": "Sapling" },
                  "next_level": { "number": 4, "name": "Grower", "min_points": 500 },
                  "current_streak": 5 },
    "recommendations": [ "ContentSummary…" ],
    "latest": [ "ContentSummary…" ],
    "leaderboard": { "view": "cycle", "entries": [ "LeaderboardEntry…" ], "me": "LeaderboardEntry?" }
  }
}
```

Recommendations follow SRS Section 7.6 (up to 10). `latest` has up to 10 items. The leaderboard widget follows the configured widget size.

### GET `/contents`

| Parameter | Rules |
| :--- | :--- |
| `q` | Optional; at least 2 characters; every word must appear in title, body, or tags (FR-DSC-02) |
| `filter[category]` | Category IDs |
| `filter[community]` | Community IDs |
| `filter[author]` | User IDs |
| `filter[media_type]` | `image`, `video`, `document`, `text` |
| `sort` | `latest` (default), `popular`, `trending` (SRS Section 7.5) |

Returns published `ContentSummary[]` visible to the user (FR-DSC-05).

### POST `/contents`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `title` | string | Required; 1–200 characters |
| `body` | string | Required when submitting; at least 20 characters after trimming; at most 50,000 |
| `category_id` | string? | Required when submitting; must be active |
| `community_id` | string? | The author must be a member; community not archived |
| `tags` | string[] | Up to 8; each 1–30 characters; duplicates ignored without case |
| `upload_ids` | string[] | Up to 10 uploads of kind `attachment` owned by the user |
| `submit` | boolean | Default `false`. `true` creates the item and submits it in one step |

`201` response: `{ "data": Content }`, with `Location` header. When `submit` is `true`, the status is `pending`, submission points are processed, and reviewers are notified.

Errors: `422 validation_failed` (field codes `required`, `too_long`, `too_short`, `too_many`, `inactive_reference`, `not_member`), `409 file_not_ready`, `422 file_infected`.

Uploads still being scanned can be attached. The content can be saved, but submission waits until every attachment is `clean`.

### GET `/contents/{id}`

Returns `Content`. Visibility follows FR-CNT-13 and FR-DSC-05. Opening a published item records a reading history entry, increments the view count, and processes reading points (FR-DSC-07). The client may send `?record_view=false` to read without recording, for example when refreshing.

### PATCH `/contents/{id}`

Accepts the same fields as `POST /contents` except `submit`, all optional. `upload_ids` replaces the full attachment list. Allowed only for the author in `draft` or `rejected` (FR-CNT-08). Otherwise `409 invalid_state`.

### POST `/contents/{id}/submit`, `/withdraw`

No body. `200` response: `{ "data": Content }`. `409 invalid_state` when the transition is not allowed (SRS Section 4.4.1).

### POST `/contents/{id}/remove`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `reason` | string? | Required when the actor is an administrator and not the author; 1–1,000 characters |

`204` response. Removal by an administrator notifies the author and is audited (FR-CNT-10).

## 10. Files and uploads

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/uploads` | User | Upload a file | FR-ATT-01 to FR-ATT-06 |
| GET | `/uploads/{id}` | Owner | Upload and scan status | FR-ATT-06 |
| DELETE | `/uploads/{id}` | Owner | Discard an upload not yet attached | |
| GET | `/files/{id}` | User | Download or view a file after authorisation | FR-ATT-03, FR-ATT-04, ADR-05 |

### POST `/uploads`

`multipart/form-data`:

| Field | Rules |
| :--- | :--- |
| `file` | Required |
| `kind` | Required; `attachment`, `module_media` (Author only), `photo`, `logo` (Admin only), `import` (Admin only) |

| Kind | Allowed formats | Maximum size |
| :--- | :--- | :--- |
| `attachment`, `module_media` | BRD Section 9.4.5 formats | 50 MB |
| `photo`, `logo` | JPG, PNG, WEBP | 5 MB |
| `import` | XLSX, CSV | 10 MB |

`201` response: `{ "data": { "id", "name", "mime_type", "size_bytes", "media_type", "scan_status": "pending" } }`.

Errors: `413 file_too_large`, `415 unsupported_media_type`. The service checks both extension and detected type. Uploads not attached within 24 hours are deleted.

### GET `/files/{id}`

Authorisation by file kind:

| Kind | Who may read |
| :--- | :--- |
| `attachment` | Users who may see the related content |
| `module_media` | Users who may see the module |
| `photo` | Any signed-in user |
| `logo` | Public, through `GET /public/logo` |
| `import`, `export` | The administrator who created it |

Response: the file stream through the proxy (ADR-05), with `Content-Type`, `Content-Length`, and `Content-Disposition` (`inline` for images and video, `attachment` for documents). Supports `Range` requests for video. Files with `scan_status` other than `clean` return `409 file_not_ready` or `422 file_infected`.

## 11. Engagement

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| PUT | `/contents/{id}/like` | User | Like | FR-ENG-01 |
| DELETE | `/contents/{id}/like` | User | Unlike | FR-ENG-01, FR-ENG-03 |
| PUT | `/contents/{id}/save` | User | Save | FR-ENG-01 |
| DELETE | `/contents/{id}/save` | User | Unsave | FR-ENG-01, FR-ENG-03 |
| POST | `/contents/{id}/shares` | User | Record a share and get the link | FR-ENG-02 |
| GET | `/contents/{id}/comments` | User | Comments with replies | FR-ENG-04 |
| POST | `/contents/{id}/comments` | User | Comment or reply | FR-ENG-04, FR-ENG-05, UC-20 |
| DELETE | `/comments/{id}` | Owner | Remove own comment and its replies | FR-ENG-06 |

### PUT and DELETE `/contents/{id}/like`, `/save`

No body. `200` response: `{ "data": { "liked": true, "likes": 24 } }` or the save equivalent. Repeating the same request has no further effect. Only `published` content is accepted; otherwise `409 invalid_state`.

### POST `/contents/{id}/shares`

No body. `201` response: `{ "data": { "url": "https://{host}/contents/{id}" } }`. The URL opens the item only for signed-in users who may see it (FR-ENG-02).

### GET `/contents/{id}/comments`

Returns top-level `Comment[]`, oldest first, each with its replies. Pagination applies to top-level comments.

### POST `/contents/{id}/comments`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `body` | string | Required; 1–2,000 characters |
| `parent_id` | string? | A top-level comment on the same item; a reply to a reply returns `422 validation_failed` with `invalid_value` |

`201` response: `{ "data": Comment }`. Errors: `409 invalid_state` when the item is not published.

## 12. Review

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/review-queue` | Reviewer | Pending items, oldest first | FR-REV-01, FR-REV-02, UC-22 |
| POST | `/contents/{id}/approve` | Reviewer | Approve | FR-REV-03 to FR-REV-06 |
| POST | `/contents/{id}/reject` | Reviewer | Reject with a note | FR-REV-03 to FR-REV-05, FR-REV-07 |

### GET `/review-queue`

Query: `filter[category]` and pagination. Each item is a `ContentSummary` plus:

| Field | Type | Notes |
| :--- | :--- | :--- |
| `submitted_at` | string | Last time the item entered Pending |
| `working_days_waited` | integer | SRS Section 7.7 |
| `is_overdue` | boolean | Waited longer than SET-13 [2 working days] |
| `is_own` | boolean | `true` for the reviewer's own items, which they cannot decide |

`meta` adds `target_working_days`.

### POST `/contents/{id}/approve`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `note` | string? | Up to 1,000 characters |

`200` response: `{ "data": Content }` with status `published`.

### POST `/contents/{id}/reject`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `note` | string | Required; 1–1,000 characters |

`200` response: `{ "data": Content }` with status `rejected`.

Errors for both: `403 self_review_forbidden`, `409 invalid_state` when the item is no longer Pending.

## 13. Communities

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/communities` | User | List communities | FR-COM-01, UC-27 |
| POST | `/communities` | User | Create a community | FR-COM-03, UC-28 |
| GET | `/communities/{id}` | User | Community detail | FR-COM-01 |
| PUT | `/communities/{id}/membership` | User | Join | FR-COM-02 |
| DELETE | `/communities/{id}/membership` | User | Leave | FR-COM-02 |
| PATCH | `/admin/communities/{id}` | Admin | Edit name or focus | FR-COM-04 |
| POST | `/admin/communities/{id}/archive` | Admin | Archive | FR-COM-04 |

`GET /communities` accepts `q`, `filter[joined]=true`, `filter[archived]=false` (default), and `sort` (`name` default, `-member_count`). Community content is listed through `GET /contents?filter[community]={id}`.

### POST `/communities`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `name` | string | Required; 3–80 characters; unique without case |
| `focus` | string? | Up to 500 characters |

`201` response: `{ "data": Community }`. The creator becomes a member.

Joining an archived community returns `409 community_archived`. Leaving when not a member returns `204` (idempotent).

## 14. Learning

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/modules` | User | Published modules with own status | FR-LRN-04 |
| GET | `/modules/{id}` | User | Module detail | FR-LRN-04, UC-29 |
| POST | `/modules/{id}/completion` | User | Mark complete | FR-LRN-05, UC-29 |
| GET | `/me/learning` | User | Learning progress | FR-LRN-07 |
| GET | `/authoring/modules` | Author | All modules, including drafts and retired | FR-LRN-03, UC-30 |
| POST | `/authoring/modules` | Author | Create a draft module | FR-LRN-01 to FR-LRN-03 |
| GET | `/authoring/modules/{id}` | Author | Module for editing | FR-LRN-03 |
| PATCH | `/authoring/modules/{id}` | Author | Edit | FR-LRN-03 |
| POST | `/authoring/modules/{id}/publish` | Author | Publish | FR-LRN-03 |
| POST | `/authoring/modules/{id}/retire` | Author | Retire | FR-LRN-06 |

`GET /modules` accepts `filter[difficulty]`, `filter[field]`, `filter[completed]`, and `sort` (`title`, `-published_at`).

### POST `/modules/{id}/completion`

No body. `201` response: `{ "data": { "completed_at", "points_awarded": 15 } }`. Errors: `409 already_completed` with `completed_at`.

### GET `/me/learning`

`200` response: `{ "data": { "completed": 4, "available": 12, "share": 0.33, "modules": [ "Module…" ] } }`.

### POST and PATCH `/authoring/modules`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `title` | string | Required on create; 1–200 characters |
| `field` | string | Required on create; 1–80 characters |
| `difficulty` | string | Required on create; `beginner`, `intermediate`, `advanced` |
| `duration_minutes` | integer | Required on create; 1–600 |
| `description` | string? | Up to 1,000 characters |
| `body` | string | Markdown |
| `media_upload_ids` | string[] | Uploads of kind `module_media`; replaces the full list on PATCH |

Publishing requires a non-empty `body` and all media scanned `clean`.

## 15. Gamification

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/me/dashboard` | User | Points, level, streaks, badges, and statistics | UC-31 |
| GET | `/me/points` | User | Point history | FR-PTS-07 |
| GET | `/leaderboard` | User | Rankings | FR-LDB-01 to FR-LDB-03, UC-32 |
| GET | `/levels` | User | Active levels | FR-GAM-03 |
| GET | `/badges` | User | Active badges with own award status | FR-GAM-05 |

### GET `/me/dashboard`

`200` response:

```json
{
  "data": {
    "total_points": 340,
    "level": { "number": 3, "name": "Sapling", "min_points": 250 },
    "next_level": { "number": 4, "name": "Grower", "min_points": 500, "points_needed": 160 },
    "streak": { "current": 5, "longest": 12, "basis": "calendar", "next_bonus_at": 7 },
    "badges": [ "Badge…" ],
    "contributions": { "published": 6, "pending": 1, "likes_received": 48, "comments_written": 22 },
    "learning": { "completed": 4, "available": 12 }
  }
}
```

### GET `/me/points`

Returns `PointTransaction[]`, newest first. Accepts `filter[from]` and `filter[to]` as organisation dates.

### GET `/leaderboard`

| Parameter | Rules |
| :--- | :--- |
| `view` | `week`, `month`, `cycle` (default), `unit` |
| `department_id`, `location_id` | One is required when `view=unit` |
| `limit` | Default and maximum are the configured leaderboard size [50] |

`200` response:

```json
{
  "data": [
    { "rank": 1, "user": "UserSummary…", "points": 820 },
    { "rank": 2, "user": "UserSummary…", "points": 760 },
    { "rank": 2, "user": "UserSummary…", "points": 760 }
  ],
  "meta": {
    "view": "cycle",
    "period_start": "2026-11-01T00:00:00Z",
    "show_podium": true,
    "me": { "rank": 74, "points": 120 }
  }
}
```

Ranking follows SRS Section 7.4. `meta.me` is present when the own-rank option is on, or when the user is in the list. Results may be up to 60 seconds old.

## 16. Notifications

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/notifications` | User | Notifications, newest first | FR-NTF-01 |
| GET | `/notifications/unread-count` | User | Unread count for polling | FR-NTF-02 |
| POST | `/notifications/{id}/read` | Owner | Mark one as read | FR-NTF-02 |
| POST | `/notifications/read-all` | User | Mark all as read | FR-NTF-02 |

`GET /notifications` accepts `filter[unread]=true`. `GET /notifications/unread-count` returns `{ "data": { "unread": 3 } }` and is designed for polling every 60 seconds. Read endpoints return `204`.

## 17. Help and support tickets

| Method | Path | Access | Purpose | Refs |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/help` | User | Support contact and data-use notice | FR-SUP-01, FR-SET-17 |
| GET | `/faqs` | User | FAQs in the user's language, grouped by topic | FR-SUP-01, UC-39 |
| GET | `/ticket-categories` | User | Active ticket categories | FR-SUP-03 |
| GET | `/tickets` | User | Own tickets | FR-SUP-05, UC-40 |
| POST | `/tickets` | User | Submit a ticket | FR-SUP-03, UC-40 |
| GET | `/tickets/{id}` | Owner | Own ticket with responses | FR-SUP-05 |
| GET | `/support-desk/tickets` | Handler | All tickets | FR-SUP-06, UC-41 |
| GET | `/support-desk/tickets/{id}` | Handler | Ticket detail | FR-SUP-06 |
| POST | `/support-desk/tickets/{id}/responses` | Handler | Respond, optionally changing status | FR-SUP-07, FR-SUP-09 |
| PATCH | `/support-desk/tickets/{id}` | Handler | Change status, including reopen | FR-SUP-04, FR-SUP-07 |

### POST `/tickets`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `subject` | string | Required; 1–150 characters |
| `category_id` | string | Required; active |
| `message` | string | Required; 1–3,000 characters |

`201` response: `{ "data": Ticket }` with status `open`. Ticket handlers are notified.

### GET `/support-desk/tickets`

Query: `filter[status]`, `filter[category]`, `filter[overdue]=true`, `q` (subject), and `sort` (`created_at` default). Each ticket includes `is_overdue` against the SET-05 first-response target [2 working days] and `user` (UserSummary plus `employee_id` and `email`, because handlers need them to help).

### POST `/support-desk/tickets/{id}/responses`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `message` | string | Required; 1–3,000 characters |
| `status` | string? | `in_progress` or `resolved`; an `open` ticket becomes `in_progress` when no status is given |

`201` response: `{ "data": Ticket }`. The first response sets `first_response_at`. The employee is notified.

### PATCH `/support-desk/tickets/{id}`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `status` | string | Required; transitions in SRS Section 4.4.3. `resolved` to `in_progress` is a reopen and increments `reopened_count` |

## 18. Administration: setup and organisation

All endpoints in this section require **Admin**. Setup endpoints are available before setup is complete (FR-SET-02).

| Method | Path | Purpose | Refs |
| :--- | :--- | :--- | :--- |
| GET | `/admin/setup` | Setup status, saved steps, and current values | FR-SET-01, FR-SET-04 |
| PUT | `/admin/setup/steps/{step}` | Save a wizard step | FR-SET-03, FR-SET-04 |
| GET | `/admin/setup/starter-content` | Starter packs with their entries | FR-SET-06 |
| GET | `/admin/setup/summary` | Summary of every value and missing items | FR-SET-08 |
| POST | `/admin/setup/complete` | Complete setup | FR-SET-08, FR-SET-09 |
| GET | `/admin/organisation` | Organisation profile | FR-SET-10 |
| PATCH | `/admin/organisation` | Change the profile | FR-SET-10, FR-SET-15 |
| GET | `/admin/settings` | All settings with values, defaults, and ranges | FR-SET-05, FR-SET-10 |
| PATCH | `/admin/settings/{key}` | Change one setting | FR-SET-11 to FR-SET-16 |
| GET | `/admin/holidays` | Holidays by year | FR-SET-07 |
| GET | `/admin/holidays/suggestions` | Proposed holidays for a country and year | FR-SET-07 |
| POST | `/admin/holidays` | Add holidays | FR-SET-07 |
| DELETE | `/admin/holidays/{id}` | Remove a holiday | FR-SET-07 |
| GET | `/admin/{unit-type}` | List departments, locations, or positions | FR-ORG-01 |
| POST | `/admin/{unit-type}` | Create a unit | FR-ORG-01 |
| PATCH | `/admin/{unit-type}/{id}` | Rename a unit | FR-ORG-01 |
| POST | `/admin/{unit-type}/{id}/retire` | Retire a unit | FR-ORG-02 to FR-ORG-04 |
| GET, POST, PATCH | `/admin/categories`, `/admin/categories/{id}` | Manage content categories | FR-CAT-01 |
| POST | `/admin/categories/{id}/retire` | Retire a category | FR-CAT-02, FR-CAT-03 |
| GET, POST, PATCH, DELETE | `/admin/ticket-categories`, `/admin/ticket-categories/{id}` | Manage ticket categories | FR-SUP-02 |
| GET, POST, PATCH, DELETE | `/admin/faqs`, `/admin/faqs/{id}` | Manage FAQs | FR-SUP-02 |
| PUT | `/admin/faqs/order` | Reorder FAQs | FR-SUP-02 |

`{unit-type}` is `departments`, `locations`, or `positions`.

### PUT `/admin/setup/steps/{step}`

`{step}` is one of `profile`, `units`, `settings`, `starter_content`, `notice`. The body depends on the step:

| Step | Body |
| :--- | :--- |
| `profile` | Organisation profile fields, as in `PATCH /admin/organisation` |
| `units` | `{ "departments": [{ "name" }], "locations": [...], "positions": [...] }`; replaces the lists while setup is in progress |
| `settings` | `{ "values": { "<key>": <value> } }` for any subset of settings |
| `starter_content` | `{ "<list>": { "choice": "accept" \| "edit" \| "empty", "entries": [...] } }` for each list in SRS Section 8.2 |
| `notice` | `{ "data_use_notice": "Markdown" }` |

`200` response: `{ "data": { "step", "saved_at", "warnings": [] } }`. Steps can be saved in any order and saved again. Values are validated when saved.

### POST `/admin/setup/complete`

No body. `200` response: `{ "data": { "setup_status": "complete", "duration_seconds": 2710 } }`. When minimum items are missing, the response is `422 validation_failed` with `errors` keyed by step, for example `{ "units.departments": [{ "code": "required" }] }` (FR-SET-08).

### PATCH `/admin/organisation`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `name` | string | 1–120 characters |
| `logo_upload_id` | string? | Upload of kind `logo`; `null` removes the logo |
| `country_code` | string | ISO 3166-1 alpha-2 |
| `time_zone` | string | IANA time zone name |
| `working_days` | integer[] | ISO weekdays 1–7; at least one |
| `sender_name` | string | 1–120 characters |
| `reply_to_email` | string | Valid email |
| `support_contact` | string | 1–500 characters |
| `programme_owner_name` | string | 1–120 characters |
| `programme_owner_contact` | string | 1–254 characters |
| `data_use_notice` | string | Markdown |

All fields are optional on PATCH. `200` response: the full profile. Changes are audited with old and new values (FR-SET-15).

### GET `/admin/settings`

Each entry:

```json
{
  "key": "otp.policy",
  "setting_id": "SET-09",
  "value": { "validity_minutes": 5, "attempts": 5, "resend_seconds": 60 },
  "default": { "validity_minutes": 5, "attempts": 5, "resend_seconds": 60 },
  "schema": { "validity_minutes": { "type": "integer", "min": 1, "max": 10 }, "…": "…" },
  "updated_at": "2026-11-19T03:15:00Z",
  "updated_by": "UserSummary?"
}
```

Keys and value shapes are defined in database Section 3.2.

### PATCH `/admin/settings/{key}`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `value` | any | Required; validated against the key's schema |
| `confirm` | boolean | Default `false`; required as `true` after a `confirmation_required` response |

Responses:

- `200` with the updated entry.
- `409 confirmation_required` with `impact`, for example `{ "affected_contents": 312 }` for `community.visibility`, or `{ "affected_users": 4 }` when turning off an optional role (FR-SET-11).
- `409 setting_conflict` with `conflicts`, for example employee IDs that do not match a new format (FR-SET-12).
- `422 validation_failed` for out-of-range values.

### POST `/admin/{unit-type}/{id}/retire`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `move_users_to_id` | string? | Active unit of the same type to move assigned users to |
| `confirm` | boolean | Required as `true` to retire a unit with users without moving them |

Errors: `409 confirmation_required` with `{ "affected_users": n }`, `409 last_required_item` for the last department.

## 19. Administration: users, moderation, and gamification

All endpoints in this section require **Admin**.

### 19.1 Users and import

| Method | Path | Purpose | Refs |
| :--- | :--- | :--- | :--- |
| GET | `/admin/users` | Search accounts | FR-USR-06 |
| POST | `/admin/users` | Create an account | FR-USR-01 to FR-USR-05, UC-10 |
| GET | `/admin/users/{id}` | Account detail | UC-10 |
| PATCH | `/admin/users/{id}` | Edit an account | FR-USR-07 |
| POST | `/admin/users/{id}/deactivate` | Deactivate | FR-USR-09, FR-DPR-05 |
| POST | `/admin/users/{id}/reactivate` | Reactivate | FR-USR-09 |
| POST | `/admin/users/{id}/password-reset` | Reset password | FR-USR-11, UC-11 |
| GET | `/admin/users/{id}/points` | User's point history | FR-PTS-07 |
| POST | `/admin/users/{id}/point-adjustments` | Manual adjustment | FR-PTS-05, UC-36 |
| GET | `/admin/users/{id}/violations` | User's violations | FR-MOD-05 |
| GET | `/admin/imports/template` | Download the import template | FR-IMP-01 |
| POST | `/admin/imports` | Start an import from an upload | FR-IMP-02, FR-IMP-03 |
| GET | `/admin/imports/{id}` | Import status and errors | FR-IMP-04 |
| POST | `/admin/imports/{id}/confirm` | Create the accounts | FR-IMP-05, FR-IMP-06 |

#### GET `/admin/users`

Query: `q` (employee ID, name, or email), `filter[role]`, `filter[status]` (`active`, `deactivated`), `filter[activation]` (`required`, `activated`), `filter[department]`, `filter[location]`, and `sort` (`name`, `-created_at`). Each item is `UserSummary` plus `employee_id`, `email`, `role`, `status`, `requires_activation`, and `created_at`.

#### POST `/admin/users`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `employee_id` | string | Required; SET-02 format; unique |
| `name` | string | Required; 1–120 characters |
| `email` | string | Required; valid; unique; allowed domain |
| `role` | string | Required; optional roles only when enabled |
| `department_id` | string | Required; active |
| `location_id`, `position_id` | string? | Active |
| `initial_password` | string? | When omitted, the employee ID is the initial password; otherwise password policy applies |

`201` response: the account, with `requires_activation: true`.

#### PATCH `/admin/users/{id}`

Accepts `name`, `email`, `role`, `department_id`, `location_id`, and `position_id`. `employee_id` is refused with `422 validation_failed` (`invalid_value`). An email change on an activated account is stored as pending until the user verifies it (FR-USR-07). Errors: `409 last_administrator` when demoting the last administrator.

#### POST `/admin/users/{id}/deactivate`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `confirm_content_removal` | boolean | Required as `true` when SET-14 removes departed employees' content |

`200` response with the account. All sessions end immediately. Errors: `409 last_administrator`, `409 confirmation_required` with `{ "contents_to_remove": n }`.

#### POST `/admin/users/{id}/password-reset`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `initial_password` | string? | When omitted, resets to the employee ID |

`204` response. The user's sessions end and activation is required (FR-USR-11).

#### POST `/admin/users/{id}/point-adjustments`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `amount` | integer | Required; not 0; between −10,000 and 10,000 |
| `reason` | string | Required; 1–500 characters |

`201` response: `{ "data": PointTransaction }`. A negative amount is capped at the user's balance, and the response shows the amount actually applied.

#### POST `/admin/imports`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `upload_id` | string | Required; upload of kind `import` |

`202` response: `{ "data": { "id", "status": "validating" } }`. The client polls `GET /admin/imports/{id}` until the status is `invalid` or `ready`. An `invalid` import returns `errors` as `[{ "row": 12, "column": "email", "code": "not_unique" }]`. Confirming an `invalid` import returns `422 import_invalid`.

### 19.2 Moderation

| Method | Path | Purpose | Refs |
| :--- | :--- | :--- | :--- |
| POST | `/admin/comments/{id}/violations` | Remove a comment for a violation | FR-MOD-01 to FR-MOD-05, UC-24 |
| GET | `/admin/suspension-proposals` | List proposals | FR-MOD-05, UC-25 |
| POST | `/admin/suspension-proposals/{id}/confirm` | Confirm and deactivate | FR-MOD-07 |
| POST | `/admin/suspension-proposals/{id}/dismiss` | Dismiss | FR-MOD-07 |
| GET | `/admin/ethics-policies` | List policies | FR-MOD-04 |
| POST | `/admin/ethics-policies` | Add a policy | FR-MOD-04, FR-ETH-04 |
| PATCH | `/admin/ethics-policies/{id}` | Edit a policy | FR-MOD-04, FR-ETH-04 |
| DELETE | `/admin/ethics-policies/{id}` | Remove a policy | FR-MOD-04 |

#### POST `/admin/comments/{id}/violations`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `ethics_policy_id` | string | Required; an active policy |

`201` response:

```json
{
  "data": {
    "violation_id": "…",
    "points_deducted": 1,
    "escalation": { "violations_in_period": 3, "alert_sent": true, "proposal_created": false }
  }
}
```

`escalation` is `null` when SET-08 is off. Errors: `403 forbidden` for one's own comment, which uses `DELETE /comments/{id}` instead.

#### POST `/admin/suspension-proposals/{id}/confirm` and `/dismiss`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `reason` | string | Required; 1–1,000 characters |

`200` response with the proposal. Confirming deactivates the account and sends the suspension email. Errors: `409 invalid_state` when the proposal is no longer open.

#### POST and PATCH `/admin/ethics-policies`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `name` | string | 1–120 characters |
| `description` | string | 1–1,000 characters |
| `severity` | string | `high`, `medium`, `low` |
| `sort_order` | integer | |

Every change creates a new policy version, and users acknowledge it at their next sign-in. `DELETE` returns `409 last_required_item` for the last policy.

### 19.3 Gamification configuration

| Method | Path | Purpose | Refs |
| :--- | :--- | :--- | :--- |
| GET | `/admin/point-rules` | List point rules | FR-PTS-04 |
| PATCH | `/admin/point-rules/{key}` | Change points, daily limit, or state | FR-PTS-04 |
| GET, POST | `/admin/levels` | List or add levels | FR-GAM-04 |
| PATCH | `/admin/levels/{id}` | Edit a level | FR-GAM-04 |
| GET, POST | `/admin/badges` | List or add badges | FR-GAM-07 |
| PATCH | `/admin/badges/{id}` | Edit or deactivate a badge | FR-GAM-07 |
| GET | `/admin/leaderboard/settings` | Leaderboard settings | FR-LDB-04 |
| PATCH | `/admin/leaderboard/settings` | Change leaderboard settings | FR-LDB-04 |
| GET | `/admin/leaderboard/cycles` | Competition cycles | FR-LDB-05 |
| POST | `/admin/leaderboard/resets` | Start a manual reset | FR-LDB-05 |
| POST | `/admin/leaderboard/resets/{id}/cancel` | Cancel the latest manual reset | FR-LDB-07 |

#### PATCH `/admin/point-rules/{key}`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `points` | integer | 0–1,000; for `ethics_violation`, −1,000 to −1 |
| `daily_limit` | integer? | 1–1,000, or `null` for no limit |
| `is_active` | boolean | |

`module_completed` ignores `points` because its amount comes from SET-07, and the response says so in `meta.note`.

#### POST and PATCH `/admin/levels`

Fields: `number` (1–100), `name` (1–60 characters), `description` (up to 300), `min_points` (0 or more), and `is_active`. Uniqueness, ascending order, and the last active level are checked as a whole. A failure returns `422 validation_failed` with the conflicting field, or `409 last_required_item`.

#### POST and PATCH `/admin/badges`

Fields: `name`, `description`, `criterion` (Section 5.6 values), `threshold` (at least 1), and `is_active`.

#### PATCH `/admin/leaderboard/settings`

Fields: `reset_schedule` (`never`, `weekly`, `monthly`, `quarterly`, `yearly`), `size` (3–500), `widget_size` (1–20), `show_podium`, and `show_own_rank`.

#### POST `/admin/leaderboard/resets`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `confirm` | boolean | Required as `true` |

`201` response: the new cycle. `POST /admin/leaderboard/resets/{id}/cancel` returns `409 invalid_state` unless `{id}` is the latest manual reset and no later reset has occurred.

## 20. Administration: audit, reports, and privacy

All endpoints in this section require **Admin**.

| Method | Path | Purpose | Refs |
| :--- | :--- | :--- | :--- |
| GET | `/admin/audit-records` | Search audit records | FR-AUD-03, UC-43 |
| GET | `/admin/reports/{report}` | Report data | FR-RPT-01, FR-RPT-02, FR-RPT-04, UC-44 |
| POST | `/admin/reports/{report}/exports` | Export a report | FR-RPT-03 |
| GET | `/admin/exports/{id}` | Export status | FR-RPT-03 |
| POST | `/admin/users/{id}/data-exports` | Export a user's personal data | FR-DPR-01, UC-45 |
| GET | `/admin/data-exports/{id}` | Personal data export status | FR-DPR-01 |
| POST | `/admin/users/{id}/anonymise` | Anonymise a deactivated user | FR-DPR-02, FR-DPR-03 |

### GET `/admin/audit-records`

Query: `filter[from]`, `filter[to]`, `filter[actor]`, `filter[action]`, `filter[record_type]`, `filter[record_id]`, and pagination. Each record: `id`, `actor` (UserSummary?), `action`, `record_type`, `record_id`, `old_values`, `new_values`, `request_id`, and `created_at`. Audit records cannot be changed through the API.

### GET `/admin/reports/{report}`

`{report}` is `rpt-01` to `rpt-08`. Query: `from` and `to` (organisation dates, required), `department_id`, and `location_id`.

`200` response:

```json
{
  "data": {
    "report": "rpt-03",
    "title": "Review turnaround",
    "filters": { "from": "2026-10-01", "to": "2026-10-31", "department_id": null, "location_id": null },
    "measures": [
      { "key": "median_working_days", "value": 1.0, "target": 2 },
      { "key": "share_within_target", "value": 0.86, "target": null }
    ],
    "rows": [ { "department": "Operations", "median_working_days": 1.0, "decided": 120 } ],
    "generated_at": "2026-11-19T03:15:00Z"
  }
}
```

Measures follow SRS Section 7.8. Targets come from SET-01, SET-05, and SET-13 (FR-RPT-04).

### POST `/admin/reports/{report}/exports`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `format` | string | Required; `xlsx` or `csv` |
| `from`, `to`, `department_id`, `location_id` | | As in the report endpoint |

`202` response: `{ "data": { "id", "status": "queued" } }`. When `GET /admin/exports/{id}` returns `ready`, it includes `file_url`, which is available for 7 days.

### POST `/admin/users/{id}/data-exports`

No body. `202` response with the export ID. The ready file is a ZIP (IR-20). The action is audited.

### POST `/admin/users/{id}/anonymise`

| Field | Type | Rules |
| :--- | :--- | :--- |
| `confirm` | boolean | Required as `true` |

`200` response with the anonymised account. Errors: `409 invalid_state` when the account is active (FR-DPR-03). Anonymisation cannot be undone.

## 21. Operations

These endpoints are outside `/api/v1` and are reachable only from the cluster or monitoring network (architecture Section 12.4), not from the internet.

| Method | Path | Purpose | Refs |
| :--- | :--- | :--- | :--- |
| GET | `/health/live` | Process is running: `200 { "status": "ok" }` | QR-23 |
| GET | `/health/ready` | Database, Redis, and storage reachable: `200`, or `503` with failing checks | QR-23 |

`/health/ready` also returns the release version, so that operators can track upgrades across installations (AR-04).

## 22. Endpoint index

| Group | Endpoints |
| :--- | ---: |
| Public | 3 |
| Authentication | 7 |
| Profile and personal data | 11 |
| Home, feed, and content | 10 |
| Files and uploads | 4 |
| Engagement | 8 |
| Review | 3 |
| Communities | 7 |
| Learning | 10 |
| Gamification | 5 |
| Notifications | 4 |
| Help and support tickets | 10 |
| Setup and organisation | 38 |
| Users, moderation, and gamification | 35 |
| Audit, reports, and privacy | 7 |
| Operations | 2 |
| **Total** | **164** |

Endpoint counts treat each method and path pair as one endpoint, and expand `{unit-type}` into its three unit types.
