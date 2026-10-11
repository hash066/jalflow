# Deployment

Prerequisites: AWS CLI and SAM CLI authenticated to `ap-south-1`.

```sh
npm ci
npm test
npm run build
sam build --template-file infra/template.yaml
sam deploy --guided --region ap-south-1 --stack-name jalflow
aws s3 sync dist s3://BUCKET_FROM_OUTPUT --delete
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths '/*'
```

The stack creates private S3 hosting through CloudFront, Cognito, an authenticated HTTP API, SQS, DynamoDB, Lambda, CloudWatch integration, and a US$20 monthly budget. A budget is not an automatic hard stop; connect an account notification subscriber in AWS Budgets. Worker concurrency is capped at two. Planning jobs persist model version, units, source references, and validation scope.
