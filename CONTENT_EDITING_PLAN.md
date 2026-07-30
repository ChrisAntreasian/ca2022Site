# Content Editing Plan

This document tracks the migration away from Strapi-shaped JSON toward app-owned content models, gated editing flows, and config-driven content forms.

## Goals

- Replace the current Strapi-dependent content workflow with forms owned by this application.
- Allow editing and creating any existing content type from protected routes.
- Ensure only the site owner can create, edit, or publish content updates.
- Version generated content snapshots so data changes can be reviewed and rolled back.
- Support new page types, including a future two-page spread project layout, from the same editing system.
- Drive forms from configuration objects where practical, with initial configs derived from the existing data models.

## Current State

The site currently stores generated JSON under `src/data/*.json`.

Each file still carries a Strapi export shape:

- top-level `name`
- top-level `timestamp`
- nested `data.data[]`
- nested `attributes`
- nested `meta.pagination`

The app directly consumes that shape in route loaders and components, so the content model and the transport model are still coupled.

### Existing Build Flow

The current update flow is:

1. Edit content in Strapi.
2. Call a guarded build route.
3. Fetch Strapi content.
4. Write generated JSON to `src/data`.

Relevant code:

- `src/lib/build.ts`
- `src/lib/file.ts`
- `src/routes/build/[bid]/+page.server.ts`
- `src/routes/poems/build/[bid]/+page.server.ts`
- similar build routes under content sections

This is useful because it already gives us:

- a permission gate concept
- per-content build entry points
- file generation infrastructure

Current implementation note:

- writes now create history snapshots under `src/data/history/<content-type>/<timestamp>.json`
- a baseline snapshot has been bootstrapped for each current JSON content file using its existing top-level timestamp
- future overwrites through the shared writer preserve both the prior baseline and each newly written version

## Content Types In Scope

These are the current content domains the app already renders.

### Layout

Purpose: site-wide header identity.

Current meaningful fields:

- `title`
- `image`

Probably removable from canonical model:

- Strapi wrapper fields
- pagination metadata
- most upload-provider metadata

### Landing Page

Purpose: homepage intro and navigation sections.

Current meaningful fields:

- page title
- `page_details[]`
- per section:
  - `title`
  - `description`
  - `link`
  - `image`
  - optional linked poems
  - optional linked art categories

Observed behavior:

- section id `5` is currently treated as intro content
- other sections are treated as link/navigation content
- section titles also drive special rendering in the home nav

Implication:

- canonical schema should not rely on magic numeric ids or presentation-specific titles when a more explicit `kind` field can do that job

### Poems

Purpose: poem listing and poem detail navigation.

Current meaningful fields:

- `title`
- `body`
- `position`
- `featured`

Observed behavior:

- poems are sorted by `position`
- `featured` currently exists but does not appear to drive current rendering strongly
- homepage references a curated subset through landing-page links, not through `featured`

Implication:

- canonical model should keep `sortOrder`
- decide whether `featured` remains a real editorial concept or is removed

### The Quintuplapus

Purpose: illustrated gallery/story project.

Current meaningful fields:

- project `title`
- `art_pieces[]`
- per art piece:
  - `title`
  - `description`
  - `createdDate`
  - `medium`
  - `order`
  - `image`
- `omit[]`

Observed behavior:

- art is sorted by `order`
- `omit` can hide specific items from display
- items are a hybrid of story page and gallery record

Implication:

- this is a strong candidate to inform the future config-driven project editor

### The SoulJuicer

Purpose: ordered gallery/project sequence.

Current meaningful fields in data:

- `description`
- `order`
- `image`

Current meaningful fields injected in code:

- display title
- display date
- display medium

Implication:

- canonical model should decide whether title, medium, and date belong on each item, on the project, or are intentionally computed presentation fields

### Web Experience

Purpose: intro plus rich work entries.

Current meaningful fields:

- page intro title and description
- `rich_links[]`
- per entry:
  - `title`
  - `body`
  - `link`
  - `secondLink`
  - `position`
  - `logo`
  - `image[]`

Observed behavior:

- entries are sorted by `position`
- screenshots are displayed as a group per entry

Implication:

- this is a clean example of a repeatable entry-based editor with nested assets

### About

Purpose: appears to hold older page content and external links.

Observed behavior:

- currently present in `src/data/about.json`
- not obviously loaded by current active routes

Implication:

- confirm whether this content should be migrated, archived, or reintroduced later

## What Is Probably Strapi-Specific

These fields appear to belong more to the old CMS transport layer than the app domain:

- `data.data`
- `attributes`
- `meta.pagination`
- `createdAt`
- `updatedAt`
- `publishedAt`
- upload `provider`
- upload `provider_metadata`
- many image bookkeeping fields such as `hash`, `ext`, and raw generated variant names

