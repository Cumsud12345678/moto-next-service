import 'dotenv/config'
import sharp from 'sharp'
import { ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import r2 from '../config/r2Client.js'

sharp.concurrency(1)
const BUCKET = process.env.R2_BUCKET_NAME
const MIN_SIZE = 300 * 1024
const DRY_RUN = process.argv.includes('--dry')

let token, total = 0, done = 0, saved = 0

do {
  const list = await r2.send(new ListObjectsV2Command({
    Bucket: BUCKET, Prefix: 'listings/', ContinuationToken: token,
  }))

  for (const obj of list.Contents ?? []) {
    total++
    if (obj.Key.includes('/video/') || obj.Size < MIN_SIZE) continue

    try {
      const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }))
      const input = Buffer.from(await res.Body.transformToByteArray())

      const output = await sharp(input, { failOn: 'none' })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      if (output.length >= input.length) continue

      if (!DRY_RUN) {
        await r2.send(new PutObjectCommand({
          Bucket: BUCKET, Key: obj.Key, Body: output,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }))
      }

      done++
      saved += input.length - output.length
      console.log(`✔ ${obj.Key}  ${(input.length/1024).toFixed(0)}KB → ${(output.length/1024).toFixed(0)}KB`)
    } catch (err) {
      console.error(`✖ ${obj.Key}:`, err.message)
    }
  }
  token = list.NextContinuationToken
} while (token)

console.log(`\nYoxlanıldı: ${total}, sıxışdırıldı: ${done}, qənaət: ${(saved/1024/1024).toFixed(1)} MB${DRY_RUN ? ' (DRY RUN)' : ''}`)