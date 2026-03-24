const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const LOCAL_STORAGE_ROOT = path.resolve(
  process.env.LOCAL_STORAGE_ROOT || path.join(__dirname, "../..", "storage")
);

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log("Supabase client initialized");
}

module.exports = {
  prisma,
  supabase,
  LOCAL_STORAGE_ROOT,
};
