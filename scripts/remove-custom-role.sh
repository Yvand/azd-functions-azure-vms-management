#!/bin/bash

# -e: immediately exit if any command has a non-zero exit status
# -o pipefail: prevents errors in a pipeline from being masked
set -eo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\nRunning script '$(basename "$0")'..."

# https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/azd-extensibility#use-environment-variables-with-hooks
# Use the `get-values` azd command to retrieve environment variables from the `.env` file
while IFS='=' read -r key value; do
    value=$(echo "$value" | sed 's/^"//' | sed 's/"$//')
    export "$key=$value"
done <<EOF
$(azd env get-values) 
EOF

if [ -z "$CUSTOM_ROLE_DEFINITION_NAME" ]; then
   echo -e "${YELLOW}The custom role definition name was not found in the azd environment file, skip deleting it in Azure${NC}"
   exit 0
fi

echo -e "Deleting custom role '$CUSTOM_ROLE_DEFINITION_NAME' in subscription '${AZURE_SUBSCRIPTION_ID}'..."
az account set --subscription $AZURE_SUBSCRIPTION_ID
az role assignment delete --role "$CUSTOM_ROLE_DEFINITION_NAME" --scope "/subscriptions/$AZURE_SUBSCRIPTION_ID"
az role definition delete --name "$CUSTOM_ROLE_DEFINITION_NAME"
echo -e "${YELLOW}Deleted custom role '$CUSTOM_ROLE_DEFINITION_NAME'.${NC}"