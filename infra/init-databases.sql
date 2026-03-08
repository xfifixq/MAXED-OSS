-- Initialize databases for all services sharing PostgreSQL
-- Note: maxed_unified is already created via POSTGRES_DB env var
CREATE DATABASE paperless;
CREATE DATABASE n8n;
CREATE DATABASE metabase;
CREATE DATABASE twenty;
CREATE DATABASE mattermost;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE paperless TO maxed;
GRANT ALL PRIVILEGES ON DATABASE n8n TO maxed;
GRANT ALL PRIVILEGES ON DATABASE metabase TO maxed;
GRANT ALL PRIVILEGES ON DATABASE twenty TO maxed;
GRANT ALL PRIVILEGES ON DATABASE mattermost TO maxed;
GRANT ALL PRIVILEGES ON DATABASE maxed_unified TO maxed;
