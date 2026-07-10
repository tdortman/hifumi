/// <reference types="@total-typescript/ts-reset" />
// Replaces the runtime side-effect import `import "@total-typescript/ts-reset"`.
// ts-reset is a devDependency with 0-byte runtime files. This triple-slash
// reference activates its global type augmentations at compile time without
// requiring the package in production.
