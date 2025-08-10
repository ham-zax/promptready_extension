Import tailwind.css:

You can now easily import the tailwind.css file in your React components:

import "@/assets/tailwind.css"; // Adjust the path if necessary


---
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="@/assets/tailwind.css" rel="stylesheet" />
  </head>
  <body></body>
</html>
---
There are some potential conflicts with WXT's recommended configuration and best practices in this setup, particularly in wxt.config.ts and tsconfig.json.

WXT advises against directly adding paths to tsconfig.json and prefers using the alias option in wxt.config.ts (see WXT documentation). However, Shadcn currently fails to resolve paths correctly if they are only defined in wxt.config.ts. There is an open issue about this in the Shadcn UI repository.

Therefore, the current approach of modifying both tsconfig.json and wxt.config.ts is a temporary workaround.

Ideally, the configuration should look like this:

// tsconfig.ts
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "jsx": "react-jsx",
-    "baseUrl": ".",
-    "paths": {
-      "@/*": ["./*"]
-    }
  }
}
// wxt.config.ts
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
+  alias: {
+    "@": path.resolve(__dirname, "./"),
+  },
  vite: () => ({
    plugins: [tailwindcss()],
-    resolve: {
-      alias: {
-        "@": path.resolve(__dirname, "./"),
-      },
-    },
  }),
});
However, this will not work correctly with Shadcn UI until the linked issue is resolved. Remember to monitor the linked issue in the Shadcn UI repository and update your configuration when a fix is available.