// WorkOS AuthKit token validation for `ctx.auth.getUserIdentity()`.
//
// The component's `getAuthUser(ctx)` reads the identity via `ctx.auth`, so these
// providers MUST be registered or every authenticated request resolves to
// `null`. WorkOS issues access tokens under two different issuers depending on
// the auth method, so both entries are required:
//   - SSO / hosted AuthKit sessions: issuer `https://api.workos.com/`
//   - Direct user-management sessions: issuer `https://api.workos.com/user_management/${clientId}`
// Both share the same JWKS endpoint. This mirrors `authKit.getAuthConfigProviders()`.
const clientId = process.env.WORKOS_CLIENT_ID

// This WorkOS environment hosts multiple AuthKit applications (this app plus
// a sibling, DeceptiveProject) sharing one user directory by design — that's
// the point of putting them in the same environment. WorkOS's User
// Management access tokens carry `iss = .../user_management/<client_id>`
// where `<client_id>` is the ENVIRONMENT's canonical client ID (its default
// app's ID), not necessarily the specific app that initiated the login —
// this is true for every app in a multi-app environment, not just refreshed
// tokens. A single-app auth.config.ts (issuer scoped only to this app's own
// client_id) therefore rejects valid tokens. Since every app in the
// environment shares the same JWKS signing key (verified: byte-identical key
// material at /sso/jwks/<client_id> across apps), accepting the environment's
// canonical issuer is safe — the real access boundary is `requireMentor`'s
// org-membership/role check, not which app label is on the token.
// Set via `npx convex env set WORKOS_ENVIRONMENT_CLIENT_ID <id>` — find it at
// Staging/Production environment settings in the WorkOS dashboard (each
// environment has its own canonical client ID).
const environmentClientId = process.env.WORKOS_ENVIRONMENT_CLIENT_ID

export default {
  providers: [
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/`,
      algorithm: "RS256" as const,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256" as const,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${environmentClientId}`,
      algorithm: "RS256" as const,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
}
