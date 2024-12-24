---
name: Azure Functions for Azure Compute SDK
description: This quickstart uses azd CLI to deploy Azure Functions to manage your virtual machines running in Azure.
page_type: sample
languages:
- azdeveloper
- bicep
- nodejs
- typescript
products:
- azure-functions
urlFragment: functions-quickstart-typescript-azuresdk
---

# Azure Functions for Azure Compute SDK

This quickstart is based on [this repository](https://github.com/Yvand/functions-quickstart-spo-azd). It uses Azure Developer command-line (azd) tools to deploy Azure Functions which can start / stop virtual machines. on your own Azure subscription.  
The Azure functions use the [Flex Consumption plan](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan), are written in TypeScript and run in Node.js 20.  

## Overview

This project deploys HTTP-triggered functions to start / stop virtual machines.

## Security of the Azure resources

The resources deployed in Azure are configured with a high level of security: 
- The functions service connects to the storage account and the key vault using a private endpoint.
- No network access is allowed on the storage account and the key vault, except on specified IPs (configurable).
- Authorization is configured using the functions service's managed identity (no access key or legacy access policy is enabled).
- All the functions require a key to be called.

## Prerequisites

+ [Node.js 20](https://www.nodejs.org/)
+ [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local?pivots=programming-language-typescript#install-the-azure-functions-core-tools)
+ [Azure Developer CLI (AZD)](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
+ To use Visual Studio Code to run and debug locally:
  + [Visual Studio Code](https://code.visualstudio.com/)
  + [Azure Functions extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)

## Initialize the local project

You can initialize a project from this `azd` template in one of these ways:

+ Use this `azd init` command from an empty local (root) folder:

    ```shell
    azd init --template Yvand/functions-quickstart-spo-azd
    ```

    Supply an environment name, such as `functions-azuresdk-main` when prompted. In `azd`, the environment is used to maintain a unique deployment context for your app.

+ Clone the GitHub template repository, and create an `azd` environment (in this example, `functions-azuresdk-main`):

    ```shell
    git clone https://github.com/Yvand/functions-quickstart-spo-azd.git
    cd functions-quickstart-spo-azd
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
         "TenantPrefix": "YOUR_SHAREPOINT_TENANT_PREFIX",
         "SiteRelativePath": "/sites/YOUR_SHAREPOINT_SITE_NAME"
      }
   }
   ```

1. Review the file `infra/main.parameters.json` to customize the parameters used for provisioning the resources in Azure. Review [this article](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/manage-environment-variables) to manage the azd's environment variables.

   Important: Ensure the values for `TenantPrefix` and `SiteRelativePath` are identical between the files `local.settings.json` (used when running the functions locally) and `infra\main.parameters.json` (used to set the environment variables in Azure).

1. Install the dependencies and build the functions app:

   ```shell
   npm install
   npm run build
   ```

1. Provision the resources in Azure and deploy the functions app package by running command `azd up`.

1. The functions can also be run locally by executing command `npm run start`.

# Grant the functions access to Azure

The authentication to SharePoint is done using `DefaultAzureCredential`, so the credential used depends if the functions run on your local environment, or in Azure.  
If you never heard about `DefaultAzureCredential`, you should familirize yourself with its concept by reading [this article](https://aka.ms/azsdk/js/identity/credential-chains#use-defaultazurecredential-for-flexibility), before continuing.




```json
{
    "Name": "Virtual Machine Operator Yvand",
	"Description": "Perform VM actions for functions-quickstart-typescript-azuresdk.",
    "IsCustom": true,
    "Description": "Can deallocate, start  and restart virtual machines.",
    "Actions": [
        "Microsoft.Compute/*/read",
        "Microsoft.Compute/virtualMachines/start/action",
        "Microsoft.Compute/virtualMachines/restart/action",
        "Microsoft.Compute/virtualMachines/deallocate/action",
        "Microsoft.Compute/disks/write"
    ],
    "NotActions": [
    ],
    "AssignableScopes": [
        "/subscriptions/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    ]
}
```


## Call the functions

For security reasons, when running in Azure, functions require an app key to pass in query string parameter `code`. The app keys can be found in the functions app service > App Keys.  

### Using vscode extension RestClient

You can use the Visual Studio Code extension [`REST Client`](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) to execute the requests in the .http file.  
It takes parameters from a .env file on the same folder. You can create it based on the sample files `azure.env.example` and `local.env.example`.

### Using curl

Below is a sample script in Bash that calls the functions in Azure using `curl`:

```bash
# Edit those variables to fit your app function
funchost="YOUR_FUNC_APP_NAME"
code="YOUR_HOST_KEY"
resourceGroup="YOUR_RESOURCE_GROUP"

# VMs
vmsParameter="&vms=VMNAME1,VMNAME2"
curl "https://${funchost}.azurewebsites.net/api/vms/list?g=${resourceGroup}"
curl -X POST "https://${funchost}.azurewebsites.net/api/vms/updateOsDiskSku?g=${resourceGroup}${vmsParameter}"
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
# Edit those variables to fit your app function
resourceGroup="YOUR_RESOURCE_GROUP"

# VMs
vmsParameter="&vms=VMNAME1,VMNAME2"
curl "http://localhost:7071/api/vms/list?g=${resourceGroup}"
curl -X POST "http://localhost:7071/api/vms/updateOsDiskSku?g=${resourceGroup}${vmsParameter}"
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

### KQL queries for Application Insights

The KQL query below shows the entries from all the functions, and filters out the logging from the infrastructure:

```kql
traces 
| where isnotempty(operation_Name)
| project timestamp, operation_Name, severityLevel, message
| order by timestamp desc
```

The KQL query below does the following:

- Includes only the entries from the function `webhooks/service` (which receives the notifications from SharePoint)
- Parses the `message` as a json document (which is how this project writes the messages)
- Includes only the entries that were successfully parsed (excludes those from the infrastructure)

```kql
traces 
| where operation_Name contains "webhooks-service"
| extend jsonMessage = parse_json(message)
| where isnotempty(jsonMessage.['message'])
| project timestamp, operation_Name, severityLevel, jsonMessage.['message'], jsonMessage.['error']
| order by timestamp desc
```

## Known issues

Azure Functions Flex Consumption plan is currently in preview, be aware about its [current limitations and issues](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan#considerations).

## Cleanup the resources in Azure

You can delete all the resources this project created in Azure, by running the command `azd down`.  
Alternatively, you can delete the resource group, which has the azd environment's name by default.
