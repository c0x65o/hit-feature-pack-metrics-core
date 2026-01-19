-- hit:schema-only
-- Auto-generated from pack schema; app Drizzle migrations handle tables.

CREATE TABLE "metrics_data_sources" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"entity_kind" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"connector_key" varchar(255) NOT NULL,
	"source_kind" varchar(50) NOT NULL,
	"external_ref" varchar(500),
	"enabled" boolean DEFAULT true NOT NULL,
	"schedule" varchar(100),
	"config" jsonb,
	"overlap_policy" varchar(50) DEFAULT 'upsert_points' NOT NULL,
	"last_attempt_at" timestamp,
	"last_success_at" timestamp,
	"last_error_at" timestamp,
	"last_error_code" varchar(100),
	"last_error_message" text,
	"consecutive_failures" numeric(10, 0) DEFAULT '0',
	"expected_freshness_seconds" numeric(10, 0),
	"status_override" varchar(50),
	"last_metric_date" timestamp,
	"first_metric_date" timestamp,
	"metric_keys_produced" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_ingest_batches" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data_source_id" varchar(255) NOT NULL,
	"sync_run_id" varchar(255),
	"type" varchar(50) NOT NULL,
	"period" varchar(20),
	"file_ref" varchar(500),
	"file_name" varchar(255),
	"file_size" numeric(15, 0),
	"mapping_version" varchar(100),
	"status" varchar(50) NOT NULL,
	"date_range_start" timestamp,
	"date_range_end" timestamp,
	"records_total" numeric(10, 0) DEFAULT '0',
	"records_inserted" numeric(10, 0) DEFAULT '0',
	"records_updated" numeric(10, 0) DEFAULT '0',
	"records_rejected" numeric(10, 0) DEFAULT '0',
	"error_message" text,
	"validation_summary" jsonb,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_ingest_row_errors" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"ingest_batch_id" varchar(255) NOT NULL,
	"row_number" numeric(10, 0) NOT NULL,
	"error_code" varchar(100) NOT NULL,
	"error_message" text NOT NULL,
	"field_name" varchar(100),
	"raw_row" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_links" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"link_type" varchar(100) NOT NULL,
	"link_id" varchar(255) NOT NULL,
	"target_kind" varchar(50) DEFAULT 'none' NOT NULL,
	"target_id" varchar(255) DEFAULT '' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "metrics_links_unique" UNIQUE("link_type","link_id","target_kind","target_id")
);
--> statement-breakpoint
CREATE TABLE "metrics_metric_definitions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"unit" varchar(50) DEFAULT 'count' NOT NULL,
	"category" varchar(50),
	"default_granularity" varchar(20) DEFAULT 'daily' NOT NULL,
	"allowed_granularities" jsonb,
	"dimensions_schema" jsonb,
	"validation_rules" jsonb,
	"rollup_strategy" varchar(20) DEFAULT 'sum' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" numeric(10, 0) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "metrics_metric_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "metrics_metric_points" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"entity_kind" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"metric_key" varchar(100) NOT NULL,
	"data_source_id" varchar(255) NOT NULL,
	"sync_run_id" varchar(255),
	"ingest_batch_id" varchar(255),
	"date" timestamp NOT NULL,
	"granularity" varchar(20) DEFAULT 'daily' NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"dimensions" jsonb,
	"dimensions_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "metrics_metric_points_unique" UNIQUE("data_source_id","metric_key","date","granularity","dimensions_hash")
);
--> statement-breakpoint
CREATE TABLE "metrics_partner_credentials" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_verified_at" timestamp,
	"last_verify_ok" boolean,
	"last_verify_message" text,
	"last_verify_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_segments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"key" varchar(150) NOT NULL,
	"entity_kind" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"rule" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "metrics_segments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "metrics_sync_runs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data_source_id" varchar(255) NOT NULL,
	"task_run_id" varchar(255),
	"status" varchar(50) NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"error_code" varchar(100),
	"error_message" text,
	"warnings_count" numeric(10, 0) DEFAULT '0',
	"records_inserted" numeric(10, 0) DEFAULT '0',
	"records_updated" numeric(10, 0) DEFAULT '0',
	"records_rejected" numeric(10, 0) DEFAULT '0',
	"date_range_start" timestamp,
	"date_range_end" timestamp,
	"actions_required" jsonb,
	"log_ref" varchar(500),
	"sample_ref" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metrics_ingest_batches" ADD CONSTRAINT "metrics_ingest_batches_data_source_id_metrics_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."metrics_data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_ingest_batches" ADD CONSTRAINT "metrics_ingest_batches_sync_run_id_metrics_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."metrics_sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_ingest_row_errors" ADD CONSTRAINT "metrics_ingest_row_errors_ingest_batch_id_metrics_ingest_batches_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."metrics_ingest_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_metric_points" ADD CONSTRAINT "metrics_metric_points_data_source_id_metrics_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."metrics_data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_metric_points" ADD CONSTRAINT "metrics_metric_points_sync_run_id_metrics_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."metrics_sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_metric_points" ADD CONSTRAINT "metrics_metric_points_ingest_batch_id_metrics_ingest_batches_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."metrics_ingest_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_sync_runs" ADD CONSTRAINT "metrics_sync_runs_data_source_id_metrics_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."metrics_data_sources"("id") ON DELETE cascade ON UPDATE no action;