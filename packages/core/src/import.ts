import { projectSchema, type ReconProject } from './types.js';
import { parseScope } from './scope.js';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function validateProjectImport(text: string): ReconProject {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new Error('Import exceeds the 5 MB size limit.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Import is not valid JSON.');
  }
  const result = projectSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      `Import failed schema validation: ${result.error.issues[0]?.message ?? 'invalid project'}`,
    );
  try {
    return {
      ...result.data,
      scope: parseScope(result.data.scope.original, result.data.scope.exclusions),
      ...(result.data.additionalScopes
        ? {
            additionalScopes: result.data.additionalScopes.map((scope) =>
              parseScope(scope.original, scope.exclusions),
            ),
          }
        : {}),
    };
  } catch (error) {
    throw new Error(
      `Import contains an invalid scope: ${error instanceof Error ? error.message : 'invalid scope'}`,
    );
  }
}
