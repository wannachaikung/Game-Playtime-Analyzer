
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zblvxpznzmenrxiqgcas.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpibHZ4cHpuem1lbnJ4aXFnY2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTMyOTEsImV4cCI6MjA3NDM4OTI5MX0.sDNMTbDFIthNNortgvj1ZnG4fSPPcc1CR4EiFDVQmOg';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
