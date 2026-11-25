const toInt = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isInteger(n) ? n : fallback;
};

export const config = {
  port: toInt(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || './data/internships.db',
  seedOnStart: String(process.env.SEED_ON_START || '').toLowerCase() === 'true',
};
