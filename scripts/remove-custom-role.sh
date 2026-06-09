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
   echo -e "${RED}Could not get the custom role definition name from azd environment file${NC}"
   exit 1
fi

#echo -e "Deleting custom role '$CUSTOM_ROLE_DEFINITION_NAME'..."
az account set --subscription $AZURE_SUBSCRIPTION_ID
az role assignment delete --role --name "$CUSTOM_ROLE_DEFINITION_NAME" --scope "/subscriptions/$AZURE_SUBSCRIPTION_ID"
az role definition delete --name "$CUSTOM_ROLE_DEFINITION_NAME"
echo -e "${YELLOW}Deleted custom role '$CUSTOM_ROLE_DEFINITION_NAME'.${NC}"