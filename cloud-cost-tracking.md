# Cloud Cost Tracking & Resource Tagging

All cloud resources created for IST demos must be tagged for cost tracking and ownership.

## Required Tags

Every resource must have all 4 tags:

| Tag | Description | Example |
|-----|-------------|---------|
| `Project` | Demo name (lowercase, hyphens) | `leafy-bank` |
| `Environment` | Deployment environment | `demo`, `prod`, `dev` |
| `Owner` | Team member email | `john.doe@mongodb.com` |
| `purpose` | Industry vertical | `ist-finance`, `ist-retail`, `ist-insurance`, `ist-manufacturing`, `ist-healthcare`, `ist-media` |

---

## AWS Tagging Commands

### S3 Buckets

```bash
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list "arn:aws:s3:::<bucket-name>" \
  --tags Project=<demo-name>,Environment=<environment>,Owner=<owner-email>,purpose=<purpose>
```

### Lambda Functions

```bash
aws lambda tag-resource \
  --resource "arn:aws:lambda:<region>:<account-id>:function:<function-name>" \
  --tags Project=<demo-name>,Environment=<environment>,Owner=<owner-email>,purpose=<purpose>
```

### EC2 Instances

```bash
aws ec2 create-tags \
  --resources <instance-id> \
  --tags Key=Project,Value=<demo-name> Key=Environment,Value=<environment> Key=Owner,Value=<owner-email> Key=purpose,Value=<purpose>
```

### EBS Volumes

```bash
aws ec2 create-tags \
  --resources <volume-id> \
  --tags Key=Project,Value=<demo-name> Key=Environment,Value=<environment> Key=Owner,Value=<owner-email> Key=purpose,Value=<purpose>
```

### ECR Repositories

```bash
aws ecr tag-resource \
  --resource-arn "arn:aws:ecr:<region>:<account-id>:repository/<repo-name>" \
  --tags key=Project,value=<demo-name> key=Environment,value=<environment> key=Owner,value=<owner-email> key=purpose,value=<purpose>
```

### Secrets Manager

```bash
aws secretsmanager tag-resource \
  --secret-id <secret-name> \
  --tags Key=Project,Value=<demo-name> Key=Environment,Value=<environment> Key=Owner,Value=<owner-email> Key=purpose,Value=<purpose>
```

### Any Resource (Generic)

Works for any resource that has an ARN:

```bash
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list "<resource-arn>" \
  --tags Project=<demo-name>,Environment=<environment>,Owner=<owner-email>,purpose=<purpose>
```

### Verify Tags

```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=<demo-name> \
  --region <region>
```

---

## GCP Labeling Commands

GCP uses `labels` instead of tags. Label keys must be lowercase with underscores (no hyphens).

| AWS Tag | GCP Label | Format Change |
|---------|-----------|---------------|
| `Project` | `project` | lowercase |
| `Environment` | `environment` | lowercase |
| `Owner` | `owner` | replace `.` and `@` with `_` (e.g. `john_doe_mongodb_com`) |
| `purpose` | `purpose` | replace `-` with `_` (e.g. `ist_finance`) |

### Compute Engine Instances

```bash
gcloud compute instances update <instance-name> \
  --update-labels project=<demo-name>,environment=<environment>,owner=<owner_email>,purpose=<purpose> \
  --zone <zone>
```

### Cloud Storage Buckets

```bash
gcloud storage buckets update gs://<bucket-name> \
  --update-labels project=<demo-name>,environment=<environment>,owner=<owner_email>,purpose=<purpose>
```

### Cloud Functions

```bash
gcloud functions deploy <function-name> \
  --update-labels project=<demo-name>,environment=<environment>,owner=<owner_email>,purpose=<purpose> \
  --region <region>
```

### Cloud Run Services

```bash
gcloud run services update <service-name> \
  --update-labels project=<demo-name>,environment=<environment>,owner=<owner_email>,purpose=<purpose> \
  --region <region>
```

### GKE Clusters

```bash
gcloud container clusters update <cluster-name> \
  --update-labels project=<demo-name>,environment=<environment>,owner=<owner_email>,purpose=<purpose> \
  --zone <zone>
```

### Artifact Registry Repositories

