// Explicitly target MongoDB Atlas Cloud Cluster
process.env.MONGODB_URI =
  process.env.ATLAS_MONGODB_URI

import('./seed.js').catch((err) => {
  console.error('Failed to seed cloud database:', err)
  process.exit(1)
})
