import { supabase } from './supabase';

export const db = {
  // Legacy query method for backward compatibility
  // New code should use supabase client directly
  query: async (text: string, params?: any[]) => {
    console.warn('db.query is deprecated. Use supabase client directly.');
    throw new Error('PostgreSQL queries not supported. Use Supabase client methods instead.');
  }
};

export default db;
