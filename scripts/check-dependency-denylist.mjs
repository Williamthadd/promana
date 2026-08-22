import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const blockedVersions = new Map(
  Object.entries({
    keyv: ['6.0.0'],
    '@cacheable/net': ['2.1.1'],
    '@cacheable/node-cache': ['3.1.2'],
    '@cacheable/memory': ['2.2.1'],
    '@cacheable/utils': ['2.5.1'],
    cacheable: ['2.5.1'],
    'cacheable-request': ['13.0.20'],
    'flat-cache': ['6.1.24'],
    'file-entry-cache': ['11.1.6'],
    'cache-manager': ['7.2.10'],
    '@thiennq/docs-viewer': ['1.6.2'],
    '@asyncapi/generator-helpers': ['1.1.1'],
    '@asyncapi/generator-components': ['0.7.1'],
    '@asyncapi/generator': ['3.3.1'],
    '@asyncapi/specs': ['6.11.2', '6.11.2-alpha.1'],
    'easy-day-js': ['1.11.22'],
    '@mastra/core': ['1.42.1'],
    '@mastra/schema-compat': ['1.2.12'],
    '@tanstack/react-router': ['1.169.5', '1.169.8'],
    '@tanstack/router-core': ['1.169.5', '1.169.8'],
    '@tanstack/history': ['1.161.9', '1.161.12'],
    '@tanstack/react-start': ['1.167.68', '1.167.71'],
    '@tanstack/router-plugin': ['1.167.38', '1.167.41'],
    '@tanstack/router-vite-plugin': ['1.166.53', '1.166.56'],
    '@mistralai/mistralai': ['2.2.2', '2.2.3', '2.2.4'],
    '@mistralai/mistralai-azure': ['1.7.1', '1.7.2', '1.7.3'],
    '@mistralai/mistralai-gcp': ['1.7.1', '1.7.2', '1.7.3'],
    axios: ['1.14.1', '0.30.4'],
    'plain-crypto-js': ['4.2.1'],
    '@shadanai/openclaw': ['2026.3.31-1', '2026.3.31-2'],
    '@qqbrowser/openclaw-qbot': ['0.0.130'],
    'carbon-monorepo': ['20.1.1'],
    'augustdigital-sdk': ['8.20.1'],
    'upshift-config': ['0.5.14'],
    'bigops-create-manifest': ['35.2.4'],
  }).map(([name, versions]) => [name, new Set(versions)]),
)

const blockedAtEveryVersion = new Set([
  'upshift-finance',
  'bigops-api',
  'bigops-backend',
  'dolyame-boxy-desktop-bnpl-card-gallery',
])

const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(
      `Cannot inspect ${path.relative(projectRoot, filePath)}: ${error.message}`,
    )
  }
}

function getInstalledPackageName(packagePath) {
  const marker = 'node_modules/'
  const markerIndex = packagePath.lastIndexOf(marker)

  return markerIndex === -1
    ? ''
    : packagePath.slice(markerIndex + marker.length)
}

function getBlockReason(name, version) {
  if (blockedAtEveryVersion.has(name)) {
    return `${name} is blocked at every version`
  }

  if (name.startsWith('@keyv/') && version === '6.0.0') {
    return '@keyv/*@6.0.0 is blocked'
  }

  if (blockedVersions.get(name)?.has(version)) {
    return `${name}@${version} is blocked`
  }

  return ''
}

function scanLockfile(relativePath) {
  const filePath = path.join(projectRoot, relativePath)

  if (!fs.existsSync(filePath)) return []

  const lockfile = readJson(filePath)
  const findings = []

  for (const [packagePath, metadata] of Object.entries(
    lockfile.packages ?? {},
  )) {
    const name = getInstalledPackageName(packagePath)
    const version = String(metadata?.version ?? '')
    const reason = getBlockReason(name, version)

    if (reason) {
      findings.push({
        location: `${relativePath}:${packagePath}`,
        name,
        reason,
        version,
      })
    }
  }

  return findings
}

function normalizeExactVersion(specifier) {
  return String(specifier)
    .trim()
    .replace(/^npm:[^@]+@/, '')
    .replace(/^[=v]/, '')
}

function scanDirectDependencies() {
  const manifest = readJson(path.join(projectRoot, 'package.json'))
  const findings = []

  for (const section of dependencySections) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      const version = normalizeExactVersion(specifier)
      const reason = getBlockReason(name, version)

      if (reason) {
        findings.push({
          location: `package.json:${section}`,
          name,
          reason,
          version: String(specifier),
        })
      }
    }
  }

  return findings
}

const scannedLockfiles = [
  'package-lock.json',
  'node_modules/.package-lock.json',
].filter((relativePath) => fs.existsSync(path.join(projectRoot, relativePath)))

if (!scannedLockfiles.includes('package-lock.json')) {
  console.error('Dependency denylist check failed: package-lock.json is missing.')
  process.exit(1)
}

const findings = [
  ...scanDirectDependencies(),
  ...scannedLockfiles.flatMap(scanLockfile),
]

if (findings.length > 0) {
  console.error('Dependency denylist check failed:')
  for (const finding of findings) {
    console.error(
      `- ${finding.name}@${finding.version} at ${finding.location}: ${finding.reason}`,
    )
  }
  process.exit(1)
}

console.log(
  `Dependency denylist check passed (${scannedLockfiles.join(', ')}).`,
)
