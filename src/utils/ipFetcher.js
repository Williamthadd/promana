// DEPRECATED — do not use in authentication flows.
//
// Client-side IP collection via a third-party service (api.ipify.org) was
// removed because: (1) it adds a third-party dependency to sign-in, (2) the
// value is client-supplied and must never be trusted as audit identity, and
// (3) /api/log-auth-error already derives the address server-side from
// x-forwarded-for / socket. Kept as a stub so old imports fail loudly
// instead of silently fetching.
export async function fetchIpAddress() {
  return 'unknown'
}

export default fetchIpAddress
