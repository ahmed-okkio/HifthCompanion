import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { plugin as shadcn } from "@shadcn/lint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Design-system guardrails. Errors: `npm run lint` fails on design drift.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { shadcn },
    settings: {
      shadcn: {
        ui: "@/components/ui",
        note: "See docs/design-system.md for design rules and approved exceptions.",
      },
    },
    rules: {
      "shadcn/no-restyle": ["error", { allow: ["layout"] }],
      "shadcn/no-raw-colors": "error",
      // Allowed: layout geometry with no token equivalent (see docs/design-system.md §1).
      "shadcn/no-arbitrary-values": ["error", { allow: [
        "*calc(*", "*clamp(*", "*min(*", "*vh]", "*vw]", "*-[*%]", "max-w-[*ch]",
        "grid-cols-[*", "grid-rows-[*", "bg-radial-[*", "[--*",
        "[clip-path:*", "[unicode-bidi:*", "[animation-delay:*",
      ] }],
      "shadcn/no-inline-styles": "error",
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
    },
  },
  { files: ["src/components/ui/**"], rules: { "shadcn/no-restyle": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", ".claude/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
