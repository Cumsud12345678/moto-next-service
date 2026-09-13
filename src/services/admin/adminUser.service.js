import { User } from "../../models/user.model"

const getFilteredUsers = async (filters, page, limit) => {
  const query = generateQuery(filters)

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query)
  ])

  return {users, total}
}


const deleteUser = async (userId) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try{
    const user = await User.findById(userId).session(session)
    if (!user) throw new Error('User tapilmadi');

    const listings = await Listing.find({ seller: userId })

    if(listings.length > 0) {
      const deletedListingDocs = listings.map(listing => ({
        originalUserId: listing._id,
        snapshot: listing.toObject(),
        deletedByRole: 'system',
        deleteReason: 'User silindiyi ucun silindi',
        viewCount: listing.viewCount,
        likedCount: listing.likedCount
      }))
      // Like leri sil
      await Like.deleteMany({ user: userId }).session(session);
      // DeletedListing leri olustur
      await DeletedListing.insertMany(deletedListingDocs, { session })
      // Esil listingleri sil
      await Listing.deleteMany({ seller: userId }).session(session);
    }
    
    // DeletedUser i olustur
    await DeletedUser.create([{
      originalUserId: userId,
      snapshot: user.toObject(),
      deletedBy: userId,
      deletedByRole: 'user',
      deletedReason: ''
    }], { session })

    await User.findByIdAndDelete(userId).session(session)
    await session.commitTransaction()

  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    await session.endSession();
  }
}

const generateQuery = (filters) => {
  const query = {}
  if(filters.name) query.name = filters.name;
  if(filters.ip) query.ip = filters.ip;
  if(filters.role) query.role = filters.role;
  if(filters.isWarning !== undefined) query.isWarning = filters.isWarning;
  if(filters.isLocked !== undefined) query.isLocked = filters.isLocked;
  return query
}


const updateUsers = async (filters, data) => {
  const query = generateQuery(filters)
  return await User.updateMany(query, data, { runValidators: true })
}

