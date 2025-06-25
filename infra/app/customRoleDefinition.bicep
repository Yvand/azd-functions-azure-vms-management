targetScope = 'subscription'

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

output customRoleDefinitionId string = customRoleDefinition.id
