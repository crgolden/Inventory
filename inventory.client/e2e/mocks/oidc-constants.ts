export const OidcParameters = {
  clientId: 'client_id',
  code: 'code',
  error: 'error',
  nonce: 'nonce',
  postLogoutRedirectUri: 'post_logout_redirect_uri',
  redirectUri: 'redirect_uri',
  state: 'state',
} as const;

export const OidcErrors = {
  invalidGrant: 'invalid_grant',
  invalidRequest: 'invalid_request',
  loginRequired: 'login_required',
} as const;

export const OidcDiscovery = {
  path: '/.well-known/openid-configuration',
  authorizationCodeResponseType: 'code',
  queryResponseMode: 'query',
  publicSubjectType: 'public',
  pkceS256Method: 'S256',
  clientSecretBasicAuthMethod: 'client_secret_basic',
  clientSecretPostAuthMethod: 'client_secret_post',
} as const;

export const OAuthTokenTypes = {
  bearer: 'Bearer',
} as const;

export const HttpBasicCredentials = {
  userPassSeparator: ':',
} as const;
