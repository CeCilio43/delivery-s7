import { readFileSync } from 'fs';
import path from 'path';
import { parse } from 'yaml';

// openapi.yaml sits at the package root, one level above both src/ (dev,
// tests) and dist/ (production build), so the same relative path works
// for both.
export const openApiSpec = parse(
  readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'),
) as Record<string, unknown>;
