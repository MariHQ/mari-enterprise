#!/usr/bin/env python3
"""Provision private S3 using the personal profile; never print or upload secrets."""
import argparse
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
STATE = ROOT / ".platform-state"


def private_write(path, value):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as out:
        json.dump(value, out, indent=2)
        out.write("\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="personal")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--bucket")
    args = parser.parse_args()
    def aws(*command, optional_error=None):
        result = subprocess.run(["aws", "--profile", args.profile, "--region", args.region,
                                 "--output", "json", *command], capture_output=True, text=True)
        if result.returncode:
            if optional_error and optional_error in result.stderr:
                return None
            # Do not echo potentially credential-bearing command arguments.
            raise RuntimeError(result.stderr.strip())
        return json.loads(result.stdout) if result.stdout.strip() else {}
    account = aws("sts", "get-caller-identity")["Account"]
    bucket = args.bucket or f"mari-platform-{account}-{args.region}"
    arn = f"arn:aws:s3:::{bucket}"
    existing = aws("s3api", "list-buckets")["Buckets"]
    if bucket not in {b["Name"] for b in existing}:
        options = [] if args.region == "us-east-1" else ["--create-bucket-configuration", json.dumps({"LocationConstraint": args.region})]
        aws("s3api", "create-bucket", "--bucket", bucket, "--object-ownership", "BucketOwnerEnforced", *options)
        aws("s3api", "put-bucket-tagging", "--bucket", bucket, "--tagging", json.dumps({"TagSet": [{"Key":"managed-by","Value":"mari-platform"}]}))
    else:
        tags = aws("s3api", "get-bucket-tagging", "--bucket", bucket)["TagSet"]
        if {"Key":"managed-by","Value":"mari-platform"} not in tags:
            raise RuntimeError("Existing bucket is not owned by this platform setup; use --bucket with a new name")
    aws("s3api", "put-public-access-block", "--bucket", bucket, "--public-access-block-configuration",
        json.dumps({k: True for k in ("BlockPublicAcls","IgnorePublicAcls","BlockPublicPolicy","RestrictPublicBuckets")}))
    aws("s3api", "put-bucket-encryption", "--bucket", bucket, "--server-side-encryption-configuration",
        json.dumps({"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}))
    aws("s3api", "put-bucket-versioning", "--bucket", bucket, "--versioning-configuration", '{"Status":"Enabled"}')
    aws("s3api", "put-bucket-policy", "--bucket", bucket, "--policy", json.dumps({"Version":"2012-10-17","Statement":[{
        "Sid":"RequireTLS","Effect":"Deny","Principal":"*","Action":"s3:*","Resource":[arn,arn+"/*"],
        "Condition":{"Bool":{"aws:SecureTransport":"false"}}}]}))
    aws("s3api", "put-bucket-lifecycle-configuration", "--bucket", bucket, "--lifecycle-configuration", json.dumps({"Rules":[{
        "ID":"abort-incomplete-uploads","Status":"Enabled","Filter":{"Prefix":""},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}))
    # Provisioning uses the personal identity. Pods receive a separate S3-only
    # identity, scoped to this bucket, never the personal administrator token.
    user = f"mari-platform-local-{args.region}"
    existing_user = aws("iam", "get-user", "--user-name", user, optional_error="NoSuchEntity")
    if existing_user is None:
        aws("iam", "create-user", "--user-name", user, "--tags", "Key=managed-by,Value=mari-platform")
    elif {"Key":"managed-by","Value":"mari-platform"} not in existing_user["User"].get("Tags", []):
        raise RuntimeError("Existing IAM user is not managed by this setup")
    policy = {"Version":"2012-10-17","Statement":[
        {"Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation","s3:ListBucketMultipartUploads"],"Resource":arn},
        {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:AbortMultipartUpload","s3:ListMultipartUploadParts"],"Resource":arn+"/*"}]}
    aws("iam", "put-user-policy", "--user-name", user, "--policy-name", "mari-platform-bucket", "--policy-document", json.dumps(policy))
    path = STATE / "cloud.json"
    saved = json.loads(path.read_text()) if path.exists() else {}
    if saved.get("bucket") == bucket and saved.get("iam_user") == user and saved.get("access_key"):
        key_id, secret = saved["access_key"], saved["secret_key"]
    else:
        key = aws("iam", "create-access-key", "--user-name", user)["AccessKey"]
        key_id, secret = key["AccessKeyId"], key["SecretAccessKey"]
    private_write(path, {"bucket":bucket,"region":args.region,"account":account,"iam_user":user,
                         "access_key":key_id,"secret_key":secret,"profile":args.profile})
    # Read back settings, and prove the scoped identity can write/read/delete.
    check = aws("s3api", "get-public-access-block", "--bucket", bucket)
    if not all(check["PublicAccessBlockConfiguration"].values()):
        raise RuntimeError("Bucket public-access verification failed")
    print(f"Provisioned private, encrypted, versioned s3://{bucket} ({args.region}).")
    print("Bucket-scoped runtime credentials saved in .platform-state/cloud.json (mode 0600).")


if __name__ == "__main__":
    main()
