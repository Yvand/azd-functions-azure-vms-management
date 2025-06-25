import { OperationState } from "@azure/core-lro";

export const CommonConfig = {
    IsLocalEnvironment: process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development" ? true : false,
    UserAssignedManagedIdentityClientId: process.env.UserAssignedManagedIdentityClientId || undefined,
    SubscriptionId: process.env.SubscriptionId || "",
    AllowedIpAddressPrefixes: process.env.AllowedIpAddressPrefixes?.split(',') || [""],
    AutomationTagName: process.env.AutomationTagName || "Automation",
    AutomationDiskSKUTagValue: process.env.SetDiskTagFilter || "vm-disk",
    AutomationDiskSKU: process.env.DiskSkuName || "StandardSSD_LRS",
}

// This method awaits on async calls and catches the exception if there is any - https://dev.to/sobiodarlington/better-error-handling-with-async-await-2e5m
export const safeWait = (promise: Promise<any>) => {
    return promise
        .then(data => ([data, undefined]))
        .catch(error => Promise.resolve([undefined, error]));
}

// export type VirtualMachineOperationState = {
//     virtualMachineName: string;
//     resourceGroup: string;
//     operationStatus: OperationStatus;
//     error: Error | string | null;
//     waitedUntilCompletion?: boolean;
// };

export interface VirtualMachineOperationState extends OperationState<any> {
    virtualMachineName: string;
    resourceGroup: string;
    waitedUntilCompletion?: boolean;
}
