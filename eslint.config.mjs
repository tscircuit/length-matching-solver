import tsParser from "@typescript-eslint/parser"
import { projectStructurePlugin } from "eslint-plugin-project-structure"

export default [
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "project-structure": projectStructurePlugin,
    },
    rules: {
      "max-lines": [
        "error",
        {
          max: 499,
          skipBlankLines: false,
          skipComments: false,
        },
      ],
      "project-structure/file-composition": [
        "error",
        {
          filesRules: [
            {
              filePattern: "**/*.{ts,tsx}",
              rootSelectorsLimits: [
                {
                  limit: 1,
                  selector: ["class", "function", "arrowFunction"],
                },
              ],
            },
          ],
        },
      ],
    },
  },
]
