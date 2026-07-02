# Step 1: Activate Drone UI

## Configure Drone Pipeline

### Activate and Configure Repository in Drone

In order to deploy your application, your code will need to live in a GitHub repo. If this is a new application, you will need to create a new repo. By convention, only lowercase letters, numbers, and hyphens should be used. See [10gen](https://github.com/10gen) for examples.

After you create your GitHub repo, sign in to [Drone](https://drone.corp.mongodb.com) with your GitHub credentials and activate your newly created repo.

> **Note:** This creates a signed webhook in GitHub which requires Admin permissions on the repo. The webhook will be owned by the user activating the repository. If the user leaves the GitHub organization, the repository will need to be reactivated.

If your repo was recently changed or created, you may need to click the refresh button.

### Configure Secrets in Drone

In order to push your Docker image to ECR and deploy to Kubernetes, you will need to configure the following Drone secrets. The value for each secret is the output of the commands specified below.

First, set the namespace to a variable. This will be used throughout the rest of the commands below:

```bash
NAMESPACE=industrysolutions
```

#### Required Secrets

1. **staging_kubernetes_token**

   ```bash
   kubectl config use-context api.staging.corp.mongodb.com
   kubectl config set-context --current --namespace=$NAMESPACE
   kubectl get secret kanopy-cicd-token -o jsonpath="{.data.token}" | base64 --decode && echo
   ```

2. **prod_kubernetes_token**

   ```bash
   kubectl config use-context api.prod.corp.mongodb.com
   kubectl config set-context --current --namespace=$NAMESPACE
   kubectl get secret kanopy-cicd-token -o jsonpath="{.data.token}" | base64 --decode && echo
   ```

3. **ecr_access_key**

   ```bash
   kubectl get secret ecr -o jsonpath="{.data.ecr_access_key}" | base64 --decode && echo
   ```

4. **ecr_secret_key**

   ```bash
   kubectl get secret ecr -o jsonpath="{.data.ecr_secret_key}" | base64 --decode && echo
   ```

These secrets can be added from the Drone web UI.

## Step 2: Choose Deployment Type

Based on the Drone configuration files available in this repository, you can choose between two deployment architectures:

### Option A: Separate Pods Deployment (`.drone-seperate-pods.yml`)

This deployment approach creates separate Kubernetes pods for frontend and backend services.

**Characteristics:**

- Frontend and backend run in separate pods
- Each service has its own ingress endpoint
- Better resource isolation
- Easier to scale services independently
- Separate URLs for frontend and backend

**Setup Steps:**

1. Copy `.drone-seperate-pods.yml` to `.drone.yml` in your repository root
2. Replace all instances of `<your-demo-name>` with your actual demo name (e.g., `financial-news-vector-search`)
3. Update the following placeholders throughout the file:
   - Repository names: `industrysolutions/<your-demo-name>-backend` and `industrysolutions/<your-demo-name>-frontend`
   - Release names: `<your-demo-name>-backend` and `<your-demo-name>-frontend`
   - Ingress hosts: `<your-demo-name>-backend.industrysolutions.staging.corp.mongodb.com` and `<your-demo-name>-frontend.industrysolutions.staging.corp.mongodb.com`

**Example URLs after deployment:**

- Frontend: `https://<your-demo-name>-frontend.industrysolutions.staging.corp.mongodb.com`
- Backend API: `https://<your-demo-name>-backend.industrysolutions.staging.corp.mongodb.com`

### Option B: Multi-Container Pod Deployment (`.drone-multicontainer-pods.yml`)

This deployment approach runs frontend and backend as containers within the same pod (sidecar pattern).

**Characteristics:**

- Frontend and backend containers run in the same pod
- Single ingress endpoint
- Shared networking and storage within the pod
- Backend accessible via localhost from frontend
- More resource-efficient for smaller applications

**Setup Steps:**

1. Copy `.drone-multicontainer-pods.yml` to `.drone.yml` in your repository root
2. Replace all instances of `<your-demo-name>` with your actual demo name (e.g., `multi-agent-predictive-maintenance`)
3. Update the following placeholders throughout the file:
   - Repository names: `industrysolutions/<your-demo-name>-backend` and `industrysolutions/<your-demo-name>-frontend`
   - Release name: `<your-demo-name>`
   - Ingress host: `<your-demo-name>.industrysolutions.staging.corp.mongodb.com`

**Example URL after deployment:**

- Application: `https://<your-demo-name>.industrysolutions.staging.corp.mongodb.com`

### Choosing the Right Deployment Type

**Choose Separate Pods if:**

- You need to scale frontend and backend independently
- Services have different resource requirements
- You want maximum isolation between services
- You're building a microservices architecture

**Choose Multi-Container Pod if:**

- Your application is smaller and simpler
- Frontend and backend are tightly coupled
- You want to minimize networking complexity
- Resource efficiency is a priority

### Final Setup Steps (Required for Both Options)

After choosing your deployment type and updating the `.drone.yml` file:

1. **Replace demo name placeholders**: Search for `<your-demo-name>` throughout the file and replace with your actual demo name (e.g., for this template you might use `python-nextjs-demo` or something more specific to your use case)
2. **Commit and push**: Commit the `.drone.yml` file to your repository
3. **Create staging branch**: Ensure you have a `staging` branch for staging deployments
4. **Deploy**: Push to the `staging` branch to trigger staging deployment, or `main` branch for production deployment

The deployment will automatically build Docker images, push them to ECR, and deploy to the appropriate Kubernetes namespace based on the branch you push to.

## Step 3: Configure Environment Variables and Secrets

After setting up your deployment type, you need to configure environment variables and secrets for your application. The configuration differs based on your deployment approach and cloud provider.

### Environment Configuration Files

The repository includes two environment configuration files:

- `environment/staging.yaml` - Configuration for staging environment
- `environment/production.yaml` - Configuration for production environment

### Types of Configuration

#### 1. Environment Variables (`env` section)

These are non-sensitive configuration values that are injected as environment variables:

```yaml
env:
  NODE_ENV: staging  # or prod for production
  AWS_REGION: us-east-1
  BACKEND_URL: http://<service-name>:80  # Update based on your deployment type
```

**Required Updates:**

- **For Separate Pods Deployment**: Set `BACKEND_URL` to `http://<your-demo-name>-backend:80`
- **For Multi-Container Pod Deployment**: Set `BACKEND_URL` to `http://localhost:8000`

#### 2. Environment Secrets (`envSecrets` section)

These are sensitive values stored in Kubernetes secrets. You need to create these secrets in your Kubernetes namespace:

```yaml
envSecrets:
  MONGODB_URI: session-temp-kanopy      # Name of the K8s secret containing MongoDB URI
  DATABASE_NAME: session-temp-kanopy   # Name of the K8s secret containing database name
  VOYAGE_API_KEY: session-temp-kanopy  # Name of the K8s secret containing Voyage AI API key
```

#### 3. Sidecar Container Secrets (Multi-Container Pod Only)

For multi-container pod deployments, uncomment and configure the `sidecarContainers` section:

```yaml
sidecarContainers:
  - name: backend
    image: 795250896452.dkr.ecr.us-east-1.amazonaws.com/industrysolutions/<your-demo-name>-backend:latest
    env:
      - name: MONGODB_URI
        valueFrom:
          secretKeyRef:
            name: <your-secret-name>
            key: MONGODB_URI
      - name: DATABASE_NAME
        valueFrom:
          secretKeyRef:
            name: <your-secret-name>
            key: DATABASE_NAME
      - name: VOYAGE_API_KEY
        valueFrom:
          secretKeyRef:
            name: <your-secret-name>
            key: VOYAGE_API_KEY
```

### Cloud Provider Setup

#### AWS Configuration (Default)

For AWS deployments, update the IRSA (IAM Roles for Service Accounts) configuration:

```yaml
serviceAccount:
  enabled: true
  irsa:
    accountId: "275662791714"  # Your AWS account ID
    roleName: "kanopy-staging-cicd-irsa"  # Staging role
    # roleName: "kanopy-prod-cicd-irsa"    # Production role
```

#### GCP Configuration (Alternative)

If deploying to GCP, uncomment and configure the GCP section:

```yaml
serviceAccount:
  enabled: true
  name: <service-account>  # Your GCP service account name

extraVolumes:
  - name: gcp-creds
    configMap:
      name: <config-map-name>
  - name: gcp-token
    projected:
      sources:
      - serviceAccountToken:
          path: token
          expirationSeconds: 3600
          audience: "//iam.googleapis.com/projects/362614368442/locations/global/workloadIdentityPools/<WIF_POOL_ID>/providers/<WIF_PROVIDER_ID>"

extraVolumeMounts:
  - name: gcp-creds
    mountPath: /etc/gcp
    readOnly: true
  - name: gcp-token
    mountPath: /var/run/service-account
    readOnly: true
```

### Setup Steps

#### 1. Create Kubernetes Secrets

Before deploying, create the required secrets in your Kubernetes namespace:

```bash
# Set your namespace
NAMESPACE=industrysolutions

# Create MongoDB connection secret
helm ksec set <secret-group> MONGODB_URI="your-mongodb-uri" DATABASE_NAME="your-database-name"

```

#### 2. Update Environment Files

1. **Update `environment/staging.yaml`:**
   - Replace `<service-name>` with your actual service name
   - Update secret names from `<secret-group>` to your actual secret names :
   - Configure cloud provider settings (AWS/GCP)

2. **Update `environment/production.yaml`:**
   - Same updates as staging, but for production values
   - Ensure production-specific configurations

#### 3. Deployment-Specific Configuration

**For Separate Pods Deployment:**

- Update `BACKEND_URL` in environment files to: `http://<your-demo-name>-backend:80`
- Use `envSecrets` section for secret configuration
- Comment out `sidecarContainers` section

**For Multi-Container Pod Deployment:**

- Update `BACKEND_URL` in environment files to: `http://localhost:8000`
- Uncomment and configure `sidecarContainers` section
- Update the sidecar container image path with your demo name

#### 4. Verify Configuration

After updating the configuration files:

1. Commit your changes to the repository
2. Ensure your Kubernetes secrets exist in the target namespace
3. Deploy using your chosen deployment method
4. Check pod logs to verify environment variables are properly loaded

### Example Configuration

For a demo named `python-nextjs-demo`, your configuration might look like:

```yaml
# staging.yaml
env:
  NODE_ENV: staging
  AWS_REGION: us-east-1
  BACKEND_URL: http://python-nextjs-demo-backend:80  # For separate pods

envSecrets:
  MONGODB_URI: python-nextjs-demo-secrets
  DATABASE_NAME: python-nextjs-demo-secrets
  VOYAGE_API_KEY: python-nextjs-demo-secrets
```

This ensures your application has access to all necessary configuration values and secrets for proper operation in both staging and production environments.

## Further Debugging and Common Pitfalls

If you encounter issues during deployment, consider the following steps:

1. Use `kubectl describe` to inspect pod details and events
2. Check pod logs for error messages
3. Verify Kubernetes secrets are correctly created and referenced
4. Ensure environment variables and secrets are correctly configured in your environment files
5. Validate cloud provider-specific configurations (e.g., IRSA, GCP service accounts)
6. `NEXT_*` variables are loaded during build time, so staging.yaml and env files are not used. I recommend not using `NEXT_*`; instead, use variables without the `NEXT_*` prefix and implement an API proxy pattern. More information in NEXTJS-ENV-VARIABLES.md: [Kanopy Deployment Resources](https://drive.google.com/drive/folders/1ICw8OERIeTRYIHI2AUOzYKsGM6fGylxl?usp=drive_link)
7. The `NODE_ENV` variable is set to either `staging` or `production` depending on the branch you deploy from. This results in two separate instances of your application running—one for staging and one for production. Both instances may access shared resources, such as the same database or the same Voyage AI API key. When using a shared database, resource contention can occur. To mitigate this, consider implementing job scheduling or other resource management strategies.

```bash
# Get all pods in the namespace
kubectl get pods -n industrysolutions

# Describe a specific pod
kubectl describe pod <pod-name> -n industrysolutions

# View pod logs
kubectl logs <pod-name> -n industrysolutions

# View pod logs for a specific container (if using multi-container pods)
kubectl logs <pod-name> -c <container-name> -n industrysolutions

# Get container names
kubectl get pods <pod-name> -o jsonpath='{.spec.containers[*].name}' -n industrysolutions
```

## Accelerating Deployment with AI-Assisted Debugging

For faster troubleshooting and deployment assistance, you can leverage AI tools like GitHub Copilot or Cursor to help debug issues and optimize your setup.

### AI-Assisted Debugging Resources

Download the comprehensive debugging resources from: [Kanopy Deployment Resources](https://drive.google.com/drive/folders/1ICw8OERIeTRYIHI2AUOzYKsGM6fGylxl?usp=drive_link)

**Setup Steps:**

1. **Download and integrate**: Copy the entire folder from the Google Drive link into your demo project directory
2. **Context sharing**: Ask your AI assistant (Copilot, Cursor, etc.) to analyze and understand all files in the folder
3. **Interactive debugging**: Share specific error messages or deployment issues with your AI assistant for targeted troubleshooting
4. **Optimization guidance**: Request recommendations for configuration improvements or deployment best practices

**Benefits:**

- Faster issue resolution through AI-powered analysis
- Context-aware debugging suggestions based on your specific configuration
- Real-time assistance during deployment and troubleshooting
- Access to proven solutions from similar deployment scenarios

This approach combines the comprehensive documentation in this guide with AI-powered assistance to streamline your deployment process and resolve issues more efficiently.

## Resource Management

### Default Resource Limits

The `.drone.yml` templates use conservative default resource limits optimized for demo deployments. These defaults prevent resource waste while providing enough capacity for typical demo workloads.

| Environment | CPU Limit | Memory Limit | CPU Request | Memory Request |
|-------------|-----------|--------------|-------------|----------------|
| **Staging** | 500m | 512Mi | 100m | 256Mi |
| **Production** | 500m | 512Mi | 150m | 256Mi |

These defaults apply to both main containers (frontend/backend) and sidecar containers.

### Troubleshooting: OOMKilled Errors

When a pod is terminated with `OOMKilled` status, it means the container exceeded its memory limit. Use the following guide to incrementally increase memory:

| Current Memory | Bump To | Notes |
|----------------|---------|-------|
| 256Mi | 384Mi | +50% first step |
| 384Mi | 512Mi | Standard demo ceiling |
| 512Mi | 768Mi | ML/AI demos may need this |
| 768Mi | 1024Mi | Heavy processing only |
| 1024Mi+ | Investigate | Likely a memory leak - profile your application |

**Best Practice:** Increase memory by 50% increments until stable, not 2x jumps. This helps identify the actual memory requirement without over-provisioning.

**How to detect OOMKilled:**

```bash
# Check pod status and restart reason
kubectl get pods -n industrysolutions
kubectl describe pod <pod-name> -n industrysolutions | grep -A5 "Last State"

# Look for OOMKilled in the output
# Last State: Terminated
#   Reason: OOMKilled
```

**How to fix:** Update the memory limits in your `.drone.yml`:

```yaml
# Before (default)
- "resources.limits.memory=512Mi"
- "resources.requests.memory=256Mi"

# After (increased for ML/AI workloads)
- "resources.limits.memory=768Mi"
- "resources.requests.memory=384Mi"
```

### Troubleshooting: CPU Throttling

If your pod is running slowly but not crashing, it may be experiencing CPU throttling. Use the following guide to increase CPU allocation:

| Current CPU | Bump To | Notes |
|-------------|---------|-------|
| 250m | 500m | Light processing |
| 500m | 750m | Moderate processing |
| 750m | 1000m | Heavy computation |
| 1000m+ | Investigate | Consider optimizing code |

**How to detect CPU throttling:**

```bash
# Check pod metrics (requires metrics-server)
kubectl top pods -n industrysolutions

# Look at container resource usage
kubectl describe pod <pod-name> -n industrysolutions | grep -A10 "Limits"
```

**How to fix:** Update the CPU limits in your `.drone.yml`:

```yaml
# Before (default)
- "resources.limits.cpu=500m"
- "resources.requests.cpu=100m"

# After (increased for compute-heavy workloads)
- "resources.limits.cpu=750m"
- "resources.requests.cpu=200m"
```

### Resource Guidelines by Workload Type

| Workload Type | Recommended Memory | Recommended CPU |
|---------------|-------------------|-----------------|
| Simple API/UI | 256Mi - 512Mi | 250m - 500m |
| Standard Demo | 512Mi | 500m |
| ML/AI Processing | 768Mi - 1024Mi | 750m - 1000m |
| Heavy Computation | 1024Mi+ | 1000m+ |

### Monitoring Resource Usage

To monitor actual resource consumption and right-size your limits:

```bash
# Watch real-time resource usage
kubectl top pods -n industrysolutions --containers

# Get historical resource usage (if Prometheus is available)
# Check your cluster's monitoring dashboard
```

**Tip:** Start with the default conservative limits and only increase when you observe OOMKilled errors or significant throttling. This approach maximizes cluster efficiency while ensuring your demo runs reliably.



