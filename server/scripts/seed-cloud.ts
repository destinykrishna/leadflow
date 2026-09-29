// Explicitly target MongoDB Atlas Cloud Cluster
process.env.MONGODB_URI =
  process.env.ATLAS_MONGODB_URI ||
  'mongodb+srv://krishna20420_db_user:mYkdXhiT26fiWbw6@cluster0.kxewayo.mongodb.net/leadflow?retryWrites=true&w=majority&appName=Cluster0'

import('./seed.js').catch((err) => {
  console.error('Failed to seed cloud database:', err)
  process.exit(1)
})
