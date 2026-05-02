import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import drizzle from "eslint-plugin-drizzle";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	...compat.extends("next/core-web-vitals", "next/typescript"),
	{
		plugins: {
			drizzle,
		},
		rules: {
			"drizzle/enforce-delete-with-where": "error",
			"drizzle/enforce-update-with-where": "error",
		},
	},
];

export default eslintConfig;
