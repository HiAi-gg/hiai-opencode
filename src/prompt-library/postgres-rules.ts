export const POSTGRES_RULES = `
## PostgreSQL
Use ONLY direct psql commands. NEVER create .sql migration files for content edits.
# Username 'bob' matches the MIMOCODE_SERVER_USERNAME default. Change via PGUSER env if needed.
- ai-core: psql -h localhost -p 5432 -U bob -d aidb
- webs: psql -h localhost -p 5432 -U bob -d aidb
`;
