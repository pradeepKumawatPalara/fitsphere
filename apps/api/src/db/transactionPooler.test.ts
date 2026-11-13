import { describe, expect, it } from 'vitest';
import { transactionPoolerUrl } from './transactionPooler.ts';

// The transaction pooler's address for `npm run check:pooler` (D-101). Synthetic addresses only.

const HOST = 'aws-0-ap-southeast-1.pooler.supabase.com';

describe('transactionPoolerUrl', () => {
  it("changes only the session pooler's port, 5432, to 6543", () => {
    expect(transactionPoolerUrl(`postgresql://postgres.testref:test-password@${HOST}:5432/postgres`)).toBe(
      `postgresql://postgres.testref:test-password@${HOST}:6543/postgres`,
    );
  });

  it('keeps a transaction pooler address as it is', () => {
    const url = `postgres://postgres.testref:test-password@${HOST}:6543/postgres`;
    expect(transactionPoolerUrl(url)).toBe(url);
  });

  it('keeps a password with escaped marks and the query as they are', () => {
    expect(transactionPoolerUrl(`postgresql://postgres.testref:p%40ss%3Aw%2Frd@${HOST}:5432/postgres?sslmode=require`)).toBe(
      `postgresql://postgres.testref:p%40ss%3Aw%2Frd@${HOST}:6543/postgres?sslmode=require`,
    );
  });

  it("refuses anything that is not Supabase's shared pooler on 5432 or 6543", () => {
    for (const url of [
      'postgres://postgres:postgres@localhost:5432/fitsphere_test',
      'postgresql://postgres:test-password@db.testref.supabase.co:5432/postgres',
      `postgresql://postgres.testref:test-password@${HOST}/postgres`,
      `postgresql://postgres.testref:test-password@${HOST}:6544/postgres`,
      `https://${HOST}:5432/postgres`,
      `postgresql://postgres.testref:test-password@${HOST}.example.com:5432/postgres`,
      'not a connection string',
      '',
    ]) {
      expect(transactionPoolerUrl(url), url).toBeNull();
    }
  });
});
