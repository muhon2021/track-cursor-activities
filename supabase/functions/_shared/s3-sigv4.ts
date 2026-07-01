interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

const textEncoder = new TextEncoder();

async function sha256HexBytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  return sha256HexBytes(textEncoder.encode(value));
}

async function hmacSha256(key: Uint8Array | string, value: string): Promise<Uint8Array> {
  const keyBytes = typeof key === "string" ? textEncoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(value)));
}

async function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function getHost(bucket: string, region: string): string {
  if (region === "us-east-1") {
    return `${bucket}.s3.amazonaws.com`;
  }

  return `${bucket}.s3.${region}.amazonaws.com`;
}

function getS3Url(bucket: string, region: string, key = ""): string {
  const host = getHost(bucket, region);
  return key ? `https://${host}/${encodeRfc3986(key).replace(/%2F/g, "/")}` : `https://${host}/`;
}

async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  payload: string | Uint8Array,
  credentials: AwsCredentials,
  region: string,
): Promise<SignedRequest> {
  const urlObject = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = typeof payload === "string"
    ? await sha256Hex(payload)
    : await sha256HexBytes(payload);

  const canonicalHeaders = {
    host: urlObject.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...headers,
  };

  const sortedHeaderNames = Object.keys(canonicalHeaders).sort();
  const canonicalHeadersString = sortedHeaderNames
    .map((name) => `${name}:${canonicalHeaders[name as keyof typeof canonicalHeaders]}\n`)
    .join("");
  const signedHeaders = sortedHeaderNames.join(";");

  const canonicalRequest = [
    method,
    urlObject.pathname || "/",
    urlObject.search.replace(/^\?/, ""),
    canonicalHeadersString,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSignatureKey(credentials.secretAccessKey, dateStamp, region, "s3");
  const signature = Array.from(await hmacSha256(signingKey, stringToSign))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  return {
    url,
    headers: {
      ...headers,
      Host: urlObject.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`AWS request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function mapS3Error(status: number, body: string): string {
  if (status === 403) {
    return "Access denied. Check IAM permissions for HeadBucket, PutObject, and DeleteObject.";
  }
  if (status === 404) {
    return "S3 bucket not found. Verify the bucket name and region.";
  }
  if (status === 301 || status === 307) {
    return "Bucket region mismatch. Verify the AWS region matches your bucket.";
  }

  return body || `AWS S3 request failed with status ${status}`;
}

export async function testS3ConnectionFast(options: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
}): Promise<string> {
  const credentials: AwsCredentials = {
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
  };
  const region = options.region || "us-east-1";
  const bucket = options.bucketName.trim();

  const headSigned = await signRequest(
    "HEAD",
    getS3Url(bucket, region),
    {},
    "",
    credentials,
    region,
  );

  const headResponse = await fetchWithTimeout(headSigned.url, {
    method: "HEAD",
    headers: headSigned.headers,
  });

  if (!headResponse.ok) {
    throw new Error(mapS3Error(headResponse.status, await headResponse.text()));
  }

  const testKey = `.health-check/.test-${Date.now()}.txt`;
  const body = "storage health check";
  const putSigned = await signRequest(
    "PUT",
    getS3Url(bucket, region, testKey),
    { "content-type": "text/plain" },
    body,
    credentials,
    region,
  );

  const putResponse = await fetchWithTimeout(putSigned.url, {
    method: "PUT",
    headers: putSigned.headers,
    body,
  });

  if (!putResponse.ok) {
    throw new Error(mapS3Error(putResponse.status, await putResponse.text()));
  }

  const deleteSigned = await signRequest(
    "DELETE",
    getS3Url(bucket, region, testKey),
    {},
    "",
    credentials,
    region,
  );

  const deleteResponse = await fetchWithTimeout(deleteSigned.url, {
    method: "DELETE",
    headers: deleteSigned.headers,
  });

  if (!deleteResponse.ok && deleteResponse.status !== 204) {
    throw new Error(mapS3Error(deleteResponse.status, await deleteResponse.text()));
  }

  return "AWS S3 connection successful";
}

export async function putS3Object(options: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  key: string;
  body: Uint8Array;
  mimeType: string;
}): Promise<void> {
  const credentials: AwsCredentials = {
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
  };
  const region = options.region || "us-east-1";

  const signed = await signRequest(
    "PUT",
    getS3Url(options.bucketName, region, options.key),
    { "content-type": options.mimeType },
    options.body,
    credentials,
    region,
  );

  const response = await fetchWithTimeout(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: options.body,
  });

  if (!response.ok) {
    throw new Error(mapS3Error(response.status, await response.text()));
  }
}

export async function deleteS3Object(options: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  key: string;
}): Promise<void> {
  const credentials: AwsCredentials = {
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
  };
  const region = options.region || "us-east-1";

  const signed = await signRequest(
    "DELETE",
    getS3Url(options.bucketName, region, options.key),
    {},
    "",
    credentials,
    region,
  );

  const response = await fetchWithTimeout(signed.url, {
    method: "DELETE",
    headers: signed.headers,
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(mapS3Error(response.status, await response.text()));
  }
}

export function getS3ObjectUrl(bucket: string, region: string, key: string): string {
  return getS3Url(bucket, region, key);
}

export async function createPresignedGetUrl(options: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const credentials: AwsCredentials = {
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
  };
  const region = options.region || "us-east-1";
  const expiresIn = options.expiresIn ?? 3600;
  const url = new URL(getS3Url(options.bucketName, region, options.key));
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `${credentials.accessKeyId}/${credentialScope}`);
  url.searchParams.set("X-Amz-Date", amzDate);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  url.searchParams.set("X-Amz-SignedHeaders", "host");

  const canonicalQueryString = Array.from(url.searchParams.entries())
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .sort()
    .join("&");

  const canonicalRequest = [
    "GET",
    url.pathname,
    canonicalQueryString,
    `host:${url.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSignatureKey(credentials.secretAccessKey, dateStamp, region, "s3");
  const signature = Array.from(await hmacSha256(signingKey, stringToSign))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  url.searchParams.set("X-Amz-Signature", signature);
  return url.toString();
}
