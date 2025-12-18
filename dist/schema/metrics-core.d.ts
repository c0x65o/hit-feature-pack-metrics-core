import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
/**
 * Metrics Metric Definitions
 * The dictionary of allowed metric keys and how they should be aggregated/validated.
 */
export declare const metricsMetricDefinitions: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metrics_metric_definitions";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        key: import("drizzle-orm/pg-core").PgColumn<{
            name: "key";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        label: import("drizzle-orm/pg-core").PgColumn<{
            name: "label";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        description: import("drizzle-orm/pg-core").PgColumn<{
            name: "description";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        unit: import("drizzle-orm/pg-core").PgColumn<{
            name: "unit";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        category: import("drizzle-orm/pg-core").PgColumn<{
            name: "category";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        defaultGranularity: import("drizzle-orm/pg-core").PgColumn<{
            name: "default_granularity";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        allowedGranularities: import("drizzle-orm/pg-core").PgColumn<{
            name: "allowed_granularities";
            tableName: "metrics_metric_definitions";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        dimensionsSchema: import("drizzle-orm/pg-core").PgColumn<{
            name: "dimensions_schema";
            tableName: "metrics_metric_definitions";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        validationRules: import("drizzle-orm/pg-core").PgColumn<{
            name: "validation_rules";
            tableName: "metrics_metric_definitions";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        rollupStrategy: import("drizzle-orm/pg-core").PgColumn<{
            name: "rollup_strategy";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        isActive: import("drizzle-orm/pg-core").PgColumn<{
            name: "is_active";
            tableName: "metrics_metric_definitions";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        sortOrder: import("drizzle-orm/pg-core").PgColumn<{
            name: "sort_order";
            tableName: "metrics_metric_definitions";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "metrics_metric_definitions";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "metrics_metric_definitions";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Metrics Data Sources
 * Inventory of sync-able sources (connectors + config) that produce metric points.
 */
export declare const metricsDataSources: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metrics_data_sources";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        entityKind: import("drizzle-orm/pg-core").PgColumn<{
            name: "entity_kind";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        entityId: import("drizzle-orm/pg-core").PgColumn<{
            name: "entity_id";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        connectorKey: import("drizzle-orm/pg-core").PgColumn<{
            name: "connector_key";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        sourceKind: import("drizzle-orm/pg-core").PgColumn<{
            name: "source_kind";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        externalRef: import("drizzle-orm/pg-core").PgColumn<{
            name: "external_ref";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        enabled: import("drizzle-orm/pg-core").PgColumn<{
            name: "enabled";
            tableName: "metrics_data_sources";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        schedule: import("drizzle-orm/pg-core").PgColumn<{
            name: "schedule";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        config: import("drizzle-orm/pg-core").PgColumn<{
            name: "config";
            tableName: "metrics_data_sources";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        overlapPolicy: import("drizzle-orm/pg-core").PgColumn<{
            name: "overlap_policy";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        lastAttemptAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_attempt_at";
            tableName: "metrics_data_sources";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        lastSuccessAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_success_at";
            tableName: "metrics_data_sources";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        lastErrorAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_error_at";
            tableName: "metrics_data_sources";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        lastErrorCode: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_error_code";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        lastErrorMessage: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_error_message";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        consecutiveFailures: import("drizzle-orm/pg-core").PgColumn<{
            name: "consecutive_failures";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        expectedFreshnessSeconds: import("drizzle-orm/pg-core").PgColumn<{
            name: "expected_freshness_seconds";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        statusOverride: import("drizzle-orm/pg-core").PgColumn<{
            name: "status_override";
            tableName: "metrics_data_sources";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        lastMetricDate: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_metric_date";
            tableName: "metrics_data_sources";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        firstMetricDate: import("drizzle-orm/pg-core").PgColumn<{
            name: "first_metric_date";
            tableName: "metrics_data_sources";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        metricKeysProduced: import("drizzle-orm/pg-core").PgColumn<{
            name: "metric_keys_produced";
            tableName: "metrics_data_sources";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "metrics_data_sources";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "metrics_data_sources";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Metrics Sync Runs
 * Ledger correlating connector runs to outcomes (ties to task runs when available).
 */
export declare const metricsSyncRuns: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metrics_sync_runs";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        dataSourceId: import("drizzle-orm/pg-core").PgColumn<{
            name: "data_source_id";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        taskRunId: import("drizzle-orm/pg-core").PgColumn<{
            name: "task_run_id";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        status: import("drizzle-orm/pg-core").PgColumn<{
            name: "status";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        startedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "started_at";
            tableName: "metrics_sync_runs";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        finishedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "finished_at";
            tableName: "metrics_sync_runs";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        errorCode: import("drizzle-orm/pg-core").PgColumn<{
            name: "error_code";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        errorMessage: import("drizzle-orm/pg-core").PgColumn<{
            name: "error_message";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        warningsCount: import("drizzle-orm/pg-core").PgColumn<{
            name: "warnings_count";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        recordsInserted: import("drizzle-orm/pg-core").PgColumn<{
            name: "records_inserted";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        recordsUpdated: import("drizzle-orm/pg-core").PgColumn<{
            name: "records_updated";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        recordsRejected: import("drizzle-orm/pg-core").PgColumn<{
            name: "records_rejected";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        dateRangeStart: import("drizzle-orm/pg-core").PgColumn<{
            name: "date_range_start";
            tableName: "metrics_sync_runs";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        dateRangeEnd: import("drizzle-orm/pg-core").PgColumn<{
            name: "date_range_end";
            tableName: "metrics_sync_runs";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        actionsRequired: import("drizzle-orm/pg-core").PgColumn<{
            name: "actions_required";
            tableName: "metrics_sync_runs";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        logRef: import("drizzle-orm/pg-core").PgColumn<{
            name: "log_ref";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        sampleRef: import("drizzle-orm/pg-core").PgColumn<{
            name: "sample_ref";
            tableName: "metrics_sync_runs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "metrics_sync_runs";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Metrics Ingest Batches
 * Used for file/manual ingestion tracking and provenance.
 */
export declare const metricsIngestBatches: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metrics_ingest_batches";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        dataSourceId: import("drizzle-orm/pg-core").PgColumn<{
            name: "data_source_id";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        syncRunId: import("drizzle-orm/pg-core").PgColumn<{
            name: "sync_run_id";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        type: import("drizzle-orm/pg-core").PgColumn<{
            name: "type";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        period: import("drizzle-orm/pg-core").PgColumn<{
            name: "period";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        fileRef: import("drizzle-orm/pg-core").PgColumn<{
            name: "file_ref";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        fileName: import("drizzle-orm/pg-core").PgColumn<{
            name: "file_name";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        fileSize: import("drizzle-orm/pg-core").PgColumn<{
            name: "file_size";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        mappingVersion: import("drizzle-orm/pg-core").PgColumn<{
            name: "mapping_version";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        status: import("drizzle-orm/pg-core").PgColumn<{
            name: "status";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        dateRangeStart: import("drizzle-orm/pg-core").PgColumn<{
            name: "date_range_start";
            tableName: "metrics_ingest_batches";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        dateRangeEnd: import("drizzle-orm/pg-core").PgColumn<{
            name: "date_range_end";
            tableName: "metrics_ingest_batches";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        recordsTotal: import("drizzle-orm/pg-core").PgColumn<{
            name: "records_total";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        recordsInserted: import("drizzle-orm/pg-core").PgColumn<{
            name: "records_inserted";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        recordsUpdated: import("drizzle-orm/pg-core").PgColumn<{
            name: "records_updated";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        recordsRejected: import("drizzle-orm/pg-core").PgColumn<{
            name: "records_rejected";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        errorMessage: import("drizzle-orm/pg-core").PgColumn<{
            name: "error_message";
            tableName: "metrics_ingest_batches";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        validationSummary: import("drizzle-orm/pg-core").PgColumn<{
            name: "validation_summary";
            tableName: "metrics_ingest_batches";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        processedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "processed_at";
            tableName: "metrics_ingest_batches";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "metrics_ingest_batches";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "metrics_ingest_batches";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Metrics Ingest Row Errors
 * Stores why individual rows were rejected.
 */
export declare const metricsIngestRowErrors: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metrics_ingest_row_errors";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "metrics_ingest_row_errors";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        ingestBatchId: import("drizzle-orm/pg-core").PgColumn<{
            name: "ingest_batch_id";
            tableName: "metrics_ingest_row_errors";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        rowNumber: import("drizzle-orm/pg-core").PgColumn<{
            name: "row_number";
            tableName: "metrics_ingest_row_errors";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        errorCode: import("drizzle-orm/pg-core").PgColumn<{
            name: "error_code";
            tableName: "metrics_ingest_row_errors";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        errorMessage: import("drizzle-orm/pg-core").PgColumn<{
            name: "error_message";
            tableName: "metrics_ingest_row_errors";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        fieldName: import("drizzle-orm/pg-core").PgColumn<{
            name: "field_name";
            tableName: "metrics_ingest_row_errors";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        rawRow: import("drizzle-orm/pg-core").PgColumn<{
            name: "raw_row";
            tableName: "metrics_ingest_row_errors";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "metrics_ingest_row_errors";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Metrics Links
 * Global linking/metadata registry used by ingestors and tooling.
 *
 * Examples:
 * - linkType="steam.app", linkId="276410", targetKind="project", targetId="ministry-of-broadcast"
 * - linkType="metrics.field_mapper", linkId="ministry of broadcast", targetKind="project", targetId="ministry-of-broadcast",
 *   metadata={ "steam_app_id": "276410" }
 */
export declare const metricsLinks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metrics_links";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "metrics_links";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        linkType: import("drizzle-orm/pg-core").PgColumn<{
            name: "link_type";
            tableName: "metrics_links";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        linkId: import("drizzle-orm/pg-core").PgColumn<{
            name: "link_id";
            tableName: "metrics_links";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        targetKind: import("drizzle-orm/pg-core").PgColumn<{
            name: "target_kind";
            tableName: "metrics_links";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        targetId: import("drizzle-orm/pg-core").PgColumn<{
            name: "target_id";
            tableName: "metrics_links";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        metadata: import("drizzle-orm/pg-core").PgColumn<{
            name: "metadata";
            tableName: "metrics_links";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "metrics_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "metrics_links";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Metrics Partner Credentials
 * Stores credentials + verification status for integration partners configured via `.hit/metrics/partners/*.yaml`.
 *
 * The partner "definition" lives in YAML; this table stores the per-app configured values.
 */
export declare const metricsPartnerCredentials: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metrics_partner_credentials";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "metrics_partner_credentials";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        enabled: import("drizzle-orm/pg-core").PgColumn<{
            name: "enabled";
            tableName: "metrics_partner_credentials";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        credentials: import("drizzle-orm/pg-core").PgColumn<{
            name: "credentials";
            tableName: "metrics_partner_credentials";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        lastVerifiedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_verified_at";
            tableName: "metrics_partner_credentials";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        lastVerifyOk: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_verify_ok";
            tableName: "metrics_partner_credentials";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        lastVerifyMessage: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_verify_message";
            tableName: "metrics_partner_credentials";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        lastVerifyDetails: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_verify_details";
            tableName: "metrics_partner_credentials";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "metrics_partner_credentials";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "metrics_partner_credentials";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Metrics Metric Points
 * Normalized time-series points with full provenance and dimensions hashing for safe upserts.
 */
export declare const metricsMetricPoints: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metrics_metric_points";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        entityKind: import("drizzle-orm/pg-core").PgColumn<{
            name: "entity_kind";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        entityId: import("drizzle-orm/pg-core").PgColumn<{
            name: "entity_id";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        metricKey: import("drizzle-orm/pg-core").PgColumn<{
            name: "metric_key";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        dataSourceId: import("drizzle-orm/pg-core").PgColumn<{
            name: "data_source_id";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        syncRunId: import("drizzle-orm/pg-core").PgColumn<{
            name: "sync_run_id";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        ingestBatchId: import("drizzle-orm/pg-core").PgColumn<{
            name: "ingest_batch_id";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        date: import("drizzle-orm/pg-core").PgColumn<{
            name: "date";
            tableName: "metrics_metric_points";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        granularity: import("drizzle-orm/pg-core").PgColumn<{
            name: "granularity";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        value: import("drizzle-orm/pg-core").PgColumn<{
            name: "value";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        dimensions: import("drizzle-orm/pg-core").PgColumn<{
            name: "dimensions";
            tableName: "metrics_metric_points";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        dimensionsHash: import("drizzle-orm/pg-core").PgColumn<{
            name: "dimensions_hash";
            tableName: "metrics_metric_points";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "metrics_metric_points";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "metrics_metric_points";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export type MetricsMetricDefinition = InferSelectModel<typeof metricsMetricDefinitions>;
export type InsertMetricsMetricDefinition = InferInsertModel<typeof metricsMetricDefinitions>;
export type MetricsDataSource = InferSelectModel<typeof metricsDataSources>;
export type InsertMetricsDataSource = InferInsertModel<typeof metricsDataSources>;
export type MetricsSyncRun = InferSelectModel<typeof metricsSyncRuns>;
export type InsertMetricsSyncRun = InferInsertModel<typeof metricsSyncRuns>;
export type MetricsIngestBatch = InferSelectModel<typeof metricsIngestBatches>;
export type InsertMetricsIngestBatch = InferInsertModel<typeof metricsIngestBatches>;
export type MetricsIngestRowError = InferSelectModel<typeof metricsIngestRowErrors>;
export type InsertMetricsIngestRowError = InferInsertModel<typeof metricsIngestRowErrors>;
export type MetricsLink = InferSelectModel<typeof metricsLinks>;
export type InsertMetricsLink = InferInsertModel<typeof metricsLinks>;
export type MetricsPartnerCredential = InferSelectModel<typeof metricsPartnerCredentials>;
export type InsertMetricsPartnerCredential = InferInsertModel<typeof metricsPartnerCredentials>;
export type MetricsMetricPoint = InferSelectModel<typeof metricsMetricPoints>;
export type InsertMetricsMetricPoint = InferInsertModel<typeof metricsMetricPoints>;
//# sourceMappingURL=metrics-core.d.ts.map