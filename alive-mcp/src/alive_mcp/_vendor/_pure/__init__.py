"""Pure (print-free, exit-free) helpers extracted from ALIVE plugin CLIs.

The upstream ``project.py`` and ``tasks.py`` scripts in
``claude-code/plugins/alive/scripts/`` are CLIs: they call ``print()`` on
stdout and ``sys.exit()`` on error. Importing them into a long-lived stdio
JSON-RPC server is dangerous -- stdout writes corrupt MCP framing, and
``sys.exit`` kills the whole server process.

This module extracts the pure LOGIC of those CLIs into import-safe helpers
that raise typed exceptions instead of printing/exiting. The exception
taxonomy is intentionally narrow:

- ``WorldNotFoundError`` -- discovery walk failed to locate a World root.
- ``KernelFileError``    -- a required ``_kernel/*`` file is missing or
                            unreadable.
- ``MalformedYAMLWarning`` -- a manifest or YAML blob could not be parsed;
                              the caller decides whether to swallow or
                              propagate. ``Warning`` is the stdlib base so
                              the ``warnings`` module can optionally capture
                              these.

See ``VENDORING.md`` (one directory up) for the source commit hash, the
extracted-function list, and the refresh policy.
"""

from __future__ import annotations


class WorldNotFoundError(Exception):
    """Raised when walking upward from a candidate path finds no World root.

    A World root is a directory containing ``.alive/``. Callers that need to
    resolve a walnut's enclosing World should catch this and surface
    ``ERR_NO_WORLD`` to the client per the v0.1 error taxonomy (fn-10-60k.4).
    """


class KernelFileError(Exception):
    """Raised when a required ``_kernel/`` file cannot be read.

    Includes both "missing on disk" and "present but unreadable" (permission
    error, bad UTF-8). Callers should treat this as ``ERR_KERNEL_FILE_MISSING``
    or ``ERR_KERNEL_FILE_CORRUPT`` based on the ``cause`` chain.
    """


class MalformedYAMLWarning(Warning):
    """Emitted when a structured-text source cannot be read or parsed.

    Despite the "YAML" in the name (retained for API stability -- the
    original use site was a YAML manifest), the extracted helpers emit
    this warning for every structured-text read failure they swallow:

    - YAML bundle manifests (`context.manifest.yaml`)
    - YAML squirrel entries (`.alive/_squirrels/*.yaml`)
    - JSON task files (`_kernel/tasks.json`, `bundles/*/tasks.json`)
    - JSON completed files (`_kernel/completed.json`)
    - JSON child projections (`_kernel/now.json`, `_kernel/_generated/now.json`)

    Uses ``Warning`` rather than ``Exception`` because the upstream CLIs
    tolerate malformed files by skipping them; extracted helpers follow
    the same policy so a single drifted file doesn't crash a projection.
    Callers that want hard failures can install a warning filter:
    ``warnings.simplefilter("error", MalformedYAMLWarning)``.
    """


__all__ = [
    "WorldNotFoundError",
    "KernelFileError",
    "MalformedYAMLWarning",
]
