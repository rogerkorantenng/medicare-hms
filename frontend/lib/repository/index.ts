import type { Repository } from './types';
import { SupabaseRepository } from './supabase';

/**
 * The construction point — migration step 4.
 *
 * This is the ONLY line that changes when swapping storage. No screen
 * imports anything else. In v1.0 the same interface was satisfied by a
 * browser-storage adapter; the UI never knew the difference.
 */
export const repo: Repository = new SupabaseRepository();

export * from './types';
