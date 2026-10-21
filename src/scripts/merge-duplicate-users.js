// Eyni emailə (böyük/kiçik hərf və boşluq fərqi ilə) aid dublikat hesabları birləşdirir.
//
// İstifadə (backend qovluğunda):
//   node src/scripts/merge-duplicate-users.js          -> yalnız nə ediləcəyini göstərir
//   node src/scripts/merge-duplicate-users.js --apply  -> birləşdirir
//
// Hər qrupda ƏN KÖHNƏ hesab saxlanılır. Digər hesabın:
//   - elanları (Listing.seller), mesajları (Message.user), bəyənmələri (Like.user)
//     saxlanılan hesaba köçürülür
//   - özü DeletedUser-ə snapshot kimi yazılıb silinir
//   - saxlanılan hesabın email-i kiçik hərfə salınır
import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../models/user/user.model.js'
import { DeletedUser } from '../models/user/deletedUser.model.js'
import { Listing } from '../models/listing/listing.model.js'

const APPLY = process.argv.includes('--apply')

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL)
  const db = mongoose.connection.db

  // Like və Message modellərinin export adından asılı olmamaq üçün kolleksiyaları birbaşa götürürük
  const likes = db.collection('likes')
  const messages = db.collection('messages')

  const users = await User.collection
    .find({}, { projection: { _id: 1, email: 1, name: 1, createdAt: 1 } })
    .toArray()

  const groups = new Map()
  for (const u of users) {
    const key = String(u.email || '').trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(u)
  }

  for (const [email, list] of groups) {
    if (list.length < 2) continue

    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const keep = list[0]
    const extras = list.slice(1)

    console.log(`\n${email}`)
    console.log(`  SAXLANILIR: _id=${keep._id} name="${keep.name}"`)

    for (const extra of extras) {
      const [listingCount, messageCount, likeCount] = await Promise.all([
        Listing.countDocuments({ seller: extra._id }),
        messages.countDocuments({ user: extra._id }),
        likes.countDocuments({ user: extra._id }),
      ])
      console.log(`  BİRLƏŞDİRİLİR: _id=${extra._id} name="${extra.name}" -> elan: ${listingCount}, mesaj: ${messageCount}, bəyənmə: ${likeCount}`)

      if (!APPLY) continue

      await Listing.collection.updateMany({ seller: extra._id }, { $set: { seller: keep._id } })
      await messages.updateMany({ user: extra._id }, { $set: { user: keep._id } })

      // Like-da {user, listing} unique-dir: saxlanılan hesab artıq bəyənibsə, dublikatı silirik
      const extraLikes = await likes.find({ user: extra._id }).toArray()
      for (const like of extraLikes) {
        const exists = await likes.findOne({ user: keep._id, listing: like.listing })
        if (exists) await likes.deleteOne({ _id: like._id })
        else await likes.updateOne({ _id: like._id }, { $set: { user: keep._id } })
      }

      const fullExtra = await User.collection.findOne({ _id: extra._id })
      await DeletedUser.create({
        originalUserId: extra._id,
        snapshot: fullExtra,
        deletedByRole: 'system',
        deletedReason: `merged_into:${keep._id}`,
      })
      await User.collection.deleteOne({ _id: extra._id })
    }

    if (APPLY) {
      await User.collection.updateOne({ _id: keep._id }, { $set: { email } })
      console.log('  ✔ birləşdirildi')
    }
  }

  if (!APPLY) console.log('\nHeç nə dəyişmədi. Birləşdirmək üçün --apply əlavə edin.')
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
