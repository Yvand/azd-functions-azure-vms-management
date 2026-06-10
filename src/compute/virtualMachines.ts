import { ComputeManagementClient, DiskUpdate, VirtualMachine } from "@azure/arm-compute";
import { OperationStatus } from "@azure/core-lro";
import { InvocationContext } from "@azure/functions";
import { getAzureCredential } from "../utils/authentication.js";
import { CommonConfig, VirtualMachineOperationState, safeWait } from "../utils/common.js";
import { logError, logInfo } from "../utils/loggingHandler.js";

// https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/compute/arm-compute
// https://github.com/Azure-Samples/azure-sdk-for-js-samples/tree/main/samples/compute
// https://learn.microsoft.com/en-us/javascript/api/overview/azure/arm-compute-readme?view=azure-node-latest
// https://learn.microsoft.com/en-us/javascript/api/@azure/arm-compute/computemanagementclient?view=azure-node-latest
// https://learn.microsoft.com/en-us/javascript/api/@azure/arm-compute/virtualmachine?view=azure-node-latest
const client = new ComputeManagementClient(getAzureCredential(), CommonConfig.SubscriptionId);

function getResourceGroupName(resourceId: string | undefined): string | undefined {
    if (!resourceId) {
        return undefined;
    }

    const resourceGroupMarker = "/resourceGroups/";
    const start = resourceId.toLowerCase().indexOf(resourceGroupMarker.toLowerCase());
    if (start === -1) {
        return undefined;
    }

    const valueStart = start + resourceGroupMarker.length;
    const valueEnd = resourceId.indexOf("/", valueStart);
    return valueEnd === -1 ? resourceId.slice(valueStart) : resourceId.slice(valueStart, valueEnd);
}

export async function virtualMachines_list(g: string): Promise<VirtualMachine[]> {
    let virtualMachines: VirtualMachine[] = [];
    for await (const vm of client.virtualMachines.list(g)) {
        virtualMachines.push(vm);
    }
    return virtualMachines;
}

export async function virtualMachines_get(g: string, vmName: string): Promise<VirtualMachine> {
    return await client.virtualMachines.get(g, vmName);
}

export async function virtualMachines_start(context: InvocationContext, g: string, vmName: string, wait: boolean = true): Promise<any> {
    let operationStatus: OperationStatus;
    try {
        if (wait) {
            await client.virtualMachines.start(g, vmName);
            operationStatus = "succeeded";
            logInfo(context, `Started virtual machine '${vmName}' in resource group '${g}'`);
        } else {
            const poller = client.virtualMachines.start(g, vmName);
            await poller.submitted();
            operationStatus = poller.operationState!.status;
            logInfo(context, `Starting virtual machine '${vmName}' in resource group '${g}' without waiting for completion. Status: '${operationStatus}'`);
        }
        const result: VirtualMachineOperationState = {
            virtualMachineName: vmName,
            resourceGroup: g,
            status: operationStatus,
            waitedUntilCompletion: wait,
        };
        return result;
    }
    catch (error: unknown) {
        logError(context, error, `Error while starting virtual machine '${vmName}' in resource group '${g}'`);
        const result: VirtualMachineOperationState = {
            virtualMachineName: vmName,
            resourceGroup: g,
            status: "failed",
            error: error instanceof Error ? error : new Error (String(error)),
        };
        return Promise.reject(result);
    }
}

export async function virtualMachines_deallocate(context: InvocationContext, g: string, vmName: string, wait: boolean = true): Promise<any> {
    try {
        let operationStatus: OperationStatus;
        if (wait) {
            await client.virtualMachines.deallocate(g, vmName);
            operationStatus = "succeeded";
            logInfo(context, `Deallocated virtual machine '${vmName}' in resource group '${g}'`);
        } else {
            const poller = client.virtualMachines.deallocate(g, vmName);
            await poller.submitted();
            operationStatus = poller.operationState!.status;
            logInfo(context, `Deallocating virtual machine '${vmName}' in resource group '${g}' without waiting for completion. Status: '${operationStatus}'`);
        }
        const result: VirtualMachineOperationState = {
            virtualMachineName: vmName,
            resourceGroup: g,
            status: operationStatus,
            waitedUntilCompletion: wait,
        };
        return result;
    }
    catch (error: unknown) {
        logError(context, error, `Error while deallocating virtual machine '${vmName}' in resource group '${g}'`);
        const result: VirtualMachineOperationState = {
            virtualMachineName: vmName,
            resourceGroup: g,
            status: "failed",
            error: error instanceof Error ? error : new Error (String(error)),
        };
        return Promise.reject(result);
    }
}

