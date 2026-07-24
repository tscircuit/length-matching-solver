import tsParser from "@typescript-eslint/parser"
import { projectStructurePlugin } from "eslint-plugin-project-structure"

const minimumFileLinesPlugin = {
  rules: {
    "minimum-lines": {
      meta: {
        type: "suggestion",
        schema: [
          {
            type: "object",
            properties: {
              minimum: { type: "integer", minimum: 1 },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          tooShort:
            "File contains {{actual}} non-empty lines; prefer at least {{minimum}}.",
        },
      },
      create(context) {
        return {
          Program(node) {
            const isModuleWiring =
              node.body.length > 0 &&
              node.body.every(
                (statement) =>
                  (statement.type === "ExportNamedDeclaration" &&
                    statement.source !== null) ||
                  (statement.type === "ImportDeclaration" &&
                    statement.specifiers.length === 0),
              )
            if (isModuleWiring) return

            const minimum = context.options[0]?.minimum ?? 6
            const actual = context.sourceCode
              .getLines()
              .filter((line) => line.trim().length > 0).length
            if (actual >= minimum) return
            context.report({
              node,
              messageId: "tooShort",
              data: { actual, minimum },
            })
          },
        }
      },
    },
  },
}

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
      "project-conventions": minimumFileLinesPlugin,
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
      "project-conventions/minimum-lines": ["warn", { minimum: 6 }],
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
