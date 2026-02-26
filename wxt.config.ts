import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// See https://wxt.dev/api/config.html
const enableDebugBuild =
  process.env.WXT_RUNTIME_DEVELOPMENT === "1" ||
  process.env.WXT_DEV_SOURCEMAP === "1";

const runtimeDevelopment = process.env.WXT_RUNTIME_DEVELOPMENT === "1";
const runtimeOpenAccess = process.env.WXT_DEV_OPEN_ACCESS === "1";
const runtimeForcePremium = process.env.WXT_DEV_FORCE_PREMIUM === "1";
const runtimeForceDeveloperMode = process.env.WXT_DEV_FORCE_DEVELOPER_MODE === "1";
const runtimeUseMockMonetization = process.env.WXT_USE_MOCK_MONETIZATION === "1";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "PromptReady",
    description: "Clean and structure webpage content into prompt-ready formats with citations",
    permissions: [
      "activeTab",
      "storage",
      "scripting",
      "downloads",
      "clipboardWrite",
      "offscreen",
      "identity"
    ],
    commands: {
      "capture-selection": {
        suggested_key: {
          default: "Ctrl+Shift+L",
          mac: "Command+Shift+L"
        },
        description: "Clean and structure selected content"
      }
    },
    action: {
      default_popup: "popup.html"
    },
    host_permissions: [
      "<all_urls>"
    ]
  },
  vite: () => ({
    plugins: [tailwindcss()],
    define: {
      __PROMPTREADY_RUNTIME_DEVELOPMENT__: JSON.stringify(runtimeDevelopment),
      __PROMPTREADY_DEV_OPEN_ACCESS__: JSON.stringify(runtimeOpenAccess),
      __PROMPTREADY_DEV_FORCE_PREMIUM__: JSON.stringify(runtimeForcePremium),
      __PROMPTREADY_DEV_FORCE_DEVELOPER_MODE__: JSON.stringify(runtimeForceDeveloperMode),
      __PROMPTREADY_USE_MOCK_MONETIZATION__: JSON.stringify(runtimeUseMockMonetization),
    },
    build: {
      // Debug builds should be easy to trace in Chrome's extension error UI.
      sourcemap: enableDebugBuild,
      minify: enableDebugBuild ? false : true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  }),
});
