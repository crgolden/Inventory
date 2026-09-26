import { constants } from 'node:http2';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { newEmailAddress, newPathSegment, randomIntBetween } from '@crgolden/modules/testing';
import { identityCookieArgument, localOrigin, portArgument } from './mock-dependencies.ts';
import { JoseConstants } from './jose-constants.ts';
import { NodeBufferEncodings, NodeCryptoConstants } from './node-constants.ts';
import {
  HttpBasicCredentials,
  OAuthTokenTypes,
  OidcDiscovery,
  OidcErrors,
  OidcParameters,
} from './oidc-constants.ts';
import { CONTENT_TYPE_HEADER, HttpMethods } from '../../src/app/http-headers.ts';
import { JSON_CONTENT_TYPE } from '../../src/products/manual-chat/chat-api.ts';

const PORT = portArgument();
const ISSUER = localOrigin(PORT);
const IDENTITY_COOKIE = identityCookieArgument();
const TOKEN_LIFETIME_SECONDS = randomIntBetween(3600, 86400);
const KEY_ID = randomUUID();

const EndpointPaths = {
  jwks: `/${newPathSegment()}`,
  authorize: `/${newPathSegment()}`,
  token: `/${newPathSegment()}`,
  userInfo: `/${newPathSegment()}`,
  endSession: `/${newPathSegment()}`,
} as const;

interface AuthorizationCode {
  readonly redirectUri: string;
  readonly nonce: string | null;
  readonly sub: string;
  readonly email: string;
}

const { publicKey, privateKey } = generateKeyPairSync(NodeCryptoConstants.rsaKeyType, {
  modulusLength: JoseConstants.rs256MinimumModulusBits,
});
const publicJwk = {
  ...publicKey.export({ format: NodeCryptoConstants.jwkExportFormat }),
  kid: KEY_ID,
  alg: JoseConstants.rs256Algorithm,
  use: JoseConstants.signatureKeyUse,
};
const codes = new Map<string, AuthorizationCode>();
const accessTokens = new Map<string, AuthorizationCode>();

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString(NodeBufferEncodings.base64Url);
}

