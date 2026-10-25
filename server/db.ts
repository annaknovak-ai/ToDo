import pg from 'pg';

// Return DATE columns as the raw 'YYYY-MM-DD' string instead of a JS Date,
// so the value never shifts with the server's time zone.
const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (value: string) => value);

// sslmode in the URL overrides the ssl option below and enables full
// certificate verification, which fails against the Supabase pooler (ADR-3).
export function stripSslMode(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return url.toString();
}

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString: stripSslMode(connectionString),
    // Encrypted, without CA verification (ADR-3).
    ssl: { rejectUnauthorized: false },
    // One connection per function instance behind the Transaction Pooler.
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 10000,
  });
}

let pool: pg.Pool | undefined;

// Module-level pool, reused across invocations of the same instance.
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    pool = createPool(connectionString);
  }
  return pool;
}
