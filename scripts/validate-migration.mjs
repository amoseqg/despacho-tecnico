import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const versionSource = fs.readFileSync('src/lib/version.ts', 'utf8');
const migrationNotes = fs.readFileSync('MIGRATION.md', 'utf8');
const modulesSource = fs.readFileSync('src/domain/modules.ts', 'utf8');

const versionMatch = versionSource.match(/NEXOFIELD_VERSION = '([^']+)'/);
assert.ok(versionMatch, 'A versão central do NexoField não foi encontrada.');

const version = versionMatch[1];
assert.match(version, /^2\.0\.0-migration\.\d+$/);
assert.equal(packageJson.version, version, 'package.json está com uma versão diferente.');
assert.equal(packageLock.version, version, 'package-lock.json está com uma versão diferente.');
assert.equal(packageLock.packages[''].version, version, 'Pacote raiz do lock está com uma versão diferente.');
assert.ok(migrationNotes.includes(`Versão de trabalho: \`${version}\``), 'MIGRATION.md não registra a versão atual.');
assert.ok(!modulesSource.includes(", status: 'mapeado'"), 'Ainda existem módulos apenas mapeados.');

console.log(`NexoField ${version}: identidade e acompanhamento da migração validados.`);
