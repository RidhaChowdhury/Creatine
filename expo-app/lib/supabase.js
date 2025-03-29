import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xmkdzdqouxqmayoawztr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhta2R6ZHFvdXhxbWF5b2F3enRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNzE2MDksImV4cCI6MjA1ODg0NzYwOX0.wtoAgSlQGSsnjdRwa7d6JJhrcjreFCSV9Jp2vbjDUM4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
