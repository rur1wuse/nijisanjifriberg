# Copyright and license notices

This repository is a modified version of **csgofriberg**, which is licensed
under the GNU Affero General Public License, version 3.

## Copyright holders

| Work | Copyright |
| --- | --- |
| Original: csgofriberg | Copyright (C) 2026 星海 (Xinhai) &lt;62863922+xinhai-ai@users.noreply.github.com&gt; |
| Modifications: nijisanjifriberg | Copyright (C) 2026 rur1wuse &lt;xuelunai@gmail.com&gt; |

- Original project: <https://github.com/shnlfriberg/csgofriberg>
- This version: <https://github.com/rur1wuse/nijisanjifriberg>

## License

Both the original work and this modified version are distributed under the
**GNU Affero General Public License, version 3**. The full, unmodified license
text is in [`LICENSE`](LICENSE). A description of the changes is in
[`NOTICE`](NOTICE).

Because the original work is AGPL-3.0, this derivative must also remain under
AGPL-3.0. It may not be relicensed.

## How modified files are marked

Section 5 of the AGPL requires modified source files to carry prominent
notices stating that they were modified, together with the date of change.
Every source file changed relative to the original work carries this header:

```ts
/**
 * Modified for nijisanjifriberg (2026-10-27).
 * Original: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3. See LICENSE and NOTICE.
 */
```

Files that were created for this version (and therefore contain no original
code) carry a shorter notice stating authorship under the same license:

```ts
/**
 * nijisanjifriberg — Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3. See LICENSE.
 */
```

Files deleted relative to the original work are recorded in the version history
and summarised in [`NOTICE`](NOTICE).

## Scope of the modified files

The change is repository-wide. It affects, as of the date above:

- the player data model, seed data and attribute comparison logic;
- the single-player, daily challenge and multiplayer flows that consume it;
- the admin interface, and removal of the external API, API-token, cheat
  analysis and player-change-review subsystems;
- the i18n catalogues (zh / en / ja);
- the build, deployment and documentation files;
- the project name and default database / Redis identifiers.

Refer to the repository history for the authoritative list of changed files:

```bash
git log --follow --stat -- <path>
git diff 6b9d7c4 6aa863f --stat
```

## Offering the source under section 13

The AGPL requires that users who interact with this program over a network be
offered its Corresponding Source. Anyone operating a deployed instance must make
that source available to its users, for example by publishing the exact revision
in use and linking to it from the running application.

## Third-party components

Runtime dependencies (React, Express, Socket.IO, Knex, and others) remain under
their own licenses as declared in their respective packages and lockfiles. This
notice does not alter those terms.

## Contributing

By contributing to this repository you agree that your contributions are
licensed under the GNU Affero General Public License, version 3.
