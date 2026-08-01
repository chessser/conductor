# Templates

A template defines a **repeatable, repo-agnostic task**: a versioned prompt
plus a required-parameter schema. The Jira intake form's `template` field
is a dropdown sourced from this directory, so the same template run against
different repos produces consistent results (design doc / [task-types.md](../docs/task-types.md)).

## Format

Each template is a directory: `templates/<template-id>/`.

```
templates/bump-dependency/
  prompt.md       # the instructions handed to the agent, with {{parameter}} placeholders
  schema.json     # JSON Schema for the required `parameters` object
```

`schema.json` example:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["package", "targetVersion"],
  "properties": {
    "package": { "type": "string" },
    "targetVersion": { "type": "string" }
  }
}
```

`prompt.md` example:

```markdown
Bump {{package}} to {{targetVersion}} in this repo. Update the lockfile,
run the test suite, and fix any resulting breakage that's clearly caused by
the version bump. Do not touch unrelated dependencies.
```

## Adding a template

1. Create `templates/<id>/prompt.md` and `templates/<id>/schema.json`.
2. Add the id to the Jira form's `template` dropdown (Jira admin, manual
   step — not automated by this tool).
3. No code change needed — `conductor run`/`conductor pair` resolve the template by
   id at dispatch time.

No templates ship yet — this directory is a placeholder until step 4/5 of
[docs/build-order.md](../docs/build-order.md) is implemented.
