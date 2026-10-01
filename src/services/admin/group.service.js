import { Group } from "../../models/interaction/group.model.js";
import { deleteFromR2, uploadToR2 } from "../storage.service.js";

const getGroups = async () => {
  const groups = await Group.find();
  return {
    success: true,
    data: groups
  }
}

const createGroup = async (file, data) => {
  const existing = file.originalname.split('.').pop()?.toLowerCase() || 'webp';
  const unique = crypto.randomUUID();

  const key = `vp-groups/${unique}.${existing}`;

  try{
    await uploadToR2(file, key)
  }catch(err) {
    throw err
  }

  await Group.create({
    logo: key,
    ...data
  })

  return {
    success: true,
    message: 'Group eklendi'
  }
}

const updateGroup = async (groupId, file, logo, newData) => {
  const group = await Group.findById(groupId)
  if(!group) throw new Error('Grup tapilmadi');

  if(file) {
    const existing = file.originalname.split('.').pop()?.toLowerCase() || 'webp';
    const unique = crypto.randomUUID();

    const key = `vp-groups/${unique}.${existing}`;

    try{
      await uploadToR2(file, key)
      await deleteFromR2(group.logo)
    }catch(err) {
      throw err
    }

    await Group.updateOne({_id: groupId}, {
      logo: key,
      ...newData
    })
  }else {
    await Group.updateOne({_id: groupId}, {
      ...newData
    })
  }

  return {
    success: true,
    message: 'Group eklendi'
  }
}

const deleteGroup = async (groupId) => {
  const group = await Group.findById(groupId);
  if(!group) throw new Error('Grup tapilmadi');

  await Group.findByIdAndDelete(groupId)

  try{
    await deleteFromR2(group.logo)
  }catch(err) {
    throw err
  }
}

export default {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup
}