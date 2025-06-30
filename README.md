<!--
---
name: Azure function app to manage virtual machines
description: This template uses Azure Developer CLI (azd) to deploy an Azure function app to manage virtual machines running in Azure.
page_type: sample
languages:
- azdeveloper
- bicep
- nodejs
- typescript
products:
- azure-functions
urlFragment: azd-functions-azure-vms-management
---
-->

# Azure function app to manage virtual machines

This template uses [Azure Developer CLI (azd)](https://aka.ms/azd) to deploy an Azure function app to manage virtual machines.

## Overview

The function app uses the [Flex Consumption plan](https://learn.microsoft.com/azure/azure-functions/flex-consumption-plan) and is written in TypeScript.  
It contains multiple HTTP functions, and timer functions to automate some actions.

## Security of the Azure resources

The resources deployed in Azure are configured with a high level of security: 
- The function app connects to the storage account using a private endpoint.
- No public network access is allowed on the storage account.
- All the permissions are granted to the function app's managed identity (no secret, access key or legacy access policy is used).
- All the functions require an app key to be called.

## Permissions required to provision the resources in Azure

The user running **azd** must have at least the following roles to successfully provision the resources:

- Azure role **[Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#owner)** or **[User Access Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#user-access-administrator)**, or a custom role that has the `Microsoft.Authorization/roleDefinitions/write` permission: To be able to [create](https://learn.microsoft.com/azure/role-based-access-control/custom-roles-rest#create-a-custom-role) the [custom role definition](#Permissions-granted-to-the-function-app). Alternatively, the resources can be provisionned with parameter `addCustomRoleDefinition` set to false, and the custom role definition [created manually](#create-the-custom-role-definition-manually).
- Azure role **[Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#contributor)**: To create all the resources needed.
- Azure role **[Role Based Access Control Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#role-based-access-control-administrator)**: To assign roles (to access the storage account and Application Insights) to the managed identity of the function app.

## Prerequisites

- [Node.js 22](https://www.nodejs.org/)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)

## Initialize the local project

You can initialize a project from this `azd` template in one of these ways:

- Use this `azd init` command from an empty local (root) folder:

    ```shell
    azd init --template Yvand/azd-functions-azure-vms-management
    ```

    Supply an environment name, such as `functions-azuresdk-main` when prompted. In `azd`, the environment is used to maintain a unique deployment context for your app.

- Clone the GitHub template repository, and create an `azd` environment (in this example, `functions-azuresdk-main`):

    ```shell
    git clone https://github.com/Yvand/azd-functions-azure-vms-management.git
    cd azd-functions-azure-vms-management
    azd env new functions-azuresdk-main
    ```

## Prepare your local environment

1. Add a file named `local.settings.json` in the root of your project with the following contents:

   ```json
   {
      "IsEncrypted": false,
      "Values": {
         "AzureWebJobsStorage": "UseDevelopmentStorage=true",
         "FUNCTIONS_WORKER_RUNTIME": "node",
         "SubscriptionId": "YOUR_AZURE_SUBSCRIPTION_ID",
      }
   }
   ```

1. Review the file `infra/main.parameters.json` to customize the parameters used for provisioning the resources in Azure. Review [this article](https://learn.microsoft.com/azure/developer/azure-developer-cli/manage-environment-variables) to manage the azd's environment variables.

1. Install the dependencies and build the functions app:

   ```shell
   npm install
   npm run build
   ```

1. Provision the resources in Azure and deploy the functions app package by running command `azd up`.

1. The functions can also be run locally by executing command `npm run start`.

## Permissions granted to the function app

The function app uses its managed identity to authenticate to Azure. To grant it only the permissions it truly needs, a [custom role definition](infra/app/permissions.bicep#L7) is created and assigned to the function app's managed identity, with the following permissions:

```bicep
'Microsoft.Resources/subscriptions/resourceGroups/read'
'Microsoft.Compute/virtualMachines/read'
'Microsoft.Compute/virtualMachines/start/action'
'Microsoft.Compute/virtualMachines/restart/action'
'Microsoft.Compute/virtualMachines/deallocate/action'
'Microsoft.Compute/disks/write'
'Microsoft.Security/locations/jitNetworkAccessPolicies/read'
'Microsoft.Security/locations/jitNetworkAccessPolicies/write'
'Microsoft.Security/locations/jitNetworkAccessPolicies/initiate/action'
```

> [!WARNING]
> Deleting the resources using the command `azd down` won't delete the custom role definition, it will need to be deleted manually as [explained here](#Delete-the-custom-role-definition).

### Create the custom role definition manually

If the resources in Azure were provisionned with the parameter `addCustomRoleDefinition` set to false, the custom role definition must be created manually using the steps below:

1. Run the script below to create the custom role definition:

   ```shell
   az role definition create --role-definition '{
      "Name": "Yvand/azd-functions-azure-vms-management",
      "IsCustom": true,
      "Description": "Can list resource groups, start/stop virtual machines, update their disk SKU, and manage their JIT policies.",
      "Actions": [
         "Microsoft.Resources/subscriptions/resourceGroups/read",
         "Microsoft.Compute/virtualMachines/read",
         "Microsoft.Compute/virtualMachines/start/action",
         "Microsoft.Compute/virtualMachines/restart/action",
         "Microsoft.Compute/virtualMachines/deallocate/action",
         "Microsoft.Compute/disks/write",
         "Microsoft.Security/locations/jitNetworkAccessPolicies/read",
         "Microsoft.Security/locations/jitNetworkAccessPolicies/write",
         "Microsoft.Security/locations/jitNetworkAccessPolicies/initiate/action"
      ],
      "NotActions": [
      ],
      "AssignableScopes": [
         "/subscriptions/${subscriptionId}"
      ]
   }'
   ```

1. Run the script below toa assign the custom role to the function app's managed identity:

   ```bash
   funcAppName="YOUR_FUNC_APP_NAME"
   funcAppPrincipalId=$(az ad sp list --filter "displayName eq '${funcAppName}' and servicePrincipalType eq 'ManagedIdentity'" --query "[0].id" -o tsv)
   customRoleDefinitionId=$(az role definition list --name "Yvand/azd-functions-azure-vms-management" --query "[0].id" -o tsv)
   subscriptionId=$(az account show --query id --output tsv)
   az role assignment create --assignee $funcAppPrincipalId --role $customRoleDefinitionId --scope "/subscriptions/${subscriptionId}"
   ```

## Call the functions

For security reasons, when running in Azure, functions require an app key to pass in query string parameter `code`. The app keys can be found in the functions app service > App Keys.  

### Using vscode extension RestClient

You can use the Visual Studio Code extension [`REST Client`](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) to execute the requests in the .http file.  
It takes parameters from a .env file on the same folder. You can create it based on the sample files `azure.env.example` and `local.env.example`.

### Using curl

Below is a sample script in Bash that calls the functions in Azure using `curl`:

```bash
# Edit those variables to match your function app
funchost="YOUR_FUNC_APP_NAME"
code="YOUR_HOST_KEY"
resourceGroup="YOUR_RESOURCE_GROUP"

# VMs
vmsParameter="&vms=VMNAME1,VMNAME2" # Optional, if missing, action applies to all VMs in the resource group
curl "https://${funchost}.azurewebsites.net/api/vms/list?g=${resourceGroup}"
curl -X POST "https://${funchost}.azurewebsites.net/api/vms/setDiskSku?g=${resourceGroup}${vmsParameter}"
curl -X POST "https://${funchost}.azurewebsites.net/api/vms/start?g=${resourceGroup}${vmsParameter}"
curl -X POST "https://${funchost}.azurewebsites.net/api/vms/deallocate?g=${resourceGroup}${vmsParameter}}&nowait"

# JITs
policyNameParameter="&policyName=default"
vmParameter="&vm=vmName"
curl "https://${funchost}.azurewebsites.net/api/jits/list?g=${resourceGroup}"
curl "https://${funchost}.azurewebsites.net/api/jits/get?g=${resourceGroup}${policyNameParameter}${vmParameter}"
curl -X POST "https://${funchost}.azurewebsites.net/api/jits/createOrUpdate?g=${resourceGroup}${policyNameParameter}${vmParameter}"
curl -X POST "https://${funchost}.azurewebsites.net/api/jits/initiate?g=${resourceGroup}${policyNameParameter}${vmParameter}"
curl -X POST "https://${funchost}.azurewebsites.net/api/jits/delete?g=${resourceGroup}${policyNameParameter}"
```

The same script, which calls the functions when they run in your local environment:

```bash
# Edit those variables to match your function app
resourceGroup="YOUR_RESOURCE_GROUP"

# VMs
vmsParameter="&vms=VMNAME1,VMNAME2" # Optional, if missing, action applies to all VMs in the resource group
curl "http://localhost:7071/api/vms/list?g=${resourceGroup}"
curl -X POST "http://localhost:7071/api/vms/setDiskSku?g=${resourceGroup}${vmsParameter}"
curl -X POST "http://localhost:7071/api/vms/start?g=${resourceGroup}${vmsParameter}"
curl -X POST "http://localhost:7071/api/vms/deallocate?g=${resourceGroup}${vmsParameter}}&nowait"

# JITs
policyNameParameter="&policyName=default"
vmParameter="&vm=VMNAME"
curl "http://localhost:7071/api/jits/list?g=${resourceGroup}"
curl "http://localhost:7071/api/jits/get?g=${resourceGroup}${policyNameParameter}${vmParameter}"
curl -X POST "http://localhost:7071/api/jits/createOrUpdate?g=${resourceGroup}${policyNameParameter}${vmParameter}"
curl -X POST "http://localhost:7071/api/jits/initiate?g=${resourceGroup}${policyNameParameter}${vmParameter}"
curl -X POST "http://localhost:7071/api/jits/delete?g=${resourceGroup}${policyNameParameter}"
```

## Review the logs

When the functions run in your local environment, the logging goes to the console.  
When the functions run in Azure, the logging goes to the Application Insights resource configured in the app service.  

## Cleanup the resources in Azure

You can delete all the resources this project created in Azure, by running the command `azd down`.  
Alternatively, you can delete the resource group, which has the azd environment's name by default.

### Delete the custom role definition

The custom role definition needs to be deleted manually, either through the [Azure portal](https://portal.azure.com/#blade/Microsoft_Azure_Billing/SubscriptionsBlade), or using the commands below:

```shell
az role assignment delete --role --name "customRoleDef-XXX" --scope "/subscriptions/00000000-0000-0000-0000-000000000000"
az role definition delete --name "customRoleDef-XXX"
```

> [!NOTE]
> You can find the custom role definition's name and the subscription ID in the output of the azd environment
