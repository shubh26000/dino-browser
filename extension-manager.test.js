const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectUnpackedExtension } = require('./extension-manager');

test('inspects a valid unpacked Manifest V3 extension without loading its code', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-extension-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({
    manifest_version: 3,
    name: 'Local helper',
    version: '1.2.0',
    permissions: ['storage', 'tabs', 'storage'],
    host_permissions: ['https://example.com/*'],
  }));

  const extension = await inspectUnpackedExtension(directory);
  assert.equal(extension.path, await fs.realpath(directory));
  assert.equal(extension.name, 'Local helper');
  assert.equal(extension.manifestVersion, 3);
  assert.deepEqual(extension.permissions, ['storage', 'tabs']);
  assert.deepEqual(extension.hostPermissions, ['https://example.com/*']);
});

test('rejects an invalid unpacked extension manifest', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-invalid-extension-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ name: 'No version' }));
  await assert.rejects(inspectUnpackedExtension(directory), /name, version, and Manifest V2 or V3/);
  await assert.rejects(inspectUnpackedExtension('relative/path'), /unpacked extension folder/);
});