function signJwt(claims: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: JoseConstants.rs256Algorithm, typ: JoseConstants.jwtType, kid: KEY_ID }));
  const payload = base64Url(JSON.stringify(claims));
  const signature = sign(NodeCryptoConstants.sha256Digest, Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${base64Url(signature)}`;
}

function readCookie(request: IncomingMessage, name: string): string | null {
  const header = request.headers.cookie;
  if (header === undefined) {
    return null;
  }
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator !== -1 && pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }
  return null;
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString(NodeBufferEncodings.utf8));
}

function decodeBasicClientId(encoded: string): string | undefined {
  return Buffer.from(encoded, NodeBufferEncodings.base64)
    .toString(NodeBufferEncodings.utf8)
    .split(HttpBasicCredentials.userPassSeparator)[0];
}

function clientIdOf(request: IncomingMessage, form: URLSearchParams): string | null {
  const basic = request.headers.authorization?.match(/^Basic\s+(.+)$/i);
  const encodedClientId = basic?.[1] === undefined ? undefined : decodeBasicClientId(basic[1]);
  return encodedClientId === undefined ? form.get(OidcParameters.clientId) : decodeURIComponent(encodedClientId);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE });
  response.end(JSON.stringify(body));
}

function redirect(response: ServerResponse, location: URL): void {
  response.writeHead(constants.HTTP_STATUS_FOUND, { Location: location.href });
  response.end();
}

function authorize(request: IncomingMessage, response: ServerResponse, query: URLSearchParams): void {
  const redirectUri = query.get(OidcParameters.redirectUri);
  const state = query.get(OidcParameters.state);
  if (redirectUri === null || state === null) {
    sendJson(response, constants.HTTP_STATUS_BAD_REQUEST, { error: OidcErrors.invalidRequest });
    return;
  }
  const target = new URL(redirectUri);
  target.searchParams.set(OidcParameters.state, state);
  const sub = readCookie(request, IDENTITY_COOKIE);
  if (sub === null) {
    target.searchParams.set(OidcParameters.error, OidcErrors.loginRequired);
    redirect(response, target);
    return;
  }
  const code = randomUUID();
  const subjectEmail = newEmailAddress();
  codes.set(code, { redirectUri, nonce: query.get(OidcParameters.nonce), sub, email: subjectEmail });
  target.searchParams.set(OidcParameters.code, code);
  redirect(response, target);
}

async function token(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const form = await readForm(request);
  const code = form.get(OidcParameters.code);
  const grant = code === null ? undefined : codes.get(code);
  const clientId = clientIdOf(request, form);
  if (code === null || grant === undefined || clientId === null) {
    sendJson(response, constants.HTTP_STATUS_BAD_REQUEST, { error: OidcErrors.invalidGrant });
    return;
  }
  codes.delete(code);
  const issuedAt = Math.floor(Date.now() / JoseConstants.millisecondsPerNumericDateSecond);
  const accessToken = randomUUID();
  accessTokens.set(accessToken, grant);
  const idToken = signJwt({
    iss: ISSUER,
    sub: grant.sub,
    aud: clientId,
    iat: issuedAt,
    exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    email: grant.email,
    ...(grant.nonce === null ? {} : { nonce: grant.nonce }),
  });
  sendJson(response, constants.HTTP_STATUS_OK, {
    access_token: accessToken,
    id_token: idToken,
    refresh_token: randomUUID(),
    token_type: OAuthTokenTypes.bearer,
    expires_in: TOKEN_LIFETIME_SECONDS,
  });
}

function userInfo(request: IncomingMessage, response: ServerResponse): void {
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const grant = bearer === undefined ? undefined : accessTokens.get(bearer);
  if (grant === undefined) {
    response.writeHead(constants.HTTP_STATUS_UNAUTHORIZED);
    response.end();
    return;
  }
  sendJson(response, constants.HTTP_STATUS_OK, { sub: grant.sub, email: grant.email });
}

function endSession(response: ServerResponse, query: URLSearchParams): void {
  const postLogout = query.get(OidcParameters.postLogoutRedirectUri);
  if (postLogout === null) {
    response.writeHead(constants.HTTP_STATUS_NO_CONTENT);
    response.end();
    return;
  }
  const target = new URL(postLogout);
  const state = query.get(OidcParameters.state);
  if (state !== null) {
    target.searchParams.set(OidcParameters.state, state);
  }
  redirect(response, target);
}

function discover(response: ServerResponse): void {
  sendJson(response, constants.HTTP_STATUS_OK, {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}${EndpointPaths.authorize}`,
    token_endpoint: `${ISSUER}${EndpointPaths.token}`,
    userinfo_endpoint: `${ISSUER}${EndpointPaths.userInfo}`,
    jwks_uri: `${ISSUER}${EndpointPaths.jwks}`,
    end_session_endpoint: `${ISSUER}${EndpointPaths.endSession}`,
    response_types_supported: [OidcDiscovery.authorizationCodeResponseType],
    response_modes_supported: [OidcDiscovery.queryResponseMode],
    subject_types_supported: [OidcDiscovery.publicSubjectType],
    id_token_signing_alg_values_supported: [JoseConstants.rs256Algorithm],
    code_challenge_methods_supported: [OidcDiscovery.pkceS256Method],
    token_endpoint_auth_methods_supported: [
      OidcDiscovery.clientSecretBasicAuthMethod,
      OidcDiscovery.clientSecretPostAuthMethod,
    ],
  });
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', ISSUER);
  const isGet = request.method === HttpMethods.get;
  if (isGet && url.pathname === OidcDiscovery.path) {
    discover(response);
  } else if (isGet && url.pathname === EndpointPaths.jwks) {
    sendJson(response, constants.HTTP_STATUS_OK, { keys: [publicJwk] });
  } else if (isGet && url.pathname === EndpointPaths.authorize) {
    authorize(request, response, url.searchParams);
  } else if (request.method === HttpMethods.post && url.pathname === EndpointPaths.token) {
    void token(request, response);
  } else if (isGet && url.pathname === EndpointPaths.userInfo) {
    userInfo(request, response);
  } else if (isGet && url.pathname === EndpointPaths.endSession) {
    endSession(response, url.searchParams);
  } else {
    response.writeHead(constants.HTTP_STATUS_NOT_FOUND);
    response.end();
  }
}).listen(PORT);
