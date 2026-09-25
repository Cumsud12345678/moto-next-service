import groupService from "../../services/admin/group.service.js";

const getGroups = async (req, res, next) => {
  try{
    const result = await groupService.getGroups()

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const createGroup = async (req, res, next) => {
  try{
    const file = req.file;
    const data = req.body;

    const result = await groupService.createGroup(file, data)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const updateGroup = async (req, res, next) => {
  try{
    const groupId = req.params.groupId;
    const file = req.file;
    const data = req.body;

    const { logo, ...newData } = data

    const result = await groupService.updateGroup(groupId, file, logo, newData)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

const deleteGroup = async (req, res, next) => {
  try{
    const groupId = req.params.groupId;

    const result = await groupService.deleteGroup(groupId)

    res.status(200).json(result)
  }catch(err) {
    next(err)
  }
}

export {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup
}