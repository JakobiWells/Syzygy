# Syzygy

Guides for getting your life in order.

## Setup

```bash
npm install
```

## Local development

```bash
npm run dev
```

Opens at `http://localhost:5173`.

## Adding a guide

1. Create a new `.md` file in `src/guides/`
2. Add frontmatter at the top:

```markdown
---
title: Your Guide Title
slug: your-guide-slug
description: One-line description shown on the home page.
tags: [tag1, tag2]
---

## First Section

Your content here.
```

The guide will appear automatically on the home page. The URL will be `/guides/your-guide-slug`.

Headings at `##` and `###` level are picked up for the table of contents.

## Build

```bash
npm run build
```

Output goes to `dist/`. Deploy anywhere static. `vercel.json` is pre-configured for Vercel.
