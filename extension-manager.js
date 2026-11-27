const fs = require('node:fs/promises');
const path = require('node:path');

const MANIFEST_MAX_BYTES = 1024 * 1024;
const PERMISSION_LIMIT = 100;

async function inspectUnpackedExtension(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || directory.length > 4096) {
    throw new TypeError('Choose an unpacked extension folder on this computer.');
  }
  const resolvedDirectory = await fs.realpath(directory);
  const directoryStat = await fs.stat(resolvedDirectory);
  if (!directoryStat.isDirectory()) throw new TypeError('The selected extension path is not a folder.');
  const manifestPath = path.join(resolvedDirectory, 'manifest.json');
  const manifestStat = await fs.stat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.size > MANIFEST_MAX_BYTES) {
    throw new TypeError('The extension manifest must be a file smaller than 1 MB.');
  }
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new TypeError('The selected extension has an invalid manifest.json.', { cause: error });
  }
  if (
    !manifest
    || typeof manifest !== 'object'
    || Array.isArray(manifest)
    || ![2, 3].includes(manifest.manifest_version)
    || typeof manifest.name !== 'string'
    || !manifest.name.trim()
    || manifest.name.length > 120
    || typeof manifest.version !== 'string'
    || manifest.version.length > 80
  ) {
    throw new TypeError('The extension manifest needs a name, version, and Manifest V2 or V3.');
  }
  const permissions = manifest.permissions ?? [];
  const hostPermissions = manifest.host_permissions ?? [];
  if (
    !Array.isArray(permissions)
    || !Array.isArray(hostPermissions)
    || permissions.length > PERMISSION_LIMIT
    || hostPermissions.length > PERMISSION_LIMIT
    || [...permissions, ...hostPermissions].some((permission) => typeof permission !== 'string' || permission.length > 300)
  ) {
    throw new TypeError('The extension manifest has an invalid permissions list.');
  }
  return {
    path: resolvedDirectory,
    name: manifest.name.trim(),
    version: manifest.version,
    manifestVersion: manifest.manifest_version,
    permissions: [...new Set(permissions)],
    hostPermissions: [...new Set(hostPermissions)],
  };
}

module.exports = { inspectUnpackedExtension };
