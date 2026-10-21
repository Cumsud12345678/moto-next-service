// Mövcud istifadəçilərin email-lərini kiçik hərfə salır və dublikatları göstərir.
//
// İstifadə (backend qovluğunda):
//   node src/scripts/normalize-user-emails.js          -> yalnız hesabat (heç nə dəyişmir)
//   node src/scripts/normalize-user-emails.js --apply  -> dublikatı OLMAYANLARI düzəldir
//
// Dublikatlar (məs. "Ali@gmail.com" və "ali@gmail.com") avtomatik birləşdirilmir,
// çünki elanları fərqli hesablarda ola bilər. Siyahıya baxıb əl ilə qərar verin.
import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../models/user/user.model.js'

const APPLY = process.argv.includes('--apply')

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL)

  // Model-dəki lowercase setter-i keçmək üçün birbaşa kolleksiyadan oxuyuruq
  const users = await User.collection
    .find({}, { projection: { _id: 1, email: 1, name: 1, createdAt: 1 } })
    .toArray()

  const groups = new Map()
  for (const u of users) {
    const key = String(u.email || '').trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(u)
  }

  let duplicateGroups = 0
  let fixable = 0

  for (const [email, list] of groups) {
    if (list.length > 1) {
      duplicateGroups++
      console.log(`\nDUBLİKAT: ${email}`)
      for (const u of list) {
        console.log(`  _id=${u._id}  email="${u.email}"  name="${u.name}"  createdAt=${u.createdAt?.toISOString?.() ?? '-'}`)
      }
      continue
    }

    const u = list[0]
    if (u.email !== email) {
      fixable++
      console.log(`düzəlməli: "${u.email}" -> "${email}"`)
      if (APPLY) {
        await User.collection.updateOne({ _id: u._id }, { $set: { email } })
      }
    }
  }

  // Unique index həqiqətən var?
  const indexes = await User.collection.indexes()
  const hasUnique = indexes.some((i) => i.key?.email === 1 && i.unique)

  console.log('\n----------------')
  console.log(`Dublikat qrupları: ${duplicateGroups}`)
  console.log(`Kiçik hərfə salınmalı: ${fixable}${APPLY ? ' (düzəldildi)' : ' (dəyişmək üçün --apply)'}`)
  console.log(`email unique index: ${hasUnique ? 'VAR' : 'YOXDUR — dublikatları təmizlədikdən sonra serveri yenidən başladın ki, yaradılsın'}`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
