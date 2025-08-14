# PromptReady - User-Facing Error Messages v1.0

*   **Status:** DRAFT
*   **Purpose:** This document provides the canonical text for all user-facing error messages and confirmation dialogs within the PromptReady extension. It ensures a consistent and helpful tone.

| Error Condition | UI/UX Trigger | Message Title | Message Body & Actions |
| :--- | :--- | :--- | :--- |
| **API Key Validation Failed** | User clicks "Save & Test" with an invalid API key. | `Validation Failed` | The API key you entered could not be validated. Please double-check the key and try again. |
| **Service At Capacity** | User attempts an AI clean while the global circuit breaker is tripped. | `Service Temporarily Unavailable` | Our free trial is experiencing high demand. Please try again in a little while, or use the free Offline Mode. |
| **No Internet Connection** | An API call fails due to a network issue. | `Connection Error` | Could not connect to the service. Please check your internet connection and try again. |
| **Model Fetch Failed (OpenRouter)**| OpenRouter key is valid, but the model list can't be fetched. | `Could Not Fetch Models` | Your API key is valid, but we couldn't fetch your available models. Please check your OpenRouter settings or try again. |
| **Remove Key Confirmation** | User clicks the "(X) Remove" button on a saved key. | `Remove API Key?` | Are you sure? This will remove your key and revert you to the free plan. <br> **[Buttons: `Cancel`, `Confirm & Remove`]** |