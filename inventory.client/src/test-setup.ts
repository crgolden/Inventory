import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const srcDir = resolve(process.cwd(), 'src');

function buildResourceMap(dir: string, map = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      buildResourceMap(fullPath, map);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.css')) {
      if (!map.has(entry.name)) {
        map.set(entry.name, readFileSync(fullPath, { encoding: 'utf-8' }));
      }
    }
  }
  return map;
}

const resourceMap = buildResourceMap(srcDir);

const resourceResolver = (url: string): Promise<{ text(): Promise<string> }> => {
  const filename = url.split('/').pop()?.split('\\').pop() ?? url;
  // Falling back to an empty resource is deliberate and was re-tested on 2026-09-06: this resolver runs
  // inside Angular's resolveComponentResources during beforeEach, where a throw kills the whole vitest
  // worker ("Worker exited unexpectedly") before any test name or message is printed, rather than
  // failing one test with a readable reason. Empty is the less bad of the two.
  const content = resourceMap.get(filename) ?? '';
  return Promise.resolve({ text: () => Promise.resolve(content) });
};

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

beforeEach(async () => {
  await resolveComponentResources(resourceResolver);
});