These should not be the default authoring shape unless there is a clear site-level use for them.

## Proposed Canonical Direction

The long-term app-owned model should favor direct data structures over nested Strapi envelopes.

Example direction:

### Shared Asset Model

- `id`
- `alt`
- `caption`
- `originalUrl`
- `variants`

### Shared Content Metadata

- `id`
- `slug`
- `status`
- `createdAt`
- `updatedAt`
- `publishedAt`

Note: timestamps only stay if they serve editorial history or publishing behavior, not because Strapi used them.

### Example Project Shapes

`LayoutConfig`

- `title`
- `logo`

`LandingPage`

- `introSections[]`
- `navSections[]`

`Poem`

- `id`
- `slug`
- `title`
- `bodyMarkdown`
- `sortOrder`
- `featured`

`GalleryProject`

- `id`
- `slug`
- `title`
- `layout`
- `items[]`
- `hiddenItemIds[]`

`GalleryItem`

- `id`
- `slug`
- `title`
- `descriptionMarkdown`
- `image`
- `sortOrder`
- `createdDate`
- `medium`

`WorkExperiencePage`

- `intro`
- `entries[]`

`WorkEntry`

- `id`
- `slug`
- `title`
- `bodyMarkdown`
- `primaryLink`
- `secondaryLink`
- `logo`
- `screenshots[]`
- `sortOrder`

## Editing System Target

The editor should eventually support both creation and modification of all existing data.

### Permission Model

Initial requirement:

- only you can access editing routes

Pragmatic first pass:

- reuse a server-side gate similar to the existing build key pattern
- protect edit routes and form actions on the server, not only in the UI
- keep secrets in environment variables

Future-friendly version:

- session-based auth
- explicit user identity
- roles such as `owner`, `editor`, `reviewer`

For now, the simplest acceptable design is owner-only access.

### Save Model

The editor should not write directly into ad hoc shapes.

Prefer:

1. validate submitted form data against app-owned schemas
2. save canonical JSON snapshots
3. optionally generate runtime-friendly derived data
4. keep older versions available by date or revision id

Possible storage direction:

- `src/data/current/*.json` for the active version
- `src/data/history/<content-type>/<timestamp>.json` for snapshots

That folder layout is only a proposal. We can change it before implementation.

Current implementation note:

- the active files still live directly in `src/data/*.json`
- historical snapshots already live in `src/data/history/<content-type>/<timestamp>.json`

## Config-Driven Forms

The form system should be defined by configuration objects instead of one-off hardcoded forms where possible.

The repo already uses Effect `Schema` heavily for JSON validation, so the best direction is not a separate ad hoc form description language. The better direction is a codec-backed editor definition where:

- the codec owns parsing, validation, and output typing
- the editor config owns rendering metadata and interaction behavior
- both are registered together as one content-type definition

This lets us avoid duplicating field names and types, while still keeping the form layer expressive enough for real UI needs.

### Recommendation: Codec Plus UI Config

Using only a codec to generate the full form is usually too weak.

Why:

- codecs know the data shape, but not the best widget
- codecs do not naturally encode field order for editorial UX
- codecs do not tell us which textarea should be markdown-enabled
- codecs do not describe repeater item labels
- codecs do not express conditional visibility cleanly
- codecs do not carry layout concerns for more complex editors

So the target should be:

- one canonical schema/codec per content type
- one editor config per content type
- one shared editor renderer library that consumes both

### Proposed Editor Definition Shape

Conceptually, each content type should register a single definition object:

```ts
type EditorDefinition<A> = {
  key: string;
  schema: Schema.Schema<A, unknown>;
  fields: readonly FieldConfig<A>[];
  defaults: () => A;
  fromStored?: (input: unknown) => A;
  toStored?: (value: A) => unknown;
};
```

And each field config should describe the editorial UI, not the validation logic:

```ts
type FieldConfig<A> = {
  path: string;
  label: string;
  kind:
    | "text"
    | "textarea"
    | "markdown"
    | "number"
    | "checkbox"
    | "select"
    | "image"
    | "group"
    | "repeater";
  description?: string;
  placeholder?: string;
  required?: boolean;
};
```

That split is important:

- the schema tells us whether submitted data is valid
- the field config tells us how to render and edit it well

### Why This Fits This Repo

This project already has established `Schema` usage in:

- `src/lib/typing/strapi.ts`
- `src/lib/typing/poem.ts`
- `src/lib/typing/page.ts`
- `src/lib/typing/art.ts`

That means we do not need to invent a new validation stack.

Instead, we should:

1. define app-owned canonical schemas
2. decode incoming/stored data with those schemas
3. render forms from a config object associated with each schema
4. encode validated values back into the persisted shape we choose

