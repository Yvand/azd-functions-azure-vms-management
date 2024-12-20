import { AscLocation, JitNetworkAccessPoliciesCreateOrUpdateResponse, JitNetworkAccessPoliciesInitiateResponse, JitNetworkAccessPolicy, JitNetworkAccessPolicyInitiatePort, JitNetworkAccessPolicyInitiateRequest, JitNetworkAccessPolicyVirtualMachine, SecurityCenter } from "@azure/arm-security";
import { virtualMachines_get } from "../compute/virtualMachines.js";
import { getAzureCredential } from "../utils/authentication.js";
import { CommonConfig } from "../utils/common.js";
import { VirtualMachine } from "@azure/arm-compute";

// https://learn.microsoft.com/en-us/javascript/api/overview/azure/arm-security-readme?view=azure-node-latest
const client = new SecurityCenter(getAzureCredential(), CommonConfig.SubscriptionId);

export async function jits_getAscLocation(): Promise<AscLocation> {
    let ascLocation: AscLocation[] = [];
    for await (const location of client.locations.list()) {
        ascLocation.push(location);
    }
    return ascLocation[0];
}

export async function jits_list(g: string): Promise<JitNetworkAccessPolicy[]> {
    let jits: any[] = [];
    for await (const jit of client.jitNetworkAccessPolicies.listByResourceGroup(g)) {
        jits.push(jit);
    }
    return jits;
}

export async function jits_get(g: string, jitPolicyName: string): Promise<JitNetworkAccessPolicy | undefined> {
    //const ascLocation = await jits_getAscLocation(); // Somehow the location returned by this function is not correct
    //return await client.jitNetworkAccessPolicies.get(g, jitPolicyLocation, jitPolicyName);
    const jitPolicies = await jits_list(g);
    return jitPolicies.find(jit => jit.name === jitPolicyName);
}

export async function jits_getPolicyVorVirtualMachine(g: string, vmName: string, jitPolicyLocation: string, jitPolicyName: string): Promise<JitNetworkAccessPolicyVirtualMachine | void> {
    const jitPolicy = await client.jitNetworkAccessPolicies.get(g, jitPolicyLocation, jitPolicyName);
    const vm: VirtualMachine = await virtualMachines_get(g, vmName);
    if (vm.id !== undefined) {
        return jitPolicy.virtualMachines.find(vmJitPolicy => vmJitPolicy.id.toLowerCase() === vm.id?.toLowerCase());
    }
}

export async function jits_initiate(g: string, vmName: string, jitPolicyName: string, durationInHours: number): Promise<JitNetworkAccessPoliciesInitiateResponse | void> {
    const jitPolicy = await jits_get(g, jitPolicyName);
    let jitPolicyLocation = jitPolicy?.location;
    if (!jitPolicy?.location) {
        jitPolicyLocation = (await jits_getAscLocation()).name;
    }
    if (!jitPolicyLocation) {
        throw new Error(`Unable to determine the location of the JIT policy '${jitPolicyName}'.`);
    }

    const vmPolicy = await jits_getPolicyVorVirtualMachine(g, vmName, jitPolicyLocation, jitPolicyName);
    if (!vmPolicy) {
        throw new Error(`Could not find a policy for the virtual machine '${vmName}' in the JIT policy '${jitPolicyName}'.`);
    }

    const now = new Date();
    const tenHoursLater = new Date(now.getTime() + durationInHours * 60 * 60 * 1000);
    const ports: JitNetworkAccessPolicyInitiatePort[] = [];
    vmPolicy.ports.forEach(port => {
        ports.push({
            number: port.number,
            allowedSourceAddressPrefix: port.allowedSourceAddressPrefix,
            endTimeUtc: tenHoursLater
        });
    });
    const jitRequest: JitNetworkAccessPolicyInitiateRequest = {
        virtualMachines: [
            {
                id: vmPolicy.id,
                ports: ports
            },
        ]
    };
    return await client.jitNetworkAccessPolicies.initiate(g, jitPolicyLocation, jitPolicyName, jitRequest);
}

export async function jits_createOrUpdate(g: string, jitPolicyName: string, virtualMachinePolicy: JitNetworkAccessPolicyVirtualMachine): Promise<JitNetworkAccessPoliciesCreateOrUpdateResponse> {
    let jitPolicy = await jits_get(g, jitPolicyName);
    if (!jitPolicy) {
        const jitPolicyLocation = (await jits_getAscLocation()).name;
        jitPolicy = {
            name: jitPolicyName,
            location: jitPolicyLocation,
            virtualMachines: [virtualMachinePolicy]
        }
    } else {
        const existingVmPolicy = jitPolicy.virtualMachines.find(vmJitPolicy => vmJitPolicy.id.toLowerCase() === virtualMachinePolicy.id.toLowerCase());
        if (!existingVmPolicy) {
            jitPolicy.virtualMachines.push(virtualMachinePolicy);
        } else {
            existingVmPolicy.ports = virtualMachinePolicy.ports;
        }
    }
    return await client.jitNetworkAccessPolicies.createOrUpdate(g, jitPolicy.location as string, jitPolicyName, jitPolicy);
}
