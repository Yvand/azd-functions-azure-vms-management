import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { logError, logInfo, LogLevel } from "../utils/loggingHandler.js";
import { disk_updateOsDiskSku, virtualMachines_deallocate, virtualMachines_list, virtualMachines_start } from "../compute/virtualMachines.js";
import { VirtualMachine } from "@azure/arm-compute";
import { CommonConfig } from "../utils/common.js";
import { ResourceManagementClient, ResourceGroup, } from "@azure/arm-resources";
import { getAzureCredential } from "../utils/authentication.js";
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
            promises.push(virtualMachines_start(g, vm, wait));
        });
        const result: any[] = await Promise.all(promises);
        logInfo(context, `Started the following virtual machines in resource group '${g}': ${vmNames.join(', ')}`);
        return { status: 200, jsonBody: result };
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
            promises.push(virtualMachines_deallocate(g, vm, wait));
        });
        const result: any[] = await Promise.all(promises);
        logInfo(context, `Deallocated the following virtual machines in resource group '${g}': ${vmNames.join(', ')}`);
        return { status: 200, jsonBody: result };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

export async function ensureVirtualMachinesDiskSKU(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        const vmsParam = request.query.get('vms');
        const wait = request.query.has('nowait') ? false : true;
        const skuName = request.query.get('sku') || CommonConfig.EnsureDiskSKUName;
        if (!g) { return { status: 400, body: `Required parameters are missing.` }; }

        const result: any[] = await ensureVirtualMachinesDiskSKUInternal(context, g, vmsParam, skuName, wait);
        return { status: 200, jsonBody: result };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

export async function ensureVirtualMachinesDiskSKUInternal(context: InvocationContext, g: string, vmNamesParam: string | null, skuName: string, wait: boolean): Promise<any[]> {
    const vmNames: string[] = await getVMNamesFromFuncParameter(g, vmNamesParam);
    let promises: Promise<any>[] = [];
    vmNames.forEach(async (vm) => {
        promises.push(disk_updateOsDiskSku(g, vm, skuName, wait));
    });
    const result: any[] = await Promise.all(promises);
    logInfo(context, `Updated the OS disk to SKU '${skuName}' for the following virtual machines in resource group '${g}': '${vmNames.join(', ')}'`);
    return result;
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
app.http('virtualMachines-ensureDiskSku', { methods: ['POST'], authLevel: 'function', handler: ensureVirtualMachinesDiskSKU, route: 'vms/ensureDiskSku' });

if (CommonConfig.IsLocalEnvironment === false) {
    app.timer('Timer_ensureDiskSku', {
        schedule: "0 30 6 * * 1-5", // At 6h30 UTC every weekday - https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-typescript#ncrontab-examples
        runOnStartup: false,
        handler: async (timer: Timer, context: InvocationContext) => {
            const skuName = CommonConfig.EnsureDiskSKUName;
            const client = new ResourceManagementClient(getAzureCredential(), CommonConfig.SubscriptionId);
            for await (const group of client.resourceGroups.list({
                filter: CommonConfig.EnsureDiskSKUTagFilter
            })) {
                try {
                    await ensureVirtualMachinesDiskSKUInternal(context, group.name || "", '*', skuName, true);
                }
                catch (error: unknown) {
                    logError(context, error, `Could not update the OS disk to SKU '${skuName}' for the virtual machines in resource group '${group.name || ""}'.`);
                }
            }
        }
    });
}

app.http('virtualMachines-test', {
    methods: ['GET'], authLevel: 'function', handler: async function listVirtualMachines(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
        try {
            const client = new ResourceManagementClient(getAzureCredential(), CommonConfig.SubscriptionId);
            let groups: string[] = [];
            for await (const group of client.resourceGroups.list({
                filter: CommonConfig.EnsureDiskSKUTagFilter
            })) {
                groups.push(group.name || "");
                await ensureVirtualMachinesDiskSKUInternal(context, group.name || "", null, "StandardSSD_LRS", true);
            }
            return { status: 200, jsonBody: groups };
        }
        catch (error: unknown) {
            const errorDetails = logError(context, error, context.functionName);
            return { status: errorDetails.httpStatus, jsonBody: errorDetails };
        }
    }, route: 'vms/test'
});
