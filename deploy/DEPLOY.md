# Deploying MediCare+ HMS

Three tiers, deployed separately. The scripts in `aws/` are idempotent:
re-running one finds what already exists rather than failing.

```bash
./aws/01-database.sh          # network, security groups, RDS, secrets
./aws/02-roles.sh             # the two App Runner roles
./aws/02-image.sh             # build for linux/amd64, push to ECR
./aws/03-seed.sh              # load the schema, then revoke its own access
./aws/04-service.sh           # VPC connector, App Runner service, health check
./aws/05-bedrock-endpoint.sh  # a private endpoint so the API can reach Bedrock
```

Then the frontend, from `../frontend`:

```bash
npx vercel deploy --prod      # needs one variable, API_URL
```

## What is not in that list

No key to paste anywhere. The database URL and the token signing key live
in AWS Secrets Manager and are read by App Runner at start-up. Bedrock is
reached through the instance role, so there is no AI credential at all.

`API_URL` has no `NEXT_PUBLIC_` prefix, because every call the browser
makes is relative to the frontend and the API's address never reaches the
bundle.

## Two things worth knowing

`03-seed.sh` opens the database to whichever machine runs it, loads the
schema, then revokes that access and fails loudly if any address range
remains. Afterwards nothing on the internet can reach port 5432.

`05-bedrock-endpoint.sh` exists because of a consequence that is easy to
miss: routing the service's egress through a VPC connector is what lets
the database stay private, but it also removes the default route to the
internet, so a call to Bedrock hangs until the request times out. Every AI
feature shows its fallback message and the API stays up, which is correct
behaviour and also why the cause is invisible from outside.

## Verifying a deployment

```bash
WEB_URL=https://your-app.vercel.app API_BASE=https://your-api.awsapprunner.com \
  ../scripts/verify-e2e.sh          # 39 checks, over cookies, as a browser sees it
WEB_URL=https://your-app.vercel.app ../scripts/verify-screens.sh
```

## Removing it

RDS has deletion protection on, so it has to be turned off before the
instance can be deleted. That is deliberate.
