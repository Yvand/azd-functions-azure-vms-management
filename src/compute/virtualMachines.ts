import { ComputeManagementClient, Disk, DisksUpdateResponse, DiskUpdate, VirtualMachine } from "@azure/arm-compute";
import { getAzureCredential } from "../utils/authentication.js";
import { CommonConfig, safeWait } from "../utils/common.js";

// https://github.com/Azure-Samples/azure-sdk-for-js-samples/tree/main/samples/compute
// https://learn.microsoft.com/en-us/javascript/api/overview/azure/arm-compute-readme?view=azure-node-latest
// https://learn.microsoft.com/en-us/javascript/api/@azure/arm-compute/computemanagementclient?view=azure-node-latest
// https://learn.microsoft.com/en-us/javascript/api/@azure/arm-compute/virtualmachine?view=azure-node-latest
const client = new ComputeManagementClient(getAzureCredential(), CommonConfig.SubscriptionId);

export async function virtualMachines_list(g: string): Promise<VirtualMachine[]> {
    let virtualMachines: VirtualMachine[] = [];
    for await (const vm of client.virtualMachines.list(g)) {
        virtualMachines.push(vm);
    }
    return virtualMachines;
}

export async function virtualMachines_start(g: string, vmName: string, wait: boolean = true): Promise<any> {
    let result: any = {
        vmName: vmName,
        resourceGroup: g,
    };

    try {
        if (wait) {
            await client.virtualMachines.beginStartAndWait(g, vmName)
            result.waitedUntilCompletion = true;
            result.operationStatus = "done";
        } else {
            const response = await client.virtualMachines.beginStart(g, vmName)
            result.waitedUntilCompletion = false;
            result.operationStatus = response.getOperationState().status;
        }
    }
    catch (error: unknown) {
        result.operationStatus = "failed";
        result.error = error;
    }
    return result;
}

export async function virtualMachines_deallocate(g: string, vmName: string, wait: boolean = true): Promise<any> {
    let result: any = {
        vmName: vmName,
        resourceGroup: g,
    };

    try {
        if (wait) {
            await client.virtualMachines.beginDeallocateAndWait(g, vmName)
            result.waitedUntilCompletion = true;
            result.operationStatus = "done";
        } else {
            const response = await client.virtualMachines.beginDeallocate(g, vmName)
            result.waitedUntilCompletion = false;
            result.operationStatus = response.getOperationState().status;
        }
    }
    catch (error: unknown) {
        result.operationStatus = "failed";
        result.error = error;
    }
    return result;
}

export async function disk_updateOsDiskSku(g: string, vmName: string, skuName: string = "StandardSSD_LRS", wait: boolean = true): Promise<any> {
    let result: any = {
        vmName: vmName,
        resourceGroup: g,
    };
    const diskUpdateParameter: DiskUpdate = {
        sku: {
            name: skuName,
        },
    };

    const [virtualMachine, error] = await safeWait(client.virtualMachines.get(g, vmName));
    const disk_name = virtualMachine?.storageProfile?.osDisk?.name;
    if (error) {
        result.operationStatus = "failed";
        result.error = error;
        return result;
    }
    if (disk_name === undefined) {
        result.operationStatus = "failed";
        result.error = "Disk not found";
        return result;
    }

    try {
        if (wait) {
            await client.disks.beginUpdateAndWait(g, disk_name, diskUpdateParameter)
            result.waitedUntilCompletion = true;
            result.operationStatus = "done";
        } else {
            const response = await client.disks.beginUpdate(g, disk_name, diskUpdateParameter);
            result.waitedUntilCompletion = false;
            result.operationStatus = response.getOperationState().status;
        }
    }
    catch (error: unknown) {
        result.operationStatus = "failed";
        result.error = error;
    }
    return result;
}
