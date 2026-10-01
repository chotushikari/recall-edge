# Windows desktop installer

Recall's current downloadable preview is source-based. A native signed EXE
requires two separate, auditable steps:

1. Package the desktop shell and local runtime into an unsigned installer.
2. Sign the exact installer using an organization-owned Windows code-signing
   certificate.

The repository's CI workflow is prepared for this boundary. It may create an
unsigned preview artifact without secrets. Signing is intentionally skipped
unless the release environment provides all of:

- WINDOWS_CERTIFICATE_BASE64: a base64-encoded PFX certificate;
- WINDOWS_CERTIFICATE_PASSWORD: its password;
- WINDOWS_TIMESTAMP_URL: the certificate authority's RFC 3161 timestamp
  endpoint.

Do not commit a certificate, private key, or password. Add them as protected
GitHub Actions secrets in the release repository. Certificate purchase,
identity verification, and private-key custody belong to the project owner;
they cannot be safely automated from an application repository.

## Local prerequisites for a native build

- Windows 10/11;
- Rust stable and the MSVC C++ Build Tools;
- Node.js 20+;
- Python 3.11+;
- a Windows packaging toolchain selected by the desktop shell;
- Windows SDK signtool only when signing.

Until those prerequisites and a certificate are available, the supported
download is the source preview described in [windows-desktop.md](windows-desktop.md).
