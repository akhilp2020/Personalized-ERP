const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

class StorageGuard {
  constructor(pgUrl, repoRoot) {
    this.pgUrl = pgUrl || process.env.PG_URL || 'postgres://postgres:postgres@pg.dev.svc.cluster.local:5432/postgres';
    this.pool = new Pool({ connectionString: this.pgUrl });
    this.repoRoot = repoRoot || process.env.REPO_ROOT || '/Users/akhil/personalized-erp';
  }

  /**
   * Check which tables in a service need extensions column
   * Returns: { table: string, hasExtensions: boolean, schema: object }[]
   */
  async checkTablesForExtensions(serviceName) {
    const kg = this.loadServiceKG(serviceName);
    if (!kg || !kg.storage || !kg.storage.postgres || !kg.storage.postgres.tables) {
      return [];
    }

    const tables = kg.storage.postgres.tables;
    const results = [];

    for (const table of tables) {
      const tableName = typeof table === 'string' ? table : table.name;
      const hasExtensions = await this.tableHasExtensionsColumn(tableName);
      const schema = await this.getTableSchema(tableName);

      results.push({
        table: tableName,
        hasExtensions,
        schema
      });
    }

    return results;
  }

  /**
   * Check if a table has extensions jsonb column
   */
  async tableHasExtensionsColumn(tableName) {
    try {
      const result = await this.pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = 'extensions'
      `, [tableName]);

      return result.rows.length > 0 && result.rows[0].data_type === 'jsonb';
    } catch (err) {
      console.error(`Error checking table ${tableName}:`, err.message);
      return false;
    }
  }

  /**
   * Get table schema
   */
  async getTableSchema(tableName) {
    try {
      const result = await this.pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      return result.rows;
    } catch (err) {
      console.error(`Error getting schema for ${tableName}:`, err.message);
      return [];
    }
  }

  /**
   * Load service knowledge graph
   */
  loadServiceKG(serviceName) {
    const kgPath = path.join(this.repoRoot, 'docs', 'services', serviceName, 'kg.yaml');
    if (!fs.existsSync(kgPath)) {
      return null;
    }

    const YAML = require('yaml');
    const content = fs.readFileSync(kgPath, 'utf8');
    return YAML.parse(content);
  }

  /**
   * Generate migration to add extensions column to tables
   */
  generateExtensionsMigration(serviceName, tables) {
    const timestamp = Date.now();
    const migrationNumber = String(Math.floor(timestamp / 1000)).padStart(3, '0');
    const filename = `${migrationNumber}_add_extensions_column.sql`;

    let sql = `-- Migration ${migrationNumber}: Add extensions JSONB column to ${serviceName} tables\n`;
    sql += `-- Purpose: Enable safe, tenant-scoped extensions via JSONB storage\n`;
    sql += `-- Safe to run idempotently (uses IF NOT EXISTS checks)\n\n`;
    sql += `BEGIN;\n\n`;

    for (const table of tables) {
      if (!table.hasExtensions) {
        sql += `-- Add extensions column to ${table.table}\n`;
        sql += `DO $$\n`;
        sql += `BEGIN\n`;
        sql += `  IF NOT EXISTS (\n`;
        sql += `    SELECT 1 FROM information_schema.columns\n`;
        sql += `    WHERE table_schema = 'public'\n`;
        sql += `      AND table_name = '${table.table}'\n`;
        sql += `      AND column_name = 'extensions'\n`;
        sql += `  ) THEN\n`;
        sql += `    ALTER TABLE ${table.table}\n`;
        sql += `      ADD COLUMN extensions JSONB NOT NULL DEFAULT '{}'::jsonb;\n`;
        sql += `    RAISE NOTICE 'Added extensions column to ${table.table}';\n`;
        sql += `  END IF;\n`;
        sql += `END $$;\n\n`;

        sql += `-- Create GIN index for extensions column on ${table.table}\n`;
        sql += `CREATE INDEX IF NOT EXISTS idx_${table.table}_extensions\n`;
        sql += `  ON ${table.table} USING GIN (extensions);\n\n`;
      }
    }

    sql += `COMMIT;\n\n`;
    sql += `-- Rollback script (run separately if needed):\n`;
    sql += `-- BEGIN;\n`;

    for (const table of tables) {
      if (!table.hasExtensions) {
        sql += `-- DROP INDEX IF EXISTS idx_${table.table}_extensions;\n`;
        sql += `-- ALTER TABLE ${table.table} DROP COLUMN IF EXISTS extensions;\n`;
      }
    }

    sql += `-- COMMIT;\n`;

    return {
      filename,
      content: sql,
      affectedTables: tables.filter(t => !t.hasExtensions).map(t => t.table)
    };
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = { StorageGuard };
