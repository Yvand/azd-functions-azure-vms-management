import { VirtualMachine } from "@azure/arm-compute";
import { ResourceManagementClient } from "@azure/arm-resources";
import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { disk_updateOsDiskSku, virtualMachines_deallocate, virtualMachines_list, virtualMachines_start } from "../compute/virtualMachines.js";
import { getAzureCredential } from "../utils/authentication.js";
import { CommonConfig } from "../utils/common.js";
import { logError, logInfo } from "../utils/loggingHandler.js";
/**
 * 
 * Permission required: Microsoft.Compute/virtualMachines/read
 * @param request 
 * @param context 
 * @returns 
 */
export async function listVirtualMachines(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        if (!g) { return { status: 400, body: `Required parameters are missing.` }; }

        const vms: VirtualMachine[] = await virtualMachines_list(g);
        const vmInfos = vms.map(vm => ({ id: vm.id, name: vm.name, vmSize: vm.hardwareProfile?.vmSize, osDiskSize: vm.storageProfile?.osDisk?.diskSizeGB, location: vm.location }));
        return { status: 200, jsonBody: vmInfos };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

/**
 * Permission required: Microsoft.Compute/virtualMachines/start/action
 * @param request 
 * @param context 
 * @returns 
 */
export async function startVirtualMachines(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        const vmsParam = request.query.get('vms');
        const wait = request.query.has('nowait') ? false : true;
        if (!g) { return { status: 400, body: `Required parameters are missing.` }; }

        const vmNames: string[] = await getVMNamesFromFuncParameter(g, vmsParam);
        let promises: Promise<any>[] = [];
        vmNames.forEach(async (vm) => {
            promises.push(virtualMachines_start(context, g, vm, wait));
        });
        const result: any[] = await Promise.allSettled(promises);
        logInfo(context, `Started the following virtual machines in resource group '${g}': ${vmNames.join(', ')}`);
        return { status: 200, jsonBody: result.map(res => res.status === 'fulfilled' ? res.value : res.reason) };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

export async function deallocateVirtualMachines(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        const vmsParam = request.query.get('vms');
        const wait = request.query.has('nowait') ? false : true;
        if (!g) { return { status: 400, body: `Required parameters are missing.` }; }

        const vmNames: string[] = await getVMNamesFromFuncParameter(g, vmsParam);
        let promises: Promise<any>[] = [];
        vmNames.forEach(async (vm) => {
            promises.push(virtualMachines_deallocate(context, g, vm, wait));
        });
        const result: any[] = await Promise.allSettled(promises);
        return { status: 200, jsonBody: result.map(res => res.status === 'fulfilled' ? res.value : res.reason) };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

/**
 * Ensures that the specified disk SKU is applied to all the virtual machines which have the tag 'Automation:vm-disk'.
 * @param context The invocation context.
 * @param skuName The name of the disk SKU to apply.
 * @returns A promise that resolves when the operation is complete.
 */
const ensureVirtualMachinesDiskSku = async (context: InvocationContext, skuName: string): Promise<any> => {
    try {
        let promises: Promise<any>[] = [];
        const client = new ResourceManagementClient(getAzureCredential(), CommonConfig.SubscriptionId);
        for await (const group of client.resourceGroups.list({
            //filter: "tagName eq 'Automation' and tagValue eq 'vm-disk'"
        })) {
            const vms: VirtualMachine[] = await virtualMachines_list(group.name || "");
            const vmNames = vms.filter(vm => vm.tags && vm.tags[CommonConfig.AutomationTagName] === CommonConfig.AutomationDiskSKUTagValue && vm.name).map(vm => vm.name).join(',');
            if (vmNames.length > 0) {
                promises.push(setVirtualMachinesDiskSKUForGroup(context, group.name || "", vmNames, skuName, true));
            }
        }
        const result: PromiseSettledResult<any>[] = await Promise.allSettled(promises);
        return { status: 200, jsonBody: result.map(res => res.status === 'fulfilled' ? res.value : res.reason) };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
}

/**
 * Applies the specified disk SKU to the OS disk of the specified virtual machines in the given resource group.
 * @param request 
 * @param context 
 * @returns 
 */
async function setVirtualMachinesDiskSKU(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        const vmsParam = request.query.get('vms');
        const wait = request.query.has('nowait') ? false : true;
        const skuName = request.query.get('sku') || CommonConfig.AutomationDiskSKUName;
        if (!g) { return { status: 400, body: `Required parameters are missing.` }; }

        const result: any[] = await setVirtualMachinesDiskSKUForGroup(context, g, vmsParam, skuName, wait);
        return { status: 200, jsonBody: result };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

/**
 * Applies the specified disk SKU to the OS disk of the specified virtual machines in the given resource group.
 * @param context The invocation context.
 * @param g The resource group name.
 * @param vmNamesParam The virtual machine names.
 * @param skuName The name of the disk SKU to apply.
 * @param wait Whether to wait for the operation to complete.
 * @returns A promise that resolves when the operation is complete.
 */
async function setVirtualMachinesDiskSKUForGroup(context: InvocationContext, g: string, vmNamesParam: string | null, skuName: string, wait: boolean): Promise<any[]> {
    const vmNames: string[] = await getVMNamesFromFuncParameter(g, vmNamesParam);
    let promises: Promise<any>[] = [];
    vmNames.forEach(async (vm) => {
        promises.push(disk_updateOsDiskSku(context, g, vm, skuName, wait));
    });
    const result: PromiseSettledResult<any>[] = await Promise.allSettled(promises);
    // const vmsUpdateFailed: any[] = result.filter((res) => res.status === 'rejected');
    // if (vmsUpdateFailed.length > 0) {
    //     logInfo(context, `${vmsUpdateFailed.length} VMs encountered an error while updating their OS disk to SKU '${skuName}' in resource group '${g}': ${vmsUpdateFailed.map((res) => res.reason.virtualMachineName).join(', ')}`, LogLevel.Error);
    // }
    // const vmsUpdateSuccess: any[] = result.filter((res) => res.status === 'fulfilled');
    // if (vmsUpdateSuccess.length > 0) {
    //     logInfo(context, `Updated the OS disk to SKU '${skuName}' for the following virtual machines in resource group '${g}': ${vmsUpdateSuccess.map((res) => res.value.virtualMachineName).join(', ')}`);
    // }
    return result.map(res => res.status === 'fulfilled' ? res.value : res.reason);
};

const getVMNamesFromFuncParameter = async (g: string, vmsParam: string | null) => {
    let vmNames: string[] = [];
    if (!vmsParam || vmsParam === "*") {
        const vms: VirtualMachine[] = await virtualMachines_list(g);
        vmNames = vms.map(vm => vm.name || "");
    }
    else if (vmsParam && vmsParam.includes(',')) {
        vmNames = vmsParam.split(',');
    } else {
        vmNames.push(vmsParam);
    }
    return vmNames;
}

app.http('virtualMachines-list', { methods: ['GET'], authLevel: 'function', handler: listVirtualMachines, route: 'vms/list' });
app.http('virtualMachines-start', { methods: ['POST'], authLevel: 'function', handler: startVirtualMachines, route: 'vms/start' });
app.http('virtualMachines-deallocate', { methods: ['POST'], authLevel: 'function', handler: deallocateVirtualMachines, route: 'vms/deallocate' });
app.http('virtualMachines-setDiskSku', { methods: ['POST'], authLevel: 'function', handler: setVirtualMachinesDiskSKU, route: 'vms/setDiskSku' });
app.http('virtualMachines-ensureDiskSku', {
    methods: ['POST'], authLevel: 'function',
    handler: async function ensureVirtualMachinesDiskSKU(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
        return await ensureVirtualMachinesDiskSku(context, request.query.get('sku') || CommonConfig.AutomationDiskSKUName);
    }, route: 'vms/ensureDiskSku'
});

if (CommonConfig.IsLocalEnvironment === false && CommonConfig.AutomationDiskSKUEnabled) {
    app.timer('Automation_ensureDiskSku', {
        schedule: CommonConfig.AutomationDiskSkuSchedule,
        runOnStartup: false,
        handler: async (timer: Timer, context: InvocationContext) => await ensureVirtualMachinesDiskSku(context, CommonConfig.AutomationDiskSKUName)
    });
}