```bash
gcloud artifacts repositories update <repo-name> \
  --update-labels project=<demo-name>,environment=<environment>,owner=<owner_email>,purpose=<purpose> \
  --location <region>
```

### Secret Manager Secrets

```bash
gcloud secrets update <secret-name> \
  --update-labels project=<demo-name>,environment=<environment>,owner=<owner_email>,purpose=<purpose>
```

### BigQuery Datasets

```bash
bq update --set_label project:<demo-name> \
  --set_label environment:<environment> \
  --set_label owner:<owner_email> \
  --set_label purpose:<purpose> \
  <dataset-name>
```

### Verify Labels

```bash
gcloud asset search-all-resources \
  --query="labels.project=<demo-name>" \
  --scope="projects/<gcp-project-id>"
```

---

## Bedrock Inference Profiles

Inference profiles are free tagged wrappers around foundation models that enable per-demo Bedrock API cost tracking in AWS Cost Explorer.

### Prerequisites

- AWS CLI v2 installed and configured
- Authenticated via `aws sso login`

### List Available Foundation Models

Use these commands to find the correct `modelId` for the `--model-source` parameter:

```bash
# List all available models
aws bedrock list-foundation-models --region us-east-1 --output table \
  --query "modelSummaries[].{ModelId:modelId,Provider:providerName,Name:modelName}"

# Filter by provider
aws bedrock list-foundation-models --region us-east-1 --by-provider anthropic --output table \
  --query "modelSummaries[].{ModelId:modelId,Name:modelName}"

aws bedrock list-foundation-models --region us-east-1 --by-provider cohere --output table \
  --query "modelSummaries[].{ModelId:modelId,Name:modelName}"
```

### Create Chat Completion Profile (Required)

```bash
aws bedrock create-inference-profile \
  --inference-profile-name "<demo-name>-haiku" \
  --model-source '{"copyFrom":"arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"}' \
  --tags key=Project,value=<demo-name> key=Environment,value=<environment> key=Owner,value=<owner-email> key=purpose,value=<purpose> \
  --region us-east-1 \
  --output json
```

### Create Embedding Profile (Optional)

Only needed if your demo uses embeddings.

```bash
aws bedrock create-inference-profile \
  --inference-profile-name "<demo-name>-cohere-embed" \
  --model-source '{"copyFrom":"arn:aws:bedrock:us-east-1::foundation-model/cohere.embed-english-v3"}' \
  --tags key=Project,value=<demo-name> key=Environment,value=<environment> key=Owner,value=<owner-email> key=purpose,value=<purpose> \
  --region us-east-1 \
  --output json
```

### Profile Naming Convention

- Chat: `<demo-name>-haiku`, `<demo-name>-sonnet`
- Embedding: `<demo-name>-cohere-embed`, `<demo-name>-titan-embed`

### Available Models

**Chat Completion**

| Name | Model ID |
|------|----------|
| Claude 3 Haiku | `anthropic.claude-3-haiku-20240307-v1:0` |
| Claude 3.5 Sonnet | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| Claude 3 Sonnet | `anthropic.claude-3-sonnet-20240229-v1:0` |

**Embedding**

| Name | Model ID |
|------|----------|
| Cohere Embed English v3 | `cohere.embed-english-v3` |
| Amazon Titan Embed Text v1 | `amazon.titan-embed-text-v1` |

### Deploy to Kubernetes

Use the ARNs from the profile creation output:

```bash
helm ksec set <demo-name> CHATCOMPLETIONS_MODEL_ID="<chat-profile-arn>"

# Only if embedding profile was created
helm ksec set <demo-name> EMBEDDINGS_MODEL_ID="<embed-profile-arn>"
```

Then restart:

```bash
kubectl rollout restart deployment <demo-name>
```

---

## Code Patterns & What Needs to Change

Inference profile ARNs are drop-in replacements for model IDs in most cases, but some frameworks need an extra `provider` parameter. Identify which pattern your demo uses below.

### Pattern A: Raw `invoke_model()` — No code change needed

Direct boto3 calls accept inference profile ARNs as-is.

```python
# Works with both model IDs and inference profile ARNs
response = bedrock_client.invoke_model(
    modelId=self.model_id,  # env var -> inference profile ARN
    body=request
)
```

