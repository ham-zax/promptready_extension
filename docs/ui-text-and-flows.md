---
title: "UI Text and Flows"
description: "Text-based wireframes and user flows for all UI states in the PromptReady MVP."
context: "This document provides a visual and narrative guide to the user interface of the PromptReady extension. It includes text-based wireframes for each screen state and detailed descriptions of the core user flows, ensuring a clear and consistent user experience."
---

### **Part 1: Text-Based Wireframes of All UI States**

Here is a visual representation of every distinct screen state the user can encounter in the PromptReady MVP.

#### **Wireframe 1: Main View (Free Trial)**
*This is the default view for a new user with credits.*
```
┌──────────────────────────────────────┐
│  [ (Offline) | **AI** ]  <-- AI is default │
│                                      │
│    "You have 149 credits left."      │
│                                      │
│  [======== Clean & Copy ========]    │
│                                (⚙️)  │ <-- Subtle settings icon
└──────────────────────────────────────┘
```

#### **Wireframe 2: Upgrade Prompt View**
*This view is shown when a user with 0 credits tries to use AI Mode.*
```
┌──────────────────────────────────────┐
│  [ (Offline) |  AI  ]   <-- AI is greyed out │
│                                      │
│      "You're out of free credits."   │
│                                      │
│  [=== Upgrade with your API Key ===] │
│                                      │
└──────────────────────────────────────┘
```

#### **Wireframe 3: BYOK Choice View**
*Shown after clicking "Upgrade" or the settings (⚙️) icon.*
```
┌──────────────────────────────────────┐
│                                      │
│      "Connect your AI Provider"      │
│                                      │
│  [ (O) OpenRouter ]  [ (</>) Manual ]│
│                                      │
│                                      │
└──────────────────────────────────────┘
```

#### **Wireframe 4: BYOK Configuration (OpenRouter)**
*Shown after selecting "OpenRouter".*
```
┌──────────────────────────────────────┐
│  Provider: OpenRouter (Change)       │
│                                      │
│  API Key:                            │
│  [ *********************** ] [👁️]     │
│                                      │
│  Model:                              │
│  [ Combobox: Search models... ▼ ]    │ <-- Searchable dropdown
│                                      │
│  [========= Save & Test =========]   │
└──────────────────────────────────────┘
```

#### **Wireframe 5: BYOK Configuration (Manual)**
*Shown after selecting "Manual".*
```
┌──────────────────────────────────────┐
│  Provider: Manual (Change)           │
│                                      │
│  API Base URL:                       │
│  [ https://api.groq.com/openai/v1  ] │
│                                      │
│  API Key:                            │
│  [ *********************** ] [👁️]     │
│                                      │
│  Model Name:                         │
│  [ meta-llama/Llama-3.1-8b-instant ] │
│                                      │
│  [========= Save & Test =========]   │
└──────────────────────────────────────┘
```

#### **Wireframe 6: Active 'Pro' View**
*The main view after a key has been successfully saved.*
```
┌──────────────────────────────────────┐
│  [ (Offline) | **AI** ]              │
│                                      │
│      "Using your API key."           │
│                                      │
│  [======== Clean & Copy ========]    │
│                                (⚙️)  │ <-- Now links to saved config
└──────────────────────────────────────┘
```

#### **Wireframe 7: Saved Configuration & Remove Action**
*Shown when a Pro user clicks the settings (⚙️) icon.*
```
┌──────────────────────────────────────┐
│  Provider: OpenRouter (Locked)       │
│                                      │
│  API Key:                            │
│  [ ******************** ] [ (X) Remove ]│ <-- Remove button
│                                      │
│  Model:                              │
│  [ meta-llama/Llama-3.1-8b-instant ] │ <-- Now just text
│                                      │
│  [============ Done ============]    │
└──────────────────────────────────────┘
```

---

### **Part 2: Consolidated User Flows**

