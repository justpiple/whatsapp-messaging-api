import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

// Better-queue store interface
interface QueueItem {
  id: string;
  data: unknown;
  priority: number;
  status: "pending" | "active" | "complete" | "failed";
  created: number;
  started?: number;
  finished?: number;
  retries: number;
  error?: string;
}

// Custom SQLite store for better-queue
export class SqliteStore {
  private tableName = "queue_jobs";
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          priority INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          created INTEGER NOT NULL,
          started INTEGER,
          finished INTEGER,
          retries INTEGER DEFAULT 0,
          error TEXT
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_queue_status_priority 
        ON ${this.tableName}(status, priority DESC, created ASC)
      `);

      this.initialized = true;
      logger.info("SQLite queue store initialized");
    } catch (error) {
      logger.error("Error initializing queue table:", error);
      throw error;
    }
  }

  async get(taskId: string): Promise<QueueItem | null> {
    await this.init();
    const result = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        data: string;
        priority: number;
        status: string;
        created: number;
        started: number | null;
        finished: number | null;
        retries: number;
        error: string | null;
      }>
    >(`SELECT * FROM ${this.tableName} WHERE id = ?`, taskId);

    if (result.length === 0) return null;

    const item = result[0];
    return {
      id: item.id,
      data: JSON.parse(item.data),
      priority: item.priority,
      status: item.status as QueueItem["status"],
      created: item.created,
      started: item.started || undefined,
      finished: item.finished || undefined,
      retries: item.retries,
      error: item.error || undefined,
    };
  }

  async put(taskId: string, item: QueueItem): Promise<void> {
    await this.init();

    // Use ID from job data if available, otherwise use taskId
    const jobData = item.data as { id?: string };
    const finalId = jobData?.id ?? taskId;

    await prisma.$executeRawUnsafe(
      `INSERT OR REPLACE INTO ${this.tableName} 
       (id, data, priority, status, created, started, finished, retries, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      finalId,
      JSON.stringify(item.data),
      item.priority,
      item.status,
      item.created,
      item.started ?? null,
      item.finished ?? null,
      item.retries,
      item.error ?? null
    );
  }

  async del(taskId: string): Promise<void> {
    await this.init();
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      taskId
    );
  }

  async getNext(): Promise<QueueItem | null> {
    await this.init();
    const result = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        data: string;
        priority: number;
        status: string;
        created: number;
        started: number | null;
        finished: number | null;
        retries: number;
        error: string | null;
      }>
    >(
      `SELECT * FROM ${this.tableName} 
       WHERE status = 'pending' 
       ORDER BY priority DESC, created ASC 
       LIMIT 1`
    );

    if (result.length === 0) return null;

    const item = result[0];
    return {
      id: item.id,
      data: JSON.parse(item.data),
      priority: item.priority,
      status: item.status as QueueItem["status"],
      created: item.created,
      started: item.started || undefined,
      finished: item.finished || undefined,
      retries: item.retries,
      error: item.error || undefined,
    };
  }

  async getAll(): Promise<QueueItem[]> {
    await this.init();
    const result = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        data: string;
        priority: number;
        status: string;
        created: number;
        started: number | null;
        finished: number | null;
        retries: number;
        error: string | null;
      }>
    >(`SELECT * FROM ${this.tableName} ORDER BY created ASC`);

    return result.map((item) => ({
      id: item.id,
      data: JSON.parse(item.data),
      priority: item.priority,
      status: item.status as QueueItem["status"],
      created: item.created,
      started: item.started || undefined,
      finished: item.finished || undefined,
      retries: item.retries,
      error: item.error || undefined,
    }));
  }
}