export async function disk_updateOsDiskSku(context: InvocationContext, g: string, vmName: string, skuName: string, wait: boolean = true): Promise<any> {

    if (!g?.trim()) {
        const allVirtualMachines: VirtualMachine[] = [];
        for await (const virtualMachine of client.virtualMachines.listAll()) {
            allVirtualMachines.push(virtualMachine);
        }

        const updates = allVirtualMachines
            .filter(virtualMachine => virtualMachine.name)
            .map(async (virtualMachine) => {
                const resourceGroup = getResourceGroupName(virtualMachine.id);
                if (!resourceGroup) {
                    const error = new Error(`Resource group not found for virtual machine '${virtualMachine.name}'`);
                    const result: VirtualMachineOperationState = {
                        virtualMachineName: virtualMachine.name || "",
                        resourceGroup: "",
                        status: "failed",
                        error,
                    };
                    return Promise.reject(result);
                }

                return disk_updateOsDiskSku(context, resourceGroup, virtualMachine.name || "", skuName, wait);
            });

        const result: PromiseSettledResult<any>[] = await Promise.allSettled(updates);
        return result.map(res => res.status === "fulfilled" ? res.value : res.reason);
    }

    const diskUpdateParameter: DiskUpdate = {
        sku: {
            name: skuName,
        },
    };

    const [virtualMachine, error] = await safeWait(client.virtualMachines.get(g, vmName));
    const disk_name = virtualMachine?.storageProfile?.osDisk?.name;
    if (error) {
        logError(context, error, `Error while updating the OS disk of virtual machine '${vmName}' in resource group '${g}'`);
        const result: VirtualMachineOperationState = {
            virtualMachineName: vmName,
            resourceGroup: g,
            status: "failed",
            error: error,
        };
        return Promise.reject(result);
    }
    if (disk_name === undefined) {
        const error = new Error ("Disk not found");
        logError(context, error, `Error while updating the OS disk of virtual machine '${vmName}' in resource group '${g}'`);
        const result: VirtualMachineOperationState = {
            virtualMachineName: vmName,
            resourceGroup: g,
            status: "failed",
            error: error,
        };
        return Promise.reject(result);
    }

    try {
        let operationStatus: OperationStatus;
        if (wait) {
            await client.disks.update(g, disk_name, diskUpdateParameter);
            operationStatus = "succeeded";
            logInfo(context, `Updated the OS disk of virtual machine '${vmName}' in resource group '${g}' to SKU '${skuName}'`);
        } else {
            const poller = client.disks.update(g, disk_name, diskUpdateParameter);
            await poller.submitted();
            operationStatus = poller.operationState!.status;
            logInfo(context, `Updating the OS disk of virtual machine '${vmName}' in resource group '${g}' without waiting for completion. Status: '${operationStatus}'`);
        }
        const result: VirtualMachineOperationState = {
            virtualMachineName: vmName,
            resourceGroup: g,
            status: operationStatus,
            waitedUntilCompletion: wait,
        };
        return result;
    }
    catch (error: unknown) {
        logError(context, error, `Error while updating the OS disk of virtual machine '${vmName}' in resource group '${g}'`);
        const result: VirtualMachineOperationState = {
            virtualMachineName: vmName,
            resourceGroup: g,
            status: "failed",
            error: error instanceof Error ? error : new Error (String(error)),
        };
        return Promise.reject(result);
    }    
}
