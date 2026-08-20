# HANGAR — Deferred / future work

Tracked here so it survives across sessions and machines (this file lives in
the repo, not in any one session's memory). Ask "what's on the todo list" and
this is the file to check.

## Multi-unit / multi-brigade membership via SSO-based enrollment

Right now, moving a person between units in the org tree (drag-and-drop) is
intentionally **disabled** — a person can only be reassigned between
teams/sub-teams *within* their current unit, never across units.

The reason: unit membership shouldn't be something an officer manually drags
around. The plan is to replace manual unit assignment with a real enrollment
flow tied to the user's OpenID/SSO identity — when someone logs in, their
military-card/SSO claims (which brigade/unit they actually belong to) should
determine their membership automatically, rather than a roster entry someone
typed in or dragged into place. This should also support a person belonging
to **more than one unit or brigade at once** (e.g. reservists, cross-attached
personnel), which the current one-unit-per-person `unitPeople` model doesn't
allow.

Not scoped or designed yet — just flagged so it isn't forgotten.

## Unit-level "catalog only" user role

Today the only real end users of the system are equipment-corps (אמל״ח)
people under a unit's קצין אמל״ח — everyone in `unitPeople`/teams is assumed
to be part of that chain. A separate, more limited role has been discussed for
later: a plain unit member who can only browse the catalog and submit an idea
to the unit's "idea box," with no visibility into tickets, permissions, or
anything else. Not built yet — deliberately out of scope until the above
SSO/enrollment question is settled, since that will likely shape how this
role's identity and unit-scoping work too.