Here is a narrative summary of the three critical end-to-end user flows.

#### **Flow 1: The Core "Magic" Loop**
1.  **Start:** A user on a webpage highlights text and clicks the PromptReady icon.
2.  **Action:** The "Main View" popup appears, defaulting to AI Mode. The user clicks the prominent "Clean & Copy" button.
3.  **Feedback:** The button shows a brief loading state, followed by a "Copied to clipboard!" success toast. The popup closes automatically.
4.  **Result:** The user has perfectly structured Markdown on their clipboard. The entire process feels like a single, instantaneous action.

#### **Flow 2: The Power User's Direct Path (Proactive BYOK)**
1.  **Start:** A power user, knowing they want to use their own key, opens the popup.
2.  **Action:** They ignore the main button and click the subtle settings (⚙️) icon in the corner.
3.  **Choice:** The "BYOK Choice View" appears. The user selects either "OpenRouter" or "Manual".
4.  **Configuration:** The appropriate configuration view is shown. The user enters their credentials (and for OpenRouter, selects a model from the dynamically populated combobox). They click "Save & Test".
5.  **Result:** A success toast confirms the key is valid. The UI switches to the "Active 'Pro' View." The user can now use the extension with their own key, having bypassed the free trial entirely.

#### **Flow 3: The Free Trial Upgrade Path**
1.  **Start:** An engaged user has used all 150 free credits. They try to use AI Mode again.
2.  **The Wall:** The "Upgrade Prompt View" appears, clearly stating they are out of credits and offering the upgrade path.
3.  **Action & Choice:** The user clicks "Upgrade," which takes them to the "BYOK Choice View," and the flow proceeds exactly like **Flow 2, Step 3** onwards.
4.  **Managing the Key:** At any time after upgrading, this user can click the settings (⚙️) icon to view their saved configuration. If they click the "Remove" button, a confirmation dialog appears to prevent accidental deletion before reverting them to the free (and credit-less) plan.

---

The BYOK Configuration View

┌──────────────────────────────────────────────────────────┐
│ STATE 1: Initial BYOK View                               │
│                                                          │
│  "Connect your AI Provider"                              │
│                                                          │
│  [ Button: (O) OpenRouter ]  [ Button: (</>) Manual ]    │
│  <── User makes a choice                                 │
└──────────────────────────────────────────────────────────┘
     |                  |
(User clicks OpenRouter) (User clicks Manual)
     |                  |
     ▼                  ▼
┌────────────────────┐  ┌──────────────────────────────────────────┐
│ STATE 2A:          │  │ STATE 2B:                                │
│ OpenRouter Config  │  │ Manual OpenAI-Compliant Config           │
│                    │  │                                          │
│ "Provider: OpenRouter"│ "Provider: Manual"                       │
│                    │  │                                          │
│ API Key:           │  │ API Base URL:                            │
│ [ *************** ]│  │ [ https://z.groq.com/openai/v1      ]  │
│                    │  │                                          │
│ Model:             │  │ API Key:                                 │
│ [ (Searchable Dropdown) ] │ [ *************** ]                    │
│                    │  │                                          │
│ [Save & Test]      │  │ Model Name:                              │
└────────────────────┘  │ [ meta-llama/Llama-3.1-8b-instant    ]  │
                        │                                          │
                        │ [Save & Test]                            │
                        └──────────────────────────────────────────┘
     |
     +-----> (User Clicks "Save & Test") <------+
                        |
                        ▼
┌──────────────────────────────────────────────────────────┐
│ STATE 3: Saved & Active Configuration                    │
│                                                          │
│  "Provider: OpenRouter" (or "Manual")                    │
│                                                          │
│  API Key: [ **************************** ] [ (X) Remove ]│
│                                                          │
│  Model: [ meta-llama/Llama-3.1-8b-instant ]              │
│  (This field is now just text, not an input)             │
│                                                          │
└──────────────────────────────────────────────────────────┘