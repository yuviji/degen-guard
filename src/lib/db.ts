import pool from '../database/connection';

export const db = {
  query: async (text: string, params?: any[]) => {
    return await pool.query(text, params);
  }
};

export default db;
