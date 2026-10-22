import groupService from "../../services/admin/group.service.js";

const getGroups = async (req, res, next) => {
  try {
    res.status(200).json(await groupService.getGroups())
  } catch (err) {
    next(err)
  }
}

const createGroup = async (req, res, next) => {
  try {
    res.status(201).json(await groupService.createGroup(req.file, req.body))
  } catch (err) {
    next(err)
  }
}

const updateGroup = async (req, res, next) => {
  try {
    res.status(200).json(await groupService.updateGroup(req.params.groupId, req.file, req.body))
  } catch (err) {
    next(err)
  }
}

const deleteGroup = async (req, res, next) => {
  try {
    res.status(200).json(await groupService.deleteGroup(req.params.groupId))
  } catch (err) {
    next(err)
  }
}

export {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup
}
