import mongoose from "mongoose"
import { DeletedListing } from "../../models/deleted/deletedListing.model.js"
import { DeletedUser } from "../../models/deleted/deletedUser.model.js"
import { Listing } from "../../models/listing/listing.model.js"
import { Message } from "../../models/message.model.js"
import { User } from "../../models/user.model.js"
import { Like } from "../../models/like.model.js"

const getAllUsers = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    User.find()
      .populate('listingCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(),
  ])
  
  return {
    users,
    total
  }

}

const getFilteredUsers = async (filters, page, limit) => {
  const query = generateQuery(filters)

  console.log(query)
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

// const getUser = async (userId, email) => {
//   let user;
//   if(userId) {
//     user = await User.findById(userId)
//   }else if(email) {
//     user = await User.findOne({ email: email })
//   }

//   return user
// }

const deleteUser = async (userId, adminId, reason) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  let imageKeys = []

  try{
    const user = await User.findById(userId).session(session)
    if (!user) throw new Error('User tapilmadi');

    const listings = await Listing.find({ seller: userId }).session(session)

    if(listings.length > 0) {

      imageKeys = listings.flatMap(listing => listing.images)

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
      deletedBy: adminId,
      deletedByRole: 'admin',
      deletedReason: reason
    }], { session })

    await User.findByIdAndDelete(userId).session(session)
    await session.commitTransaction()

  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    await session.endSession();
  }

  try{
    await deleteManyFromR2(imageKeys)
  }catch (err) {
    console.error('R2 şəkilləri silinə bilmədi:', err)
  }

}

const warningUser = async (userId, message) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('User tapilmadi');

  if(user.isWarning >= 5) {
    return { success: false, message: 'Limite catib' }
  }

  
  const [updatedUser, systemMessage] = await Promise.all([
    User.updateOne({ _id: userId }, {
      $inc: {
        isWarning: 1
      }
    }),
    Message.create({
      user: userId,
      message_type: 'warning',
      message: message
    })
  ])

  if(updatedUser.isWarning >= 5 && !updatedUser.isLocked) {
    await Promise.all([
      User.updateOne({_id: userId}, {
        isLocked: true,
        lockedAt: new Date()
      }),
      Listing.updateMany({seller: userId}, {
        status: 'blocked'
      })
    ])
  }

  return {
    success: true,
    message: 'Guncellendi'
  }
}

const resetWarningUser = async (userId) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('User tapilmadi');

  await Promise.all([
    User.updateOne({_id: userId}, {
      isWarning: 0,
      isLocked: false,
      lockedAt: null
    }),
    Listing.updateMany({seller: userId, status: 'blocked'}, {
      status: 'active'
    })
  ])

  return {
    success: true,
    message: 'User guncellendi'
  }
}

const blokedUser = async (userId, message) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('User tapilmadi');

  await Promise.all([
    User.updateOne({_id: userId}, {
      isLocked: true,
      lockedAt: new Date()
    }),
    Listing.updateMany({seller: userId, status: 'active'}, {
      status: 'blocked'
    }),
    Message.create({
      user: userId,
      message_type: 'danger',
      message: message
    })
  ])

  return {
    success: true,
    message: 'User guncellendi'
  }
}

const unBlokedUser = async (userId) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('User tapilmadi');

  await Promise.all([
    User.updateOne({_id: userId}, {
      isLocked: false,
      lockedAt: null
    }),
    Listing.updateMany({seller: userId, status: 'blocked'}, {
      status: 'active'
    })
  ])

  return {
    success: true,
    message: 'User guncellendi'
  }
}

const editUserRole = async (userId, role) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('User tapilmadi');

  const updatedUser = await User.updateOne({_id: userId}, {
    role: role
  })

  return {
    success: true,
    message: 'User guncellendi'
  }
}

const updateUsers = async (filters, data) => {
  const query = generateQuery(filters)
  return await User.updateMany(query, data, { runValidators: true })
}


// DELETED USERS LE BAQLI
const getDeletedUsers = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [deletedUsers, total] = await Promise.all([
    DeletedListing.find()
      .populate('deletedBy')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DeletedListing.countDocuments()
  ])

  return {
    deletedUsers,
    total
  }
}


const generateQuery = (filters) => {
  const query = {}
  if(filters.userId) query._id = filters.userId;
  if(filters.email) query.email = filters.email;
  if(filters.name) query.name = filters.name;
  if(filters.ip) query.ip = filters.ip;
  if(filters.role) query.role = filters.role;
  if(filters.isWarning !== undefined) query.isWarning = filters.isWarning;
  if(filters.isLocked !== undefined) query.isLocked = filters.isLocked;
  return query
}


export default {
  getAllUsers,
  getFilteredUsers,
  // getUser,
  deleteUser,
  warningUser,
  resetWarningUser,
  blokedUser,
  unBlokedUser,
  editUserRole,
  getDeletedUsers
}