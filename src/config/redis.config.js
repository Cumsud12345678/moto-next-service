import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on("error", (err) => {
  console.log(err);
});

const connect = async () => {
  try {
    await redis.connect();
    console.log("Redis qoşuldu");
  } catch (err) {
    console.error("Redis bağlantı xətası:", err);
  }
};

connect();


export{
  redis
} 