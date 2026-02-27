---
title: "Backend Monetization Architecture"
description: "A lean, de-risked backend architecture for the MVP, focusing on validating the core hypothesis with minimal complexity."
context: "This document outlines the backend architecture for the PromptReady MVP's monetization system. It details the API endpoints, data storage, and model selection strategy for the serverless backend, which is built on Cloudflare Workers and KV storage."
---

# Backend Monetization Architecture – MVP (Revised)

## 1. Overview

This document outlines a lean, de-risked backend architecture for the MVP, focusing on validating the core hypothesis with minimal complexity. The system will use two integrated endpoints on Cloudflare Workers and a simple weekly spend cap managed in Cloudflare KV. The backend will control AI model selection for experiment integrity.

## 2. Core Principles

- **MVP First**: Prioritize speed and validation over feature completeness.
- **Minimal API Surface**: Only two credit endpoints are required (`/user/status`, `/credits/decrement`) plus the ai-proxy metered/BYOK endpoints.
- **Serverless & Specific**: Cloudflare Workers for compute and Cloudflare KV for storage.
- **Experiment Integrity**: The backend determines the AI model based on the user's cohort, not the client.
- **Simplified Financial Safety**: A weekly spend cap in KV replaces a formal circuit breaker.

## 3. API Endpoints

### 3.1. `POST /user/status` (service-authenticated, proxied via `ai-proxy`)

- **Description:** Checks a user's credit balance.
  - **Important:** The backend must **not auto-create** users or grant default credits on read, to prevent credit farming.
  - User provisioning / initial credit grants must happen via a separate, authenticated admin/billing flow (out of scope for the MVP worker surface).
- **Request Body:**
  ```json
  { "userId": "string" }
  ```
- **Response (canonical schema):**
  ```json
  {
    "userId": "string",
    "balance": "number",
    "weeklyCap": "number" // optional
  }
  ```
- **Failure (unknown user):**
  ```json
  { "error": "USER_NOT_FOUND" }
  ```

### 3.2. `POST /credits/decrement` (service-authenticated)

- **Description:** Decrements a user's credits **atomically-ish** (per-user lock) and supports idempotency.
- **Request Body:**
  ```json
  {
    "userId": "string",
    "amount": 1,
    "idempotencyKey": "string"
  }
  ```
- **Response (canonical schema):**
  ```json
  {
    "userId": "string",
    "balance": "number"
  }
  ```
- **Failure:**
  ```json
  { "error": "USER_NOT_FOUND" | "INSUFFICIENT_CREDITS" }
  ```

## 4. Model Selection

- The backend will determine which AI model to use based on the user's assigned cohort (`A`, `B`, or `C`).
- This logic will be implemented within the `/process-ai` Worker.
- The client has no ability to specify or override the model, ensuring the integrity of A/B/C testing.

## 5. Data Storage

- A single Cloudflare KV namespace will be used.
- It will store user credit balances, cohort assignments, and the global weekly spend cap.
- **Key-Value Structure**: `user:{userId}` will map to a JSON object: `{ "balance": number, "cohort": "A" | "B" | "C" }`.

## 6. Next Steps

1.  Implement the Cloudflare Worker script with the two specified endpoints.
2.  Set up the KV namespace and populate the initial weekly spend cap.
3.  Add the cohort assignment logic to the Cloudflare Worker.
4.  Write integration tests to cover credit checks, processing, and spend cap enforcement.
5.  Deploy to a staging environment for end-to-end testing.
