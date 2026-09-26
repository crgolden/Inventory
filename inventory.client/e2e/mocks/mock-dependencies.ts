import { NodeProcessArgv } from './node-constants.ts';

export const AGAINST_MOCKS = process.env['CI'] !== undefined;

function scriptArguments(): string[] {
  return process.argv.slice(NodeProcessArgv.firstScriptArgumentIndex);
}

export function localOrigin(port: number): string {
  return `http://localhost:${port}`;
}

export function portArgument(): number {
  const [portText] = scriptArguments();
  const port = Number(portText);
  if (!Number.isInteger(port)) {
    throw new Error('A mock server takes its port as its first argument; playwright.config.ts passes it from e2e-settings.json.');
  }
  return port;
}

export function identityCookieArgument(): string {
  const [, cookieName] = scriptArguments();
  if (cookieName === undefined) {
    throw new Error('The mock OIDC server takes its identity cookie name as its second argument.');
  }
  return cookieName;
}
