import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import e2eSettings from './e2e-settings.json';
import { NodeBufferEncodings } from './mocks/node-constants';

interface LaunchSettings {
  readonly profiles: Readonly<Record<string, { readonly applicationUrl?: string }>>;
}

const LAUNCH_SETTINGS_PATH = resolve(e2eSettings.launchSettingsPath);

export function bffPort(): number {
  const settings = JSON.parse(readFileSync(LAUNCH_SETTINGS_PATH, NodeBufferEncodings.utf8)) as LaunchSettings;
  const applicationUrl = Object.values(settings.profiles)[0]?.applicationUrl?.split(';')[0];
  if (applicationUrl === undefined) {
    throw new Error(`${LAUNCH_SETTINGS_PATH} names no applicationUrl on its first profile, the one dotnet run starts.`);
  }
  return Number(new URL(applicationUrl).port);
}
