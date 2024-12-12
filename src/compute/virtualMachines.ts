import { ComputeManagementClient, VirtualMachine } from "@azure/arm-compute";
import { getAzureCredential } from "../utils/authentication.js";
import { CommonConfig } from "../utils/common.js";

// https://github.com/Azure-Samples/azure-sdk-for-js-samples/tree/main/samples/compute
// https://learn.microsoft.com/en-us/javascript/api/overview/azure/arm-compute-readme?view=azure-node-latest
// https://learn.microsoft.com/en-us/javascript/api/@azure/arm-compute/computemanagementclient?view=azure-node-latest
// https://learn.microsoft.com/en-us/javascript/api/@azure/arm-compute/virtualmachine?view=azure-node-latest
const client = new ComputeManagementClient(getAzureCredential(), CommonConfig.SubscriptionId);

export async function virtualMachines_list(g: string): Promise<VirtualMachine[]> {
    let vmNames: VirtualMachine[] = [];
    for await (const vm of client.virtualMachines.list(g)) {
        vmNames.push(vm);
    }
    return vmNames;
}

export async function virtualMachines_start(g: string, vmName: string, wait: boolean = false): Promise<any> {
    if (wait === true) {
        return await client.virtualMachines
            .beginStartAndWait(g, vmName)
            .then(() => {
                return {
                    vmName: vmName,
                    resourceGroup: g,
                    operationStatus: "done",
                    waitedUntilCompletion: true,
                };
            })
            .catch((error) => {
                return {
                    vmName: vmName,
                    resourceGroup: g,
                    operationStatus: "failed",
                    error: error,
                };
            });
    } else {
        return await client.virtualMachines
            .beginStart(g, vmName)
            .then((response) => {
                return {
                    vmName: vmName,
                    resourceGroup: g,
                    operationStatus: response.getOperationState().status,
                    waitedUntilCompletion: false,
                };
            })
            .catch((error) => {
                return {
                    vmName: vmName,
                    resourceGroup: g,
                    operationStatus: "failed",
                    error: error,
                };
            });
    }
}

export async function virtualMachines_deallocate(g: string, vmName: string, wait: boolean = false): Promise<any> {
    if (wait === true) {
        return await client.virtualMachines
            .beginDeallocateAndWait(g, vmName)
            .then(() => {
                return {
                    vmName: vmName,
                    resourceGroup: g,
                    operationStatus: "done",
                    waitedUntilCompletion: true,
                };
            })
            .catch((error) => {
                return {
                    vmName: vmName,
                    resourceGroup: g,
                    operationStatus: "failed",
                    error: error,
                };
            });
    } else {
        return await client.virtualMachines
            .beginDeallocate(g, vmName)
            .then((response) => {
                console.log(response.getOperationState().status);
                return {
                    vmName: vmName,
                    resourceGroup: g,
                    operationStatus: response.getOperationState().status,
                    waitedUntilCompletion: false,
                }
            })
            .catch((error) => {
                return {
                    vmName: vmName,
                    resourceGroup: g,
                    operationStatus: "failed",
                    error: error,
                };
            });
    }
}

