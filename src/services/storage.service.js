import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import r2 from "../config/r2Client.js";

const BUCKET = process.env.R2_BUCKET_NAME;

// Tək şəkil upload
const uploadToR2 = async (
  file,
  key
) => {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return key;
};

// Tək şəkil sil
const deleteFromR2 = async (key) => {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
};

// Bir neçə şəkil sil
const deleteManyFromR2 = async (keys) => {
  if (!keys.length) return;

  await r2.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: keys.map((key) => ({
          Key: key,
        })),
      },
    })
  );
};

//  video upload
const videoUploadToR2 = async (
  file,
  key
) => {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return key;
};

export {
  uploadToR2,
  deleteFromR2,
  deleteManyFromR2,
  videoUploadToR2
};