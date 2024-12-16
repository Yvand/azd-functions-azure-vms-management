import { AscLocation, JitNetworkAccessPolicy, SecurityCenter } from "@azure/arm-security";
import { virtualMachines_get } from "../compute/virtualMachines.js";
import { getAzureCredential } from "../utils/authentication.js";
import { CommonConfig, safeWait } from "../utils/common.js";

// https://learn.microsoft.com/en-us/javascript/api/overview/azure/arm-security-readme?view=azure-node-latest
const client = new SecurityCenter(getAzureCredential(), CommonConfig.SubscriptionId);

export async function jits_list(g: string): Promise<JitNetworkAccessPolicy[]> {
    let jits: any[] = [];
    for await (const jit of client.jitNetworkAccessPolicies.listByResourceGroup(g)) {
        jits.push(jit);
    }
    return jits;
}

export async function jits_getAscLocation(): Promise<AscLocation> {
    let ascLocation: AscLocation[] = [];
    for await (const location of client.locations.list()) {
        ascLocation.push(location);
    }
    return ascLocation[0];
}

export async function jits_get(g: string, vmName: string): Promise<JitNetworkAccessPolicy> {
    let result: any = {
        vmName: vmName,
        resourceGroup: g,
    };

    //const ascLocation = await jits_getAscLocation(); Somehow the location returned by this function is not correct
    const vm = await virtualMachines_get(g, vmName);
    const jitPolicyName = `default`;
    const [response, error] = await safeWait(client.jitNetworkAccessPolicies.get(g, vm.location /*ascLocation.name as string*/, jitPolicyName));
    if (error) {
        result.operationStatus = "failed";
        result.error = error;
        return result;
    }
    return response;
}

export async function jits_initiate(g: string, location: string, vmName: string, jitPolicyName: string = "default"): Promise<any> {
    let result: any = {
        vmName: vmName,
        resourceGroup: g,
    };

    const vm = await virtualMachines_get(g, vmName);
    if (!vm.id) {
        result.operationStatus = "failed";
        result.error = `Could not get the virtual machine ' ${vmName}' in '${g}'.`;
        return result;
    }
    const now = new Date();
    const tenHoursLater = new Date(now.getTime() + 10 * 60 * 60 * 1000);
    const [response, error] = await safeWait(client.jitNetworkAccessPolicies.initiate(g, vm.location, jitPolicyName, {
        virtualMachines: [
            {
                id: vm.id,
                ports: [
                    {
                        number: 3389,
                        allowedSourceAddressPrefix: "*",
                        endTimeUtc: tenHoursLater
                    }
                ]
            }
        ]
    }));
    if (error) {
        result.operationStatus = "failed";
        result.error = error;
        return result;
    }
    result.response = response;
    return result;
}
