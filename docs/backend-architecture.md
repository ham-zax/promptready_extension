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
- **Minimal API Surface**: Only two endpoints are required (`/check-credits`, `/process-ai`).
- **Serverless & Specific**: Cloudflare Workers for compute and Cloudflare KV for storage.
- **Experiment Integrity**: The backend determines the AI model based on the user's cohort, not the client.
- **Simplified Financial Safety**: A weekly spend cap in KV replaces a formal circuit breaker.

## 3. API Endpoints

### 3.1. `POST /check-credits`
- **Description:** Checks a user's credit balance. If the user doesn't exist, they are created on-the-fly with a default credit allocation.
- **Request Body:**
  ```json
  { "userId": "string" }
  ```
- **Response:**
  ```json
  {
    "balance": "number", // The user's remaining credits
    "weeklyCap": "number" // The current weekly spend cap
  }
  ```

### 3.2. `POST /process-ai`
- **Description:** Processes an AI request. It internally checks the user's credit balance, decrements it, and enforces the weekly spend cap before proxying the request to the AI provider.
- **Request Body:**
  ```json
  {
    "userId": "string",
    "prompt": "string"
  }
  ```
- **Response (Success):**
  ```json
  {
    "content": "string", // The response from the AI model
    "remaining": "number" // The user's new credit balance
  }
  ```
- **Response (Failure):**
  ```json
  {
    "error": "INSUFFICIENT_CREDITS" | "WEEKLY_CAP_EXCEEDED",
    "remaining": "number" // The user's current credit balance
  }
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