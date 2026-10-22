import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    // Bağlantı kəsiləndə tədricən yenidən qoşulmağa çalış (maksimum 10 saniyədən bir)
    reconnectStrategy: (retries) => Math.min(retries * 500, 10_000),
  },
});

// ƏVVƏL: hər xəta konsola tam yazılırdı — bağlantı kəsiləndə saniyədə onlarla sətir loq
let lastErrorAt = 0
redis.on("error", (err) => {
  const now = Date.now()
  if (now - lastErrorAt > 30_000) {
    console.error("Redis xətası:", err.message)
    lastErrorAt = now
  }
});

const connect = async () => {
  try {
    await redis.connect();
    console.log("Redis qoşuldu");
  } catch (err) {
    console.error("Redis bağlantı xətası:", err.message);
  }
};

connect();


export {
  redis
}
