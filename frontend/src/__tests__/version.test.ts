import { readFileSync } from 'fs';
import { join } from 'path';

const frontendRoot = join(__dirname, '..', '..');

describe('app version constants', () => {
  test('package.json and next.config.js agree on the version', () => {
    const pkg = JSON.parse(readFileSync(join(frontendRoot, 'package.json'), 'utf8'));
    const nextConfig = readFileSync(join(frontendRoot, 'next.config.js'), 'utf8');
    const match = nextConfig.match(/NEXT_PUBLIC_APP_VERSION:\s*['"]([^'"]+)['"]/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(pkg.version);
  });
});