**Action:** Just `helm ksec set` + restart. No code change.

---

### Pattern B: LangChain `ChatBedrock` — No code change needed

`ChatBedrock` resolves the provider from the model ID automatically. Inference profile ARNs work without changes.

```python
from langchain_aws import ChatBedrock

llm = ChatBedrock(
    model=os.getenv("CHATCOMPLETIONS_MODEL_ID"),
    client=bedrock_client,
    temperature=0
)
```

**Action:** Just `helm ksec set` + restart. No code change.

---

### Pattern C: LangChain `ChatBedrockConverse` — Needs `provider` parameter

`ChatBedrockConverse` (the Converse API wrapper) **cannot infer the provider from an inference profile ARN**. You must add `provider="anthropic"`.

```python
from langchain_aws import ChatBedrockConverse

# WITHOUT provider — breaks with inference profile ARNs
llm = ChatBedrockConverse(
    model=os.getenv("CHAT_COMPLETIONS_MODEL_ID"),
    client=bedrock_client,
    temperature=0
)

# WITH provider — works with both model IDs and inference profile ARNs
llm = ChatBedrockConverse(
    model=os.getenv("CHAT_COMPLETIONS_MODEL_ID"),
    client=bedrock_client,
    provider="anthropic",  # <- ADD THIS
    temperature=0
)
```

**Action:** Add `provider="anthropic"` in code, then `helm ksec set` + restart.

---

### Pattern D: LangChain `BedrockEmbeddings` — No code change needed

```python
from langchain_aws import BedrockEmbeddings

embeddings = BedrockEmbeddings(
    client=bedrock_client,
    model_id=os.getenv("EMBEDDINGS_MODEL_ID", "cohere.embed-english-v3")
)
```

**Action:** Just `helm ksec set` + restart. No code change.

---

### Pattern E: Hardcoded model IDs — Needs code change

If the model ID is hardcoded (not read from env var), refactor to read from an environment variable first.

```python
# BEFORE — hardcoded, can't swap to inference profile
llm = ChatBedrock(model="anthropic.claude-3-haiku-20240307-v1:0")

# AFTER — reads from env var with fallback for local dev
llm = ChatBedrock(model=os.getenv("CHATCOMPLETIONS_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"))
```

**Action:** Refactor to env var, deploy code, then `helm ksec set` + restart.

---

### Quick Reference

| Pattern | Framework | `provider` needed? | Code change? |
|---------|-----------|-------------------|--------------|
| A | Raw `invoke_model()` | No | No |
| B | `ChatBedrock` | No | No |
| C | `ChatBedrockConverse` | **Yes** (`provider="anthropic"`) | **Yes** |
| D | `BedrockEmbeddings` | No | No |
| E | Hardcoded model ID | N/A | **Yes** (refactor to env var) |

### Common Env Var Names

| Env Var | Used For |
|---------|----------|
| `CHATCOMPLETIONS_MODEL_ID` | Chat/LLM model (this template) |
| `CHAT_COMPLETIONS_MODEL_ID` | Chat/LLM model (capitalmarkets demos) |
| `BEDROCK_MODEL_ID` | Chat/LLM model (document-intelligence) |
| `EMBEDDINGS_MODEL_ID` | Embedding model |
| `MODEL_ID` | Lambda functions |

### How This Template Works

The Python classes in this template (Pattern A) read model IDs from environment variables with fallback defaults:

- `BedrockAnthropicChatCompletions` reads `CHATCOMPLETIONS_MODEL_ID` (fallback: `anthropic.claude-3-haiku-20240307-v1:0`)
- `BedrockCohereEnglishEmbeddings` reads `EMBEDDINGS_MODEL_ID` (fallback: `cohere.embed-english-v3`)

For local development, the fallback defaults use the foundation models directly. In deployed environments (staging/prod), the K8s secrets override these with inference profile ARNs for cost tracking.

---

## Notes

- AWS tags are **additive** when using `resourcegroupstaggingapi tag-resources` — existing tags are preserved
- GCP `--update-labels` is also additive — existing labels are preserved
- Bedrock inference profile tags use **lowercase** `key`/`value` (not `Key`/`Value`)
- GCP labels only allow lowercase letters, numbers, underscores, and hyphens (no dots or `@`)
