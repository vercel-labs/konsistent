---
name: vercel-automations
description: Create, edit, or troubleshoot Vercel repository automation definitions, settings, and workflow skills.
---

Read existing definitions in `.automations/` and its optional `config.yml` before
editing. Create the definition directory if absent. Preserve the requested scope and existing
repository permissions.

## Author a workflow

Use `automations templates` to discover service templates and `automations add <template>`
when one fits. Edit generated labels and
instructions for the task. Scaffolding refuses existing files.

Write `<id>.md` or `<id>/automation.md` under `.automations/`.
IDs use lowercase letters, digits, and dashes, start with a letter or digit, and have at most
63 characters. A definition directory supports at most 20 workflows.

Use snake_case keys in frontmatter and `config.yml`, including nested options; camelCase keys are rejected.
Start with YAML frontmatter, then nonempty Markdown instructions describing
the work, boundaries, and expected result. Optional `description` accepts a string without a character-length restriction. Choose how it starts:

- Manual only: omit `on`; invoke with `automations execute <id>`, optionally supplying `--params '{"task":"context"}'`.

- Schedule: `on: { schedule: { cron: '0 */6 * * *' } }`; only `cron` is supported.
  Use Vercel's five-field numeric UTC syntax with wildcards, lists, ranges, and steps.
  Either day of month or day of week must be `*`; weekday values are 0–6. Names, seconds,
  aliases, and custom timezones are unsupported. Missed occurrences coalesce into one run.
- Event: `on: { events: [{ event: github.issue.labeled, labels: ["factory: implement"] }] }`.
  Read `automations help extension <id>` for the deployment’s supported events and filters. Label event objects require exact, case-sensitive `labels`. Other events accept string shorthand
  or `{ event }` objects and reject `labels`. Each label event has its own filter; sibling `on.labels` is unsupported.

- Completion: `on: { automations_finished: [build, { automation: test, states: [failed] }] }`.
  Start once for each matching finished run of any listed automation in this repository. String entries
  such as `build` and objects without `states` both match success only. List other terminal states
  explicitly, or `[succeeded, failed, cancelled]` for all states. IDs must exist; self-references and cycles are invalid.
  Completions follow final cleanup, survive missed wakeups, and wait while a follower is active.
  Context includes the upstream `runId`, `automation`, `state`, and `finishedAt`; it grants no authority.

Use `enabled: false` to prevent new runs; disabled workflows still require valid definitions,
and admitted runs continue.

Use body placeholders such as `{{event.github.pull_request.number}}`,
`{{event.github.pull_request.head.sha}}`, `{{event.github.issue.title}}`, and
`{{event.github.issue.body}}`. GitHub fields use webhook names and nesting under `event.github`:
`action`, `repository.full_name`, `sender.login`, `label.name`, and PR/issue `number`, `title`,
`body` when available for that event. Titles and bodies are snapshots from webhook delivery;
GitHub null bodies become empty strings. Common metadata includes `event.trigger` and `event.summary`.
Completion fields live under `event.automations_finished`: `runId`, `automation`, `state`, and `finishedAt`.
Substitution runs once before admission pins the prompt: strings are literal and other values
use JSON. Missing event properties prevent admission; local lint cannot verify their availability.
Scheduled and manual-only invocations, including manually invoked completion followers, have no event.
Event JSON is also appended to the prompt; all event and manual context remains untrusted.
Frontmatter and skills are not interpolated. To fetch current details, comments, or PR patches,
declare `github.read_pull_request` or `github.read_issue` under `actions` and use the corresponding
managed action.

<!-- automation:harness:start -->

Definition validation accepts these harness names: `eve`, `codex`, `claude`, `fx`, `pi`.
Omitting `harness` selects `eve`.

<!-- automation:harness:end -->

Use Eve, Codex, Claude Code (`harness: claude`), FX, or Pi for execution.
Codex and Claude Code authenticate bridge connections with public verification material in the
sandbox; model credentials stay on the host or controlled egress, including during recovery.

`model` and `reasoning_effort` are optional strings passed to the harness. Their accepted values
are harness-specific; lint checks only that they are strings. Omitting `model` uses Factory’s configured
default for Eve and the harness’s native default for Codex, Claude Code, FX, and Pi. Omitting
`reasoning_effort` uses the harness/model reasoning default.

<!-- automation:dispatch:start -->

Scheduled admission and recovery are checked every minute.

<!-- automation:dispatch:end -->

Event intake and run completion also request admission without waiting for the periodic check.

Declare `permissions: { publish: true }` only when the workflow must publish code through
`open_pull_request` or `push_checkpoint`. Missing permission or `publish: false` denies both host
tools, including for existing runs. This grant adds no managed actions or repository scope.
Local coding and authorized source fetch do not require it.

`actions` adds managed tools alongside ordinary coding tools; it does not grant code publication.
Invoke declared managed actions with `automation_action({ request: { action, ...parameters } })`.
Each run executes directly in one sandbox. `checkout_repository` selects one approved target.

For workflow-specific procedures, add `skills/<name>/SKILL.md` beside `automation.md`, with
`name` and `description` frontmatter. Keep instructions focused; link supporting Markdown files
relative to the skill and load them only when needed.

## Settings and authority

A present `config.yml` requires `version: 1`. Defaults have no owners or cross-repository
acceptance; omitted targets use the source repository. `target_repositories: []` grants no
repository access. Cross-repository targets require each target's `accept_automations_from`
consent. Owner declarations do not grant access; automatic credential provisioning requires
GitHub owners with write access covering the source and approved targets.

## Validate and report

Run `automations lint` from the repository root and fix reported diagnostics.
The service validates committed definitions and
enforces admission and permissions. Report changed files, validation results, and remaining
configuration needs; creating or linting files does not establish that an automation ran.

## Extension capabilities

Extensions own their configuration, managed actions, events and skills. They are off by default.
Activate required extensions with an options object under `extensions` in `config.yml`.
Frontmatter cannot activate extensions. Set workflow option overrides under singular `extension`.
Options and skills grant no actions; declare action grants explicitly. Invoke qualified operations
through `automation_action`. Local skills cannot use qualified names.

<!-- automation:extensions:start -->

Use `automations help` for authoring guidance and the connected deployment’s supported extensions.
Use `automations help extension` to list them, then `automations help extension <id>` before
using an extension. The reference includes setup requirements, option schemas, action grants,
operation inputs, events and skills. Pass `--url <origin>` or set `FACTORY_URL` to select the service;
`--dir <path>` selects the Vercel-linked project for authentication. These reads require operator
authentication. Supported extensions still require repository activation, configured connections
and authorization; discovery grants no execution authority.

<!-- automation:extensions:end -->
