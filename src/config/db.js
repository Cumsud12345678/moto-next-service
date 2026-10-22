import mongoose from "mongoose";

mongoose.connection.on('disconnected', () => console.warn('MongoDB bağlantısı kəsildi'))
mongoose.connection.on('reconnected', () => console.log('MongoDB yenidən qoşuldu'))

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