### Important Constraint

The current Strapi codecs are transport codecs, not ideal authoring codecs.

For example, `strapiPoemC` and related schemas still preserve:

- wrapper objects
- nested `attributes`
- pagination metadata
- timestamps that may not belong in the editing surface

So the editor should not be generated from the current Strapi schemas directly.

Instead, we should first create canonical content schemas for editing.

### First Proof Target: Poems

Poems remains the best first proof because it is flat and easy to reason about.

Recommended first canonical poem direction:

```ts
type Poem = {
  id: number;
  slug: string;
  title: string;
  bodyMarkdown: string;
  sortOrder: number;
  featured: boolean;
};
```

Recommended first poem editor fields:

- `title` as text
- `slug` as text
- `bodyMarkdown` as markdown textarea
- `sortOrder` as number
- `featured` as checkbox

This gives us a clean vertical slice for:

- canonical schema
- codec-backed validation
- config-driven form rendering
- owner-only route protection
- save and snapshot behavior

### Form Config Responsibilities

A form config should eventually describe:

- content type key
- label/title
- route slug
- schema or validator
- field list
- field types
- nested/repeatable groups
- default value factory
- transform from persisted data to form values
- transform from form values to persisted data

### Field Types We Will Likely Need

- text
- textarea
- markdown textarea
- number
- checkbox
- select
- image reference
- list / repeater
- object group
- hidden/internal field

### Derived Fields Versus Authored Fields

The editor definition should also let us separate authored values from derived values.

Examples:

- a slug may be auto-generated but still editable
- a publish timestamp may be server-managed only
- a project summary could be derived for previews

That means not every schema field has to become a visible form control.

### Decision

Yes, using codecs as part of the form-definition system makes sense.

But the practical design should be:

- codec for validation and typing
- config for form rendering
- shared editor library that consumes both

That is stronger than trying to make the codec alone fully define the UI.

### Why This Matters For The Future Two-Page Spread

If the project editor is config-driven, the future two-page spread layout can be introduced as:

- a new content schema
- a new renderer
- a new form config

without rebuilding the whole editing system.

## Future Project Type: Two-Page Spread

Target: a new project page with a two-page spread presentation, driven by form data.

This should be treated as a future content type, not a special case hacked into an existing gallery type.

Probable model direction:

`SpreadProject`

- `id`
- `slug`
- `title`
- `intro`
- `spreads[]`

`Spread`

- `id`
- `title`
- `leftPage`
- `rightPage`
- `sortOrder`

`SpreadPage`

- `headline`
- `bodyMarkdown`
- `image`
- `caption`
- `layoutVariant`

This is only a starting direction. The exact model should wait until the base editor path is proven.

## Implementation Phases

### Phase 1: Documentation And Schema Inventory

- document the current data shapes
- identify app-meaningful fields
- identify Strapi-only fields
- define canonical target models

### Phase 2: Canonical Schema Layer

- add app-owned schemas and types
- build transform functions from current JSON into canonical models
- keep rendering code unchanged where possible at first

### Phase 3: Owner-Only Edit Mode

- add protected edit routes
- add server-side authorization gate
- create a small editor for one content type first

Recommended first editor candidate:

- Poems

Reason:

- simple shape
- low nesting
- already has ordering behavior

### Phase 4: Config-Driven Editor Foundation

- define field config format
- implement generic renderer for common field types
- implement nested repeater support

### Phase 5: Broader Content Coverage

- landing page sections
- web experience entries
- gallery projects
- layout config

### Phase 6: New Two-Page Spread Project Type

- define spread schema
- define spread renderer
- define spread editor config

## Immediate Next Steps

The next concrete slice should stay narrow.

Recommended order:

1. define canonical schema docs for each current content type
2. decide the first protected editing target
3. implement owner-only gating approach
4. build the first editor against a config object

My recommendation is to start with poems first, then use that editor foundation to generalize.

## Open Questions

- Should version history live inside `src/data`, or outside the app bundle in a separate content directory?
- Should assets remain referenced by remote URLs, or should the future system support local asset manifests?
- Should content publishing be immediate, or should there be a draft and publish step?
- Should the landing page keep title-driven rendering rules, or should those become explicit section types?
- Should `about.json` be treated as active content, legacy backup, or future work?
- Should edit access stay as a single owner secret, or do you expect multiple editors later?

## Working Decisions

These are the current planning assumptions unless we revise them:

- the app will become the source of truth for content editing
- editing must be owner-only
- canonical data should not preserve Strapi wrappers by default
- forms should be driven by configuration where that does not create needless complexity
- the future two-page spread page should be built on the same editor architecture, not separately