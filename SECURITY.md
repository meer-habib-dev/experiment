# Security policy

## Reporting a vulnerability

Please do not open a public issue for a vulnerability, exposed credential, or privacy concern. Use
GitHub's private vulnerability reporting feature for this repository. If that feature is not
available, contact the maintainer through the private address listed on their GitHub profile.

Include the affected route or module, reproduction steps, impact, and any suggested mitigation.
You should receive an acknowledgement within seven days.

## Supported code

Native Lab is an experimental application, not a production SDK. Security fixes target the latest
commit on the default branch. Old tags and forks are not maintained.

Camera experiments process frames on-device. Contributions must not add uploads, analytics, or
persistent capture storage without an explicit user-facing design and maintainer review.
