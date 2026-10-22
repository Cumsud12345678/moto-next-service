import mongoose from 'mongoose'

// Status kodlu xəta: error middleware bu kodu cavaba yazır
export const httpError = (statusCode, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

// İstifadəçi yazdığı mətni regex-də təhlükəsiz istifadə etmək üçün
export const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value) && /^[a-f0-9]{24}$/i.test(String(value))

// page >= 1, limit 1..100
export const parsePagination = (query, defaultLimit = 20) => {
  const page = Math.max(parseInt(query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), 100)
  return { page, limit }
}

export const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.max(Math.ceil(total / limit), 1),
})
