import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      asset: {
        Row: {
          id: string;
          owner_id: string;
          filename: string;
          mime: string;
          size: number;
          storage_path: string;
          sha256: string | null;
          status: 'draft' | 'uploading' | 'ready' | 'corrupt';
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          filename: string;
          mime: string;
          size: number;
          storage_path: string;
          sha256?: string | null;
          status?: 'draft' | 'uploading' | 'ready' | 'corrupt';
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          filename?: string;
          mime?: string;
          size?: number;
          storage_path?: string;
          sha256?: string | null;
          status?: 'draft' | 'uploading' | 'ready' | 'corrupt';
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};