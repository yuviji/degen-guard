import { Request } from 'express';
import { supabase } from './supabase';

export async function getUserId(req: Request): Promise<string | null> {
  try {
    // Try to get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Use Supabase Auth to verify token
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return null;
    }

    return data.user.id;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function requireAuth(req: Request): Promise<string> {
  const userId = await getUserId(req);
  if (!userId) {
    throw new Error('Authentication required - please provide valid Supabase session token');
  }
  return userId;
}

// Legacy function - no longer needed with Supabase Auth
export function generateToken(userId: string, email: string): string {
  throw new Error('generateToken is deprecated - use Supabase Auth sessions instead');
}
