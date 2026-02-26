import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// See https://wxt.dev/api/config.html
const enableDebugBuild =
  process.env.WXT_RUNTIME_DEVELOPMENT === "1" ||
  process.env.WXT_DEV_SOURCEMAP === "1";

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
