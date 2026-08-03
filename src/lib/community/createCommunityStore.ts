/**
 * createCommunityStore.ts — the SINGLE wiring point for the Community
 * persistence layer, mirroring `createStorageProvider` in `src/lib/storage.ts`.
 *
 * The DEFAULT is always the offline `InMemoryCommunityStore`, so the app builds
 * & runs local-first with ZERO backend configuration. When (and only when) the
 * AWS backend is enabled AND fully configured (`VITE_STORAGE_BACKEND=aws` plus
 * the required Cognito/DynamoDB env vars), it returns the DynamoDB-backed
 * `AwsCommunityStore` instead — sharing the exact credential/client path used by
 * progress storage (`createAwsDynamoContext`). If the flag is set but config is
 * incomplete, `readAwsConfig` returns `null` and we fall back to in-memory, so
 * the app is never left without a working (offline) community store.
 *
 * Nothing here touches the network at import time or at construction: the AWS
 * store is inert until a read/write is performed against a live session.
 */
import { createAwsDynamoContext } from "../awsStorage";
import { isAwsBackend, readAwsConfig, type AwsConfig, type EnvLike } from "../awsConfig";
import {
  AwsCommunityStore,
  type CommunityDocClient,
} from "./awsCommunityStore";
import { InMemoryCommunityStore, type CommunityStore } from "./port";

/** Default community table name when `VITE_DYNAMODB_COMMUNITY_TABLE` is unset. */
const DEFAULT_COMMUNITY_TABLE = "quant-trader-prep-community";

function str(v: string | boolean | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Resolve the community table name: an explicit `VITE_DYNAMODB_COMMUNITY_TABLE`
 * wins; otherwise derive it from the progress table (…-progress → …-community)
 * so a standard deploy needs no extra env var; else a sane default.
 */
function communityTableName(env: EnvLike, cfg: AwsConfig): string {
  const explicit = str(env.VITE_DYNAMODB_COMMUNITY_TABLE);
  if (explicit) return explicit;
  if (/-progress$/.test(cfg.progressTable)) {
    return cfg.progressTable.replace(/-progress$/, "-community");
  }
  return DEFAULT_COMMUNITY_TABLE;
}

/**
 * Provider selection for the Community layer. Returns the AWS-backed store when
 * the AWS backend is configured, else the offline in-memory store. Pure factory
 * (env in → store out) so provider selection is unit-testable with no real AWS.
 */
export function createCommunityStore(env: EnvLike): CommunityStore {
  if (isAwsBackend(env)) {
    const cfg = readAwsConfig(env);
    if (cfg) {
      const ctx = createAwsDynamoContext(cfg);
      return new AwsCommunityStore({
        tableName: communityTableName(env, cfg),
        getClient: async () => {
          const client = await ctx.docClient();
          return client
            ? (client.doc as unknown as CommunityDocClient)
            : null;
        },
      });
    }
  }
  return new InMemoryCommunityStore();
}

/**
 * The process-wide community store, selected from the build-time env exactly
 * like the `storage` singleton. Local-first by default.
 */
export const communityStore: CommunityStore = createCommunityStore(
  import.meta.env as unknown as EnvLike,
);
