// @hit/feature-pack-metrics-core
// A HIT feature pack
// Pages - exported individually for tree-shaking
export { Dashboard } from './pages/Dashboard';
export { Definitions } from './pages/Definitions';
export { Providers } from './pages/Providers';
export { ProviderDetail } from './pages/ProviderDetail';
export { Integrations } from './pages/Integrations';
export { IntegrationDetail } from './pages/IntegrationDetail';
export { Mappings } from './pages/Mappings';
export { MappingsType } from './pages/MappingsType';
export { Segments } from './pages/Segments';
export { SegmentEdit } from './pages/SegmentEdit';
// Schema exports MOVED to @hit/feature-pack-metrics-core/schema to avoid bundling drizzle-orm in client
