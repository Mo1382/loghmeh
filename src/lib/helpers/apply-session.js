export function applySession(query, session) {
  return session ? query.session(session) : query;
}
