targetScope = 'subscription'

param resourceGroupName string
param functionAppName string
param customRoleDefinitionName string

resource customRoleDefinition 'Microsoft.Authorization/roleDefinitions@2022-05-01-preview' = {
  name: guid(subscription().subscriptionId, customRoleDefinitionName)
  scope: subscription()
  properties: {
    description: 'Can start/stop virtual machines, update their disk SKU, and manage their JIT policies.'
    assignableScopes: [
      '/subscriptions/${subscription().subscriptionId}'
    ]
    permissions: [
      {
        actions: [
          'Microsoft.Resources/subscriptions/resourceGroups/read'
          'Microsoft.Compute/virtualMachines/read'
          'Microsoft.Compute/virtualMachines/start/action'
          'Microsoft.Compute/virtualMachines/restart/action'
          'Microsoft.Compute/virtualMachines/deallocate/action'
          'Microsoft.Compute/disks/write'
          'Microsoft.Security/locations/jitNetworkAccessPolicies/read'
          'Microsoft.Security/locations/jitNetworkAccessPolicies/write'
          'Microsoft.Security/locations/jitNetworkAccessPolicies/initiate/action'
        ]
      }
    ]
    roleName: customRoleDefinitionName
    type: 'CustomRole'
  }
}

resource functionApp 'Microsoft.Web/sites@2024-11-01' existing = {
  name: functionAppName
  scope: resourceGroup(resourceGroupName)
}

// Role assignment for the custom role definition on the Function App - Managed Identity
resource functionAppCustomRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().subscriptionId, customRoleDefinition.id)
  scope: subscription()
  properties: {
    roleDefinitionId: customRoleDefinition.id
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output customRoleDefinitionId string = customRoleDefinition.id
output customRoleDefinitionName string = customRoleDefinition.name
