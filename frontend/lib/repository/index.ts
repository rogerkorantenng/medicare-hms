import type { Repository } from './types';
import { HttpRepository } from './http';

/**
 * The construction point — migration step 4.
 *
 * This is the ONLY line that changes when swapping storage. No screen
 * imports anything else. In v1.0 the same interface was satisfied by a
 * browser-storage adapter, then by a database client, and now by HTTP calls
 * to the FastAPI service; the UI never knew the difference.
 */
export const repo: Repository = new HttpRepository();

export * from './types';
