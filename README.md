# Running Hifumi

## Prerequisites

- Node.js 26 (uses Node's native TypeScript type stripping).
- pnpm 11.
- [ImageMagick](https://imagemagick.org/index.php) for image manipulation.
- [gifsicle](https://www.lcdf.org/gifsicle/) for GIF resizing.

Verify the tool versions before continuing:

```shell
# Unix
convert -version
# Windows
magick -version

gifsicle --version
```

## Setup

Copy the environment template, then fill in the values for your bot and service accounts:

```shell
cp .env.example .env
```

Install the project dependencies:

```shell
pnpm install
```

## Run and develop

Run the application directly with Node:

```shell
pnpm run run
```

Start the development watcher:

```shell
pnpm run dev
```

Run the formatter/linter, type check, and tests:

```shell
pnpm run build
pnpm test
```

## PM2

PM2 is installed as a project dependency. Use the package scripts; a global PM2
installation is not required:

```shell
pnpm start
pnpm run restart
pnpm run stop
```
