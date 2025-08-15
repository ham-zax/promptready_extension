# Backend Monetization Architecture - Phase 2 (Draft)

## 1. Overview
This document outlines the high-level architecture for the backend monetization services, focusing on credit tracking and a global budget circuit breaker. These services are designed to be serverless, stateless (where possible), and to ensure user privacy and cost control.

## 2. Core Principles
- **Statelessness:** Backend services should ideally remain stateless, processing requests without retaining session-specific data.
- **Minimal Storage:** Only essential data (e.g., credit counters, budget configurations) will be stored. No user content will be kept on the server.
- **Security & Privacy:** BYOK keys remain client-side. All sensitive data in logs will be redacted.
- **Scalability & Reliability:** Designed for high concurrency and resilience against failures.
- **Cost Control:** The circuit breaker mechanism is crucial for managing operational costs.

## 3. API Endpoints

### 3.1. Credits Service
Responsible for managing user credit balances.

#### `POST /credits/issue`
- **Description:** Issues a specified amount of credits to a user. Used for granting initial credits or top-ups.
- **Request Body:**
  ```json
  {
    "userId": "string",
    "amount": "number",
    "transactionId": "string"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "newBalance": "number"
  }
  ```
- **Notes:** Minimal authentication required. Idempotent via `transactionId`.

#### `POST /credits/decrement`
- **Description:** Decrements a user's credit balance by a specified amount. Called after a successful AI operation.
- **Request Body:**
  ```json
  {
    "userId": "string",
    "amount": "number",
    "operationId": "string"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "newBalance": "number",
    "exhausted": "boolean" (true if balance <= 0 after decrement)
  }
  ```
- **Notes:** Should fail if `amount` > `remainingBalance`. Idempotent via `operationId`.

#### `GET /credits/balance`
- **Description:** Retrieves a user's current credit balance.
- **Request Parameters:** `userId`
- **Response:**
  ```json
  {
    "userId": "string",
    "balance": "number",
    "lastReset": "string" (ISO 8601 timestamp of last reset/issue)
  }
  ```
- **Notes:** Authenticated read.

### 3.2. AI Processing Service

#### `POST /ai/process`
- **Description:** Proxies AI requests to the external AI provider, enforces circuit breaker and credit checks.
- **Request Body:**
  ```json
  {
    "userId": "string",
    "model": "string",
    "prompt": "string",
    "apiBaseOverride": "string" (optional, for custom BYOK endpoints)
    // Other AI-specific parameters (e.g., temperature, max_tokens)
  }
  ```
- **Response (Success):**
  ```json
  {
    "success": true,
    "content": "string", // AI generated content
    "creditsConsumed": "number"
  }
  ```
- **Response (Failure - e.g., circuit breaker, no credits):**
  ```json
  {
    "success": false,
    "message": "string",
    "code": "string" // (e.g., "CIRCUIT_BREAKER_TRIPPED", "INSUFFICIENT_CREDITS")
  }
  ```
- **Notes:**
  - This endpoint will act as a proxy between the client and the external AI provider (e.g., OpenAI, OpenRouter).
  - It will perform initial checks:
    1.  **Weekly Spend Cap:** Check if the circuit breaker is "tripped." If so, reject requests.
    2.  **Credit Check:** Verify `userId` has sufficient credits before forwarding. If not, reject.
  - After a successful AI response, it will call `/credits/decrement`.
  - No user content or API keys should be logged or stored by this service.
  - Timeouts and retries for external AI calls should be handled.

## 4. Weekly Spend Cap
- **Mechanism:** A simple state machine (OPEN/HALF-OPEN/CLOSED) triggered by cost thresholds or manual kill switch.
- **Configuration:** Thresholds for `dailySpend`, `monthlySpend` (configurable via admin interface or environment variables).
- **Kill Switch:** A manual override to immediately trip the circuit breaker, stopping all AI processing.
- **Telemetry:** Log circuit breaker state changes and trip reasons for operational visibility.
- **Implementation:** Could reside in a separate serverless function or as an integrated part of the `/ai/process` service.

## 5. Data Storage
- **Credits:** A simple key-value store (e.g., DynamoDB, Firestore) mapping `userId` to `balance` and `lastReset` timestamp.
- **Circuit Breaker State:** Stored in a highly available, low-latency data store accessible by all instances of `/ai/process` (e.g., Redis, in-memory with periodic persistence, or even a simple file if deployment guarantees consistency).
- **No PII/Content:** Absolutely no Personally Identifiable Information or user-generated content will be stored.

## 6. Technology Stack (Proposed - Serverless)
- **Functions:** AWS Lambda / Google Cloud Functions / Azure Functions
- **Database:** DynamoDB / Firestore (for credits and simple configs)
- **API Gateway:** For exposing endpoints
- **Monitoring/Logging:** CloudWatch / Stackdriver Logging (with strict redaction)

## 7. Next Steps (Architect)
- Formalize schema definitions for requests/responses (e.g., OpenAPI/Swagger).
- Detail error handling and retry mechanisms.
- Propose specific serverless framework/platform.
- Define logging and monitoring strategy.
- Transition to Dev mode for stub implementation.