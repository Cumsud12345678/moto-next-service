import cron from "node-cron";
import { Listing } from "../models/listing/listing.model";

const DEFAULT_DAYS_MS = 100 * 24 * 60 * 60 * 1000

async function timeExpiredProductUpdate() {

  const cutoff = new Date(Date.now() - DEFAULT_DAYS_MS)

  const expiredListings = await Listing.find({
    status: "active",
    createdAt: { $lte : cutoff }
  }).select('_id')

  if(expiredListings.length === 0) return;

  const ids = expiredListings.map(l => l._id)

  const updatedListings = await Listing.updateMany(
    { _id: {$in: ids} },
    { $set: { status: 'expired' } }
  )

}

cron.schedule('0 0 * * *', timeExpiredProductUpdate);

module.exports = timeExpiredProductUpdate;