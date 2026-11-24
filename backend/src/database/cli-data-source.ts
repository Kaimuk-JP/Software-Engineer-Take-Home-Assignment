import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source';

/** ใช้กับ TypeORM CLI เท่านั้น: npm run migration:run / migration:revert */
export default new DataSource(buildDataSourceOptions());
