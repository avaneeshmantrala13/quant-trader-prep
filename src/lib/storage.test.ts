import { describe, expect, it } from "vitest";
import { createStorageProvider, LocalStorageProvider } from "./storage";
import { AwsStorageProvider } from "./awsStorage";
import { isAwsBackend, readAwsConfig } from "./awsConfig";

/**
 * Provider-selection contract: the app MUST default to local-first with zero
 * AWS config, and only swap to the AWS backend when explicitly flagged AND the
 * required config is present. No real AWS credentials are needed here.
 */
describe("createStorageProvider", () => {
  it("defaults to LocalStorageProvider when no env is set", () => {
    expect(createStorageProvider({})).toBeInstanceOf(LocalStorageProvider);
  });

  it("stays local when the backend flag is anything but 'aws'", () => {
    expect(createStorageProvider({ VITE_STORAGE_BACKEND: "local" })).toBeInstanceOf(
      LocalStorageProvider,
    );
    expect(createStorageProvider({ VITE_STORAGE_BACKEND: "" })).toBeInstanceOf(
      LocalStorageProvider,
    );
  });

  it("falls back to local when flagged 'aws' but config is incomplete", () => {
    expect(
      createStorageProvider({ VITE_STORAGE_BACKEND: "aws" }),
    ).toBeInstanceOf(LocalStorageProvider);
  });

  it("selects AwsStorageProvider when flagged 'aws' with full config", () => {
    const env = {
      VITE_STORAGE_BACKEND: "aws",
      VITE_AWS_REGION: "us-east-1",
      VITE_COGNITO_USER_POOL_ID: "us-east-1_abc123",
      VITE_COGNITO_USER_POOL_CLIENT_ID: "clientid123",
      VITE_COGNITO_IDENTITY_POOL_ID: "us-east-1:00000000-0000-0000-0000-000000000000",
      VITE_DYNAMODB_TABLE: "qtp-progress",
    };
    expect(createStorageProvider(env)).toBeInstanceOf(AwsStorageProvider);
  });
});

describe("awsConfig helpers", () => {
  it("isAwsBackend is case-insensitive and defaults false", () => {
    expect(isAwsBackend({})).toBe(false);
    expect(isAwsBackend({ VITE_STORAGE_BACKEND: "AWS" })).toBe(true);
    expect(isAwsBackend({ VITE_STORAGE_BACKEND: "aws" })).toBe(true);
    expect(isAwsBackend({ VITE_STORAGE_BACKEND: "firebase" })).toBe(false);
  });

  it("readAwsConfig returns null when required values are missing", () => {
    expect(readAwsConfig({ VITE_STORAGE_BACKEND: "aws" })).toBeNull();
  });

  it("readAwsConfig parses a complete config", () => {
    const cfg = readAwsConfig({
      VITE_AWS_REGION: "us-east-1",
      VITE_COGNITO_USER_POOL_ID: "us-east-1_abc123",
      VITE_COGNITO_USER_POOL_CLIENT_ID: "clientid123",
      VITE_COGNITO_IDENTITY_POOL_ID: "us-east-1:guid",
      VITE_DYNAMODB_TABLE: "qtp-progress",
      VITE_API_BASE_URL: "https://api.example.com",
    });
    expect(cfg).not.toBeNull();
    expect(cfg?.region).toBe("us-east-1");
    expect(cfg?.progressTable).toBe("qtp-progress");
    expect(cfg?.apiBaseUrl).toBe("https://api.example.com");
    // Google defaults OFF when the flag is absent.
    expect(cfg?.googleEnabled).toBe(false);
  });
});

/**
 * Google feature-gate: the "Continue with Google" button must ONLY be enabled
 * when `VITE_GOOGLE_AUTH` is explicitly on AND the Hosted-UI domain + redirect
 * exist. A Cognito domain alone (which always exists) is NOT enough — otherwise
 * users hit the Hosted UI's "Login option is not available" error.
 */
describe("Google federation gating (googleEnabled)", () => {
  const base = {
    VITE_AWS_REGION: "us-east-1",
    VITE_COGNITO_USER_POOL_ID: "us-east-1_abc123",
    VITE_COGNITO_USER_POOL_CLIENT_ID: "clientid123",
    VITE_COGNITO_IDENTITY_POOL_ID: "us-east-1:guid",
    VITE_DYNAMODB_TABLE: "qtp-progress",
  };
  const domain = {
    VITE_COGNITO_DOMAIN: "qtp.auth.us-east-1.amazoncognito.com",
    VITE_COGNITO_REDIRECT_URI: "http://localhost:5173/",
  };

  it("is OFF when the flag is unset, even with a Cognito domain present", () => {
    expect(readAwsConfig({ ...base, ...domain })?.googleEnabled).toBe(false);
  });

  it("is OFF when explicitly off", () => {
    expect(
      readAwsConfig({ ...base, ...domain, VITE_GOOGLE_AUTH: "off" })
        ?.googleEnabled,
    ).toBe(false);
  });

  it("is OFF when the flag is on but the domain/redirect are missing", () => {
    expect(
      readAwsConfig({ ...base, VITE_GOOGLE_AUTH: "on" })?.googleEnabled,
    ).toBe(false);
  });

  it("is ON only when the flag is on AND domain + redirect are present", () => {
    for (const on of ["on", "true", "1", "yes"]) {
      expect(
        readAwsConfig({ ...base, ...domain, VITE_GOOGLE_AUTH: on })
          ?.googleEnabled,
      ).toBe(true);
    }
  });

  it("AwsStorageProvider exposes signInWithGoogle only when enabled", () => {
    const off = createStorageProvider({
      VITE_STORAGE_BACKEND: "aws",
      ...base,
      ...domain,
    });
    expect(off).toBeInstanceOf(AwsStorageProvider);
    expect(off.signInWithGoogle).toBeUndefined();

    const on = createStorageProvider({
      VITE_STORAGE_BACKEND: "aws",
      ...base,
      ...domain,
      VITE_GOOGLE_AUTH: "on",
    });
    expect(on).toBeInstanceOf(AwsStorageProvider);
    expect(typeof on.signInWithGoogle).toBe("function");
  });
});
