import "server-only";
import { Redis } from "@upstash/redis";
import { getEnv } from "./env";

/**
 * Lưu trữ key-value phía server.
 * - Có UPSTASH_REDIS_REST_URL/TOKEN → Upstash Redis (bền vững, chia sẻ giữa các Vercel Function).
 * - Không có → bộ nhớ tạm trong tiến trình (chỉ phù hợp chạy local; trên Vercel dữ liệu mất khi function khởi động lại).
 * Không bao giờ ghi lên filesystem.
 */
export interface KV {
  readonly persistent: boolean;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Tăng bộ đếm; đặt TTL ở lần tăng đầu tiên. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

class MemoryKV implements KV {
  readonly persistent = false;
  private store = new Map<string, { value: unknown; expiresAt: number | null }>();

  private alive(key: string) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }
  async get<T>(key: string) {
    const e = this.alive(key);
    return e ? (structuredClone(e.value) as T) : null;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    this.store.set(key, { value: structuredClone(value), expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }
  async del(key: string) {
    this.store.delete(key);
  }
  async incr(key: string, ttlSeconds: number) {
    const e = this.alive(key);
    const next = (typeof e?.value === "number" ? e.value : 0) + 1;
    this.store.set(key, { value: next, expiresAt: e?.expiresAt ?? Date.now() + ttlSeconds * 1000 });
    return next;
  }
}

class UpstashKV implements KV {
  readonly persistent = true;
  constructor(private redis: Redis) {}
  async get<T>(key: string) {
    return (await this.redis.get<T>(key)) ?? null;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  async incr(key: string, ttlSeconds: number) {
    const [count] = await this.redis.pipeline().incr(key).expire(key, ttlSeconds, "NX").exec<[number, number]>();
    return count;
  }
}

const globalForKV = globalThis as unknown as { __studylabKV?: KV };

export function getKV(): KV {
  if (globalForKV.__studylabKV) return globalForKV.__studylabKV;
  const env = getEnv();
  const kv: KV =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new UpstashKV(new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }))
      : new MemoryKV();
  globalForKV.__studylabKV = kv;
  return kv;
}

export function createMemoryKV(): KV {
  return new MemoryKV();
}

export const KEY_PREFIX = "studylab:v1:";
