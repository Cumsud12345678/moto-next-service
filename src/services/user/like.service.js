import { Like } from "../../models/like.model";
import { Listing } from "../../models/listing/listing.model";

const getMyLikedListings = async (userId, guestLikedIds) => {
  let liked

  if(userId) {
    const likes = await Like.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'listing',
        select: '-randomKey -boostRemainingCount -lastBoostedAt -urgentExpiresAt',
        populate: [
          {
            path: 'make'
          },
          {
            path: 'model'
          },
          {
            path: 'region'
          }
        ]
      })
      .lean()

    liked = likes.map(like => like.listing).filter(Boolean);
  }else {
    const listings = await Listing.find({_id: { $in: guestLikedIds }})
      .withCardRelations()
      .lean()

    // guestLikedIds-in sırasını qoruyuruq (frontend-in göndərdiyi bəyənmə sırası)
    const listingMap = new Map(listings.map(l => [l._id.toString(), l]));
    liked = guestLikedIds.map(id => listingMap.get(id)).filter(Boolean);
  }

  return liked
}

const createLike = async (userId, listingId) => {
  return await Like.create({
    listing: listingId,
    user: userId
  })
}

const deleteLike = async (userId, listingId) => {
  return await Like.findOneAndDelete({
    listing: listingId,
    user: userId
  })
}


export {
  getMyLikedListings,
  createLike,
  deleteLike
}