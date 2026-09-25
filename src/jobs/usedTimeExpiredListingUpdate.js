import cron from "node-cron";
import { Listing } from "../models/listing/listing.model";

async function usedTimeExpiredListingUpdate() {
  
  const expiredListings = await Listing.find({
    isUrgent: true,
    urgentExpiresAt: { $lte: new Date() }
  }).select('_id')

  if(expiredListings.length === 0) return;

  const ids = expiredListings.map(l => l._id)

  const updatedListings = await Listing.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        isUrgent: false,
        urgentActiveAt: null,
        urgentExpiresAt: null
      }
    }
  )

}

cron.schedule('*/5 * * * *', usedTimeExpiredListingUpdate);

module.exports = usedTimeExpiredListingUpdate;