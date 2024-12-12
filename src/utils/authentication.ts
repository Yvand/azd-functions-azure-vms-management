import { AccessToken, AzureCliCredential, AzureDeveloperCliCredential, DefaultAzureCredential, ManagedIdentityCredential, ManagedIdentityCredentialClientIdOptions, TokenCredential } from "@azure/identity";
import { CommonConfig } from "./common.js";
import { setLogLevel } from "@azure/logger";

// setLogLevel("info");

/**
 * Get the access token for the SharePoint site
 * @param tenantPrefix SharePoint tenant prefix
 * @returns Access token
 */
export async function getSpAccessToken(tenantPrefix: string): Promise<AccessToken | null> {
  const tokenCreds = getAzureCredential();
  const scopes: string[] = getScopes(tenantPrefix);
  let accessToken = await tokenCreds.getToken(scopes);
  return accessToken;
}

/**
 * Get the scopes for the SharePoint site, depending on the environment (local or cloud)
 */
function getScopes(tenantPrefix: string): string[] {
  const scopes: string[] = [`https://${tenantPrefix}.sharepoint.com/.default`];
  if (CommonConfig.IsLocalEnvironment) {
    // When code runs locally, DefaultAzureCredential typically via the Azure CLI (which needs delegated permissions on SharePoint app to be able to connect)
    // If scope below is not added, it will connect with only scope "user_impersonation" and SharePoint will deny it
    // An additional scope is required for SharePoint to accept the token, hence the line below
    // Note: This scope cannot be added in prod because (for managed identity) because: "ManagedIdentityCredential: Multiple scopes are not supported"
    scopes.push("Sites.Selected");
  }
  return scopes;
}

export function getAzureCredential(): TokenCredential {
  return withDefaultAzureCredential();
}

/**
 * Authenticate if possible with a managed identity, either the system-assigned or a user-assigned managed identity, or to a fallback method (such as az cli)
 */
function withDefaultAzureCredential(): TokenCredential {
  const credential = new DefaultAzureCredential(
    // if managedIdentityClientId is undefined, it will use the system-assigned managed identity
    { managedIdentityClientId: CommonConfig.UserAssignedManagedIdentityClientId }
    // {
    //   loggingOptions: {
    //     allowLoggingAccountIdentifiers: true,
    //     enableUnsafeSupportLogging: true
    //   },
    // }
  );
  return credential;
}

function withManagedIdentityCredential(): TokenCredential {
  const options: ManagedIdentityCredentialClientIdOptions = {
    // if the identity is a system-assigned identity, clientId is not needed
    clientId: CommonConfig.UserAssignedManagedIdentityClientId,
    // loggingOptions: {
    //   allowLoggingAccountIdentifiers: true,
    //   enableUnsafeSupportLogging: true,
    // },
  }
  const credential = new ManagedIdentityCredential(options);
  return credential;
}

function withAzureCliCredential(): TokenCredential {
  // As you can see in this example, the AzureCliCredential does not take any parameters,
  // instead relying on the Azure CLI authenticated user to authenticate.
  const credential = new AzureCliCredential();
  return credential;
}

function withAzureDeveloperCliCredential(): TokenCredential {
  // As you can see in this example, the AzureDeveloperCliCredential does not take any parameters,
  // instead relying on the Azure Developer CLI authenticated user to authenticate.
  const credential = new AzureDeveloperCliCredential();
  return credential;
}
