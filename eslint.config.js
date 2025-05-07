import tseslint from 'typescript-eslint'
import eslint from 'eslint'

export default [
	{
		ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.husky/**', 'rollup.config.js'],
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'module',
			parser: tseslint.parser,
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
		},
		rules: {
			// Base ESLint rules
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'prefer-const': 'warn',
			'no-var': 'error',
			eqeqeq: ['error', 'always', { null: 'ignore' }],

			// TypeScript specific rules
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],

			// Allow certain patterns that are common in this codebase
			'@typescript-eslint/ban-ts-comment': [
				'warn',
				{
					'ts-expect-error': 'allow-with-description',
					'ts-ignore': 'allow-with-description',
					'ts-nocheck': 'allow-with-description',
					'ts-check': false,
				},
			],
		},
	},
	...tseslint.configs.recommended,
]
