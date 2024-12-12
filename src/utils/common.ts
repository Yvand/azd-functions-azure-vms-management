import { VirtualMachine } from "@azure/arm-compute";
import { virtualMachines_list } from "../compute/virtualMachines.js";

export const CommonConfig = {
    IsLocalEnvironment: process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development" ? true : false,
    UserAssignedManagedIdentityClientId: process.env.UserAssignedManagedIdentityClientId || undefined,
    SubscriptionId: process.env.SubscriptionId || "",
}

// This method awaits on async calls and catches the exception if there is any - https://dev.to/sobiodarlington/better-error-handling-with-async-await-2e5m
export const safeWait = (promise: Promise<any>) => {
    return promise
        .then(data => ([data, undefined]))
        .catch(error => Promise.resolve([undefined, error]));
}
