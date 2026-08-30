const fs = require('node:fs');
const spawn = require('node:child_process').spawn;
const path = require('node:path');

const baseFolder =
  process.env.APPDATA !== undefined && process.env.APPDATA !== ''
    ? `${process.env.APPDATA}/ASP.NET/https`
    : `${process.env.HOME}/.aspnet/https`;

const certificateArg = process.argv.map(arg => /--name=(?<value>.+)/i.exec(arg)).find(Boolean);
const certificateName = certificateArg ? certificateArg.groups.value : process.env.npm_package_name;

if (!certificateName) {
  console.error('Invalid certificate name. Run this script in the context of an npm/yarn script or pass --name=<<app>> explicitly.')
  process.exit(-1);
}

const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

if (!fs.existsSync(baseFolder)) {
    fs.mkdirSync(baseFolder, { recursive: true });
}

function resolveAbsoluteDotnetPathWithoutSearchingPath() {
  const exe = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
  const knownInstallRootsByPlatform = [
    process.env.DOTNET_ROOT,
    process.platform === 'win32' ? path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'dotnet') : null,
    process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'dotnet') : null,
    '/usr/local/share/dotnet',
    '/opt/homebrew/share/dotnet',
    '/usr/share/dotnet',
    '/usr/lib/dotnet',
    '/usr/bin',
  ];

  for (const root of knownInstallRootsByPlatform) {
    if (!root) {
      continue;
    }
    const candidate = path.join(root, exe);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

if (!fs.existsSync(certFilePath) || !fs.existsSync(keyFilePath)) {
  const dotnetPath = resolveAbsoluteDotnetPathWithoutSearchingPath();
  if (!dotnetPath) {
    console.error('Could not locate the .NET SDK. Install it, or set DOTNET_ROOT to its directory.');
    process.exit(-1);
  }

  spawn(dotnetPath, [
    'dev-certs',
    'https',
    '--export-path',
    certFilePath,
    '--format',
    'Pem',
    '--no-password',
  ], { stdio: 'inherit', })
  .on('exit', (code) => process.exit(code));
}