/** Identity-only configuration for the Google authorization-code popup. */
export function googleIdentityCodeConfig(clientId, callback) {
  return {
    client_id: clientId,
    scope: 'openid email profile',
    // Google defaults this to true, which can fold an older Drive or Forms
    // grant into login and trigger the sensitive-scope warning.
    include_granted_scopes: false,
    ux_mode: 'popup',
    callback,
  };
}
